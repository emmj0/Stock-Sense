"""
Offline inference smoke-test — NO MongoDB writes, NO network.

Runs the real TFT inference path on the current master CSV for every KSE-30 ticker
and prints, side by side:
  - the RAW signal (what the pipeline produces today), and
  - the RE-ANCHORED signal (the hotfix: trust the model's relative 7-day path,
    rescaled so day-1 == the live price).

It deliberately skips the live news-sentiment fetch (uses whatever sentiment is in
the CSV) and the LLM step, so it can run with zero API keys and no internet.

Run:  python test_local_inference.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.WARNING, format="%(message)s")

import pandas as pd  # noqa: E402

from tft import config, preprocessing  # noqa: E402
from tft.inference import TFTInferenceEngine  # noqa: E402
from tft.signals import compute_quantile_metrics  # noqa: E402


def main():
    print("Loading TFT model + master CSV (this takes ~30-60s)...")
    engine = TFTInferenceEngine()

    master = pd.read_csv(config.MASTER_CSV)
    master["Date"] = pd.to_datetime(master["Date"])
    master = master.sort_values(["Ticker", "Date"]).reset_index(drop=True)
    print(f"Master: {len(master):,} rows | last date {master['Date'].max().date()} "
          f"| {master['Ticker'].nunique()} tickers\n")

    results = []
    for ticker in config.KSE30_STOCKS:
        tdf = master[master["Ticker"] == ticker].copy()
        if tdf.empty:
            continue
        try:
            tdf = preprocessing.apply_preprocessing_pipeline(
                tdf, stage="inference", scaler_params=engine.scaler_params
            )
            tdf = preprocessing.compute_proxy_sentiment(tdf)
            tdf = preprocessing.compute_blended_sentiment(tdf)
            window = preprocessing.build_inference_window(
                tdf, sentiment_df=None,
                lookback_days=config.INFERENCE_LOOKBACK_DAYS,
                future_days=config.INFERENCE_FUTURE_DAYS,
            )
            if window.empty:
                continue
            raw, idx = engine.predict_sliding_window(window)
            tickers_out = idx["Ticker"].values if "Ticker" in idx.columns else [ticker]
            den = engine.denormalize_predictions(raw, tickers_out)
            p = den.get(ticker)
            if p is None:
                continue
            if p.ndim == 3:
                p = p[-1]
        except Exception as e:  # noqa: BLE001
            print(f"  {ticker}: FAILED — {e}")
            continue

        cur = float(tdf["Close"].iloc[-1])

        # RAW (current behaviour)
        rawm = compute_quantile_metrics(p, cur)

        # RE-ANCHORED (hotfix): rescale the whole cone so day-1 q50 == live price
        anchor = float(p[0][2])
        p_anc = p * (cur / anchor) if anchor > 1e-6 else p
        ancm = compute_quantile_metrics(p_anc, cur)

        results.append({
            "ticker": ticker,
            "price": cur,
            "raw_tgt": rawm["median_7d_price"],
            "raw_ret": rawm["expected_return"] * 100,
            "anc_tgt": ancm["median_7d_price"],
            "anc_ret": ancm["expected_return"] * 100,
        })

    if not results:
        print("No predictions produced — something is wrong with the data or model.")
        return

    print(f"{'Ticker':<7}{'Live':>9}{'RawTgt':>9}{'RawRet%':>9}   {'AncTgt':>9}{'AncRet%':>9}")
    print("-" * 62)
    for r in results:
        print(f"{r['ticker']:<7}{r['price']:>9.2f}{r['raw_tgt']:>9.2f}{r['raw_ret']:>+9.1f}   "
              f"{r['anc_tgt']:>9.2f}{r['anc_ret']:>+9.1f}")

    raw_extreme = sum(1 for r in results if abs(r["raw_ret"]) > 15)
    anc_extreme = sum(1 for r in results if abs(r["anc_ret"]) > 15)
    print("-" * 62)
    print(f"\n|return| > 15% (implausible for 7 days):  RAW={raw_extreme}/{len(results)}  "
          f"ANCHORED={anc_extreme}/{len(results)}")


if __name__ == "__main__":
    main()
