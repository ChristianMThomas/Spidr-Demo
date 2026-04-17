# FIXME.md — Spidr App Bug & Task List

Last audited: 2026-04-15

> Stack: React 18 + Vite + Electron (client) · Node/Express + MongoDB + Socket.io (server)

---

## ARCHITECTURE ROADMAP — 3-Service Backend Migration

> Target completion: 2027. Monolith stays running until each service is production-ready and validated.

### Service Overview

```
React + Electron (Frontend)
        │
        ├──► [ARCH-A] Spring Boot Auth Service     Port: 8080
        │         └── MongoDB (users collection only)
        │
        ├──► [ARCH-B] Node.js Core API             Port: 4000 (current)
        │         └── MongoDB (messages, servers, feeds, social graph, etc.)
        │
        └──► [ARCH-C] FastAPI AI Service           Port: 8000
                  ├── Spidr Bot (fine-tuned gpt-4o-mini via OpenAI)
                  └── FYP Recommendation Engine (reads EngagementEvent collection)
```

**JWT Strategy:** Spring Boot signs tokens with RS256 private key. Node.js and FastAPI verify using the distributed public key. No service can issue tokens — only Spring Boot can.

---

### [ARCH-A] Spring Boot Auth Service
**Status: PLANNED — Phase 2**

Replace `spidr-server/src/routes/auth.js` with a dedicated Spring Boot microservice.

**Endpoints to migrate:**
- `POST /auth/register` — create account, bcrypt hash, send OTP
- `POST /auth/login` — verify password, send 2FA OTP
- `POST /auth/verify-otp` — validate OTP, issue RS256 JWT
- `POST /auth/resend-otp`
- `GET /auth/me` — validate token, return user
- `POST /auth/change-password`
- `POST /auth/setup-totp` — generate TOTP secret + QR code
- `POST /auth/verify-totp-setup`
- `POST /auth/disable-totp`
- `POST /auth/override-request` — password reset flow
- `POST /auth/override-verify`
- `POST /auth/override-confirm`

**Tech:** Spring Boot 3 · Spring Security · Spring Data MongoDB · jjwt (RS256) · JavaMailSender (OTP email) · speakeasy equivalent (TOTP)

**Migration order:** Build Spring Boot service → validate all auth flows → switch frontend `VITE_AUTH_URL` → remove auth routes from Node.js

---

### [ARCH-B] Node.js Core API
**Status: CURRENT SERVER — stays, gets trimmed**

Keeps all non-auth routes. Auth middleware updated to verify RS256 JWT using Spring Boot's public key instead of shared secret.

**Changes needed when ARCH-A is ready:**
- Replace `JWT_SECRET` symmetric verify → RS256 public key verify in `middleware/auth.js`
- Remove `/auth` route registration from `index.js`
- Add `POST /engagement` endpoint + `EngagementEvent` model (see ARCH-C)

---

### [ARCH-C] FastAPI AI Service
**Status: PLANNED — Phase 1 (build this first)**

Two responsibilities:

#### 1. Spidr Bot (Global Assistant)
- One global assistant, all users talk to the same bot
- Fine-tune `gpt-4o-mini` on OpenAI for Spidr-specific personality and tone
- RAG layer injects real-time context (server info, user data) per request
- Endpoint: `POST /ai/chat` — receives message + context, returns response

#### 2. FYP Recommendation Engine
- TikTok-style For You Page algorithm
- Cold start: serve content from user's selected initial categories
- Behavioral phase: rank content by engagement score per user
- Endpoint: `POST /fyp/feed` — receives user_id, returns ranked content_ids
- Library path: start with `scikit-learn` cosine similarity → upgrade to `LightFM` → `PyTorch` custom model
- **Requires engagement data** — see ARCH-D below

---

### [ARCH-D] Engagement Data Collection — START IMMEDIATELY
**Status: URGENT — must begin before FYP algorithm is useful**

The FYP recommendation model needs months of real user behavior data before it can personalize effectively. Every day without collection is lost training data.

**Add to Node.js Core API now:**

