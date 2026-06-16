"""
Incremental PSX technical updater.

Unlike technical_pipeline.py — which re-scrapes 2000->today and OVERWRITES the
master CSV — this script:
  1. reads the existing data/processed/stocksense_tft_final.csv,
  2. finds the last date already present,
  3. scrapes ONLY the missing months from dps.psx.com.pk/historical,
  4. recomputes indicators (sma_20/50, rsi_14, vol_20) using a history buffer so
     the rolling windows are valid,
  5. APPENDS the new rows back to the same file (a .bak is written first).

It reuses the proven PSXFullScraper.fetch_month() from technical_pipeline.py, so
the scraping behaviour is identical — only the date range is narrowed.

Run:
    python scrappers/technical_incremental.py

After it finishes, regenerate the model's 43-column file:
    python utility/merge_datasets.py
    python utility/clean_dataset.py
    python utility/enhance_dataset_complete.py
"""

import os
import sys
import shutil
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf

# Reuse the month scraper + config from the full pipeline (no re-implementation).
sys.path.insert(0, os.path.dirname(__file__))
from technical_pipeline import PSXFullScraper, KSE30_STOCKS, SECTOR_MAP

MASTER = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "data", "processed", "stocksense_tft_final.csv")
)

# Rows of per-ticker history to prepend so sma_50 / rsi_14 are valid on the new rows.
INDICATOR_BUFFER = 70


def get_rsi(series, window=14):
    """RSI-14, identical formula to technical_pipeline.add_tft_features()."""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window).mean()
    return 100 - (100 / (1 + (gain / (loss + 1e-9))))


def months_between(start_dt, end_dt):
    """Yield (year, month) tuples from start month to end month, inclusive."""
    y, m = start_dt.year, start_dt.month
    while (y, m) <= (end_dt.year, end_dt.month):
        yield y, m
        m += 1
        if m > 12:
            m, y = 1, y + 1


def main():
    if not os.path.exists(MASTER):
        print(f"ERROR: {MASTER} not found. Run technical_pipeline.py once for the initial build.")
        return

    print("--- Reading existing master ---")
    master = pd.read_csv(MASTER)
    master["Date"] = pd.to_datetime(master["Date"])
    last_date = master["Date"].max()
    today = datetime.now()
    print(f"  Last date in CSV: {last_date.date()} | Today: {today.date()}")

    if last_date.date() >= today.date():
        print("  Already up to date. Nothing to do.")
        return

    # 1. Scrape only the missing months (last_date's month .. current month).
    scraper = PSXFullScraper()
    tickers = KSE30_STOCKS + ["KSE100"]
    target_months = list(months_between(last_date, today))
    print(f"--- Scraping {len(target_months)} month(s) x {len(tickers)} tickers ---")

    rows = []
    for ticker in tickers:
        for (yy, mm) in target_months:
            rows.extend(scraper.fetch_month(ticker, yy, mm))

    if not rows:
        print("  No rows scraped (network issue or market closed all period). Exiting.")
        return

    scraped = pd.DataFrame(rows)
    scraped["Date"] = pd.to_datetime(scraped["Date"])
    scraped = scraped[scraped["Date"] > last_date].drop_duplicates(subset=["Date", "Ticker"])
    if scraped.empty:
        print("  Scraped data has no rows newer than the CSV. Exiting.")
        return
    print(f"  New raw rows: {len(scraped)} "
          f"(dates {scraped['Date'].min().date()} -> {scraped['Date'].max().date()})")

    # 2. market_index from KSE100, attached to each stock row by Date.
    kse100 = (
        scraped[scraped["Ticker"] == "KSE100"][["Date", "Close"]]
        .rename(columns={"Close": "market_index"})
    )
    new_stocks = scraped[scraped["Ticker"] != "KSE100"].copy()
    new_stocks = new_stocks.merge(kse100, on="Date", how="left")

    # 3. USD/PKR via yfinance for the gap (same source as the full pipeline).
    try:
        usd = yf.download("PKR=X", start=last_date.strftime("%Y-%m-%d"), progress=False)["Close"].reset_index()
        usd.columns = ["Date", "USD_PKR"]
        usd["Date"] = pd.to_datetime(usd["Date"])
        new_stocks = new_stocks.merge(usd, on="Date", how="left")
    except Exception as e:  # noqa: BLE001 — yfinance can fail transiently
        print(f"  WARNING: USD/PKR fetch failed ({e}); will forward-fill from master.")
        new_stocks["USD_PKR"] = np.nan

    # 4. Calendar / static columns.
    new_stocks["Sector"] = new_stocks["Ticker"].map(SECTOR_MAP)
    new_stocks["day_of_week"] = new_stocks["Date"].dt.dayofweek
    new_stocks["month"] = new_stocks["Date"].dt.month

    # 5. Fill macro gaps: forward-fill, then fall back to master's last known value.
    last_mi = master.dropna(subset=["market_index"])["market_index"].iloc[-1] if "market_index" in master else np.nan
    last_usd = master.dropna(subset=["USD_PKR"])["USD_PKR"].iloc[-1] if "USD_PKR" in master else np.nan
    new_stocks["market_index"] = new_stocks["market_index"].ffill().fillna(last_mi)
    new_stocks["USD_PKR"] = new_stocks["USD_PKR"].ffill().fillna(last_usd)

    # 6. Recompute indicators per ticker using a history buffer from master.
    out_new = []
    for ticker, g_new in new_stocks.groupby("Ticker"):
        hist = master[master["Ticker"] == ticker].sort_values("Date")
        buffer = hist.tail(INDICATOR_BUFFER)
        combined = pd.concat([buffer, g_new.sort_values("Date")], ignore_index=True).sort_values("Date")

        combined["sma_20"] = combined["Close"].rolling(20).mean()
        combined["sma_50"] = combined["Close"].rolling(50).mean()
        combined["rsi_14"] = get_rsi(combined["Close"])
        combined["vol_20"] = combined["Close"].pct_change().rolling(20).std()

        fresh = combined[combined["Date"] > last_date].copy()
        # Continue per-ticker time_idx from where master left off (recomputed
        # downstream anyway, but keep the file self-consistent).
        start_idx = int(hist["time_idx"].max()) + 1 if ("time_idx" in hist and not hist.empty) else 0
        fresh["time_idx"] = np.arange(start_idx, start_idx + len(fresh))
        out_new.append(fresh)

    new_final = pd.concat(out_new, ignore_index=True)

    # 7. Align to master's exact column order, then append + save.
    for c in master.columns:
        if c not in new_final.columns:
            new_final[c] = np.nan
    new_final = new_final[master.columns]

    updated = pd.concat([master, new_final], ignore_index=True)
    updated = updated.sort_values(["Ticker", "Date"]).reset_index(drop=True)

    backup = MASTER + ".bak"
    shutil.copy2(MASTER, backup)
    updated.to_csv(MASTER, index=False)

    print("\n--- Done ---")
    print(f"  Backup of previous file : {backup}")
    print(f"  Appended rows           : {len(new_final)}")
    print(f"  Tickers updated         : {new_final['Ticker'].nunique()}")
    print(f"  New date range          : {new_final['Date'].min().date()} -> {new_final['Date'].max().date()}")
    print(f"  Master CSV now has       : {len(updated)} rows (last date {updated['Date'].max().date()})")
    print("\nNext: regenerate the model's 43-col file ->")
    print("  python utility/merge_datasets.py && python utility/clean_dataset.py && python utility/enhance_dataset_complete.py")


if __name__ == "__main__":
    main()
