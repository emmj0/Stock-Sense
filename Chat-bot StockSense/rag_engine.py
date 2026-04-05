"""Core RAG engine with database integration for StockSense chatbot.

Routes questions to either:
1. Database queries (stock prices, portfolio, predictions, sectors, etc.)
2. RAG retrieval from indexed PSX educational documents

Key design: Educational questions (what is X, how does Y work) always go to RAG.
Database queries (price of OGDC, my portfolio, top gainers) go to DB.
The router checks for educational intent BEFORE trying DB pattern matching.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import faiss
import numpy as np
import requests
from huggingface_hub import constants as hf_constants
from sentence_transformers import SentenceTransformer

import db_connector as db


@dataclass
class RetrievedChunk:
    text: str
    source: str
    kind: str
    score: float
    question: str = ""


# ---------------------------------------------------------------------------
# Known tickers — only match these as stock symbols, not random words
# ---------------------------------------------------------------------------

KNOWN_TICKERS = {
    'OGDC', 'PPL', 'POL', 'HUBC', 'ENGRO', 'FFC', 'EFERT', 'LUCK', 'MCB', 'UBL',
    'HBL', 'BAHL', 'MEBL', 'NBP', 'FABL', 'BAFL', 'DGKC', 'MLCF', 'FCCL', 'CHCC',
    'PSO', 'SHEL', 'ATRL', 'PRL', 'SYS', 'SEARL', 'ILP', 'TGL', 'INIL', 'PAEL',
}

# Words that look like tickers but aren't — prevent false matches
NOT_TICKERS = {
    "IS", "IT", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "IF", "IN", "ME",
    "MY", "NO", "OF", "OK", "ON", "OR", "SO", "TO", "UP", "US", "WE",
    "ALL", "AND", "ARE", "BUT", "CAN", "DID", "FOR", "GET", "HAD", "HAS",
    "HER", "HIM", "HIS", "HOW", "ITS", "LET", "MAY", "NOT", "NOW", "OLD",
    "OUR", "OUT", "OWN", "SAY", "SHE", "THE", "TOO", "TRY", "USE", "WAY",
    "WHO", "WHY", "YES", "YET", "YOU", "NEW", "TOP", "LOW", "BUY",
    "SELL", "HOLD", "STOCK", "SHARE", "PRICE", "HIGH", "WHAT", "WHICH",
    "MARKET", "MONEY", "WILL", "BEST", "GOOD", "HELP", "TELL", "SHOW",
    "GIVE", "WANT", "NEED", "MUCH", "SOME", "VERY", "MAKE",
}

# ---------------------------------------------------------------------------
# Keyword / pattern sets
# ---------------------------------------------------------------------------

GREETING_WORDS = {
    "hi", "hello", "hey", "salam", "assalamualaikum",
    "good morning", "good afternoon", "good evening",
    "aoa", "asc",
}

DOMAIN_KEYWORDS = {
    "psx", "pakistan stock exchange", "stock", "stocks",
    "invest", "investing", "investment", "broker", "brokerage",
    "ipo", "secp", "cdc", "kse", "portfolio",
    "dividend", "trading", "share", "shares",
    "holding", "holdings", "ohlc",
    "cnic", "kyc", "settlement", "nccpl",
    "halal investing", "haram investing",
    "mutual fund", "bond", "debenture",
    "kse-100", "kse-30", "kse all share",
    "bull", "bear", "market cap", "market",
    "price", "buy", "sell", "sector",
    "prediction", "recommend", "gainers", "losers",
    "money", "rupee", "profit", "loss", "return",
    "account", "trading account", "cdc account",
}

IDENTITY_PATTERNS = [
    r"\bwho are you\b", r"\bwhat are you\b", r"\bwhat can you do\b",
    r"\byour name\b", r"\bintroduce yourself\b", r"\btell me about yourself\b",
    r"\bwhat do you do\b",
]

CASUAL_PATTERNS = [
    r"\bdo you love\b", r"\bcan you love\b", r"\bdo you like\b",
    r"\bdoes (s)?he love\b", r"\bcan (s)?he love\b", r"\bwill (s)?he love\b",
    r"\blove me\b", r"\bhate me\b", r"\bmiss me\b",
    r"\bcan i trust you\b", r"\bdo you feel\b", r"\bare you human\b",
    r"\bare you real\b", r"\bare you alive\b", r"\bare you ai\b",
    r"\btell me a joke\b", r"\bsing a song\b", r"\bwrite a poem\b",
    r"\bwhat is the meaning of life\b",
    r"\bwhat('s| is) your (fav|opinion|feeling)\b",
    r"\bhow old are you\b", r"\bwhere (are|do) you live\b",
]

UNREALISTIC_PATTERNS = [
    r"\bdouble\b.{0,20}\bmoney\b",
    r"\bguarantee\b.{0,20}\b(return|profit)\b",
    r"\bget rich\b.{0,10}\b(quick|fast|overnight)\b",
    r"\btake my money\b",
    r"\bmake me (rich|millionaire)\b",
    r"\bno risk\b.{0,20}\b(profit|return|money)\b",
    r"\bsure (profit|return|money)\b",
]

# ---------------------------------------------------------------------------
# Educational question patterns — these ALWAYS go to RAG, never to DB
# ---------------------------------------------------------------------------

EDUCATIONAL_PATTERNS = [
    r"^what (is|are) (a |an |the )?(stock|share|dividend|ipo|broker|secp|cdc|kse|psx|portfolio|bond|debenture|mutual fund|market|nccpl|cnic|kyc|settlement|trading|bull|bear|blue chip|p/e|rsi|sma|volume|capitalization)",
    r"^how (to|do i|can i|do we|should i) (start|begin|open|invest|buy|sell|trade|check|find|choose|pick)",
    r"^explain\b",
    r"^define\b",
    r"^meaning of\b",
    r"^why (is|are|do|does|should|can)\b",
    r"\b(difference|different) between\b",
    r"\b(types|kinds|categories) of\b",
    r"\b(advantages?|disadvantages?|benefits?|risks?) of\b",
    r"\bwhat happens (when|if)\b",
    r"\b(steps?|process|procedure) (to|for|of)\b",
    r"^what (is|are) (halal|haram|insider|short sell|stop.loss|limit order|market order)",
]

# Words that indicate a DB action, NOT an educational question
DB_ACTION_WORDS = {
    "price", "prediction", "predict", "forecast", "recommend", "portfolio",
    "holding", "gainer", "loser", "active", "buy", "sell", "budget",
    "preference", "setting", "course",
}

# ---------------------------------------------------------------------------
# DB intent patterns
# ---------------------------------------------------------------------------

BUDGET_PATTERN = re.compile(
    r"(?:i have|budget|invest|with)\s*(?:rs\.?|pkr|rupees?)?\s*([\d,]+)\s*(?:rs|pkr|rupees?)?",
    re.IGNORECASE,
)


class RAGEngine:
    def __init__(
        self,
        index_path: Path = Path("rag_index.faiss"),
        chunks_path: Path = Path("rag_chunks.json"),
        embedding_model: str = "all-MiniLM-L6-v2",
    ) -> None:
        # Allow online download on first run (e.g. Render), use cache after
        try:
            hf_constants.HF_HUB_OFFLINE = True
            self.embedder = SentenceTransformer(embedding_model)
        except (OSError, Exception):
            hf_constants.HF_HUB_OFFLINE = False
            self.embedder = SentenceTransformer(embedding_model)
        self.index = faiss.read_index(str(index_path))
        with chunks_path.open("r", encoding="utf-8") as f:
            self.chunks: List[Dict[str, str]] = json.load(f)

    def retrieve(self, query: str, k: int = 5) -> List[RetrievedChunk]:
        query_vector = self.embedder.encode(
            [query], convert_to_numpy=True, normalize_embeddings=True,
        )
        query_vector = np.asarray(query_vector, dtype="float32")
        n_candidates = min(k * 6, 50)
        scores, indices = self.index.search(query_vector, k=n_candidates)

        results: List[RetrievedChunk] = []
        seen_questions = set()
        seen_headings = set()
        seen_hashes = set()
        candidates = list(zip(scores[0], indices[0]))

        for pass_type in ["qa_full", "section", "qa_answer_sentence", "_other"]:
            for score, idx in candidates:
                if len(results) >= k * 2:
                    break
                if idx < 0 or idx >= len(self.chunks):
                    continue
                row = self.chunks[idx]
                ct = row.get("chunk_type", "")

                if pass_type == "_other":
                    if ct in {"qa_full", "section", "qa_answer_sentence", "qa_question"}:
                        continue
                elif ct != pass_type:
                    continue

                q = row.get("question", "")
                h = row.get("heading", "")
                th = row.get("text", "")[:80]

                if q and q in seen_questions:
                    continue
                if h and h in seen_headings:
                    continue
                if th in seen_hashes:
                    continue

                results.append(RetrievedChunk(
                    text=row.get("text", ""),
                    source=row.get("source", "unknown"),
                    kind=row.get("kind", "unknown"),
                    score=float(score),
                    question=q,
                ))
                if q:
                    seen_questions.add(q)
                if h:
                    seen_headings.add(h)
                seen_hashes.add(th)

        results.sort(key=lambda c: c.score, reverse=True)
        return results[:k]


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def keyword_terms(text: str) -> set[str]:
    stop = {
        "what", "is", "are", "the", "a", "an", "to", "of", "in", "on",
        "for", "how", "where", "when", "can", "i", "we", "you", "do",
        "does", "and", "or", "by", "about", "as", "it", "its", "this",
        "that", "with", "from", "be", "has", "have", "had", "was", "were",
        "will", "would", "could", "should", "may", "might", "shall",
        "me", "my", "your", "our", "tell", "give", "explain", "please",
        "know", "want", "need", "like", "also", "very", "much",
        "just", "no", "yes", "not", "only", "take", "which", "show",
    }
    terms = set(re.findall(r"[a-zA-Z]{2,}", normalize_text(text)))
    normalized = set()
    for t in terms:
        if t not in stop:
            base = t[:-1] if t.endswith("s") and len(t) > 3 else t
            normalized.add(base)
    return normalized


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def extract_answer_text(chunk_text: str) -> str:
    m = re.search(r"Q:\s*(.*?)\s*\nA:\s*(.*)", chunk_text, re.IGNORECASE | re.DOTALL)
    if m and len(m.group(2).strip()) > 15:
        return m.group(2).strip()
    m = re.search(r"Question:\s*(.*?)\s*Answer:\s*(.*)", chunk_text, re.IGNORECASE | re.DOTALL)
    if m and len(m.group(2).strip()) > 15:
        return m.group(2).strip()
    if re.match(r"^Q:\s*.+\s*$", chunk_text.strip(), re.IGNORECASE):
        return ""
    return chunk_text


def split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 15]


def clean_sentence(text: str, max_len: int = 300) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = re.sub(r"^[A-Za-z][A-Za-z\s\-]{8,80}:\s*", "", cleaned)
    cleaned = re.sub(r"^\d+[.)]\s*", "", cleaned)
    cleaned = cleaned.replace("..", ".")
    for pat in [r"\bplease\s+use\s+block\s+letters\b", r"\bi/we\s+hereby\s+apply\b",
                r"\bcustomer\s+relationship\s+form\b", r"\b\[.*?\]\s*"]:
        cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len].rsplit(" ", 1)[0].strip() + "..."


def sentence_is_noisy(sentence: str) -> bool:
    s = normalize_text(sentence)
    noise = [
        "in this chapter", "unless the subject or context", "advisor to the issue",
        "regulation no", "clause no", "rulebook chapter", "please use block letters",
        "hereby apply", "contract multiplier", "contract unit", "contract value",
        "contract specifications", "provided further that every company",
        "annual listing fee", "surcharge at the rate", "notified by the exchange in the",
        "definitions:", "shall mean", "shall be such", "end of psx", "fyp",
        "fast-nuces", "chiniot 2025", "stocksense fyp",
        "securities brokers may open", "securities brokers shall",
        "crf attached as annexure", "sahulat form for such",
        "restricted uin", "squaring-up of open position",
    ]
    return any(n in s for n in noise)


# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

def is_greeting(q: str) -> bool:
    n = normalize_text(q)
    if n in GREETING_WORDS:
        return True
    return any(n.startswith(w + " ") or n.startswith(w + ",") or n == w for w in GREETING_WORDS)


def is_identity_question(q: str) -> bool:
    n = normalize_text(q)
    return any(re.search(p, n) for p in IDENTITY_PATTERNS)


def is_casual_or_personal(q: str) -> bool:
    n = normalize_text(q)
    return any(re.search(p, n) for p in CASUAL_PATTERNS)


def is_unrealistic_expectation(q: str) -> bool:
    n = normalize_text(q)
    return any(re.search(p, n) for p in UNREALISTIC_PATTERNS)


def is_domain_question(q: str) -> bool:
    n = normalize_text(q)
    return any(kw in n for kw in DOMAIN_KEYWORDS)


def is_educational_question(q: str) -> bool:
    """Check if this is a learning/definitional question that should go to RAG.
    Returns False if the question contains a ticker or DB action word."""
    n = normalize_text(q)
    # If question mentions a known ticker, it's likely a DB query not educational
    if extract_ticker(q):
        return False
    # If question has DB action words, let DB handler deal with it
    if any(w in n for w in DB_ACTION_WORDS):
        return False
    return any(re.search(p, n) for p in EDUCATIONAL_PATTERNS)


def is_simple_question(q: str) -> bool:
    n = normalize_text(q)
    return any(n.startswith(m) for m in ["what is", "what are", "define", "explain", "how to", "how do", "what does", "meaning of"])


def extract_ticker(question: str) -> Optional[str]:
    """Extract a valid KSE-30 ticker from the question. Returns None if not found."""
    # Check for known ticker mentions
    words = re.findall(r"\b([A-Z]{2,8})\b", question)
    for w in words:
        if w in KNOWN_TICKERS:
            return w
    # Also check lowercase
    for w in re.findall(r"\b([a-zA-Z]{2,8})\b", question):
        if w.upper() in KNOWN_TICKERS:
            return w.upper()
    return None


def get_source_names(chunks: List[RetrievedChunk], limit: int = 3) -> List[str]:
    seen: List[str] = []
    for c in chunks:
        name = Path(c.source).name
        if name not in seen:
            seen.append(name)
        if len(seen) >= limit:
            break
    return seen


def get_conversation_topics(history: Optional[List[Dict[str, str]]], max_pairs: int = 4) -> set[str]:
    if not history:
        return set()
    recent = history[-(max_pairs * 2):]
    all_terms = set()
    for item in recent:
        if item.get("role") == "user":
            all_terms |= keyword_terms(item.get("content", ""))
    return all_terms


# ---------------------------------------------------------------------------
# DB INTENT DETECTION - routes to database queries
# ---------------------------------------------------------------------------

def try_db_answer(question: str, user_email: Optional[str] = None, user_context: Optional[Dict[str, object]] = None) -> Optional[str]:
    """Check if question can be answered from the database. Returns answer or None."""
    q = normalize_text(question)
    ticker = extract_ticker(question)

    # --- Courses / Learning module (works without DB) ---
    if any(p in q for p in ["course", "learn", "education", "tutorial", "lesson", "module",
                             "training", "class", "teach"]):
        return (
            "We have a complete learning module with courses on stock market basics, "
            "financial statements, technical analysis, and more!\n\n"
            "Go to the Learn section in the app to start your courses. "
            "Each course has reading material, practice questions, and a quiz.\n\n"
            "You can access it here: /learn\n\n"
            "Want me to explain any stock market concept right here? Just ask!"
        )

    # --- User preferences (works without DB — points to UI) ---
    if any(p in q for p in ["my preference", "my prefrence", "my risk", "my profile",
                             "my setting", "change preference", "change prefrence",
                             "update preference", "edit preference"]):
        if user_context and user_context.get("preferences"):
            summary = _format_user_context_summary(user_context)
            if summary:
                return (
                    f"Here's your investment profile:\n{summary}\n\n"
                    f"You can update your preferences from the Preferences page: /preferences"
                )
        return (
            "You can set and manage your investment preferences (risk tolerance, "
            "preferred sectors, investment horizon) from the Preferences page.\n\n"
            "Go to: /preferences"
        )

    # --- Everything below needs DB connection ---
    if not db.is_db_connected():
        return None

    # --- Portfolio: "my portfolio", "my holdings", "my stocks", "which stocks do I own" ---
    if any(p in q for p in ["my portfolio", "my holding", "my stock", "my shares", "my investment",
                             "show my", "stocks do i own", "stocks do i have", "stocks i own",
                             "stocks i have", "what do i own", "what do i have"]):
        if not user_email:
            return "Please log in so I can show your portfolio."
        holdings = db.get_user_portfolio(user_email)
        return db.format_portfolio(holdings)

    # --- "Should I buy/sell TICKER?" → Show that specific stock's prediction ---
    if ticker and any(p in q for p in ["should i buy", "should i sell", "should i invest",
                                        "how do you see", "what about", "tell me about",
                                        "how is", "what do you think"]):
        pred = db.get_predictions(symbol=ticker)
        if pred:
            return db.format_predictions_list(pred, f"AI Prediction for {ticker}")
        # Fallback to price
        stock = db.get_stock_price(ticker)
        if stock:
            return db.format_stock_detail(stock) + (
                "\n\nNo AI prediction available for this stock right now. "
                "Check the Predictions page for all available forecasts: /predictions"
            )

    # --- Prediction for specific ticker: "prediction for PSO", "forecast OGDC" ---
    if ticker and any(p in q for p in ["prediction", "predict", "forecast", "future",
                                        "next week", "next 7 day", "next few day",
                                        "will go up", "will go down", "will it rise",
                                        "will it fall", "outlook"]):
        pred = db.get_predictions(symbol=ticker)
        if pred:
            return db.format_predictions_list(pred, f"AI Prediction for {ticker}")
        return f"No AI prediction available for {ticker} right now. Check /predictions for all forecasts."

    # --- Stock price lookup: "price of OGDC", "OGDC price" ---
    if ticker:
        price_words = {"price", "rate", "value", "current", "how much", "worth", "cost", "kitna"}
        if any(pw in q for pw in price_words) or q.strip().upper() == ticker:
            stock = db.get_stock_price(ticker)
            if stock:
                return db.format_stock_detail(stock)

    # --- Budget: "I have 5000 Rs", "invest 10000" ---
    bm = BUDGET_PATTERN.search(question)
    if bm and any(w in q for w in ["invest", "buy", "stock", "which", "where", "suggest", "recommend"]):
        amount = float(bm.group(1).replace(",", ""))
        if amount > 0:
            stocks = db.get_stocks_by_budget(amount, limit=10)
            return db.format_budget_stocks(stocks, amount)

    # --- Market overview ---
    if any(p in q for p in ["how is market", "how's market", "market today", "is market up",
                             "is market down", "market status", "market overview",
                             "how's the market", "market kaisa"]):
        idx = db.get_index_by_name("KSE100")
        if idx:
            change = idx.get("change", "0")
            pct = idx.get("percent_change", "0%")
            curr = idx.get("current", "?")
            direction = "up" if not str(change).startswith("-") else "down"
            return (
                f"The KSE-100 index is currently at {curr} ({direction} {change}, {pct} today).\n\n"
                f"Want to see top gainers, top losers, or specific stock prices?"
            )

    # --- Top gainers ---
    if any(p in q for p in ["top gainer", "best performing", "most gained", "highest gain",
                             "which stock went up", "stocks going up", "best stock today"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_gainers(limit), "Top Gainers Today")

    # --- Top losers ---
    if any(p in q for p in ["top loser", "worst performing", "most lost", "biggest drop",
                             "which stock went down", "stocks going down", "worst stock today"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_losers(limit), "Top Losers Today")

    # --- Most active ---
    if any(p in q for p in ["most active", "most traded", "highest volume", "top volume"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_volume(limit), "Most Active Stocks")

    # --- General predictions (no specific ticker) ---
    if any(p in q for p in ["prediction", "predict", "forecast", "all prediction",
                             "show prediction", "any prediction"]):
        preds = db.get_predictions(limit=10)
        if preds:
            return db.format_predictions_list(preds) + "\n\nSee all predictions at: /predictions"
        return "No predictions available right now. Check /predictions later."

    # --- Recommendations (general: "what to buy", "suggest stocks") ---
    if any(p in q for p in ["recommend", "suggestion", "which stock to buy", "what to buy",
                             "what to sell", "what should i buy", "what should i invest",
                             "best stock", "good stock", "safe stock", "suggest"]):
        rec = db.get_recommendations()
        if rec:
            return db.format_recommendations_response(rec) + "\n\nSee detailed predictions at: /predictions"
        return "No recommendations available right now."

    # --- Sectors ---
    if any(p in q for p in ["sector", "which sector", "all sector", "list sector", "best sector"]):
        sector_names = ["banking", "cement", "fertilizer", "oil", "gas", "tech", "auto",
                        "textile", "pharma", "chemical", "food", "power", "sugar", "insurance",
                        "transport", "refinery", "paper"]
        for sn in sector_names:
            if sn in q:
                sec = db.get_sector_by_name(sn)
                if sec:
                    return db.format_sector_detail(sec)
        sectors = db.get_sectors()
        if sectors:
            return db.format_sectors_list(sectors)

    # --- Index lookup ---
    if any(p in q for p in ["kse100", "kse 100", "kse30", "kse 30", "allshr", "kmi30", "kmi 30"]):
        index_names = ["KSE100", "KSE30", "ALLSHR", "KMI30", "KMIALLSHR"]
        for iname in index_names:
            if iname.lower().replace(" ", "") in q.replace(" ", "").replace("-", ""):
                idx = db.get_index_by_name(iname)
                if idx:
                    return db.format_index_detail(idx)
    if "index" in q and ("all" in q or "list" in q or "show" in q):
        indexes = db.get_indexes()
        if indexes:
            lines = ["Market Indexes:\n"]
            for idx in indexes:
                name = idx.get("index", "?")
                curr = idx.get("current", "?")
                chg = idx.get("change", "?")
                pct = idx.get("percent_change", "?")
                lines.append(f"- {name}: {curr} (Change: {chg}, {pct})")
            return "\n".join(lines)

    # --- Just a bare ticker symbol ---
    if re.match(r"^[A-Z]{2,8}$", question.strip()) and question.strip() in KNOWN_TICKERS:
        stock = db.get_stock_price(question.strip())
        if stock:
            # Also check for prediction
            pred = db.get_predictions(symbol=question.strip())
            result = db.format_stock_detail(stock)
            if pred:
                result += "\n\n" + db.format_predictions_list(pred, "AI Prediction")
            return result

    return None


def _extract_number(text: str, default: int = 10) -> int:
    m = re.search(r"\b(\d+)\b", text)
    if m:
        n = int(m.group(1))
        return min(n, 50)
    return default


# ---------------------------------------------------------------------------
# Q&A matching (for RAG path)
# ---------------------------------------------------------------------------

def exact_qa_match_answer(question: str, chunks: List[RetrievedChunk]) -> Optional[str]:
    q_terms = keyword_terms(question)
    if not q_terms:
        return None

    is_simple = is_simple_question(question)
    candidates: List[tuple[float, RetrievedChunk]] = []

    for chunk in chunks:
        if not chunk.question:
            continue
        c_terms = keyword_terms(chunk.question)
        j_score = jaccard(q_terms, c_terms)
        chunk_norm = normalize_text(chunk.text)
        text_match = sum(1 for t in q_terms if t in chunk_norm) / len(q_terms) if q_terms else 0
        exact_overlap = sum(1 for t in q_terms if t in c_terms) / len(q_terms) if q_terms else 0
        combined = (j_score * 0.35) + (text_match * 0.35) + (exact_overlap * 0.30)

        if is_simple:
            answer = extract_answer_text(chunk.text)
            a_norm = normalize_text(answer)
            specifics = ["defensive stock", "aggressive stock", "penny stock", "blue chip",
                         "growth stock", "momentum stock", "cyclical stock", "value premium"]
            if any(a_norm.startswith(sp) for sp in specifics):
                combined *= 0.4

        candidates.append((combined, chunk))

    candidates.sort(key=lambda x: x[0], reverse=True)

    if candidates and candidates[0][0] >= 0.22:
        best = candidates[0][1]
        answer = extract_answer_text(best.text)
        if answer and len(answer) > 25:
            answer = _simplify_answer(answer)
            sources = get_source_names([best])
            return f"{answer}\n\nSources: {', '.join(sources)}"

    return None


def _simplify_answer(text: str, max_sentences: int = 5) -> str:
    text = clean_sentence(text, max_len=800)
    sentences = split_sentences(text)
    if not sentences:
        return text
    clean = [s for s in sentences if not sentence_is_noisy(s)]
    if not clean:
        clean = sentences
    result = " ".join(clean[:max_sentences])
    if result and result[-1] not in ".!?":
        result += "."
    return result


# ---------------------------------------------------------------------------
# Extractive answer builder (RAG path)
# ---------------------------------------------------------------------------

def build_extractive_answer(
    question: str,
    chunks: List[RetrievedChunk],
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    if not chunks:
        return "I don't have enough info to answer that. Try asking a more specific PSX question."

    q_terms = keyword_terms(question)
    conv_topics = get_conversation_topics(chat_history)

    qa_answer = exact_qa_match_answer(question, chunks)
    if qa_answer:
        return qa_answer

    is_simple = is_simple_question(question)
    scored: List[tuple[float, str]] = []

    for chunk in chunks[:6]:
        processed = extract_answer_text(chunk.text)
        for sent in split_sentences(processed):
            if sentence_is_noisy(sent):
                continue
            sent_terms = keyword_terms(sent)
            q_overlap = len(q_terms & sent_terms) if q_terms else 0
            ctx_overlap = len(conv_topics & sent_terms) * 0.3 if conv_topics else 0
            vec_score = chunk.score
            qa_boost = 1.4 if chunk.question else 1.0
            lf = 1.0
            if is_simple:
                wc = len(sent.split())
                lf = 1.3 if wc < 25 else (0.7 if wc > 50 else 1.0)

            score = (q_overlap * 2.5 + ctx_overlap + vec_score * 3.0) * qa_boost * lf
            cleaned = clean_sentence(sent, max_len=280)
            if len(cleaned) >= 20:
                scored.append((score, cleaned))

    if not scored:
        first = extract_answer_text(chunks[0].text)
        cleaned = _simplify_answer(first)
        sources = get_source_names(chunks)
        return f"{cleaned}\n\nSources: {', '.join(sources)}"

    scored.sort(key=lambda x: x[0], reverse=True)
    selected: List[str] = []
    seen_words: List[set] = []
    for _, sent in scored:
        words = set(sent.lower().split())
        is_dup = any(
            len(words & prev) / min(len(words), len(prev)) > 0.6
            for prev in seen_words if words and prev
        )
        if not is_dup:
            selected.append(sent)
            seen_words.append(words)
        if len(selected) >= 4:
            break

    answer = " ".join(selected)
    if q_terms and not any(t in normalize_text(answer) for t in q_terms):
        return (
            "I couldn't find a precise answer in my documents. "
            "Try rephrasing with terms like: PSX, dividend, KSE-100, broker, SECP, IPO."
        )

    sources = get_source_names(chunks)
    return f"{answer}\n\nSources: {', '.join(sources)}"


# ---------------------------------------------------------------------------
# STATIC RESPONSES
# ---------------------------------------------------------------------------

GREETING_RESPONSE = (
    "Hello! I'm StockSense, your PSX investment assistant. I can help you with:\n\n"
    "- Stock prices — \"What's the price of OGDC?\"\n"
    "- Your portfolio — \"Show my portfolio\"\n"
    "- AI predictions — \"Show predictions\" or \"Should I buy LUCK?\"\n"
    "- Market overview — \"How is the market today?\"\n"
    "- Top movers — \"Top gainers\" or \"Top losers\"\n"
    "- Learning — \"What is a stock?\", \"How to start investing?\"\n"
    "- Budget advice — \"I have 5000 Rs, which stocks can I buy?\"\n\n"
    "Just ask me anything about Pakistan Stock Exchange!"
)

IDENTITY_RESPONSE = (
    "I'm StockSense, an AI assistant for the Pakistan Stock Exchange. "
    "I can look up real stock prices, show your portfolio, give AI-powered predictions, "
    "and answer educational questions about PSX investing. "
    "I'm not a financial advisor — I'm here to inform and educate!"
)

CASUAL_RESPONSE = (
    "That's outside my expertise! I only know about Pakistan Stock Exchange stuff. "
    "Try asking me:\n"
    "- What's the price of OGDC?\n"
    "- Show me top gainers\n"
    "- What stocks can I buy with 5000 Rs?\n"
    "- What is a dividend?\n"
    "- How to start investing?"
)

UNREALISTIC_RESPONSE = (
    "I have to be honest — no one can guarantee doubling money or fixed returns. "
    "The stock market involves real risk.\n\n"
    "Here's what I'd suggest:\n"
    "- Learn the basics first (ask me anything!)\n"
    "- Never invest money you can't afford to lose\n"
    "- Think long-term, not get-rich-quick\n"
    "- Diversify across multiple stocks\n\n"
    "Want me to show you some stock recommendations or explain how investing works?"
)

OFF_DOMAIN_RESPONSE = (
    "I'm focused on Pakistan Stock Exchange topics. "
    "I can help with:\n"
    "- Stock prices and market data\n"
    "- Investment education (what is a stock, how to invest, etc.)\n"
    "- Your portfolio and predictions\n\n"
    "Try asking something like \"What is a stock?\" or \"How is the market today?\""
)


# ---------------------------------------------------------------------------
# MAIN ANSWER FUNCTION
# ---------------------------------------------------------------------------

def _format_user_context_summary(user_context: Optional[Dict[str, object]]) -> str:
    if not user_context:
        return ""
    parts = []
    name = user_context.get("name")
    if name:
        parts.append(f"User: {name}")
    prefs = user_context.get("preferences") or {}
    if prefs:
        if prefs.get("riskTolerance"):
            parts.append(f"Risk tolerance: {prefs['riskTolerance']}")
        if prefs.get("investmentHorizon"):
            parts.append(f"Investment horizon: {prefs['investmentHorizon']}")
        if prefs.get("sectors"):
            parts.append(f"Interested sectors: {', '.join(prefs['sectors'][:5])}")
        if prefs.get("dividendPreference"):
            parts.append(f"Dividend preference: {prefs['dividendPreference']}")
    portfolio = user_context.get("portfolio") or []
    if portfolio:
        symbols = [h.get("symbol", "") for h in portfolio[:10] if h.get("symbol")]
        if symbols:
            parts.append(f"Holdings: {', '.join(symbols)}")
    return " | ".join(parts)


def answer_with_context(
    question: str,
    chunks: List[RetrievedChunk],
    user_profile: Optional[Dict[str, object]] = None,
    model: Optional[str] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
    user_email: Optional[str] = None,
    user_context: Optional[Dict[str, object]] = None,
) -> str:
    """Route question to the right handler and generate answer.

    Priority:
    1. Greeting / Identity / Casual / Unrealistic
    2. Educational questions → always go to RAG (never accidentally hit DB)
    3. Database queries (prices, portfolio, predictions, sectors)
    4. Domain check
    5. RAG retrieval from educational documents
    """
    _ = user_profile

    # --- 1. Quick intent checks ---
    if is_greeting(question):
        name = (user_context or {}).get("name")
        if name:
            return f"Hello {name}! " + GREETING_RESPONSE[len("Hello! "):]
        return GREETING_RESPONSE
    if is_identity_question(question):
        return IDENTITY_RESPONSE
    if is_casual_or_personal(question):
        return CASUAL_RESPONSE
    if is_unrealistic_expectation(question):
        return UNREALISTIC_RESPONSE

    # --- 2. Educational questions → RAG first (skip DB) ---
    # "what is a stock", "how to invest", "explain dividend" etc.
    if is_educational_question(question):
        min_score = float(os.getenv("RAG_MIN_RETRIEVAL_SCORE", "0.25"))
        if chunks and max(c.score for c in chunks) >= min_score:
            return build_extractive_answer(question, chunks, chat_history)

    # --- 3. Try database answer ---
    db_answer = try_db_answer(question, user_email, user_context)
    if db_answer:
        return db_answer

    # --- 4. Domain check ---
    if not is_domain_question(question):
        conv_topics = get_conversation_topics(chat_history)
        domain_words = {"stock", "psx", "invest", "broker", "share", "trading", "market", "dividend", "sector"}
        if not (conv_topics & domain_words):
            return OFF_DOMAIN_RESPONSE

    # --- 5. Low retrieval confidence ---
    min_score = float(os.getenv("RAG_MIN_RETRIEVAL_SCORE", "0.30"))
    if not chunks or max(c.score for c in chunks) < min_score:
        return (
            "I'm not sure about that. Try asking something like:\n"
            "- \"What is a stock?\"\n"
            "- \"Price of OGDC\"\n"
            "- \"How to start investing?\"\n"
            "- \"Show top gainers\""
        )

    # --- 6. Extractive answer from RAG ---
    return build_extractive_answer(question, chunks, chat_history)


# Backward-compatible alias
def answer_with_llm(question, chunks, user_profile=None, model=None, chat_history=None):
    return answer_with_context(question, chunks, user_profile, model, chat_history)
