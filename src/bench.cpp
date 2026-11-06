// Usage: ./build/bench TICKER [TICKER ...]
// Times one full analysis of an equal-weight portfolio (buy-and-hold and monthly
// backtests, plus all four risk metrics on each), repeated to get a stable median
// and p99. The CSV load is timed separately.

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <exception>
#include <string>
#include <vector>

#include "backtest.hpp"
#include "prices.hpp"
#include "risk.hpp"

namespace {

constexpr int kRuns = 1000;

double ms_since(std::chrono::steady_clock::time_point start) {
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
}

// Writing each result here keeps the compiler from skipping the timed work.
volatile double sink;

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "usage: %s TICKER [TICKER ...]\n", argv[0]);
        return 2;
    }
    const std::vector<std::string> tickers(argv + 1, argv + argc);

    try {
        const auto load_start = std::chrono::steady_clock::now();
        const auto prices = load_prices(tickers);
        const double load_ms = ms_since(load_start);

        const std::vector<double> weights(tickers.size(), 1.0 / tickers.size());
        std::vector<double> run_ms;
        run_ms.reserve(kRuns);
        for (int i = 0; i < kRuns; ++i) {
            const auto start = std::chrono::steady_clock::now();
            const auto hold = summarize(backtest_values(prices, weights, 0));
            const auto monthly = summarize(backtest_values(prices, weights, kMonthlyRebalanceDays));
            run_ms.push_back(ms_since(start));
            sink = hold.max_drawdown + monthly.max_drawdown;
        }
        std::sort(run_ms.begin(), run_ms.end());

        std::printf("%zu tickers, %zu trading days (%s to %s)\n", tickers.size(), prices.dates.size(),
                    prices.dates.front().c_str(), prices.dates.back().c_str());
        std::printf("CSV load:  %.2f ms\n", load_ms);
        std::printf("Analysis:  median %.3f ms, p99 %.3f ms over %d runs\n", run_ms[kRuns / 2],
                    run_ms[static_cast<size_t>(std::ceil(0.99 * kRuns)) - 1], kRuns);
    } catch (const std::exception& e) {
        std::fprintf(stderr, "error: %s\n", e.what());
        return 1;
    }
    return 0;
}
