# Portfolio Risk Engine and Backtester

A personal finance tool. It reads a bank export to show where money goes each month, reads a brokerage export to get current holdings, and runs a C++17 engine that measures the portfolio's risk and backtests rebalancing over 10 years of daily prices.

## Results

Portfolio of 40% VOO, 30% QQQ and 30% BND, using dividend-adjusted daily closes from 2016-11-07 to 2026-11-05 (2,513 trading days):

| Strategy | Annual return | Volatility | Max drawdown | 1-day VaR (95%) |
|---|---|---|---|---|
| Buy and hold | 14.19% | 16.58% | 27.85% | 1.59% |
| Rebalance every 21 trading days | 12.53% | 14.07% | 24.90% | 1.31% |

Buy and hold earned more because stocks far outgrew bonds (QQQ grew 5.95x, VOO 4.06x, BND 1.16x). Left alone, the portfolio drifted from 70% stocks to 91% stocks, so it also took on more risk. Rebalancing kept the 70/30 mix, which lowered volatility and max drawdown at the cost of 1.7 points of annual return.

Speed (`make bench`, 15 ETFs over the same 2,513 days, Apple M3 Pro, clang `-O2`): one full analysis, meaning both backtests plus all four metrics on each, takes 0.13 ms at the median and under 0.4 ms at p99 over 1,000 runs. Loading the 15 CSV files takes about 15 ms.

## Run it

Needs a C++17 compiler and Python 3.9 or later. There are no other dependencies.

```
make fetch    # download prices for the tickers used here
make test     # C++ and Python tests
make run      # risk metrics and backtest for the portfolio above
make bench    # timing on 15 tickers
make report   # spending and holdings from the made-up exports in data/sample/
```

Prices come from Yahoo Finance's daily chart data (adjusted closes) and are not committed.

To use your own exports, put them in `data/private/`, which git ignores, and run:

```
python3 scripts/report.py data/private/bank.csv data/private/positions.csv
```

The report downloads prices for any holding it doesn't have yet.

## How it works

- `src/prices.cpp` loads one CSV per ticker and keeps only the dates every ticker shares, so all series line up day by day.
- `src/risk.cpp` computes simple daily returns, annualized volatility (sample standard deviation times the square root of 252), max drawdown (largest fall from a running peak), one-day historical VaR (nearest-rank percentile of daily returns) and annualized return.
- `src/backtest.cpp` holds a number of shares per asset and values them each day. On rebalance days it resets the shares to the target weights. A test checks that rebalancing every day matches the fixed-weight portfolio return computed directly.
- `scripts/report.py` categorizes bank transactions by keyword, totals them by month, turns brokerage positions into weights and calls the engine.

## Limits

- No transaction costs, taxes or slippage yet, so rebalancing looks slightly better than it would in practice.
- "Monthly" means every 21 trading days, not the first trading day of each calendar month.
- Historical VaR assumes tomorrow looks like one of the last 10 years of days.
- Spending categories come from a short keyword list in `scripts/report.py`.

## Next

A C++ limit order book to simulate how trades fill, so backtests include execution costs and slippage.
