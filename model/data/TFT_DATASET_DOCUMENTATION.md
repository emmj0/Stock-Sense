# TFT Dataset Documentation

## Overview

**File:** `data/processed/tft_ready.csv`

This is a comprehensive time series dataset for training a **Temporal Fusion Transformer (TFT)** model to forecast stock prices on the Pakistan Stock Exchange (PSX). The dataset contains 18+ years of historical data with multi-scale features including technical indicators, sentiment signals, and macroeconomic context.

### Dataset Statistics

| Metric | Value |
|--------|-------|
| **Total Rows** | 122,948 |
| **Total Columns** | 43 |
| **Tickers** | 30 (KSE-30 Index) |
| **Sectors** | 12 |
| **Date Range** | 2008-01-01 to 2026-03-18 |
| **Time Period** | 18.2 years |
| **Memory** | ~70 MB |
| **Update Frequency** | Daily |

---

## Column Directory

### 1. Identifiers & Time Features (5 columns)

#### **Date** (`datetime`)
- Daily trading date (DD/MM/YYYY format)
- Range: 2008-01-01 to 2026-03-18
- **TFT Role:** Primary time index for sequence modeling

#### **Ticker** (`string`)
- Stock symbol (e.g., OGDC, PPL, MCB)
- Represents one of 30 KSE-30 index constituents
- **TFT Role:** Categorical identifier for multi-series prediction

#### **Sector** (`string`)
- Industry classification (Banking, Energy, Cement, Pharma, etc.)
- 12 unique sectors across KSE-30
- **TFT Role:** Optional categorical variable for sector-level embeddings

#### **time_idx** (`integer`)
- Sequential time index (1, 2, 3, ...)
- Used for training/validation/test splits
- **TFT Role:** Alternative time reference for encoder/decoder mechanism

#### **day_of_week**, **month** (`integer`)
- Day of week (1-7) and month (1-12)
- Captures seasonality and day-of-week effects
- **TFT Role:** Known future covariates (always available)

---

### 2. Price & Volume (8 columns)

#### **Open, High, Low, Close** (`float`)
- Daily OHLC prices in PKR (Pakistani Rupee)
- Source: PSX historical data (dps.psx.com.pk)
- **TFT Role:** Core target variable and input features
- **Notes:** High correlation; use for target only or feature engineering

#### **Volume** (`integer`)
- Daily trading volume (shares traded)
- Indicates liquidity and institutional participation
- **TFT Role:** Input feature; high volume = stronger signal
- **Use in TFT:** Include as auxiliary input variable

#### **market_index** (`float`)
- KSE-100 Index closing value
- Market-wide benchmark
- **TFT Role:** Exogenous covariate; provides market context

#### **USD_PKR** (`float`)
- USD to PKR exchange rate
- Affects import-dependent companies and oil pricing
- **TFT Role:** Exogenous covariate; critical for energy/import sectors

---

### 3. Technical Indicators (7 columns)

These are standard momentum and trend indicators calculated from price and volume data.

#### **sma_20, sma_50** (`float`)
- 20-day and 50-day Simple Moving Averages
- Derived from Close prices
- **TFT Role:** Trend-following features; help detect momentum shifts
- **Calculation:** `SMA_n = mean(Close[-n:])`
- **Use in TFT:** Help model learn trend-following patterns

#### **rsi_14** (`float`)
- Relative Strength Index (14-period)
- Range: 0-100; >70 = overbought, <30 = oversold
- **TFT Role:** Mean-reverting signal; oscillator indicator
- **Calculation:** `RSI = 100 - (100 / (1 + RS))` where RS = avg_gains / avg_losses
- **Use in TFT:** Detect reversal points

#### **vol_20** (`float`)
- 20-day rolling standard deviation of returns
- Measures price volatility (low values = stable, high values = risky)
- **TFT Role:** Risk/uncertainty metric
- **Calculation:** `std(pct_change(Close)[-20:])`
- **Use in TFT:** Volatility clustering detection

#### **price_direction** (`integer`)
- Sign of daily price change: -1, 0, or +1
- Indicates up/down/flat days
- **TFT Role:** Binary trend indicator
- **Calculation:** `sign(Close[t] - Close[t-1])`
- **Use in TFT:** Directional signal

