"""MongoDB connector for StockSense chatbot.

Collections in the 'psx' database:
- market_watch (479 docs): SYMBOL, CURRENT, CHANGE, CHANGE(%), HIGH, LOW, OPEN, LDCP, VOLUME, index[], sector[]
- predictions: user, symbol, signal, confidence, currentPrice, predictedPrice, predictedReturn, reasoning, horizonDays, modelPredictions, technicalIndicators
- recommendations: topBuys[], topSells[], summary, sourceTimestamp
- sector (37 docs): code, name, market_cap, turnover, advance, decline, companies[]
- index (18 docs): index, current, change, percent_change, high, low, constituents[]
- users: name, email, portfolio[], preferences, courseProgress[]
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError


_client: Optional[MongoClient] = None
_db = None


def get_db():
    """Get MongoDB database connection (lazy singleton)."""
    global _client, _db
    if _db is not None:
        return _db

    mongo_uri = os.getenv("MONGO_URI", "")
    db_name = os.getenv("MONGO_DB_NAME", "psx")

    if not mongo_uri:
        return None

    try:
        _client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")
        _db = _client[db_name]
        return _db
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print(f"[DB] Could not connect to MongoDB: {e}")
        return None


def is_db_connected() -> bool:
    return get_db() is not None


def _safe_float(val) -> float:
    try:
        return float(str(val).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return 0.0


# ---------------------------------------------------------------------------
# STOCK PRICES (market_watch)
# ---------------------------------------------------------------------------

def _format_stock(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    return {
        "symbol": doc.get("SYMBOL", ""),
        "current": doc.get("CURRENT", "0"),
        "change": doc.get("CHANGE", "0"),
        "change_pct_str": doc.get("CHANGE (%)", "0"),
        "high": doc.get("HIGH", "0"),
        "low": doc.get("LOW", "0"),
        "open": doc.get("OPEN", "0"),
        "ldcp": doc.get("LDCP", "0"),
        "volume": doc.get("VOLUME", "0"),
        "current_num": _safe_float(doc.get("CURRENT", 0)),
        "change_num": _safe_float(doc.get("CHANGE", 0)),
        "change_pct": _safe_float(doc.get("CHANGE (%)", 0)),
        "volume_num": _safe_float(doc.get("VOLUME", 0)),
    }


def get_stock_price(symbol: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return None
    doc = db.market_watch.find_one(
        {"SYMBOL": {"$regex": f"^{re.escape(symbol)}$", "$options": "i"}},
        {"_id": 0},
    )
    return _format_stock(doc) if doc else None


def search_stocks(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.market_watch.find(
        {"SYMBOL": {"$regex": re.escape(query), "$options": "i"}},
        {"_id": 0},
    ).limit(limit))
    return [_format_stock(d) for d in docs]


def get_top_gainers(limit: int = 10) -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.market_watch.find({}, {"_id": 0}))
    stocks = [_format_stock(d) for d in docs]
    stocks.sort(key=lambda s: s["change_pct"], reverse=True)
    return stocks[:limit]


def get_top_losers(limit: int = 10) -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.market_watch.find({}, {"_id": 0}))
    stocks = [_format_stock(d) for d in docs]
    stocks.sort(key=lambda s: s["change_pct"])
    return stocks[:limit]


def get_top_volume(limit: int = 10) -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.market_watch.find({}, {"_id": 0}))
    stocks = [_format_stock(d) for d in docs]
    stocks.sort(key=lambda s: s["volume_num"], reverse=True)
    return stocks[:limit]


def get_stocks_by_budget(amount: float, limit: int = 15) -> List[Dict[str, Any]]:
    """Stocks affordable within budget, sorted by best recent performance."""
    db = get_db()
    if db is None:
        return []
    docs = list(db.market_watch.find({}, {"_id": 0}))
    stocks = [_format_stock(d) for d in docs]

    affordable = []
    for s in stocks:
        price = s["current_num"]
        if 0 < price <= amount:
            shares = int(amount // price)
            s["can_buy_shares"] = shares
            s["total_cost"] = round(shares * price, 2)
            affordable.append(s)

    affordable.sort(key=lambda s: s["change_pct"], reverse=True)
    return affordable[:limit]


# ---------------------------------------------------------------------------
# PREDICTIONS
# ---------------------------------------------------------------------------

def get_predictions(symbol: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    query: dict = {}
    if symbol:
        query["symbol"] = {"$regex": f"^{re.escape(symbol)}$", "$options": "i"}
    docs = list(db.predictions.find(query, {"_id": 0, "raw": 0, "__v": 0}).limit(limit))
    return docs


def get_buy_predictions(limit: int = 10) -> List[Dict[str, Any]]:
    """Predictions with BUY signal, sorted by confidence."""
    db = get_db()
    if db is None:
        return []
    docs = list(db.predictions.find(
        {"signal": {"$regex": "buy", "$options": "i"}},
        {"_id": 0, "raw": 0, "__v": 0},
    ).sort("confidence", -1).limit(limit))
    return docs


# ---------------------------------------------------------------------------
# RECOMMENDATIONS
# ---------------------------------------------------------------------------

def get_recommendations() -> Optional[Dict[str, Any]]:
    """Get the latest recommendations document (topBuys + topSells)."""
    db = get_db()
    if db is None:
        return None
    doc = db.recommendations.find_one({}, {"_id": 0, "raw": 0, "__v": 0}, sort=[("createdAt", -1)])
    return doc


# ---------------------------------------------------------------------------
# SECTORS
# ---------------------------------------------------------------------------

def get_sectors() -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.sector.find({}, {"_id": 0, "companies": 0}))
    return docs


def get_sector_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Search sector by name (e.g., 'banking', 'cement')."""
    db = get_db()
    if db is None:
        return None
    doc = db.sector.find_one(
        {"name": {"$regex": re.escape(name), "$options": "i"}},
        {"_id": 0},
    )
    return doc


