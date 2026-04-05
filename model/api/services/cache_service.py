"""
In-memory per-ticker signal cache with TTL and midnight invalidation (PKT timezone).
Thread-safe. Per-ticker asyncio.Lock prevents thundering-herd on cache misses.
"""

import asyncio
import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

import pytz

logger = logging.getLogger(__name__)

PKT = pytz.timezone("Asia/Karachi")


@dataclass
class CacheEntry:
    signal: dict
    cached_at: datetime          # UTC
    trading_date: str            # YYYY-MM-DD in PKT — used for midnight invalidation


class CacheService:
    def __init__(self, ttl_minutes: int = 60):
        self._cache: Dict[str, CacheEntry] = {}
        self._ttl_minutes = ttl_minutes
        self._lock = threading.RLock()                    # for sync dict access
        self._inference_locks: Dict[str, asyncio.Lock] = {}  # per-ticker async lock
        self.last_set_time: Optional[datetime] = None

    # ── Public API ────────────────────────────────────────────────────────

    def get(self, ticker: str) -> Optional[dict]:
        """Return cached signal dict or None if missing/expired."""
        with self._lock:
            entry = self._cache.get(ticker)
            if entry is None:
                return None
            if self._is_expired(entry):
                del self._cache[ticker]
                logger.debug(f"Cache expired for {ticker}")
                return None
            return entry.signal

    def set(self, ticker: str, signal: dict) -> None:
        """Store signal in cache."""
        now_pkt = datetime.now(PKT)
        with self._lock:
            self._cache[ticker] = CacheEntry(
                signal=signal,
                cached_at=datetime.now(timezone.utc),
                trading_date=now_pkt.strftime("%Y-%m-%d"),
            )
            self.last_set_time = datetime.now(timezone.utc)
        logger.debug(f"Cached signal for {ticker}")

    def invalidate(self, ticker: Optional[str] = None) -> int:
        """
        Bust cache for a single ticker, or all tickers if ticker is None.
        Returns number of entries removed.
        """
        with self._lock:
            if ticker:
                removed = 1 if self._cache.pop(ticker, None) is not None else 0
            else:
                removed = len(self._cache)
                self._cache.clear()
        logger.info(f"Cache invalidated: {removed} entr{'y' if removed == 1 else 'ies'}")
        return removed

    def get_inference_lock(self, ticker: str) -> asyncio.Lock:
        """
        Per-ticker asyncio.Lock — prevents two concurrent requests from both
        running inference for the same ticker simultaneously.
        Must be called from async context (event loop must exist).
        """
        with self._lock:
            if ticker not in self._inference_locks:
                self._inference_locks[ticker] = asyncio.Lock()
            return self._inference_locks[ticker]

    def status(self) -> dict:
        """Return cache status dict for /health endpoint."""
        with self._lock:
            valid = {t: e for t, e in self._cache.items() if not self._is_expired(e)}
            return {
                "cache_entries": len(valid),
                "tickers_cached": sorted(valid.keys()),
                "last_set_time": self.last_set_time.isoformat() if self.last_set_time else None,
                "ttl_minutes": self._ttl_minutes,
            }

    # ── Internal ──────────────────────────────────────────────────────────

    def _is_expired(self, entry: CacheEntry) -> bool:
        now_pkt = datetime.now(PKT)
        today_str = now_pkt.strftime("%Y-%m-%d")

        # Midnight invalidation: signal from a previous trading day
        if entry.trading_date != today_str:
            return True

        # TTL check
        age_seconds = (datetime.now(timezone.utc) - entry.cached_at).total_seconds()
        return age_seconds > self._ttl_minutes * 60
