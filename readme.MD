# StockSense - AI-Powered PSX Investment Platform

StockSense is a full-stack investment platform for the Pakistan Stock Exchange (PSX). It combines a Temporal Fusion Transformer (TFT) model for 7-day stock price forecasting, a RAG-powered AI chatbot, real-time market data scraping, and an interactive learning module — all within a modern, responsive web interface.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [ML Model (TFT)](#ml-model-temporal-fusion-transformer)
- [Model API (FastAPI)](#model-api-fastapi)
- [Backend API (Express.js)](#backend-api-expressjs)
- [AI Chatbot (Flask + RAG + Phi-3)](#ai-chatbot-flask--rag--phi-3)
- [Frontend (React + TypeScript)](#frontend-react--typescript)
- [Data Scrapers](#data-scrapers)
- [CI/CD Workflows](#cicd-workflows-github-actions)
- [Database Schema](#database-schema-mongodb)
- [Setup & Running](#setup--running)

---

## Architecture Overview

```
                    +------------------+
                    |   GitHub Actions  |
                    |  (Daily Cron)     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +--------v--------+
     | Scrapers         |          | TFT Prediction   |
     | (Selenium/PSX)   |          | Pipeline          |
     +--------+---------+          +--------+---------+
              |                             |
              v                             v
         +----------+               +-----------+
         | MongoDB   | <----------->| FastAPI    |
         | (psx db)  |              | Model API  |
         +-----+-----+              +-----------+
               |
     +---------+---------+
     |                   |
+----v----+        +-----v------+
| Express  |        | Flask      |
| Backend  |        | Chatbot    |
| (Node.js)|        | (RAG+LLM) |
+----+-----+        +-----+------+
     |                     |
     +----------+----------+
                |
         +------v------+
         | React        |
         | Frontend     |
         | (Vite + TS)  |
         +-------------+
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| ML Model | PyTorch + PyTorch Forecasting (TFT) |
| Model API | FastAPI + Uvicorn |
| Sentiment | Gemini API, Groq LLM, Tavily Search, VADER |
| Backend | Express.js + Mongoose + JWT |
| Chatbot | Flask + FAISS + Sentence Transformers + Ollama (Phi-3) |
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Database | MongoDB Atlas |
| Scraping | Selenium + ChromeDriver + PyMongo |
| Auth | JWT + bcryptjs + Google OAuth 2.0 |
| CI/CD | GitHub Actions (daily cron workflows) |
| Icons | Lucide React |

---

## Project Structure

```
StockSense/
├── .github/workflows/
│   ├── daily-predictions.yml      # Daily TFT prediction pipeline
│   └── advanced-scraper-retry.yml # Daily PSX data scraping
│
├── model/                         # ML model & prediction engine
│   ├── api/                       # FastAPI server
│   │   ├── main.py                # App entry point
│   │   ├── routes/                # API routes (signals, tickers, health)
│   │   └── services/              # Cache, data, inference, LLM fusion
│   ├── tft/                       # Temporal Fusion Transformer
│   │   ├── config.py              # Hyperparameters & feature definitions
│   │   ├── inference.py           # Frozen model inference
│   │   ├── preprocessing.py       # Feature engineering
│   │   ├── dataset.py             # TimeSeriesDataSet construction
│   │   ├── signals.py             # BUY/SELL/HOLD signal generation
│   │   └── daily_pipeline.py      # Daily inference orchestration
│   ├── scrappers/                 # Data collection scripts
│   │   ├── psx_official.py        # Official PSX data
│   │   ├── technical_pipeline.py  # OHLCV + technical indicators
│   │   ├── technical_updater.py   # Daily data refresh
│   │   └── Gemini_Sentiment.py    # Sentiment via Google Gemini
│   ├── data/                      # Training & inference data
│   ├── artifacts/                 # Trained model checkpoints
│   ├── run_predictions.py         # Daily prediction runner
│   ├── save_to_mongo.py           # Persist predictions to MongoDB
│   ├── evaluate_model.py          # Model evaluation metrics
│   └── requirements.txt
│
├── backend/                       # Node.js REST API
│   ├── src/
│   │   ├── index.js               # Express server entry
│   │   ├── middleware/auth.js      # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js            # Signup, login, Google OAuth
│   │   │   ├── user.js            # Portfolio & preferences
│   │   │   ├── stocks.js          # Stock data queries
│   │   │   ├── market.js          # Indexes, sectors, market watch
│   │   │   ├── predictions.js     # AI predictions & recommendations
│   │   │   ├── courses.js         # Learning module
│   │   │   └── chat.js            # Chat proxy to Flask chatbot
│   │   └── models/
│   │       ├── User.js            # User account + portfolio + progress
│   │       ├── Stock.js           # Market watch data
│   │       ├── Prediction.js      # AI predictions
│   │       ├── Recommendation.js  # Top buy/sell recommendations
│   │       ├── Course.js          # Learning courses
│   │       └── ChatSession.js     # Chat conversation history
│   └── package.json
│
├── Chat-bot StockSense/           # AI Chatbot service
│   ├── api.py                     # Flask REST API (port 5001)
│   ├── rag_engine.py              # RAG pipeline + Ollama LLM integration
│   ├── chat_assistant.py          # Follow-up resolution + context
│   ├── db_connector.py            # MongoDB stock data connector
│   ├── build_rag_index.py         # FAISS index builder
│   ├── personalization.py         # User profile loader
│   ├── rag_index.faiss            # Pre-built vector index
│   ├── rag_chunks.json            # Indexed document chunks
│   ├── Data/                      # Training documents (PDFs + text)
│   ├── sessions/                  # Conversation history (JSON)
│   └── requirements.txt
│
├── Scrapper/                      # Market data scrapers
│   ├── ChromeScrapper.py          # PSX market watch scraper
│   ├── Index.py                   # PSX index scraper
│   ├── sector.py                  # PSX sector scraper
│   ├── run_all_scrapers.py        # Orchestrator
│   └── requirements.txt
│
├── frontend/                      # React web application
│   ├── src/
│   │   ├── App.tsx                # Route definitions + layout
│   │   ├── pages/                 # 13 page components
│   │   ├── components/            # Shared components
│   │   ├── providers/             # Auth + Theme context
│   │   ├── api/                   # Axios client + API functions
│   │   └── index.css              # Global styles
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
│
└── render.yaml                    # Deployment configuration
```

---

## ML Model (Temporal Fusion Transformer)

### Overview

The core prediction engine uses a **Temporal Fusion Transformer (TFT)** — an attention-based deep learning model designed for multi-horizon time series forecasting with interpretable outputs.

### Model Specifications

| Parameter | Value |
|-----------|-------|
| Architecture | Temporal Fusion Transformer |
| Framework | PyTorch Forecasting 1.1.1 + PyTorch Lightning 2.2.0 |
| Encoder Length | 90 days (~4.5 months lookback) |
| Prediction Horizon | 7 days |
| Hidden Size | 128 |
| LSTM Layers | 2 |
| Attention Heads | 4 |
| Output Quantiles | 10th, 25th, 50th (median), 75th, 90th percentile |
| Training Period | 2008-01-01 to 2023-12-31 |
| Validation Period | 2024-01-01 to 2024-12-31 |
| Coverage | 30 KSE-30 stocks across 9 sectors |

### Features

**Target:** Daily close price

**Known Covariates (future-known):**
- Day of week, month
- Oil price (Brent crude)
- USD/PKR exchange rate
- Market-wide indicators

**Unknown Covariates (observed only up to present):**
- OHLCV data (Open, High, Low, Close, Volume)
- Technical indicators (SMA, RSI)
- Sentiment scores
- Volume metrics

### Signal Generation

The model produces BUY/SELL/HOLD signals by combining:
1. **Quantile forecasts** — 7-day price predictions at 5 confidence levels
2. **Directional consensus** — Number of bullish vs bearish days in the forecast window
3. **Sentiment analysis** — Blended score from 4 sources (Tavily, Gemini, Groq, PSX)
4. **LLM Fusion** — Groq/Gemini-generated reasoning that contextualizes the quantitative signal

### Sentiment Pipeline

| Source | Method | Weight |
|--------|--------|--------|
| PSX Announcements | Official company filings | 2.0x |
| PSX Company Pages | Corporate data | 1.5x |
| Gemini API | News search + analysis | 1.2x |
| Groq LLM | VADER compound fallback | 1.2x |
| Tavily | Web search aggregation | 1.2x |

Output: Sentiment score (-1 to +1), confidence, key headlines, reasoning text.

### Prediction Output

Each prediction includes:
- Signal (BUY/SELL/HOLD) with confidence percentage
- Predicted price and expected 7-day return
- Price range (10th-90th percentile)
- 7-day price forecast array (daily median predictions)
- Full quantile forecast (q10, q25, q50, q75, q90 for each day)
- Forecast direction (bullish/bearish/neutral day counts)
- LLM-generated reasoning
- Risk factors
- Trust level (high/medium/low) with explanatory note

---

## Model API (FastAPI)

Serves TFT predictions via REST endpoints.

**Port:** 8000

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with model status |
| `/api/signals/{ticker}` | GET | Get prediction for a specific stock (15-25s cold, <100ms cached) |
| `/api/signals/action/{action}` | GET | Filter cached signals by BUY/SELL/HOLD |
| `/api/refresh/{ticker}` | POST | Bust cache for a ticker (or ALL) |
| `/api/tickers` | GET | List all 30 KSE-30 tickers with metadata |

**Services:**
- **CacheService** — In-memory LRU cache with configurable TTL
- **DataService** — Master CSV management and data freshness gate
- **InferenceService** — TFT model inference pipeline
- **LLMFusionService** — Groq/Gemini reasoning enhancement

---

## Backend API (Express.js)

Main application backend handling authentication, portfolio management, and data routing.

**Port:** 5000

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | No | Register with name, email, password |
| `/api/auth/login` | POST | No | Login with email/password |
| `/api/auth/google` | POST | No | Google OAuth sign-in |
| `/api/auth/me` | GET | Yes | Get current user profile |

### Portfolio & Preferences

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/user/portfolio` | GET | Yes | Get user portfolio |
| `/api/user/portfolio` | POST | Yes | Add/update stock (symbol, quantity, avgCost) |
| `/api/user/portfolio/:symbol` | DELETE | Yes | Remove stock from portfolio |
| `/api/user/preferences` | GET | Yes | Get investment preferences |
| `/api/user/preferences` | PUT | Yes | Update preferences |

### Market Data

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/stocks` | GET | No | List stocks (search, limit, kse30 filter) |
| `/api/stocks/:symbol` | GET | No | Get single stock details |
| `/api/market/watch` | GET | No | KSE-30 market data with sector/index filter |
| `/api/market/indexes` | GET | No | All PSX indexes |
| `/api/market/indexes/:name` | GET | No | Single index with constituents |
| `/api/market/sectors` | GET | No | All PSX sectors |
| `/api/market/sectors/:code` | GET | No | Single sector with companies |

### Predictions

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/predictions` | GET | No | All predictions with live prices |
| `/api/predictions/recommendations` | GET | No | Top buy/sell recommendations |
| `/api/predictions/user/portfolio` | GET | Yes | Predictions for user's holdings |
| `/api/predictions/:symbol` | GET | No | Single stock prediction |

### Learning Module

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/courses` | GET | Yes | List courses with user progress |
| `/api/courses/:courseId` | GET | Yes | Get full course content |
| `/api/courses/:courseId/start` | POST | Yes | Mark course started |
| `/api/courses/:courseId/reading-complete` | POST | Yes | Mark reading done |
| `/api/courses/:courseId/practice-complete` | POST | Yes | Mark practice done |
| `/api/courses/:courseId/submit-quiz` | POST | Yes | Submit quiz answers for grading |
| `/api/courses/user/progress` | GET | Yes | Overall learning progress |

### Chat (Proxy to Flask Chatbot)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/chat/send` | POST | Yes | Send message, get AI response |
| `/api/chat/sessions` | GET | Yes | List all chat sessions |
| `/api/chat/sessions/:id` | GET | Yes | Get session with messages |
| `/api/chat/sessions/:id` | DELETE | Yes | Delete a session |

---

## AI Chatbot (Flask + RAG + Phi-3)

An intelligent chatbot that answers PSX-related questions using Retrieval-Augmented Generation with a local LLM.

**Port:** 5001

### How It Works

```
User Question
     |
     v
Follow-up Resolution (expands "tell me more" → full question)
     |
     v
Intent Classification
  |-- Greeting/Identity → Static response
  |-- Educational ("what is X", "how to Y") → RAG + LLM
  |-- Database Query (prices, portfolio, predictions) → MongoDB + LLM
  |-- Off-domain → Decline
     |
     v
RAG Retrieval (FAISS vector search, top 3 chunks)
     |
     v
Prompt Construction (system prompt + context + history)
     |
     v
Phi-3 via Ollama (local inference, 200 max tokens)
     |
     v
Response (with extractive fallback if LLM unavailable)
```

### RAG Pipeline

| Component | Detail |
|-----------|--------|
| Embedding Model | `all-MiniLM-L6-v2` (384-dim, Sentence Transformers) |
| Vector Store | FAISS (pre-built index, ~2500 vectors) |
| Document Sources | PSX rulebooks, investor guides, IPO guides, course content |
| Chunk Types | Q&A pairs, sections, answer sentences |
| Retrieval | Dense similarity search, multi-pass filtering, deduplication |

### LLM Integration

| Parameter | Value |
|-----------|-------|
| Model | Phi-3 (3.8B parameters) |
| Runtime | Ollama (local inference) |
| URL | `http://127.0.0.1:11434` |
| Max Tokens | 200 |
| Temperature | 0.7 |
| Fallback | Extractive summarization (if Ollama is down) |

### Database Queries

The chatbot can answer operational questions by querying MongoDB directly:
- Stock prices: "What's the price of OGDC?"
- Portfolio: "Show my portfolio"
- Predictions: "Should I buy LUCK?"
- Budget advice: "I have 5000 Rs, which stocks to buy?"
- Market overview: "How is the market today?"
- Top movers: "Top gainers" / "Top losers"
- Sectors and indexes: "Best sector?" / "KSE-100 status?"

### Logging

Structured logging with timestamps for every step:
- Request receipt with session ID
- Follow-up resolution
- RAG retrieval (chunk count, top score, timing)
- Intent routing decision
- LLM call (model, timing, response length)
- Fallback events

---

## Frontend (React + TypeScript)

Single-page application with sidebar navigation, responsive design, and a consistent design system.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Public marketing page with features, process steps, and market snapshot |
| Login | `/login` | Email/password + Google OAuth login |
| Signup | `/signup` | User registration with validation |
| Dashboard | `/dashboard` | Stock search table with quick-add to portfolio |
| Holdings | `/holdings` | Portfolio management with AI predictions, 7-day forecast chart, sentiment, risk factors |
| Market Watch | `/market-watch` | Live market data table with sector/index filters |
| Sectors | `/sectors` | PSX sector browser with expandable company lists |
| Indexes | `/indexes` | PSX index browser with constituent details |
| Learn | `/learn` | Interactive courses with reading, practice, and quizzes |
| AI Chat | `/chat` | Chat interface with session management and suggested questions |
| Preferences | `/preferences` | Investment preferences (risk, sectors, horizon) |
| Settings | `/settings` | Profile, learning progress, security, account management |

### Layout

- **Guest pages** (landing, login, signup): Top navigation bar
- **Authenticated pages**: Collapsible sidebar (240px expanded, 68px collapsed on desktop; slide-in drawer on mobile)

### Components

| Component | Purpose |
|-----------|---------|
| `AppLayout` | Sidebar + scrollable content wrapper for authenticated routes |
| `Sidebar` | Navigation with collapsible desktop mode and mobile drawer |
| `TopNav` | Guest-only top navigation |
| `Toast` | Floating notification popups (success/error/info) |
| `ConfirmModal` | Styled confirmation dialog replacing `window.confirm` |
| `Loader` | Skeleton loaders and spinners |

### Design System

- **Font:** Inter (uniform across all pages)
- **Colors:** Slate palette + orange brand accent (`brand-50` through `brand-600`)
- **Shadows:** Custom `shadow-brand` and `shadow-brand-md` with orange tint
- **Icons:** Lucide React (consistent across entire application)
- **Responsive:** Mobile-first with `sm:`, `md:`, `lg:` breakpoints

---

## Data Scrapers

### PSX Market Data (`Scrapper/`)

Selenium-based scrapers that collect real-time data from the PSX website.

| Script | Target | Output Collection |
|--------|--------|------------------|
| `ChromeScrapper.py` | Market watch (all listed stocks) | `market_watch` |
| `Index.py` | PSX indexes (KSE-100, KSE-30, etc.) | `index` |
| `sector.py` | Sector data with companies | `sector` |
| `run_all_scrapers.py` | Orchestrator (runs all three) | — |

**Technology:** Selenium 4.25 + headless Chrome + PyMongo

### Model Data Scrapers (`model/scrappers/`)

| Script | Purpose |
|--------|---------|
| `psx_official.py` | Official PSX OHLCV data |
| `technical_pipeline.py` | Technical indicators (SMA, RSI, volume metrics) |
| `technical_updater.py` | Daily data refresh for inference |
| `Gemini_Sentiment.py` | Sentiment analysis via Google Gemini API |
| `company_historic_announcements.py` | Company announcement scraping |
| `sentiment_backfill.py` | Historical sentiment data backfill |

---

## CI/CD Workflows (GitHub Actions)

### Daily Predictions (`daily-predictions.yml`)

- **Schedule:** Mon-Fri at 12:00 UTC (5:00 PM PKT, after PSX close)
- **Timeout:** 30 minutes
- **Steps:**
  1. Setup Python 3.11
  2. Install dependencies (cached pip)
  3. Run `python run_predictions.py`
  4. Predictions saved to MongoDB `predictions` and `recommendations` collections
- **Secrets:** MONGO_URI, DB_NAME, GROQ_API_KEY, TAVILY_API_KEY, GEMINI_API_KEY

### Daily Scraping (`advanced-scraper-retry.yml`)

- **Schedule:** Daily at 2:00 AM and 5:00 AM UTC
- **Steps:**
  1. Setup Python 3.10 + Chrome
  2. Run `Index.py` (PSX indexes)
  3. Run `ChromeScrapper.py` (market watch data)
  4. Run `sector.py` (sector data)
- **Secrets:** MONGO_URI, DB_NAME

---

## Database Schema (MongoDB)

**Database:** `psx` (MongoDB Atlas)

| Collection | Description | Key Fields |
|------------|-------------|------------|
| `users` | User accounts | name, email, password, portfolio[], preferences, courseProgress[] |
| `market_watch` | Live stock prices | SYMBOL, CURRENT, CHANGE, VOLUME, HIGH, LOW, OPEN |
| `index` | PSX indexes | index name, current, change, constituents[] |
| `sector` | Sector data | sector name, companies[] |
| `predictions` | AI predictions | symbol, signal, confidence, predictedPrice, priceForecast7d[], sentiment |
| `recommendations` | Top picks | topBuys[], topSells[], summary |
| `courses` | Learning content | title, difficulty, readingMaterial, quizzes[] |
| `chatsessions` | Chat history | userId, title, messages[] |

---

## Setup & Running

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB Atlas account (or local MongoDB)
- Ollama (for chatbot LLM)
- Chrome/Chromium (for scrapers)

### 1. Backend (Express)

```bash
cd backend
npm install
cp .env.example .env  # Configure MONGO_URI, JWT_SECRET, etc.
npm run dev            # Runs on port 5000
```

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev            # Runs on port 5173
```

### 3. Chatbot (Flask)

```bash
cd "Chat-bot StockSense"
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Start Ollama with Phi-3
ollama pull phi3
ollama serve           # Runs on port 11434

# Start chatbot API
python api.py          # Runs on port 5001
```

### 4. Model API (FastAPI)

```bash
cd model
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### 5. Scrapers

```bash
cd Scrapper
pip install -r requirements.txt
python run_all_scrapers.py
```

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URI` | All | MongoDB connection string |
| `JWT_SECRET` | Backend | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Backend | Google OAuth client ID |
| `CHATBOT_URL` | Backend | Flask chatbot URL (default: `http://127.0.0.1:5001`) |
| `LOCAL_LLM_URL` | Chatbot | Ollama URL (default: `http://127.0.0.1:11434`) |
| `LOCAL_LLM_MODEL` | Chatbot | LLM model name (default: `phi3`) |
| `GROQ_API_KEY` | Model | Groq API key for LLM reasoning |
| `GEMINI_API_KEY` | Model | Google Gemini API key |
| `TAVILY_API_KEY` | Model | Tavily search API key |
| `VITE_API_URL` | Frontend | Backend API URL (default: `http://localhost:5000`) |

---

## KSE-30 Coverage

The platform tracks all 30 stocks in the KSE-30 index:

| Sector | Stocks |
|--------|--------|
| Energy | OGDC, PPL, POL |
| Power | HUBC |
| Fertilizer | ENGRO, FFC, EFERT |
| Cement | LUCK, DGKC, MLCF, FCCL, CHCC |
| Banking | MCB, UBL, HBL, BAHL, MEBL, NBP, FABL, BAFL |
| OMC | PSO, SHEL |
| Refinery | ATRL, PRL |
| Technology | SYS |
| Textile/Pharma | SEARL, ILP, TGL, INIL, PAEL |