---

### 4. Sentiment Features (7 columns)

Sentiment signals extracted from news articles and PSX announcements, processed through rule-based and ML models.

#### **sentiment_score** (`float`)
- Daily sentiment score from news/announcements
- Range: -1.0 to +1.0
- Negative values = bearish news, Positive = bullish news
- **Coverage:** ~14.8% of days (18,014 / 122,948)
- **Source:**
  - News: Tavily search API + Groq LLM sentiment scoring
  - Announcements: PSX official announcements with rule-based weights
- **TFT Role:** **Primary sentiment input**; directly represents market mood
- **Use in TFT:** Critical for capturing news-driven price movements

#### **sentiment_count** (`integer`)
- Number of articles/announcements on that day
- Higher count = more news coverage, more consensus
- **TFT Role:** Confidence/reliability weight for sentiment_score
- **Use in TFT:** Can be used to weight sentiment contribution

#### **sentiment_ma_5** (`float`)
- 5-day moving average of sentiment_score
- Smooths out daily noise; captures trend
- **Coverage:** 0.2% (mostly forward-filled)
- **TFT Role:** Smoothed sentiment trend
- **Use in TFT:** Long-term sentiment direction

#### **announcement_flag** (`binary: 0/1`)
- Whether an official PSX announcement occurred on that day
- Flags dividends, earnings, rights issues, board meetings, etc.
- **TFT Role:** Event indicator; captures corporate actions
- **Use in TFT:** Marks high-impact days

#### **announcement_type** (`string`)
- Category of announcement: dividend, earnings, rights, board, none
- **TFT Role:** Categorical feature for announcement-specific effects
- **Use in TFT:** Different announcement types have different impacts

#### **blended_sentiment** (`float`)
- Hybrid signal: Uses real sentiment_score when available; falls back to proxy_sentiment
- Range: -1.0 to +1.0
- **Coverage:** 100%
- **TFT Role:** **Complete sentiment coverage**; no missing values
- **Use in TFT:** Use as primary input when sentiment_score is sparse

#### **proxy_sentiment** (`float`)
- Sentiment inferred from technical indicators when news unavailable
- Weighted blend: 0.5×(RSI-based) + 0.3×(momentum) + 0.2×(volume)
- Range: -1.0 to +1.0
- **Coverage:** 100%
- **Calculation:**
  ```
  rsi_sentiment = (RSI - 50) / 50
  momentum_sentiment = (Close - SMA50) / SMA50
  volume_sentiment = log-normalized volume surge
  proxy = 0.5×rsi_sentiment + 0.3×momentum + 0.2×volume
  ```
- **TFT Role:** Fallback sentiment when news unavailable
- **Use in TFT:** Provides daily signal; captures market psychology from price action

---

### 5. Volume Analysis (5 columns)

Features capturing volume patterns and institutional activity.

#### **volume_ma_20** (`float`)
- 20-day moving average of trading volume
- Baseline volume for the stock
- **Calculation:** `mean(Volume[-20:])`
- **TFT Role:** Normalizing factor for volume comparisons
- **Use in TFT:** Helps identify volume spikes relative to normal

#### **volume_ratio** (`float`)
- Ratio of current volume to 20-day average
- >1 = above-average volume, <1 = below-average
- **Calculation:** `Volume / volume_ma_20`
- **TFT Role:** Volume surge indicator
- **Use in TFT:** Detects institutional accumulation/distribution

#### **volume_trend** (`float`)
- Normalized volume deviation from moving average
- Range: -2 to +2 (clipped extremes)
- **Calculation:** `(Volume - volume_ma_20) / volume_ma_20`
- **TFT Role:** Volume momentum
- **Use in TFT:** Confirms price moves (high volume = more reliable)

#### **volume_signal** (`float`)
- Log-normalized volume surge
- Range: -1 to +1 (normalized)
- **Calculation:** `log(volume_ratio) / 2.3`
- **TFT Role:** Non-linear volume transformation
- **Use in TFT:** Captures volume spikes exponentially

