# StockSense V1 — Context File for FastAPI Integration

## What This Project Is

StockSense is a Pakistan stock market forecasting system for KSE-30 stocks.
It uses a trained **Temporal Fusion Transformer (TFT)** to produce 7-day price forecasts
with BUY/HOLD/SELL signals, confidence scores, and reasoning — for 28 active tickers.

The full inference pipeline (scrapers → TFT inference → signals) runs daily after market close.
The **next step is building a FastAPI backend** so a frontend can consume these signals.

---

## Project Root

```
d:\StockSenseV1\
```

---

## What Is Already Built and Working

### 1. Trained TFT Model (`artifacts/artifactsv1/`)
- **Architecture**: hidden_size=128, lstm_layers=2, attention_head_size=4, dropout=0.15, hidden_continuous_size=32
- **Encoder length**: 90 days lookback | **Prediction horizon**: 7 days
- **Tickers**: 30 trained (28 active — ENGRO and SHEL removed from KSE-30, skipped in inference)
- **Test performance**: MAPE 12.99%, Directional Accuracy 70.6%, 80% CI Coverage 52.2%
- **Best tickers**: PSO (2.73% MAPE), PPL (3.12%), ILP (3.17%), POL (3.25%), OGDC (3.62%)
- **Weak tickers**: FFC (56.7%), EFERT (43.8%), MEBL (36.2%) — fertilizer/small bank regime changes
- v2 and v3 were evaluated and found **worse** than v1 — stick with v1

### 2. Daily Inference Pipeline (`tft/daily_pipeline.py`)
Runs end-to-end:
1. Calls `scrappers/technical_updater.py` → updates `data/final/tft_ready_clean.csv` with new OHLCV + technicals
2. Calls `scrappers/Gemini_Sentiment.py --all` → updates `data/processed/sentiment_daily.csv`
3. Loads + preprocesses master CSV, merges sentiment
4. Runs TFT inference (28 tickers × 7 days × 5 quantiles)
5. Generates BUY/HOLD/SELL signals
6. Saves to `data/inference/signals_YYYYMMDD.json`

Run with:
```bash
cd d:\StockSenseV1
python -m tft.daily_pipeline
```

### 3. TFT Module (`tft/`)
```
tft/
├── config.py          # All paths, hyperparams, feature lists, KSE30_STOCKS (28 tickers)
├── preprocessing.py   # Feature engineering pipeline (ffill NaNs, proxy_sentiment, blended_sentiment)
├── dataset.py         # TimeSeriesDataSet builder + inference NaN fill
├── inference.py       # TFTInferenceEngine — loads model, builds training dataset, runs predict()
├── signals.py         # BUY/HOLD/SELL logic + confidence + deterministic reasoning
└── daily_pipeline.py  # Daily orchestration
```

### 4. Signal Output Format
Each run saves `data/inference/signals_YYYYMMDD.json` — array of 28 signal objects:

```json
{
  "ticker": "PAEL",
  "action": "BUY",
  "confidence": 0.60,
  "strength": 0.37,
  "expected_return_7d_pct": 9.8,
  "current_price": 35.88,
  "target_price_7d": 39.42,
  "price_range_7d": { "low": 34.10, "high": 45.20 },
  "forecast_days": { "bullish": 5, "bearish": 1, "neutral": 1 },
  "confidence_note": null,
  "reasoning": "TFT model forecasts +9.8% median upside over 7 days, with 5/7 days showing bullish directional consensus. Forecast uncertainty: 4.2% price range (moderate). Market sentiment is neutral (blended score: 0.10).",
  "timestamp": "2026-04-03T19:49:35.070437"
}
```

### 5. Most Recent Signals (2026-04-03, 28 tickers)
```
BUY:  PAEL  +9.8%  conf=0.60
SELL: FFC -63.8%, EFERT -43.4%, MCB -5.4%, HUBC -16.4%, POL -3.8%,
      UBL -14.4%, MEBL -56.3%, CHCC -8.9%, ATRL -31.6%, FABL -39.3%,
      BAHL -24.3%, BAFL -26.7%
HOLD: 15 others
```
> Note: FFC/EFERT/MEBL/ATRL extreme SELL signals are model artifacts from volatile training history — flag these with low trust in the UI.

---

## Data Files

| File | Description |
|------|-------------|
| `data/final/tft_ready_clean.csv` | Master OHLCV + technicals + sentiment, 123K rows, 30 tickers, 2008–2026-03-27 |
| `data/processed/sentiment_daily.csv` | Daily scraped sentiment, 120 rows, all 30 tickers, latest 2026-03-28 |
| `data/inference/signals_YYYYMMDD.json` | Daily signal output (one file per day) |
| `data/inference/eval_results.csv` | Per-window test set predictions (v1 evaluation) |
| `artifacts/artifactsv1/` | **Active model artifacts** — tft_model.ckpt, encoder_params.json, scaler_params.json, training_metadata.json |

