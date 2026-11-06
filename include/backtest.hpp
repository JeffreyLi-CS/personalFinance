#pragma once

#include <vector>

#include "prices.hpp"

// Trading days between rebalances for "monthly" (about 252 / 12).
inline constexpr int kMonthlyRebalanceDays = 21;

// Simulates a portfolio starting at value 1.0 on the first date, invested at
// `weights` (which must sum to 1). Every `rebalance_every` trading days it resets
// holdings back to the target weights; 0 means never (buy and hold). Returns the
// portfolio value on every date.
std::vector<double> backtest_values(const PriceMatrix& prices,
                                    const std::vector<double>& weights,
                                    int rebalance_every);
