# StockSense V1 — Complete Technical Guide

> Pakistan KSE-30 stock forecasting system powered by a Temporal Fusion Transformer, enriched with LLM-driven reasoning, served over FastAPI.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [The TFT Model — How It Works](#3-the-tft-model--how-it-works)
4. [Model Parameters & Architecture](#4-model-parameters--architecture)
5. [Features & Data Schema](#5-features--data-schema)
6. [Data Scrapers](#6-data-scrapers)
7. [Daily Pipeline (tft/daily_pipeline.py)](#7-daily-pipeline)
8. [The FastAPI Backend — File by File](#8-the-fastapi-backend--file-by-file)
9. [End-to-End Request Data Flow](#9-end-to-end-request-data-flow)
10. [LLM Fusion — How Groq & Gemini Are Used](#10-llm-fusion)
11. [Signal Output Schema](#11-signal-output-schema)
12. [Moving to Another Machine (Frontend Deployment)](#12-moving-to-another-machine)
13. [GitHub Actions — Daily Automation](#13-github-actions--daily-automation)
14. [API Keys & .env Reference](#14-api-keys--env-reference)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. System Overview

StockSense V1 is a three-layer system:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — DATA COLLECTION (daily, after market close)          │
│  technical_updater.py  →  OHLCV + technicals + macro data       │
│  Gemini_Sentiment.py   →  news sentiment via Tavily + Groq      │
└────────────────────────────┬────────────────────────────────────┘
                             │ writes to master CSV
┌────────────────────────────▼────────────────────────────────────┐
│  LAYER 2 — TFT INFERENCE (once daily, runs in ~10-30s)          │
│  TFTInferenceEngine  →  7-day quantile price forecast           │
│  SignalGenerator     →  BUY / HOLD / SELL + confidence          │
└────────────────────────────┬────────────────────────────────────┘
                             │ signals cached in-memory
┌────────────────────────────▼────────────────────────────────────┐
│  LAYER 3 — FASTAPI (on-demand, per-ticker requests)             │
│  GET /signals/{ticker}  →  fresh sentiment + TFT + Groq LLM     │
│  Returns: prices, signals, forecasts, LLM reasoning             │
└─────────────────────────────────────────────────────────────────┘
```

**Key design choices:**
- The TFT model runs **per-ticker, on-demand** in the API (not pre-cached for all 28)
- Sentiment is always **freshly scraped** per request (last 7 days of news)
- TFT numbers are **never altered** by LLMs — only reasoning text is enriched
- Results are **cached for 1 hour** per ticker and invalidated at midnight (PKT)

---

## 2. Repository Structure

```
StockSenseV1/
│
├── .env                          # API keys (NEVER commit this)
├── config.py                     # Root-level config: keys, company names, stock list
├── requirements.txt              # All Python dependencies
│
├── artifacts/
│   └── artifactsv1/              # ← TRAINED MODEL ARTIFACTS (move these to target machine)
│       ├── tft_model.ckpt        # PyTorch Lightning checkpoint (~120 MB)
│       ├── encoder_params.json   # Categorical label encodings (Ticker, Sector, announcement_type)
│       ├── scaler_params.json    # Per-ticker normalization statistics
│       └── training_metadata.json # Hyperparameters, training cutoff date, feature lists
│
├── data/
│   ├── final/
│   │   └── tft_ready_clean.csv   # ← MASTER DATA FILE (57 MB, 123K rows, 2008–present)
│   ├── processed/
│   │   ├── sentiment_daily.csv   # Daily scraped sentiment per ticker
│   │   └── stocksense_tft_final.csv  # Intermediate OHLCV file (written by technical_updater.py)
│   └── inference/
│       └── signals_YYYYMMDD.json # Daily signal output files
│
├── tft/                          # TFT inference module
│   ├── config.py                 # Paths, hyperparams, feature lists, KSE30_STOCKS
│   ├── preprocessing.py          # Feature pipeline (proxy sentiment, blended sentiment, clipping)
│   ├── dataset.py                # TimeSeriesDataSet builder for inference
│   ├── inference.py              # TFTInferenceEngine class
│   ├── signals.py                # BUY/HOLD/SELL logic + confidence scoring
│   └── daily_pipeline.py        # Daily orchestration script
│
├── scrappers/
│   ├── Gemini_Sentiment.py       # News sentiment via Tavily + Groq + Gemini fallback
│   └── technical_updater.py      # OHLCV scraper from PSX + technical indicators
│
└── api/                          # ← FastAPI backend (what we built)
    ├── main.py                   # App factory, lifespan, startup
    ├── routes/
    │   ├── signals.py            # GET /signals/{ticker}, GET /signals/action/{action}
    │   ├── tickers.py            # GET /tickers
    │   └── health.py             # GET /health, POST /refresh/{ticker}
    ├── models/
    │   └── schemas.py            # All Pydantic response models
    └── services/
        ├── inference_service.py  # Per-ticker TFT wrapper
        ├── llm_fusion_service.py # Groq/Gemini reasoning enhancer
        ├── data_service.py       # CSV freshness gate + daily update
        └── cache_service.py      # In-memory TTL cache with midnight invalidation
```

---

## 3. The TFT Model — How It Works

### What is TFT?

A **Temporal Fusion Transformer (TFT)** is a deep learning architecture specifically designed for multi-horizon time-series forecasting. Unlike standard transformers, TFT:

- Handles **static features** (things that don't change: ticker name, sector)
- Handles **time-varying known features** (things you know in advance: day of week, macro data)
- Handles **time-varying unknown features** (things you only know in hindsight: price, RSI, sentiment)
- Produces **probabilistic forecasts** — not one price, but 5 quantile predictions (p10, p25, p50, p75, p90)
- Uses **variable selection networks** to automatically learn which features matter most

### How the Model Produces Forecasts

```
Historical data (90 days lookback)         Future (7 days to forecast)
────────────────────────────────────────   ─────────────────────────────
OHLCV, RSI, SMA, Sentiment,          →    Day+1 ... Day+7
Volume signals, Macro data                 × 5 quantiles each
(per ticker)                               = shape (7, 5)
```

1. **Encoder**: The LSTM encoder processes the last 90 days of historical data, building a compressed context vector that captures trends, seasonality, and momentum patterns.

2. **Variable Selection Networks (VSN)**: At each time step, learned gates determine which of the 39 input features are most relevant. The model can "ignore" noisy features automatically.

3. **Temporal Self-Attention**: The transformer attention layer looks back across the 90-day window and learns which past time steps are most predictive for each future step.

4. **Decoder**: A second LSTM decoder, informed by the context vector and attention output, generates the 7-day ahead forecast.

5. **Quantile Loss**: Instead of predicting a single number, the model outputs 5 quantile estimates per day. Quantile 0.5 = the median forecast. Quantiles 0.1 and 0.9 form the 80% confidence interval.

6. **GroupNormalizer**: Each ticker's price is normalized independently using a softplus transform and per-ticker mean/std. This lets one model learn across 28 very different price ranges (PSO at PKR 150 vs INIL at PKR 50) without any ticker "dominating" the loss.

### Confidence Score Formula

The API's confidence score is **NOT** a probability — it's a spread-based quality measure:

```python
# Step 1: Quantile spread at day 7
spread = (q90_day7 - q10_day7) / current_price
# Narrow spread → high confidence; wide spread → low confidence
raw_confidence = 1.0 / (1.0 + spread * 10)

# Step 2: Directional consistency across 7 days
bull_days = count(days where q25 > current_price)  # even pessimistic case is positive
bear_days = count(days where q75 < current_price)  # even optimistic case is negative
directional_consistency = max(bull_days, bear_days) / 7.0

# Final blend
confidence = 0.6 * raw_confidence + 0.4 * directional_consistency
```

### Signal Generation Logic

```python
# BUY criteria (all three must be true):
action = 'BUY' if:
    expected_return_7d >= +3.0%    AND
    confidence >= 0.55              AND
    bull_days >= 4 out of 7

# SELL criteria:
action = 'SELL' if:
    expected_return_7d <= -3.0%    AND
    confidence >= 0.55              AND
    bear_days >= 4 out of 7

# Everything else:
action = 'HOLD'

# Sentiment modifier (reduces confidence by 20% when signal contradicts sentiment):
if action == 'BUY' and blended_sentiment < -0.3:
    confidence *= 0.8   # negative news undermines bullish signal
if action == 'SELL' and blended_sentiment > +0.3:
    confidence *= 0.8   # positive news undermines bearish signal
```

### Model Performance (v1, test set 2025)

| Metric | Value |
|--------|-------|
| Overall MAPE | 12.99% |
| Directional Accuracy | 70.6% |
| 80% CI Coverage | 52.2% |

| Ticker | MAPE | Trust Level |
|--------|------|-------------|
| PSO | 2.73% | High |
| PPL | 3.12% | High |
| ILP | 3.17% | High |
| POL | 3.25% | High |
| OGDC | 3.62% | High |
| FFC | 56.7% | **Low** |
| EFERT | 43.8% | **Low** |
| MEBL | 36.2% | **Low** |
| ATRL | ~30%+ | **Low** |

> **Note on low-trust tickers:** FFC and EFERT are fertilizer companies that underwent regime changes in gas subsidy policies. The model trained on historical patterns that no longer apply. Their forecasts should be treated as directional indicators only — never use the price targets literally.

---

## 4. Model Parameters & Architecture

```python
TFT_HYPERPARAMS = {
    # Sequence
    "max_encoder_length": 90,        # lookback window: ~4.5 months
    "max_prediction_length": 7,      # forecast horizon: 7 trading days

    # Architecture
    "hidden_size": 128,              # main hidden layer size for all components
    "lstm_layers": 2,                # stacked LSTM encoder and decoder
    "attention_head_size": 4,        # multi-head temporal self-attention heads
    "dropout": 0.15,                 # applied to encoder, decoder, attention
    "hidden_continuous_size": 32,    # embedding dim for each continuous variable

    # Output
    "quantiles": [0.1, 0.25, 0.5, 0.75, 0.9],   # 5 quantile outputs
    "output_size": 5,

    # Training (reference only — model is already trained)
    "learning_rate": 3e-4,
    "optimizer": "adam",
    "batch_size": 128,
    "max_epochs": 50,
    "patience": 7,                   # early stopping: stop if no val_loss improvement for 7 epochs
    "reduce_lr_patience": 4,         # halve LR after 4 epochs of no improvement
    "gradient_clip_val": 0.5,

    # Normalization
    "target_normalizer_type": "GroupNormalizer",       # per-ticker normalization
    "target_normalizer_transformation": "softplus",     # log-like transform for prices
}
```

**Training setup:** 18.2 years of data (2008–2023), 28 KSE-30 tickers, ~96K training samples. Trained on Kaggle P100 GPU. Training ran for 13 epochs before early stopping (best val_loss: ~11.07).

---

## 5. Features & Data Schema

The master CSV (`data/final/tft_ready_clean.csv`) has **43 columns** per row.

### Static Features (per ticker, time-invariant)
| Column | Type | Description |
|--------|------|-------------|
| `Ticker` | categorical | Stock symbol (e.g., "OGDC") |
| `Sector` | categorical | Industry sector (e.g., "Energy") |

### Time-Varying Known Features (known in advance)
| Column | Description |
|--------|-------------|
| `day_of_week` | 0=Monday … 4=Friday |
| `month` | 1–12 |
| `oil_price` | Global crude price (Brent USD/barrel) |
| `USD_PKR` | US Dollar to Pakistani Rupee exchange rate |
| `market_index` | KSE-100 index value |
| `market_momentum` | Rolling 20-day KSE-100 momentum |
| `market_volatility` | Rolling 20-day KSE-100 volatility |
| `market_strength` | Composite market strength score |
| `inflation_proxy` | Pakistan CPI-based inflation proxy |
| `fx_volatility` | Rolling volatility of USD/PKR |
| `fx_risk` | FX risk premium |
| `announcement_flag` | 1 if PSX corporate announcement exists, else 0 |
| `announcement_type` | "dividend", "earnings", "rights", "board", "none" |

### Time-Varying Unknown Features (the model's input + target)
| Column | Description |
|--------|-------------|
| `Close` | **TARGET** — closing price in PKR |
| `Open`, `High`, `Low` | OHLC prices |
| `Volume` | Daily traded volume |
| `sma_20`, `sma_50` | 20-day and 50-day simple moving average |
| `rsi_14` | 14-period Relative Strength Index (0–100) |
| `vol_20` | 20-day price volatility (std of pct change) |
| `volume_ma_20` | 20-day moving average of volume |
| `volume_ratio` | Current volume / volume_ma_20 |
| `volume_trend` | Direction of volume change |
| `volume_signal` | Composite volume signal |
| `obv_signal` | On-Balance Volume signal |
| `vpt` | Volume Price Trend |
| `price_direction` | Momentum direction (+1/0/-1) |
| `rsi_sentiment` | RSI mapped to [-1, +1] sentiment scale |
| `momentum_signal` | Price momentum-derived signal |
| `proxy_sentiment` | `0.5*rsi_sentiment + 0.3*momentum + 0.2*volume_signal` |
| `blended_sentiment` | real sentiment_score if non-zero, else proxy_sentiment |
| `sentiment_score` | Scraped news sentiment (-1 to +1, sparse) |
| `sentiment_count` | Number of articles contributing to score |
| `sentiment_ma_5` | 5-day rolling average of sentiment_score |
| `days_since_announcement` | Days since last PSX corporate announcement |
| `relative_momentum` | Momentum relative to sector average |
| `sentiment_quality` | Quality/confidence of available sentiment |

### The Inference Window

For each prediction run, a window is built per ticker:
```
[90+ historical rows] + [7 future rows]
                              └── known features: forward-filled from last historical row
                              └── unknown features: set to last value (model ignores decoder unknowns)
```

---

## 6. Data Scrapers

### 6.1 `scrappers/technical_updater.py` — OHLCV + Technicals

**What it does:**
- Reads the current master CSV to find the last recorded date
- Fetches missing months from PSX (dps.psx.com.pk) for all 30 tickers + KSE100 index
- Fetches USD/PKR exchange rate from Yahoo Finance (`yfinance`)
- Computes: `sma_20`, `sma_50`, `rsi_14`, `vol_20`, `time_idx` continuation
- Forward-fills macro columns (`oil_price`, `fx_volatility`, etc.) from existing data
- **Writes to:** `data/processed/stocksense_tft_final.csv`

> ⚠️ **Path note:** This writes to the *processed* CSV, not the TFT master CSV. The API's `DataService` handles merging new rows into `data/final/tft_ready_clean.csv` after this runs.

**Run manually:**
```bash
cd d:\StockSenseV1
python scrappers/technical_updater.py
```

**Features computed:**
```python
# RSI (14-period)
delta = close.diff()
gain = delta.where(delta > 0, 0).rolling(14).mean()
loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
rsi = 100 - (100 / (1 + gain / loss))

# Simple Moving Averages
sma_20 = close.rolling(20).mean()
sma_50 = close.rolling(50).mean()

# Volatility
vol_20 = close.pct_change().rolling(20).std()
```

### 6.2 `scrappers/Gemini_Sentiment.py` — News Sentiment

**What it does (3-step chain):**

```
Step 1: Tavily Search API
  Query: "{company_name} {ticker} stock PSX news"
  Parameters: last 7 days, max 5 results
  Output: list of news articles with title + content snippet

Step 2: Groq (Llama 3.3 70B)
  Input: formatted news context from Step 1
  Task: analyze sentiment for Pakistan stock investor
  Output: {sentiment_score, confidence, headline_count, key_headlines, reasoning}

Step 3: Gemini 2.5 Flash (fallback only)
  Used when: Tavily fails OR Groq analysis fails
  Uses Gemini's built-in Google Search grounding
  Same output structure as Step 2
```

**Output dict (returned by `get_sentiment(ticker)`):**
```python
{
    "ticker": "OGDC",
    "sentiment_score": 0.35,     # -1.0 (very bearish) to +1.0 (very bullish)
    "confidence": 0.75,          # 0.0 to 1.0
    "headline_count": 3,
    "key_headlines": ["OGDC Q2 profits up 18%", "Oil prices rise on OPEC cuts"],
    "reasoning": "Positive sentiment from earnings beat and favorable oil price environment.",
    "source": "groq_tavily",     # or "gemini_news" or "neutral"
    "weight": 1.2,
}
```

**Run manually (single ticker):**
```bash
python scrappers/Gemini_Sentiment.py --ticker OGDC
```

**Run for all tickers:**
```bash
python scrappers/Gemini_Sentiment.py --all
```

**API usage per month:**
- Tavily: ~28 searches/day × 22 trading days = ~616 searches/month (free tier: 1,000)
- Groq: Free with no rate limits at this volume
- Gemini: Only used as fallback

---

## 7. Daily Pipeline

`tft/daily_pipeline.py` is the orchestration script that chains everything together. Run it once per trading day after market close (~3:30 PM PKT).

### Pipeline Steps

```
python -m tft.daily_pipeline
```

**Step 1 — Run scrapers (subprocess calls)**
```
technical_updater.py  →  updates OHLCV + technicals (data/processed/stocksense_tft_final.csv)
Gemini_Sentiment.py --all  →  updates sentiment for all 28 tickers (data/processed/sentiment_daily.csv)
```
Both scrapers run as subprocesses with 10-minute timeouts each.

**Step 2 — Load & preprocess**
```python
df = pd.read_csv("data/final/tft_ready_clean.csv")
df = preprocessing.apply_preprocessing_pipeline(df, stage="inference")
```

The preprocessing pipeline (in order):
1. `remap_time_idx()` — resets time_idx to 0-based per-ticker cumcount
2. `fill_volume_nans()` — fills missing volume features with 0.0
3. `compute_proxy_sentiment()` — `0.5*rsi_sent + 0.3*momentum + 0.2*volume_signal`
4. `compute_blended_sentiment()` — uses real sentiment if non-zero, else proxy
5. `clip_to_training_range()` — clips features to mean ± 4σ from training (prevents OOD inputs)

**Step 3 — Build inference window**
```python
window_df = preprocessing.build_inference_window(
    master_df=df,
    sentiment_df=sentiment_csv,   # merges fresh sentiment for each ticker
    lookback_days=120,             # 90 encoder + 30 buffer
    future_days=7,
)
# Output: 28 tickers × (120 historical + 7 future) = ~3,556 rows
```

**Step 4 — TFT inference**
```python
engine = TFTInferenceEngine()      # loads model from artifacts/artifactsv1/
raw_preds, index_df = engine.predict_sliding_window(window_df)
# raw_preds shape: (num_samples, 7, 5)  →  7 days × 5 quantiles
denormalized = engine.denormalize_predictions(raw_preds, tickers)
# denormalized: {ticker → np.array(7, 5)} — prices in PKR
```

**Step 5 — Generate signals**
```python
gen = SignalGenerator(master_df=df)
signals = gen.generate_all_signals(denormalized)
# Returns list of 28 signal dicts, sorted by confidence
```

**Step 6 — Save output**
```
data/inference/signals_20260404.json
```

---

## 8. The FastAPI Backend — File by File

### `api/main.py` — Application Entry Point

The FastAPI application is created with a **lifespan context manager** (startup + shutdown). This replaces the deprecated `@app.on_event` pattern.

**Startup sequence:**
1. Resolve `PROJECT_ROOT` (from `STOCKSENSE_ROOT` env var or auto-detection)
2. Patch `sys.path` so `tft.*` and `scrappers.*` are importable regardless of CWD
3. Load master CSV into memory as a pandas DataFrame
4. Load `TFTInferenceEngine` in a thread pool (`asyncio.to_thread`) — blocking CPU work that takes ~20-30s
5. Initialize `CacheService`, `DataService`, `InferenceService`
6. Run data freshness gate (non-blocking, 150s timeout)
7. Expose all services on `app.state`

**CORS:** Configured from `CORS_ORIGINS` env var (defaults to `*` for local development).

**Portability:** `PROJECT_ROOT` resolution tries `STOCKSENSE_ROOT` env var first. On a new machine, simply set this env var to the correct path — no code changes needed.

---

### `api/services/inference_service.py` — Per-Ticker TFT

This is the core service. It holds a reference to the loaded `TFTInferenceEngine` singleton and the full master DataFrame. Per-request, it:

1. **Slices** master_df to only the requested ticker: `master_df[master_df['Ticker'] == ticker]`
2. **Injects fresh sentiment** into the last historical row (overwrites `sentiment_score`, `sentiment_count`, recomputes `proxy_sentiment` and `blended_sentiment`)
3. **Preprocesses** the single-ticker slice via `apply_preprocessing_pipeline()`
4. **Calls `build_inference_window()`** — since we pass a single-ticker DataFrame, the function iterates KSE30_STOCKS but only finds data for the one ticker; all others are skipped via `if len(ticker_df) == 0: continue`
5. **Runs `engine.predict_sliding_window(window_df)`** — the TFT model runs on only this ticker's 127-row window
6. **Extracts predictions** and calls `denormalize_predictions()` — returns `np.array(7, 5)` in PKR
7. **Calls `SignalGenerator.generate_all_signals({ticker: preds_7d})`** to get the BUY/HOLD/SELL dict

**Why single-ticker works with GroupNormalizer:**
The `TFTInferenceEngine` loads the training dataset at startup using ALL 28 tickers (full training CSV). This training dataset holds the GroupNormalizer's per-ticker scale parameters. When `TimeSeriesDataSet.from_dataset()` is called during inference, it looks up the requesting ticker's normalizer params from this template dataset. So running on one ticker at a time is fully supported.

**Trust levels registered in this file:**
```python
TRUST_LEVELS = {
    "PSO": "high", "PPL": "high", "ILP": "high", "POL": "high", "OGDC": "high",
    "FFC": "low", "EFERT": "low", "MEBL": "low", "ATRL": "low",
    # All others default to "medium"
}
```

---

### `api/services/llm_fusion_service.py` — LLM Reasoning

After TFT produces numbers, this service calls Groq (primary) or Gemini (fallback) to generate enriched reasoning. **TFT numbers are never changed.**

**What the LLM receives:**
```
- Ticker, company name, sector + sector context description
- TFT signal: action, expected return %, current price, target price, confidence, bull/bear days, trust level
- Fresh news: sentiment score, source, top headlines (max 5), sentiment reasoning
```

**What the LLM must return (structured JSON):**
```json
{
  "enhanced_reasoning": "2-4 sentence narrative combining TFT forecast with news context.",
  "confidence_adjustment": 0.02,       // [-0.05, +0.05] informational only
  "risk_factors": ["Rising input costs", "Regulatory headwinds"]
}
```

**Timeouts and fallback chain:**
```
Groq (8s timeout)
  └─ success → use result
  └─ timeout/failure → try Gemini (8s timeout)
      └─ success → use result
      └─ timeout/failure → degrade gracefully:
          llm_reasoning = base TFT reasoning (unchanged)
          llm_confidence_adjustment = 0.0
          risk_factors = []
```

---

### `api/services/data_service.py` — Data Freshness Gate

Handles the daily CSV update cycle:

1. **Freshness check:** `is_data_stale()` returns `True` if today's date (in PKT timezone) is not in master CSV AND it's a weekday (no PSX on weekends)
2. **Run updater:** Calls `technical_updater.py` as an async subprocess (`asyncio.create_subprocess_exec`)
3. **Merge rows:** Reads newly written rows from `data/processed/stocksense_tft_final.csv`, forward-fills any missing advanced columns from the last master CSV row, and appends to `data/final/tft_ready_clean.csv`
4. **Reload DataFrame:** Reloads master CSV into memory and propagates to `InferenceService`

**Why the two-CSV merge:** `technical_updater.py` was built before the TFT pipeline and writes to a different CSV path (`stocksense_tft_final.csv`). The DataService bridges this automatically.

**Threading:** Uses `asyncio.Lock()` to prevent concurrent update runs if two requests trigger the freshness check simultaneously.

---

### `api/services/cache_service.py` — TTL Cache

An in-memory dict cache with two expiry mechanisms:

| Mechanism | Description |
|-----------|-------------|
| **TTL** | Default 60 minutes. Configurable via `CACHE_TTL_MINUTES` env var. |
| **Midnight invalidation** | Each entry stores the PKT trading date. If today (PKT) differs from when the entry was cached, it's expired regardless of age. |

**Per-ticker lock:** Each ticker has its own `asyncio.Lock`. When two concurrent requests come in for the same ticker (e.g., two users requesting OGDC at the same second), only one runs inference — the second waits, then gets the cached result on its re-check.

---

### `api/models/schemas.py` — Response Types

All Pydantic v2 models used in API responses:

| Model | Used by |
|-------|---------|
| `SignalResponse` | `GET /signals/{ticker}` |
| `SignalListResponse` | `GET /signals/action/{action}` |
| `TickerListResponse` | `GET /tickers` |
| `HealthResponse` | `GET /health` |
| `RefreshResponse` | `POST /refresh/{ticker}` |
| `QuantileForecast` | Nested in `SignalResponse` |
| `SentimentSummary` | Nested in `SignalResponse` |
| `PriceRange` | Nested in `SignalResponse` |
| `ForecastDays` | Nested in `SignalResponse` |

---

### `api/routes/signals.py` — Main Endpoint

**`GET /signals/{ticker}`** — full inference pipeline per request:
1. Check cache → return immediately if hit
2. Acquire per-ticker `asyncio.Lock`
3. Re-check cache (double-checked locking pattern)
4. Call `_get_sentiment_sync(ticker)` in thread pool
5. Call `inference_svc.run_ticker_inference(ticker, sentiment)` in thread pool
6. Call `enhance_signal_with_llm(...)` with 12s timeout
7. Build full `SignalResponse` dict via `_build_response_dict()`
8. Store in cache, return response

**`GET /signals/action/{action}`** — reads cache only. Returns all cached tickers matching BUY/SELL/HOLD. This is designed for portfolio-view use cases where the frontend has already fetched individual tickers.

---

### `api/routes/health.py` — Health Check

`GET /health` returns:
- `status`: "ok" | "error"
- `model_loaded`: whether TFT engine is in memory
- `data_as_of`: latest date in master CSV
- `data_stale`: whether today's market data is missing
- `cache_entries`: number of valid cached signals
- `tickers_cached`: list of ticker symbols currently in cache
- `uptime_seconds`: seconds since API started
- `startup_time`: ISO8601 UTC

`POST /refresh/{ticker}` — invalidates a ticker's cache. Pass "ALL" to clear everything.

---

## 9. End-to-End Request Data Flow

```
Client: GET /signals/OGDC
            │
            ▼
        [CACHE HIT?] ──Yes──► Return cached SignalResponse (< 100ms)
            │ No
            ▼
        Acquire asyncio.Lock("OGDC")
            │
            ▼
        [RE-CHECK CACHE] ──Hit──► Return cached (concurrent request already ran inference)
            │ Miss
            ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 1: Sentiment Fetch (asyncio.to_thread)             │
        │  Gemini_Sentiment.get_sentiment("OGDC")                 │
        │  → Tavily: search "OGDC stock PSX news" (last 7 days)   │
        │  → Groq: analyze sentiment from headlines               │
        │  → returns: {score, confidence, headlines, reasoning}   │
        │  Duration: ~3-8s                                        │
        └─────────────────────┬───────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 2: TFT Inference (asyncio.to_thread)               │
        │  InferenceService.run_ticker_inference("OGDC", sent)    │
        │                                                         │
        │  a. Slice master_df → OGDC's last ~4300 rows            │
        │  b. Inject fresh sentiment into last row                │
        │     sentiment_score = 0.35 → recompute proxy/blended   │
        │  c. apply_preprocessing_pipeline() on OGDC slice        │
        │     remap_time_idx, fill_nans, clip to training range   │
        │  d. build_inference_window(ogdc_df)                     │
        │     → 120 historical rows + 7 future rows = 127 rows    │
        │  e. engine.predict_sliding_window(window)               │
        │     → TFT forward pass                                  │
        │     → raw_preds shape: (1, 7, 5)                        │
        │  f. denormalize → PKR prices, shape (7, 5)              │
        │  g. SignalGenerator → BUY/HOLD/SELL + reasoning         │
        │  Duration: ~5-15s on CPU                                │
        └─────────────────────┬───────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────────────────┐
        │ STEP 3: LLM Fusion (async, 12s timeout)                 │
        │  enhance_signal_with_llm(signal, sentiment, ...)        │
        │                                                         │
        │  Build prompt with:                                     │
        │    - TFT signal numbers (action, return%, prices)       │
        │    - Top 5 news headlines + sentiment reasoning         │
        │    - Sector context description                         │
        │    - Trust level instruction                            │
        │                                                         │
        │  Groq API call → JSON response:                         │
        │    enhanced_reasoning, confidence_adjustment, risks     │
        │                                                         │
        │  Fallback: Gemini if Groq fails                         │
        │  Duration: ~2-5s                                        │
        └─────────────────────┬───────────────────────────────────┘
                              │
                              ▼
        Build SignalResponse (Pydantic serialization)
            │
            ▼
        Store in cache (key: "OGDC", TTL: 60min, trading_date: today PKT)
            │
            ▼
        Return JSON response to client
        Total cold-path: ~10-28 seconds
        Subsequent requests: < 100ms
```

---

## 10. LLM Fusion

### Why fuse at all?

The TFT model is purely quantitative — it learned from historical price and technical data patterns. It has no awareness of:
- A company announcing bankruptcy today
- A government policy change affecting a sector
- Geopolitical events impacting commodity prices

The LLM fusion layer bridges this gap by incorporating real-time news context from the last 7 days into the reasoning narrative.

### What changes, what doesn't

| Field | Source | Can LLM change it? |
|-------|--------|-------------------|
| `action` | TFT | ❌ No |
| `confidence` | TFT | ❌ No |
| `expected_return_7d_pct` | TFT | ❌ No |
| `current_price` | Master CSV | ❌ No |
| `target_price_7d` | TFT | ❌ No |
| `price_forecast_7d` | TFT (q50) | ❌ No |
| `quantile_forecast_7d` | TFT | ❌ No |
| `reasoning` | TFT template | ❌ No (preserved as-is) |
| `llm_reasoning` | Groq/Gemini | ✅ Yes — enriched prose |
| `llm_confidence_adjustment` | Groq/Gemini | ✅ Yes — informational |
| `risk_factors` | Groq/Gemini | ✅ Yes — news-based risks |

### API Keys Used

| Key | Used for | Free Tier |
|-----|----------|-----------|
| `GROQ_API_KEY` | Groq Llama-3.3-70b (LLM fusion + sentiment analysis) | Free, generous limits |
| `GEMINI_API_KEY_1` | Gemini 2.0 Flash (LLM fusion fallback) | Free tier available |
| `GEMINI_API_KEY_2` | Gemini backup key | Free tier available |
| `TAVILY_API_KEY` | Web search for stock news | 1,000 free searches/month |

---

## 11. Signal Output Schema

Full JSON schema returned by `GET /signals/{ticker}`:

```json
{
  "ticker": "OGDC",
  "sector": "Energy",
  "company_name": "Oil & Gas Dev. Co.",

  "action": "BUY",
  "confidence": 0.68,
  "strength": 0.42,
  "expected_return_7d_pct": 5.2,
  "current_price": 148.50,
  "target_price_7d": 156.22,
  "price_range_7d": { "low": 144.80, "high": 165.40 },
  "forecast_days": { "bullish": 5, "bearish": 1, "neutral": 1 },
  "confidence_note": null,

  "price_forecast_7d": [149.2, 150.8, 152.3, 153.7, 154.9, 155.7, 156.2],
  "quantile_forecast_7d": {
    "q10": [144.1, 145.0, 145.8, 146.2, 146.5, 146.8, 144.8],
    "q25": [146.5, 147.8, 149.0, 149.8, 150.2, 151.0, 148.5],
    "q50": [149.2, 150.8, 152.3, 153.7, 154.9, 155.7, 156.2],
    "q75": [152.0, 153.8, 155.6, 157.2, 158.5, 160.0, 162.5],
    "q90": [154.8, 157.0, 159.2, 161.5, 163.0, 164.2, 165.4]
  },

  "reasoning": "TFT model forecasts +5.2% median upside over 7 days, with 5/7 bullish days. Forecast uncertainty: 3.1% (narrow, high confidence). Market sentiment is positive (blended: 0.35).",

  "llm_reasoning": "OGDC shows strong quantitative momentum with the TFT projecting 5.2% upside supported by 5/7 bullish forecast days. Recent news of rising global oil prices and OGDC's Q2 earnings beat reinforce the bullish case. The narrow confidence interval suggests the model has high conviction in this range.",
  "llm_confidence_adjustment": 0.03,
  "risk_factors": ["Oil price reversal on demand slowdown", "PKR strengthening dampening USD-linked revenue", "Regulatory changes in gas allocation"],

  "sentiment": {
    "score": 0.45,
    "confidence": 0.80,
    "source": "groq_tavily",
    "key_headlines": ["OGDC Q2 profits beat estimates by 12%", "OPEC+ extends production cuts"],
    "reasoning": "Strong earnings and supportive oil market backdrop."
  },

  "trust_level": "high",
  "trust_note": null,

  "tft_inference_timestamp": "2026-04-04T09:35:22.183742",
  "sentiment_fetched_at": "2026-04-04T09:35:14.442891",
  "cached": false,
  "data_as_of": "2026-04-03",
  "model_version": "v1"
}
```

---

## 12. Moving to Another Machine

### Files to transfer

| What | Where | Size |
|------|-------|------|
| Entire `StockSenseV1/` directory | Target machine | ~300 MB+ |
| Or at minimum: | | |
| `artifacts/artifactsv1/` | Keep path intact | ~120 MB |
| `data/final/tft_ready_clean.csv` | Keep path intact | ~57 MB |
| `data/processed/sentiment_daily.csv` | Keep path intact | ~50 KB |
| All Python source files | Keep paths intact | ~1 MB |
| `.env` file | Target machine | <1 KB |

> **Recommended**: Transfer the entire project directory and keep the same structure. The `data/inference/` folder accumulates daily JSON files — these are optional (API runs on-demand inference, not from JSON files).

### Setup on Target Machine

**Step 1 — Clone or copy the project:**
```bash
# Option A: Copy from dev machine (recommended to preserve all data)
# Zip the entire d:\StockSenseV1 and extract on target machine

# Option B: Clone from git (you'd need to manage large data files separately)
git clone <your-repo-url> StockSenseV1
```

**Step 2 — Set the project root:**
```bash
# Edit .env on the target machine — add this line:
STOCKSENSE_ROOT=C:\Users\username\StockSenseV1   # Windows
# or
STOCKSENSE_ROOT=/home/username/StockSenseV1      # Linux/Mac
```

**Step 3 — Create virtual environment & install dependencies:**
```bash
cd StockSenseV1

# Windows
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Step 4 — Copy `.env` from dev machine (or create fresh):**
```env
# .env contents on target machine
GEMINI_API_KEY_1=AIzaSy...
GEMINI_API_KEY_2=AIzaSy...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-dev-...

STOCKSENSE_ROOT=C:\path\to\StockSenseV1   # ← set this to actual path
API_HOST=0.0.0.0
API_PORT=8000
CACHE_TTL_MINUTES=60
LOG_LEVEL=INFO
```

**Step 5 — Start the API:**
```bash
# From the project root directory
cd StockSenseV1

# Windows
venv\Scripts\uvicorn api.main:app --host 0.0.0.0 --port 8000

# Linux/Mac
venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
```

**Step 6 — Verify it's running:**
```
http://localhost:8000/health        → should show model_loaded: true
http://localhost:8000/docs          → Swagger UI
http://localhost:8000/tickers       → list of 28 tickers
http://localhost:8000/signals/PSO   → full signal (takes ~15-25s first time)
```

### Calling the API from the Frontend

```javascript
// Example frontend fetch (Next.js / React)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function getSignal(ticker) {
  const res = await fetch(`${API_BASE}/signals/${ticker}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Health check
async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
```

**CORS:** The API allows all origins by default (`*`). To restrict to your frontend's domain in production, set:
```env
CORS_ORIGINS=https://yourfrontend.com
```

### Performance Notes for the Frontend

| Request type | Expected latency |
|-------------|-----------------|
| First request for a ticker (cache miss) | 15–28 seconds |
| Repeated request (cache hit) | < 100ms |
| After midnight (all caches expired) | First 5 tickers = slow, subsequent = fast |

**Frontend recommendation:** Show a loading spinner for up to 30 seconds on first load. Consider prefetching the 5 most-viewed tickers (PSO, OGDC, HBL, MCB, LUCK) when the user lands on the page.

---

## 13. GitHub Actions — Daily Automation

Run the daily pipeline automatically on a schedule. This keeps `tft_ready_clean.csv` and sentiment data fresh without manual intervention.

### GitHub Actions Workflow

Create `.github/workflows/daily_pipeline.yml`:

```yaml
name: StockSense Daily Pipeline

on:
  schedule:
    # Run Mon–Fri at 11:30 AM UTC = 4:30 PM PKT (after PSX 3:30 PM close + buffer)
    - cron: '30 11 * * 1-5'
  workflow_dispatch:  # Allow manual trigger from GitHub UI

jobs:
  daily-pipeline:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          lfs: false

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Cache pip dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Download latest master CSV
        # Pull the latest data file from your storage (GitHub Releases, S3, or Git LFS)
        # Option A: If using GitHub Releases for large files:
        run: |
          gh release download latest --pattern "tft_ready_clean.csv" --dir data/final/ || echo "No release found, using repo version"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run daily pipeline
        env:
          GEMINI_API_KEY_1: ${{ secrets.GEMINI_API_KEY_1 }}
          GEMINI_API_KEY_2: ${{ secrets.GEMINI_API_KEY_2 }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          TAVILY_API_KEY: ${{ secrets.TAVILY_API_KEY }}
        run: |
          python -m tft.daily_pipeline

      - name: Upload updated data files
        # Upload the refreshed CSV back to GitHub Releases (or S3, etc.)
        run: |
          DATE=$(date +%Y%m%d)
          gh release upload latest data/final/tft_ready_clean.csv --clobber || \
          gh release create "data-$DATE" data/final/tft_ready_clean.csv \
            --title "Data Update $DATE" \
            --notes "Automated daily data update"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload latest signals
        uses: actions/upload-artifact@v4
        with:
          name: signals-${{ github.run_id }}
          path: data/inference/signals_*.json
          retention-days: 30
```

### Setting Up GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Value |
|-------------|-------|
| `GEMINI_API_KEY_1` | Your Gemini API key 1 |
| `GEMINI_API_KEY_2` | Your Gemini API key 2 |
| `GROQ_API_KEY` | Your Groq API key |
| `TAVILY_API_KEY` | Your Tavily API key |

### Handling the 57MB CSV File

GitHub has a 100MB file size limit and recommends Git LFS for files over 50MB.

**Option A: Git LFS (recommended)**
```bash
git lfs install
git lfs track "*.csv"
git add .gitattributes
git add data/final/tft_ready_clean.csv
git commit -m "add large CSV via LFS"
```

**Option B: GitHub Releases**
Store the CSV as a release asset. The workflow above shows how to download/upload via `gh` CLI.

**Option C: Self-hosted runner**
Run the action on a machine that already has the data directory. No file transfer needed.

### Simpler Alternative: Windows Task Scheduler (Local)

If GitHub Actions is overkill, use Windows Task Scheduler to run the pipeline locally:

1. Open **Task Scheduler** → **Create Basic Task**
2. Name: "StockSense Daily Pipeline"
3. Trigger: **Daily**, 4:30 PM (after PSX close)
4. Action: **Start a program**
   - Program: `d:\StockSenseV1\venv\Scripts\python.exe`
   - Arguments: `-m tft.daily_pipeline`
   - Start in: `d:\StockSenseV1`

Or create a bat file `run_pipeline.bat`:
```bat
@echo off
cd /d d:\StockSenseV1
call venv\Scripts\activate
python -m tft.daily_pipeline
deactivate
```

---

## 14. API Keys & .env Reference

Full `.env` file reference:

```env
# ── Existing API Keys ─────────────────────────────────────────────────────────
GEMINI_API_KEY_1=AIzaSy...         # Google Gemini (primary) — get from console.cloud.google.com
GEMINI_API_KEY_2=AIzaSy...         # Google Gemini (backup)
GROQ_API_KEY=gsk_...               # Groq (Llama 3.3 70B) — get from console.groq.com (free)
TAVILY_API_KEY=tvly-dev-...        # Tavily Search — get from tavily.com (1000 free searches/month)

# ── API Server Settings ───────────────────────────────────────────────────────
STOCKSENSE_ROOT=d:\StockSenseV1    # ← REQUIRED on target machine if different path
API_HOST=0.0.0.0                   # bind address (0.0.0.0 = accessible from LAN)
API_PORT=8000                      # port
CACHE_TTL_MINUTES=60               # cache duration per ticker (default: 60 min)
CORS_ORIGINS=*                     # comma-separated allowed origins (* = all)
LOG_LEVEL=INFO                     # DEBUG, INFO, WARNING, ERROR

# ── Optional ──────────────────────────────────────────────────────────────────
API_SECRET_KEY=change-me           # reserved for future protected endpoints
```

### Getting Free API Keys

| Service | URL | Free Tier |
|---------|-----|-----------|
| Groq | https://console.groq.com | Free, ~14,400 requests/day on Llama-70B |
| Tavily | https://tavily.com | 1,000 searches/month free |
| Gemini | https://aistudio.google.com | Free tier with generous limits |

---

## 15. Troubleshooting

### API won't start — "Master CSV not found"
```
FileNotFoundError: Master CSV not found: data/final/tft_ready_clean.csv
```
**Fix:** Ensure `STOCKSENSE_ROOT` in `.env` points to the correct project root, and that `data/final/tft_ready_clean.csv` exists there.

### API won't start — "Checkpoint not found"
```
RuntimeError: Checkpoint not found: artifacts/artifactsv1/tft_model.ckpt
```
**Fix:** The model artifacts weren't transferred. Copy the entire `artifacts/artifactsv1/` folder to the target machine.

### Model loads but all signals are HOLD
**Cause:** The inference window doesn't have enough historical data (< 45 rows per ticker).
**Fix:** Ensure `tft_ready_clean.csv` contains at least 120 rows per ticker going back to before today.

### Sentiment returns `"source": "neutral"` for all tickers
**Cause:** Both Tavily and Gemini API calls are failing.
**Fix:** Check `.env` has valid API keys. Test manually:
```bash
python scrappers/Gemini_Sentiment.py --ticker OGDC
```

### `GET /signals/{ticker}` takes > 60 seconds
**Cause:** Running on CPU without PyTorch optimizations.
**Suggestions:**
- Use a machine with 8+ GB RAM for in-memory model
- Consider enabling `torch.set_num_threads(4)` in `main.py` startup
- Pre-warm the cache on startup by running inference for the 5 most popular tickers

### technical_updater.py shows "No new data" even though market was open
**Cause:** PSX website may be rate-limiting or temporarily down.
**Fix:** The API will serve the previous day's data (stale but functional). The updater will succeed on the next attempt.

### `data_stale: true` in `/health` response but it's a weekend
**Cause:** Timezone mismatch — the server timezone is different from PKT.
**Fix:** The `is_data_stale()` function uses `pytz.timezone("Asia/Karachi")` explicitly. Ensure `pytz` is installed (`pip install pytz`).

### LLM fusion produces no `llm_reasoning` (falls back to TFT reasoning)
**Cause:** Both Groq and Gemini timed out or returned invalid JSON.
**Fix:** This is the intended graceful degradation. The API still returns a valid signal — just without LLM enhancement. Check your `GROQ_API_KEY` is valid. LLM failures are logged at WARNING level.

---

## Quick Reference

### Start the API
```bash
cd d:\StockSenseV1
venv\Scripts\uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Run the daily pipeline manually
```bash
cd d:\StockSenseV1
python -m tft.daily_pipeline
```

### Test a single ticker's sentiment
```bash
python scrappers/Gemini_Sentiment.py --ticker PSO
```

### Bust the cache for a ticker
```bash
curl -X POST http://localhost:8000/refresh/OGDC
```

### Check API health
```bash
curl http://localhost:8000/health | python -m json.tool
```

### Available endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /signals/{ticker}` | On-demand signal for one ticker |
| `GET /signals/action/BUY` | All cached BUY signals |
| `GET /signals/action/SELL` | All cached SELL signals |
| `GET /signals/action/HOLD` | All cached HOLD signals |
| `GET /tickers` | All 28 active tickers + metadata |
| `GET /health` | API + model status |
| `POST /refresh/{ticker}` | Invalidate cache (or /refresh/ALL) |
| `GET /docs` | Swagger UI |
| `GET /redoc` | ReDoc UI |
