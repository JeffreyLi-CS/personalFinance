// Expected values below were worked out by hand; see the comment on each test.

#include <cmath>
#include <exception>
#include <functional>
#include <iostream>
#include <string>
#include <vector>

#include "backtest.hpp"
#include "risk.hpp"

namespace {

int failures = 0;

void check_near(const std::string& name, double got, double want, double tol = 1e-4) {
    if (std::fabs(got - want) > tol) {
        std::cout << "  FAIL " << name << ": got " << got << ", want " << want << "\n";
        ++failures;
    }
}

void run(const std::string& name, const std::function<void()>& body) {
    try {
        body();
        std::cout << "ran  " << name << "\n";
    } catch (const std::exception& e) {
        std::cout << "  FAIL " << name << ": threw " << e.what() << "\n";
        ++failures;
    }
}

}  // namespace

int main() {
    // 100 -> 110 -> 99 -> 108.9 is +10%, -10%, +10%.
    const std::vector<double> prices{100, 110, 99, 108.9};

    run("daily_returns", [&] {
        const auto r = daily_returns(prices);
        if (r.size() != 3) { std::cout << "  FAIL daily_returns: wrong size\n"; ++failures; return; }
        check_near("r[0]", r[0], 0.10);
        check_near("r[1]", r[1], -0.10);
        check_near("r[2]", r[2], 0.10);
    });

    // Mean 0.0333; squared deviations sum to 0.026667; / (n-1) = 0.013333;
    // sqrt = 0.115470; * sqrt(252) = 1.833030.
    run("annualized_volatility", [&] {
        check_near("vol", annualized_volatility({0.10, -0.10, 0.10}), 1.833030);
    });

    // Peak 110, trough 99: (110 - 99) / 110 = 0.10.
    run("max_drawdown", [&] { check_near("mdd", max_drawdown(prices), 0.10); });

    // 20 returns from -0.05 to 0.14. Rank ceil(0.05 * 20) = 1, the smallest: -0.05.
    run("historical_var", [&] {
        std::vector<double> r;
        for (int i = 0; i < 20; ++i) r.push_back(-0.05 + 0.01 * i);
        check_near("var95", historical_var(r, 0.95), 0.05);
    });

    // Day 1: 0.6*0.10 + 0.4*0.00 = 0.06. Day 2: 0.6*-0.10 + 0.4*0.02 = -0.052.
    run("portfolio_returns", [&] {
        const auto p = portfolio_returns({{0.10, -0.10}, {0.00, 0.02}}, {0.6, 0.4});
        check_near("p[0]", p[0], 0.06);
        check_near("p[1]", p[1], -0.052);
    });

    // 1.0 -> 1.21 over 504 trading days is 10% per year.
    run("annualized_return", [&] {
        std::vector<double> v(505, 1.0);
        v.back() = 1.21;
        check_near("cagr", annualized_return(v), 0.10);
    });

    // A: 100 -> 200 -> 100. B flat at 100. Weights 50/50.
    PriceMatrix m;
    m.tickers = {"A", "B"};
    m.dates = {"d0", "d1", "d2"};
    m.closes = {{100, 200, 100}, {100, 100, 100}};

    // Buy and hold: 0.005 shares of A and 0.005 of B. End: 0.5 + 0.5 = 1.0.
    run("backtest_buy_and_hold", [&] {
        const auto v = backtest_values(m, {0.5, 0.5}, 0);
        check_near("bh d1", v[1], 1.5);
        check_near("bh d2", v[2], 1.0);
    });

    // Rebalance daily: d1 = 1.5, reset to 0.75/0.75; A halves, so d2 = 0.375 + 0.75 = 1.125.
    run("backtest_daily_rebalance", [&] {
        const auto v = backtest_values(m, {0.5, 0.5}, 1);
        check_near("rb d1", v[1], 1.5);
        check_near("rb d2", v[2], 1.125);
    });

    // Rebalancing every day keeps the weights fixed, so the backtest's daily returns
    // must match portfolio_returns computed directly from each asset's returns.
    run("daily_rebalance_matches_portfolio_returns", [&] {
        PriceMatrix p;
        p.tickers = {"A", "B", "C"};
        p.dates = {"d0", "d1", "d2", "d3", "d4"};
        p.closes = {{50, 52, 51, 55, 54}, {20, 19, 21, 22, 20}, {100, 100, 101, 99, 102}};
        const std::vector<double> w{0.5, 0.3, 0.2};

        const auto from_backtest = daily_returns(backtest_values(p, w, 1));
        const auto direct = portfolio_returns(
            {daily_returns(p.closes[0]), daily_returns(p.closes[1]), daily_returns(p.closes[2])}, w);
        for (size_t t = 0; t < direct.size(); ++t)
            check_near("day " + std::to_string(t), from_backtest[t], direct[t], 1e-12);
    });

    std::cout << (failures == 0 ? "ALL PASSED\n" : std::to_string(failures) + " FAILED\n");
    return failures == 0 ? 0 : 1;
}