Model: `spidr-server/src/models/EngagementEvent.js`
```
user_id          String  (indexed)
content_id       String  (indexed)
content_type     String  — 'clip' | 'feed' | 'audio'
event_type       String  — 'watch' | 'like' | 'skip' | 'share' | 'replay' | 'save'
watch_duration   Number  — seconds watched
watch_completion Number  — 0.0 to 1.0 (% of content watched)
source           String  — 'fyp' | 'search' | 'profile' | 'hashtag'
created_at       Date    (indexed)
```

Route: `POST /engagement` — fire and forget from frontend, no blocking response needed.

Frontend fires silently on: video pause/end, like, share, skip (< 2s watch time), replay, save to collection.

---

### ~~[INFRA-A] Migrate file storage from Azure Blob → Cloudflare R2~~ ✅ Done

~~Azure SDK removed, `@aws-sdk/client-s3` installed, `azureStorage.js` rewritten, `.env.example` updated. Bucket created, public r2.dev access enabled, API token generated, credentials added to `.env`.~~

---

### ~~[INFRA-B] Migrate backend: Express + MongoDB → Go + PostgreSQL + Redis~~ ❌ Superseded

~~Replaced by ARCH-A/B/C plan above. Go+PostgreSQL migration cancelled — keeping MongoDB, splitting by service instead.~~

---

## spidr-auth (Spring Boot) — Backlog

> Audited: 2026-04-15. Grouped by effort. Tackle after core auth flows are wired to frontend.

### ~~Quick Wins~~ ✅ All Fixed (2026-04-15)

| ID | File | Issue |
|----|------|-------|
| ~~AUTH-Q1~~ | ~~`UserController.java`~~ | ~~`changePassword()` + `deleteAccount()` exist in `UserService` but have no controller endpoints — dead code~~ ✅ Added `PATCH /users/change-password` + `DELETE /users/me` |
| ~~AUTH-Q2~~ | ~~`AuthService.java:generateVerificationCode()`~~ | ~~Uses `new Random()` — not cryptographically secure.~~ ✅ Replaced with `SecureRandom` |
| ~~AUTH-Q3~~ | ~~`AuthService.java:register()` / `login()`~~ | ~~No email normalization — duplicate accounts possible.~~ ✅ `.toLowerCase().trim()` added to all email lookups |
| ~~AUTH-Q4~~ | ~~`RegisterUserDTO.java`~~ | ~~Username only checks `@NotBlank`.~~ ✅ `@Pattern(regexp = "^[a-zA-Z0-9_]{3,20}$")` added |
| ~~AUTH-Q5~~ | ~~`AuthController.java:/resend`~~ | ~~Takes raw `Map<String, String>` with no validation.~~ ✅ `ResendOtpDTO` created and wired in |
| ~~AUTH-Q6~~ | ~~`users.java`~~ | ~~No `@Indexed` on `email`, `username` — full collection scan on every login.~~ ✅ `@Indexed(unique=true)` added to both |
| ~~AUTH-Q7~~ | ~~`JwtService.java:generateToken()`~~ | ~~Role and user ID not embedded in JWT claims.~~ ✅ `userId` + `role` added to token claims |
| ~~AUTH-Q8~~ | ~~`AuthService.java:resetPassword()`~~ | ~~No confirmation email after password reset.~~ ✅ `sendPasswordResetConfirmationEmail` added |
| ~~AUTH-Q9~~ | ~~`UserController.java:getAllUsers()`~~ | ~~Returns raw `users` object with sensitive fields.~~ ✅ `UserResponseDTO` created, used on `/all` and `/me` |

### ~~Medium~~ ✅ All Fixed (2026-04-15)

