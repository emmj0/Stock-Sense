StockSense RAG Chatbot

This project builds a Retrieval-Augmented Generation chatbot over your PSX learning material.

What is implemented:
- RAG indexing from both Data/text and Data/pdf
- FAISS vector search for relevant chunks
- LLM answer generation using retrieved context
- MongoDB personalization hook for user stocks and predictions

Project files:
- build_rag_index.py: Creates rag_index.faiss and rag_chunks.json
- rag_engine.py: Retrieval and LLM answer generation
- chat_assistant.py: Interactive CLI chatbot
- personalization.py: MongoDB user profile loader
- .env.example: Environment variable template

Quick start:
1. Create and activate virtual environment
   Windows PowerShell:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

2. Install packages
   pip install -r requirements.txt

3. Configure environment
   Copy .env.example to .env and set at least:
   GEMINI_API_KEY=your-gemini-api-key-here
   GEMINI_MODEL=gemini-1.5-flash
   (Get a free key at https://aistudio.google.com/apikey)

4. (No local model needed — the chatbot calls the hosted Gemini API.)

5. Build index
   python build_rag_index.py

6. Run chatbot
   python chat_assistant.py

Run with personalization user id:
- python chat_assistant.py --user-id u123

Conversation context and memory:
- Chatbot now keeps recent turns as conversational context.
- Session history is saved in sessions/<session-id>.json by default.
- Reuse context across restarts with:
   python chat_assistant.py --session-id mujtaba-demo
- Control context window size:
   python chat_assistant.py --memory-window 8
- Disable persistence for temporary sessions:
   python chat_assistant.py --no-persist-memory

How LLM integration works:
- The question is embedded using sentence-transformers
- Top-k chunks are retrieved from FAISS
- The retrieved context and optional user profile are sent to the Google Gemini API
- Gemini output is returned as the chatbot response
- If GEMINI_API_KEY is missing or the call fails, the bot falls back to an
  extractive answer built from the retrieved context (so it still works offline)

Changing the Gemini model:
- Set GEMINI_MODEL in .env (e.g. gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash)

MongoDB integration notes:
- Add MONGO_URI in .env
- Current loader reads users collection with fields user_id, stocks, predictions
- You can adapt personalization.py to your exact schema

Production next steps:
- Add conversation memory persistence in MongoDB (currently local file session memory is enabled)
- Add per-user retrieval filters and risk profile handling
- Expose REST API (FastAPI/Flask) and connect to frontend
- Add tests for retrieval quality and prompt safety