#### **obv_signal** (`float`)
- On-Balance Volume concept: volume × price direction
- Measures accumulation/distribution pressure
- **TFT Role:** Institutional flow indicator
- **Use in TFT:** Detects whether volume confirms or diverges from price

#### **vpt** (`float`)
- Volume-Price Trend (20-day rolling)
- Cumulative indicator: volume × price change
- **TFT Role:** Momentum confirmation
- **Use in TFT:** Long-term volume-price relationship

---

### 6. Macro & Market Context (5 columns)

External factors affecting the entire market and sector-specific drivers.

#### **oil_price** (`float`)
- Crude oil price (US$/barrel) - WTI futures
- **Source:** yfinance (CL=F contract)
- **Relevance:** PSX Energy sector (OGDC, PPL, PSO) highly sensitive to oil
- **TFT Role:** **Sector-specific exogenous variable**
- **Use in TFT:** Include for energy stocks; neutral for others

#### **fx_volatility** (`float`)
- USD/PKR exchange rate volatility
- Measured as rolling standard deviation of daily changes
- **Calculation:** `std(pct_change(USD_PKR)[-20:]) / mean(USD_PKR)`
- **Relevance:** Pakistan imports heavily; FX volatility affects costs
- **TFT Role:** **Macroeconomic uncertainty indicator**
- **Use in TFT:** Especially important for import-dependent sectors

#### **market_volatility** (`float`)
- KSE-100 Index volatility (market-wide risk)
- **Calculation:** `std(pct_change(market_index)[-20:])`
- **TFT Role:** **Market regime indicator**
- **Use in TFT:** High volatility = increased systematic risk

#### **inflation_proxy** (`float`)
- PKR depreciation trend (proxy for inflation)
- 90-day rolling average of USD/PKR change
- **Calculation:** `mean(pct_change(USD_PKR)[-90:])`
- **TFT Role:** **Inflation signal; affects purchasing power & costs**
- **Use in TFT:** Central bank policy expectations

#### **market_momentum** (`float`)
- KSE-100 rate of change (market trend)
- 20-day rolling average of market returns
- **Calculation:** `mean(pct_change(market_index)[-20:])`
- **TFT Role:** **Market regime: bull vs bear**
- **Use in TFT:** Captures market-wide momentum

---

### 7. Composite Derived Features (6 columns)

Advanced engineered features combining multiple signals for enhanced signal quality.

#### **momentum_signal** (`float`)
- Price momentum: (Close - SMA50) / SMA50
- Range: -1 to +1 (clipped)
- **TFT Role:** Trend strength indicator
- **Calculation:** `(Close - sma_50) / sma_50`
- **Use in TFT:** Detect trend continuation/reversal

#### **rsi_sentiment** (`float`)
- RSI-based sentiment: (RSI - 50) / 50
- Range: -1 to +1
- **Interpretation:** RSI > 50 = uptrend, < 50 = downtrend
- **TFT Role:** Oscillator-based sentiment
- **Use in TFT:** Mean-reversion signal

#### **market_strength** (`float`)
- Composite market signal: 40% market_momentum + 40% market_volatility_norm + 20% market return trend
- **TFT Role:** Overall market health indicator
- **Use in TFT:** Systemic risk and opportunity capture

#### **fx_risk** (`float`)
- Composite FX uncertainty: 60% USD/PKR trend + 40% fx_volatility
- **TFT Role:** Currency risk exposure
- **Use in TFT:** Important for multinational companies and importers

#### **relative_momentum** (`float`)
- Stock momentum vs market momentum
- **Calculation:** `momentum_signal - (market_momentum / 2)`
- **TFT Role:** Alpha capture (outperformance)
- **Use in TFT:** Relative strength; pick winners vs losers

#### **sentiment_quality** (`float`)
- Comprehensive signal quality: 40% blended_sentiment + 30% relative_momentum - 20% fx_risk + 10% volume_trend
- **TFT Role:** **Final decision signal; combines all inputs**
- **Use in TFT:** Can be used as auxiliary target or validation metric

---

## Data Sources & Processing

