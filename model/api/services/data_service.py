"""
Data freshness management.

Handles:
- Checking whether tft_ready_clean.csv has today's PSX data
- Running technical_updater.py as a subprocess (writes to data/processed/stocksense_tft_final.csv)
- Merging the new rows from the processed CSV into the TFT master CSV (data/final/tft_ready_clean.csv)
- Thread-safe reload of master_df after an update
"""

import asyncio
import logging
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import pytz

logger = logging.getLogger(__name__)

PKT = pytz.timezone("Asia/Karachi")

# Columns that technical_updater writes (all others will be forward-filled from last master row)
UPDATER_OUTPUT_COLS = [
    "Date", "Ticker", "Open", "High", "Low", "Close", "Volume",
    "Sector", "day_of_week", "month", "time_idx",
    "sma_20", "sma_50", "rsi_14", "vol_20",
    "market_index", "USD_PKR",
]

# Columns to forward-fill from last master row for new rows
FFILL_FROM_MASTER_COLS = [
    "oil_price", "fx_volatility", "market_volatility", "inflation_proxy",
    "market_momentum", "market_strength", "fx_risk",
    "sentiment_quality", "sentiment_ma_5", "days_since_announcement",
    "blended_sentiment", "proxy_sentiment", "relative_momentum",
    # Volume-based columns that will be 0-filled by preprocessing anyway
    "volume_ma_20", "volume_ratio", "volume_trend", "volume_signal",
    "obv_signal", "vpt", "price_direction",
    "rsi_sentiment", "momentum_signal",
    "sentiment_score", "sentiment_count",
    "announcement_flag", "announcement_type",
]


class DataService:
    def __init__(self, master_df: pd.DataFrame, project_root: Path):
        self._master_df = master_df
        self._project_root = project_root
        self._lock = threading.RLock()
        self._update_lock = asyncio.Lock()
        self._last_update: Optional[datetime] = None

    @property
    def master_df(self) -> pd.DataFrame:
        with self._lock:
            return self._master_df

    def refresh_master_df(self, new_df: pd.DataFrame) -> None:
        """Swap in a reloaded master_df (called after successful update)."""
        with self._lock:
            self._master_df = new_df
            logger.info(f"master_df refreshed: {len(new_df)} rows")

    def is_data_stale(self) -> bool:
        """
        Returns True if today's PSX trading data is missing from master_df.
        Weekends are never considered stale (no PSX trading).
        """
        now_pkt = datetime.now(PKT)
        if now_pkt.weekday() >= 5:  # Saturday=5, Sunday=6
            return False

        today = now_pkt.date()
        with self._lock:
            latest = pd.to_datetime(self._master_df["Date"]).max().date()
        return latest < today

    def data_as_of(self) -> str:
        """Return the latest date string in master_df."""
        with self._lock:
            return str(pd.to_datetime(self._master_df["Date"]).max().date())

    async def ensure_fresh(self) -> bool:
        """
        Daily freshness gate. Runs technical_updater once if data is stale,
        then merges new rows into master CSV and reloads master_df.
        Uses an asyncio.Lock to prevent concurrent updater runs.
        Returns True if data is already fresh or update succeeded.
        """
        if not self.is_data_stale():
            logger.info("Data is up-to-date, skipping update.")
            return True

        async with self._update_lock:
            # Double-check after acquiring lock
            if not self.is_data_stale():
                return True

            logger.info("Data is stale — running technical_updater...")
            success = await self._run_technical_updater()

            if success:
                logger.info("Merging new rows into master CSV...")
                merged = await asyncio.to_thread(self._merge_new_rows)
                if merged:
                    new_df = await asyncio.to_thread(self._reload_master_csv)
                    self.refresh_master_df(new_df)
                    self._last_update = datetime.now(timezone.utc)
                    logger.info("Data update complete.")
                    return True
                else:
                    logger.warning("No new rows to merge (market may be closed).")
                    return False
            else:
                logger.warning("technical_updater failed — serving with current data.")
                return False

    async def background_retry_update(self) -> None:
        """Background task to retry data update (used when startup times out)."""
        logger.info("Background retry: waiting 60s before re-attempting data update...")
        await asyncio.sleep(60)
        try:
            await asyncio.wait_for(self.ensure_fresh(), timeout=300.0)
        except Exception as e:
            logger.error(f"Background retry failed: {e}")

    # ── Private helpers ───────────────────────────────────────────────────

    async def _run_technical_updater(self) -> bool:
        updater_path = self._project_root / "scrappers" / "technical_updater.py"
        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                str(updater_path),
                cwd=str(self._project_root),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
            if proc.returncode == 0:
                logger.info("technical_updater completed successfully.")
                return True
            else:
                logger.warning(f"technical_updater exit code {proc.returncode}: {stderr.decode()[:300]}")
                return False
        except asyncio.TimeoutError:
            logger.warning("technical_updater timed out after 300s.")
            proc.kill()
            return False
        except Exception as e:
            logger.error(f"technical_updater error: {e}")
            return False

    def _merge_new_rows(self) -> bool:
        """
        Read new rows from data/processed/stocksense_tft_final.csv
        and append them to data/final/tft_ready_clean.csv.
        Returns True if rows were merged.
        """
        processed_csv = self._project_root / "data" / "processed" / "stocksense_tft_final.csv"
        master_csv = self._project_root / "data" / "final" / "tft_ready_clean.csv"

        if not processed_csv.exists():
            logger.warning(f"Processed CSV not found: {processed_csv}")
            return False

        try:
            processed_df = pd.read_csv(processed_csv)
            processed_df["Date"] = pd.to_datetime(processed_df["Date"])

            master_df = pd.read_csv(master_csv)
            master_df["Date"] = pd.to_datetime(master_df["Date"])

            master_max_date = master_df["Date"].max()
            new_rows = processed_df[processed_df["Date"] > master_max_date].copy()

            if new_rows.empty:
                return False

            logger.info(f"Found {len(new_rows)} new rows to merge.")

            # For each new row, forward-fill missing master columns from last master row per ticker
            last_master_rows = master_df.groupby("Ticker").last().reset_index()

            enriched_rows = []
            for _, new_row in new_rows.iterrows():
                ticker = new_row["Ticker"]
                last = last_master_rows[last_master_rows["Ticker"] == ticker]
                row_dict = new_row.to_dict()

                for col in FFILL_FROM_MASTER_COLS:
                    if col not in row_dict or pd.isna(row_dict.get(col)):
                        if not last.empty and col in last.columns:
                            row_dict[col] = last[col].iloc[0]
                        else:
                            row_dict[col] = 0.0

                enriched_rows.append(row_dict)

            if not enriched_rows:
                return False

            new_df = pd.DataFrame(enriched_rows)

            # Align columns with master_df
            for col in master_df.columns:
                if col not in new_df.columns:
                    new_df[col] = 0.0

            new_df = new_df[master_df.columns]

            combined = pd.concat([master_df, new_df], ignore_index=True)
            combined = combined.sort_values(["Ticker", "Date"]).reset_index(drop=True)
            combined.to_csv(master_csv, index=False)

            logger.info(f"Merged {len(new_df)} rows into {master_csv}")
            return True

        except Exception as e:
            logger.error(f"Merge failed: {e}", exc_info=True)
            return False

    def _reload_master_csv(self) -> pd.DataFrame:
        master_csv = self._project_root / "data" / "final" / "tft_ready_clean.csv"
        df = pd.read_csv(master_csv)
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values(["Ticker", "Date"]).reset_index(drop=True)
        logger.info(f"Reloaded master CSV: {len(df)} rows")
        return df
