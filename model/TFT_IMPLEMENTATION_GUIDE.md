# StockSense TFT Implementation Guide

Complete step-by-step guide to train and deploy the state-of-the-art Temporal Fusion Transformer for KSE-30 Pakistan Stock Exchange.

---

## Overview

The implementation consists of **two phases**:

1. **Phase 1: Kaggle Training** — Train the TFT model on GPU (T4/P100)
2. **Phase 2: Local Inference** — Run daily predictions and generate signals

The architecture ensures **no training-inference skew** by centralizing all feature engineering in `tft/preprocessing.py`.

---

## Phase 1: Kaggle Training

### Step 1.1: Prepare Dataset for Kaggle

1. **Create Kaggle Dataset**
   - Go to [kaggle.com](https://kaggle.com)
   - Upload `data/final/tft_ready_clean.csv` as a Kaggle Dataset
   - Name it `kse30-tft` or similar
   - Make it **private** (optional, for your use only)

2. **Verify Dataset**
   - The CSV should have 44 columns and ~123K rows
   - Date range: 2008-01-01 to 2026-03-18
   - 30 tickers (OGDC, PPL, POL, LUCK, etc.)

### Step 1.2: Create Kaggle Notebook

1. **Go to Kaggle** → "New Notebook" → "Notebook"

2. **Upload your dataset**
   - Click "Add input" → select your `kse30-tft` dataset
   - It will be available at `/kaggle/input/kse30-tft/tft_ready_clean.csv`

3. **Copy notebook content**
   - Open `notebooks/tft_training_kaggle.ipynb` locally
   - Copy all cells into your Kaggle notebook

4. **Update dataset path** (if needed)
   ```python
   # In Cell 2, update this line to match your dataset name:
   df = pd.read_csv('/kaggle/input/kse30-tft/tft_ready_clean.csv')
   ```

### Step 1.3: Run Training on Kaggle

1. **Accelerator Settings**
   - Click the ⚙️ (settings) icon in top-right
   - Under "Accelerator", select **GPU** (T4 or P100 preferred)
   - Turn OFF internet (your dataset is already uploaded)

2. **Run Cells Sequentially**
   - Cell 1: Install packages (takes ~2-3 minutes for first run)
   - Cell 2-4: Data loading and preprocessing (fast)
   - Cell 5-6: Build datasets (fast)
   - Cell 7: Create DataLoaders and model (~1 minute)
   - Cell 8: **Train** (takes 15-30 minutes, monitor GPU usage)
   - Cell 9: Save artifacts (fast)
   - Cell 10: Test evaluation (2-5 minutes)

3. **Monitor Training**
   - Watch the training loss decrease
   - Validation loss should decrease initially, then plateau
   - If stuck, check for NaN loss (usually input scaling issue)
   - Early stopping will kick in after patience=7 epochs without improvement

### Step 1.4: Download Artifacts

After training completes:

1. **In Kaggle notebook output**
   - Click the "Output" panel (bottom-right)
   - You'll see these files:
     - `tft_model.ckpt` (50-150 MB)
     - `training_dataset.pkl` (5-20 MB)
     - `scaler_params.json` (< 1 MB)
     - `encoder_params.json` (< 1 MB)
     - `training_metadata.json` (< 1 MB)

2. **Download all 5 files**
   - Click each file's download icon
   - Save them to your local `artifacts/` directory

3. **Commit to Git**
   ```bash
   cd d:\StockSenseV1
   git add artifacts/
   git commit -m "Add trained TFT model artifacts from Kaggle"
   ```

---

## Phase 2: Local Inference & Deployment

### Step 2.1: Setup Local Environment

1. **Install dependencies**
   ```bash
   cd d:\StockSenseV1
   pip install -r requirements.txt
   ```

   If you encounter issues:
   ```bash
   pip install scikit-learn pandas numpy torch pytorch-lightning pytorch-forecasting==1.1.1
   ```

2. **Verify imports**
   ```bash
   python -c "from tft import config, preprocessing, inference, signals; print('✓ All imports successful')"
   ```

### Step 2.2: Verify Preprocessing (Unit Test)

```bash
python test_preprocessing.py
```

This will:
- Load the master CSV
- Apply preprocessing pipeline
- Validate time_idx continuity per ticker
- Check for missing required columns
- Build inference window for sample data

**Expected output:**
```
================================================================================
TFT PREPROCESSING TEST
================================================================================

1. Loading data/final/tft_ready_clean.csv
   Loaded 122948 rows, 30 tickers

2. Applying preprocessing pipeline
   ✓ Preprocessing complete

3. Validating preprocessing
   Total rows: 122948
   Unique tickers: 30
   Date range: 2008-01-02 00:00:00 to 2026-03-18 00:00:00
   time_idx valid: True

4. Checking required columns
   ✓ All 44 required columns present

5. Checking for NaNs in critical columns
   ✓ No NaNs in critical columns

6. Testing build_inference_window
   ✓ Window created: 3810 rows

7. Sample processed row (OGDC, most recent)
   Date: 2026-03-18
   Close: 148.50
   time_idx: 4576
   blended_sentiment: 0.234
   announcement_type: none

================================================================================
✓ ALL TESTS PASSED
================================================================================
```

### Step 2.3: Run Daily Inference

Once artifacts are in place:

```bash
python -m tft.daily_pipeline
```

This runs the **complete end-to-end pipeline**:

1. **STEP 1: Data Scrapers**
   - Runs `scrappers/technical_updater.py` to get latest OHLCV + technicals
   - Runs `scrappers/Gemini_Sentiment.py --all` for sentiment scores
   - Appends new rows to `data/final/tft_ready_clean.csv`

2. **STEP 2: Preprocessing**
   - Loads master CSV
   - Applies feature engineering pipeline
   - Validates data integrity

3. **STEP 3: TFT Inference**
   - Loads frozen model from `artifacts/tft_model.ckpt`
   - Builds inference window: last 90 days (encoder) + 7 future days (decoder)
   - Generates quantile predictions

4. **STEP 4: Signal Generation**
   - Computes BUY/HOLD/SELL for each ticker
   - Calculates confidence scores from quantile spread
   - Generates natural language reasoning

5. **STEP 5: Save Output**
   - Saves signals to `data/inference/signals_YYYYMMDD.json`
   - Prints summary to console

**Sample output:**
```
================================================================================
STOCKSENSE TFT DAILY INFERENCE PIPELINE
Started: 2026-03-27T15:30:45.123456
================================================================================

================================================================================
STEP 1: Running data scrapers to update master CSV
================================================================================

→ Running: Technical Updater
✓ Technical Updater completed successfully

→ Running: Sentiment Scraper
✓ Sentiment Scraper completed successfully

================================================================================
STEP 2: Loading and preprocessing data
================================================================================

→ Loading data/final/tft_ready_clean.csv
  Loaded 123000 rows, 30 tickers

→ Applying preprocessing pipeline
✓ Preprocessing validation:
  Total rows: 123000
  Unique tickers: 30
  Date range: 2008-01-02 to 2026-03-27
  time_idx valid: True

================================================================================
STEP 3: Running TFT inference
================================================================================

→ Initializing inference engine
→ Building inference window
  Window: 3810 rows
→ Running TFT predictions
  Predictions shape: (30, 5, 7)

================================================================================
STEP 4: Generating trading signals
================================================================================

→ Initializing signal generator
→ Generating signals
✓ Generated signals for 30 tickers

  Signal Summary:
    BUY:  6
    SELL: 4
    HOLD: 20

================================================================================
STEP 5: Saving signals
================================================================================

→ Saving to data/inference/signals_20260327.json
✓ Signals saved (30 tickers)

================================================================================
TRADING SIGNALS SUMMARY
================================================================================

Top 10 Signals (by confidence):
--------------------------------------------------------------------------------
Ticker   Action Conf   Return      Price       Target
--------------------------------------------------------------------------------
LUCK     BUY    0.78   +6.5%       875.32      931.50
OGDC     BUY    0.72   +5.2%       148.50      156.22
UBL      SELL   0.68   -4.1%       562.10      539.00
HBL      HOLD   0.45   +1.2%       145.60      147.35
...

🟢 BUY Signals (6):
  LUCK   → 931.50 (+6.5%) conf=0.78
  OGDC   → 156.22 (+5.2%) conf=0.72
  ...

🔴 SELL Signals (4):
  UBL    → 539.00 (-4.1%) conf=0.68
  ...

================================================================================
✓ PIPELINE COMPLETE
Signals saved to: data/inference/signals_20260327.json
================================================================================
```

### Step 2.4: Schedule Daily Runs (Optional)

**Using Windows Task Scheduler:**

1. **Create batch file** (`run_tft_daily.bat`):
   ```batch
   @echo off
   cd D:\StockSenseV1
   python -m tft.daily_pipeline >> logs/tft_daily.log 2>&1
   ```

2. **Create Task Scheduler job**:
   - Open "Task Scheduler"
   - "Create Basic Task"
   - Name: "TFT Daily Inference"
   - Trigger: Daily, 3:45 PM (after market close at 3:30 PM PKT)
   - Action: Start program → `C:\path\to\run_tft_daily.bat`

**Using Linux/Mac (cron)**:

```bash
# Add to crontab (daily at 3:45 PM PKT = 10:15 AM UTC)
45 10 * * 1-5 cd /path/to/StockSenseV1 && python -m tft.daily_pipeline >> logs/tft_daily.log 2>&1
```

---

## Understanding the Output: `signals_YYYYMMDD.json`

Each signal contains:

```json
{
  "ticker": "OGDC",
  "action": "BUY",
  "confidence": 0.72,
  "strength": 0.65,
  "expected_return_7d_pct": 5.2,
  "current_price": 148.50,
  "target_price_7d": 156.22,
  "price_range_7d": {
    "low": 145.20,
    "high": 163.40
  },
  "forecast_days": {
    "bullish": 6,
    "bearish": 0,
    "neutral": 1
  },
  "confidence_note": null,
  "reasoning": "TFT model forecasts +5.2% median upside over 7 days with 6/7 bullish forecast days. Forecast uncertainty: 3.1% price range (narrow, high confidence). Market sentiment is positive (blended score: 0.34).",
  "timestamp": "2026-03-27T15:30:52.123456"
}
```

**Field explanations:**
- **action**: BUY / SELL / HOLD
- **confidence**: 0-1 scale. Based on quantile spread + directional agreement
  - 0.55-0.65: moderate confidence
  - 0.65-0.75: good confidence
  - 0.75+: high confidence
- **strength**: 0-1 scale. How strong the conviction (how far return is from threshold)
- **expected_return_7d_pct**: Median forecast return over 7 days
- **price_range_7d**: 10th-90th percentile range (uncertainty bounds)
- **forecast_days**: How many of the 7 days favor each direction
- **reasoning**: Why the model made this prediction (sentiment + forecast direction)

---

## Troubleshooting

### Issue: Model checkpoint not found during inference
**Solution:**
1. Verify artifacts are in `artifacts/` directory
2. Check filenames match exactly (case-sensitive):
   - `tft_model.ckpt`
   - `training_dataset.pkl`
   - `scaler_params.json`
   - `encoder_params.json`
   - `training_metadata.json`

### Issue: CUDA out of memory during training
**Solution:**
- Reduce `batch_size` from 128 → 64 in Kaggle notebook Cell 4
- Reduce `hidden_size` from 128 → 64
- Kaggle T4 GPU has 16 GB; P100 has 16 GB

### Issue: time_idx validation fails
**Solution:**
- This means per-ticker `time_idx` is not contiguous
- The preprocessing remaps it correctly — if this fails, there's a gap in the data
- Check for PSX trading day gaps (holidays, suspensions)
- Set `allow_missing_timesteps=True` in TimeSeriesDataSet (already done)

### Issue: NaN predictions
**Solution:**
1. Check if scraper failed and old data is stale
2. Verify sentiment data merged correctly
3. Check for future rows with missing "known" features (should be forward-filled)

### Issue: All signals are HOLD
**Solution:**
1. Model may need more training data
2. Check if quantile forecasts are realistic (not all centered at current price)
3. Verify scaler_params.json is correct (compare with Kaggle metadata)

---

## Key Files & Their Purpose

```
tft/
├── config.py              # All constants, hyperparams, paths
├── preprocessing.py       # CENTRALIZED feature engineering (train + infer)
├── dataset.py             # TimeSeriesDataSet builders
├── inference.py           # Frozen model inference engine
├── signals.py             # Signal generation logic
└── daily_pipeline.py      # Daily orchestration entry point

artifacts/
├── tft_model.ckpt         # Trained model weights (from Kaggle)
├── training_dataset.pkl   # TimeSeriesDataSet template
├── scaler_params.json     # Per-ticker normalization (from Kaggle)
├── encoder_params.json    # Categorical encodings (from Kaggle)
└── training_metadata.json # Hyperparams & training config (from Kaggle)

data/
├── final/
│   └── tft_ready_clean.csv          # Master CSV (updated daily by scrapers)
├── inference/
│   └── signals_YYYYMMDD.json        # Daily signal output
└── processed/
    └── sentiment_daily.csv          # Daily sentiment (from scrapers)
```

---

## Architecture Summary

### Training (Kaggle)
```
tft_ready_clean.csv (44 features, 123K rows)
         ↓
    Apply preprocessing.py
         ↓
    TimeSeriesDataSet (per-ticker cumcount time_idx)
         ↓
    TFT model (encoder 90 days, decoder 7 days)
         ↓
    QuantileLoss training
         ↓
    Save: model.ckpt + artifacts (metadata, scaler, encoders, dataset template)
```

### Inference (Local Daily)
```
Scrapers: technical_updater.py + Gemini_Sentiment.py
         ↓
    tft_ready_clean.csv (updated)
         ↓
    Apply preprocessing.py (identically to training!)
         ↓
    build_inference_window() → 90-day encoder + 7-day decoder
         ↓
    Load frozen model.ckpt
         ↓
    TimeSeriesDataSet.from_dataset() → inference dataset
         ↓
    model.predict() → 5 quantiles × 7 days × 30 tickers
         ↓
    Denormalize → PKR prices
         ↓
    generate_signal() → BUY/HOLD/SELL + confidence + reasoning
         ↓
    signals_YYYYMMDD.json
```

---

## Next Steps

1. ✅ Code modules created (`tft/` package)
2. ✅ Kaggle notebook created (`notebooks/tft_training_kaggle.ipynb`)
3. 📋 **Upload dataset to Kaggle**
4. 📋 **Run training notebook on Kaggle GPU**
5. 📋 **Download artifacts to `artifacts/`**
6. 📋 **Run preprocessing test** (`python test_preprocessing.py`)
7. 📋 **Run daily inference** (`python -m tft.daily_pipeline`)
8. 📋 **Schedule daily runs** (Task Scheduler / cron)

---

## Support & Debugging

For detailed logs, enable debug logging in `daily_pipeline.py`:

```python
# At top of file
logging.basicConfig(level="DEBUG")  # Instead of "INFO"
```

This will show all preprocessing steps, prediction shapes, signal calculations.
