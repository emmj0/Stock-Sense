"""
TFT Model Evaluation Script
Loads the trained model, runs predictions on the test set (2025+),
and reports metrics: MAE, RMSE, MAPE, directional accuracy.
"""

import argparse
import json
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings('ignore')

# ============================================================================
# PATHS — override artifacts dir with --artifacts flag
# ============================================================================
parser = argparse.ArgumentParser()
parser.add_argument("--artifacts", default=None, help="Path to artifacts directory")
parser.add_argument("--out", default=None, help="Output CSV path for results")
args, _ = parser.parse_known_args()

ROOT = Path(__file__).parent
ARTIFACTS_DIR = Path(args.artifacts) if args.artifacts else ROOT / "artifacts"
DATA_DIR = ROOT / "data" / "final"
MASTER_CSV = DATA_DIR / "tft_ready.csv"

CHECKPOINT = ARTIFACTS_DIR / "tft_model.ckpt"
DATASET_PKL = ARTIFACTS_DIR / "training_dataset.pkl"
METADATA_JSON = ARTIFACTS_DIR / "training_metadata.json"
SCALER_JSON = ARTIFACTS_DIR / "scaler_params.json"

TEST_START_DATE = "2025-01-01"
TRAIN_CUTOFF_DATE = "2024-01-01"

# ============================================================================
# LOAD ARTIFACTS
# ============================================================================
print("=" * 65)
print("TFT MODEL EVALUATION")
print("=" * 65)

print("\n[1/5] Loading artifacts...")

with open(METADATA_JSON) as f:
    metadata = json.load(f)

with open(SCALER_JSON) as f:
    scaler_params = json.load(f)

MAX_ENCODER = metadata["max_encoder_length"]   # 90
MAX_PREDICTION = metadata["max_prediction_length"]  # 7

print(f"  Encoder length : {MAX_ENCODER}")
print(f"  Prediction horizon: {MAX_PREDICTION}")
print(f"  Trained on     : {metadata['trained_on']}")
print(f"  Train samples  : {metadata['training_samples']:,}")
print(f"  Val samples    : {metadata['validation_samples']:,}")

# ============================================================================
# LOAD MASTER DATA
# ============================================================================
print("\n[2/5] Loading master dataset...")
df = pd.read_csv(MASTER_CSV)
df["Date"] = pd.to_datetime(df["Date"])
df = df.sort_values(["Ticker", "Date"]).reset_index(drop=True)
df["time_idx"] = df.groupby("Ticker").cumcount().astype("int32")

# Fill known NaN columns
fill_zero_cols = [
    "volume_ratio", "volume_signal", "volume_ma_20", "volume_trend",
    "obv_signal", "vpt", "proxy_sentiment", "blended_sentiment",
    "market_strength", "fx_risk", "sentiment_quality", "price_direction",
]
for col in fill_zero_cols:
    if col in df.columns:
        df[col] = df[col].fillna(0.0).astype("float32")

if "announcement_type" in df.columns:
    df["announcement_type"] = df["announcement_type"].fillna("none").astype(str)

numeric_cols = df.select_dtypes(include=["float64"]).columns
for col in numeric_cols:
    df[col] = df[col].astype("float32")

print(f"  Rows: {len(df):,} | Tickers: {df['Ticker'].nunique()} | Dates: {df['Date'].min().date()} to {df['Date'].max().date()}")

# ============================================================================
# BUILD TEST DATASET
# ============================================================================
print("\n[3/5] Building test dataset (2025-01-01 onwards)...")

import torch
import torch
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from pytorch_forecasting.data import NaNLabelEncoder, GroupNormalizer
from pytorch_forecasting.metrics import QuantileLoss

# Pre-load checkpoint to extract the exact embedding vocabulary it was trained with.
# This is critical: the announcement_type embedding size in the checkpoint depends on
# how many categories appeared in the actual training data on Colab — not what's in
# encoder_params.json (which reflects the full local dataset).
print("  Pre-loading checkpoint to extract embedding labels...")
import torch.serialization
torch.serialization.add_safe_globals([GroupNormalizer, NaNLabelEncoder])
_ckpt_pre = torch.load(str(CHECKPOINT), map_location="cpu", weights_only=False)
_emb_labels = _ckpt_pre.get("hyper_parameters", {}).get("embedding_labels", {})

# Rebuild training dataset using exact categories from Kaggle training
print("  Rebuilding TimeSeriesDataSet from training data...")

with open(ARTIFACTS_DIR / "encoder_params.json") as f:
    encoder_params = json.load(f)

# Use checkpoint's embedding_labels for announcement_type (not encoder_params.json):
# the checkpoint may have fewer categories than the full dataset has.
if "announcement_type" in _emb_labels:
    ann_cats = [k for k in _emb_labels["announcement_type"].keys() if k != "nan"]
    print(f"  announcement_type from checkpoint: {ann_cats}")
else:
    ann_cats = encoder_params["announcement_type"]
    print(f"  announcement_type from encoder_params.json: {ann_cats}")

