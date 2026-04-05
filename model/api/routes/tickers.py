"""
Ticker list endpoint.
"""

from fastapi import APIRouter

from api.models.schemas import TickerInfo, TickerListResponse
from api.services.inference_service import COMPANY_NAMES, TRUST_NOTES, get_trust_level_for_ticker

router = APIRouter()


@router.get("/tickers", response_model=TickerListResponse, summary="List all active KSE-30 tickers")
async def list_tickers():
    from tft.config import KSE30_STOCKS, SECTOR_MAP

    tickers = []
    for ticker in sorted(KSE30_STOCKS):
        trust_level, trust_note = get_trust_level_for_ticker(ticker)
        tickers.append(
            TickerInfo(
                ticker=ticker,
                sector=SECTOR_MAP.get(ticker, "Unknown"),
                company_name=COMPANY_NAMES.get(ticker, ticker),
                trust_level=trust_level,
                trust_note=trust_note,
                active=True,
            )
        )

    return TickerListResponse(tickers=tickers, total=len(tickers))