| ID | File | Issue |
|----|------|-------|
| ~~AUTH-M1~~ | ~~`AuthController.java`~~ | ~~No rate limiting.~~ ✅ `RateLimiterService` (sliding-window, per-IP): signup 5/hr, login 10/15min, verify 10/15min, forgot 3/hr |
| ~~AUTH-M2~~ | ~~`AuthService.java:login()`~~ | ~~No account lockout.~~ ✅ Lock after 5 failed attempts for 15 min; counter resets on success |
| ~~AUTH-M3~~ | ~~All controllers~~ | ~~Raw exception messages returned to client.~~ ✅ `GlobalExceptionHandler` (`@RestControllerAdvice`) — controllers no longer catch exceptions |
| ~~AUTH-M4~~ | ~~`application.properties`~~ | ~~Email credentials committed in plaintext.~~ ✅ Moved to `${SPRING_MAIL_USERNAME}` / `${SPRING_MAIL_PASSWORD}` env vars |
| ~~AUTH-M5~~ | ~~`AuthService.java:resendVerificationCode()`~~ | ~~No resend rate limit.~~ ✅ 3 resends per 24h per account enforced in DB |
| ~~AUTH-M6~~ | ~~`users.java`~~ | ~~No unique DB index — race condition allows duplicate accounts.~~ ✅ Covered by `@Indexed(unique=true)` (AUTH-Q6) |

### Bigger Features (2–4 hours each)

| ID | Issue |
|----|-------|
| AUTH-F1 | **Refresh tokens** — JWT expires and users get hard-logged-out with no silent renewal |
| AUTH-F2 | **Token revocation** — logout doesn't invalidate the JWT; deleted/banned users can still hit auth-protected routes until expiry |
| AUTH-F3 | **TOTP 2FA** — Node.js server has it via speakeasy; Spring Boot backend is missing it entirely |
| AUTH-F4 | **Admin promotion endpoint** — only way to make someone an admin is via MongoDB shell directly |

---

## PRIORITY 1 — CRITICAL

### ~~[P1-A] MongoDB not running — server crashes on start~~
~~Use Atlas M0 or run `mongod` locally. Set `MONGO_URI` in `.env`.~~ ✅ Resolved

### ~~[P1-B] `moment` not installed — crashes BanScreen + EnhancedFeed~~
~~`BanScreen.jsx` and `EnhancedFeed.jsx` imported moment which wasn't in package.json.~~ ✅ Fixed — replaced with native JS date helpers

### ~~[P1-C] Axios security breach — removed from entire codebase~~
~~`apiClient.js` and `audio.js` used axios. Replaced with native fetch throughout.~~ ✅ Fixed

---

## SECURITY — New Issues

### ~~[SEC-A] OTP generated with `Math.random()` — predictable~~ ✅ Fixed
~~**File:** `spidr-server/src/routes/auth.js:37`~~

~~`Math.random()` is not cryptographically secure; OTPs could be predicted. Replaced with `crypto.randomInt(100000, 1000000).toString()`.~~

---

### ~~[SEC-B] No ownership check on CRUD mutations — users can delete others' content~~ ✅ Fixed
~~**Files:** `spidr-server/src/routes/comments.js`, `clips.js`, `messages.js`~~

~~`crudRouter` PATCH/DELETE now fetch the doc first and return 403 if `req.user.id` doesn't match the owner field. Routes pass `ownerField: 'user_id'` (comments), `'author_id'` (clips), `['user_id','author_id']` (messages).~~

---

### ~~[SEC-C] Unvalidated stream URL in CinemaStage — XSS risk~~ ✅ Fixed
~~**File:** `spidr-client/src/components/spidr/CinemaStage.jsx:14-31`~~

~~`getEmbedUrl` now parses with `new URL()` first, rejects non-https and unrecognised hostnames, and removes the unsafe fallback that passed raw URLs to the iframe.~~

---

## PRIORITY 2 — HIGH (Feature Completely Non-Functional)

### [P2-A] Settings: Sound & Notification toggles — not persisted
**File:** `spidr-client/src/components/spidr/SettingsPanel.jsx:443-539`

Toggles update local state only. Settings reset on every reload.

**Fix:** On toggle change, call `PATCH /api/user-profiles/:id`.

---

### [P2-B] Background / Theme Customization — not persisted
**File:** `spidr-client/src/pages/Home.jsx`

**Fix:** On save, call `PATCH /api/user-profiles/:id` with `{ theme, background }`. Rehydrate on load.

---

### [P2-C] Discord Bot Import — hardcoded bots user can't import
**File:** `spidr-client/src/components/nexus/ImportBotTab.jsx:10-18`