# ---------------------------------------------------------------------------
# MARKET INDEXES
# ---------------------------------------------------------------------------

def get_indexes() -> List[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return []
    docs = list(db.index.find({}, {"_id": 0, "constituents": 0}))
    return docs


def get_index_by_name(name: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return None
    doc = db.index.find_one(
        {"index": {"$regex": re.escape(name), "$options": "i"}},
        {"_id": 0},
    )
    return doc


# ---------------------------------------------------------------------------
# USER DATA
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_db()
    if db is None:
        return None
    doc = db.users.find_one(
        {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
        {"password": 0, "_id": 0},
    )
    return doc


def get_user_portfolio(email: str) -> List[Dict[str, Any]]:
    """Get user holdings enriched with current market prices."""
    user = get_user_by_email(email)
    if not user or not user.get("portfolio"):
        return []

    holdings = []
    for item in user["portfolio"]:
        symbol = item.get("symbol", "")
        qty = item.get("quantity", 0)
        avg_cost = item.get("averageCost", 0)

        stock = get_stock_price(symbol)
        current_price = stock["current_num"] if stock else 0
        invested = round(qty * avg_cost, 2)
        current_value = round(qty * current_price, 2)
        pnl = round(current_value - invested, 2)
        pnl_pct = round((pnl / invested) * 100, 2) if invested > 0 else 0

        holdings.append({
            "symbol": symbol,
            "quantity": qty,
            "avg_cost": avg_cost,
            "current_price": current_price,
            "invested": invested,
            "current_value": current_value,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
        })

    return holdings


def get_user_preferences(email: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_email(email)
    if not user:
        return None
    return user.get("preferences", {})


# ---------------------------------------------------------------------------
# FORMATTING HELPERS
# ---------------------------------------------------------------------------

def format_stock_line(s: Dict[str, Any]) -> str:
    arrow = "+" if s.get("change_num", 0) >= 0 else ""
    return f"{s['symbol']}: Rs. {s['current']} ({arrow}{s['change']}, {s['change_pct_str']}) Vol: {s['volume']}"


def format_stock_table(stocks: List[Dict[str, Any]], title: str = "") -> str:
    if not stocks:
        return "No stock data available."
    lines = []
    if title:
        lines.append(f"{title}\n")
    for i, s in enumerate(stocks, 1):
        lines.append(f"{i}. {format_stock_line(s)}")
    return "\n".join(lines)


def format_stock_detail(s: Dict[str, Any]) -> str:
    if not s:
        return "Stock not found."
    return (
        f"{s['symbol']} - Current Price: Rs. {s['current']}\n"
        f"  Open: {s['open']} | High: {s['high']} | Low: {s['low']} | LDCP: {s['ldcp']}\n"
        f"  Change: {s['change']} ({s['change_pct_str']})\n"
        f"  Volume: {s['volume']}"
    )


def format_portfolio(holdings: List[Dict[str, Any]]) -> str:
    if not holdings:
        return "Your portfolio is empty. Add some stocks to get started!"

    lines = ["Your Portfolio:\n"]
    total_invested = 0
    total_current = 0

    for h in holdings:
        pnl_arrow = "+" if h["pnl"] >= 0 else ""
        lines.append(
            f"- {h['symbol']}: {h['quantity']} shares @ Rs. {h['avg_cost']} avg | "
            f"Now Rs. {h['current_price']} | P&L: {pnl_arrow}Rs. {h['pnl']} ({pnl_arrow}{h['pnl_pct']}%)"
        )
        total_invested += h["invested"]
        total_current += h["current_value"]

    total_pnl = round(total_current - total_invested, 2)
    total_pnl_pct = round((total_pnl / total_invested) * 100, 2) if total_invested > 0 else 0
    arrow = "+" if total_pnl >= 0 else ""

    lines.append(f"\nTotal Invested: Rs. {total_invested:,.2f}")
    lines.append(f"Current Value: Rs. {total_current:,.2f}")
    lines.append(f"Total P&L: {arrow}Rs. {total_pnl:,.2f} ({arrow}{total_pnl_pct}%)")

    return "\n".join(lines)


def format_prediction(p: Dict[str, Any]) -> str:
    symbol = p.get("symbol", "?")
    signal = p.get("signal", "?")
    confidence = p.get("confidence", "?")
    current = p.get("currentPrice", "?")
    predicted = p.get("predictedPrice", "?")
    ret = p.get("predictedReturn", "?")
    horizon = p.get("horizonDays", "?")
    reasoning = p.get("reasoning", "")
    return (
        f"{symbol}: {signal} signal (Confidence: {confidence}%)\n"
        f"  Current: Rs. {current} -> Predicted: Rs. {predicted} ({ret}%) in {horizon} days\n"
        f"  {reasoning}"
    )


def format_predictions_list(preds: List[Dict[str, Any]], title: str = "Stock Predictions") -> str:
    if not preds:
        return "No predictions available at the moment."
    lines = [f"{title}:\n"]
    for i, p in enumerate(preds, 1):
        lines.append(f"{i}. {format_prediction(p)}")
    return "\n".join(lines)


def format_recommendations_response(rec: Optional[Dict[str, Any]]) -> str:
    if not rec:
        return "No recommendations available at the moment."

    lines = ["Stock Recommendations:\n"]

    top_buys = rec.get("topBuys", [])
    if top_buys:
        lines.append("TOP BUY Picks:")
        for i, b in enumerate(top_buys, 1):
            symbol = b.get("symbol", "?")
            price = b.get("current_price", "?")
            predicted = b.get("predicted_price", "?")
            ret = b.get("predicted_return", "?")
            conf = b.get("confidence", "?")
            lines.append(f"  {i}. {symbol}: Rs. {price} -> Rs. {predicted} ({ret}%) | Confidence: {conf}%")

    top_sells = rec.get("topSells", [])
    if top_sells:
        lines.append("\nTOP SELL Picks:")
        for i, s in enumerate(top_sells, 1):
            symbol = s.get("symbol", "?")
            price = s.get("current_price", "?")
            predicted = s.get("predicted_price", "?")
            ret = s.get("predicted_return", "?")
            conf = s.get("confidence", "?")
            lines.append(f"  {i}. {symbol}: Rs. {price} -> Rs. {predicted} ({ret}%) | Confidence: {conf}%")

    summary = rec.get("summary", {})
    if summary:
        lines.append(f"\nSummary: {summary.get('total_buys', 0)} buys, {summary.get('total_sells', 0)} sells")

    return "\n".join(lines)


def format_sectors_list(sectors: List[Dict[str, Any]]) -> str:
    if not sectors:
        return "No sector data available."
    lines = ["PSX Sectors:\n"]
    sectors_sorted = sorted(sectors, key=lambda s: _safe_float(s.get("market_cap", 0)), reverse=True)
    for i, s in enumerate(sectors_sorted, 1):
        name = s.get("name", "?")
        cap = s.get("market_cap", "?")
        adv = s.get("advance", 0)
        dec = s.get("decline", 0)
        lines.append(f"{i}. {name} | Market Cap: {cap}B | Advance: {adv} | Decline: {dec}")
    return "\n".join(lines)


def format_sector_detail(sec: Dict[str, Any]) -> str:
    if not sec:
        return "Sector not found."
    lines = [
        f"Sector: {sec.get('name', '?')} (Code: {sec.get('code', '?')})",
        f"Market Cap: {sec.get('market_cap', '?')}B | Turnover: {sec.get('turnover', '?')}",
        f"Advancing: {sec.get('advance', 0)} | Declining: {sec.get('decline', 0)} | Unchanged: {sec.get('unchange', 0)}",
    ]
    companies = sec.get("companies", [])
    if companies:
        lines.append(f"\nTop companies in this sector:")
        for i, c in enumerate(companies[:10], 1):
            sym = c.get("SYMBOL", "?")
            curr = c.get("CURRENT", "?")
            chg = c.get("CHANGE", "0")
            chg_pct = c.get("CHANGE (%)", "0")
            lines.append(f"  {i}. {sym}: Rs. {curr} (Change: {chg}, {chg_pct})")
    return "\n".join(lines)


def format_index_detail(idx: Dict[str, Any]) -> str:
    if not idx:
        return "Index not found."
    lines = [
        f"{idx.get('index', '?')}: {idx.get('current', '?')}",
        f"Change: {idx.get('change', '?')} ({idx.get('percent_change', '?')})",
        f"High: {idx.get('high', '?')} | Low: {idx.get('low', '?')}",
    ]
    constituents = idx.get("constituents", [])
    if constituents:
        lines.append(f"\nTop constituents:")
        # Show top 10 by weight
        sorted_c = sorted(constituents, key=lambda c: _safe_float(c.get("IDX WTG (%)", 0)), reverse=True)
        for i, c in enumerate(sorted_c[:10], 1):
            sym = c.get("SYMBOL", "?")
            curr = c.get("CURRENT", "?")
            wt = c.get("IDX WTG (%)", "?")
            lines.append(f"  {i}. {sym}: Rs. {curr} (Weight: {wt})")
    return "\n".join(lines)


def format_budget_stocks(stocks: List[Dict[str, Any]], budget: float) -> str:
    if not stocks:
        return f"No stocks found within Rs. {budget:,.0f} budget."
    lines = [f"Stocks you can buy with Rs. {budget:,.0f}:\n"]
    for i, s in enumerate(stocks, 1):
        lines.append(
            f"{i}. {s['symbol']}: Rs. {s['current']} | "
            f"You can buy {s['can_buy_shares']} shares (Cost: Rs. {s['total_cost']:,.2f}) | "
            f"Today: {s['change_pct_str']}"
        )
    lines.append(f"\nNote: This is based on current market prices. Always do your own research before investing.")
    return "\n".join(lines)
