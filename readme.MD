# 📱 StockSense - PSX Investment Management Platform

[![Status](https://img.shields.io/badge/Status-Ready-brightgreen)]()
[![License](https://img.shields.io/badge/License-MIT-blue)]()
[![Version](https://img.shields.io/badge/Version-1.0.0-blue)]()

A modern, full-stack investment management platform for Pakistani Stock Exchange (PSX). Built with React, TypeScript, Express.js, and MongoDB.

## 🌟 Features

### 👤 User Management
- ✅ Email/password authentication
- ✅ Google OAuth 2.0 integration
- ✅ JWT-based secure sessions
- ✅ Auto-login on page refresh
- ✅ Profile management

### 🎯 Investment Preferences
- ⚠️ **Risk Tolerance:** Conservative, Moderate, or Aggressive
- ⏱️ **Investment Horizon:** 6 months to 5+ years
- 📊 **Market Cap Focus:** Large-cap, Mid-cap, or Small-cap
- 💰 **Dividend Preference:** Cash out or Reinvest
- 🏭 **Preferred Sectors:** Multi-select (10+ PSX sectors)

### 📈 Portfolio Management
- ✅ Add/remove stocks from portfolio
- ✅ Track quantity of holdings
- ✅ Store average cost per stock
- ✅ View portfolio performance
- ✅ Real-time stock data

### 🔍 Stock Browsing
- ✅ Search stocks by symbol
- ✅ View PSX market data
- ✅ Price, change %, and volume
- ✅ Sort and filter capabilities

### 🎨 User Interface
- ✅ Light, minimal design
- ✅ Responsive (mobile, tablet, desktop)
- ✅ Smooth animations & transitions
- ✅ Accessibility features
- ✅ Professional gradient backgrounds

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Node.js** 16+ and npm
- **MongoDB** (local or Atlas)
- **Google OAuth credentials**

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

**Then open:** http://localhost:5173 🎉

👉 **See [QUICK_START.md](./QUICK_START.md) for detailed instructions**

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[QUICK_START.md](./QUICK_START.md)** | 5-minute setup guide |
| **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** | Complete installation & configuration |
| **[API_DOCS.md](./API_DOCS.md)** | All API endpoints with examples |
| **[ENV_SETUP.md](./ENV_SETUP.md)** | Environment variables reference |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | What's been built |

---

## 🏗 Architecture

### Frontend
```
React 18 + Vite + TypeScript
├── Pages (5): Landing, Login, Signup, Preferences, Dashboard
├── Components: TopNav, AuthProvider
├── API Client: Axios with environment-based URLs
└── Styling: Tailwind CSS (light minimal palette)
```

### Backend
```
Express.js + MongoDB + Mongoose
├── Routes: Auth, Preferences, Portfolio, Stocks
├── Models: User (with preferences & portfolio)
├── Middleware: JWT authentication
└── Database: MongoDB collection 'market_watch'
```

## 🔌 API Overview

### Authentication
```
POST   /api/auth/signup       → Create account
POST   /api/auth/login        → Sign in
POST   /api/auth/google       → Google OAuth
GET    /api/auth/me           → Current user (protected)
```

### Preferences
```
GET    /api/user/preferences  → Get preferences
PUT    /api/user/preferences  → Save preferences
```

### Portfolio
```
GET    /api/user/portfolio    → Get holdings
POST   /api/user/portfolio    → Add/update stock
DELETE /api/user/portfolio/:symbol → Remove stock
```

### Stocks
```
GET    /api/stocks            → List all stocks
GET    /api/stocks/:symbol    → Get single stock
```

👉 **See [API_DOCS.md](./API_DOCS.md) for full reference with cURL examples**

---

## 🎯 User Flow

```
1. Landing Page (/)
   ↓
2. Sign Up (/signup) → Google OAuth or email/password
   ↓
3. Set Preferences (/preferences) → 5 investment questions
   ↓
4. Dashboard (/dashboard) → Manage portfolio & search stocks
   ↓
5. Logout → Return to landing page
```

---

## 🛠 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Lightning fast build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Axios** - HTTP client
- **React Router** - Navigation
- **Google OAuth** - Authentication

### Backend
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Google Auth Library** - OAuth verification

---

## 🧪 Testing Checklist

Essential tests to verify everything works:

- [ ] User registration (email/password)
- [ ] User login with credentials
- [ ] Google OAuth signup/login
- [ ] Preference saving
- [ ] Stock search functionality
- [ ] Add stock to portfolio
- [ ] Update stock quantity
- [ ] Remove stock from portfolio
- [ ] Logout functionality
- [ ] Data persistence after refresh
- [ ] Mobile responsiveness
- [ ] Error messages display

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check MongoDB is running
mongod

# Check port 5000 is free
lsof -i :5000

# Verify .env file exists
cat backend/.env
```

### Frontend won't connect
```bash
# Check VITE_API_URL in frontend/.env
# Should be: http://localhost:5000
```

### Google OAuth fails
```bash
# Verify Google credentials match in both .env files
# Check Redirect URIs in Google Console
```

👉 **See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete troubleshooting**

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
# Deploy dist/ to Vercel
```

### Backend (Render/Heroku)
```bash
# Set environment variables on hosting platform
# Deploy code
```

👉 **See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for deployment instructions**

---

## 📁 Project Structure

```
Final Year Project/
├── backend/
│   ├── src/
│   │   ├── index.js           # Server entry
│   │   ├── models/            # Database schemas
│   │   ├── routes/            # API endpoints
│   │   └── middleware/        # JWT verification
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/             # 5 main pages
│   │   ├── components/        # Reusable components
│   │   ├── api/               # API functions
│   │   ├── providers/         # Auth context
│   │   └── types.ts           # TypeScript types
│   ├── package.json
│   └── .env.example
├── Scrapper/                  # Python stock scraper
├── QUICK_START.md             # 5-min setup
├── SETUP_GUIDE.md             # Full docs
├── API_DOCS.md                # API reference
└── ENV_SETUP.md               # Env variables
```

---

## 🎓 Learning Resources

### Frontend
- [React Docs](https://react.dev)
- [Vite Guide](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

### Backend
- [Express.js](https://expressjs.com)
- [MongoDB Docs](https://docs.mongodb.com)
- [JWT.io](https://jwt.io)

---

## 🎯 Project Status

**Overall:** 95% Complete ✅

Ready for:
- ✅ Local development
- ✅ Testing all features
- ✅ Production deployment
- ✅ Extending with new features

---

## 🚀 Getting Started NOW

```bash
# 1. Navigate to project
cd "Final Year Project"

# 2. Start Backend
cd backend && npm install && npm run dev

# 3. Start Frontend (in new terminal)
cd frontend && npm install && npm run dev

# 4. Open browser
# http://localhost:5173

# 5. Sign up & test!
```

That's it! 🎉

---

**Made with ❤️ for PSX Investment Management**

Last Updated: December 7, 2024 | Version: 1.0.0