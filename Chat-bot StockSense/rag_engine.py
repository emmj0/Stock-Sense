"""Core RAG engine with database integration for StockSense chatbot.

Routes questions to either:
1. Database queries (stock prices, portfolio, predictions, sectors, etc.)
2. RAG retrieval from indexed PSX educational documents
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
# DB intent patterns - these route to database instead of RAG
# ---------------------------------------------------------------------------

# "price of OGDC", "OGDC price", "how much is OGDC"
STOCK_PRICE_PATTERN = re.compile(
    r"(?:price|rate|value|current|how much)\s+(?:of|for|is)?\s*([A-Z]{2,8})\b|"
    r"\b([A-Z]{2,8})\s+(?:price|rate|stock|share|current|value)\b|"
    r"\bprice\s+of\s+(\w+)",
    re.IGNORECASE,
)

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


def is_simple_question(q: str) -> bool:
    n = normalize_text(q)
    return any(n.startswith(m) for m in ["what is", "what are", "define", "explain", "how to", "how do", "what does", "meaning of"])


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
    if not db.is_db_connected():
        return None

    q = normalize_text(question)

    # --- Stock price lookup: "price of OGDC", "OGDC price", "ATRL stock" ---
    m = STOCK_PRICE_PATTERN.search(question)
    if m:
        symbol = (m.group(1) or m.group(2) or m.group(3) or "").strip()
        if symbol and len(symbol) >= 2:
            stock = db.get_stock_price(symbol)
            if stock:
                return db.format_stock_detail(stock)
            # Try searching
            results = db.search_stocks(symbol, limit=5)
            if results:
                return f"I couldn't find '{symbol}' exactly, but here are close matches:\n\n" + db.format_stock_table(results)
            return f"Stock '{symbol}' not found in the market. Check the symbol and try again."

    # --- Portfolio: "my portfolio", "my holdings", "my stocks" ---
    if any(p in q for p in ["my portfolio", "my holding", "my stock", "my shares", "my investment"]):
        if not user_email:
            return "Please log in so I can show your portfolio."
        holdings = db.get_user_portfolio(user_email)
        return db.format_portfolio(holdings)

    # --- User preferences: "my preferences", "my risk", "my settings" ---
    if any(p in q for p in ["my preference", "my risk", "my profile", "my setting"]):
        if user_context and user_context.get("preferences"):
            prefs = user_context["preferences"]
            summary = _format_user_context_summary(user_context)
            if summary:
                return f"Here's your investment profile:\n{summary}"
        if user_email:
            prefs = db.get_user_preferences(user_email)
            if prefs:
                lines = ["Your Investment Preferences:\n"]
                if prefs.get("riskTolerance"):
                    lines.append(f"- Risk Tolerance: {prefs['riskTolerance']}")
                if prefs.get("investmentHorizon"):
                    lines.append(f"- Investment Horizon: {prefs['investmentHorizon']}")
                if prefs.get("sectors"):
                    lines.append(f"- Preferred Sectors: {', '.join(prefs['sectors'])}")
                if prefs.get("dividendPreference"):
                    lines.append(f"- Dividend Preference: {prefs['dividendPreference']}")
                return "\n".join(lines)
        return "Please log in to view your preferences."

    # --- Budget: "I have 5000 Rs", "invest 10000" ---
    bm = BUDGET_PATTERN.search(question)
    if bm and any(w in q for w in ["invest", "buy", "stock", "which", "where", "suggest", "recommend"]):
        amount = float(bm.group(1).replace(",", ""))
        if amount > 0:
            stocks = db.get_stocks_by_budget(amount, limit=10)
            return db.format_budget_stocks(stocks, amount)

    # --- Top gainers ---
    if any(p in q for p in ["top gainer", "best performing", "most gained", "highest gain"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_gainers(limit), "Top Gainers Today")

    # --- Top losers ---
    if any(p in q for p in ["top loser", "worst performing", "most lost", "biggest drop"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_losers(limit), "Top Losers Today")

    # --- Most active / volume ---
    if any(p in q for p in ["most active", "most traded", "highest volume", "top volume"]):
        limit = _extract_number(q, default=10)
        return db.format_stock_table(db.get_top_volume(limit), "Most Active Stocks")

    # --- Predictions ---
    if any(p in q for p in ["prediction", "predict", "forecast", "what will happen"]):
        # Check for specific symbol
        symbols = re.findall(r"\b([A-Z]{2,8})\b", question)
        if symbols:
            preds = db.get_predictions(symbol=symbols[0])
            if preds:
                return db.format_predictions_list(preds, f"Predictions for {symbols[0]}")
        # General predictions
        preds = db.get_predictions(limit=10)
        if preds:
            return db.format_predictions_list(preds)
        buy_preds = db.get_buy_predictions(limit=10)
        if buy_preds:
            return db.format_predictions_list(buy_preds, "BUY Predictions")
        return "No predictions available right now."

    # --- Recommendations ---
    if any(p in q for p in ["recommend", "suggestion", "which stock", "what to buy", "what to sell",
                             "what should i buy", "what should i invest", "best stock"]):
        rec = db.get_recommendations()
        if rec:
            return db.format_recommendations_response(rec)
        return "No recommendations available right now."

    # --- Sectors ---
    if any(p in q for p in ["sector", "which sector", "all sector", "list sector", "best sector"]):
        # Specific sector lookup
        sector_names = ["banking", "cement", "fertilizer", "oil", "gas", "tech", "auto",
                        "textile", "pharma", "chemical", "food", "power", "sugar", "insurance",
                        "transport", "refinery", "paper"]
        for sn in sector_names:
            if sn in q:
                sec = db.get_sector_by_name(sn)
                if sec:
                    return db.format_sector_detail(sec)
        # List all sectors
        sectors = db.get_sectors()
        if sectors:
            return db.format_sectors_list(sectors)

    # --- Index lookup: "kse 100 index", "kse100", "allshr" ---
    if any(p in q for p in ["index", "kse100", "kse 100", "kse30", "kse 30", "allshr", "kmi30", "kmi 30"]):
        # Try specific index
        index_names = ["KSE100", "KSE30", "ALLSHR", "KMI30", "KMIALLSHR"]
        for iname in index_names:
            if iname.lower().replace(" ", "") in q.replace(" ", "").replace("-", ""):
                idx = db.get_index_by_name(iname)
                if idx:
                    return db.format_index_detail(idx)
        # List all indexes
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

    # --- Specific stock detail: just a ticker symbol alone ---
    if re.match(r"^[A-Z]{2,8}$", question.strip()):
        stock = db.get_stock_price(question.strip())
        if stock:
            return db.format_stock_detail(stock)

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
    "Hello! I'm StockSense, your PSX assistant. I can help you with:\n"
    "- Stock prices, top gainers/losers, most active stocks\n"
    "- Your portfolio and holdings\n"
    "- Stock predictions and recommendations\n"
    "- Sector and index data\n"
    "- PSX education: how investing works, accounts, dividends, IPOs\n\n"
    "What would you like to know?"
)

IDENTITY_RESPONSE = (
    "I'm StockSense, an AI assistant for the Pakistan Stock Exchange. "
    "I can look up real stock prices, show your portfolio, give predictions, "
    "and answer educational questions about PSX investing. "
    "I'm not a financial advisor - I'm here to inform and educate!"
)

CASUAL_RESPONSE = (
    "That's outside my expertise! I only know about Pakistan Stock Exchange stuff. "
    "Try asking me:\n"
    "- What's the price of OGDC?\n"
    "- Show me top gainers\n"
    "- What stocks can I buy with 5000 Rs?\n"
    "- What is a dividend?"
)

UNREALISTIC_RESPONSE = (
    "I have to be honest - no one can guarantee doubling money or fixed returns. "
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
    "Ask me about stock prices, investing, brokers, IPOs, dividends, sectors, "
    "or anything PSX-related!"
)


# ---------------------------------------------------------------------------
# MAIN ANSWER FUNCTION
# ---------------------------------------------------------------------------

def _format_user_context_summary(user_context: Optional[Dict[str, object]]) -> str:
    """Build a short text summary of the user's profile for personalized answers."""
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
    2. Database queries (prices, portfolio, predictions, sectors)
    3. RAG retrieval from educational documents
    """
    _ = user_profile  # reserved for future

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

    # --- 2. Try database answer first ---
    db_answer = try_db_answer(question, user_email, user_context)
    if db_answer:
        return db_answer

    # --- 3. Domain check ---
    if not is_domain_question(question):
        conv_topics = get_conversation_topics(chat_history)
        domain_words = {"stock", "psx", "invest", "broker", "share", "trading", "market", "dividend", "sector"}
        if not (conv_topics & domain_words):
            return OFF_DOMAIN_RESPONSE

    # --- 4. Low retrieval confidence ---
    min_score = float(os.getenv("RAG_MIN_RETRIEVAL_SCORE", "0.30"))
    if not chunks or max(c.score for c in chunks) < min_score:
        return "I don't have enough info for that question. Could you rephrase or ask something more specific about PSX?"

    # --- 5. Extractive answer from RAG ---
    return build_extractive_answer(question, chunks, chat_history)


# Backward-compatible alias
def answer_with_llm(question, chunks, user_profile=None, model=None, chat_history=None):
    return answer_with_context(question, chunks, user_profile, model, chat_history)
