CPPFLAGS := -Iinclude
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic

HEADERS := $(wildcard include/*.hpp)
LIB_SRC := src/prices.cpp src/risk.cpp src/backtest.cpp
LIB_OBJ := $(LIB_SRC:src/%.cpp=build/%.o)

PORTFOLIO := VOO:0.4 QQQ:0.3 BND:0.3

.PHONY: all test run fetch clean

all: build/risk build/tests

build/%.o: src/%.cpp $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

build/risk: src/main.cpp $(LIB_OBJ) $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(filter-out %.hpp,$^) -o $@

build/tests: tests/test_main.cpp $(LIB_OBJ) $(HEADERS) | build
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $(filter-out %.hpp,$^) -o $@

build:
	mkdir -p build

fetch:
	python3 scripts/fetch_prices.py VOO QQQ BND

test: build/tests
	./build/tests

run: build/risk
	./build/risk $(PORTFOLIO)

clean:
	rm -rf build
