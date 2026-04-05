"""
StockSense V1 — FastAPI application entry point.

Startup sequence:
  1. Resolve PROJECT_ROOT (STOCKSENSE_ROOT env var → auto-detect → error)
  2. Patch sys.path so `tft.*` and `scrappers.*` are importable
  3. Load master CSV into memory
  4. Load TFT model (TFTInferenceEngine) in thread pool (~20-30s on CPU)
  5. Run data freshness gate (runs technical_updater if today's data is missing)
  6. Start serving requests

Run with:
    cd d:\StockSenseV1
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

Or:
    python -m api.main
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

# ── Resolve PROJECT_ROOT before any project imports ───────────────────────

def _resolve_project_root() -> Path:
    """
    Priority order:
    1. STOCKSENSE_ROOT env var  (use this on target machines)
    2. Auto-detect: api/ is a direct child of project root
    3. Raise RuntimeError with helpful message
    """
    from dotenv import load_dotenv
    load_dotenv()

    env_root = os.environ.get("STOCKSENSE_ROOT")
    if env_root:
        candidate = Path(env_root).resolve()
        if (candidate / "tft" / "config.py").exists():
            return candidate
        raise RuntimeError(
            f"STOCKSENSE_ROOT='{env_root}' does not contain tft/config.py — check the path."
        )

    # Auto-detect: this file is at <project_root>/api/main.py
    candidate = Path(__file__).parent.parent.resolve()
    if (candidate / "tft" / "config.py").exists():
        return candidate

    raise RuntimeError(
        "Cannot locate project root. Set STOCKSENSE_ROOT=/path/to/StockSenseV1 in your .env file."
    )


PROJECT_ROOT = _resolve_project_root()

# Patch sys.path so `tft.*` and `scrappers.*` are importable regardless of CWD
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ── Now safe to import project modules ────────────────────────────────────

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import health, signals, tickers
from api.services.cache_service import CacheService
from api.services.data_service import DataService
from api.services.inference_service import InferenceService

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Startup / shutdown lifespan ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("StockSense V1 API — Starting up")
    logger.info(f"Project root: {PROJECT_ROOT}")
    logger.info("=" * 60)

    # 1. Load master CSV
    logger.info("Loading master CSV into memory...")
    try:
        master_df = await asyncio.to_thread(_load_master_csv)
        logger.info(
            f"Master CSV loaded: {len(master_df):,} rows, "
            f"{master_df['Ticker'].nunique()} tickers, "
            f"latest date: {pd.to_datetime(master_df['Date']).max().date()}"
        )
    except Exception as e:
        logger.error(f"Failed to load master CSV: {e}")
        raise

    # 2. Load TFT model (expensive — ~20-30s on CPU)
    logger.info("Loading TFT model (may take 20-30s on CPU)...")
    try:
        from tft.inference import TFTInferenceEngine
        engine = await asyncio.to_thread(TFTInferenceEngine)
        logger.info("TFT model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load TFT model: {e}")
        raise

    # 3. Initialise services
    ttl = int(os.getenv("CACHE_TTL_MINUTES", "60"))
    cache_svc = CacheService(ttl_minutes=ttl)
    data_svc = DataService(master_df, PROJECT_ROOT)
    inference_svc = InferenceService(engine, master_df)

    # 4. Data freshness gate (runs technical_updater if today's data is missing)
    logger.info("Checking data freshness...")
    try:
        updated = await asyncio.wait_for(data_svc.ensure_fresh(), timeout=150.0)
        if updated and data_svc._last_update:
            # Reload master_df into inference_svc after update
            inference_svc.refresh_master_df(data_svc.master_df)
            logger.info("Data refreshed from PSX.")
    except asyncio.TimeoutError:
        logger.warning(
            "Data freshness check exceeded 150s — serving with current data. "
            "Background retry scheduled."
        )
        asyncio.create_task(data_svc.background_retry_update())
    except Exception as e:
        logger.warning(f"Data freshness check error: {e} — continuing with current data.")

    # 5. Store everything on app.state
    app.state.engine = engine
    app.state.data_svc = data_svc
    app.state.cache_svc = cache_svc
    app.state.inference_svc = inference_svc
    app.state.project_root = PROJECT_ROOT
    app.state.artifacts_path = PROJECT_ROOT / "artifacts" / "artifactsv1"
    app.state.startup_time = datetime.now(timezone.utc)

    logger.info("=" * 60)
    logger.info("StockSense V1 API — Ready to serve requests")
    logger.info(
        f"Endpoints: /signals/{{ticker}}  /tickers  /health  /refresh/{{ticker}}"
    )
    logger.info("=" * 60)

    yield  # ── serve requests ──────────────────────────────────────────────

    logger.info("StockSense V1 API — Shutting down.")
    app.state.engine = None


# ── App factory ───────────────────────────────────────────────────────────

app = FastAPI(
    title="StockSense V1 API",
    description=(
        "Pakistan KSE-30 stock forecasting API powered by Temporal Fusion Transformer. "
        "Per-ticker on-demand inference fused with Groq/Gemini LLM reasoning."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins for local/dev; tighten via env in production
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(signals.router, tags=["Signals"])
app.include_router(tickers.router, tags=["Tickers"])
app.include_router(health.router, tags=["Health"])


# ── Internal helpers ──────────────────────────────────────────────────────

def _load_master_csv() -> pd.DataFrame:
    from tft import config
    if not config.MASTER_CSV.exists():
        raise FileNotFoundError(f"Master CSV not found: {config.MASTER_CSV}")
    df = pd.read_csv(config.MASTER_CSV)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["Ticker", "Date"]).reset_index(drop=True)
    return df


# ── Run directly ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("api.main:app", host=host, port=port, reload=False)
