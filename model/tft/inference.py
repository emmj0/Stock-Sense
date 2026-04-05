"""
Inference engine for daily TFT predictions.
Loads frozen model and runs sliding window inference.
"""

import pandas as pd
import numpy as np
import torch
import json
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import logging

from pytorch_forecasting import TemporalFusionTransformer

from . import config, preprocessing, dataset

logger = logging.getLogger(__name__)


class TFTInferenceEngine:
    """
    Frozen TFT inference engine.
    Loads checkpoint and runs daily predictions without retraining.
    """

    def __init__(
        self,
        checkpoint_path: Path = None,
        training_dataset_path: Path = None,
        scaler_params_path: Path = None,
        metadata_path: Path = None,
    ):
        """
        Initialize inference engine with artifacts from Kaggle training.

        Args:
            checkpoint_path: Path to tft_model.ckpt
            training_dataset_path: Path to training_dataset.pkl (serialized TimeSeriesDataSet)
            scaler_params_path: Path to scaler_params.json
            metadata_path: Path to training_metadata.json
        """
        self.checkpoint_path = checkpoint_path or (config.ARTIFACTS_DIR / config.ARTIFACT_MODEL_CHECKPOINT)
        self.training_dataset_path = training_dataset_path or (config.ARTIFACTS_DIR / config.ARTIFACT_TRAINING_DATASET)
        self.scaler_params_path = scaler_params_path or (config.ARTIFACTS_DIR / config.ARTIFACT_SCALER_PARAMS)
        self.metadata_path = metadata_path or (config.ARTIFACTS_DIR / config.ARTIFACT_TRAINING_METADATA)

        self.model = None
        self.training_dataset = None
        self.scaler_params = None
        self.metadata = None

        self._load_artifacts()

    def _load_artifacts(self):
        """Load all artifacts from disk."""
        from pytorch_forecasting import TimeSeriesDataSet
        from pytorch_forecasting.data import NaNLabelEncoder, GroupNormalizer
        from pytorch_forecasting.metrics import QuantileLoss

        logger.info("Loading TFT artifacts...")

        # Load metadata
        if not self.metadata_path.exists():
            raise RuntimeError(f"training_metadata.json not found at {self.metadata_path}")
        with open(self.metadata_path, 'r') as f:
            self.metadata = json.load(f)
        logger.info(f"  encoder_length={self.metadata['max_encoder_length']}, "
                    f"prediction_length={self.metadata['max_prediction_length']}")

        # Load scaler params
        if self.scaler_params_path.exists():
            with open(self.scaler_params_path, 'r') as f:
                self.scaler_params = json.load(f)

        # Load encoder params
        encoder_params_path = config.ARTIFACTS_DIR / config.ARTIFACT_ENCODER_PARAMS
        if not encoder_params_path.exists():
            raise RuntimeError(f"encoder_params.json not found at {encoder_params_path}")
        with open(encoder_params_path, 'r') as f:
            encoder_params = json.load(f)

        MAX_ENCODER = self.metadata["max_encoder_length"]
        MAX_PREDICTION = self.metadata["max_prediction_length"]
        TRAIN_CUTOFF = self.metadata.get("training_cutoff_date", "2024-01-01")

        # Pre-load checkpoint to extract exact embedding labels used at training time
        if not self.checkpoint_path.exists():
            raise RuntimeError(f"Checkpoint not found: {self.checkpoint_path}")

        logger.info("  Pre-loading checkpoint to extract embedding labels...")
        ckpt = torch.load(str(self.checkpoint_path), map_location="cpu", weights_only=False)
        for bad_key in ["monotone_constraints"]:
            ckpt.get("hyper_parameters", {}).pop(bad_key, None)
        emb_labels = ckpt.get("hyper_parameters", {}).get("embedding_labels", {})

        # Resolve announcement_type categories from checkpoint (authoritative) or encoder_params
        if "announcement_type" in emb_labels:
            ann_cats = [k for k in emb_labels["announcement_type"].keys() if k != "nan"]
            logger.info(f"  announcement_type from checkpoint: {ann_cats}")
        else:
            ann_cats = encoder_params["announcement_type"]
            logger.info(f"  announcement_type from encoder_params: {ann_cats}")

        ann_enc = NaNLabelEncoder(add_nan=True)
        ann_enc.fit(pd.Series(ann_cats))

        sector_enc = NaNLabelEncoder(add_nan=False)
        sector_enc.fit(pd.Series(encoder_params["Sector"]))

        ticker_enc = NaNLabelEncoder(add_nan=False)
        ticker_enc.fit(pd.Series(encoder_params["Ticker"]))

        # Rebuild training TimeSeriesDataSet from master CSV (avoids pkl version issues)
        logger.info("  Rebuilding training TimeSeriesDataSet from master CSV...")
        master_df = pd.read_csv(config.MASTER_CSV)
        master_df["Date"] = pd.to_datetime(master_df["Date"])
        master_df = master_df.sort_values(["Ticker", "Date"]).reset_index(drop=True)
        master_df["time_idx"] = master_df.groupby("Ticker").cumcount().astype("int32")

        # Fill NaNs the same way as training
        for col in config.FILLNA_WITH_ZERO_COLS:
            if col in master_df.columns:
                master_df[col] = master_df[col].fillna(0.0).astype("float32")
        if "announcement_type" in master_df.columns:
            master_df["announcement_type"] = master_df["announcement_type"].fillna("none").astype(str)
        for col in master_df.select_dtypes(include=["float64"]).columns:
            master_df[col] = master_df[col].astype("float32")

        # Filter to known tickers and training period
        known_tickers = set(encoder_params["Ticker"])
        training_df = master_df[
            (master_df["Ticker"].isin(known_tickers)) &
            (master_df["Date"] < TRAIN_CUTOFF)
        ].copy()
        training_df["time_idx"] = training_df.groupby("Ticker").cumcount().astype("int32")

        self.training_dataset = TimeSeriesDataSet(
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
            time_varying_known_reals=config.TIME_VARYING_KNOWN_REALS,
            time_varying_unknown_reals=config.TIME_VARYING_UNKNOWN_REALS,
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
        logger.info(f"  Training dataset rebuilt: {len(self.training_dataset):,} samples")

        # Rebuild model from training dataset + restore weights
        hp = ckpt.get("hyper_parameters", {})
        self.model = TemporalFusionTransformer.from_dataset(
            self.training_dataset,
            learning_rate=hp.get("learning_rate", self.metadata.get("learning_rate", 3e-4)),
            hidden_size=hp.get("hidden_size", self.metadata.get("hidden_size", 128)),
            attention_head_size=hp.get("attention_head_size", self.metadata.get("attention_head_size", 4)),
            dropout=hp.get("dropout", self.metadata.get("dropout", 0.15)),
            hidden_continuous_size=hp.get("hidden_continuous_size", self.metadata.get("hidden_continuous_size", 32)),
            lstm_layers=hp.get("lstm_layers", self.metadata.get("lstm_layers", 2)),
            loss=QuantileLoss(quantiles=self.metadata.get("quantiles", [0.1, 0.25, 0.5, 0.75, 0.9])),
            optimizer="adam",
        )
        self.model.load_state_dict(ckpt["state_dict"])
        self.model.eval()
        total_params = sum(p.numel() for p in self.model.parameters())
        logger.info(f"  Model loaded: {total_params / 1e6:.1f}M parameters")

    def predict_sliding_window(
        self,
        df: pd.DataFrame,
        batch_size: int = config.TFT_HYPERPARAMS["batch_size"],
    ) -> Tuple[np.ndarray, pd.DataFrame]:
        """
        Run inference on sliding window data.

        Args:
            df: Preprocessed DataFrame with historical + future rows (per ticker)
            batch_size: DataLoader batch size

        Returns:
            predictions: shape (num_samples, num_quantiles, horizon)
                        where quantiles=[0.1, 0.25, 0.5, 0.75, 0.9], horizon=7
            index: DataFrame with metadata for each prediction
        """
        if self.model is None or self.training_dataset is None:
            raise RuntimeError("Model or training dataset not loaded")

        # Build inference dataset from training dataset template
        inference_ds = dataset.build_inference_dataset(self.training_dataset, df)

        # Create DataLoader
        inference_dl = inference_ds.to_dataloader(
            train=False,
            batch_size=batch_size,
            num_workers=0
        )

        # Run predictions — returns a Prediction namedtuple (.output, .index)
        predict_output = self.model.predict(
            inference_dl,
            mode="quantiles",
            return_index=True,
        )
        raw_predictions = predict_output.output
        index = predict_output.index

        preds_np = raw_predictions.numpy() if hasattr(raw_predictions, "numpy") else raw_predictions
        logger.info(f"Generated predictions: shape {preds_np.shape}")

        return preds_np, index

    def denormalize_predictions(
        self,
        predictions: np.ndarray,
        tickers: List[str],
    ) -> Dict[str, np.ndarray]:
        """
        Organize predictions by ticker.

        GroupNormalizer in pytorch-forecasting already handles denormalization
        internally during model.predict(), so predictions are already in PKR prices.

        Args:
            predictions: shape (num_samples, horizon, quantiles) — already in PKR
            tickers: List of ticker symbols corresponding to each sample

        Returns:
            Dict mapping ticker → predictions array (7, 5) for the most recent window
        """
        per_ticker = {}

        for i, ticker in enumerate(tickers):
            if ticker not in per_ticker:
                per_ticker[ticker] = []
            per_ticker[ticker].append(predictions[i])

        # Take the last sample per ticker (most recent window)
        result = {}
        for ticker, preds in per_ticker.items():
            result[ticker] = preds[-1]  # shape (7, 5)

        return result

    def run_inference(
        self,
        master_csv: Path = config.MASTER_CSV,
        sentiment_csv: Optional[Path] = config.SENTIMENT_DAILY_CSV,
    ) -> List[Dict]:
        """
        End-to-end inference: load data → build window → predict → denormalize.

        Args:
            master_csv: Path to master tft_ready_clean.csv
            sentiment_csv: Optional daily sentiment to merge

        Returns:
            List of prediction dicts with ticker, dates, and quantile forecasts
        """
        logger.info("Starting inference pipeline...")

        # Load data
        master_df = pd.read_csv(master_csv)
        master_df['Date'] = pd.to_datetime(master_df['Date'])

        sentiment_df = None
        if sentiment_csv and Path(sentiment_csv).exists():
            sentiment_df = pd.read_csv(sentiment_csv)
            sentiment_df['Date'] = pd.to_datetime(sentiment_df['Date'])

        # Preprocess
        master_df = preprocessing.apply_preprocessing_pipeline(
            master_df,
            stage="inference",
            scaler_params=self.scaler_params
        )

        # Build inference window
        window_df = preprocessing.build_inference_window(
            master_df,
            sentiment_df=sentiment_df,
            lookback_days=config.INFERENCE_LOOKBACK_DAYS,
            future_days=config.INFERENCE_FUTURE_DAYS,
        )

        logger.info(f"Inference window: {len(window_df)} rows, {window_df['Ticker'].nunique()} tickers")

        # Predict
        raw_predictions, index_df = self.predict_sliding_window(window_df)

        # Denormalize
        tickers_list = index_df['Ticker'].values if 'Ticker' in index_df.columns else []
        denormalized = self.denormalize_predictions(raw_predictions, tickers_list)

        logger.info(f"Inference complete")

        return denormalized


def run_daily_inference(
    save_path: Optional[Path] = None
) -> List[Dict]:
    """
    Standalone function to run daily inference.

    Args:
        save_path: Optional path to save predictions JSON

    Returns:
        List of prediction dicts
    """
    engine = TFTInferenceEngine()
    predictions = engine.run_inference()

    if save_path:
        with open(save_path, 'w') as f:
            # Convert numpy arrays to lists for JSON serialization
            json_predictions = []
            for ticker, preds in predictions.items():
                json_predictions.append({
                    'ticker': ticker,
                    'quantile_forecasts_7d': preds.tolist() if isinstance(preds, np.ndarray) else preds,
                })
            json.dump(json_predictions, f, indent=2)
        logger.info(f"Predictions saved to {save_path}")

    return predictions
