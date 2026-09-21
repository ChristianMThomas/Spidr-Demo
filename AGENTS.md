# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What is Spidr

Spidr is a Discord-style communication platform with servers, channels, DMs, voice calls (WebRTC), a social video feed ("THE WEB"), a module/widget system ("Module Nexus"), AI chat, custom bots, a virtual currency (Biomass), and an XP system (Tension). It ships as both a web app and a packaged Windows `.exe` via Electron.

## Monorepo Structure

```
spidr-client/       React + Vite frontend (web + Electron)
spidr-server/       Node.js / Express / Socket.io / MongoDB backend (port 4000)
spidr-auth/         Spring Boot auth microservice — Java 25 (port 8080)
spidr-beta/
  spidr-landing/    Public marketing landing page (Vite + React, deploys to spidrapp.com)
  spidr-beta-api/   Node.js waitlist API
```

## Running the App

Two terminals required for full-stack dev:

```bash
# Terminal 1 — backend
cd spidr-server && npm run dev

# Terminal 2 — frontend
cd spidr-client && npm run dev
# opens at http://localhost:5173
```

Optional third terminal for Electron desktop:
```bash
cd spidr-client && npm run electron-dev
```

Optional FFmpeg worker (required for video/audio trimming features):
```bash
cd spidr-server && npm run worker
```

OTP codes are printed directly in the backend terminal in dev mode when no email is configured.

## Build Commands

```bash
# Frontend production build
cd spidr-client && npm run build

# Windows installer (.exe) — output: dist_installer/SpidrSetup-1.0.0.exe
cd spidr-client && npm run build-exe
# or double-click spidr-client/build-windows.bat

# Spring Boot auth service
cd spidr-auth && mvn spring-boot:run

# Marketing landing page
cd spidr-beta/spidr-landing && npm run build
```

## Environment Setup

**spidr-server** requires `spidr-server/.env`:
```
MONGO_URI=mongodb://localhost:27017/spidr
JWT_SECRET=<64-byte hex>
PORT=4000
```
Optional: `REDIS_URL`, `EMAIL_USER`/`EMAIL_PASS`, `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`, `CLIENT_ORIGIN`, `AWS_*` (S3 uploads).

**spidr-client** reads from `.env` / `.env.production`:
```
VITE_API_URL=http://localhost:4000
VITE_WS_URL=http://localhost:4000
VITE_AUTH_URL=http://localhost:8080
VITE_SPOTIFY_CLIENT_ID=...
```

**spidr-auth** requires `spidr-auth/.env` or Spring environment vars: `MONGO_URI`, `JWT_SECRET` (base64), `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`.

## Architecture

### Auth Flow
Auth is split across two services that share the same MongoDB `users` collection and the same JWT secret:
- **spidr-auth** (Spring Boot, port 8080) — signup, OTP verification, JWT issuance, password reset. All login flows go here.
- **spidr-server** (Node.js, port 4000) — validates JWTs on every request via `src/middleware/auth.js`. It reads `userId` from the token (`decoded.userId || decoded.id` handles both Spring Boot and older Node.js tokens).

The frontend (`apiClient.js`) routes `/auth/*` calls to `VITE_AUTH_URL` and all other calls to `VITE_API_URL`. The JWT is stored in `localStorage` as `spidr_token`.

### Frontend Architecture (spidr-client)

- `src/App.jsx` — top-level router. Uses `HashRouter` in Electron, `BrowserRouter` in web. Every protected page is lazy-loaded with `React.lazy()`.
- `src/components/SpidrShell.jsx` — persistent layout wrapping all authenticated routes via `<Outlet />`. Holds the sidebar, floating voice dock, global menu, and notification providers. Mounts once to avoid sidebar unmounting on navigation.
- `src/context/AppShellContext.jsx` — global state that survives navigation: `currentUser`, `appTheme`, `activeCall`, `selectedServerId`. All other components read from here rather than re-fetching.
- `src/context/MediaContext.jsx` — persists the active media player across page changes.
- `src/api/apiClient.js` — all HTTP calls (`api.get/post/patch/delete`), the Socket.io singleton (`getSocket()`), and typed entity factories (`entities.Server`, `entities.Message`, etc.).
- `src/lib/AuthContext.jsx` — authentication state provider; handles login, register, OTP, and token expiry via the `spidr:auth-expired` custom event.
- `@/` alias resolves to `src/` (configured in `vite.config.js`).

UI components live in:
- `src/components/ui/` — Radix-based shadcn primitives
- `src/components/spidr/` — all Spidr-specific components (servers, channels, voice, profiles, etc.)
- `src/components/feed/` — THE WEB video feed components
- `src/components/nexus/` — Module Nexus and its widgets

### Module Nexus / Builtin Widgets
Official "Spidr modules" (Symbiote Pet, Spotify Now Playing, Gaming Uplink, etc.) have hardcoded React components. They are gated by `author_id === 'spidr-official'` in `src/components/nexus/widgets/builtinWidgets.js` to prevent name-squatting. Non-official modules fall through to `DynamicModuleWidget`.

### Backend Architecture (spidr-server)

- `src/index.js` — Express app setup, rate limiting (tiered: 300 GET / 30 write / 10 upload per min), route registration, Socket.io init with optional Redis adapter, MongoDB connection + seed.
- `src/socket/handlers.js` — all real-time events: presence, messaging, DMs, group chats, voice session state.
- `src/socket/voiceSignaling.js` — WebRTC signaling. Spidr uses peer-to-peer mesh (no SFU) capped at 6 participants per channel. Server only routes SDP/ICE, never touches audio.
- `src/utils/crudRouter.js` — generic CRUD router factory used by most resource routes.
- `src/utils/jwtSecret.js` — shared JWT secret resolver used by auth middleware, socket handlers, and rate limiter to stay in sync.
- `src/workers/ffmpegWorker.js` — separate process for video/audio transcoding; start with `npm run worker`.
- On boot, the server seeds default modules (`seedDefaultModules`) and bots (`seedDefaultBots`), and schedules event expiry (`expireEvents`).

### Rate Limiting
Three independent per-user buckets (keyed on JWT userId, falling back to IP):
- Read (GET): 300/min
- Write (POST/PUT/PATCH/DELETE): 30/min
- Upload: 10/min

### Electron
`electron/main.js` creates the main window and optionally a transparent frameless overlay window (Spidr Protocol). The overlay's bounds are persisted to `userData/spidr-protocol-bounds.json` and validated against current displays on each open.

## CI/CD

- **CI**: runs on PRs to `dev` or `master`. Builds `spidr-client` only (no test suite exists yet).
- **Deploy prod**: push to `master` → builds and FTP-deploys `spidr-beta/spidr-landing` to Hostinger (spidrapp.com).
- **spidr-server** is hosted on Railway/Render; deploy by pushing to the connected repo branch.

## Key Design Decisions

- **No test suite** exists; CI only verifies the Vite build succeeds.
- The sidebar is intentionally kept mounted across all routes (inside `SpidrShell`) to avoid re-rendering a ~99-component tree on every tab switch.
- Redis is optional — the server tries to connect and falls back to single-instance Socket.io mode within 2 seconds if Redis is unavailable.
- `pages.config.js` is a stub kept for backwards compatibility; all routing is defined directly in `App.jsx`.
- The `spidr_token` JWT claim field is `userId` (Spring Boot) or `id` (legacy Node.js) — all token readers handle both.
