#!/usr/bin/env python
"""
Quick test of TFT preprocessing pipeline on sample data.
"""

import pandas as pd
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from tft import config, preprocessing


def test_preprocessing():
    """Test preprocessing pipeline on master CSV."""
    print("=" * 80)
    print("TFT PREPROCESSING TEST")
    print("=" * 80)

    # Load master CSV
    if not config.MASTER_CSV.exists():
        print(f"✗ Master CSV not found: {config.MASTER_CSV}")
        return False

    print(f"\n1. Loading {config.MASTER_CSV}")
    df = pd.read_csv(config.MASTER_CSV)
    print(f"   Loaded {len(df)} rows, {df['Ticker'].nunique()} tickers")

    # Parse and sort
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Apply preprocessing
    print(f"\n2. Applying preprocessing pipeline")
    try:
        df_processed = preprocessing.apply_preprocessing_pipeline(
            df,
            stage="inference",
            scaler_params=None
        )
        print(f"   ✓ Preprocessing complete")
    except Exception as e:
        print(f"   ✗ Preprocessing failed: {e}")
        return False

    # Validate
    print(f"\n3. Validating preprocessing")
    validation = preprocessing.validate_preprocessing(df_processed)
    print(f"   Total rows: {validation['total_rows']}")
    print(f"   Unique tickers: {validation['unique_tickers']}")
    print(f"   Date range: {validation['date_range'][0]} to {validation['date_range'][1]}")
    print(f"   time_idx valid: {validation['time_idx_valid']}")

    # Check required columns
    print(f"\n4. Checking required columns")
    required_cols = (
        config.STATIC_CATEGORICALS +
        config.TIME_VARYING_KNOWN_CATEGORICALS +
        config.TIME_VARYING_KNOWN_REALS +
        config.TIME_VARYING_UNKNOWN_REALS +
        ["Date", "time_idx"]
    )

    missing = [c for c in required_cols if c not in df_processed.columns]
    if missing:
        print(f"   ✗ Missing columns: {missing}")
        return False
    else:
        print(f"   ✓ All {len(required_cols)} required columns present")

    # Check for NaNs in critical columns
    print(f"\n5. Checking for NaNs in critical columns")
    critical_cols = ['Close', 'Ticker', 'Date', 'time_idx', 'announcement_type']
    nans = {}
    for col in critical_cols:
        if col in df_processed.columns:
            nan_count = df_processed[col].isnull().sum()
            if nan_count > 0:
                nans[col] = nan_count

    if nans:
        print(f"   ✗ NaNs found: {nans}")
        return False
    else:
        print(f"   ✓ No NaNs in critical columns")

    # Test build_inference_window
    print(f"\n6. Testing build_inference_window")
    try:
        window = preprocessing.build_inference_window(
            df_processed,
            sentiment_df=None,
            lookback_days=config.INFERENCE_LOOKBACK_DAYS,
            future_days=config.INFERENCE_FUTURE_DAYS,
        )
        print(f"   ✓ Window created: {len(window)} rows")
        print(f"     Expected: ~30 tickers × (120 historical + 7 future) = ~3810 rows")
    except Exception as e:
        print(f"   ✗ Window creation failed: {e}")
        return False

    # Print sample row
    print(f"\n7. Sample processed row (OGDC, most recent)")
    ogdc_data = df_processed[df_processed['Ticker'] == 'OGDC'].sort_values('Date').tail(1)
    if len(ogdc_data) > 0:
        print(f"   Date: {ogdc_data['Date'].iloc[0]}")
        print(f"   Close: {ogdc_data['Close'].iloc[0]:.2f}")
        print(f"   time_idx: {ogdc_data['time_idx'].iloc[0]}")
        print(f"   blended_sentiment: {ogdc_data['blended_sentiment'].iloc[0]:.3f}")
        print(f"   announcement_type: {ogdc_data['announcement_type'].iloc[0]}")

    print("\n" + "=" * 80)
    print("✓ ALL TESTS PASSED")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = test_preprocessing()
    sys.exit(0 if success else 1)
