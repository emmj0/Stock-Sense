"""
Signal generation: BUY/HOLD/SELL with confidence, strength, and reasoning.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging

from . import config

logger = logging.getLogger(__name__)


def compute_quantile_metrics(
    quantile_preds: np.ndarray,
    current_price: float,
) -> Dict[str, any]:
    """
    Compute confidence and direction metrics from quantile predictions.

    Args:
        quantile_preds: shape (7, 5) — 7 days, 5 quantiles [0.1, 0.25, 0.5, 0.75, 0.9]
        current_price: Current Close price in PKR

    Returns:
        Dict with metrics: expected_return, confidence, quantile_spread, bull_days, etc.
    """
    if quantile_preds.shape[0] != 7 or quantile_preds.shape[1] != 5:
        raise ValueError(f"Expected shape (7, 5), got {quantile_preds.shape}")

    q10, q25, q50, q75, q90 = (
        quantile_preds[:, 0],
        quantile_preds[:, 1],
        quantile_preds[:, 2],
        quantile_preds[:, 3],
        quantile_preds[:, 4],
    )

    # 7-day return based on median forecast
    median_7d = q50[-1]
    expected_return = (median_7d - current_price) / current_price

    # Spread-based uncertainty: narrow quantile spread = high confidence
    quantile_spread_7d = (q90[-1] - q10[-1]) / current_price
    quantile_spread_7d = max(quantile_spread_7d, 0.001)  # Avoid division by zero

    raw_confidence = 1.0 / (1.0 + quantile_spread_7d * 10)
    raw_confidence = np.clip(raw_confidence, 0, 1)

    # Directional agreement: fraction of days where conditions hold
    bull_days = np.sum(q25 > current_price)  # Even pessimistic scenario is positive
    bear_days = np.sum(q75 < current_price)  # Even optimistic scenario is negative
    neutral_days = 7 - bull_days - bear_days

    directional_consistency = max(bull_days, bear_days) / 7.0

    # Final confidence: blend spread confidence + directional consistency
    confidence = 0.6 * raw_confidence + 0.4 * directional_consistency
    confidence = np.clip(confidence, 0, 1)

    return {
        'expected_return': float(expected_return),
        'confidence': round(float(confidence), 3),
        'quantile_spread_pct': round(float(quantile_spread_7d * 100), 2),
        'bull_days': int(bull_days),
        'bear_days': int(bear_days),
        'neutral_days': int(neutral_days),
        'median_7d_price': round(float(median_7d), 2),
        'quantile_spread_low': round(float(q10[-1]), 2),
        'quantile_spread_high': round(float(q90[-1]), 2),
        'current_price': round(float(current_price), 2),
    }


def generate_signal(
    ticker: str,
    quantile_preds: np.ndarray,
    current_price: float,
    sentiment_data: Optional[Dict] = None,
    attention_weights: Optional[np.ndarray] = None,
) -> Dict[str, any]:
    """
    Generate BUY/HOLD/SELL signal with confidence and reasoning.

    Args:
        ticker: Stock ticker
        quantile_preds: shape (7, 5) quantile predictions
        current_price: Current Close in PKR
        sentiment_data: Dict with sentiment features
        attention_weights: Optional attention weights for interpretability

    Returns:
        Signal dict with action, confidence, reasoning, etc.
    """
    if sentiment_data is None:
        sentiment_data = {}

    # Compute metrics
    metrics = compute_quantile_metrics(quantile_preds, current_price)
    ret = metrics['expected_return']
    conf = metrics['confidence']
    bull = metrics['bull_days']
    bear = metrics['bear_days']

    # Determine base action
    buy_threshold = config.SIGNAL_THRESHOLDS['BUY']
    sell_threshold = config.SIGNAL_THRESHOLDS['SELL']

    if (ret >= buy_threshold['min_return'] and
        conf >= buy_threshold['min_confidence'] and
        bull >= buy_threshold['min_bull_days']):
        action = 'BUY'
        strength = min(1.0, ret / 0.08)  # Normalize: 8% return = full strength
    elif (ret <= sell_threshold['max_return'] and
          conf >= sell_threshold['min_confidence'] and
          bear >= sell_threshold['min_bear_days']):
        action = 'SELL'
        strength = min(1.0, abs(ret) / 0.08)
    else:
        action = 'HOLD'
        strength = 0.5

    # Sentiment modifier
    sent_score = sentiment_data.get('blended_sentiment', 0.0)
    confidence_note = None

    if action == 'BUY' and sent_score < -config.SENTIMENT_MODIFIER_THRESHOLD:
        conf *= 0.8
        confidence_note = "reduced: negative news sentiment"
    elif action == 'SELL' and sent_score > config.SENTIMENT_MODIFIER_THRESHOLD:
        conf *= 0.8
        confidence_note = "reduced: positive news sentiment contradicts signal"

    conf = np.clip(conf, 0, 1)
    strength = np.clip(strength, 0, 1)

    # Generate reasoning
    reasoning = _generate_reasoning(
        action=action,
        ticker=ticker,
        metrics=metrics,
        sentiment_data=sentiment_data
    )

    return {
        'ticker': ticker,
        'action': action,
        'confidence': round(conf, 3),
        'strength': round(strength, 3),
        'expected_return_7d_pct': round(ret * 100, 2),
        'current_price': metrics['current_price'],
        'target_price_7d': metrics['median_7d_price'],
        'price_range_7d': {
            'low': metrics['quantile_spread_low'],
            'high': metrics['quantile_spread_high'],
        },
        'forecast_days': {
            'bullish': metrics['bull_days'],
            'bearish': metrics['bear_days'],
            'neutral': metrics['neutral_days'],
        },
        'confidence_note': confidence_note,
        'reasoning': reasoning,
        'timestamp': datetime.utcnow().isoformat(),
    }


def _generate_reasoning(
    action: str,
    ticker: str,
    metrics: Dict[str, any],
    sentiment_data: Dict[str, any],
) -> str:
    """
    Generate deterministic, template-based reasoning.

    Args:
        action: 'BUY', 'SELL', or 'HOLD'
        ticker: Stock ticker
        metrics: From compute_quantile_metrics()
        sentiment_data: Sentiment features

    Returns:
        Natural language reasoning
    """
    ret_pct = metrics['expected_return'] * 100
    spread = metrics['quantile_spread_pct']
    sent_score = sentiment_data.get('blended_sentiment', 0.0)
    ann_flag = sentiment_data.get('announcement_flag', 0)
    ann_type = sentiment_data.get('announcement_type', 'none')
    bull = metrics['bull_days']
    bear = metrics['bear_days']

    # Sentiment descriptor
    if sent_score > 0.2:
        sent_desc = "positive"
    elif sent_score < -0.2:
        sent_desc = "negative"
    else:
        sent_desc = "neutral"

    # Build reasoning
    parts = []

    if action == 'BUY':
        parts.append(
            f"TFT model forecasts {ret_pct:.1f}% median upside over 7 days, "
            f"with {bull}/7 days showing bullish directional consensus."
        )
    elif action == 'SELL':
        parts.append(
            f"TFT model forecasts {ret_pct:.1f}% median downside over 7 days, "
            f"with {bear}/7 days showing bearish directional consensus."
        )
    else:
        parts.append(
            f"TFT model forecasts {ret_pct:.1f}% movement (±{spread:.1f}%) — "
            f"insufficient directional conviction for a strong signal."
        )

    # Add uncertainty
    if spread < 3:
        confidence_desc = "narrow (high confidence)"
    elif spread < 7:
        confidence_desc = "moderate"
    else:
        confidence_desc = "wide (lower confidence)"

    parts.append(
        f"Forecast uncertainty: {spread:.1f}% price range ({confidence_desc})."
    )

    # Add sentiment
    parts.append(f"Market sentiment is {sent_desc} (blended score: {sent_score:.2f}).")

    # Add announcement note
    if ann_flag == 1 and ann_type != 'none':
        parts.append(f"Note: PSX {ann_type} announcement flagged.")

    return " ".join(parts)


class SignalGenerator:
    """
    Generate trading signals from TFT predictions and market data.
    """

    def __init__(self, master_df: Optional[pd.DataFrame] = None):
        """
        Initialize signal generator.

        Args:
            master_df: Optional DataFrame with latest market data for sentiment/prices
        """
        self.master_df = master_df

    def generate_all_signals(
        self,
        predictions: Dict[str, np.ndarray],
        master_df: Optional[pd.DataFrame] = None,
    ) -> List[Dict]:
        """
        Generate signals for all tickers.

        Args:
            predictions: Dict mapping ticker → predictions (num_samples, num_quantiles, horizon)
            master_df: DataFrame with latest prices and sentiment

        Returns:
            List of signal dicts
        """
        if master_df is not None:
            self.master_df = master_df
        elif self.master_df is None:
            raise ValueError("No master_df provided")

        signals = []

        for ticker, preds in predictions.items():
            # Get current price
            ticker_data = self.master_df[self.master_df['Ticker'] == ticker]
            if len(ticker_data) == 0:
                logger.warning(f"No data for {ticker}, skipping")
                continue

            current_price = ticker_data['Close'].iloc[-1]

            # Get sentiment data
            sentiment_data = {
                'blended_sentiment': ticker_data['blended_sentiment'].iloc[-1],
                'sentiment_score': ticker_data['sentiment_score'].iloc[-1],
                'sentiment_count': int(ticker_data['sentiment_count'].iloc[-1]),
                'announcement_flag': int(ticker_data['announcement_flag'].iloc[-1]),
                'announcement_type': ticker_data['announcement_type'].iloc[-1],
            }

            # Handle multiple samples per ticker (if any)
            if preds.ndim == 2:
                # Single sample (7, 5)
                preds_7d = preds
            else:
                # Multiple samples, take the most recent
                preds_7d = preds[-1]

            # Generate signal
            signal = generate_signal(
                ticker=ticker,
                quantile_preds=preds_7d,
                current_price=current_price,
                sentiment_data=sentiment_data,
            )

            signals.append(signal)

        # Sort by confidence (descending)
        signals.sort(key=lambda x: x['confidence'], reverse=True)

        return signals


def format_signals_for_output(signals: List[Dict]) -> pd.DataFrame:
    """
    Format signal list as DataFrame for easy viewing/export.

    Args:
        signals: List of signal dicts

    Returns:
        DataFrame with signals
    """
    df = pd.DataFrame(signals)

    # Ensure reasonable column order
    cols_order = [
        'ticker', 'action', 'confidence', 'strength',
        'expected_return_7d_pct', 'current_price', 'target_price_7d',
        'forecast_days', 'confidence_note', 'reasoning'
    ]

    existing_cols = [c for c in cols_order if c in df.columns]
    other_cols = [c for c in df.columns if c not in existing_cols]

    return df[existing_cols + other_cols]