---

## Key Technical Details for API Dev

### Dependencies (already installed in venv)
```
pytorch-forecasting==1.1.1
pytorch-lightning>=2.2.0
torch>=2.2.0
pandas, numpy, scikit-learn, requests, etc.
```

### Model Loading (how inference.py works)
- Does NOT use `training_dataset.pkl` (version incompatible) — rebuilds TimeSeriesDataSet from master CSV
- Loads checkpoint via `torch.load` + `TemporalFusionTransformer.from_dataset` + `load_state_dict`
- Inference takes ~5-10 seconds on CPU for 28 tickers
- `TFTInferenceEngine` is the main class to import

### Active Tickers (28)
```python
KSE30_STOCKS = [
    "ATRL", "BAFL", "BAHL", "CHCC", "DGKC", "EFERT", "FABL",
    "FCCL", "FFC", "HBL", "HUBC", "ILP", "INIL", "LUCK", "MCB",
    "MEBL", "MLCF", "NBP", "OGDC", "PAEL", "POL", "PPL", "PRL",
    "PSO", "SEARL", "SYS", "TGL", "UBL"
]
# ENGRO and SHEL excluded — removed from KSE-30 index, data stale
```

### Sectors
```python
{
    "ATRL": "Refinery", "BAFL": "Banking", "BAHL": "Banking", "CHCC": "Cement",
    "DGKC": "Cement", "EFERT": "Fertilizer", "FABL": "Banking", "FCCL": "Cement",
    "FFC": "Fertilizer", "HBL": "Banking", "HUBC": "Power", "ILP": "OMC",
    "INIL": "Glass", "LUCK": "Cement", "MCB": "Banking", "MEBL": "Banking",
    "MLCF": "Cement", "NBP": "Banking", "OGDC": "Energy", "PAEL": "Engineering",
    "POL": "Energy", "PPL": "Energy", "PRL": "Refinery", "PSO": "OMC",
    "SEARL": "Pharma", "SYS": "Tech", "TGL": "Glass", "UBL": "Banking"
}
```

---

## What Needs to Be Built: FastAPI Backend

### Proposed API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/signals` | All 28 tickers' latest signals (sorted by confidence) |
| GET | `/signals/{ticker}` | Single ticker signal + 7-day price forecast array |
| GET | `/signals/action/{action}` | Filter by BUY / SELL / HOLD |
| GET | `/tickers` | List all active tickers with sector |
| GET | `/health` | Pipeline status, last run date, model version |
| POST | `/pipeline/run` | (Optional / protected) Trigger full scrape + inference |

### Response Design Notes
- Signals come from `data/inference/signals_YYYYMMDD.json` (read from disk, no DB needed initially)
- API should serve the **most recent** signals file automatically
- Include `generated_at` (file date) and `model_version` ("v1") in response envelope
- For `/signals/{ticker}`, also include the 7-day price forecast array (currently stored per quantile — extract median = q50 = index 2)
- Consider adding a `trust_level` field: "low" for FFC/EFERT/MEBL/ATRL (MAPE > 20%), "medium" for 10-20%, "high" for < 10%

### Suggested File Structure to Create
```
api/
├── main.py           # FastAPI app, router registration
├── routes/
│   ├── signals.py    # /signals endpoints
│   ├── tickers.py    # /tickers endpoint
│   └── health.py     # /health endpoint
├── models/
│   └── schemas.py    # Pydantic response models
└── services/
    └── signal_loader.py  # Load latest signals JSON, parse, cache
```

### Important: Do NOT run inference on every API request
- Inference is slow (~5-10s) and runs once daily via `daily_pipeline.py`
- API should only **read** the pre-generated `signals_YYYYMMDD.json` files
- Optionally cache in memory with a TTL

---

## Known Issues / Decisions Already Made

| Issue | Decision |
|-------|----------|
| ENGRO/SHEL stale data | Skipped in KSE30_STOCKS — model still has them trained but they don't generate signals |
| FFC/EFERT extreme predictions | Model artifact — flag with `trust_level: "low"` in API, don't filter them out |
| v2/v3 model worse than v1 | Use v1 artifacts (`artifacts/artifactsv1/`) |
| training_dataset.pkl not loadable | inference.py rebuilds TimeSeriesDataSet from CSV instead |
| Unicode emoji error on Windows console | print_signals_summary uses ASCII [BUY]/[SELL] not emoji |
| Sentiment merge was broken | Fixed — daily_pipeline now loads sentiment_daily.csv and passes to build_inference_window |

---

## How to Start the Next Session

1. Open `d:\StockSenseV1\` as the workspace
2. Read this file
3. Read `tft/config.py` for paths and ticker list
4. Read `data/inference/signals_20260403.json` for the current signal format
5. Plan the FastAPI app structure, then build it
