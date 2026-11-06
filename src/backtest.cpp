#include "backtest.hpp"

#include <cmath>
#include <numeric>
#include <stdexcept>

std::vector<double> backtest_values(const PriceMatrix& prices,
                                    const std::vector<double>& weights,
                                    int rebalance_every) {
    const size_t assets = prices.closes.size();
    const size_t days = prices.dates.size();
    if (weights.size() != assets) throw std::invalid_argument("need one weight per ticker");
    if (days == 0) throw std::invalid_argument("no prices to backtest");
    if (rebalance_every < 0) throw std::invalid_argument("rebalance_every must be 0 or more");
    if (std::fabs(std::accumulate(weights.begin(), weights.end(), 0.0) - 1.0) > 1e-6)
        throw std::invalid_argument("weights must sum to 1");
    for (const auto& closes : prices.closes)
        if (closes.size() != days) throw std::invalid_argument("every ticker needs a close on every date");

    std::vector<double> shares(assets);
    for (size_t i = 0; i < assets; ++i) shares[i] = weights[i] / prices.closes[i][0];

    std::vector<double> values;
    values.reserve(days);
    for (size_t t = 0; t < days; ++t) {
        double value = 0.0;
        for (size_t i = 0; i < assets; ++i) value += shares[i] * prices.closes[i][t];
        values.push_back(value);

        const bool rebalance_day =
            rebalance_every > 0 && t > 0 && t % static_cast<size_t>(rebalance_every) == 0;
        if (rebalance_day)
            for (size_t i = 0; i < assets; ++i) shares[i] = value * weights[i] / prices.closes[i][t];
    }
    return values;
}
