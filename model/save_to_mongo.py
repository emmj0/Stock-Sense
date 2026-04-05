"""
Save TFT prediction signals to MongoDB.

Three modes:
    python save_to_mongo.py                  # Save latest signals JSON file
    python save_to_mongo.py --run-pipeline   # Run daily pipeline first, then save
    python save_to_mongo.py --from-api       # Fetch rich data from running FastAPI (port 8000)

The --from-api mode is recommended: it hits the FastAPI for each of the 30 KSE-30
tickers, getting full quantile forecasts, LLM reasoning, sentiment, and trust levels.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent
SIGNALS_DIR = PROJECT_ROOT / "data" / "inference"


def get_mongo_db():
    """Connect to MongoDB and return database handle."""
    mongo_uri = os.getenv("MONGO_URI", "")
    db_name = os.getenv("MONGO_DB_NAME", "psx")

    if not mongo_uri:
        logger.error("MONGO_URI not set in environment")
        sys.exit(1)

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
        client.admin.command("ping")
        logger.info("Connected to MongoDB")
        return client[db_name]
    except ConnectionFailure as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        sys.exit(1)


# ---------------------------------------------------------------------------
# MODE 1: From local signals JSON (daily pipeline output)
# ---------------------------------------------------------------------------

def find_latest_signals_file() -> Path:
    files = sorted(SIGNALS_DIR.glob("signals_*.json"), reverse=True)
    if not files:
        logger.error(f"No signals files found in {SIGNALS_DIR}")
        sys.exit(1)
    return files[0]


def load_signals(file_path: Path) -> list:
    logger.info(f"Loading signals from {file_path}")
    with open(file_path, "r") as f:
        signals = json.load(f)
    logger.info(f"Loaded {len(signals)} signals")
    return signals


def transform_signal_to_prediction(signal: dict) -> dict:
    """Transform a daily pipeline signal dict into MongoDB document."""
    from config import SECTOR_MAP, COMPANY_NAMES

    ticker = signal["ticker"]

    return {
        "symbol": ticker,
        "companyName": COMPANY_NAMES.get(ticker, ticker),
        "sector": SECTOR_MAP.get(ticker, "Unknown"),
        "signal": signal["action"],
        "confidence": round(signal["confidence"] * 100, 1),
        "currentPrice": signal["current_price"],
        "predictedPrice": signal["target_price_7d"],
        "predictedReturn": signal["expected_return_7d_pct"],
        "horizonDays": 7,
        "priceRange": signal.get("price_range_7d", {}),
        "forecastDays": signal.get("forecast_days", {}),
        "strength": signal.get("strength", 0),
        "reasoning": signal.get("reasoning", ""),
        "confidenceNote": signal.get("confidence_note"),
        "timestamp": signal.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "updatedAt": datetime.now(timezone.utc),
    }


# ---------------------------------------------------------------------------
# MODE 2: From FastAPI (richer data with LLM, quantiles, sentiment)
# ---------------------------------------------------------------------------

def fetch_all_from_api(api_url: str = "http://127.0.0.1:8000") -> list:
    """Fetch predictions for all KSE-30 tickers from the running FastAPI."""
    from config import KSE30_STOCKS

    logger.info(f"Fetching predictions from FastAPI at {api_url}")
    logger.info(f"Tickers to fetch: {len(KSE30_STOCKS)}")

    # Health check first
    try:
        health = requests.get(f"{api_url}/health", timeout=10).json()
        if not health.get("model_loaded"):
            logger.error("FastAPI model not loaded yet. Wait for startup to complete.")
            sys.exit(1)
        logger.info(f"API healthy — model loaded, data as of {health.get('data_as_of')}")
    except requests.ConnectionError:
        logger.error(f"Cannot connect to FastAPI at {api_url}. Is it running?")
        sys.exit(1)

    results = []
    failed = []

    for i, ticker in enumerate(KSE30_STOCKS, 1):
        logger.info(f"  [{i}/{len(KSE30_STOCKS)}] Fetching {ticker}...")
        try:
            resp = requests.get(f"{api_url}/signals/{ticker}", timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                results.append(data)
                action = data.get("action", "?")
                conf = data.get("confidence", 0)
                ret = data.get("expected_return_7d_pct", 0)
                logger.info(f"    {ticker}: {action} (conf={conf:.2f}, ret={ret:+.1f}%)")
            else:
                logger.warning(f"    {ticker}: HTTP {resp.status_code} — {resp.text[:100]}")
                failed.append(ticker)
        except requests.Timeout:
            logger.warning(f"    {ticker}: Timeout (>60s)")
            failed.append(ticker)
        except Exception as e:
            logger.warning(f"    {ticker}: Error — {e}")
            failed.append(ticker)

    logger.info(f"\nFetched {len(results)}/{len(KSE30_STOCKS)} tickers")
    if failed:
        logger.warning(f"Failed tickers: {', '.join(failed)}")

    return results


def transform_api_response_to_prediction(data: dict) -> dict:
    """Transform a FastAPI SignalResponse into MongoDB document."""
    return {
        "symbol": data["ticker"],
        "companyName": data.get("company_name", data["ticker"]),
        "sector": data.get("sector", "Unknown"),
        "signal": data["action"],
        "confidence": round(data["confidence"] * 100, 1),
        "currentPrice": data["current_price"],
        "predictedPrice": data["target_price_7d"],
        "predictedReturn": data["expected_return_7d_pct"],
        "horizonDays": 7,
        "priceRange": data.get("price_range_7d", {}),
        "forecastDays": data.get("forecast_days", {}),
        "strength": data.get("strength", 0),
        "reasoning": data.get("reasoning", ""),
        "confidenceNote": data.get("confidence_note"),
        # Rich fields from FastAPI
        "priceForecast7d": data.get("price_forecast_7d", []),
        "quantileForecast7d": data.get("quantile_forecast_7d", {}),
        "llmReasoning": data.get("llm_reasoning", ""),
        "riskFactors": data.get("risk_factors", []),
        "sentiment": data.get("sentiment", {}),
        "trustLevel": data.get("trust_level", "medium"),
        "trustNote": data.get("trust_note"),
        "dataAsOf": data.get("data_as_of", ""),
        "modelVersion": data.get("model_version", "v1"),
        "timestamp": data.get("tft_inference_timestamp", datetime.now(timezone.utc).isoformat()),
        "updatedAt": datetime.now(timezone.utc),
    }


# ---------------------------------------------------------------------------
# Save to MongoDB
# ---------------------------------------------------------------------------

def save_predictions(db, predictions: list):
    """Upsert predictions into MongoDB predictions collection."""
    logger.info("Saving predictions to MongoDB...")

    ops = []
    for pred in predictions:
        ops.append(
            UpdateOne(
                {"symbol": pred["symbol"]},
                {"$set": pred},
                upsert=True,
            )
        )

    if ops:
        result = db.predictions.bulk_write(ops)
        logger.info(
            f"Predictions saved: {result.upserted_count} inserted, "
            f"{result.modified_count} updated"
        )


def save_recommendations(db, predictions: list):
    """Generate and save a recommendations document."""
    logger.info("Generating recommendations...")

    buys = sorted(
        [p for p in predictions if p["signal"] == "BUY"],
        key=lambda x: x["confidence"],
        reverse=True,
    )
    sells = sorted(
        [p for p in predictions if p["signal"] == "SELL"],
        key=lambda x: x["confidence"],
        reverse=True,
    )

    top_buys = []
    for p in buys[:10]:
        top_buys.append({
            "symbol": p["symbol"],
            "sector": p.get("sector", "Unknown"),
            "current_price": p["currentPrice"],
            "predicted_price": p["predictedPrice"],
            "predicted_return": p["predictedReturn"],
            "confidence": p["confidence"],
            "reasoning": p.get("llmReasoning") or p.get("reasoning", ""),
        })

    top_sells = []
    for p in sells[:10]:
        top_sells.append({
            "symbol": p["symbol"],
            "sector": p.get("sector", "Unknown"),
            "current_price": p["currentPrice"],
            "predicted_price": p["predictedPrice"],
            "predicted_return": p["predictedReturn"],
            "confidence": p["confidence"],
            "reasoning": p.get("llmReasoning") or p.get("reasoning", ""),
        })

    recommendation = {
        "topBuys": top_buys,
        "topSells": top_sells,
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
    logger.info(
        f"Recommendations saved: {len(top_buys)} buys, {len(top_sells)} sells"
    )


def main():
    parser = argparse.ArgumentParser(description="Save TFT predictions to MongoDB")
    parser.add_argument(
        "--file", type=str,
        help="Specific signals JSON filename (e.g. signals_20260403.json)",
    )
    parser.add_argument(
        "--run-pipeline", action="store_true",
        help="Run the daily TFT pipeline before saving",
    )
    parser.add_argument(
        "--from-api", action="store_true",
        help="Fetch rich predictions from running FastAPI (recommended)",
    )
    parser.add_argument(
        "--api-url", type=str, default="http://127.0.0.1:8000",
        help="FastAPI URL (default: http://127.0.0.1:8000)",
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("STOCKSENSE — Save Predictions to MongoDB")
    logger.info("=" * 60)

    # Connect to MongoDB
    db = get_mongo_db()

    if args.from_api:
        # Mode 2: Fetch from running FastAPI (rich data)
        api_responses = fetch_all_from_api(args.api_url)
        if not api_responses:
            logger.error("No predictions fetched from API")
            return
        predictions = [transform_api_response_to_prediction(r) for r in api_responses]
    else:
        # Mode 1: From local signals JSON
        if args.run_pipeline:
            logger.info("Running daily pipeline first...")
            from tft.daily_pipeline import main as run_pipeline
            run_pipeline()

        if args.file:
            signals_path = SIGNALS_DIR / args.file
            if not signals_path.exists():
                logger.error(f"File not found: {signals_path}")
                sys.exit(1)
        else:
            signals_path = find_latest_signals_file()

        signals = load_signals(signals_path)
        if not signals:
            logger.warning("No signals to save")
            return
        predictions = [transform_signal_to_prediction(s) for s in signals]

    # Save predictions (upsert per symbol)
    save_predictions(db, predictions)

    # Save recommendations document
    save_recommendations(db, predictions)

    # Summary
    buy_count = sum(1 for p in predictions if p["signal"] == "BUY")
    sell_count = sum(1 for p in predictions if p["signal"] == "SELL")
    hold_count = sum(1 for p in predictions if p["signal"] == "HOLD")

    logger.info("=" * 60)
    logger.info(f"DONE — {len(predictions)} predictions saved to MongoDB")
    logger.info(f"  BUY: {buy_count} | SELL: {sell_count} | HOLD: {hold_count}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
