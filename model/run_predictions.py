"""
StockSense — Complete Prediction Pipeline + MongoDB Save

A single standalone script that does everything:
  1. Scrape latest OHLCV data + sentiment for all KSE-30 stocks
  2. Load the TFT model and run inference for each ticker
  3. Generate BUY/SELL/HOLD signals with confidence scores
  4. Enhance reasoning with LLM (Groq/Gemini)
  5. Save all predictions + recommendations to MongoDB

Usage:
    python run_predictions.py                # Full run (scrape + predict + save)
    python run_predictions.py --skip-scrape  # Skip scrapers, use existing data
    python run_predictions.py --no-llm       # Skip LLM reasoning enhancement

How it works (step by step):

  STEP 1 — DATA SCRAPING
    Runs technical_updater.py to fetch today's OHLCV prices from PSX
    for all 30 KSE-30 stocks. Computes SMA-20, SMA-50, RSI-14, Vol-20.
    Then runs Gemini_Sentiment.py to fetch news sentiment for each ticker
    via Tavily search + Groq/Gemini LLM analysis.

  STEP 2 — LOAD MODEL
    Loads the trained Temporal Fusion Transformer (TFT) model from
    artifacts/artifactsv1/tft_model.ckpt. This is a 1.8M parameter
    deep learning model that produces probabilistic 7-day price forecasts.

  STEP 3 — PER-TICKER INFERENCE
    For each of the 28 active KSE-30 tickers:
      a. Slice the master CSV (123K rows) to just this ticker's history
      b. Inject freshly scraped sentiment into the last row
      c. Preprocess: remap time indices, fill NaNs, compute proxy/blended
         sentiment, clip features to training range (±4 std)
      d. Build inference window: 120 historical days + 7 future days
      e. Run TFT forward pass → produces shape (7, 5) = 7 days × 5 quantiles
         The 5 quantiles are: p10, p25, p50 (median), p75, p90
      f. Denormalize predictions from model space back to PKR prices
      g. Generate signal: BUY if return ≥ 3% AND confidence ≥ 0.55 AND
         4+ bullish days; SELL if return ≤ -3% with similar conditions;
         HOLD otherwise

  STEP 4 — LLM REASONING (optional)
    For each signal, calls Groq Llama-3.3-70B (or Gemini 2.0 Flash fallback)
    with the TFT signal + recent news headlines. The LLM writes a 2-4 sentence
    enriched analysis and identifies 2-3 risk factors. TFT numbers are NEVER
    changed by the LLM — only the reasoning text is enhanced.

  STEP 5 — SAVE TO MONGODB
    Upserts each prediction into the 'predictions' collection (one doc per
    ticker, updated in place). Also creates a 'recommendations' document
    with topBuys and topSells sorted by confidence.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup project root so tft.* and scrappers.* imports work
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("run_predictions")


# =========================================================================
# STEP 1: DATA SCRAPING
# =========================================================================

def step1_scrape_data(skip: bool = False):
    """
    Run technical_updater.py and Gemini_Sentiment.py to get fresh data.

    technical_updater.py:
      - Checks the last date in the master CSV
      - Fetches missing days from dps.psx.com.pk for all 30 tickers
      - Computes technical indicators: SMA-20, SMA-50, RSI-14, Vol-20
      - Writes to data/processed/stocksense_tft_final.csv

    Gemini_Sentiment.py --all:
      - For each ticker, searches Tavily for recent news (last 7 days)
      - Sends articles to Groq Llama-3.3-70B for sentiment scoring
      - Falls back to Gemini 2.0 Flash if Groq fails
      - Writes to data/processed/sentiment_daily.csv
    """
    if skip:
        logger.info("STEP 1: Skipping data scraping (--skip-scrape)")
        return

    import subprocess

    logger.info("=" * 70)
    logger.info("STEP 1: SCRAPING FRESH DATA FROM PSX & NEWS SOURCES")
    logger.info("=" * 70)

    scrapers = [
        ("Technical Updater (OHLCV + indicators)", "python scrappers/technical_updater.py"),
        ("Sentiment Scraper (Tavily + Groq)", "python scrappers/Gemini_Sentiment.py --all"),
    ]

    for name, cmd in scrapers:
        logger.info(f"\n  Running: {name}")
        try:
            result = subprocess.run(
                cmd, shell=True, cwd=str(PROJECT_ROOT),
                capture_output=True, text=True, timeout=600,
            )
            if result.returncode == 0:
                logger.info(f"  Done: {name}")
            else:
                logger.warning(f"  {name} failed (code {result.returncode})")
                if result.stderr:
                    logger.warning(f"    {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            logger.warning(f"  {name} timed out (>10 min)")
        except Exception as e:
            logger.warning(f"  {name} error: {e}")


# =========================================================================
# STEP 2: LOAD MODEL + DATA
# =========================================================================

def step2_load_model():
    """
    Load the TFT model and master CSV into memory.

    The TFT (Temporal Fusion Transformer) model:
      - Trained on 18 years of KSE-30 data (2008-2023)
      - 1.8M parameters: LSTM encoder/decoder + temporal self-attention
      - Produces 5 quantile forecasts (p10, p25, p50, p75, p90) for 7 days
      - Uses GroupNormalizer: each ticker's prices are normalized independently
        so a PKR 600 stock and PKR 30 stock can be learned by the same model

    Returns:
        (engine, master_df) — TFT inference engine and preprocessed DataFrame
    """
    import pandas as pd
    from tft import config, preprocessing
    from tft.inference import TFTInferenceEngine

    logger.info("=" * 70)
    logger.info("STEP 2: LOADING TFT MODEL AND DATA")
    logger.info("=" * 70)

    # Load master CSV
    if not config.MASTER_CSV.exists():
        logger.error(f"Master CSV not found: {config.MASTER_CSV}")
        sys.exit(1)

    logger.info(f"  Loading master CSV: {config.MASTER_CSV}")
    master_df = pd.read_csv(config.MASTER_CSV)
    master_df['Date'] = pd.to_datetime(master_df['Date'])
    master_df = master_df.sort_values(['Ticker', 'Date']).reset_index(drop=True)
    logger.info(f"  Loaded {len(master_df):,} rows, {master_df['Ticker'].nunique()} tickers")
    logger.info(f"  Date range: {master_df['Date'].min().date()} to {master_df['Date'].max().date()}")

    # Load TFT model
    logger.info(f"\n  Loading TFT model from {config.ARTIFACTS_DIR}")
    engine = TFTInferenceEngine()
    logger.info(f"  Model loaded: 1.8M parameters, encoder={config.TFT_HYPERPARAMS['max_encoder_length']}, "
                f"prediction={config.TFT_HYPERPARAMS['max_prediction_length']} days")

    return engine, master_df


# =========================================================================
# STEP 3: PER-TICKER INFERENCE
# =========================================================================

def step3_run_inference(engine, master_df):
    """
    Run TFT inference for each ticker individually.

    For each ticker, the process is:

    1. SLICE: Extract this ticker's rows from the master DataFrame
       (e.g., OGDC has ~4,300 rows from 2008 to today)

    2. FETCH SENTIMENT: Call Tavily search API for recent news about this
       company, then analyze with Groq LLM for a sentiment score (-1 to +1).
       This gives us real-time market sentiment that the training data
       doesn't have.

    3. INJECT SENTIMENT: Overwrite the last row's sentiment fields with the
       freshly scraped values. Recompute proxy_sentiment and blended_sentiment.
       proxy_sentiment = 0.5×RSI_sentiment + 0.3×momentum + 0.2×volume_signal
       blended_sentiment = real sentiment if non-zero, else proxy

    4. PREPROCESS: Apply the full pipeline:
       - Remap time_idx to 0-based continuous per ticker
       - Fill NaN volume features with 0.0
       - Clip all features to mean ± 4 standard deviations (from training stats)
       This prevents out-of-distribution inputs from causing wild predictions.

    5. BUILD WINDOW: Create the inference input:
       - 120 historical rows (90 for the LSTM encoder + 30 buffer)
       - 7 future rows with known features forward-filled, unknown set to last value
       Total: 127 rows per ticker

    6. TFT FORWARD PASS: The model processes the window through:
       - Variable Selection Networks: learn which of 39 features matter
       - LSTM Encoder: compress 90 days of history into a context vector
       - Temporal Self-Attention: focus on the most predictive past days
       - LSTM Decoder: generate 7-day ahead quantile forecasts
       Output shape: (7, 5) = 7 days × 5 quantiles [p10, p25, p50, p75, p90]

    7. DENORMALIZE: Convert from model space back to PKR prices using
       GroupNormalizer's per-ticker scaling parameters.

    8. GENERATE SIGNAL:
       - expected_return = (median_day7 - current_price) / current_price
       - confidence = 0.6 × spread_confidence + 0.4 × directional_consistency
       - BUY if return ≥ 3% AND confidence ≥ 0.55 AND 4+ bullish days
       - SELL if return ≤ -3% AND confidence ≥ 0.55 AND 4+ bearish days
       - HOLD otherwise

    Returns:
        list of (signal_dict, sentiment_dict) tuples for each ticker
    """
    from tft import config as tft_config, preprocessing
    from tft.signals import SignalGenerator
    from api.services.inference_service import InferenceService, TRUST_LEVELS, TRUST_NOTES, COMPANY_NAMES

    logger.info("=" * 70)
    logger.info("STEP 3: RUNNING PER-TICKER INFERENCE")
    logger.info("=" * 70)

    # Import sentiment scraper
    sys.path.insert(0, str(PROJECT_ROOT / "scrappers"))
    from Gemini_Sentiment import get_sentiment

    tickers = tft_config.KSE30_STOCKS
    logger.info(f"  Tickers to process: {len(tickers)}")

    results = []
    failed = []

    for i, ticker in enumerate(tickers, 1):
        company_name = COMPANY_NAMES.get(ticker, ticker)
        logger.info(f"\n  [{i}/{len(tickers)}] {ticker} ({company_name})")

        try:
            # 3a. Slice master_df to this ticker
            ticker_df = master_df[master_df['Ticker'] == ticker].copy()
            if ticker_df.empty:
                logger.warning(f"    No data for {ticker} in master CSV, skipping")
                failed.append(ticker)
                continue
            logger.info(f"    Rows: {len(ticker_df)}")

            # 3b. Fetch fresh sentiment
            logger.info(f"    Fetching sentiment...")
            sentiment = get_sentiment(ticker, company_name)
            sent_score = sentiment.get('sentiment_score', 0.0)
            sent_source = sentiment.get('source', 'neutral')
            logger.info(f"    Sentiment: score={sent_score:+.2f}, source={sent_source}")

            # 3c. Inject sentiment into last row
            last_idx = ticker_df.index[-1]
            ticker_df.loc[last_idx, 'sentiment_score'] = float(sentiment.get('sentiment_score', 0.0))
            ticker_df.loc[last_idx, 'sentiment_count'] = int(sentiment.get('headline_count', 0))

            # 3d. Preprocess
            ticker_df = preprocessing.apply_preprocessing_pipeline(
                ticker_df, stage="inference", scaler_params=engine.scaler_params
            )
            ticker_df = preprocessing.compute_proxy_sentiment(ticker_df)
            ticker_df = preprocessing.compute_blended_sentiment(ticker_df)

            # 3e. Build inference window
            window_df = preprocessing.build_inference_window(
                ticker_df, sentiment_df=None,
                lookback_days=tft_config.INFERENCE_LOOKBACK_DAYS,
                future_days=tft_config.INFERENCE_FUTURE_DAYS,
            )
            if window_df.empty:
                logger.warning(f"    Empty inference window, skipping")
                failed.append(ticker)
                continue
            logger.info(f"    Window: {len(window_df)} rows")

            # 3f. TFT forward pass
            raw_preds, index_df = engine.predict_sliding_window(window_df)
            tickers_in_output = index_df['Ticker'].values if 'Ticker' in index_df.columns else [ticker]
            denormalized = engine.denormalize_predictions(raw_preds, tickers_in_output)

            preds_7d = denormalized.get(ticker)
            if preds_7d is None:
                logger.warning(f"    TFT produced no predictions, skipping")
                failed.append(ticker)
                continue

            if preds_7d.ndim == 3:
                preds_7d = preds_7d[-1]

            # 3g. Generate signal
            gen = SignalGenerator(master_df=ticker_df)
            signal_list = gen.generate_all_signals({ticker: preds_7d}, master_df=ticker_df)

            if not signal_list:
                logger.warning(f"    Signal generator produced no signal, skipping")
                failed.append(ticker)
                continue

            signal = signal_list[0]
            signal['_raw_preds_7d'] = preds_7d.tolist()

            logger.info(f"    Signal: {signal['action']} | conf={signal['confidence']:.3f} | "
                        f"return={signal['expected_return_7d_pct']:+.1f}% | "
                        f"target=Rs.{signal['target_price_7d']:.2f}")

            results.append((signal, sentiment))

        except Exception as e:
            logger.error(f"    FAILED: {e}")
            failed.append(ticker)
            continue

        # Small delay between tickers for sentiment API rate limits
        if i < len(tickers):
            time.sleep(1.0)

    logger.info(f"\n  Completed: {len(results)}/{len(tickers)} tickers")
    if failed:
        logger.warning(f"  Failed: {', '.join(failed)}")

    return results


# =========================================================================
# STEP 4: LLM REASONING ENHANCEMENT
# =========================================================================

def step4_enhance_with_llm(results, skip_llm: bool = False):
    """
    Enhance each signal with LLM-generated reasoning.

    The LLM receives:
      - TFT signal numbers (action, return%, prices, confidence)
      - Recent news headlines from the sentiment step
      - Sector context (e.g., "Banking: sensitive to interest rate changes")
      - Trust level (high/medium/low based on model MAPE for this ticker)

    The LLM returns:
      - enhanced_reasoning: 2-4 sentence narrative combining numbers + news
      - confidence_adjustment: -0.05 to +0.05 (informational only)
      - risk_factors: 2-3 key risks (e.g., "Regulatory headwinds")

    IMPORTANT: TFT numbers (prices, confidence, action) are NEVER changed.
    The LLM only adds richer text. If the LLM fails, base reasoning is used.

    Returns:
        list of enriched signal dicts
    """
    from api.services.inference_service import TRUST_LEVELS, COMPANY_NAMES
    from tft.config import SECTOR_MAP

    logger.info("=" * 70)
    logger.info("STEP 4: ENHANCING SIGNALS WITH LLM REASONING")
    logger.info("=" * 70)

    if skip_llm:
        logger.info("  Skipping LLM enhancement (--no-llm)")
        enriched = []
        for signal, sentiment in results:
            signal['llm_reasoning'] = signal['reasoning']
            signal['llm_confidence_adjustment'] = 0.0
            signal['risk_factors'] = []
            enriched.append((signal, sentiment))
        return enriched

    from api.services.llm_fusion_service import enhance_signal_with_llm

    enriched = []
    for i, (signal, sentiment) in enumerate(results, 1):
        ticker = signal['ticker']
        sector = SECTOR_MAP.get(ticker, "Unknown")
        trust_level = TRUST_LEVELS.get(ticker, "medium")
        company_name = COMPANY_NAMES.get(ticker, ticker)

        logger.info(f"  [{i}/{len(results)}] {ticker}: Calling LLM...")

        try:
            enhanced = asyncio.run(
                enhance_signal_with_llm(signal, sentiment, sector, trust_level, company_name)
            )
            has_llm = enhanced.get('llm_reasoning', '') != enhanced.get('reasoning', '')
            logger.info(f"    LLM: {'enhanced' if has_llm else 'fallback (base reasoning)'}")
        except Exception as e:
            logger.warning(f"    LLM failed for {ticker}: {e}")
            signal['llm_reasoning'] = signal['reasoning']
            signal['llm_confidence_adjustment'] = 0.0
            signal['risk_factors'] = []
            enhanced = signal

        enriched.append((enhanced, sentiment))
        time.sleep(0.5)  # rate limit

    return enriched


# =========================================================================
# STEP 5: SAVE TO MONGODB
# =========================================================================

def step5_save_to_mongodb(results):
    """
    Save all predictions to MongoDB.

    Two collections are written:

    1. 'predictions' — one document per ticker, upserted (updated in place).
       Contains: signal, confidence, prices, quantile forecasts, LLM reasoning,
       sentiment, trust level, risk factors. The chatbot's db_connector already
       queries this collection when users ask about predictions.

    2. 'recommendations' — one document per run, appended.
       Contains: topBuys (sorted by confidence), topSells (sorted by confidence),
       summary (buy/sell/hold counts). The chatbot uses this for "what should
       I buy?" type questions.
    """
    from pymongo import MongoClient, UpdateOne
    from pymongo.errors import ConnectionFailure
    from tft.config import SECTOR_MAP
    from api.services.inference_service import TRUST_LEVELS, TRUST_NOTES, COMPANY_NAMES

    logger.info("=" * 70)
    logger.info("STEP 5: SAVING TO MONGODB")
    logger.info("=" * 70)

    mongo_uri = os.getenv("MONGO_URI", "")
    db_name = os.getenv("MONGO_DB_NAME", "psx")

    if not mongo_uri:
        logger.error("  MONGO_URI not set in .env — cannot save")
        sys.exit(1)

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
        client.admin.command("ping")
        logger.info(f"  Connected to MongoDB ({db_name})")
        db = client[db_name]
    except ConnectionFailure as e:
        logger.error(f"  MongoDB connection failed: {e}")
        sys.exit(1)

    # Build prediction documents
    predictions = []
    for signal, sentiment in results:
        ticker = signal['ticker']
        raw_preds = signal.get('_raw_preds_7d', [])

        # Build quantile forecast from raw predictions
        quantile_forecast = {}
        if raw_preds and len(raw_preds) == 7 and len(raw_preds[0]) == 5:
            quantile_forecast = {
                'q10': [row[0] for row in raw_preds],
                'q25': [row[1] for row in raw_preds],
                'q50': [row[2] for row in raw_preds],
                'q75': [row[3] for row in raw_preds],
                'q90': [row[4] for row in raw_preds],
            }

        trust_level = TRUST_LEVELS.get(ticker, "medium")
        trust_note = TRUST_NOTES.get(ticker)

        pred = {
            "symbol": ticker,
            "companyName": COMPANY_NAMES.get(ticker, ticker),
            "sector": SECTOR_MAP.get(ticker, "Unknown"),
            "signal": signal['action'],
            "confidence": round(signal['confidence'] * 100, 1),
            "currentPrice": signal['current_price'],
            "predictedPrice": signal['target_price_7d'],
            "predictedReturn": signal['expected_return_7d_pct'],
            "horizonDays": 7,
            "priceRange": signal.get('price_range_7d', {}),
            "forecastDays": signal.get('forecast_days', {}),
            "strength": signal.get('strength', 0),
            "reasoning": signal.get('reasoning', ''),
            "confidenceNote": signal.get('confidence_note'),
            # Quantile forecasts (7 days × 5 quantiles)
            "priceForecast7d": quantile_forecast.get('q50', []),
            "quantileForecast7d": quantile_forecast,
            # LLM enrichment
            "llmReasoning": signal.get('llm_reasoning', ''),
            "riskFactors": signal.get('risk_factors', []),
            # Sentiment
            "sentiment": {
                "score": sentiment.get('sentiment_score', 0),
                "confidence": sentiment.get('confidence', 0),
                "source": sentiment.get('source', 'neutral'),
                "key_headlines": sentiment.get('key_headlines', []),
                "reasoning": sentiment.get('reasoning', ''),
            },
            # Trust
            "trustLevel": trust_level,
            "trustNote": trust_note,
            "dataAsOf": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            "modelVersion": "v1",
            "timestamp": signal.get('timestamp', datetime.now(timezone.utc).isoformat()),
            "updatedAt": datetime.now(timezone.utc),
        }
        predictions.append(pred)

    # Upsert predictions
    ops = [
        UpdateOne({"symbol": p["symbol"]}, {"$set": p}, upsert=True)
        for p in predictions
    ]
    if ops:
        result = db.predictions.bulk_write(ops)
        logger.info(f"  Predictions: {result.upserted_count} inserted, {result.modified_count} updated")

    # Build and save recommendations
    buys = sorted([p for p in predictions if p['signal'] == 'BUY'], key=lambda x: x['confidence'], reverse=True)
    sells = sorted([p for p in predictions if p['signal'] == 'SELL'], key=lambda x: x['confidence'], reverse=True)

    recommendation = {
        "topBuys": [{
            "symbol": p["symbol"], "sector": p["sector"],
            "current_price": p["currentPrice"], "predicted_price": p["predictedPrice"],
            "predicted_return": p["predictedReturn"], "confidence": p["confidence"],
            "reasoning": p.get("llmReasoning") or p.get("reasoning", ""),
        } for p in buys[:10]],
        "topSells": [{
            "symbol": p["symbol"], "sector": p["sector"],
            "current_price": p["currentPrice"], "predicted_price": p["predictedPrice"],
            "predicted_return": p["predictedReturn"], "confidence": p["confidence"],
            "reasoning": p.get("llmReasoning") or p.get("reasoning", ""),
        } for p in sells[:10]],
        "summary": {
            "total_buys": len(buys),
            "total_sells": len(sells),
            "total_hold": len(predictions) - len(buys) - len(sells),
            "total_stocks": len(predictions),
        },
        "sourceTimestamp": datetime.now(timezone.utc).isoformat(),
        "createdAt": datetime.now(timezone.utc),
    }
    db.recommendations.insert_one(recommendation)
    logger.info(f"  Recommendations: {len(buys)} buys, {len(sells)} sells")

    return predictions


# =========================================================================
# MAIN
# =========================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="StockSense — Run all predictions and save to MongoDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--skip-scrape", action="store_true",
                        help="Skip data scraping, use existing CSV data")
    parser.add_argument("--no-llm", action="store_true",
                        help="Skip LLM reasoning enhancement (faster)")
    args = parser.parse_args()

    start_time = time.time()

    logger.info("=" * 70)
    logger.info("STOCKSENSE — FULL PREDICTION PIPELINE")
    logger.info(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 70)

    try:
        # Step 1: Scrape fresh data
        step1_scrape_data(skip=args.skip_scrape)

        # Step 2: Load model + data
        engine, master_df = step2_load_model()

        # Step 3: Run inference for all tickers
        results = step3_run_inference(engine, master_df)

        if not results:
            logger.error("No predictions generated. Exiting.")
            sys.exit(1)

        # Step 4: Enhance with LLM reasoning
        results = step4_enhance_with_llm(results, skip_llm=args.no_llm)

        # Step 5: Save to MongoDB
        predictions = step5_save_to_mongodb(results)

        # Summary
        elapsed = time.time() - start_time
        buy_count = sum(1 for p in predictions if p['signal'] == 'BUY')
        sell_count = sum(1 for p in predictions if p['signal'] == 'SELL')
        hold_count = sum(1 for p in predictions if p['signal'] == 'HOLD')

        logger.info("\n" + "=" * 70)
        logger.info("PIPELINE COMPLETE")
        logger.info(f"  Tickers processed: {len(predictions)}")
        logger.info(f"  Signals: {buy_count} BUY | {sell_count} SELL | {hold_count} HOLD")
        logger.info(f"  Time elapsed: {elapsed:.1f}s ({elapsed/60:.1f} min)")
        logger.info("=" * 70)

        # Print top signals
        sorted_preds = sorted(predictions, key=lambda x: x['confidence'], reverse=True)
        print(f"\n{'Ticker':<8} {'Signal':<6} {'Conf':>6} {'Return':>8} {'Price':>10} {'Target':>10}")
        print("-" * 52)
        for p in sorted_preds[:10]:
            print(f"{p['symbol']:<8} {p['signal']:<6} {p['confidence']:>5.1f}% "
                  f"{p['predictedReturn']:>+7.1f}% {p['currentPrice']:>9.2f} {p['predictedPrice']:>9.2f}")

    except KeyboardInterrupt:
        logger.info("\nInterrupted by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\nPIPELINE FAILED: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