**Fix:** Remove the official bot catalog. Keep only the "Import by Client ID" form.

---

### [P2-D] Group Chats — list doesn't refresh after creation
**File:** `spidr-client/src/components/spidr/CreateGroupChatModal.jsx`

**Fix:** After successful POST, invalidate/refetch the group chats query.

---

### [P2-E] SpidrAIChat — no error handling on AI failure
**File:** `spidr-client/src/components/spidr/SpidrAIChat.jsx`

**Fix:** Add `.catch(err => toast.error('AI unavailable: ' + err.message))`.

---

### [P2-F] Change password — no input validation
**File:** `spidr-server/src/routes/auth.js:174-186`

`currentPassword` and `newPassword` are not validated for null/undefined or minimum length before use; allows weak passwords and risks bcrypt errors.

**Fix:** Guard at top of handler: check both fields exist and `newPassword.length >= 8`.

---

## PRIORITY 3 — MEDIUM

### [P3-A] VideoStudio — thumbnail generates black frame
**File:** `spidr-client/src/components/spidr/VideoStudio.jsx:144`

**Fix:** Wait for `loadeddata` event + check `video.readyState >= 2` before `drawImage`.

---

### [P3-B] VideoStudio — stale object URL memory leak
**File:** `spidr-client/src/components/spidr/VideoStudio.jsx:90-92`

**Fix:** Call `URL.revokeObjectURL(prev)` in the cleanup of the effect that creates it.

---

### [P3-C] UserProfile query key inconsistency — stale data across views
**Affected:** `HolographicProfile.jsx`, `PCSpecsFlex.jsx`, `UserProfilePod.jsx`

Keys in use: `['userProfile', id]`, `['profile', id]`, `['user-profile', id]` — all different caches.

**Fix:** Standardize to `['userProfile', userId]` everywhere.

---

### [P3-D] Mic / Deafen toggles — UI-only, no real audio effect
**File:** `spidr-client/src/components/spidr/UserProfilePod.jsx:163-172`

**Fix:** Wire to shared audio context or active `VoiceChannel` stream controls.

---

### [P3-E] 2FA TOTP — any OTP code accepted (secret not verified server-side)
**File:** `spidr-client/src/components/spidr/SecurityMatrix.jsx`

Backend `/auth/setup-totp` and `/auth/verify-totp-setup` routes exist. Frontend needs to call them correctly and store the secret before marking 2FA as enabled.

**Fix:** Wire `SecurityMatrix` TOTP flow to `/auth/setup-totp` → `/auth/verify-totp-setup`.

---

### [P3-F] DynamicModuleWidget — silent JSON failures + fake weather
**File:** `spidr-client/src/components/nexus/widgets/DynamicModuleWidget.jsx`

**Fix:** Render error state on parse failure. Replace fake LLM weather with Open-Meteo (free, no key).

---

### [P3-G] Bot Laboratory — installs not persisted
**File:** `spidr-client/src/components/spidr/BotLaboratory.jsx:88`

**Fix:** `POST /api/installed-modules` on install. `GET /api/installed-modules` on load.

---

### [P3-H] VoiceChannel join/leave race condition — orphaned sessions
**File:** `spidr-client/src/components/spidr/VoiceChannel.jsx:91-116`

`hasJoinedRef` prevents re-join but doesn't block simultaneous join+leave calls; can leave orphaned voice sessions on the server.

**Fix:** Use a Promise-based lock or add `isConnected` state check before join/leave calls.

---

### [P3-I] useWebRTC — silent offer creation failure
**File:** `spidr-client/src/components/spidr/useWebRTC.js:81`

`pc.createOffer().catch(console.error)` — user gets no feedback if WebRTC offer fails; call just silently drops.

**Fix:** Set an error state and show `toast.error('Connection failed')` in the catch.

---

### [P3-J] DirectMessage model — duplicate conflicting field names
**File:** `spidr-server/src/models/DirectMessage.js:3-22`

Schema defines both `receiver_id` and `recipient_id` for the same concept; frontend/backend mismatch will silently store `undefined`.