### Original OHLCV Data
- **Source:** Pakistan Stock Exchange (PSX) - `dps.psx.com.pk`
- **Collection:** Web scraping from PSX historical data portal
- **Update Frequency:** Daily (market hours 10 AM - 3 PM PKT)
- **Rows:** 123,586 initial rows × 8 columns (Date, Ticker, Open, High, Low, Close, Volume, market_index)

### Technical Indicators
- **Calculation:** On-the-fly computation using pandas rolling windows
- **Dependencies:** Requires price and volume data
- **Recomputation:** Daily for new data

### Sentiment Data
- **News Articles Source:**
  - Tavily Search API (real-time news)
  - Query: "{Ticker_name} stock" + sector keywords
  - Coverage: Last 7 days (limited by Tavily)
  - Processing: Groq LLM sentiment classification (-1 to +1)

- **Announcements Source:**
  - PSX Official: `dps.psx.com.pk/announcements`
  - Types: Dividends, Earnings, Rights Issues, Board Meetings
  - Scoring: Rule-based weights (dividend: +0.6, earnings: varies, board: 0.0)
  - Historical Coverage: 2005-present (16,687 announcements)

### Macro Indicators
- **Oil Prices:** yfinance (CL=F WTI crude futures)
- **FX (USD/PKR):** PSX market data + State Bank of Pakistan (SBP)
- **KSE-100 Index:** PSX historical quotes
- **Volatility Calculations:** 20/90-day rolling statistics

### Enhancement Process
| Phase | Features Added | Method |
|-------|---|---|
| **Original** | 8 | OHLCV prices + market index |
| **Phase 1A** | +5 | Proxy sentiment from technicals (RSI, momentum, volume) |
| **Phase 1B** | +5 | Volume analysis (MA, trend, OBV, VPT) |
| **Phase 2** | +5 | Macro indicators (oil, FX, volatility, inflation, momentum) |
| **Phase 3** | +7 | Composite features (market_strength, fx_risk, sentiment_quality, etc.) |
| **Sentiment** | +7 | News + announcement scoring + blending |
| **Final** | **43** | All features combined |

---

## Improvements Over Basic OHLCV

### What Changed

| Aspect | Before | After | Benefit |
|--------|--------|-------|---------|
| **Features** | 8 | 43 | 5.4× richer signal |
| **Sentiment** | None | 7 columns | Captures news-driven moves |
| **Volume Signals** | 1 (raw) | 6 | Detects institutional activity |
| **Technical** | None | 7 (RSI, SMA, etc.) | Trend and momentum detection |
| **Macro Context** | 2 (index, FX) | 7 total | Oil, volatility, inflation awareness |
| **Derived Signals** | 0 | 6 composites | Integrated multi-signal decision |
| **Missing Values** | N/A | Near 0% | 100% coverage via proxies |

### Why TFT Benefits

1. **Multi-Scale Temporal Patterns**
   - Technical indicators (fast: daily RSI swings)
   - Sentiment MA (medium: weekly trends)
   - Market momentum (slow: month-long shifts)
   - TFT encoder naturally learns these scales

2. **Richer Feature Interactions**
   - Example: High volume + Positive sentiment + Rising RSI = strong buy signal
   - TFT variable selection mechanism learns these combos
   - Reduces need for hand-crafted trading rules

3. **Exogenous Variables**
   - Oil price, FX volatility, market momentum are known external drivers
   - TFT's exogenous variable handling optimizes for them
   - Better generalization to out-of-sample market regimes

4. **Handling Sparse Signals**
   - Sentiment only available ~15% of time
   - `blended_sentiment` fills gaps with proxy_sentiment (100% coverage)
   - TFT can learn when to trust news vs. technical proxies

5. **Composite Indicators**
   - `sentiment_quality`: Final integrated signal
   - Replaces need for manual signal weighing
   - TFT learns optimal feature importance automatically

---

## Usage in TFT Architecture

### Recommended Input Structure

