"""
Health and cache-management endpoints.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Request

from api.models.schemas import HealthResponse, RefreshResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="API health and status")
async def health_check(request: Request):
    state = request.app.state
    uptime = (datetime.now(timezone.utc) - state.startup_time).total_seconds()

    data_svc = state.data_svc
    cache_status = state.cache_svc.status()

    engine_loaded = state.engine is not None

    return HealthResponse(
        status="ok" if engine_loaded else "error",
        model_loaded=engine_loaded,
        data_as_of=data_svc.data_as_of(),
        data_stale=data_svc.is_data_stale(),
        last_data_update=(
            data_svc._last_update.isoformat() if data_svc._last_update else None
        ),
        cache_entries=cache_status["cache_entries"],
        tickers_cached=cache_status["tickers_cached"],
        startup_time=state.startup_time.isoformat(),
        uptime_seconds=round(uptime, 1),
        artifacts_path=str(state.artifacts_path),
    )


@router.post(
    "/refresh/{ticker}",
    response_model=RefreshResponse,
    summary="Bust cache for a ticker (or ALL)",
)
async def refresh_cache(ticker: str, request: Request):
    ticker_upper = ticker.upper()
    cache = request.app.state.cache_svc

    if ticker_upper == "ALL":
        removed = cache.invalidate()
        return RefreshResponse(
            status="ok",
            invalidated="ALL",
            message=f"Invalidated {removed} cache entries.",
        )

    from tft.config import KSE30_STOCKS
    if ticker_upper not in KSE30_STOCKS:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker_upper}' not found. Use GET /tickers for valid list.",
        )

    removed = cache.invalidate(ticker_upper)
    msg = "Cache entry removed." if removed else "Ticker was not cached."
    return RefreshResponse(status="ok", invalidated=ticker_upper, message=msg)