**Fix:** Remove one field, keep one canonical name (`recipient_id`), and search/replace all usages.

---

### [P3-K] crudRouter — no required-field validation on create
**File:** `spidr-server/src/utils/crudRouter.js:70-79`

Generic create endpoint passes body straight to Mongoose; validation errors return an unhelpful generic 400 with no field-level detail.

**Fix:** Add a `validate` option to `crudRouter` so callers can pass a per-model check function.

---

## PRIORITY 4 — LOW

### [P4-A] CinemaStage chat — hardcoded stub message
Connect to a real Socket.io channel scoped to the active cinema room.

### [P4-B] SpidrAIChat — hardcoded system prompt
Make configurable via `UserProfile` field or server env. *(Will be replaced by ARCH-C Spidr Bot)*

### [P4-C] PCSpecsFlex — wrong query key `['user-profile']`
**Fix:** Change to `['userProfile', userId]` per P3-C.

### [P4-D] SettingsPanel — no cache invalidation after profile save
After `PATCH /api/user-profiles/:id`, invalidate `['userProfile', userId]`.

### [P4-E] CreateServerModal — server banner has no file upload
Icon supports upload, banner only accepts a URL. Both should use `POST /api/upload`.

### [P4-F] AVLab — `console.log` left in production
**File:** `spidr-client/src/components/spidr/AVLab.jsx:118`

`console.log(...)` fires on every voice effect switch in production builds.

**Fix:** Gate with `if (import.meta.env.DEV)` or remove.

### [P4-G] VoiceChannel — silently swallows cleanup errors
**File:** `spidr-client/src/components/spidr/VoiceChannel.jsx:96-109`

`.catch(() => {})` on old-session delete; network failures are invisible.

**Fix:** `.catch(err => console.error('Failed to clean old sessions:', err))`

### [P4-H] algorithm route — no guard if `req.user` is undefined
**File:** `spidr-server/src/routes/algorithm.js:33`

Direct access to `req.user.id` with no null check; crashes if auth middleware fails to attach user.

**Fix:** Add `if (!req.user) return res.status(401).json({ error: 'Auth required' });` at top of handler.

---



---

## Quick Reference