```
Encoder Inputs (past 92 days):
├── Target Variable: Close price (t-92 to t)
├── Past Covariates:
│   ├── OHLCV (Open, High, Low, Close, Volume)
│   ├── Technicals (RSI, SMA, volatility)
│   └── Sentiment (blended_sentiment, sentiment_score, proxy_sentiment)
└── Static Covariates: Ticker, Sector

Known Future Inputs (next 7 days):
├── Day-of-week, Month
├── Macro indicators: oil_price, market_momentum, market_volatility
└── FX rate (USD_PKR)

Decoder Outputs (predict next 7 days):
├── Close price (t+1 to t+7)
└── Confidence (from attention)
```

### Feature Selection Tips for TFT

**Keep All Of:**
- OHLCV (core market data)
- Technical indicators (RSI, SMA, volatility)
- Day-of-week, month (seasonality)
- market_index, USD_PKR (systemic risk)

**Use Conditionally:**
- **sentiment_score**: Add if you have attention head for sparse data
- **blended_sentiment**: Always use (100% coverage)
- **announcement_flag**: Helps TFT learn event impacts
- **oil_price**: Essential for energy stocks; optional for others

**Engineered Features (Optional):**
- **sentiment_quality, fx_risk, market_strength**: Can be targets themselves
- Or use as auxiliary outputs for multi-task learning

---

## Data Quality Notes

### Completeness
- **OHLCV:** 100% (all trading days)
- **Technical indicators:** 100% (computed for all rows)
- **Sentiment:** 14.8% (limited by news availability)
- **Macro:** 99.8% (some FX data gaps filled)
- **Blended sentiment:** 100% (fills gaps with proxy)

### Known Limitations
1. **Sentiment lag:** News processed with 1-day delay
2. **Oil prices:** Not updated on market holidays
3. **Announcement types:** "board" announcements have low impact (neutral scoring)
4. **Volume:** Some stocks have low liquidity on certain days

### Validation Strategy
- **Train:** 2008-2023 (70%)
- **Validation:** 2024 (15%)
- **Test:** 2025-2026 (15%)
- Use time-series split (no future peeking)

---

## Next Steps for TFT Training

1. **Standardize features** (0-mean, 1-std for each ticker)
2. **Create sequences** (e.g., 92-day lookback, 7-day prediction)
3. **Configure TFT:**
   ```python
   model = TemporalFusionTransformer(
       input_size=43,  # All features
       output_size=1,  # Close price prediction
       hidden_size=128,
       n_heads=4,
       dropout=0.2,
       max_seq_len=92
   )
   ```
4. **Train on PSX data** with early stopping on validation set
5. **Evaluate with:**
   - MAE (Mean Absolute Error)
   - MAPE (Mean Absolute Percentage Error)
   - Directional Accuracy (up/down prediction)

---

## Column Summary Table

| # | Column | Type | Coverage | Source | TFT Role |
|---|--------|------|----------|--------|----------|
| 1 | Date | DateTime | 100% | PSX | Time index |
| 2 | Ticker | String | 100% | PSX | Series ID |
| 3 | Sector | String | 100% | PSX | Static feature |
| 4-7 | OHLC | Float | 100% | PSX | Target + input |
| 8 | Volume | Int | 100% | PSX | Input feature |
| 9 | market_index | Float | 100% | PSX | Exogenous |
| 10 | USD_PKR | Float | 100% | PSX | Exogenous |
| 11-12 | day_of_week, month | Int | 100% | Computed | Known future |
| 13-16 | sma_20, sma_50, rsi_14, vol_20 | Float | 100% | Computed | Technical |
| 17 | time_idx | Int | 100% | Computed | Alt. time ref |
| 18 | sentiment_ma_5 | Float | 0.2% | Computed | Sparse trend |
| 19 | days_since_announcement | Int | 100% | Computed | Event distance |
| 20-25 | Sentiment signals | Float | 14.8%-100% | News/Announcements | Decision signal |
| 26-30 | Volume analysis | Float | 100% | Computed | Institutional signal |
| 31-35 | Macro indicators | Float | 99.8% | External | Market context |
| 36-39 | Composite features | Float | 100% | Computed | Integrated signal |
| 40-43 | Announcement flags | Mixed | 100% | PSX | Event markers |

---

**Generated:** 2026-03-27
**Dataset Version:** v2 (with sentiment & macro)
**Maintenance:** Daily updates via `pipeline.py` and `technical_updater.py`
