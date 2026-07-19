# Spidr — Project Goals

> Compiled 2026-07-06 on branch `patch-1.9_Mobile` from code, README.md, handoff.md, and the spidr-beta stack. Update when a phase completes or the roadmap shifts.

## Vision

Spidr is a Discord-style social platform with a TikTok-style differentiator: **THE WEB**, a vertical short-video feed with its own FYP ranking algorithm, fused with real-time chat (servers/channels/DMs), voice/video calls, a TheaterMode + Spotify DJ experience inside calls, a pluggable profile module system (Nexus), and AI features (Spidr Bot, custom bots) — all under a spider/symbiote-themed identity (red `#FF3333`/`#C41E3A`, "web", "threads", "symbiote" naming).

Target platforms: web (`spidrapp.infinitetechteam.com`), Windows/macOS/Linux desktop (Electron), and iOS/Android (Expo, since Patch 1.9). Eventual public domain appears to be `spidrapp.com` (already in the beta API's production CORS allowlist).

## Current Phase — Patch 1.9+: Mobile Parity

Per `handoff.md`, the active goal is **bringing Spidr Mobile to feature parity with the small-screen web app**:

- **Mobile Phase 1 (done, runs in Expo Go)**: auth, THE WEB feed, servers + text channels, DMs, profiles. Recent sessions added GIFs & Emojis (Signal Archive), voice notes, call ringing UX, and real-data profile widgets (Steam, Weather, PC Specs, Symbiote Pet, Gaming Uplink, Streak).
- **Immediate next step**: replace the 10 stubbed "Phase 2 — Coming soon" settings rows in `mobile/app/(tabs)/profile.tsx` with real screens — starting with Connections (Steam link status) and Security & 2FA (TOTP via Node `/auth/setup-totp`).
- **Mobile Phase 2 (needs a custom dev client, not Expo Go)**: voice channels (`react-native-webrtc`) and Spotify OAuth (`expo-auth-session`).

## Beta Program Goals (`spidr-beta/`)

A standalone landing page + signup API exists to recruit testers ahead of a public launch:

- **Closed beta cap: 50 testers** (`spidr-beta-api/src/index.js:72`, `BETA_CAP = 50`). The API exposes `/status` (`spotsLeft`, `isFull`, `cap`) and the landing page shows live availability; signups are rejected once full.
- **Two tracks**: `closed` and `open` (`betaType` enum) — closed is the capped early cohort; open is the waitlist for the broader beta.
- **Eligibility**: 18+ only (enforced in the signup form), must accept Terms, Privacy, and the Beta Testing Agreement (AS-IS software, feedback assigned to Spidr, no compensation/equity). Optional marketing opt-in.
- **Data collected**: name, email (unique), desired username, age bracket, platforms of interest, motivation ("why"), consents, IP. Confirmation email sent via Resend.
- **Implicit goal**: the `platforms` field measures demand per platform (informing whether mobile/desktop/web gets launch priority), and `why` screens for engaged testers.

## Monetization Goal

Fund the platform via the **SPIDR APEX** subscription ($7.99/mo or $6.39/mo annual) — full details, gated features, and the pre-launch blockers (no real payment processor, client-writable tier) are in [pricing.md](pricing.md). Monetization is currently *simulated*; making it real (Stripe + server-side enforcement) is a prerequisite for public launch.

## Standing Engineering Goals

- **Release discipline**: every release goes through `/ship` (security audit → SPIDR_SYS patch note → commit/push). The SPIDR_SYS terminal doubles as the user-facing changelog, so patch notes are a product feature, not just docs.
- **Auth consolidation** (from `spidr-auth/SPIDR-AUTH.md` "Planned"): role-based access (lock down `GET /users/`), RS256 signing so services verify without the shared secret, migrate TOTP from Node to Spring Boot (AUTH-F3), SMS OTP, and account self-service endpoints.
- **Cross-platform integrity**: one API serves web, Electron, and mobile — changes must be checked with `/cross-check` so no platform silently breaks.
- **Security posture**: strict URL scheme allowlists on mobile, rate limiting with honest `Retry-After`, secrets in env vars with `/rotate-keys` for incidents.

## Milestone Sequence (inferred)

1. ✅ Web + desktop app live in production (Railway + Hostinger)
2. 🔄 Mobile parity (Patch 1.9+, this branch) — Phase 1 shipped, settings/Phase-2 screens in progress
3. ⬜ Mobile Phase 2 — voice + Spotify via custom dev client
4. ⬜ Closed beta — 50 testers via the spidr-beta funnel
5. ⬜ Real APEX billing (Stripe + server-side gating) — see pricing.md blockers
6. ⬜ Open beta / public launch, likely on `spidrapp.com`

Steps 4–6 ordering is inferred from the code, not an explicit written plan — confirm with the team before treating it as committed.
