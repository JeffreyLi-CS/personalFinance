#pragma once

#include <vector>

// Simple daily returns: r[t] = p[t+1] / p[t] - 1. Output has one fewer element.
std::vector<double> daily_returns(const std::vector<double>& prices);

// Daily returns of a portfolio held at fixed weights (rebalanced every day).
// returns[i] is asset i's daily return series; weights sum to 1.
std::vector<double> portfolio_returns(const std::vector<std::vector<double>>& returns,
                                      const std::vector<double>& weights);

// Sample standard deviation of daily returns (n - 1), scaled by sqrt(252).
double annualized_volatility(const std::vector<double>& returns);

// Largest peak-to-trough fall in a value series, as a positive fraction (0.25 = 25%).
double max_drawdown(const std::vector<double>& values);

// One-day historical Value at Risk at the given confidence (e.g. 0.95), returned as a
// positive loss fraction. Uses the nearest-rank percentile: sort returns ascending and
// take the element at rank ceil((1 - confidence) * n), counting from 1.
double historical_var(const std::vector<double>& returns, double confidence);

// Compound annual growth rate of a value series, assuming 252 trading days per year.
double annualized_return(const std::vector<double>& values);

struct RiskSummary {
    double annual_return;
    double volatility;
    double max_drawdown;
    double var_95;
};

// All four metrics above for one value series.
RiskSummary summarize(const std::vector<double>& values);
