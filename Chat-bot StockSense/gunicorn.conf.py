import os

# Render injects the port via $PORT (defaults to 10000 locally).
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
workers = 1            # keep memory low — torch + faiss + the embedding model are heavy
threads = 2
timeout = 300          # first request lazy-loads the RAG engine + embedding model
preload_app = True
