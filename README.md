# Spidr

A full-stack Discord-style social platform with TikTok-style video feed, ML-powered FYP recommendations, voice/video channels, real-time messaging, and Electron desktop app support.

---

## Architecture Overview

Spidr is being built as a 3-service backend architecture. The Node.js monolith currently handles everything while the new services are built in parallel.

```
React + Electron (Frontend)
        │
        ├──► spidr-auth    (Spring Boot 3 · Java 21)      Port 8080
        │    └── User auth: register, login, OTP, TOTP, JWT (RS256), password reset
        │    └── MongoDB — users collection
        │
        ├──► spidr-server  (Node.js + Express)            Port 4000  ← current monolith
        │    └── Messages, servers, feeds, social graph, real-time (Socket.io)
        │    └── MongoDB — all non-auth collections
        │
        └──► spidr-ai      (FastAPI + Python)             Port 8000  ← planned
             └── Spidr Bot: global AI assistant (fine-tuned gpt-4o-mini)
             └── FYP Engine: personalized feed algorithm
             └── Reads EngagementEvent collection from MongoDB
```

**JWT:** Spring Boot signs tokens with RS256 private key. Node.js and FastAPI verify using the distributed public key.

---

## Repo Layout

```
spidr-app/
├── spidr-client/       ← React 18 + Vite + Electron desktop app
├── spidr-server/       ← Node.js + Express + MongoDB (current active backend)
├── spidr-auth/         ← Spring Boot auth service (in development)
├── spidr-ai/           ← FastAPI AI service (planned)
├── HOW-TO-RUN.md
├── DEPLOY.md
└── FIXME.md            ← Bug tracker + architecture roadmap
```

---

## Quick Start (Current — Node.js monolith)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional — OTP falls back to in-memory without it)

### 1. Core API (spidr-server)
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

### 2. Frontend (spidr-client)
```bash
cd spidr-client
npm install
npm run dev                   # Opens on http://localhost:5173
```

### 3. Desktop App (.exe)
```bash
cd spidr-client
npm run electron-dev          # Electron pointing at localhost:5173
npm run build-exe             # Full Windows build → dist_installer/SpidrSetup-1.0.0.exe
```

---

## Quick Start (spidr-auth — Spring Boot)

### Prerequisites
- Java 21
- Maven
- MongoDB (same Atlas cluster as spidr-server)

```bash
cd spidr-auth
cp src/main/resources/application.example.properties src/main/resources/application.properties
# Fill in MONGO_URI, RSA key paths, mail config
mvn spring-boot:run            # Starts on port 8080
```

---

## Environment Variables

### spidr-server (`spidr-server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Shared secret (symmetric) — replaced by RS256 when spidr-auth is live |
| `PORT` | — | Server port (default: 4000) |
| `REDIS_URL` | — | Redis for OTP + Socket.io adapter (falls back to memory) |
| `R2_ACCOUNT_ID` | — | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | — | R2 API key |
| `R2_SECRET_ACCESS_KEY` | — | R2 API secret |
| `R2_BUCKET_NAME` | — | R2 bucket (default: spidr-media) |
| `R2_PUBLIC_URL` | — | Public r2.dev URL for uploaded files |
| `OPENAI_API_KEY` | — | Enables AI features (hashtags, bot responses) |
| `ANTHROPIC_API_KEY` | — | Alternative to OpenAI |
| `EMAIL_SERVICE` | — | `gmail` or `resend` |
| `EMAIL_USER` | — | Sender email address |
| `EMAIL_PASS` | — | Gmail App Password or Resend API key |
| `CLIENT_ORIGIN` | — | Frontend URL for CORS (default: any localhost) |
| `SPOTIFY_CLIENT_ID` | — | Spotify API for music search in THE WEB |
| `SPOTIFY_CLIENT_SECRET` | — | Spotify API secret |

> **Dev tip:** Without `EMAIL_USER`, OTP codes print to the server terminal — no email setup needed for local testing.

### spidr-auth (`spidr-auth/application.properties`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | Same MongoDB cluster as spidr-server |
| `RSA_PRIVATE_KEY_PATH` | ✅ | Path to RS256 private key (PEM) — signs JWTs |
| `RSA_PUBLIC_KEY_PATH` | ✅ | Path to RS256 public key (PEM) — distribute to other services |
| `JWT_EXPIRY` | — | Token expiry (default: 7d) |
| `MAIL_HOST` | — | SMTP host |
| `MAIL_USER` | — | SMTP username |
| `MAIL_PASS` | — | SMTP password |
| `REDIS_URL` | — | Redis for OTP TTL storage |

---

## Features

### Communication
- Real-time server chat (Socket.io)
- Direct Messages with read receipts and typing indicators
- Group chats with voice/video calls
- Right-click context menus on messages and users

### THE WEB (TikTok-style Feed)
- FYP algorithm — personalized feed based on watch time, likes, shares, skips
- Engagement data collection feeding the FastAPI recommendation engine
- Video upload with Studio editor: filters, trim, thumbnail picker
- Audio database with trending sounds
- Comments, reactions, collections

### Auth & Security
- Email 2FA OTP on every login (via spidr-auth)
- Authenticator app (TOTP/QR code) as alternative
- Override Protocol (password reset via 2FA)
- RS256 JWT — Spring Boot signs, all services verify
- Account banning, timeouts, server moderation

### AI (spidr-ai — in development)
- **Spidr Bot** — one global AI assistant powered by fine-tuned gpt-4o-mini
- **FYP Engine** — ML recommendation system trained on engagement events
- Cold start: user selects initial categories → behavioral learning takes over over time

### Customization
- Theme Studio: solid, gradient, or custom background image
- APEX tier: animated profile threads, entry effects, squad overclock
- Custom server emojis and stickers

### Bots & Modules
- Bot Laboratory with AI-powered custom bots
- Module Nexus for installable widgets

---

## Service Detail

### spidr-server (Node.js)
```
spidr-server/src/
├── routes/          ← 28 REST route files
├── models/          ← 23 Mongoose models
├── socket/
│   └── handlers.js  ← Real-time events (messages, voice, reactions)
├── middleware/
│   └── auth.js      ← JWT verification
├── utils/
│   ├── crudRouter.js    ← Generic CRUD factory with ownership checks
│   ├── azureStorage.js  ← Cloudflare R2 file upload (local /uploads in dev)
│   └── mailer.js        ← OTP emails (moves to spidr-auth)
├── services/
│   └── telemetryManager.js  ← Admin nerve center stats
└── workers/
    └── ffmpegWorker.js  ← Video transcoding (separate process)
```

### spidr-auth (Spring Boot) — in development
```
spidr-auth/src/main/java/com/spidr/auth/
├── controller/      ← REST endpoints (AuthController)
├── service/         ← Business logic (AuthService, OtpService, TokenService)
├── model/           ← MongoDB documents (User)
├── repository/      ← Spring Data MongoDB repos
├── security/        ← Spring Security config, JWT filter, RS256 keys
├── dto/             ← Request/response bodies
└── util/            ← TOTP, email helpers
```

### spidr-ai (FastAPI) — planned
```
spidr-ai/
├── main.py
├── routers/
│   ├── bot.py       ← POST /ai/chat (Spidr Bot)
│   └── fyp.py       ← POST /fyp/feed (FYP recommendations)
├── services/
│   ├── bot_service.py         ← OpenAI fine-tuned model + RAG
│   └── recommendation.py      ← Engagement-based ranking
└── models/
    └── engagement.py          ← Reads EngagementEvent from MongoDB
```
