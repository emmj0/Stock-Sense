"""
Signal endpoints.

GET /signals/{ticker}    — per-ticker on-demand inference (cold: ~15-25s, warm: <100ms)
GET /signals/action/{action} — filter cached signals by BUY/SELL/HOLD
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from api.models.schemas import (
    QuantileForecast,
    SignalListResponse,
    SignalResponse,
)
from api.services.inference_service import COMPANY_NAMES, get_trust_level_for_ticker

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_ACTIONS = {"BUY", "HOLD", "SELL"}


# ── GET /signals/{ticker} ─────────────────────────────────────────────────

@router.get(
    "/signals/{ticker}",
    response_model=SignalResponse,
    summary="Get on-demand TFT signal for a single ticker",
    description=(
        "Fetches fresh sentiment, runs TFT inference, and enhances reasoning with Groq/Gemini. "
        "Cold path (cache miss): ~15-25s. Warm path (cache hit): <100ms."
    ),
)
async def get_signal(ticker: str, request: Request):
    from tft.config import KSE30_STOCKS, SECTOR_MAP

    ticker = ticker.upper()
    if ticker not in KSE30_STOCKS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not found. Use GET /tickers for the full list.",
        )

    cache = request.app.state.cache_svc

    # ── Cache hit ──────────────────────────────────────────────────────────
    cached = cache.get(ticker)
    if cached:
        cached_copy = dict(cached)
        cached_copy["cached"] = True
        return SignalResponse(**cached_copy)

    # ── Cache miss: acquire per-ticker lock to prevent thundering herd ─────
    async with cache.get_inference_lock(ticker):
        # Re-check after acquiring lock
        cached = cache.get(ticker)
        if cached:
            cached_copy = dict(cached)
            cached_copy["cached"] = True
            return SignalResponse(**cached_copy)

        # ── Full inference pipeline ────────────────────────────────────────
        sector = SECTOR_MAP.get(ticker, "Unknown")
        trust_level, trust_note = get_trust_level_for_ticker(ticker)
        company_name = COMPANY_NAMES.get(ticker, ticker)

        # 1. Fresh sentiment (Tavily search → Groq → Gemini fallback)
        logger.info(f"[{ticker}] Fetching fresh sentiment...")
        try:
            sentiment = await asyncio.to_thread(
                _get_sentiment_sync, ticker, company_name
            )
        except Exception as e:
            logger.warning(f"[{ticker}] Sentiment fetch failed: {e} — using neutral sentiment.")
            sentiment = _neutral_sentiment()

        # 2. TFT inference (blocking CPU work, run in thread pool)
        logger.info(f"[{ticker}] Running TFT inference...")
        inference_svc = request.app.state.inference_svc
        try:
            base_signal = await asyncio.to_thread(
                inference_svc.run_ticker_inference, ticker, sentiment
            )
        except Exception as e:
            logger.error(f"[{ticker}] Inference failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"TFT inference failed for {ticker}: {e}")

        # 3. LLM fusion — enhance reasoning (8s timeout, graceful degradation)
        logger.info(f"[{ticker}] Enhancing with LLM...")
        from api.services.llm_fusion_service import enhance_signal_with_llm
        try:
            base_signal = await asyncio.wait_for(
                enhance_signal_with_llm(base_signal, sentiment, sector, trust_level, company_name),
                timeout=12.0,
            )
        except asyncio.TimeoutError:
            logger.warning(f"[{ticker}] LLM fusion timed out — using base reasoning.")
            base_signal.setdefault("llm_reasoning", base_signal["reasoning"])
            base_signal.setdefault("llm_confidence_adjustment", 0.0)
            base_signal.setdefault("risk_factors", [])

        # 4. Build full response dict
        data_svc = request.app.state.data_svc
        response_dict = _build_response_dict(
            signal=base_signal,
            sentiment=sentiment,
            ticker=ticker,
            sector=sector,
            trust_level=trust_level,
            trust_note=trust_note,
            company_name=company_name,
            data_as_of=data_svc.data_as_of(),
        )

        # 5. Cache (store without _raw_preds_7d — already consumed above)
        cache_dict = {k: v for k, v in response_dict.items() if not k.startswith("_")}
        cache.set(ticker, cache_dict)

        response_dict["cached"] = False
        return SignalResponse(**response_dict)


# ── GET /signals/action/{action} ──────────────────────────────────────────

@router.get(
    "/signals/action/{action}",
    response_model=SignalListResponse,
    summary="Filter cached signals by action (BUY/SELL/HOLD)",
    description=(
        "Returns signals from the in-memory cache that match the requested action. "
        "Only tickers already fetched via GET /signals/{ticker} will appear here."
    ),
)
async def get_signals_by_action(action: str, request: Request):
    action = action.upper()
    if action not in VALID_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{action}'. Must be one of: BUY, SELL, HOLD",
        )

    from tft.config import KSE30_STOCKS

    cache = request.app.state.cache_svc
    matching = []

    for ticker in KSE30_STOCKS:
        entry = cache.get(ticker)
        if entry and entry.get("action") == action:
            entry_copy = dict(entry)
            entry_copy["cached"] = True
            try:
                matching.append(SignalResponse(**entry_copy))
            except Exception as e:
                logger.warning(f"Could not deserialize cached signal for {ticker}: {e}")

    matching.sort(key=lambda s: s.confidence, reverse=True)

    return SignalListResponse(
        signals=matching,
        total=len(matching),
        action_filter=action,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_sentiment_sync(ticker: str, company_name: str) -> dict:
    """Synchronous wrapper around Gemini_Sentiment.get_sentiment (called via to_thread)."""
    import sys
    from pathlib import Path

    # Ensure scrappers/ is importable
    project_root = Path(__file__).parent.parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from scrappers.Gemini_Sentiment import get_sentiment
    return get_sentiment(ticker, company_name)


def _neutral_sentiment() -> dict:
    return {
        "sentiment_score": 0.0,
        "confidence": 0.0,
        "headline_count": 0,
        "key_headlines": [],
        "reasoning": "Sentiment unavailable.",
        "source": "neutral",
        "weight": 0.0,
    }


def _build_response_dict(
    signal: dict,
    sentiment: dict,
    ticker: str,
    sector: str,
    trust_level: str,
    trust_note,
    company_name: str,
    data_as_of: str,
) -> dict:
    import numpy as np

    raw_preds = signal.pop("_raw_preds_7d", None)
    now_utc = datetime.now(timezone.utc).isoformat()

    if raw_preds is not None:
        preds_array = np.array(raw_preds)  # shape (7, 5)
        price_forecast_q50 = preds_array[:, 2].tolist()
        quantile_forecast = QuantileForecast(
            q10=preds_array[:, 0].tolist(),
            q25=preds_array[:, 1].tolist(),
            q50=preds_array[:, 2].tolist(),
            q75=preds_array[:, 3].tolist(),
            q90=preds_array[:, 4].tolist(),
        )
    else:
        # Fallback: fill from target_price if raw preds were lost
        price_forecast_q50 = [signal.get("target_price_7d", 0.0)] * 7
        quantile_forecast = QuantileForecast(
            q10=price_forecast_q50, q25=price_forecast_q50, q50=price_forecast_q50,
            q75=price_forecast_q50, q90=price_forecast_q50,
        )

    return {
        # Identity
        "ticker": ticker,
        "sector": sector,
        "company_name": company_name,

        # TFT signal (pass-through)
        "action": signal["action"],
        "confidence": signal["confidence"],
        "strength": signal["strength"],
        "expected_return_7d_pct": signal["expected_return_7d_pct"],
        "current_price": signal["current_price"],
        "target_price_7d": signal["target_price_7d"],
        "price_range_7d": signal["price_range_7d"],
        "forecast_days": signal["forecast_days"],
        "confidence_note": signal.get("confidence_note"),

        # Price forecast arrays
        "price_forecast_7d": price_forecast_q50,
        "quantile_forecast_7d": quantile_forecast,

        # Reasoning
        "reasoning": signal["reasoning"],
        "llm_reasoning": signal.get("llm_reasoning", signal["reasoning"]),
        "llm_confidence_adjustment": signal.get("llm_confidence_adjustment", 0.0),
        "risk_factors": signal.get("risk_factors", []),

        # Sentiment
        "sentiment": {
            "score": float(sentiment.get("sentiment_score", 0.0)),
            "confidence": float(sentiment.get("confidence", 0.0)),
            "source": str(sentiment.get("source", "neutral")),
            "key_headlines": list(sentiment.get("key_headlines", []))[:5],
            "reasoning": str(sentiment.get("reasoning", "")),
        },

        # Trust
        "trust_level": trust_level,
        "trust_note": trust_note,

        # Metadata
        "tft_inference_timestamp": signal.get("timestamp", now_utc),
        "sentiment_fetched_at": now_utc,
        "cached": False,
        "data_as_of": data_as_of,
        "model_version": "v1",
    }
