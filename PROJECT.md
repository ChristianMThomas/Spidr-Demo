# PROJECT.md — Spidr, Explained to a New Engineer

> Written 2026-07-06 on branch `patch-1.9_Mobile` after a full-repo audit. Companion docs: `GAPS.md` (known weaknesses), `CLAUDE.md` (operational rules), `mr-rimmer/` (deep domain references: pricing, goals, team).

## What This Is

Spidr is a Discord-style social platform built by a two-person team (Chris + FiFi — see `mr-rimmer/team.md`) with one big differentiator: **THE WEB**, a TikTok-style vertical short-video feed with its own For-You-Page ranking algorithm, living inside the same app as servers/channels/DMs/voice. Extras include a TheaterMode + Spotify DJ experience inside voice calls, a pluggable profile-widget system ("Nexus" modules: Steam, Weather, PC Specs, pet, etc.), custom bots, an LLM assistant, and a paid tier (SPIDR APEX). The audience is gamers/young social users; the aesthetic is spider/symbiote (red #FF3333, "webs", "threads", entrance animations).

It ships four ways from one repo: web (Hostinger), Windows/macOS/Linux desktop (Electron wrapping the same React build), iOS/Android (Expo React Native, Patch 1.9+), plus a separate marketing/beta-signup site.

## Tech Stack and Why

| Piece | Choice | Apparent reasoning |
|---|---|---|
| Web client | React 18 + Vite + Tailwind + Radix/shadcn | Migrated off the Base44 app platform — `apiClient.js` deliberately mimics the Base44 SDK shape (`base44.entities.X.filter(...)`) so hundreds of call sites didn't need rewriting |
| Desktop | Electron 30 | Cheapest path to a "real app" from the existing web build |
| Mobile | Expo SDK 54 + expo-router + NativeWind | Fastest RN on-ramp; Expo Go for Phase 1, custom dev client deferred to Phase 2 (voice/WebRTC, Spotify OAuth) |
| Core API | Node/Express + Mongoose + Socket.io | One JS service for REST + realtime; Redis adapter optional for multi-instance |
| Auth | Spring Boot 3 (Java 21) microservice | A deliberate architecture split: identity isolated from the app API; also clearly a learning/portfolio choice (Java where Node would have sufficed) |
| JWT | Shared HS256 secret, base64-decoded on both sides | Simplest cross-service verification; RS256 is on the roadmap |
| DB | MongoDB Atlas, one `spidr` db shared by both services | Schemaless speed; auth and server share the `users` collection |
| Files | Cloudflare R2 via `@aws-sdk/client-s3` (prod), local `/uploads` (dev) | S3-compatible + free egress. **The util is `azureStorage.js` — legacy filename, it is R2** |
| AI | Server-side proxy to OpenAI or Anthropic (`routes/ai.js`) | Keys stay server-side; graceful stub reply when no key configured |

## Architecture

```
                 ┌────────────────────────────────────────────┐
   signup/login  │ spidr-auth  (Spring Boot :8080, Railway)   │
  ┌─────────────►│  OTP email 2FA → issues HS256 JWT          │
  │              └──────────────┬─────────────────────────────┘
  │                             │ same base64 JWT_SECRET        MongoDB Atlas
  │                             ▼                               (db: spidr)
┌─┴───────────────┐   ┌────────────────────────────────────┐      ▲
│ Clients          │  │ spidr-server (Node :4000, Railway) │──────┘
│  web (Vite)      │──►  REST: 39 routes  ── Mongoose: 30  │
│  Electron        │◄──  Socket.io: chat/presence/calls/DJ │────► Cloudflare R2
│  Expo mobile     │  │  FFmpeg worker: clip transcoding   │      (uploads)
└──────────────────┘  └────────────────────────────────────┘
   localStorage /        (spidr-beta: separate landing + signup API,
   AsyncStorage JWT       shares only the Atlas cluster)
```

Data flow: client authenticates against spidr-auth (signup → email OTP → verify → JWT), stores the token (`spidr_token` in localStorage; AsyncStorage on mobile), then sends it as `Bearer` to spidr-server for everything else. Socket.io authenticates the same token in the connection handshake. Voice is WebRTC with STUN/TURN config served from `GET /voice/ice`.

## Key Design Decisions

1. **The generic CRUD router is the backbone of the API.** `spidr-server/src/utils/crudRouter.js` generates list/get/create/patch/delete for a Mongoose model in one line; ~24 of the 39 routes are just `module.exports = crudRouter(Model)` plus options (`ownerField` for ownership checks, `publicWriteFields` for like-counters on others' posts). It normalises `_id → id` to preserve the Base44 response shape, blocks `$`-prefixed Mongo operator injection, and strips `PROTECTED_FIELDS` (password, role, is_admin…) from patches. Understand this one file and you understand most of the API. **Its default is dangerous**: with no `ownerField`, *every authenticated user is treated as owner of every document* — see GAPS.md item 1.
2. **Auth is split-brain by design (migration in progress).** Spring Boot owns identity; Node still hosts legacy auth remnants (`routes/auth.js` with bcryptjs + speakeasy TOTP — the client's 2FA setup still calls Node's `/auth/setup-totp`, tracked as AUTH-F3). The client maps field-name differences (`verificationCode` vs `otp`) in `apiClient.js`.
3. **Rate limiting is tiered and user-keyed** (`index.js:64-97`): separate buckets for reads (300/min), writes (30/min), uploads (10/min), keyed on the JWT user id when present so abuse can't rotate IPs. The client honors `Retry-After` on 429s.
4. **Patch notes are a product feature with two sources of truth**: server `routes/system.js` `NEWS` and client `SpidrSystem.jsx` `MOCK_NEWS` must stay byte-identical (mock renders instantly, server data overwrites). The `/patch` slash command exists solely to keep them in lockstep.
5. **CORS is permissive on purpose**: requests with no Origin (Electron .exe, mobile, curl) are always allowed; localhost on any port in dev; `CLIENT_ORIGIN` + subdomains + `file://`/`app://` in production. Auth relies entirely on the JWT, not on origin.
6. **Feed ranking ("tension") is duplicated client/server** — `spidr-client/src/lib/tensionScore.js` mirrors server-side scoring so the client can rank optimistically; APEX "Overclock" adds +35 for one hour via `Clip.overclock_until`.
7. **System bot as friend**: the auth middleware fire-and-forgets `ensureSystemFriendship()` so every user always has SPIDR_SYS as an accepted friend (in-memory per-boot dedupe set).

## Critical Paths (touch with care)

- `spidr-server/src/utils/crudRouter.js` — a bug here is a bug in ~24 endpoints at once.
- `spidr-server/src/middleware/auth.js` + `utils/jwtSecret.js` + spidr-auth `JwtService`/`JwtAuthenticationFilter` — the JWT contract. The `decoded.userId || decoded.id` fallback supports both Spring and legacy Node tokens.
- `spidr-client/src/api/apiClient.js` (364 lines) — every web API call funnels through it; the Base44 shape is load-bearing.
- `spidr-server/src/socket/handlers.js` — presence (multi-socket sets, 15 s reaper), chat fan-out, call signaling (`call:invite`/`accepted`/`declined`/`cancelled`), automod.
- `routes/system.js` NEWS + client MOCK_NEWS — desync is user-visible.
- `spidr-client/mobile/lib/` (apiClient.ts, socket.ts, authContext.tsx) — the mobile mirror of the web plumbing.

**Safe to change casually**: individual page/screen components, nexus widgets, `spidr-beta/*` (self-contained), styling, sounds, patch-note *content* (via `/patch`).

## Surprises That Will Trip You Up

- `azureStorage.js` is Cloudflare R2, not Azure.
- `routes/djSessions.js` is mounted at `/voice-channels`, not `/dj-sessions`.
- **No tests exist anywhere** — no framework, no CI test step. Verification means running the stack (`/dev`) and clicking through.
- `npm audit fix` in `spidr-client/mobile/` bricks the bundler (upgrades RN past Expo's pin). Never run it there.
- PowerShell 5.1 is the shell on the dev machine: no `&&`, no ternaries.
- APEX subscription "billing" is entirely simulated client-side (see `mr-rimmer/pricing.md`) — the card form is theater.
- The client renders mock data first and reconciles with the server after (SPIDR_SYS terminal; optimistic feed actions) — "it shows in the UI" does not mean "it persisted".
- Windows/mobile emoji and box-drawing characters in server files are mojibake-prone (`â”€â”€` artifacts appear when files are read with wrong encoding); keep files UTF-8.
- `spidr-auth` has its own `SPIDR-AUTH.md` — the API doc for that service; some of it ("Planned") describes what does *not* exist yet.
- README.md's repo layout mentions `HOW-TO-RUN.md`, `DEPLOY.md`, `FIXME.md` — those files were deleted; don't go looking for them.
