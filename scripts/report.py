"""Monthly spending from a bank export, plus holdings and risk from a brokerage export.

Usage: python3 scripts/report.py BANK_CSV POSITIONS_CSV

BANK_CSV needs Date (or Transaction Date), Description and Amount columns, with money
out as negative amounts, the way Chase and Bank of America export it. POSITIONS_CSV
needs a Symbol column and a Current Value or Market Value column, the way Fidelity and
Schwab export it. Put real exports in data/private/, which git ignores.
"""

import csv
import datetime as dt
import pathlib
import re
import subprocess
import sys
from collections import defaultdict

from fetch_prices import PRICES_DIR, download

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENGINE = ROOT / "build" / "risk"

# First match wins, so specific keywords ("uber eats") come before general ones ("uber").
CATEGORY_RULES = [
    ("Rent", ["rent", "apartments"]),
    ("Groceries", ["h-e-b", "whole foods", "trader joe", "costco"]),
    ("Dining", ["uber eats", "doordash", "chipotle", "starbucks", "restaurant", "cafe"]),
    ("Transport", ["uber", "lyft", "shell", "exxon", "chevron", "parking"]),
    ("Subscriptions", ["netflix", "spotify", "amazon prime", "apple.com"]),
    ("Shopping", ["amazon", "target", "walmart"]),
    ("Investing", ["vanguard", "fidelity", "schwab", "robinhood"]),
]
SPENDING = [name for name, _ in CATEGORY_RULES if name != "Investing"] + ["Other"]

# Real tickers only: skips cash sweeps such as "SPAXX**" and footer text.
TICKER = re.compile(r"^[A-Z][A-Z.]{0,5}$")


def categorize(description: str) -> str:
    text = description.lower()
    for category, keywords in CATEGORY_RULES:
        if any(re.search(rf"\b{re.escape(k)}\b", text) for k in keywords):
            return category
    return "Other"


def find_column(fieldnames, candidates, path) -> str:
    by_name = {name.strip().lower(): name for name in fieldnames or []}
    for candidate in candidates:
        if candidate in by_name:
            return by_name[candidate]
    raise ValueError(f"{path}: needs a column named one of {candidates}")


def parse_date(text: str) -> dt.date:
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            pass
    raise ValueError(f"unrecognized date {text!r}")


def parse_money(text: str) -> float:
    return float(text.strip().replace("$", "").replace(",", ""))


def load_transactions(path) -> list[tuple[dt.date, str, float]]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        date_col = find_column(reader.fieldnames, ["date", "transaction date", "posting date"], path)
        desc_col = find_column(reader.fieldnames, ["description"], path)
        amount_col = find_column(reader.fieldnames, ["amount"], path)
        return [
            (parse_date(row[date_col]), row[desc_col], parse_money(row[amount_col]))
            for row in reader
            if (row.get(amount_col) or "").strip()
        ]


def monthly_totals(transactions) -> dict[str, dict[str, float]]:
    """{"2026-09": {"Income": 4200.0, "Rent": 1350.0, ...}}. Money out is stored as positive."""
    months = defaultdict(lambda: defaultdict(float))
    for day, description, amount in transactions:
        month = months[day.strftime("%Y-%m")]
        if amount > 0:
            month["Income"] += amount
        else:
            month[categorize(description)] += -amount
    return months


def load_positions(path) -> dict[str, float]:
    """{ticker: market value}, summed across accounts."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        symbol_col = find_column(reader.fieldnames, ["symbol"], path)
        value_col = find_column(reader.fieldnames, ["current value", "market value", "total value"], path)
        values = defaultdict(float)
        for row in reader:
            symbol = (row.get(symbol_col) or "").strip().upper()
            raw = (row.get(value_col) or "").strip()
            if not TICKER.match(symbol) or not raw:
                continue
            values[symbol] += parse_money(raw)
        return dict(values)


def print_spending(months) -> None:
    columns = [c for c in SPENDING if any(m.get(c) for m in months.values())]
    header = ["Month", "Income", *columns, "Spent", "Invested", "Saved", "Rate"]
    widths = [max(len(h), 9) + 2 for h in header]
    print("Spending by month")
    print("".join(f"{h:>{w}}" for h, w in zip(header, widths)))
    for name in sorted(months):
        m = months[name]
        spent = sum(m.get(c, 0.0) for c in SPENDING)
        saved = m.get("Income", 0.0) - spent
        rate = f"{saved / m['Income']:.0%}" if m.get("Income") else "-"
        amounts = [m.get("Income", 0.0), *(m.get(c, 0.0) for c in columns), spent, m.get("Investing", 0.0), saved]
        cells = [name, *(f"{v:,.2f}" for v in amounts), rate]
        print("".join(f"{c:>{w}}" for c, w in zip(cells, widths)))


def print_holdings(values) -> None:
    total = sum(values.values())
    print("Holdings")
    for ticker, value in sorted(values.items(), key=lambda item: -item[1]):
        print(f"{ticker:>12}{value:>14,.2f}{value / total:>10.1%}")
    print(f"{'Total':>12}{total:>14,.2f}")


def run_engine(values) -> None:
    if not ENGINE.exists():
        raise SystemExit("build the engine first: make")
    for ticker in values:
        if not (PRICES_DIR / f"{ticker}.csv").exists():
            download(ticker)
    total = sum(values.values())
    args = [f"{ticker}:{value / total:.6f}" for ticker, value in values.items()]
    sys.stdout.flush()  # otherwise the engine's output lands before ours when piped
    subprocess.run([str(ENGINE), *args], cwd=ROOT, check=True)


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    try:
        months = monthly_totals(load_transactions(sys.argv[1]))
        positions = load_positions(sys.argv[2])
    except (OSError, ValueError) as e:
        sys.exit(f"error: {e}")
    if not positions:
        sys.exit(f"error: no holdings found in {sys.argv[2]}")

    print_spending(months)
    print()
    print_holdings(positions)
    print()
    run_engine(positions)


if __name__ == "__main__":
    main()
