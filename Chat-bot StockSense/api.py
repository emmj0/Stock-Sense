"""StockSense Chatbot REST API.

Endpoints:
    POST /api/chat          - Send message, get response
    GET  /api/chat/history   - Get session history
    DELETE /api/chat/history - Clear session history
    GET  /api/health         - Health check
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

import db_connector as db
from chat_assistant import resolve_followup_question, CONTEXT_WINDOW

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("stocksense")

app = Flask(__name__)
CORS(app)

SESSIONS_DIR = Path("sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

# Lazy-loaded RAG engine (loaded on first chat request to save startup memory)
_rag: Optional[object] = None


def get_rag():
    global _rag
    if _rag is None:
        from rag_engine import RAGEngine
        logger.info("Loading RAG engine...")
        t = time.time()
        _rag = RAGEngine()
        logger.info(f"RAG engine ready — {_rag.index.ntotal} vectors loaded in {time.time()-t:.1f}s")
    return _rag


# Test DB on startup (lightweight)
if db.is_db_connected():
    logger.info("Connected to PSX database")
else:
    logger.warning("Database not connected — running in offline mode")

ollama_model = os.getenv("LOCAL_LLM_MODEL", "phi3")
ollama_url = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:11434")
logger.info(f"LLM: {ollama_model} via Ollama at {ollama_url}")
logger.info("API ready. RAG engine will load on first chat request.")


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

def _load_history(session_id: str) -> List[Dict[str, str]]:
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_history(session_id: str, history: List[Dict[str, str]]) -> None:
    path = SESSIONS_DIR / f"{session_id}.json"
    path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    rag = _rag
    return jsonify({
        "status": "ok",
        "rag_loaded": rag is not None,
        "rag_vectors": rag.index.ntotal if rag else 0,
        "db_connected": db.is_db_connected(),
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint.

    Request JSON:
    {
        "message": "What is PSX?",
        "session_id": "user123",       // optional, defaults to "default"
        "user_email": "user@email.com"  // optional, for portfolio/personalization
    }

    Response JSON:
    {
        "reply": "PSX stands for...",
        "resolved_query": "What is PSX?",  // only if follow-up was expanded
        "session_id": "user123"
    }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("message", "").strip():
        logger.warning("Chat request with empty message")
        return jsonify({"error": "Missing 'message' in request body"}), 400

    message = data["message"].strip()
    session_id = data.get("session_id", "default")
    user_email = data.get("user_email")
    user_context = data.get("user_context")

    logger.info(f"[{session_id}] User: {message[:120]}")

    # Load engine + history
    rag = get_rag()
    from rag_engine import answer_with_context

    history = _load_history(session_id)
    recent_history = history[-(CONTEXT_WINDOW * 2):] if history else []

    # Resolve follow-ups
    resolved_query = resolve_followup_question(message, recent_history)
    if resolved_query.lower().strip() != message.lower().strip():
        logger.info(f"[{session_id}] Follow-up resolved: {resolved_query[:120]}")

    # Retrieve + answer
    t_start = time.time()
    chunks = rag.retrieve(resolved_query, k=5)
    t_retrieve = time.time() - t_start
    top_score = max((c.score for c in chunks), default=0)
    logger.info(f"[{session_id}] RAG retrieved {len(chunks)} chunks in {t_retrieve:.2f}s (top score: {top_score:.3f})")

    try:
        t_start = time.time()
        reply = answer_with_context(
            question=resolved_query,
            chunks=chunks,
            chat_history=recent_history,
            user_email=user_email,
            user_context=user_context,
        )
        t_answer = time.time() - t_start
        logger.info(f"[{session_id}] Reply generated in {t_answer:.2f}s ({len(reply)} chars)")
    except Exception as exc:
        logger.error(f"[{session_id}] Answer generation failed: {exc}", exc_info=True)
        reply = "Sorry, something went wrong. Please try again."

    # Save to history
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    _save_history(session_id, history)

    logger.info(f"[{session_id}] Bot: {reply[:120]}...")

    response = {"reply": reply, "session_id": session_id}
    if resolved_query.lower().strip() != message.lower().strip():
        response["resolved_query"] = resolved_query

    return jsonify(response)


@app.route("/api/chat/history", methods=["GET"])
def get_history():
    """Get chat history. Query: ?session_id=xxx&limit=50"""
    session_id = request.args.get("session_id", "default")
    limit = min(int(request.args.get("limit", 50)), 200)

    history = _load_history(session_id)
    return jsonify({
        "session_id": session_id,
        "messages": history[-limit:],
        "total": len(history),
    })


@app.route("/api/chat/history", methods=["DELETE"])
def clear_history():
    """Clear chat history for a session."""
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", request.args.get("session_id", "default"))
    _save_history(session_id, [])
    return jsonify({"status": "cleared", "session_id": session_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("CHATBOT_PORT", 5001)), debug=False)
