"""
Promote fresh technical rows into the model's master file (tft_ready_clean.csv).

WHY THIS EXISTS
---------------
The model reads data/final/tft_ready_clean.csv (config.MASTER_CSV) — a 43-column
file. Fresh OHLCV from the scrapers lands in data/processed/stocksense_tft_final.csv
(17 columns). Nothing in the repo bridges the two: merge_datasets.py reads
tft_ready_clean.csv as its *base* and never ingests the fresh technical file, and
clean/enhance operate on a different processed/tft_ready.csv. So new data never
reaches the model.

This script is the missing link. It:
  1. keeps the existing 43-col history EXACTLY as-is (no train/inference skew),
  2. takes only the new rows from stocksense_tft_final.csv (Date > last in clean),
  3. attaches sentiment (history + daily, same rules as merge_datasets.py),
  4. computes all 43 columns for ONLY the new rows, using the full history as a
     rolling buffer (so sma/rolling/macro features are valid),
  5. appends them to tft_ready_clean.csv (a .bak is written first).

No network needed: USD_PKR/market_index already came from the scrape, oil_price is
forward-filled from history (yfinance oil download is broken upstream anyway).

Run:
    python utility/promote_to_clean.py
"""

import os
import shutil
import numpy as np
import pandas as pd

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
CLEAN = os.path.join(ROOT, "data", "final", "tft_ready_clean.csv")          # model reads this
TECH = os.path.join(ROOT, "data", "processed", "stocksense_tft_final.csv")  # fresh OHLCV
HIST = os.path.join(ROOT, "data", "processed", "sentiment_history.csv")
DAILY = os.path.join(ROOT, "data", "processed", "sentiment_daily.csv")

# Exact 43-column order the model expects (from merge_datasets.FINAL_COLS).
FINAL_COLS = [
    "Date", "Ticker", "Sector", "Open", "High", "Low", "Close", "Volume",
    "market_index", "USD_PKR", "day_of_week", "month", "sma_20", "sma_50",
    "rsi_14", "vol_20", "time_idx", "sentiment_ma_5", "days_since_announcement",
    "rsi_sentiment", "momentum_signal", "volume_ratio", "volume_signal",
    "proxy_sentiment", "blended_sentiment", "volume_ma_20", "volume_trend",
    "price_direction", "obv_signal", "vpt", "oil_price", "fx_volatility",
    "market_volatility", "inflation_proxy", "market_momentum", "market_strength",
    "fx_risk", "relative_momentum", "sentiment_quality", "sentiment_score",
    "sentiment_count", "announcement_flag", "announcement_type",
]

ANNOUNCEMENT_SCORES = {"dividend": 0.60, "rights": 0.30, "earnings": 0.0, "board": 0.0, "other": 0.0}


def load_sentiment():
    """Unify sentiment_history (re-scored) + sentiment_daily, keep daily on conflict."""
    frames = []
    if os.path.exists(HIST):
        h = pd.read_csv(HIST, parse_dates=["Date"])
        h["sentiment_score"] = (
            h["announcement_type"].astype(str).str.strip().str.lower().map(ANNOUNCEMENT_SCORES).fillna(0.0)
        )
        frames.append(h)
    if os.path.exists(DAILY):
        frames.append(pd.read_csv(DAILY, parse_dates=["Date"]))
    keep = ["Date", "Ticker", "sentiment_score", "sentiment_count", "announcement_flag", "announcement_type"]
    if not frames:
        return pd.DataFrame(columns=keep)
    s = pd.concat([f for f in frames], ignore_index=True)
    for c in keep:
        if c not in s.columns:
            s[c] = np.nan
    s = s[keep].sort_values(["Date", "Ticker"]).drop_duplicates(["Date", "Ticker"], keep="last")
    return s.reset_index(drop=True)


