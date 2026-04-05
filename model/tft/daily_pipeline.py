"""
Daily inference pipeline orchestration.
Runs after market close to generate trading signals for next 7 days.

Usage:
    python -m tft.daily_pipeline
"""

import pandas as pd
import json
import subprocess
import logging
from pathlib import Path
from datetime import datetime

from . import config, preprocessing, inference, signals

# Configure logging
logging.basicConfig(
    level=config.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_scraper_update() -> bool:
    """
    Run technical and sentiment scrapers to update master CSV.

    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 80)
    logger.info("STEP 1: Running data scrapers to update master CSV")
    logger.info("=" * 80)

    scrapers = [
        ("Technical Updater", "python scrappers/technical_updater.py"),
        ("Sentiment Scraper", "python scrappers/Gemini_Sentiment.py --all"),
    ]

    all_success = True
    for step_name, cmd in scrapers:
        logger.info(f"\n→ Running: {step_name}")
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=config.PROJECT_ROOT,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout per scraper
            )
            if result.returncode == 0:
                logger.info(f"✓ {step_name} completed successfully")
                if result.stdout:
                    logger.debug(f"  Output: {result.stdout[:200]}")
            else:
                logger.warning(f"⚠ {step_name} failed with code {result.returncode}")
                if result.stderr:
                    logger.warning(f"  Error: {result.stderr[:200]}")
                all_success = False
        except subprocess.TimeoutExpired:
            logger.warning(f"⚠ {step_name} timed out (> 10 minutes)")
            all_success = False
        except Exception as e:
            logger.warning(f"⚠ {step_name} error: {e}")
            all_success = False

    if not all_success:
        logger.warning("⚠ Some scrapers failed — proceeding with stale data")

    return all_success


def load_and_preprocess_data() -> pd.DataFrame:
    """
    Load master CSV and preprocess for inference.

    Returns:
        Preprocessed DataFrame
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 2: Loading and preprocessing data")
    logger.info("=" * 80)

    # Load master CSV
    if not config.MASTER_CSV.exists():
        raise FileNotFoundError(f"Master CSV not found: {config.MASTER_CSV}")

    logger.info(f"→ Loading {config.MASTER_CSV}")
    df = pd.read_csv(config.MASTER_CSV)
    logger.info(f"  Loaded {len(df)} rows, {df['Ticker'].nunique()} tickers")

    # Parse dates
    df['Date'] = pd.to_datetime(df['Date'])

    # Sort
    df = df.sort_values(['Ticker', 'Date']).reset_index(drop=True)

    # Preprocess
    logger.info("→ Applying preprocessing pipeline")
    df = preprocessing.apply_preprocessing_pipeline(
        df,
        stage="inference",
        scaler_params=None
    )

    # Validate
    validation = preprocessing.validate_preprocessing(df)
    logger.info(f"✓ Preprocessing validation:")
    logger.info(f"  Total rows: {validation['total_rows']}")
    logger.info(f"  Unique tickers: {validation['unique_tickers']}")
    logger.info(f"  Date range: {validation['date_range'][0]} to {validation['date_range'][1]}")
    logger.info(f"  time_idx valid: {validation['time_idx_valid']}")

    return df


def run_inference_engine(df: pd.DataFrame) -> dict:
    """
    Run TFT inference engine.

    Args:
        df: Preprocessed DataFrame

    Returns:
        Dict mapping ticker → quantile predictions
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 3: Running TFT inference")
    logger.info("=" * 80)

    logger.info("→ Initializing inference engine")
    try:
        engine = inference.TFTInferenceEngine()
    except RuntimeError as e:
        logger.error(f"✗ Failed to load model: {e}")
        logger.error("  Have you trained and downloaded artifacts from Kaggle?")
        logger.error(f"  Expected at: {config.ARTIFACTS_DIR}")
        raise

    # Load sentiment CSV if available and merge into inference window
    sentiment_df = None
    if config.SENTIMENT_DAILY_CSV.exists():
        try:
            sentiment_df = pd.read_csv(config.SENTIMENT_DAILY_CSV)
            sentiment_df['Date'] = pd.to_datetime(sentiment_df['Date'])
            logger.info(f"→ Loaded sentiment data: {len(sentiment_df)} rows up to {sentiment_df['Date'].max().date()}")
        except Exception as e:
            logger.warning(f"⚠ Could not load sentiment CSV: {e} — proceeding without sentiment")

    logger.info("→ Building inference window")
    window_df = preprocessing.build_inference_window(
        df,
        sentiment_df=sentiment_df,
        lookback_days=config.INFERENCE_LOOKBACK_DAYS,
        future_days=config.INFERENCE_FUTURE_DAYS,
    )
    logger.info(f"  Window: {len(window_df)} rows")

    logger.info("→ Running TFT predictions")
    raw_preds, index_df = engine.predict_sliding_window(window_df)
    logger.info(f"  Predictions shape: {raw_preds.shape}")

    logger.info("→ Denormalizing predictions to PKR prices")
    tickers = index_df['Ticker'].values if 'Ticker' in index_df.columns else []
    denormalized = engine.denormalize_predictions(raw_preds, tickers)
    logger.info(f"✓ Inference complete for {len(denormalized)} tickers")

    return denormalized


def generate_trading_signals(predictions: dict, master_df: pd.DataFrame) -> list:
    """
    Generate BUY/HOLD/SELL signals from predictions.

    Args:
        predictions: Dict mapping ticker → quantile predictions
        master_df: DataFrame with current market data

    Returns:
        List of signal dicts
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 4: Generating trading signals")
    logger.info("=" * 80)

    logger.info("→ Initializing signal generator")
    gen = signals.SignalGenerator(master_df=master_df)

    logger.info("→ Generating signals")
    signal_list = gen.generate_all_signals(predictions)

    logger.info(f"✓ Generated signals for {len(signal_list)} tickers")
    logger.info("\n  Signal Summary:")
    buy_count = sum(1 for s in signal_list if s['action'] == 'BUY')
    sell_count = sum(1 for s in signal_list if s['action'] == 'SELL')
    hold_count = sum(1 for s in signal_list if s['action'] == 'HOLD')
    logger.info(f"    BUY:  {buy_count}")
    logger.info(f"    SELL: {sell_count}")
    logger.info(f"    HOLD: {hold_count}")

    return signal_list


def save_signals(signal_list: list) -> Path:
    """
    Save signals to JSON file.

    Args:
        signal_list: List of signal dicts

    Returns:
        Path to saved file
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 5: Saving signals")
    logger.info("=" * 80)

    config.SIGNALS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.utcnow().strftime('%Y%m%d')
    output_path = config.SIGNALS_OUTPUT_DIR / f"signals_{today}.json"

    logger.info(f"→ Saving to {output_path}")
    with open(output_path, 'w') as f:
        json.dump(signal_list, f, indent=2)

    logger.info(f"✓ Signals saved ({len(signal_list)} tickers)")

    return output_path


def print_signals_summary(signal_list: list):
    """
    Print summary of top signals.

    Args:
        signal_list: List of signal dicts
    """
    print("\n" + "=" * 80)
    print("TRADING SIGNALS SUMMARY")
    print("=" * 80)

    # Sort by confidence
    sorted_signals = sorted(signal_list, key=lambda x: x['confidence'], reverse=True)

    print("\nTop 10 Signals (by confidence):")
    print("-" * 80)
    print(f"{'Ticker':<8} {'Action':<6} {'Conf':<6} {'Return':<10} {'Price':<10} {'Target':<10}")
    print("-" * 80)

    for sig in sorted_signals[:10]:
        ticker = sig['ticker']
        action = sig['action']
        conf = sig['confidence']
        ret = sig['expected_return_7d_pct']
        price = sig['current_price']
        target = sig['target_price_7d']

        print(f"{ticker:<8} {action:<6} {conf:<6.2f} {ret:>+8.1f}% {price:>9.2f} {target:>9.2f}")

    print("-" * 80)

    # BUY signals
    buys = [s for s in sorted_signals if s['action'] == 'BUY']
    if buys:
        print(f"\n[BUY] Signals ({len(buys)}):")
        for sig in buys:
            print(f"  {sig['ticker']:6} -> {sig['target_price_7d']:.2f} ({sig['expected_return_7d_pct']:+.1f}%) "
                  f"conf={sig['confidence']:.2f}")

    # SELL signals
    sells = [s for s in sorted_signals if s['action'] == 'SELL']
    if sells:
        print(f"\n[SELL] Signals ({len(sells)}):")
        for sig in sells:
            print(f"  {sig['ticker']:6} -> {sig['target_price_7d']:.2f} ({sig['expected_return_7d_pct']:+.1f}%) "
                  f"conf={sig['confidence']:.2f}")

    print("\n" + "=" * 80)


def main():
    """
    Run complete daily inference pipeline.
    """
    logger.info("\n" + "=" * 80)
    logger.info("STOCKSENSE TFT DAILY INFERENCE PIPELINE")
    logger.info(f"Started: {datetime.utcnow().isoformat()}")
    logger.info("=" * 80)

    try:
        # Step 1: Update data with scrapers
        run_scraper_update()

        # Step 2: Load and preprocess
        master_df = load_and_preprocess_data()

        # Step 3: Run TFT inference
        predictions = run_inference_engine(master_df)

        # Step 4: Generate signals
        signal_list = generate_trading_signals(predictions, master_df)

        # Step 5: Save signals
        output_path = save_signals(signal_list)

        # Print summary
        print_signals_summary(signal_list)

        logger.info("\n" + "=" * 80)
        logger.info("✓ PIPELINE COMPLETE")
        logger.info(f"Signals saved to: {output_path}")
        logger.info("=" * 80)

    except Exception as e:
        logger.error("\n" + "=" * 80)
        logger.error("✗ PIPELINE FAILED")
        logger.error(f"Error: {e}")
        logger.error("=" * 80, exc_info=True)
        raise


if __name__ == "__main__":
    main()
