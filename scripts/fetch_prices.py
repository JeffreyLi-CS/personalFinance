"""Download about 10 years of dividend-adjusted daily closes into data/prices/<TICKER>.csv.

Usage: python3 scripts/fetch_prices.py VOO QQQ BND
"""

import datetime as dt
import json
import pathlib
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=10y&interval=1d"
PRICES_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "prices"


def fetch(ticker: str) -> list[tuple[str, float]]:
    req = urllib.request.Request(URL.format(ticker=ticker), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.load(resp)["chart"]["result"][0]

    # Today's bar is intraday until the close, so keep finished trading days only.
    today = dt.datetime.now(ZoneInfo("America/New_York")).date()
    rows = []
    for ts, close in zip(result["timestamp"], result["indicators"]["adjclose"][0]["adjclose"]):
        day = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date()
        if close is None or day >= today:  # Yahoo leaves occasional gaps
            continue
        rows.append((day.isoformat(), close))
    return rows


def download(ticker: str) -> pathlib.Path:
    rows = fetch(ticker)
    PRICES_DIR.mkdir(parents=True, exist_ok=True)
    path = PRICES_DIR / f"{ticker}.csv"
    with path.open("w") as f:
        f.write("date,adj_close\n")
        f.writelines(f"{day},{close:.6f}\n" for day, close in rows)
    print(f"{ticker}: {len(rows)} days, {rows[0][0]} to {rows[-1][0]}")
    return path


def main() -> None:
    tickers = [t.upper() for t in sys.argv[1:]]
    if not tickers:
        sys.exit(__doc__)
    for i, ticker in enumerate(tickers):
        if i:
            time.sleep(0.5)  # stay well under Yahoo's rate limit
        download(ticker)


if __name__ == "__main__":
    main()