ann_enc = NaNLabelEncoder(add_nan=True)
ann_enc.fit(pd.Series(ann_cats))

sector_enc = NaNLabelEncoder(add_nan=False)
sector_enc.fit(pd.Series(encoder_params["Sector"]))

ticker_enc = NaNLabelEncoder(add_nan=False)
ticker_enc.fit(pd.Series(encoder_params["Ticker"]))

# Filter data to only tickers in the Kaggle-trained set
known_tickers = set(encoder_params["Ticker"])
df = df[df["Ticker"].isin(known_tickers)].copy()
df["time_idx"] = df.groupby("Ticker").cumcount().astype("int32")  # reindex after filter
print(f"  Filtered to {df['Ticker'].nunique()} tickers (matching Kaggle training set)")

training_df = df[df["Date"] < TRAIN_CUTOFF_DATE].copy()
training_dataset = TimeSeriesDataSet(
    data=training_df,
    time_idx="time_idx",
    target="Close",
    group_ids=["Ticker"],
    min_encoder_length=MAX_ENCODER // 2,
    max_encoder_length=MAX_ENCODER,
    min_prediction_length=MAX_PREDICTION,
    max_prediction_length=MAX_PREDICTION,
    static_categoricals=["Ticker", "Sector"],
    static_reals=[],
    time_varying_known_categoricals=["announcement_type"],
    time_varying_known_reals=[
        "day_of_week", "month", "oil_price", "USD_PKR",
        "market_index", "market_momentum", "market_volatility",
        "market_strength", "inflation_proxy", "fx_volatility",
        "fx_risk", "announcement_flag"
    ],
    time_varying_unknown_reals=[
        "Close", "Open", "High", "Low", "Volume",
        "sma_20", "sma_50", "rsi_14", "vol_20",
        "volume_ma_20", "volume_ratio", "volume_trend", "volume_signal",
        "obv_signal", "vpt", "price_direction",
        "rsi_sentiment", "momentum_signal",
        "proxy_sentiment", "blended_sentiment",
        "sentiment_score", "sentiment_count", "sentiment_ma_5",
        "days_since_announcement", "relative_momentum", "sentiment_quality"
    ],
    target_normalizer=GroupNormalizer(groups=["Ticker"], transformation="softplus"),
    allow_missing_timesteps=True,
    add_relative_time_idx=True,
    add_target_scales=True,
    add_encoder_length=True,
    categorical_encoders={
        "announcement_type": ann_enc,
        "Sector": sector_enc,
        "Ticker": ticker_enc,
    },
)
print(f"  Training dataset: {len(training_dataset):,} samples")

# Build test split: include encoder overlap from before test start
test_df = df[df["Date"] >= TEST_START_DATE].copy()
encoder_context = df[df["Date"] < TEST_START_DATE].groupby("Ticker").tail(MAX_ENCODER).copy()
test_df = pd.concat([encoder_context, test_df], ignore_index=True)
test_df = test_df.sort_values(["Ticker", "Date"]).reset_index(drop=True)

print(f"  Test rows (incl. encoder context): {len(test_df):,}")
print(f"  Test tickers: {test_df['Ticker'].nunique()}")

test_dataset = TimeSeriesDataSet.from_dataset(
    training_dataset,
    test_df,
    predict=False,
    stop_randomization=True,
)

print(f"  Test samples: {len(test_dataset):,}")

test_dl = test_dataset.to_dataloader(train=False, batch_size=128, num_workers=0)

# ============================================================================
# LOAD MODEL AND PREDICT
# ============================================================================
print("\n[4/5] Loading model and running predictions...")

# Reuse the checkpoint already loaded above; just pop bad keys
ckpt = _ckpt_pre

# Remove args not supported in local pytorch-forecasting build
for bad_key in ["monotone_constraints"]:
    ckpt.get("hyper_parameters", {}).pop(bad_key, None)

# Rebuild model from training dataset + restore weights
model = TemporalFusionTransformer.from_dataset(
    training_dataset,
    learning_rate=metadata["learning_rate"],
    hidden_size=metadata["hidden_size"],
    attention_head_size=metadata["attention_head_size"],
    dropout=metadata["dropout"],
    hidden_continuous_size=metadata.get("hidden_continuous_size", 32),
    lstm_layers=metadata["lstm_layers"],
    loss=QuantileLoss(quantiles=metadata["quantiles"]),
    optimizer="adam",
)
model.load_state_dict(ckpt["state_dict"])
model.eval()
model.eval()

total_params = sum(p.numel() for p in model.parameters())
print(f"  Model parameters: {total_params / 1e6:.1f}M")

# Run predictions
print("  Running inference on test set...")
predict_output = model.predict(
    test_dl,
    mode="quantiles",
    return_index=True,
)
# Returns a Prediction namedtuple: .output = predictions tensor, .index = DataFrame
raw_predictions = predict_output.output
index_df = predict_output.index

