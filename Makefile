CPPFLAGS := -Iinclude
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic

HEADERS := $(wildcard include/*.hpp)
LIB_SRC := src/prices.cpp src/risk.cpp src/backtest.cpp
LIB_OBJ := $(LIB_SRC:src/%.cpp=build/%.o)

PORTFOLIO     := VOO:0.4 QQQ:0.3 BND:0.3
BENCH_TICKERS := VOO QQQ BND VTI VXUS VWO AGG TLT IEF GLD VNQ XLK XLF XLE XLV

.PHONY: all test run bench report fetch clean

all: build/risk build/bench build/tests

build/%.o: src/%.cpp $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

build/risk: src/main.cpp $(LIB_OBJ) $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(filter-out %.hpp,$^) -o $@

build/bench: src/bench.cpp $(LIB_OBJ) $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(filter-out %.hpp,$^) -o $@

build/tests: tests/test_main.cpp $(LIB_OBJ) $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(filter-out %.hpp,$^) -o $@

build:
	mkdir -p build

fetch:
	python3 scripts/fetch_prices.py $(BENCH_TICKERS)

test: build/tests
	./build/tests
	python3 -m unittest discover -s tests -p 'test_*.py'

run: build/risk
	./build/risk $(PORTFOLIO)

bench: build/bench
	./build/bench $(BENCH_TICKERS)

report: build/risk
	python3 scripts/report.py data/sample/bank_transactions.csv data/sample/positions.csv

clean:
	rm -rf build
