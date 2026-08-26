# Spidr — Project Goals

> Compiled 2026-07-20, refreshed 2026-07-28 on branch `dev` from code, README.md, handoff.md, `spidr-server/src/routes/system.js` NEWS, and the spidr-beta stack. Update when a phase completes or the roadmap shifts.

## Vision

Spidr is a Discord-style social platform with a TikTok-style differentiator: **THE WEB**, a vertical short-video feed with its own FYP ranking algorithm, fused with real-time chat (servers/channels/DMs), voice/video calls, a TheaterMode + Spotify DJ experience inside calls, a pluggable profile module system (Nexus), and AI features (Spidr Bot, custom bots) — all under a spider/symbiote-themed identity (red `#FF3333`/`#C41E3A`, "web", "threads", "symbiote" naming).

Target platforms: web (`spidrapp.infinitetechteam.com`), Windows/macOS/Linux desktop (Electron), and iOS/Android (Expo, since Patch 1.9). Eventual public domain appears to be `spidrapp.com` (already in the beta API's production CORS allowlist).

## Current Phase — Patch 1.9+: Mobile Parity + Store Compliance

Per `handoff.md` + recent commits, active work is **finishing mobile parity and hardening the app for iOS / Play Store submission**:

- **Mobile Phase 1 (done, runs in Expo Go)**: auth, THE WEB feed, servers + text channels, DMs, profiles. Recent adds — GIFs & Emojis (Signal Archive), voice notes, call ringing UX, real-data profile widgets (Steam, Weather, PC Specs, Symbiote Pet, Gaming Uplink, Streak), group chats. **Patch 1.9.56** added the missing feed-interaction screens (`ReactionSheet`, `SlingSheet`) and a `NotFound` fallback screen to close mobile UX parity gaps.
- **Settings screens exist, wiring pending**: all 11 target Phase-2 settings screens are written under `spidr-client/mobile/app/settings/` (`about, apex, appearance, avlab, connections, notifications, privacy, protocol, security, voice-video, widgets`), plus `edit-profile`, `gifs-emojis`, `group/[id]`, `user-web/[id]`, `spidr-ai`. **However** `mobile/app/(tabs)/profile.tsx:26-169` still calls `phaseTwo()` alerts on 11 settings rows — the screens exist but the settings menu doesn't route to them yet. Wiring is a per-row 1-line swap (`onPress: () => phaseTwo(...)` → `router.push('/settings/...')`).
- **Mobile Phase 2 (still needs a custom dev client, not Expo Go)**: voice channels (`react-native-webrtc`) and Spotify OAuth (`expo-auth-session`). Confirmed: `spidr-client/mobile/package.json` still ships neither. Blocked further by [[native-calls-setup]] — Firebase project + EAS dev build still not wired, no Apple dev account yet. **Migration plan now written**: `fixes/MOBILE-VOICE-CHANNELS-PLAN.md` (dropped in Patch 1.9.56) documents the react-native-webrtc port from `useWebRTC.js`.

## Recent Patch Notes (canonical: `spidr-server/src/routes/system.js` NEWS)

The three most recent releases in NEWS as of 2026-07-28:

- **Patch 1.9.56** (2026-07-26, id `p1956`) — **In-app updater wired**: `electron-updater` (`spidr-client/electron/main.js` + `preload.js`) now checks a GitHub Releases feed on desktop launch, downloads the next `.exe` in the background, and surfaces state via `spidr-client/src/components/spidr/UpdatesCard.jsx` on the home dashboard. Publish config lives in `spidr-client/package.json:216-223` (provider: github, `ChristianMThomas/Spidr-Demo`); publish workflow documented in [`fixes/ELECTRON-AUTO-UPDATE-SETUP.md`](../fixes/ELECTRON-AUTO-UPDATE-SETUP.md). Same patch: THE WEB "Resonance" stat + tab relabeled to **"Likes"** on web and mobile (the ranking algorithm term is unchanged in code — only user copy), and mobile gained the `ReactionSheet`, `SlingSheet`, and `NotFound` screens. `fixes/MOBILE-VOICE-CHANNELS-PLAN.md` also landed as the reference for the eventual react-native-webrtc migration.
- **Patch 1.9.55** (2026-07-22, id `p1955`) — APEX store now recognizes existing subscribers (`ApexStore.jsx` no longer offers re-purchase flows to users whose `apex_tier === 'apex'`; state driven by the live Stripe fields on `UserProfile`).
- **Patch 1.9.54** (2026-07-22, id `p1954`) — Landing page redesign in `spidr-beta/spidr-landing` + Electron URL-scheme hardening (external navigation locked to the http(s) allowlist to match the mobile hardening).

Older highlights worth carrying: Patch 1.9.53 (Signals tab peek-safe + ghost-DM filter no-op fixed), 1.9.52 (ghost server-members purged and fly-catch DM moved server-side), 1.9.25 (Spidr APEX real — signed Stripe webhook, 30-day burn-once trial, platform-wide CRUD ownership lockdown — full detail in [pricing.md](pricing.md)), 1.9.24 (Streak + Steam widgets), 1.9.22 (tablet chat headers + live server-channel avatars), 1.9.21 (Spotify module privacy fix).

## Non-Patch Developments Since Last Compile (2026-07-06)

Structural changes landed via recent merges that aren't dressed up as SPIDR_SYS notes:

- **Electron packaging + auto-update pipeline** — `BUILD_INSTALLERS.md` (repo root, 182 lines) + `spidr-client/build/icon.png`; installers cut with `npm run build-exe` → `dist_installer/` (commit `eb35670`). Patch 1.9.56 then wired `electron-updater` (`package.json` dep, `electron/main.js` + `preload.js`) with a GitHub Releases publish config. **Publish script and `GH_TOKEN` setup pending** — see [`fixes/ELECTRON-AUTO-UPDATE-SETUP.md`](../fixes/ELECTRON-AUTO-UPDATE-SETUP.md); until the first release is cut, no installed client can actually pull updates.
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
3. 🔄 Desktop auto-update pipeline — code wired in Patch 1.9.56, publish workflow ([`fixes/ELECTRON-AUTO-UPDATE-SETUP.md`](../fixes/ELECTRON-AUTO-UPDATE-SETUP.md)) and first GitHub Release pending
4. 🔄 Mobile parity (Patch 1.9+, this branch) — Phase 1 shipped (incl. ReactionSheet/SlingSheet/NotFound in 1.9.56), settings-screen files written, wiring pending
5. ✅ Real APEX billing (Stripe + server-side tier enforcement) — Patch 1.9.25
6. ⬜ Mobile Phase 2 — voice + Spotify via custom dev client (blocked on Firebase + EAS + Apple dev account; migration plan in `fixes/MOBILE-VOICE-CHANNELS-PLAN.md`)
7. ⬜ Closed beta — 50 testers via the spidr-beta funnel
8. ⬜ Open beta / public launch, likely on `spidrapp.com`

Steps 7–8 ordering is inferred from the code, not an explicit written plan — confirm with the team before treating it as committed.
