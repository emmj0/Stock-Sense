"""
Centralized preprocessing and feature engineering pipeline.
Applied identically at training and inference to eliminate training-inference skew.
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, List, Optional
from sklearn.preprocessing import RobustScaler
import warnings

from . import config

warnings.filterwarnings("ignore")


def remap_time_idx(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remap time_idx to per-ticker cumcount.

    The current dataset has time_idx as a global counter (49 to 6242).
    TFT requires per-group sequential integers starting from 0.

    Args:
        df: DataFrame with 'Ticker' column and 'Date' sorted

    Returns:
        DataFrame with remapped time_idx
    """
    df = df.copy()
    df['time_idx'] = df.groupby('Ticker').cumcount()
    return df


def fill_volume_nans(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fill NaN values in volume-based features with 0.
    This occurs at series start (before enough history to compute rolling stats).
    Must be consistent between training and inference.

    Args:
        df: DataFrame with volume columns

    Returns:
        DataFrame with filled NaNs
    """
    df = df.copy()
    for col in config.FILLNA_WITH_ZERO_COLS:
        if col in df.columns:
            df[col] = df[col].fillna(0.0)
    return df


def compute_proxy_sentiment(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute proxy_sentiment from technical indicators.
    Used when real sentiment is unavailable (pre-2024 mostly).

    Formula: 0.5 * rsi_sentiment + 0.3 * momentum_signal + 0.2 * volume_signal

    Args:
        df: DataFrame with rsi_sentiment, momentum_signal, volume_signal

    Returns:
        DataFrame with computed proxy_sentiment column
    """
    df = df.copy()

    # Ensure required columns exist and are numeric
    for col in ['rsi_sentiment', 'momentum_signal', 'volume_signal']:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    df['proxy_sentiment'] = (
        0.5 * df['rsi_sentiment'] +
        0.3 * df['momentum_signal'] +
        0.2 * df['volume_signal']
    )

    # Clip to [-1, 1]
    df['proxy_sentiment'] = df['proxy_sentiment'].clip(-1, 1)

    return df


def compute_blended_sentiment(df: pd.DataFrame) -> pd.DataFrame:
    """
    Blend real sentiment with proxy sentiment.
    Uses real sentiment if non-zero, otherwise falls back to proxy.

    Args:
        df: DataFrame with sentiment_score and proxy_sentiment

    Returns:
        DataFrame with computed blended_sentiment column
    """
    df = df.copy()

    # Ensure columns exist
    if 'sentiment_score' not in df.columns:
        df['sentiment_score'] = 0.0
    if 'proxy_sentiment' not in df.columns:
        df['proxy_sentiment'] = 0.0

    df['sentiment_score'] = pd.to_numeric(df['sentiment_score'], errors='coerce').fillna(0.0)
    df['proxy_sentiment'] = pd.to_numeric(df['proxy_sentiment'], errors='coerce').fillna(0.0)

    # Use real if non-zero, else proxy
    df['blended_sentiment'] = df.apply(
        lambda row: row['sentiment_score'] if row['sentiment_score'] != 0 else row['proxy_sentiment'],
        axis=1
    )

    # Clip to [-1, 1]
    df['blended_sentiment'] = df['blended_sentiment'].clip(-1, 1)

    return df


def clip_to_training_range(df: pd.DataFrame, scaler_params: Optional[Dict] = None) -> pd.DataFrame:
    """
    Clip continuous features to training-observed range ± N standard deviations.
    Prevents out-of-distribution inputs after training cutoff (e.g., oil price spikes).

    Args:
        df: DataFrame with continuous features
        scaler_params: Dict of per-feature {'mean': float, 'std': float} from training.
                       If None, compute from df itself (useful for inference sanity check).

    Returns:
        DataFrame with clipped features
    """
    df = df.copy()

    if scaler_params is None:
        # Compute stats from current data (fallback for inference without saved params)
        scaler_params = {}
        for col in config.ALL_CONTINUOUS_FEATURES:
            if col in df.columns:
                scaler_params[col] = {
                    'mean': df[col].mean(),
                    'std': df[col].std() + 1e-6,  # Avoid division by zero
                }

    # Clip each feature
    for col in config.ALL_CONTINUOUS_FEATURES:
        if col not in df.columns:
            continue

        if col in scaler_params:
            params = scaler_params[col]
            mean = params['mean']
            std = params['std']
            lower_bound = mean - config.CLIP_N_STD * std
            upper_bound = mean + config.CLIP_N_STD * std
            df[col] = df[col].clip(lower_bound, upper_bound)

    return df


def fill_future_known_features(df: pd.DataFrame, current_date: str = None) -> pd.DataFrame:
    """
    For future decoder rows (t+1 to t+7), fill known features with default values.

    Known features will be set to their last value or computed from macro data.
    Unknown features remain NaN (will be handled by TimeSeriesDataSet).

    Args:
        df: DataFrame with future rows already added
        current_date: Current date for logging (optional)

    Returns:
        DataFrame with filled future rows
    """
    df = df.copy()

    # For future rows: forward-fill known features from last historical row
    # Unknown features (like Close, RSI) will be NaN and handled by the model

    known_cols = config.TIME_VARYING_KNOWN_REALS + config.TIME_VARYING_KNOWN_CATEGORICALS

    # Group by ticker and forward-fill known features within each group
    for ticker in df['Ticker'].unique():
        mask = df['Ticker'] == ticker
        ticker_df = df[mask].copy()

        # Find the last historical row (non-NaN time_idx that's part of historical data)
        # Forward-fill known features
        for col in known_cols:
            if col in df.columns:
                # Forward-fill with limit (don't fill too far ahead)
                df.loc[mask, col] = ticker_df[col].fillna(method='ffill')

    # Set announcement fields to default for future rows
    if 'announcement_flag' in df.columns:
        # Future rows will have NaN, set to 0
        df['announcement_flag'] = df['announcement_flag'].fillna(0)

    if 'announcement_type' in df.columns:
        df['announcement_type'] = df['announcement_type'].fillna('none')

    return df


def apply_preprocessing_pipeline(
    df: pd.DataFrame,
    stage: str = "train",
    scaler_params: Optional[Dict] = None
) -> pd.DataFrame:
    """
    Apply full preprocessing pipeline.

    Args:
        df: Input DataFrame (should be sorted by [Ticker, Date])
        stage: "train", "validation", or "inference"
        scaler_params: Per-feature clipping bounds (for inference)

    Returns:
        Fully preprocessed DataFrame
    """
    # Order matters!

    # 1. Remap time_idx
    df = remap_time_idx(df)

    # 2. Fill NaN volume features
    df = fill_volume_nans(df)

    # 3. Compute proxy_sentiment from technicals
    df = compute_proxy_sentiment(df)

    # 4. Blend real + proxy sentiment
    df = compute_blended_sentiment(df)

    # 5. Clip to training range (prevents OOD inputs)
    df = clip_to_training_range(df, scaler_params=scaler_params)

    # 6. Validate required columns
    required_cols = (
        config.STATIC_CATEGORICALS +
        config.TIME_VARYING_KNOWN_CATEGORICALS +
        config.TIME_VARYING_KNOWN_REALS +
        config.TIME_VARYING_UNKNOWN_REALS +
        ["Date", "time_idx"]
    )

    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    return df


def build_inference_window(
    master_df: pd.DataFrame,
    sentiment_df: Optional[pd.DataFrame] = None,
    lookback_days: int = config.INFERENCE_LOOKBACK_DAYS,
    future_days: int = config.INFERENCE_FUTURE_DAYS,
) -> pd.DataFrame:
    """
    Build a sliding window for daily inference.

    Per ticker:
    - Last lookback_days rows from master_df (encoder context)
    - future_days rows with known features filled, unknowns set to NaN

    Args:
        master_df: Master historical CSV (sorted by [Ticker, Date])
        sentiment_df: Optional daily sentiment CSV to merge
        lookback_days: Number of historical days to include
        future_days: Number of future days to forecast

    Returns:
        DataFrame ready for TimeSeriesDataSet
    """
    window_data = []

    # Ensure sorted
    master_df = master_df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    for ticker in config.KSE30_STOCKS:
        ticker_df = master_df[master_df['Ticker'] == ticker].copy()

        if len(ticker_df) == 0:
            continue

        # Last lookback_days
        historical = ticker_df.tail(lookback_days).copy()

        if len(historical) == 0:
            continue

        # Merge sentiment if provided
        if sentiment_df is not None:
            sentiment_ticker = sentiment_df[sentiment_df['Ticker'] == ticker][['Date', 'sentiment_score']]
            historical = historical.merge(
                sentiment_ticker,
                on='Date',
                how='left',
                suffixes=('', '_new')
            )
            if 'sentiment_score_new' in historical.columns:
                historical['sentiment_score'] = historical['sentiment_score_new']
                historical = historical.drop('sentiment_score_new', axis=1)

        # Get last date and price
        last_date = pd.to_datetime(historical['Date'].iloc[-1])
        last_close = historical['Close'].iloc[-1]
        last_time_idx = historical['time_idx'].iloc[-1]

        # Create future rows (next 7 trading days)
        # Note: In real system, would compute actual dates considering market holidays
        future_rows = []
        for i in range(1, future_days + 1):
            future_date = last_date + pd.Timedelta(days=i)
            future_row = {
                'Ticker': ticker,
                'Sector': historical['Sector'].iloc[-1],
                'Date': future_date,
                'time_idx': last_time_idx + i,
                'day_of_week': future_date.dayofweek,
                'month': future_date.month,
                # Known continuous features - fill from last row
                'oil_price': historical['oil_price'].iloc[-1],
                'USD_PKR': historical['USD_PKR'].iloc[-1],
                'market_index': historical['market_index'].iloc[-1],
                'market_momentum': historical['market_momentum'].iloc[-1],
                'market_volatility': historical['market_volatility'].iloc[-1],
                'market_strength': historical['market_strength'].iloc[-1],
                'inflation_proxy': historical['inflation_proxy'].iloc[-1],
                'fx_volatility': historical['fx_volatility'].iloc[-1],
                'fx_risk': historical['fx_risk'].iloc[-1],
                'announcement_flag': 0,
                'announcement_type': 'none',
                # Unknown features — forward-fill from last historical row
                # (TimeSeriesDataSet requires non-NaN; model ignores these in decoder)
                'Close': last_close,
                'Open': historical['Open'].iloc[-1],
                'High': historical['High'].iloc[-1],
                'Low': historical['Low'].iloc[-1],
                'Volume': historical['Volume'].iloc[-1],
                'sma_20': historical['sma_20'].iloc[-1],
                'sma_50': historical['sma_50'].iloc[-1],
                'rsi_14': historical['rsi_14'].iloc[-1],
                'vol_20': historical['vol_20'].iloc[-1],
                'volume_ma_20': historical['volume_ma_20'].iloc[-1],
                'volume_ratio': 0.0,
                'volume_trend': 0.0,
                'volume_signal': 0.0,
                'obv_signal': 0.0,
                'vpt': 0.0,
                'price_direction': 0.0,
                'rsi_sentiment': 0.0,
                'momentum_signal': 0.0,
                'proxy_sentiment': 0.0,
                'blended_sentiment': 0.0,
                'sentiment_score': 0.0,
                'sentiment_count': 0,
                'sentiment_ma_5': 0.0,
                'days_since_announcement': 30,
                'relative_momentum': 0.0,
                'sentiment_quality': 0.0,
            }
            future_rows.append(future_row)

        # Combine historical + future
        combined = pd.concat([
            historical,
            pd.DataFrame(future_rows)
        ], ignore_index=True)

        window_data.append(combined)

    # Concatenate all tickers
    if window_data:
        result = pd.concat(window_data, ignore_index=True)
        result['Date'] = pd.to_datetime(result['Date'])
        result = result.sort_values(['Ticker', 'Date']).reset_index(drop=True)
        return result
    else:
        return pd.DataFrame()


def validate_preprocessing(df: pd.DataFrame) -> Dict[str, any]:
    """
    Validate preprocessed DataFrame.

    Returns:
        Dict with validation results
    """
    results = {
        'total_rows': len(df),
        'unique_tickers': df['Ticker'].nunique(),
        'date_range': (df['Date'].min(), df['Date'].max()),
        'missing_values': df.isnull().sum().to_dict(),
        'time_idx_valid': True,
    }

    # Check time_idx continuity per ticker
    for ticker in df['Ticker'].unique():
        ticker_df = df[df['Ticker'] == ticker].sort_values('time_idx')
        expected_idx = np.arange(ticker_df['time_idx'].min(), ticker_df['time_idx'].max() + 1)
        if not np.array_equal(ticker_df['time_idx'].values, expected_idx):
            results['time_idx_valid'] = False
            results[f'time_idx_gap_{ticker}'] = True

    return results
