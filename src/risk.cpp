#include "risk.hpp"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace {

constexpr double kTradingDaysPerYear = 252.0;

}  // namespace

std::vector<double> daily_returns(const std::vector<double>& prices) {
    std::vector<double> returns;
    if (prices.size() < 2) return returns;
    returns.reserve(prices.size() - 1);
    for (size_t t = 0; t + 1 < prices.size(); ++t) returns.push_back(prices[t + 1] / prices[t] - 1.0);
    return returns;
}

std::vector<double> portfolio_returns(const std::vector<std::vector<double>>& returns,
                                      const std::vector<double>& weights) {
    if (returns.size() != weights.size()) throw std::invalid_argument("need one weight per return series");
    if (returns.empty()) return {};

    const size_t days = returns.front().size();
    std::vector<double> portfolio(days, 0.0);
    for (size_t i = 0; i < returns.size(); ++i) {
        if (returns[i].size() != days) throw std::invalid_argument("return series differ in length");
        for (size_t t = 0; t < days; ++t) portfolio[t] += weights[i] * returns[i][t];
    }
    return portfolio;
}

double annualized_volatility(const std::vector<double>& returns) {
    const size_t n = returns.size();
    if (n < 2) throw std::invalid_argument("volatility needs at least 2 returns");

    const double mean = std::accumulate(returns.begin(), returns.end(), 0.0) / n;
    double squared = 0.0;
    for (double r : returns) squared += (r - mean) * (r - mean);
    return std::sqrt(squared / (n - 1)) * std::sqrt(kTradingDaysPerYear);
}

double max_drawdown(const std::vector<double>& values) {
    double peak = 0.0;
    double worst = 0.0;
    for (double v : values) {
        peak = std::max(peak, v);
        worst = std::max(worst, (peak - v) / peak);
    }
    return worst;
}

double historical_var(const std::vector<double>& returns, double confidence) {
    if (returns.empty()) throw std::invalid_argument("VaR needs at least 1 return");
    if (confidence <= 0.0 || confidence >= 1.0) throw std::invalid_argument("confidence must be between 0 and 1");

    std::vector<double> sorted(returns);
    std::sort(sorted.begin(), sorted.end());

    // 1 - 0.95 is slightly more than 0.05 in floating point, so an exact rank such as
    // 0.05 * 20 = 1 would round up to 2 without the small tolerance.
    const double exact_rank = (1.0 - confidence) * sorted.size();
    const auto rank = std::clamp<size_t>(static_cast<size_t>(std::ceil(exact_rank - 1e-9)), 1, sorted.size());
    return -sorted[rank - 1];
}

double annualized_return(const std::vector<double>& values) {
    if (values.size() < 2) throw std::invalid_argument("annualized return needs at least 2 values");
    const double years = (values.size() - 1) / kTradingDaysPerYear;
    return std::pow(values.back() / values.front(), 1.0 / years) - 1.0;
}

RiskSummary summarize(const std::vector<double>& values) {
    const auto returns = daily_returns(values);
    return {annualized_return(values), annualized_volatility(returns), max_drawdown(values),
            historical_var(returns, 0.95)};
}
