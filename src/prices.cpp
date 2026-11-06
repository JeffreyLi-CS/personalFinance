#include "prices.hpp"

#include <fstream>
#include <map>
#include <sstream>
#include <stdexcept>

namespace {

std::map<std::string, double> read_csv(const std::string& path) {
    std::ifstream in(path);
    if (!in) throw std::runtime_error("cannot open " + path);

    std::map<std::string, double> rows;
    std::string line;
    std::getline(in, line);  // header
    while (std::getline(in, line)) {
        if (line.empty()) continue;
        const auto comma = line.find(',');
        if (comma == std::string::npos) throw std::runtime_error("bad row in " + path + ": " + line);
        rows[line.substr(0, comma)] = std::stod(line.substr(comma + 1));
    }
    if (rows.empty()) throw std::runtime_error("no rows in " + path);
    return rows;
}

}  // namespace

PriceMatrix load_prices(const std::vector<std::string>& tickers, const std::string& dir) {
    std::vector<std::map<std::string, double>> series;
    for (const auto& t : tickers) series.push_back(read_csv(dir + "/" + t + ".csv"));

    PriceMatrix m;
    m.tickers = tickers;
    m.closes.resize(tickers.size());

    // ISO dates sort lexically, so iterating the first map walks dates in order.
    for (const auto& [date, first_close] : series.front()) {
        bool everywhere = true;
        for (size_t i = 1; i < series.size() && everywhere; ++i)
            everywhere = series[i].count(date) > 0;
        if (!everywhere) continue;

        m.dates.push_back(date);
        m.closes[0].push_back(first_close);
        for (size_t i = 1; i < series.size(); ++i) m.closes[i].push_back(series[i].at(date));
    }
    if (m.dates.empty()) throw std::runtime_error("no date is shared by every ticker");
    return m;
}
