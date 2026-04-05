"""
TimeSeriesDataSet building utilities for PyTorch Forecasting TFT.
"""

import pandas as pd
import numpy as np
from typing import Tuple, Dict
from pytorch_forecasting import TimeSeriesDataSet
from pytorch_forecasting.data import NaNLabelEncoder, GroupNormalizer, EncoderNormalizer

from . import config, preprocessing


def build_training_dataset(
    df: pd.DataFrame,
    cutoff_date: str = config.TRAIN_END_DATE,
) -> TimeSeriesDataSet:
    """
    Build TimeSeriesDataSet for training.

    Args:
        df: Preprocessed DataFrame
        cutoff_date: Date to split train/validation

    Returns:
        TimeSeriesDataSet for training
    """
    df = df.copy()
    df['Date'] = pd.to_datetime(df['Date'])

    # Filter to training period
    df = df[df['Date'] <= cutoff_date].copy()

    # Ensure properly sorted
    df = df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Build dataset
    training = TimeSeriesDataSet(
        data=df,
        time_idx="time_idx",
        target="Close",
        group_ids=["Ticker"],
        min_encoder_length=config.TFT_HYPERPARAMS["max_encoder_length"] // 2,
        max_encoder_length=config.TFT_HYPERPARAMS["max_encoder_length"],
        min_prediction_length=config.TFT_HYPERPARAMS["max_prediction_length"],
        max_prediction_length=config.TFT_HYPERPARAMS["max_prediction_length"],
        static_categoricals=config.STATIC_CATEGORICALS,
        static_reals=[],
        time_varying_known_categoricals=config.TIME_VARYING_KNOWN_CATEGORICALS,
        time_varying_known_reals=config.TIME_VARYING_KNOWN_REALS,
        time_varying_unknown_reals=config.TIME_VARYING_UNKNOWN_REALS,
        target_normalizer=GroupNormalizer(
            groups=["Ticker"],
            transformation=config.TFT_HYPERPARAMS["target_normalizer_transformation"]
        ),
        allow_missing_timesteps=True,  # PSX holidays
        add_relative_time_idx=True,
        add_target_scales=True,
        add_encoder_length=True,
        categorical_encoders={
            "announcement_type": NaNLabelEncoder(add_nan=True),
            "Sector": NaNLabelEncoder(add_nan=False),
        },
    )

    return training


def build_validation_dataset(
    training_dataset: TimeSeriesDataSet,
    df: pd.DataFrame,
    start_date: str = config.VALIDATION_START_DATE,
    end_date: str = config.VALIDATION_END_DATE,
) -> TimeSeriesDataSet:
    """
    Build validation dataset from training dataset template.

    Args:
        training_dataset: Fitted TimeSeriesDataSet from training
        df: Full preprocessed DataFrame
        start_date: Validation period start
        end_date: Validation period end

    Returns:
        TimeSeriesDataSet for validation
    """
    df = df.copy()
    df['Date'] = pd.to_datetime(df['Date'])

    # Filter to validation period (with encoder overlap)
    val_df = df[
        (df['Date'] >= pd.to_datetime(start_date)) &
        (df['Date'] <= pd.to_datetime(end_date))
    ].copy()

    # Also include encoder context from before validation start
    encoder_context = df[
        df['Date'] < pd.to_datetime(start_date)
    ].tail(config.TFT_HYPERPARAMS["max_encoder_length"]).copy()

    val_df = pd.concat([encoder_context, val_df], ignore_index=True)
    val_df = val_df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Build from training dataset template
    validation = TimeSeriesDataSet.from_dataset(
        training_dataset,
        val_df,
        predict=False,
        stop_randomization=True
    )

    return validation


def build_test_dataset(
    training_dataset: TimeSeriesDataSet,
    df: pd.DataFrame,
    start_date: str = config.TEST_START_DATE,
) -> TimeSeriesDataSet:
    """
    Build test dataset (final evaluation, held-out).

    Args:
        training_dataset: Fitted TimeSeriesDataSet from training
        df: Full preprocessed DataFrame
        start_date: Test period start

    Returns:
        TimeSeriesDataSet for testing
    """
    df = df.copy()
    df['Date'] = pd.to_datetime(df['Date'])

    # Filter to test period (with encoder overlap)
    test_df = df[df['Date'] >= pd.to_datetime(start_date)].copy()

    # Also include encoder context from before test start
    encoder_context = df[
        df['Date'] < pd.to_datetime(start_date)
    ].tail(config.TFT_HYPERPARAMS["max_encoder_length"]).copy()

    test_df = pd.concat([encoder_context, test_df], ignore_index=True)
    test_df = test_df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Build from training dataset template
    test_dataset = TimeSeriesDataSet.from_dataset(
        training_dataset,
        test_df,
        predict=True,
        stop_randomization=True
    )

    return test_dataset


def build_inference_dataset(
    training_dataset: TimeSeriesDataSet,
    df: pd.DataFrame,
) -> TimeSeriesDataSet:
    """
    Build inference dataset (daily sliding window).

    Args:
        training_dataset: Fitted TimeSeriesDataSet from training (used as template)
        df: Preprocessed DataFrame with historical + future rows (from build_inference_window)

    Returns:
        TimeSeriesDataSet for inference
    """
    df = df.copy()
    df = df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Fill any remaining NaN in numeric columns per ticker (ffill then bfill then 0)
    # This handles: SMA/RSI warmup NaNs, newly scraped rows missing some technicals,
    # and any future placeholder rows that weren't explicitly filled.
    numeric_cols = df.select_dtypes(include='number').columns.tolist()
    df[numeric_cols] = (
        df.groupby('Ticker')[numeric_cols]
        .transform(lambda s: s.ffill().bfill().fillna(0))
    )
    # Ensure announcement_type has no NaN
    if 'announcement_type' in df.columns:
        df['announcement_type'] = df['announcement_type'].fillna('none').astype(str)

    # Build from training dataset template
    inference_dataset = TimeSeriesDataSet.from_dataset(
        training_dataset,
        df,
        predict=True,
        stop_randomization=True
    )

    return inference_dataset


def validate_dataset(dataset: TimeSeriesDataSet) -> Dict[str, any]:
    """
    Validate dataset integrity.

    Args:
        dataset: TimeSeriesDataSet

    Returns:
        Dict with validation results
    """
    results = {
        'num_groups': len(dataset.groups),
        'sequence_length': (
            dataset.min_encoder_length,
            dataset.max_encoder_length,
            dataset.max_prediction_length
        ),
        'num_features': {
            'static_categoricals': len(dataset.static_categoricals),
            'static_reals': len(dataset.static_reals),
            'time_varying_known_categoricals': len(dataset.time_varying_known_categoricals),
            'time_varying_known_reals': len(dataset.time_varying_known_reals),
            'time_varying_unknown_reals': len(dataset.time_varying_unknown_reals),
        },
        'normalizer_type': type(dataset.target_normalizer).__name__,
    }

    return results
