# Plan: Fix Voice Audio + Cut API Load Below 200/min

**Branch:** `fix-vc` · **Status:** planned, not yet implemented

## Context

Two beta-blocking problems, to be fixed together:

1. **Voice channels transmit no audio between users.** Root cause is a server-side
   conflict, compounded by missing NAT traversal:
   - The server registers **two incompatible `voice:*` handler sets on every socket**:
     `handlers.js:318-336` (simple relay; protocol the *live* client `useWebRTC.js` speaks)
     **and** `voiceSignaling.js` via `attachVoiceHandlers()` (roster/`kind` protocol used only
     by `hooks/useVoicePeer.js` + `hooks/useVoiceStream.js`, which are **dead code — imported nowhere**).
     Both fire on each event → peers get **duplicate `voice:peer-joined`** (offer glare → duplicate/broken
     `RTCPeerConnection`s) and a **malformed `voice:signal`** lacking the `signal` field, which makes the
     client throw on `signal.type`.
   - **No TURN server** (STUN-only in `useWebRTC.js:15-19`). The two test users are on
     **different networks**, so even after the handler conflict is fixed, ~25% of NAT setups can't establish
     a P2P path without TURN. TURN is therefore a required co-fix (free public TURN for beta).

2. **Still hitting HTTP 429; want to almost never exceed ~200 req/min** (MongoDB Atlas free-tier safety).
   - **The decisive bug:** `index.js:58` is a single blanket limiter keyed by `req.ip`, and **`trust proxy`
     is never set**. Behind Railway every request appears to come from the proxy IP, so the 200-req/15-min
     bucket is **app-wide (~13 req/min total for ALL users)** — guaranteed 429s at trivial load.
   - **Volume:** ~21 `refetchInterval` pollers remain client-side (10s pollers over 30–200-item lists,
     plus 4 redundant unread-DM pollers), estimated ~2,000 req/min at 50 users.

Outcome: two users on different networks can hear each other in a voice channel, and steady-state request
volume stays well under 200/min per user with a correctly-keyed, tiered server limiter.

---

## Part A — Fix Voice Audio

Consolidate on the **live, video-capable** path (`VoiceChannel.jsx` → `useWebRTC.js` → `handlers.js`) and
delete the conflicting dead path. (Migrating to `useVoicePeer.js` would be more robust but is audio-only and
unwired — bigger change + video regression. Noted as a future option, not this plan.)

### A1. Remove the conflicting server handlers (the core fix)
`spidr-server/src/socket/handlers.js`
- Delete the `attachVoiceHandlers` require (line 101) and both invocation sites (lines 129, 133) inside
  the `UserProfile.findOne(...)` promise. This removes ALL `voiceSignaling.js` voice listeners, leaving
  `handlers.js` as the single voice authority. Nothing live breaks (`useVoicePeer`/`useVoiceStream` are dead).
- Keep `voiceSignaling.js` for its `getTurnConfig` export (still imported at `index.js:95`).

### A2. Fix the client `voice:peer-left` bug
`spidr-client/src/components/spidr/useWebRTC.js:145-151`
- Current handler closes **all** peers and clears all streams when **any** peer leaves. Change to close only
  the departing peer.
- Requires a `socketId` to target. Update server emits to include it:
  `handlers.js` `voice:leave` (331) and `disconnecting` (361) → emit `{ userId, socketId: socket.id }`.
  Client closes/removes only `peersRef.current[socketId]`.

