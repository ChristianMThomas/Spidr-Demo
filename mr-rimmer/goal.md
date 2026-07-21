# Spidr — Project Goals

> Compiled 2026-07-20 on branch `dev` from code, README.md, handoff.md, `spidr-server/src/routes/system.js` NEWS, and the spidr-beta stack. Update when a phase completes or the roadmap shifts.

## Vision

Spidr is a Discord-style social platform with a TikTok-style differentiator: **THE WEB**, a vertical short-video feed with its own FYP ranking algorithm, fused with real-time chat (servers/channels/DMs), voice/video calls, a TheaterMode + Spotify DJ experience inside calls, a pluggable profile module system (Nexus), and AI features (Spidr Bot, custom bots) — all under a spider/symbiote-themed identity (red `#FF3333`/`#C41E3A`, "web", "threads", "symbiote" naming).

Target platforms: web (`spidrapp.infinitetechteam.com`), Windows/macOS/Linux desktop (Electron), and iOS/Android (Expo, since Patch 1.9). Eventual public domain appears to be `spidrapp.com` (already in the beta API's production CORS allowlist).

## Current Phase — Patch 1.9+: Mobile Parity + Store Compliance

Per `handoff.md` + recent commits, active work is **finishing mobile parity and hardening the app for iOS / Play Store submission**:

- **Mobile Phase 1 (done, runs in Expo Go)**: auth, THE WEB feed, servers + text channels, DMs, profiles. Recent adds — GIFs & Emojis (Signal Archive), voice notes, call ringing UX, real-data profile widgets (Steam, Weather, PC Specs, Symbiote Pet, Gaming Uplink, Streak), group chats.
- **Settings screens exist, wiring pending**: all 11 target Phase-2 settings screens are written under `spidr-client/mobile/app/settings/` (`about, apex, appearance, avlab, connections, notifications, privacy, protocol, security, voice-video, widgets`), plus `edit-profile`, `gifs-emojis`, `group/[id]`, `user-web/[id]`, `spidr-ai`. **However** `mobile/app/(tabs)/profile.tsx:26-169` still calls `phaseTwo()` alerts on 11 settings rows — the screens exist but the settings menu doesn't route to them yet. Wiring is a per-row 1-line swap (`onPress: () => phaseTwo(...)` → `router.push('/settings/...')`).
- **Mobile Phase 2 (still needs a custom dev client, not Expo Go)**: voice channels (`react-native-webrtc`) and Spotify OAuth (`expo-auth-session`). Confirmed: `spidr-client/mobile/package.json` still ships neither. Blocked further by [[native-calls-setup]] — Firebase project + EAS dev build still not wired, no Apple dev account yet.

## Recent Patch Notes (canonical: `spidr-server/src/routes/system.js` NEWS)

The three most recent releases in NEWS as of 2026-07-20:

- **Patch 1.9.25** (2026-07-05, id `p1925`) — **Spidr Apex is real**: signed Stripe webhook writes `apex_tier`, checkout + billing portal routes live, 30-day trial gated by a burn-once `apex_first_activated_at` flag, idempotent webhook processing so Stripe redeliveries can't double-flip. Platform-wide security pass: every user-owned CRUD collection (AI logs, DMs, group chats, friends, collections, saved audio, custom bots, community assets, servers, events, feeds, reports) now locks PATCH/DELETE to owner. Server audit logs are append-only via HTTP. Legacy Node auth endpoints return 410 for everything except TOTP. Node dependency vulns cleared (nodemailer + uuid majors bumped). Full monetization details in [pricing.md](pricing.md).
- **Patch 1.9.24** (2026-07-02, id `p1924`) — Streak Counter and Steam Now Playing modules unlocked in the Nexus. Server-side daily-login streak (fields locked at the CRUD layer), Steam widget backed by the public Steam Web API (`/steam/games`, `/steam/stats`).
- **Patch 1.9.23** (2026-06-30, id `p1923`) — Bot Lab cleanup (single alphabetical grid, dropped Data Analyst) and Spidr Protocol overlay fixes (correct backend routing for DMs / group chats / server channels, drag rail no longer flips interactive mode).

Older highlights worth carrying: Patch 1.9.22 (tablet chat headers + live server-channel avatars), 1.9.21 (Spotify module privacy fix — owner's track, not viewer's).

## Non-Patch Developments Since Last Compile (2026-07-06)

Structural changes landed via the recent `dev` merge that aren't dressed up as SPIDR_SYS notes:

- **Electron packaging shipped** — `BUILD_INSTALLERS.md` (repo root, 182 lines) + `spidr-client/build/icon.png`; installers cut with `npm run build-exe` → `dist_installer/`. Commit `eb35670` ("packaged for os and exe").
- **Voice-channel hardening** — new `spidr-client/src/lib/sharedAudioContext.js`, expanded `useWebRTC.js`, `VoiceChannel.jsx` +337 lines, noise-suppression prefs in `lib/mediaDevicePrefs.js` + `SettingsPanel.jsx`, missed-call notifications, `VoiceEqualizer` rework.
- **New Nexus widget: LofiRadio** — `spidr-client/src/components/nexus/widgets/LofiRadio.jsx` (265 lines), wired into `builtinWidgets.js`.
- **Server route reworks** — `routes/biomass.js` (SHOP_CATALOG rebuild, broken multi-line string literals fixed, missing `module.exports` restored), `routes/directMessages.js`, `routes/reports.js` overhauled. `models/Friend.js` deleted (-65 lines) and its friendship state consolidated onto `UserProfile`. `models/User.js` and `models/UserProfile.js` slimmed.
- **Auth surface consolidation (partial)** — TOTP still lives in Node (`spidr-server/src/routes/auth.js`) but every other endpoint on that route now 410s (per `spidr-server/CLAUDE.md` and GAPS #4). Effectively the Node auth surface is TOTP-only until the AUTH-F3 migration to Spring Boot completes.

## Beta Program Goals (`spidr-beta/`)

A standalone landing page + signup API exists to recruit testers ahead of a public launch. Unchanged since last compile:

- **Closed beta cap: 50 testers** (`spidr-beta-api/src/index.js:72`, `BETA_CAP = 50`). The API exposes `/status` (`spotsLeft`, `isFull`, `cap`) and the landing page shows live availability; signups are rejected once full.
- **Two tracks**: `closed` and `open` (`betaType` enum) — closed is the capped early cohort; open is the waitlist for the broader beta.
- **Eligibility**: 18+ only (enforced in the signup form), must accept Terms, Privacy, and the Beta Testing Agreement (AS-IS software, feedback assigned to Spidr, no compensation/equity). Optional marketing opt-in.
- **Data collected**: name, email (unique), desired username, age bracket, platforms of interest, motivation ("why"), consents, IP. Confirmation email sent via Resend.
- **Implicit goal**: the `platforms` field measures demand per platform (informing whether mobile/desktop/web gets launch priority), and `why` screens for engaged testers.

## Monetization Goal

Fund the platform via the **SPIDR APEX** subscription ($7.99/mo or $69.99/yr). As of Patch 1.9.25 this is **live end-to-end** — real Stripe checkout, server-side tier enforcement, 30-day burn-once trial. Remaining monetization gaps (feature-level enforcement still client-side, no higher tier, portal-only refund/dunning) are documented in [pricing.md](pricing.md).

## Standing Engineering Goals

- **Release discipline**: every release goes through `/ship` (security audit → SPIDR_SYS patch note → commit/push). The SPIDR_SYS terminal doubles as the user-facing changelog, so patch notes are a product feature, not just docs.
- **Auth consolidation** (from `spidr-auth/SPIDR-AUTH.md` "Planned"): role-based access (lock down `GET /users/`), RS256 signing so services verify without the shared secret, migrate TOTP from Node to Spring Boot (AUTH-F3), SMS OTP, and account self-service endpoints. Partial progress in 1.9.25 (legacy Node auth 410'd) but the migration itself is unfinished.
- **Cross-platform integrity**: one API serves web, Electron, and mobile — changes must be checked with `/cross-check` so no platform silently breaks.
- **Security posture**: strict URL scheme allowlists on mobile, rate limiting with honest `Retry-After`, secrets in env vars with `/rotate-keys` for incidents.
- **Store submission readiness**: mobile compliance work (moderation queue, takedown SLA, account-delete blob purge, `expo-location` removal) is landing incrementally — precondition for iOS / Play Store review.

## Milestone Sequence (inferred)

1. ✅ Web + desktop app live in production (Railway + Hostinger)
2. ✅ Electron installers packaged (Windows portable + installer via `npm run build-exe`)
3. 🔄 Mobile parity (Patch 1.9+, this branch) — Phase 1 shipped, settings-screen files written, wiring pending
4. ✅ Real APEX billing (Stripe + server-side tier enforcement) — Patch 1.9.25
5. ⬜ Mobile Phase 2 — voice + Spotify via custom dev client (blocked on Firebase + EAS + Apple dev account)
6. ⬜ Closed beta — 50 testers via the spidr-beta funnel
7. ⬜ Open beta / public launch, likely on `spidrapp.com`

Steps 6–7 ordering is inferred from the code, not an explicit written plan — confirm with the team before treating it as committed.
