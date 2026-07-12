# Handoff

## Goal
Bring Spidr Mobile to feature parity with the small-screen web app for Patch 1.9+. This session started replacing the 10 "Phase 2 — Coming soon" Settings stubs with real screens; Connections and Security & 2FA are done.

## Current State
Mobile app typechecks cleanly (only pre-existing `ClipCard.tsx` TS7006). Settings → Connections and Settings → Security & 2FA are real screens now, mirroring web `NeuralConfig.jsx` and `SecurityMatrix.jsx`. Neither has been exercised on a device yet — TOTP QR flow and Spotify OAuth round-trip need `npx expo start --tunnel` + a phone. 8 settings rows still call `phaseTwo(label)`: Appearance, Notifications, Privacy, Voice & Video, A/V Lab, Protocol, Widgets, About (+ Apex when tier === APEX).

## Files
- spidr-client/mobile/app/settings/connections.tsx — new; Spotify OAuth card + Steam/Twitch neural_links toggles
- spidr-client/mobile/app/settings/security.tsx    — new; change password (Spring Boot), TOTP setup/verify/disable (Node), logout danger zone
- spidr-client/mobile/app/(tabs)/profile.tsx       — Connections + Security rows route to new screens
- spidr-client/mobile/lib/apiClient.ts             — spotify.disconnect path fixed

## Changes
- Add /settings/connections screen: Spotify connect (opens `${BASE_URL}/spotify/auth/start?userId=` via http(s)-allowlisted Linking, refetch on return) + disconnect; Steam/Twitch toggle cards writing UserProfile.neural_links
- Add /settings/security screen: identity card (email, account age), change-password bottom sheet via auth.changePassword, full TOTP flow (setup → QR data-URL via expo-image + tap-to-copy secret → 6-digit verify → refreshCurrentUser; disable with confirm), sever-link logout
- Wire profile.tsx Connections/Security rows to the new routes (phaseTwo removed for those two)
- Fix spotify.disconnect() in mobile apiClient: was DELETE /spotify/auth (404, silently swallowed by .catch), server route is /spotify/auth/disconnect

## Failed
None. Pre-existing untouched: `components/feed/ClipCard.tsx(86,17)` TS7006 implicit any.

## Next Step
Continue replacing `phaseTwo(label)` stubs in `spidr-client/mobile/app/(tabs)/profile.tsx` — next up **Appearance** (theme/accent, mirror web SettingsPanel appearance tab; appTheme/setAppTheme already exist in `mobile/lib/appShellContext.tsx`) and **About** (patch notes from `/system/news`, version, credits — easiest win). Before shipping, smoke-test Connections + Security on a device via `npx expo start --tunnel`.
