"""
Per-ticker TFT inference wrapper.

Key design:
- TFTInferenceEngine is loaded ONCE on startup and shared here via InferenceService.
- Per-request: slice master_df to a single ticker, inject fresh sentiment,
  apply preprocessing, build inference window, run TFT predict, generate signal.
- No modifications to existing tft/ code — reuses preprocessing, dataset, signals as-is.
"""

import logging
from typing import Dict, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# ── Trust level registry ──────────────────────────────────────────────────

TRUST_LEVELS: Dict[str, str] = {
    # High — MAPE < 10%
    "PSO": "high", "PPL": "high", "ILP": "high", "POL": "high", "OGDC": "high",
    # Low — MAPE > 20% (model struggles on these)
    "FFC": "low", "EFERT": "low", "MEBL": "low", "ATRL": "low",
}

TRUST_NOTES: Dict[str, str] = {
    "FFC": "Model MAPE 56.7% on FFC — fertilizer regime change causes high error. Treat as directional signal only.",
    "EFERT": "Model MAPE 43.8% on EFERT — similar regime issue to FFC. Price targets are unreliable.",
    "MEBL": "Model MAPE 36.2% on MEBL — post-listing volatility. Treat confidence scores conservatively.",
    "ATRL": "Model shows high uncertainty for ATRL — use price range as a wide guide, not a precise target.",
}

COMPANY_NAMES: Dict[str, str] = {
    "ATRL": "Attock Refinery Ltd",
    "BAFL": "Bank Al Falah Ltd",
    "BAHL": "Bank Al Habib Ltd",
    "CHCC": "Cherat Cement Co.",
    "DGKC": "D.G. Khan Cement Co.",
    "EFERT": "Engro Fertilizers Ltd",
    "FABL": "Faysal Bank Ltd",
    "FCCL": "Fauji Cement Co. Ltd",
    "FFC": "Fauji Fertilizer Co.",
    "HBL": "Habib Bank Ltd",
    "HUBC": "Hub Power Co. Ltd",
    "ILP": "International Leasing & Placement",
    "INIL": "Ini Limited (Glass)",
    "LUCK": "Lucky Cement Ltd",
    "MCB": "MCB Bank Ltd",
    "MEBL": "Meezan Bank Ltd",
    "MLCF": "Maple Leaf Cement Factory",
    "NBP": "National Bank of Pakistan",
    "OGDC": "Oil & Gas Dev. Co.",
    "PAEL": "Pak Elektron Ltd",
    "POL": "Pakistan Oilfields Ltd",
    "PPL": "Pakistan Petroleum Ltd",
    "PRL": "Pak Refinery Ltd",
    "PSO": "Pakistan State Oil Co.",
    "SEARL": "Searle Company Ltd",
    "SYS": "Systems Ltd",
    "TGL": "Tariq Glass Industries",
    "UBL": "United Bank Ltd",
}


