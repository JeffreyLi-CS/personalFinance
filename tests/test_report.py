import datetime as dt
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import report  # noqa: E402


class CategorizeTest(unittest.TestCase):
    def test_specific_keyword_wins(self):
        self.assertEqual(report.categorize("UBER EATS ORDER"), "Dining")
        self.assertEqual(report.categorize("UBER TRIP HELP.UBER.COM"), "Transport")

    def test_matches_whole_words_only(self):
        self.assertEqual(report.categorize("CURRENT ACCOUNT FEE"), "Other")

    def test_unknown_is_other(self):
        self.assertEqual(report.categorize("ZELLE TO ROOMMATE"), "Other")


class MonthlyTotalsTest(unittest.TestCase):
    def test_splits_money_in_and_out_by_month(self):
        months = report.monthly_totals([
            (dt.date(2026, 9, 1), "RENT PAYMENT", -1350.0),
            (dt.date(2026, 9, 12), "DIRECT DEP PAYROLL", 2100.0),
            (dt.date(2026, 10, 2), "COSTCO WHSE", -142.66),
        ])
        self.assertEqual(months["2026-09"], {"Rent": 1350.0, "Income": 2100.0})
        self.assertEqual(months["2026-10"], {"Groceries": 142.66})


class PositionsTest(unittest.TestCase):
    def test_sample_skips_cash_and_footer(self):
        values = report.load_positions(ROOT / "data" / "sample" / "positions.csv")
        self.assertEqual(values, {"VOO": 8000.0, "QQQ": 6000.0, "BND": 6000.0})


if __name__ == "__main__":
    unittest.main()
