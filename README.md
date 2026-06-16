# Spidr

A full-stack Discord-style social platform with a TikTok-style video feed (**THE WEB**), real-time messaging, voice/video channels, a TheaterMode + DJ Spotify experience inside voice calls, and an Electron desktop app.

> Public web: [spidrapp.infinitetechteam.com](https://spidrapp.infinitetechteam.com)

---

## Architecture

Two services + a client.

```
React + Vite + Electron (Frontend — :5173 dev)
        │
        ├──► spidr-auth    (Spring Boot 3 · Java 21)      :8080
        │    └── Register, login, OTP email 2FA, password reset, JWT issuance
        │    └── HS256 JWT signing (shared secret with spidr-server)
        │    └── MongoDB — users collection
        │
        └──► spidr-server  (Node.js · Express · Socket.io) :4000
             └── Messages, servers, feeds, social graph, voice, bots, AI features
             └── HS256 JWT verification (same shared secret)
             └── MongoDB — all non-auth collections (38 routes, 29 models)
             └── Cloudflare R2 file storage in prod, local /uploads in dev
```

**JWT:** spidr-auth signs with HS256 using a base64-encoded shared secret; spidr-server verifies using the same secret (`Buffer.from(JWT_SECRET, 'base64')`). Tokens are stored in `localStorage` as `spidr_token`.

There is **no** separate AI service. Bot, FYP, and AI assistant features run inside `spidr-server` (`routes/ai.js`, `routes/customBots.js`, `routes/algorithm.js`).

---

## Repo Layout

```
Spidr-Demo/
├── spidr-client/       ← React 18 + Vite + Electron desktop app
├── spidr-server/       ← Node.js + Express + MongoDB (core API)
├── spidr-auth/         ← Spring Boot 3 auth microservice
├── .claude/commands/   ← Project slash commands (see SKILLS.md)
├── SKILLS.md           ← Onboarding doc for the Claude Code workflow
├── CLAUDE.md           ← Project instructions consumed by Claude Code
├── HOW-TO-RUN.md
├── DEPLOY.md
├── CHANGES.md          ← Cumulative fix-pass summaries
└── FIXME.md            ← Bug + task backlog
```

---

## Quick Start

### Easiest — use `/dev`

If you've got [Claude Code](https://claude.ai/code) open in the repo, just run:

```
/dev
```

It boots all three services in background processes. See **SKILLS.md** for the full workflow.

### Manual

#### Prerequisites
- Node.js 18+
- Java 21 (for spidr-auth)
- MongoDB (local or Atlas)
- Maven (for spidr-auth)
- Redis (optional — OTP and Socket.io fall back to in-memory)

#### 1. `spidr-server` (core API, :4000)
```bash
cd spidr-server
npm install
cp .env.example .env          # fill in MONGO_URI + JWT_SECRET at minimum
npm run dev
```

#### 2. `spidr-auth` (Spring Boot, :8080)
```bash
cd spidr-auth
./mvnw spring-boot:run -DskipTests
```
Without `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` set, registration emails fail at the OTP step. The service falls back to a built-in dev JWT secret if `JWT_SECRET` is unset — fine for local, must be overridden in prod and **must match spidr-server's `JWT_SECRET`**.

#### 3. `spidr-client` (Vite, :5173)
```bash
cd spidr-client
npm install
npm run dev
```

#### 4. Desktop app
```bash
cd spidr-client
npm run electron-dev          # Electron pointing at localhost:5173
npm run build-exe             # Windows .exe → dist_installer/
```

---

## Environment Variables

### `spidr-server/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Base64-encoded HS256 secret. **Must match spidr-auth's `JWT_SECRET`.** |
| `PORT` | — | Default 4000 |
| `REDIS_URL` | — | Redis URL (Socket.io adapter + OTP TTL) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | — | Cloudflare R2 file storage (falls back to local `/uploads` in dev) |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | — | Enables AI features (hashtag suggestions, bots) |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` | — | `gmail` or `resend`. Without it, OTPs print to the console — fine for dev |
| `CLIENT_ORIGIN` | — | CORS origin (default: any localhost). Set in prod |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | — | Spotify search, Now Playing OAuth, DJ Sessions |
| `STEAM_API_KEY` | — | Steam Now Playing module |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | — | WebRTC TURN (falls back to public openrelay TURN — fine for beta) |

### `spidr-auth/.env`

| Variable | Required | Description |
|---|---|---|
| `SPRING_DATA_MONGODB_URI` (or `MONGO_URI`) | ✅ | Same MongoDB cluster as spidr-server |
| `JWT_SECRET` | ✅ | Base64-encoded HS256 secret. **Must match spidr-server's `JWT_SECRET`** |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | ✅ for register flow | Gmail App Password (or use Resend via `RESEND_API_KEY` / `MAIL_FROM`) |

> ⚠️ **Both services need the same `JWT_SECRET`.** spidr-auth signs, spidr-server verifies — mismatched secrets mean every API call 401s.

---

## Features

### THE WEB — TikTok-style feed
- FYP algorithm ranks by watch time, likes, shares, skips, and replays
- The Weaver upload studio: signature filters (Dormant / Glitch / Neon Tear), dual-handle scrubber, external audio grafting from YouTube / Spotify / Apple Music
- Reposts, comments with GIF/image attachments, Saved collections
- Engagement events feed the recommendation ranker

### Communication
- Real-time server chat (Socket.io)
- DMs with read receipts, typing indicators, voice messages
- Group chats with voice + video
- Right-click context menus on messages, users, channels
- Linkify, Holo-Ping reply notifications, slash-command autocomplete with grouped bot cards

### Voice channels
- **Theater Mode** — when someone screen-shares, a full-bleed Theater Stage takes over the call (host scroll broadcasts to all members)
- **DJ Sessions** — host picks a Spotify track, the server stores `{host_id, track_id, started_at}` and pushes the DJ matrix to everyone in the channel; listeners poll the host's now-playing so album art + progress stay in sync
- Screen share → main stage + audio-reactive sidebar pills
- Minimized call shows a live picture-in-picture of the active stream (screen share > camera)
- Multi-instance via optional Redis Socket.io adapter

### Profile & customization
- **Profile Anthem** — set a Spotify track that auto-plays muted on profile view
- **Spotify Now Playing** — connect your Spotify (OAuth Authorization Code); server polls every 10s with token caching & refresh. Closed beta capped at 25 testers per Spotify dev-mode rules
- **Weather widget** — geolocation prompted once, lat/lon saved on the **owner's** profile, viewer always sees the owner's weather (city name is intentionally hidden for privacy)
- Steam Now Playing module
- Nameplate Cropper, custom backgrounds, APEX Symbiote tier (animated threads, Stream HUD, Frame Vault, custom badges)
- Theme Studio: solid, gradient, or custom background image

### Auth & Security
- Email 2FA OTP on every login (spidr-auth, with Redis-backed rate limiting)
- TOTP / authenticator-app 2FA (currently on spidr-server, migration to spidr-auth tracked in FIXME)
- Override Protocol (password reset via 2FA code)
- Account banning, timeouts, server moderation
- Auto Moderator bot (spam + word filter, server-side)

### Bots & Modules
- **Auto Moderator** — spam detection + customizable word filter
- **Welcome Bot** — customizable greeting with `{user}` / `{server}` placeholders, fires on every join path
- **Game Master** — `/trivia` mini-game
- **Music Master** — `/play` with YouTube title fetching, `/skip`, `/stop`
- Bot Laboratory: build custom AI bots
- **Module Nexus** — installable widget system; widgets currently shipped include Spotify Now Playing, Steam, Gaming Uplink (auto-detects games from any launcher), Weather, and more

### Desktop (Electron)
- Custom title bar (minimize / maximize / close)
- Window dragging from the top edge, resizable
- Spidr Protocol: transparent click-through overlay so you can read and send chat over a game

---

## Deployed Infrastructure

| Service | Host | Domain |
|---|---|---|
| spidr-auth | Railway | `auth.spidrapp.infinitetechteam.com` |
| spidr-server | Railway | `cooperative-simplicity-production-bb44.up.railway.app` |
| spidr-client (web) | Hostinger via FTPS GitHub Action | `spidrapp.infinitetechteam.com` |
| Database | MongoDB Atlas | `spidrserver.eijml8k.mongodb.net` (db: `spidr`) |

---

## Service Detail

### `spidr-server` (Node.js)

```
spidr-server/src/
├── routes/             ← 38 REST route files (auth, messages, feeds, spotify, dj-session, …)
├── models/             ← 29 Mongoose models
├── socket/
│   └── handlers.js     ← Real-time events (messages, voice, reactions, presence)
├── middleware/
│   └── auth.js         ← HS256 JWT verification
├── utils/
│   ├── crudRouter.js   ← Generic CRUD factory with ownership checks
│   ├── azureStorage.js ← Cloudflare R2 upload (local /uploads in dev)
│   └── mailer.js
├── services/
│   └── telemetryManager.js
└── workers/
    └── ffmpegWorker.js ← Video transcoding (separate process; `npm run worker`)
```

### `spidr-auth` (Spring Boot 3)

```
spidr-auth/src/main/java/com/spidr/spidr_auth/
├── controller/         ← AuthController, UserController
├── service/            ← AuthService, UserService, JwtService (HS256), EmailService, RateLimiterService
├── model/              ← User document
├── repository/         ← Spring Data MongoDB repos
├── config/             ← SecurityConfiguration, JwtAuthenticationFilter, ApplicationConfig
├── dto/                ← Register, Login, OTP, ForgotPassword, ResetPassword, ChangePassword
├── responses/          ← LoginResponse
└── exception/          ← GlobalExceptionHandler
```

### `spidr-client` (React + Vite + Electron)

```
spidr-client/src/
├── pages/                          ← Registered in pages.config.js
├── api/apiClient.js                ← Native fetch wrappers (authRequest → :8080, request → :4000),
│                                      surfaces 429 + Retry-After to callers, lazy Socket.io
├── components/
│   ├── spidr/                      ← Chat, voice, DJ, Theater, profile, bots, AI
│   │   ├── DJMatrix.jsx            ← Voice-call DJ session centerpiece
│   │   ├── TheaterStage.jsx        ← Full-bleed feed-broadcast view
│   │   ├── NowPlayingPulse.jsx     ← Live Spotify track indicator
│   │   ├── SonicUplinkCard.jsx     ← Profile Anthem player
│   │   ├── SpidrSystem.jsx         ← Patch-note terminal on the home page
│   │   └── … (KineticChat, ServersPanel, DirectMessages, HolographicProfile, …)
│   ├── feed/                       ← THE WEB feed components
│   ├── nexus/                      ← Module Nexus + widgets
│   ├── voice/                      ← CallDeck, CallOverlay
│   └── ui/                         ← shadcn/ui primitives
├── hooks/                          ← useNowPlaying, useSpeakingDetector, useTension, …
└── electron/                       ← main.js, preload.js
```

---

## Working with Claude Code

This repo ships a set of project slash commands that automate the daily release loop. **Read `SKILLS.md` for the full workflow.** Short version:

| Command | What it does |
|---|---|
| `/start` | Prime the session (best model + concise mode + minimum tokens) |
| `/dev` | Boot all three services in the background |
| `/kill` | Stop them all |
| `/patch` | Log a new SPIDR_SYS patch note in both sources of truth |
| `/security-cleanup` | Full security audit with auto-fixes |
| `/git-workflow` | Status → drafted commit (no Claude attribution) → push |
| `/ship` | Full release: audit → patch note → commit → push |
| `/spidr-update` | Re-sync `CLAUDE.md` with current code state |

Typical day: `/start` → `/dev` → … work … → `/ship` → `/kill`.