| ID | File | Issue |
|----|------|-------|
| **ARCH-D** | `EngagementEvent.js` (new) | **Start collecting FYP training data — urgent** |
| ARCH-A | `spidr-auth/` (new service) | Spring Boot auth microservice — Phase 2 |
| ARCH-B | `spidr-server/` | Node.js core API — trim auth routes when ARCH-A ready |
| ARCH-C | `spidr-ai/` (new service) | FastAPI AI service (Spidr Bot + FYP) — Phase 1 |
| ~~INFRA-A~~ | ~~`azureStorage.js`~~ | ~~Azure Blob → R2~~ ✅ Done |
| ~~INFRA-B~~ | ~~`spidr-server/`~~ | ~~Go+PostgreSQL migration~~ ❌ Superseded by ARCH plan |
| ~~SEC-A~~ | ~~`auth.js:37`~~ | ~~OTP uses `Math.random()`~~ ✅ Fixed |
| ~~SEC-B~~ | ~~`comments.js`, `clips.js`, `messages.js`~~ | ~~No ownership check on CRUD mutations~~ ✅ Fixed |
| ~~SEC-C~~ | ~~`CinemaStage.jsx:14`~~ | ~~Unvalidated stream URL — XSS risk~~ ✅ Fixed |
| P2-A | `SettingsPanel.jsx:443` | Sound/notification toggles not persisted |
| P2-B | `Home.jsx` | Theme lost on refresh |
| P2-C | `ImportBotTab.jsx:10` | Remove hardcoded Discord bot catalog |
| P2-D | `CreateGroupChatModal.jsx` | Group chat list doesn't refresh |
| P2-E | `SpidrAIChat.jsx` | No error handling on AI failure |
| P2-F | `auth.js:174` | Change password — no input validation |
| P3-A | `VideoStudio.jsx:144` | Thumbnail black frame |
| P3-B | `VideoStudio.jsx:90` | Stale object URL leak |
| P3-C | Multiple | Inconsistent UserProfile query keys |
| P3-D | `UserProfilePod.jsx:163` | Mic/deafen UI-only |
| P3-E | `SecurityMatrix.jsx` | TOTP not wired to backend |
| P3-F | `DynamicModuleWidget.jsx` | Silent JSON failures + fake weather |
| P3-G | `BotLaboratory.jsx:88` | Bot installs lost on refresh |
| P3-H | `VoiceChannel.jsx:91` | Join/leave race condition |
| P3-I | `useWebRTC.js:81` | Silent WebRTC offer failure |
| P3-J | `DirectMessage.js` | Duplicate conflicting field names |
| P3-K | `crudRouter.js:70` | No required-field validation on create |
| P4-A | `CinemaStage.jsx` | Hardcoded stub chat message |
| P4-B | `SpidrAIChat.jsx` | Hardcoded system prompt |
| P4-C | `PCSpecsFlex.jsx` | Wrong query key `['user-profile']` |
| P4-D | `SettingsPanel.jsx` | No cache invalidation after profile save |
| P4-E | `CreateServerModal.jsx` | Banner missing file upload |
| P4-F | `AVLab.jsx:118` | `console.log` in production |
| P4-G | `VoiceChannel.jsx:96` | Silently swallows cleanup errors |
| P4-H | `algorithm.js:33` | No `req.user` null guard |
| ~~AUTH-Q1~~ | ~~`UserController.java`~~ | ~~`changePassword()` + `deleteAccount()` dead code~~ ✅ Fixed |
| ~~AUTH-Q2~~ | ~~`AuthService.java`~~ | ~~`new Random()` for OTP~~ ✅ Fixed — `SecureRandom` |
| ~~AUTH-Q3~~ | ~~`AuthService.java`~~ | ~~No email normalization~~ ✅ Fixed |
| ~~AUTH-Q4~~ | ~~`RegisterUserDTO.java`~~ | ~~No username pattern validation~~ ✅ Fixed |
| ~~AUTH-Q5~~ | ~~`AuthController.java`~~ | ~~`/resend` uses raw Map~~ ✅ Fixed — `ResendOtpDTO` |
| ~~AUTH-Q6~~ | ~~`users.java`~~ | ~~No `@Indexed` on email/username~~ ✅ Fixed |
| ~~AUTH-Q7~~ | ~~`JwtService.java`~~ | ~~Role + user ID not in JWT claims~~ ✅ Fixed |
| ~~AUTH-Q8~~ | ~~`AuthService.java`~~ | ~~No confirmation email after password reset~~ ✅ Fixed |
| ~~AUTH-Q9~~ | ~~`UserController.java`~~ | ~~`/users/all` leaks sensitive fields~~ ✅ Fixed — `UserResponseDTO` |
| ~~AUTH-M1~~ | ~~`AuthController.java`~~ | ~~No rate limiting~~ ✅ Fixed — per-IP sliding window |
| ~~AUTH-M2~~ | ~~`AuthService.java`~~ | ~~No account lockout~~ ✅ Fixed — lock after 5 fails |
| ~~AUTH-M3~~ | ~~All controllers~~ | ~~No centralized error handler~~ ✅ Fixed — `GlobalExceptionHandler` |
| ~~AUTH-M4~~ | ~~`application.properties`~~ | ~~Email credentials in plaintext~~ ✅ Fixed — env vars |
| ~~AUTH-M5~~ | ~~`AuthService.java`~~ | ~~No resend OTP rate limit~~ ✅ Fixed — 3/24h per account |
| ~~AUTH-M6~~ | ~~`users.java`~~ | ~~No unique DB index~~ ✅ Fixed — `@Indexed(unique=true)` |
| AUTH-F1 | `JwtService.java` | No refresh token mechanism |
| AUTH-F2 | System-wide | No token revocation on logout/ban |
| AUTH-F3 | System-wide | No TOTP 2FA (Node.js server has it, Spring Boot doesn't) |
| AUTH-F4 | `UserController.java` | No admin promotion endpoint |
