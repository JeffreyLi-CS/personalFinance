// Usage: ./build/risk VOO:0.4 QQQ:0.3 BND:0.3
// Prints risk metrics for the portfolio held two ways: buy and hold, and rebalanced
// back to the target weights about monthly. Prices come from data/prices (see
// scripts/fetch_prices.py). Weights are scaled to sum to 1.

#include <chrono>
#include <cstdio>
#include <exception>
#include <stdexcept>
#include <string>
#include <vector>

#include "backtest.hpp"
#include "prices.hpp"
#include "risk.hpp"

namespace {

void print_row(const char* label, const RiskSummary& s) {
    std::printf("%-20s %13.2f%% %10.2f%% %12.2f%% %15.2f%%\n", label, 100 * s.annual_return,
                100 * s.volatility, 100 * s.max_drawdown, 100 * s.var_95);
}

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "usage: %s TICKER:WEIGHT [TICKER:WEIGHT ...]\n", argv[0]);
        return 2;
    }

    try {
        std::vector<std::string> tickers;
        std::vector<double> weights;
        double total = 0.0;
        for (int i = 1; i < argc; ++i) {
            const std::string arg = argv[i];
            const auto colon = arg.find(':');
            if (colon == std::string::npos) throw std::invalid_argument("expected TICKER:WEIGHT, got " + arg);
            const double weight = std::stod(arg.substr(colon + 1));
            if (weight < 0) throw std::invalid_argument("negative weight in " + arg);
            tickers.push_back(arg.substr(0, colon));
            weights.push_back(weight);
            total += weight;
        }
        if (total <= 0) throw std::invalid_argument("weights sum to zero");
        for (auto& w : weights) w /= total;

        const auto prices = load_prices(tickers);

        std::printf("Portfolio:");
        for (size_t i = 0; i < tickers.size(); ++i) std::printf("  %s %.1f%%", tickers[i].c_str(), 100 * weights[i]);
        std::printf("\n%zu trading days, %s to %s\n\n", prices.dates.size(), prices.dates.front().c_str(),
                    prices.dates.back().c_str());

        const auto start = std::chrono::steady_clock::now();
        const auto hold = summarize(backtest_values(prices, weights, 0));
        const auto monthly = summarize(backtest_values(prices, weights, kMonthlyRebalanceDays));
        const auto elapsed = std::chrono::steady_clock::now() - start;

        std::printf("%-20s %14s %11s %13s %16s\n", "", "Annual return", "Volatility", "Max drawdown",
                    "1-day VaR (95%)");
        print_row("Buy and hold", hold);
        print_row("Monthly rebalance", monthly);
        std::printf("\nAnalysis took %.3f ms\n", std::chrono::duration<double, std::milli>(elapsed).count());
    } catch (const std::exception& e) {
        std::fprintf(stderr, "error: %s\n", e.what());
        return 1;
    }
    return 0;
}