### A3. Wire TURN (required for cross-network)
- `spidr-server/src/socket/voiceSignaling.js` `getTurnConfig` (242-259): build `iceServers` from env
  (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`) appended to the existing STUN entries; fall back to a
  **free public TURN** (e.g. `openrelay.metered.ca`) for beta when env is unset. Endpoint already served at
  `GET /voice/ice` (`index.js:96`).
- `spidr-client/src/components/spidr/useWebRTC.js`: fetch `/voice/ice` once on `join()` and use the returned
  `iceServers` for new `RTCPeerConnection`s; fall back to the hardcoded STUN list on fetch failure.
  (Mirror the pattern already in dead `useVoicePeer.js:206-220`.)
- Add `TURN_URL`/`TURN_USERNAME`/`TURN_CREDENTIAL` to `spidr-server/.env.example` and Railway env notes.

### A4. Harden remote-audio playback
`spidr-client/src/components/spidr/VoiceChannel.jsx:257-260`
- Remote `<audio>` currently only sets `srcObject` + `autoPlay`. Add `muted={false}`, set `el.volume = 1`,
  and call `el.play().catch(()=>…)` in the ref; if autoplay is rejected, show a one-tap "Enable audio" prompt.
  (Belt-and-suspenders — Electron allows autoplay, but browsers may not.)

### A5. Minor: drop deprecated constructor
`useWebRTC.js:130,138` — pass `signal.sdp` directly to `setRemoteDescription` instead of
`new RTCSessionDescription(signal.sdp)`.

### A6. Optional cleanup
Delete dead `spidr-client/src/hooks/useVoicePeer.js` and `useVoiceStream.js` to prevent future confusion
(they speak the now-removed `voiceSignaling` protocol). Skip if you'd rather keep them as the basis for a
future SFU/robust-reconnect rewrite.

---

## Part B — Rate Limiting: stay under ~200 req/min

### B1. Fix the server limiter (the decisive bug)
`spidr-server/src/index.js`
- Before the limiter, add `app.set('trust proxy', 1)` so `req.ip` resolves to the real client IP via
  `X-Forwarded-For` behind Railway (one hop, not `true`, to satisfy express-rate-limit validation).
- Replace the single blanket limiter (line 58) with **per-user keying + tiered limits**:
  - `keyGenerator`: if an `Authorization: Bearer` token is present, verify it with the same
    `getSecret()` used in `handlers.js:19-23` and key on `userId`; else key on `req.ip`. (authMiddleware is
    per-route, so this keeps per-user limiting without reordering middleware.)
  - Tiers (well above a well-behaved client's footprint so legit users never trip them):
    - GET (reads): ~300 / min / key
    - POST/PATCH/DELETE (writes): ~30 / min / key
    - `/upload`: ~10 / min / key
  - Keep `skip` for `/uploads` static assets.
  - `/auth/*` already limited in `routes/auth.js:12-18` (10/15min) — leave as-is.

### B2. Socket event rate limiting
`spidr-server/src/socket/handlers.js`
- Add the per-socket token bucket from `fixes/RATE-LIMIT-HARDENING.md` §2 (`Map<socketId,{count,resetAt}>`).
  Apply at the top of high-frequency handlers: `message:send`, `dm:send`, `group:send`, `typing:start/stop`,
  `voice:signal`, `presence:ping`. Suggested ~30 events/sec/socket, with sends (`*:send`) tighter (~5/sec).
  On exceed: `socket.emit('error', …)` and return.

### B3. Cut client polling volume (the big lever)
Reuse the existing socket→invalidate pattern (`App.jsx:72-75`:
`socket.on(evt, () => queryClient.invalidateQueries({queryKey}))`). Server already emits `dm:new`,
`dm:notification`, `friend:incoming`, `message:new`, `group:message`.

Remove/relax these `refetchInterval`s (file:line from grep):
- **Kill 10s pollers (top wins):**
  - `EnhancedFeed.jsx:60` (Feed list 30) and `FeedPanel.jsx:51` (Clip list **200**): drop interval; either
    add a `feed:new`/`clip:new` server emit on create + invalidate, or set `refetchInterval` to 60s + a
    `staleTime`. (Lowest-effort: 60s; cleanest: socket emit, mirroring messages.)
  - `SignalRequests.jsx:16` (unread DMs, redundant): drop interval; drive off `dm:new`/`dm:notification`.
  - `ServerAuditLog.jsx:75` (admin): 10s → 60s.
- **De-duplicate unread-DM / friend-request pollers** — `Sidebar.jsx:53,76`, `PulseDeck.jsx:31,39`,
  `FriendsPanel.jsx:99`, `SignalRequests.jsx:16` all poll the same data. Add ONE set of socket listeners
  (App.jsx or a small shared hook): on `dm:new`/`dm:notification` invalidate the unread-DM queries; on
  `friend:incoming` invalidate friend-request queries. Drop the per-component intervals.
- **`QuickHeads.jsx:98,110`** (20s × 3 list-50, always mounted): drop intervals; invalidate on
  `dm:new`/`group:message`; optional 120s safety net.
- **`NerveCenter.jsx:201,209,216,222,230`** (stats page, filter scans): raise 30s→120s / 60s→120s
  (only polls when visited; low priority).
- **`BiomassBalancePill.jsx:21`** and **`TopFeedBar.jsx:21`** (60s): 120s or invalidate on the relevant
  action. Minor.
- Leave `DynamicModuleWidget` (5–15min LLM) as-is.
- `lib/query-client.js`: set a default `staleTime` (~30–60s) so navigation/remounts don't refetch instantly.

Net: removing the 10s/20s pollers + de-duping unread queries drops aggregate from ~2,000 to a few hundred
req/min at 50 users, and a single well-behaved client to <~15 req/min.

### B4. Optional hardening
- Spring Boot `spidr-auth`: add limits to `/auth/verify-reset-code` and `/auth/reset-password`
  (currently unlimited; `RateLimiterService` already exists). Low priority.
- Auto-ban after repeated 429s (RATE-LIMIT-HARDENING §4) — defer unless abuse is observed.

---

## Critical Files
- `spidr-server/src/socket/handlers.js` — remove dual voice handlers (A1), add socketId to leave/disconnect (A2), socket rate limiting (B2)
- `spidr-server/src/socket/voiceSignaling.js` — TURN in `getTurnConfig` (A3)
- `spidr-server/src/index.js` — trust proxy + tiered per-user limiter (B1)
- `spidr-client/src/components/spidr/useWebRTC.js` — peer-left fix, fetch /voice/ice, sdp constructor (A2/A3/A5)
- `spidr-client/src/components/spidr/VoiceChannel.jsx` — audio playback hardening (A4)
- `spidr-client/src/App.jsx` (+ polling components listed in B3) — socket-driven invalidation, remove intervals
- `spidr-client/src/lib/query-client.js` — default staleTime
- `spidr-server/.env.example` — TURN vars

## Verification
**Voice (the real test):** run `spidr-server` (`npm run dev`) + `spidr-client` (`npm run dev`); sign in as two
accounts on **two different networks** (or two machines), join the same server voice channel. Confirm each
hears the other. DevTools console: no `signal.type` errors; exactly one `RTCPeerConnection` per remote peer
(no glare); `pc.iceConnectionState` reaches `connected`/`completed`; with TURN, candidate type `relay` appears
when P2P is blocked.

**Rate limit:** confirm `app.set('trust proxy',1)` makes `RateLimit-*` headers reflect per-user/IP buckets
(not one shared bucket). Hammer one endpoint as user A and confirm user B is unaffected (per-user keying).
Use the app normally with 1–2 clients and watch the Network tab req/min stay low (target <20/min/client);
verify no 429s during normal use. Spot-check socket spam is throttled (rapid `typing:start` → `error` after cap).
