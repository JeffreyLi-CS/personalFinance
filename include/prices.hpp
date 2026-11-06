#pragma once

#include <string>
#include <vector>

// Adjusted daily closes for several tickers, aligned on the dates they all share.
// closes[i][t] is ticker i's close on dates[t].
struct PriceMatrix {
    std::vector<std::string> tickers;
    std::vector<std::string> dates;
    std::vector<std::vector<double>> closes;
};

// Reads data/prices/<TICKER>.csv files (header "date,adj_close") and keeps only
// the dates present in every file. Throws std::runtime_error on a missing or
// malformed file.
PriceMatrix load_prices(const std::vector<std::string>& tickers,
                        const std::string& dir = "data/prices");
