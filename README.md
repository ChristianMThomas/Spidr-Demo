# 🕷 Spidr

A full-stack Discord-style social platform with TikTok-style video feed, ML-powered recommendations, voice/video channels, real-time messaging, and Electron desktop app support.

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional — OTP falls back to in-memory without it)

### 1. Backend
```bash
cd spidr-server
npm install
cp .env.example .env          # Fill in MONGO_URI and JWT_SECRET at minimum
npm run dev                   # Starts on port 4000
```

You should see:
```
✓ MongoDB connected
✓ Spidr server running on port 4000
```

### 2. Frontend
```bash
cd spidr-client
npm install
npm run dev                   # Opens on http://localhost:5173
```

### 3. Build Desktop App (.exe)
```bash
cd spidr-client
npm run build-exe             # Output: dist_installer/SpidrSetup-1.0.0.exe
```

---

## Environment Variables (spidr-server/.env)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | 256-bit random secret for auth tokens |
| `PORT` | — | Server port (default: 4000) |
| `REDIS_URL` | — | Redis for OTP storage (falls back to memory) |
| `OPENAI_API_KEY` | — | Enables AI features (hashtags, bot, feed AI) |
| `ANTHROPIC_API_KEY` | — | Alternative to OpenAI |
| `EMAIL_USER` | — | Gmail address for 2FA emails |
| `EMAIL_PASS` | — | Gmail App Password |
| `AZURE_STORAGE_CONN` | — | Azure Blob for file uploads (uses local /uploads in dev) |
| `CLIENT_ORIGIN` | — | Frontend URL for CORS (default: any localhost) |

> **Dev tip:** Without `EMAIL_USER`, OTP codes are printed to the server terminal — no email setup needed for testing.

---

## Features

### 💬 Communication
- Real-time server chat (Socket.io + 2s polling fallback)
- Direct Messages with read receipts and typing indicators
- Group chats with voice/video calls
- Full right-click context menus on messages and users

### 🕸 THE WEB (TikTok-style feed)
- ML-ranked FYP algorithm based on watch time, loops, likes, shares
- Video upload with Studio editor: filters, trim, thumbnail picker
- Audio database with trending sounds
- Comments, reactions, collections

### 🔐 Auth & Security
- Email 2FA OTP on every login
- Authenticator app (TOTP/QR code) as alternative
- Override Protocol (password reset via 2FA)
- Account banning, timeouts, server moderation

### 🎨 Customization
- Theme Studio: solid, gradient, or custom background image (all users)
- APEX tier with animated profile threads, entry effects, squad overclock
- Custom server emojis and stickers

### 🤖 Bots & Modules
- Bot Laboratory with AI-powered custom bots
- Module Nexus for installable widgets
- Spidr AI assistant in every channel

---

## Architecture

```
spidr.exe (Electron/React)  ◄──HTTPS/WSS──►  api.yourdomain.com (Node.js VPS)
                                              Express + MongoDB + Socket.io
                                              Redis + Azure Blob
spidr/
├── spidr-client/   ← React + Electron
│   ├── src/
│   │   ├── pages/
│   │   ├── components/spidr/
│   │   ├── components/feed/
│   │   ├── components/nexus/
│   │   ├── api/apiClient.js    ← All API calls + Socket.io
│   │   └── lib/AuthContext.jsx ← JWT auth + 2FA state
│   └── electron/               ← Desktop wrapper
└── spidr-server/   ← Node.js backend
    ├── src/
    │   ├── routes/             ← 28 REST routes
    │   ├── models/             ← 23 Mongoose models
    │   ├── socket/handlers.js  ← Real-time events
    │   ├── utils/
    │   │   ├── crudRouter.js   ← Generic CRUD factory
    │   │   ├── azureStorage.js ← File upload (Azure/local)
    │   │   └── mailer.js       ← OTP emails
    │   └── index.js
    └── .env.example
```
