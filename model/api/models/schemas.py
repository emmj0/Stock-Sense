"""
Pydantic v2 response models for StockSense API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ── Sub-models ─────────────────────────────────────────────────────────────

class PriceRange(BaseModel):
    low: float = Field(..., description="10th percentile 7-day price (PKR)")
    high: float = Field(..., description="90th percentile 7-day price (PKR)")


class ForecastDays(BaseModel):
    bullish: int = Field(..., ge=0, le=7)
    bearish: int = Field(..., ge=0, le=7)
    neutral: int = Field(..., ge=0, le=7)


class SentimentSummary(BaseModel):
    score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment score (-1=bearish, +1=bullish)")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: str = Field(default="neutral", description="groq_tavily | gemini_news | proxy | neutral")
    key_headlines: List[str] = Field(default_factory=list)
    reasoning: str = Field(default="")


class QuantileForecast(BaseModel):
    q10: List[float] = Field(..., description="10th percentile price for each of 7 days")
    q25: List[float] = Field(..., description="25th percentile price for each of 7 days")
    q50: List[float] = Field(..., description="Median (50th percentile) price for each of 7 days")
    q75: List[float] = Field(..., description="75th percentile price for each of 7 days")
    q90: List[float] = Field(..., description="90th percentile price for each of 7 days")


# ── Main Signal Response ───────────────────────────────────────────────────

class SignalResponse(BaseModel):
    # Identity
    ticker: str
    sector: str
    company_name: str

    # TFT signal (unchanged numbers from model)
    action: Literal["BUY", "HOLD", "SELL"]
    confidence: float = Field(..., ge=0.0, le=1.0, description="TFT quantile-spread confidence (0-1)")
    strength: float = Field(..., ge=0.0, le=1.0)
    expected_return_7d_pct: float = Field(..., description="Median 7-day expected return (%)")
    current_price: float = Field(..., description="Latest Close price (PKR)")
    target_price_7d: float = Field(..., description="Median 7-day forecast price (PKR)")
    price_range_7d: PriceRange
    forecast_days: ForecastDays
    confidence_note: Optional[str] = None

    # 7-day price forecast arrays
    price_forecast_7d: List[float] = Field(
        ..., description="Median (q50) forecast price for each of next 7 days (PKR)"
    )
    quantile_forecast_7d: QuantileForecast = Field(
        ..., description="Full quantile forecasts: q10/q25/q50/q75/q90 each a 7-element list"
    )

    # Original TFT template reasoning
    reasoning: str

    # LLM-enhanced fields
    llm_reasoning: str = Field(..., description="Groq/Gemini-enhanced reasoning with news context")
    llm_confidence_adjustment: float = Field(
        default=0.0,
        ge=-0.05,
        le=0.05,
        description="LLM-suggested confidence delta based on news quality (informational only)",
    )
    risk_factors: List[str] = Field(default_factory=list, description="2-3 key risk factors identified by LLM")

    # Sentiment
    sentiment: SentimentSummary

    # Model reliability
    trust_level: Literal["high", "medium", "low"] = Field(
        ..., description="high=MAPE<10%, medium=10-20%, low=MAPE>20%"
    )
    trust_note: Optional[str] = Field(default=None, description="Warning text for low-trust tickers")

    # Metadata
    tft_inference_timestamp: str = Field(..., description="ISO8601 UTC timestamp of TFT inference")
    sentiment_fetched_at: str = Field(..., description="ISO8601 UTC timestamp of sentiment fetch")
    cached: bool = Field(default=False, description="True if result was served from in-memory cache")
    data_as_of: str = Field(..., description="Latest date in master CSV (YYYY-MM-DD)")
    model_version: str = Field(default="v1")


# ── Action-filtered list ───────────────────────────────────────────────────

class SignalListResponse(BaseModel):
    signals: List[SignalResponse]
    total: int
    action_filter: Optional[Literal["BUY", "HOLD", "SELL"]] = None
    note: str = Field(
        default="Results from in-memory cache. Fetch individual tickers via /signals/{ticker} to populate.",
        description="Informational note about result source",
    )
    generated_at: str
    model_version: str = Field(default="v1")


# ── Ticker list ────────────────────────────────────────────────────────────

class TickerInfo(BaseModel):
    ticker: str
    sector: str
    company_name: str
    trust_level: Literal["high", "medium", "low"]
    trust_note: Optional[str] = None
    active: bool = True


class TickerListResponse(BaseModel):
    tickers: List[TickerInfo]
    total: int


# ── Health ─────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    model_loaded: bool
    data_as_of: str = Field(..., description="Latest date in master CSV (YYYY-MM-DD)")
    data_stale: bool = Field(..., description="True if today's market data is missing from master CSV")
    last_data_update: Optional[str] = Field(default=None, description="ISO8601 UTC timestamp of last data refresh")
    cache_entries: int = Field(..., description="Number of valid (non-expired) cached ticker signals")
    tickers_cached: List[str]
    startup_time: str
    uptime_seconds: float
    model_version: str = Field(default="v1")
    artifacts_path: str


# ── Cache refresh ──────────────────────────────────────────────────────────

class RefreshResponse(BaseModel):
    status: str
    invalidated: str
    message: str
