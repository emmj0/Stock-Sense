# StockSense Backend

This folder contains a minimal Node.js + Express backend for the StockSense project. It provides authentication routes (signup/login/me) and serves a simple landing page.

Prerequisites
- Node.js (16+ recommended)
- MongoDB (local or Atlas)

Quick start

1. Open a terminal in `backend/`.
2. Install dependencies:

```powershell
npm install
```

3. Copy the example env and edit values:

```powershell
copy .env.example .env
# then edit .env to set MONGO_URI and JWT_SECRET
```

4. Start the server:

```powershell
npm run dev
```

Server will listen on `PORT` (default `5000`). Landing page is available at `http://localhost:5000/` and APIs under `/api/auth`.

Notes
- This is a minimal scaffold. For production, secure `JWT_SECRET`, enable HTTPS, add rate limiting, input validation, and stronger error handling.