class InferenceService:
    def __init__(self, engine, master_df: pd.DataFrame):
        """
        Args:
            engine: Loaded TFTInferenceEngine instance (singleton from startup).
            master_df: Full master DataFrame (tft_ready_clean.csv) already loaded.
        """
        self.engine = engine
        self._master_df = master_df.copy()

    def refresh_master_df(self, new_df: pd.DataFrame) -> None:
        """Swap master_df after a data update. Called by DataService."""
        self._master_df = new_df.copy()
        logger.info("InferenceService: master_df refreshed.")

    def run_ticker_inference(self, ticker: str, sentiment: dict) -> dict:
        """
        Full per-ticker pipeline:
            slice → inject sentiment → preprocess → build window → TFT predict → signal

        This is SYNCHRONOUS — call via asyncio.to_thread() in the route handler.

        Args:
            ticker: KSE-30 ticker symbol (e.g. "OGDC")
            sentiment: Dict from get_sentiment(ticker) — keys: sentiment_score,
                       headline_count, key_headlines, reasoning, source, confidence, weight

        Returns:
            Signal dict (from tft.signals.generate_signal) with extra _raw_preds_7d key.
        """
        from tft import config, preprocessing
        from tft.signals import SignalGenerator

        # 1. Slice master_df to this ticker only
        ticker_df = self._master_df[self._master_df["Ticker"] == ticker].copy()
        if ticker_df.empty:
            raise ValueError(f"No data for ticker '{ticker}' in master CSV.")

        logger.info(f"[{ticker}] Sliced {len(ticker_df)} rows from master_df.")

        # 2. Inject fresh sentiment into the last historical row
        ticker_df = self._inject_sentiment(ticker_df, sentiment)

        # 3. Apply preprocessing pipeline (remap time_idx, fill NaNs, compute proxy/blended sentiment)
        ticker_df = preprocessing.apply_preprocessing_pipeline(
            ticker_df, stage="inference", scaler_params=self.engine.scaler_params
        )

        # 4. Build inference window (last 120 historical rows + 7 future rows)
        #    build_inference_window iterates config.KSE30_STOCKS but only finds this ticker's data
        window_df = preprocessing.build_inference_window(
            ticker_df,
            sentiment_df=None,   # already injected above
            lookback_days=config.INFERENCE_LOOKBACK_DAYS,
            future_days=config.INFERENCE_FUTURE_DAYS,
        )

        if window_df.empty:
            raise RuntimeError(f"build_inference_window returned empty DataFrame for {ticker}.")

        logger.info(f"[{ticker}] Inference window: {len(window_df)} rows.")

        # 5. Run TFT prediction
        raw_preds, index_df = self.engine.predict_sliding_window(window_df)

        # 6. Extract predictions for this ticker
        tickers_in_output = (
            index_df["Ticker"].values if "Ticker" in index_df.columns else [ticker]
        )
        denormalized = self.engine.denormalize_predictions(raw_preds, tickers_in_output)

        preds_7d = denormalized.get(ticker)
        if preds_7d is None:
            raise RuntimeError(f"TFT produced no predictions for {ticker}.")

        # Ensure shape is (7, 5)
        if preds_7d.ndim == 3:
            preds_7d = preds_7d[-1]  # take most recent window if multiple

        logger.info(f"[{ticker}] Predictions shape: {preds_7d.shape}")

        # 7. Generate base signal via SignalGenerator
        gen = SignalGenerator(master_df=ticker_df)
        signal_list = gen.generate_all_signals(
            predictions={ticker: preds_7d},
            master_df=ticker_df,
        )

        if not signal_list:
            raise RuntimeError(f"SignalGenerator produced no signal for {ticker}.")

        signal = signal_list[0]

        # 10. Attach raw quantile array for the response builder (removed before caching)
        signal["_raw_preds_7d"] = preds_7d.tolist()

        logger.info(
            f"[{ticker}] Signal: {signal['action']} conf={signal['confidence']:.3f} "
            f"ret={signal['expected_return_7d_pct']:+.1f}%"
        )

        return signal

    # ── Static helpers ────────────────────────────────────────────────────

    @staticmethod
    def _inject_sentiment(ticker_df: pd.DataFrame, sentiment: dict) -> pd.DataFrame:
        """
        Overwrite the last historical row's sentiment fields with freshly scraped values.
        Recomputes proxy_sentiment and blended_sentiment on the tail.
        """
        from tft import preprocessing

        df = ticker_df.copy()
        last_idx = df.index[-1]

        new_score = float(sentiment.get("sentiment_score", 0.0))
        new_count = int(sentiment.get("headline_count", 0))

        df.loc[last_idx, "sentiment_score"] = new_score
        df.loc[last_idx, "sentiment_count"] = new_count

        # Recompute derived sentiment columns
        df = preprocessing.compute_proxy_sentiment(df)
        df = preprocessing.compute_blended_sentiment(df)

        return df

    @staticmethod
    def _build_sentiment_data(ticker_df: pd.DataFrame) -> dict:
        """Build sentiment_data dict expected by generate_signal."""
        last = ticker_df.iloc[-1]
        return {
            "blended_sentiment": float(last.get("blended_sentiment", 0.0)),
            "sentiment_score": float(last.get("sentiment_score", 0.0)),
            "sentiment_count": int(last.get("sentiment_count", 0)),
            "announcement_flag": int(last.get("announcement_flag", 0)),
            "announcement_type": str(last.get("announcement_type", "none")),
        }

    @staticmethod
    def get_trust(ticker: str) -> Tuple[str, Optional[str]]:
        """Return (trust_level, trust_note) for a ticker."""
        level = TRUST_LEVELS.get(ticker, "medium")
        note = TRUST_NOTES.get(ticker)
        return level, note

    @staticmethod
    def get_company_name(ticker: str) -> str:
        return COMPANY_NAMES.get(ticker, ticker)


# ── Module-level helpers (importable without instantiating InferenceService) ──

def get_trust_level_for_ticker(ticker: str):
    """Return (trust_level, trust_note) tuple for a ticker."""
    level = TRUST_LEVELS.get(ticker, "medium")
    note = TRUST_NOTES.get(ticker)
    return level, note
