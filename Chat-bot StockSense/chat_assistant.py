"""CLI chatbot with DB integration and conversation memory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv

from personalization import load_user_profile
from rag_engine import RAGEngine, answer_with_context, keyword_terms, normalize_text
import db_connector as db


SESSIONS_DIR = Path("sessions")
CONTEXT_WINDOW = 4

# Strict follow-up phrases - only expand when user clearly continues a topic
FOLLOWUP_PHRASES = {
    "tell me more", "explain more", "more about", "go on", "continue",
    "what about it", "and what about", "how does it work", "how do they work",
    "what are they used for", "what is it used for",
    "what are they", "what is it", "what is this",
    "how to start it", "how do i start it",
}

QUESTION_ANCHORS = {
    "psx", "stocks", "stock", "holdings", "holding", "cnic", "secp",
    "broker", "brokerage", "ipo", "dividend", "dividends", "invest",
    "investment", "investing", "ohlc", "cdc", "nccpl", "mutual fund",
    "share", "shares", "trading", "account", "kyc", "settlement",
    "halal", "haram", "kse", "kse-100", "kse-30", "index",
    "portfolio", "capital", "profit", "loss", "bond", "money",
    "market", "price", "buy", "sell", "sector", "prediction",
    "recommend", "gainer", "loser", "volume",
}


def extract_topic_from_question(question: str) -> str:
    stop_words = {
        "what", "is", "are", "the", "a", "an", "to", "of", "in", "on",
        "for", "how", "where", "when", "can", "i", "we", "you", "do",
        "does", "and", "about", "know", "tell", "me", "give", "please",
        "explain", "define", "or", "by", "this", "that", "it", "my",
        "show", "which", "should",
    }
    words = [w.strip("?.,!:") for w in question.lower().split()]
    terms = [w for w in words if w and w not in stop_words]
    if not terms:
        return ""
    return " ".join(terms[-3:]) if len(terms) >= 3 else " ".join(terms)


def resolve_followup_question(question: str, history: List[Dict[str, str]]) -> str:
    normalized = question.lower().strip().rstrip("?.,!")

    if any(anchor in normalized for anchor in QUESTION_ANCHORS):
        return question

    # Also check for stock ticker (uppercase 2-8 chars)
    if any(len(w) >= 2 and w.isupper() and w.isalpha() for w in question.split()):
        return question

    prev_user_msgs = [item.get("content", "") for item in history if item.get("role") == "user"]
    if not prev_user_msgs:
        return question

    prev_question = prev_user_msgs[-1].strip()
    if not prev_question:
        return question

    is_followup = any(normalized.startswith(phrase) for phrase in FOLLOWUP_PHRASES)
    if not is_followup:
        return question

    topic = extract_topic_from_question(prev_question)
    if not topic:
        return question

    if any(normalized.startswith(p) for p in ["tell me more", "more about", "explain more"]):
        return f"explain {topic} in detail"
    if normalized.startswith("how does it work") or normalized.startswith("how do they work"):
        return f"how does {topic} work"
    if normalized.startswith("what are they used for") or normalized.startswith("what is it used for"):
        return f"what is {topic} used for"
    if normalized.startswith("what are they") or normalized.startswith("what is it") or normalized.startswith("what is this"):
        return f"what is {topic}"
    if normalized.startswith("how to start it") or normalized.startswith("how do i start it"):
        return f"how to start {topic}"
    if normalized.startswith("and what about"):
        rest = normalized.replace("and what about", "").strip()
        return f"what about {rest} in {topic}" if rest else f"what about {topic}"
    if normalized.startswith("what about it"):
        return f"what about {topic}"

    return f"{topic} {question}"


# ---------------------------------------------------------------------------
# Session persistence
# ---------------------------------------------------------------------------

def load_session_history(session_id: str) -> List[Dict[str, str]]:
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    except json.JSONDecodeError:
        return []
    return []


def save_session_history(session_id: str, history: List[Dict[str, str]]) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = SESSIONS_DIR / f"{session_id}.json"
    path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Run StockSense chatbot")
    parser.add_argument("--user-id", type=str, default=None)
    parser.add_argument("--user-email", type=str, default=None, help="User email for portfolio/preferences")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--session-id", type=str, default="default")
    parser.add_argument("--context-window", type=int, default=CONTEXT_WINDOW)
    parser.add_argument("--no-persist-memory", action="store_true")
    args = parser.parse_args()

    load_dotenv()

    print("Loading RAG engine...")
    rag = RAGEngine()
    user_profile = load_user_profile(args.user_id)

    # Connect to database
    if db.is_db_connected():
        print("Connected to PSX database.")
        if args.user_email:
            user = db.get_user_by_email(args.user_email)
            if user:
                print(f"Logged in as: {user.get('name', args.user_email)}")
            else:
                print(f"User '{args.user_email}' not found in database.")
    else:
        print("Database not connected - running in offline mode (educational Q&A only).")

    if args.no_persist_memory:
        history: List[Dict[str, str]] = []
    else:
        history = load_session_history(args.session_id)

    if history:
        print(f"Loaded {len(history)} previous messages from session '{args.session_id}'.")
    print("StockSense assistant is ready. Type 'exit' to stop.\n")

    while True:
        question = input("You: ").strip()
        if question.lower() in {"exit", "quit", "bye"}:
            print("Goodbye! Happy investing!")
            break
        if not question:
            print("\nAssistant: Please type a question about PSX or investing.\n")
            continue

        context_size = args.context_window * 2
        recent_history = history[-context_size:] if history else []

        retrieval_query = resolve_followup_question(question, recent_history)

        if retrieval_query.lower().strip() != question.lower().strip():
            print(f"  (Understanding as: \"{retrieval_query}\")")

        chunks = rag.retrieve(retrieval_query, k=args.top_k)

        try:
            answer = answer_with_context(
                question=retrieval_query,
                chunks=chunks,
                user_profile=user_profile,
                model=args.model,
                chat_history=recent_history,
                user_email=args.user_email,
            )
        except Exception as exc:
            answer = f"Sorry, something went wrong. Please try again. (Error: {exc})"

        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": answer})

        if not args.no_persist_memory:
            save_session_history(args.session_id, history)

        print(f"\nAssistant: {answer}\n")


if __name__ == "__main__":
    main()
