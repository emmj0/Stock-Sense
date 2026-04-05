"""
TFT Model Configuration and Hyperparameters
"""

import os
from pathlib import Path

# ============================================================================
# PATHS
# ============================================================================

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_FINAL_DIR = DATA_DIR / "final"
DATA_PROCESSED_DIR = DATA_DIR / "processed"
DATA_INFERENCE_DIR = DATA_DIR / "inference"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts/artifactsv1"

MASTER_CSV = DATA_FINAL_DIR / "tft_ready_clean.csv"
SENTIMENT_DAILY_CSV = DATA_PROCESSED_DIR / "sentiment_daily.csv"
LATEST_WINDOW_CSV = DATA_INFERENCE_DIR / "latest_window.csv"
SIGNALS_OUTPUT_DIR = DATA_INFERENCE_DIR

# Create directories if they don't exist
for d in [DATA_INFERENCE_DIR, ARTIFACTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ============================================================================
# KSE-30 STOCKS & SECTORS
# ============================================================================

KSE30_STOCKS = [
    "ATRL", "BAFL", "BAHL", "CHCC", "DGKC", "EFERT", "FABL",
    "FCCL", "FFC", "HBL", "HUBC", "ILP", "INIL", "LUCK", "MCB",
    "MEBL", "MLCF", "NBP", "OGDC", "PAEL", "POL", "PPL", "PRL",
    "PSO", "SEARL", "SYS", "TGL", "UBL"
]
# ENGRO and SHEL removed from KSE-30 index — data is stale, skipped in inference

SECTOR_MAP = {
    "ATRL": "Refinery", "BAFL": "Banking", "BAHL": "Banking", "CHCC": "Cement",
    "DGKC": "Cement", "EFERT": "Fertilizer", "ENGRO": "Fertilizer", "FABL": "Banking",
    "FCCL": "Cement", "FFC": "Fertilizer", "HBL": "Banking", "HUBC": "Power",
    "ILP": "OMC", "INIL": "Glass", "LUCK": "Cement", "MCB": "Banking",
    "MEBL": "Banking", "MLCF": "Cement", "NBP": "Banking", "OGDC": "Energy",
    "PAEL": "Engineering", "POL": "Energy", "PPL": "Energy", "PRL": "Refinery",
    "PSO": "OMC", "SEARL": "Pharma", "SHEL": "OMC", "SYS": "Tech",
    "TGL": "Glass", "UBL": "Banking"
}

# ============================================================================
# TFT ARCHITECTURE HYPERPARAMETERS
# ============================================================================

TFT_HYPERPARAMS = {
    # Sequence lengths
    "max_encoder_length": 90,          # ~4.5 months lookback
    "max_prediction_length": 7,         # 7-day multi-horizon forecast

    # Architecture
    "hidden_size": 128,                 # Main hidden layer size
    "lstm_layers": 2,                   # Stacked LSTM encoder/decoder
    "attention_head_size": 4,           # Multi-head temporal self-attention
    "dropout": 0.15,                    # Dropout regularization
    "hidden_continuous_size": 32,       # Continuous variable embedding

    # Loss and output
    "quantiles": [0.1, 0.25, 0.5, 0.75, 0.9],  # 5 quantile outputs
    "output_size": 5,                   # Matches number of quantiles

    # Optimization
    "learning_rate": 3e-4,              # Adam LR with ReduceLROnPlateau
    "optimizer": "adam",
    "gradient_clip_val": 0.5,           # Clip gradients

    # Training
    "batch_size": 128,                  # Optimal for T4/P100 GPU
    "max_epochs": 50,
    "patience": 7,                      # Early stopping patience
    "reduce_lr_patience": 4,            # ReduceLROnPlateau patience

    # Normalization
    "target_normalizer_type": "GroupNormalizer",  # Per-ticker normalization
    "target_normalizer_transformation": "softplus",
}

# ============================================================================
# FEATURE ROLES
# ============================================================================

STATIC_CATEGORICALS = ["Ticker", "Sector"]

TIME_VARYING_KNOWN_CATEGORICALS = ["announcement_type"]

TIME_VARYING_KNOWN_REALS = [
    "day_of_week", "month", "oil_price", "USD_PKR",
    "market_index", "market_momentum", "market_volatility",
    "market_strength", "inflation_proxy", "fx_volatility",
    "fx_risk", "announcement_flag"
]

TIME_VARYING_UNKNOWN_REALS = [
    "Close",  # TARGET (also fed as input)
    "Open", "High", "Low", "Volume",
    "sma_20", "sma_50", "rsi_14", "vol_20",
    "volume_ma_20", "volume_ratio", "volume_trend", "volume_signal",
    "obv_signal", "vpt", "price_direction",
    "rsi_sentiment", "momentum_signal",
    "proxy_sentiment", "blended_sentiment",
    "sentiment_score", "sentiment_count", "sentiment_ma_5",
    "days_since_announcement", "relative_momentum", "sentiment_quality"
]

# All continuous features (for clipping and scaling)
ALL_CONTINUOUS_FEATURES = TIME_VARYING_KNOWN_REALS + TIME_VARYING_UNKNOWN_REALS

# ============================================================================
# DATA SPLIT (by date)
# ============================================================================

TRAIN_START_DATE = "2008-01-01"
TRAIN_END_DATE = "2023-12-31"
VALIDATION_START_DATE = "2024-01-01"
VALIDATION_END_DATE = "2024-12-31"
TEST_START_DATE = "2025-01-01"
# TEST_END_DATE is today's date

# ============================================================================
# SIGNAL GENERATION THRESHOLDS
# ============================================================================

SIGNAL_THRESHOLDS = {
    "BUY": {
        "min_return": 0.03,          # 3% median upside
        "min_confidence": 0.55,
        "min_bull_days": 4,          # 4 out of 7 bullish days
    },
    "SELL": {
        "max_return": -0.03,         # -3% median downside
        "min_confidence": 0.55,
        "min_bear_days": 4,          # 4 out of 7 bearish days
    },
}

SENTIMENT_MODIFIER_THRESHOLD = 0.3    # Sentiment score threshold for modifying confidence

# ============================================================================
# INFERENCE CONFIGURATION
# ============================================================================

INFERENCE_LOOKBACK_DAYS = 120       # Last N days to include (encoder=90 + buffer)
INFERENCE_FUTURE_DAYS = 7           # Days to forecast

# ============================================================================
# PREPROCESSING CONFIGURATION
# ============================================================================

# Features that may have NaN at series start (filled with 0)
FILLNA_WITH_ZERO_COLS = [
    "volume_ratio", "volume_signal", "volume_ma_20", "volume_trend",
    "obv_signal", "vpt", "proxy_sentiment", "blended_sentiment",
    "market_strength", "fx_risk", "sentiment_quality", "price_direction",
    "announcement_flag", "days_since_announcement", "relative_momentum",
    "sentiment_score", "sentiment_count", "sentiment_ma_5",
    "rsi_sentiment", "momentum_signal",
]

# Normalization strategy
NORMALIZATION_STRATEGY = "GroupNormalizer"  # Per-ticker
SCALER_STRATEGY = "RobustScaler"            # For other features

# Clipping strategy
CLIP_N_STD = 4.0  # Clip to mean ± N standard deviations from training

# ============================================================================
# LOGGING
# ============================================================================

LOG_LEVEL = "INFO"

# ============================================================================
# ARTIFACT NAMES (downloaded from Kaggle after training)
# ============================================================================

ARTIFACT_MODEL_CHECKPOINT = "tft_model.ckpt"
ARTIFACT_TRAINING_DATASET = "training_dataset.pkl"
ARTIFACT_SCALER_PARAMS = "scaler_params.json"
ARTIFACT_ENCODER_PARAMS = "encoder_params.json"
ARTIFACT_TRAINING_METADATA = "training_metadata.json"