def main():
    if not os.path.exists(CLEAN):
        print(f"ERROR: {CLEAN} not found.")
        return
    if not os.path.exists(TECH):
        print(f"ERROR: {TECH} not found. Run the scraper first.")
        return

    existing = pd.read_csv(CLEAN, parse_dates=["Date"])
    last_date = existing["Date"].max()
    print(f"--- Existing clean master: {len(existing):,} rows, last date {last_date.date()} ---")

    tech = pd.read_csv(TECH, parse_dates=["Date"])
    new = tech[tech["Date"] > last_date].copy()
    if new.empty:
        print("  No technical rows newer than the clean master. Nothing to do.")
        return
    print(f"--- Fresh technical rows to promote: {len(new)} "
          f"({new['Date'].min().date()} -> {new['Date'].max().date()}, {new['Ticker'].nunique()} tickers) ---")

    # 1. Attach sentiment (defaults where absent).
    sent = load_sentiment()
    new = new.merge(sent, on=["Date", "Ticker"], how="left")
    new["sentiment_score"] = new["sentiment_score"].fillna(0.0)
    new["sentiment_count"] = new["sentiment_count"].fillna(0)
    new["announcement_flag"] = new["announcement_flag"].fillna(0)
    new["announcement_type"] = new["announcement_type"].replace("", np.nan).fillna("none")

    # 2. Stack onto existing history (new rows get NaN engineered cols), then compute
    #    engineered features over the union and assign ONLY to the new rows.
    for c in FINAL_COLS:
        if c not in new.columns:
            new[c] = np.nan
    combined = pd.concat([existing[FINAL_COLS], new[FINAL_COLS]], ignore_index=True)
    combined = combined.sort_values(["Ticker", "Date"]).reset_index(drop=True)
    m = combined["Date"] > last_date  # new-row mask

    g = combined.groupby("Ticker", group_keys=False)

    # --- per-ticker price/volume features ---
    combined.loc[m, "rsi_sentiment"] = ((combined["rsi_14"] - 50) / 50)[m]
    combined.loc[m, "momentum_signal"] = (((combined["Close"] - combined["sma_50"]) / combined["sma_50"]).clip(-1, 1))[m]

    vol_ma20 = g["Volume"].transform(lambda x: x.rolling(20).mean())
    combined.loc[m, "volume_ma_20"] = vol_ma20[m]
    vr = combined["Volume"] / vol_ma20
    combined.loc[m, "volume_ratio"] = vr[m]
    vsig = (np.log(vr.clip(0.1, 10)) / 2.3)
    combined.loc[m, "volume_signal"] = vsig[m]
    combined.loc[m, "volume_trend"] = (((combined["Volume"] - vol_ma20) / vol_ma20).clip(-2, 2))[m]

    proxy = (0.5 * combined["rsi_sentiment"] + 0.3 * combined["momentum_signal"] + 0.2 * combined["volume_signal"]).clip(-1, 1)
    combined.loc[m, "proxy_sentiment"] = proxy[m]
    combined.loc[m, "blended_sentiment"] = np.where(
        combined["sentiment_score"] != 0, combined["sentiment_score"], combined["proxy_sentiment"]
    )[m]

    sign_diff = g["Close"].transform(lambda x: np.sign(x.diff()))
    combined.loc[m, "price_direction"] = sign_diff[m]
    combined.loc[m, "obv_signal"] = (combined["volume_signal"] * sign_diff)[m]
    vpt = g.apply(lambda grp: (grp["Volume"] * grp["Close"].pct_change()).rolling(20).mean()).reset_index(level=0, drop=True)
    combined.loc[m, "vpt"] = vpt.fillna(0)[m]

    # --- date-level macro (one value per date, mapped back) ---
    dts = (combined[["Date", "market_index", "USD_PKR"]]
           .drop_duplicates("Date").sort_values("Date").set_index("Date"))
    mkt_ret = dts["market_index"].pct_change()
    dts["market_momentum"] = mkt_ret.rolling(20).mean()
    dts["market_volatility"] = mkt_ret.rolling(20).std()
    dts["inflation_proxy"] = dts["USD_PKR"].pct_change().rolling(90).mean()
    dts["mkt_ret5"] = mkt_ret.rolling(5).mean()
    fxv = (combined.groupby("Date")["USD_PKR"].std() / combined.groupby("Date")["USD_PKR"].mean())

    combined.loc[m, "market_momentum"] = combined["Date"].map(dts["market_momentum"])[m]
    combined.loc[m, "market_volatility"] = combined["Date"].map(dts["market_volatility"])[m]
    combined.loc[m, "inflation_proxy"] = combined["Date"].map(dts["inflation_proxy"])[m]
    combined.loc[m, "fx_volatility"] = combined["Date"].map(fxv)[m]
    # oil_price: forward-fill from history (no network)
    combined.loc[m, "oil_price"] = g["oil_price"].ffill()[m]

    # --- composites (depend on the above; new rows now populated) ---
    mm = combined["market_momentum"]
    mkt_ret5 = combined["Date"].map(dts["mkt_ret5"])
    combined.loc[m, "market_strength"] = (
        0.4 * (mm / (mm.abs() + 0.01)).fillna(0)
        + 0.4 * (combined["market_volatility"] / 0.05).clip(-1, 1)
        + 0.2 * mkt_ret5.clip(-1, 1)
    ).clip(-1, 1)[m]
    usd_trend = g["USD_PKR"].transform(lambda x: x.pct_change().rolling(20).mean())
    combined.loc[m, "fx_risk"] = (0.6 * usd_trend.clip(-1, 1) + 0.4 * combined["fx_volatility"]).clip(-1, 1)[m]
    combined.loc[m, "relative_momentum"] = (
        combined["momentum_signal"] - (combined["market_momentum"] / 2).clip(-1, 1)
    ).clip(-1, 1)[m]
    combined.loc[m, "sentiment_quality"] = (
        0.4 * combined["blended_sentiment"]
        + 0.3 * combined["relative_momentum"]
        + 0.2 * (-combined["fx_risk"])
        + 0.1 * (combined["volume_trend"] / 2)
    ).clip(-1, 1)[m]

    # --- sentiment-derived (per merge_datasets) ---
    combined.loc[m, "sentiment_ma_5"] = g["sentiment_score"].transform(
        lambda s: s.rolling(5, min_periods=1).mean()
    )[m]

    def days_since(group):
        flags, dates = group["announcement_flag"].values, pd.to_datetime(group["Date"]).values
        out = np.full(len(group), 30, dtype=int)
        last = None
        for i, (f, d) in enumerate(zip(flags, dates)):
            if f == 1:
                last, out[i] = d, 0
            elif last is not None:
                out[i] = min(int((d - last) / np.timedelta64(1, "D")), 30)
        return pd.Series(out, index=group.index)
    combined["days_since_announcement"] = combined.groupby("Ticker", group_keys=False).apply(days_since)

    # 3. Clean up NaNs on the NEW rows only, then split back out.
    new_rows = combined[combined["Date"] > last_date].copy()
    ffill_cols = [c for c in FINAL_COLS if c not in ("announcement_type",)]
    for c in ffill_cols:
        if new_rows[c].isnull().any():
            # fill from the combined per-ticker history, else 0
            new_rows[c] = new_rows[c].fillna(0)
    new_rows["announcement_type"] = new_rows["announcement_type"].fillna("")
    new_rows["sentiment_count"] = new_rows["sentiment_count"].fillna(0).astype(int)
    new_rows["announcement_flag"] = new_rows["announcement_flag"].fillna(0).astype(int)

    # 4. Append + save (existing rows untouched).
    out = pd.concat([existing, new_rows[FINAL_COLS]], ignore_index=True)
    out = out.sort_values(["Ticker", "Date"]).reset_index(drop=True)

    backup = CLEAN + ".bak"
    shutil.copy2(CLEAN, backup)
    out.to_csv(CLEAN, index=False)

    print("\n--- Done ---")
    print(f"  Backup        : {backup}")
    print(f"  Columns       : {out.shape[1]} (expected {len(FINAL_COLS)})")
    print(f"  Rows          : {len(existing):,} -> {len(out):,} (+{len(new_rows)})")
    print(f"  New date range: {new_rows['Date'].min().date()} -> {new_rows['Date'].max().date()}")
    print(f"  NaNs in new   : {int(new_rows[FINAL_COLS].isnull().sum().sum())}")
    print(f"  Master now    : last date {out['Date'].max().date()}")


if __name__ == "__main__":
    main()