preds = raw_predictions.numpy() if hasattr(raw_predictions, "numpy") else np.array(raw_predictions)
print(f"  Predictions shape: {preds.shape}")  # (N, horizon, quantiles) = (N, 7, 5)

# Shape: (N, 7, 5) -> quantile order: [0.1, 0.25, 0.5, 0.75, 0.9]
median_preds = preds[:, :, 2]   # (N, 7) — q0.5
q10 = preds[:, :, 0]            # (N, 7) — q0.1
q90 = preds[:, :, 4]            # (N, 7) — q0.9

# ============================================================================
# COMPUTE METRICS
# ============================================================================
print("\n[5/5] Computing evaluation metrics...")

# Get actual close prices aligned to predictions
# index_df contains Ticker and time_idx for each prediction row
results = []

for i, row in index_df.iterrows():
    ticker = row["Ticker"]
    tidx = int(row["time_idx"])

    # Fetch the actual values for the 7 prediction steps
    ticker_df = test_df[test_df["Ticker"] == ticker].sort_values("Date").reset_index(drop=True)
    # time_idx in test_df is from the full df, need to match
    match = ticker_df[ticker_df["time_idx"] == tidx]
    if match.empty:
        continue
    pos = match.index[0]
    actual_rows = ticker_df.iloc[pos: pos + MAX_PREDICTION]
    if len(actual_rows) < MAX_PREDICTION:
        continue

    actual_prices = actual_rows["Close"].values.astype(float)
    pred_prices = median_preds[i].astype(float)
    last_known = ticker_df.iloc[pos - 1]["Close"] if pos > 0 else actual_prices[0]

    mae = np.mean(np.abs(pred_prices - actual_prices))
    rmse = np.sqrt(np.mean((pred_prices - actual_prices) ** 2))
    mape = np.mean(np.abs((pred_prices - actual_prices) / (actual_prices + 1e-8))) * 100

    # Directional accuracy: did we predict up/down correctly vs last known price?
    pred_dir = (pred_prices[-1] > last_known)
    actual_dir = (actual_prices[-1] > last_known)
    dir_correct = int(pred_dir == actual_dir)

    # Coverage: % of actual values within [q10, q90]
    p10 = q10[i].astype(float)
    p90 = q90[i].astype(float)
    coverage = np.mean((actual_prices >= p10) & (actual_prices <= p90)) * 100

    results.append({
        "Ticker": ticker,
        "MAE": mae,
        "RMSE": rmse,
        "MAPE_%": mape,
        "Dir_Accuracy": dir_correct,
        "Coverage_80pct_%": coverage,
    })

if not results:
    print("  No aligned predictions found. Check test data alignment.")
else:
    results_df = pd.DataFrame(results)

    print("\n" + "=" * 65)
    print("OVERALL METRICS (across all tickers & windows)")
    print("=" * 65)
    overall = results_df[["MAE", "RMSE", "MAPE_%", "Dir_Accuracy", "Coverage_80pct_%"]].mean()
    print(f"  MAE              : {overall['MAE']:.2f} PKR")
    print(f"  RMSE             : {overall['RMSE']:.2f} PKR")
    print(f"  MAPE             : {overall['MAPE_%']:.2f}%")
    print(f"  Directional Acc. : {overall['Dir_Accuracy']*100:.1f}%")
    print(f"  80% CI Coverage  : {overall['Coverage_80pct_%']:.1f}%")

    print("\n" + "=" * 65)
    print("PER-TICKER METRICS (median over test windows)")
    print("=" * 65)
    ticker_metrics = (
        results_df.groupby("Ticker")
        .agg(
            MAE=("MAE", "median"),
            RMSE=("RMSE", "median"),
            MAPE=("MAPE_%", "median"),
            DirAcc=("Dir_Accuracy", "mean"),
            Coverage=("Coverage_80pct_%", "mean"),
        )
        .round(2)
        .sort_values("MAPE")
    )
    ticker_metrics["DirAcc"] = (ticker_metrics["DirAcc"] * 100).round(1)
    ticker_metrics["Coverage"] = ticker_metrics["Coverage"].round(1)
    ticker_metrics.columns = ["MAE(PKR)", "RMSE(PKR)", "MAPE%", "DirAcc%", "Coverage%"]
    print(ticker_metrics.to_string())

    print("\n" + "=" * 65)
    print("INTERPRETATION GUIDE")
    print("=" * 65)
    print("  MAPE < 5%       -> Excellent")
    print("  MAPE 5-10%      -> Good")
    print("  MAPE 10-20%     -> Acceptable (volatile stocks)")
    print("  MAPE > 20%      -> Poor (consider more training)")
    print("  DirAcc > 55%    -> Better than random (usable for signals)")
    print("  DirAcc > 60%    -> Good signal quality")
    print("  Coverage ~80%   -> Well-calibrated uncertainty intervals")
    print()

    # Save results
    default_out = ROOT / "data" / "inference" / "eval_results.csv"
    out_path = Path(args.out) if args.out else default_out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    results_df.to_csv(out_path, index=False)
    print(f"  Full results saved to: {out_path}")
