# Spidr — Project Goals

> Compiled 2026-07-20, refreshed 2026-08-24 on branch `dev` from code, README.md, handoff.md, `spidr-server/src/routes/system.js` NEWS (patches 1.9.57 → 1.9.66), `spidr-client/mobile/`, and the spidr-beta stack. Update when a phase completes or the roadmap shifts.

## Vision

Spidr is a Discord-style social platform with a TikTok-style differentiator: **THE WEB**, a vertical short-video feed with its own FYP ranking algorithm, fused with real-time chat (servers/channels/DMs), voice/video calls, a TheaterMode + Spotify DJ experience inside calls, a pluggable profile module system (Nexus), and AI features (Spidr Bot, custom bots) — all under a spider/symbiote-themed identity (red `#FF3333`/`#C41E3A`, "web", "threads", "symbiote" naming).

Target platforms: web (`spidrapp.infinitetechteam.com`), Windows/macOS/Linux desktop (Electron), and iOS/Android (Expo, since Patch 1.9). Eventual public domain appears to be `spidrapp.com` (already in the beta API's production CORS allowlist).

## Current Phase — Patch 1.9+: Mobile Parity + Store Compliance

Per `handoff.md` + recent commits, active work is **finishing mobile parity and hardening the app for iOS / Play Store submission**:

- **Mobile Phase 1 (done, in production)**: auth, THE WEB feed, servers + text channels, DMs, profiles, GIFs & Emojis, voice notes, real-data profile widgets (Steam, Weather, PC Specs, Symbiote Pet, Gaming Uplink, Streak), group chats, feed-interaction sheets (`ReactionSheet`, `SlingSheet`), `NotFound` fallback. **Patch 1.9.63** made DM unread badges show up and clear correctly in three places (tab-bar, home stat tile, Recents strip). **Patch 1.9.64** wired iOS push end-to-end (`@react-native-firebase/messaging` v26.2.0, `firebase-admin` v12 on the server) and shipped the mobile home tab's Jump Back In + pinned-favorites panel (`SpidrWebMatrix`).
- **Settings screens wired (was pending, now done)**: `mobile/app/(tabs)/profile.tsx` no longer calls `phaseTwo()` on any row — all target Phase-2 settings screens are now live and route to `mobile/app/settings/` (`about, apex, appearance, avlab, connections, notifications, privacy, protocol, security, voice-video, widgets`). The APEX settings row is conditionally rendered only for `isApex` users. This closes the wiring gap called out in the previous audit.
- **Notifications broker is real (Patch 1.9.61)**: all non-call push (DMs, server @-mentions, friend requests, voice-call invites) now flows through `spidr-server/src/utils/notifications.js`, gating on master toggle → per-type toggle → DND → **Close Friend breakthrough**. Close Friends is a shipped feature — `Friend.is_close_friend`, `PATCH /friends/:id/close`, yellow-star toggle on the mobile ProfileView. Every switch on the mobile Notifications settings screen enforces at the server for the first time. See memory [[notifications-broker]] — this is the single gate for push prefs.
- **Native calls online (Patch 1.9.60 → 1.9.62)**: `react-native-webrtc` v124.0.8 + `@config-plugins/react-native-webrtc` shipped in `mobile/package.json`; incoming Spidr calls light up the phone's native lock-screen call UI; mobile callers land in the same voice room as web callers; Voice & Video settings (mic, camera-on-join, speaker default) apply on join. Missed-call notes cleaned up (proper "group call" wording, no fake "didn't answer" after a connected hang-up, real caller names instead of "Someone"). Memory [[native-calls-setup]] is now partially superseded — Firebase + EAS dev build are wired; the remaining block is an Apple developer account for TestFlight distribution.
- **Mobile Phase 2 remainder**: Spotify OAuth (`expo-auth-session`) — still NOT in `mobile/package.json`. This is the only Phase-2 native item still pending after native calls landed.

## Recent Patch Notes (canonical: `spidr-server/src/routes/system.js` NEWS)

The most recent releases in NEWS as of 2026-08-24 (top 10):

- **Patch 1.9.66** (2026-08-22, `p1966`, FIX) — Friends flow self-heals: accept-request backfills the missing mirror row, dedicated `DELETE /friends/:id` wipes both sides atomically (skipping either side the other has set to `blocked`). Web pinned conversations + pinned group chats scoped to per-user `localStorage` keys so account switching on a shared browser can't leak pins.
- **Patch 1.9.65** (2026-08-21, `p1965`, UPDATE) — **Auth safety hardening**: generalized error messages on `/auth/verify`, `/auth/resend`, `loadUser` to prevent account enumeration; per-email rate-limit buckets alongside per-IP on every auth endpoint; **JJWT 0.11.5 → 0.12.6** with parser/builder API migration; strict API-only CSP on spidr-server (`default-src 'none'`, `img-src 'self' data:`, `frame-ancestors + base-uri + form-action 'none'`). Mobile branded icon + splash swap; iOS rich-notification target scaffold.
- **Patch 1.9.64** (2026-08-20, `p1964`, FIX) — **iOS push notifications live end-to-end**. `@react-native-firebase/messaging` v22+ modular exports wrapped in `nativeCalls.ts`; `mobile/index.js` background handler rewritten. Server `push.js` + `scripts/send-test-push.js` migrated to `firebase-admin` v12. Mobile home tab picks up the web Jump Back In / Pinned panel as `SpidrWebMatrix`.
- **Patch 1.9.63** (2026-08-20, `p1963`, FIX) — Mobile DM unread badges finally show + clear like Discord. Realigned mobile `unreadContext` to `/direct-messages/read-conversation` (was 404ing on `/mark-conversation-read`). Badge visible in three places: Home Friends tile, Recents strip avatars, bottom tab. `AppState` "active" listener invalidates unread-dms query on foreground.
- **Patch 1.9.62** (2026-08-19, `p1962`, FIX) — Cleaner missed-call notes: proper group-call wording, no false "didn't answer" after a connected hang-up, real caller names. Mobile missed calls render as centered alerts, not raw bubbles.
- **Patch 1.9.61** (2026-08-19, `p1961`, UPDATE) — **Notifications broker + Close Friends**. See "Notifications broker is real" above.
- **Patch 1.9.60** (2026-08-18, `p1960`, UPDATE) — Native mobile calls back online (see "Native calls online" above). Also backfilled `p1958` + `p1959` into NEWS.
- **Patch 1.9.59** (2026-08-18, `p1959`, UPDATE) — Spidr Web Matrix: Jump Back In + Spidr Web pinned strip merged into one tabbed panel on the homepage.
- **Patch 1.9.58** (2026-08-18, `p1958`, FIX) — Spidr Core (breathing home button) finally rendered in the desktop sidebar (previous patch put it in a dead file).
- **Patch 1.9.57** (2026-08-18, `p1957`, UPDATE) — Spidr Core breathes on 3s loop; native title bar on Windows/Linux (real system minimize/maximize/close); global broken-image fallback to spider placeholder.

Older highlights worth carrying: **Patch 1.9.56** wired `electron-updater` (auto-update pipeline live end-to-end — desktop app now updates itself), **1.9.55** APEX store recognizes existing subscribers, **1.9.54** landing redesign + Electron URL-scheme hardening, **1.9.25** Spidr APEX real (Stripe + platform-wide CRUD ownership lockdown — full detail in [[pricing]]).

**Note on patch-note voice** (commit `cbf8ad8`, 2026-08-22): every NEWS entry was rewritten into plain-English user-facing prose — no file paths, no function names, no library versions in the terminal. A `WRITING PATCH NOTES` header comment now lives at the top of `spidr-server/src/routes/system.js` so `/patch` and future edits stay in the new voice. Server NEWS ≡ client MOCK_NEWS across all 41 ids.

## Non-Patch Developments Since Last Compile (2026-07-28)

Structural changes landed via recent merges that aren't dressed up as SPIDR_SYS notes:

- **Auto-update pipeline live end-to-end** — `electron-updater` (Patch 1.9.56) is not just wired; users are actively getting in-app updates per the patch note copy. The `fixes/ELECTRON-AUTO-UPDATE-SETUP.md` reference was retired from the `fixes/` folder (implementation done).
- **`fixes/` folder rotated** — current contents: `BETA-COST-ANALYSIS.md`, `DEMO-DEV-MERGE-PLAN.md`, `MOBILE-VOICE-CHANNELS-PLAN.md` (native calls now shipped, doc kept for reference), `RATE-LIMIT-HARDENING.md` (implemented in 1.9.65), `Spidr-Dj.md`, `unvibecode.md`. Old `ELECTRON-AUTO-UPDATE-SETUP.md` is gone.
- **Notifications broker as first-class utility** — `spidr-server/src/utils/notifications.js` is now the single decision point for all non-call push, alongside `spidr-server/src/utils/push.js` for the Firebase Admin send. See memory [[notifications-broker]].
- **New Nexus widget: AppleMusicNowPlaying** — `spidr-client/src/components/nexus/widgets/AppleMusicNowPlaying.jsx` joins Spotify/Steam/Gaming/Weather/PC/Symbiote/Lofi. Wired via `builtinWidgets.js`.
- **Friend model IS still present** (correcting last audit's error): `spidr-server/src/models/Friend.js` is very much alive — the entire 1.9.66 patch is friendship-flow healing on that model. The previous compile's "Friend.js deleted (-65 lines), consolidated onto UserProfile" claim was wrong. Friend rows are the source of truth for pending/accepted/blocked/close-friend state.
- **Auth surface stays TOTP-only in Node**; every other endpoint on `spidr-server/src/routes/auth.js` 410s. 1.9.65's JJWT bump and rate-limit + CSP hardening lived in `spidr-auth` and `spidr-server` respectively. AUTH-F3 (TOTP migration to Spring Boot) still open.

## Beta Program Goals (`spidr-beta/`)

A standalone landing page + signup API exists to recruit testers ahead of a public launch. Unchanged in this audit window:

- **Closed beta cap: 50 testers** (`spidr-beta-api/src/index.js`, `BETA_CAP = 50`). The API exposes `/status` (`spotsLeft`, `isFull`, `cap`) and the landing page shows live availability; signups are rejected once full.
- **Two tracks**: `closed` and `open` (`betaType` enum) — closed is the capped early cohort; open is the waitlist for the broader beta.
- **Eligibility**: 18+ only, must accept Terms, Privacy, and the Beta Testing Agreement (AS-IS software, feedback assigned to Spidr, no compensation/equity). Optional marketing opt-in.
- **Data collected**: name, email (unique), desired username, age bracket, platforms of interest, motivation, consents, IP. Confirmation email sent via Resend.
- **Implicit goal**: the `platforms` field measures demand per platform; `why` screens for engaged testers.
- **Cost analysis** for the beta cohort now documented in `fixes/BETA-COST-ANALYSIS.md`.

## Monetization Goal

Fund the platform via the **SPIDR APEX** subscription ($7.99/mo or $69.99/yr). Live end-to-end since Patch 1.9.25; UX polish in 1.9.55 (already-subscribed users no longer get re-pitched). Remaining monetization gaps (feature-level enforcement still client-side, no higher tier, portal-only refund/dunning) are documented in [[pricing]].

## Standing Engineering Goals

- **Release discipline**: every release goes through `/ship` (security audit → SPIDR_SYS patch note → commit/push). The SPIDR_SYS terminal doubles as the user-facing changelog, and patch notes are now written in user-facing prose (see `cbf8ad8`).
- **Auth consolidation** (from `spidr-auth/SPIDR-AUTH.md` "Planned"): role-based access, RS256 signing so services verify without the shared secret, migrate TOTP from Node to Spring Boot (AUTH-F3), SMS OTP, account self-service. Progress in 1.9.65: JJWT 0.12.6 + per-email rate limits + API CSP. AUTH-F3 itself still open.
- **Cross-platform integrity**: one API serves web, Electron, and mobile — changes must be checked with `/cross-check`.
- **Security posture**: strict URL scheme allowlists on mobile, rate limiting with honest `Retry-After`, per-email + per-IP buckets (1.9.65), API-only CSP, secrets in env vars with `/rotate-keys` for incidents.
- **Store submission readiness**: mobile compliance work (moderation queue, takedown SLA, account-delete blob purge, `expo-location` removal, native push, native calls) is landing incrementally — precondition for iOS / Play Store review. Push + calls now done; Apple developer account still the gate for TestFlight.

## Milestone Sequence (inferred)

1. ✅ Web + desktop app live in production (Railway + Hostinger)
2. ✅ Electron installers packaged (Windows portable + installer via `npm run build-exe`)
3. ✅ Desktop auto-update pipeline — `electron-updater` (Patch 1.9.56) live end-to-end, users receiving updates
4. ✅ Mobile parity Phase 1 — feed, chat, servers, DMs, profiles, unread badges, native iOS push, home Jump-Back-In / Pinned panel, all settings screens wired
5. ✅ Real APEX billing (Stripe + server-side tier enforcement) — Patch 1.9.25
6. 🔄 Mobile Phase 2 — native calls **done** (1.9.60, react-native-webrtc + Firebase live), Spotify OAuth via `expo-auth-session` still **pending**. Apple developer account still needed for TestFlight
7. ⬜ Closed beta — 50 testers via the spidr-beta funnel (cost analysis in `fixes/BETA-COST-ANALYSIS.md`)
8. ⬜ Open beta / public launch, likely on `spidrapp.com`

Steps 7–8 ordering is inferred from the code, not an explicit written plan — confirm with the team before treating it as committed.

## Related

- [[pricing]] — APEX tiers, Stripe data model, remaining monetization gaps
- [[spidr-team]] — who owns what (surface risks pre-merge; no review gate)
- [[notifications-broker]] — mobile push single decision point
- [[native-calls-setup]] — mobile calls infra history (now largely shipped)
