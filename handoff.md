# Handoff

## Goal
Ship mobile voice — server voice webs and group calls on iOS — then commit the three-batch working tree that has now been carried across four sessions.

## Current State
Branch `dev`, last commit `05a695e` (Patch 1.9.94, 2026-09-04). **Nothing was committed this session.** Three uncommitted batches now sit in the tree: the onboarding/font redesign (four sessions old), the in-app server banner, and the new mobile voice work.

**Mobile voice webs + group calls are implemented and verified static, but never run on a device.** `tsc --noEmit` is clean and a full Metro Android bundle succeeded (exit 0, 7.56 MB), so every import resolves — but no phone or browser has actually joined a room. Treat "it works" as unproven.

**No server changes were needed.** `voice:join` / `voice:signal` / `voice:peer-joined` / `voice:peer-left` in `spidr-server/src/socket/handlers.js:445-497` already served both server-channel and group shapes. Mobile speaks the exact contract web speaks.

**The 1.9.94 split-commit hazard from last session is UNCHANGED and still live**: `spidr-server/src/socket/handlers.js` (the `socket.join('user:<id>')` half of the banner) is still uncommitted, so `emitToUser()` still fires into an empty room on `dev`. This session added nothing to that file — it is exactly as it was.

**iOS is not blocked.** Last session's notes and the memory index both claimed an Apple developer account was the gate; that is false. `eas build:list --platform ios` shows **16 FINISHED + 3 ERRORED builds, all `development` profile, all `isForIosSimulator: false`** — signed device builds are impossible without an active membership. Newest dev client is from 2026-09-04, **valid to 2026-09-18**. It already contains `react-native-webrtc`, `react-native-callkeep`, and `react-native-incall-manager`, and this session added **zero native modules**, so the voice code runs on the existing dev client over Metro with no rebuild.

SPIDR_SYS in lockstep at **60 entries** / top id `p1994` (verified id-for-id; the previous "63 entries" figure in goal.md was a miscount, now corrected).

## Files
Voice batch (new, untracked):
- spidr-client/mobile/lib/voiceRoom.ts — N-way mesh manager; join/leave, mute/deafen/speaker, `VoiceSession` presence, socket-reconnect rejoin, `voice:force-disconnect`
- spidr-client/mobile/app/voice/[channelId].tsx — room screen (occupant grid + controls)
- spidr-client/mobile/components/call/ActiveVoiceBar.tsx — persistent tether after navigating away

Voice batch (modified):
- spidr-client/mobile/app/server/[id]/index.tsx — removed the `Alert.alert('Phase 2 — use the web client')` stub; real join + live occupant avatars/count
- spidr-client/mobile/app/group/[id].tsx — header call button + "LIVE VOICE WEB" join banner
- spidr-client/mobile/app/_layout.tsx — mounts `ActiveVoiceBar`
- spidr-client/mobile/lib/callManager.ts — detach voice listeners by reference (was `socket.off('voice:signal')` bare)

Docs refreshed by `/stop` (uncommitted):
- mr-rimmer/goal.md — 6 edits · CLAUDE.md — 4 edits · mr-rimmer/{pricing,team}.md — date-stamps

Banner batch (uncommitted, carried forward):
- spidr-server/src/socket/handlers.js — **`socket.join('user:<id>')`, still NOT committed — the load-bearing half of 1.9.94**
- spidr-client/mobile/components/ServerSignalBanner.tsx · mobile/targets/notification-service/NotificationService.swift · src/components/spidr/NotificationCenter.jsx

Onboarding/font batch (uncommitted, carried forward):
- Web: LoginPage.jsx (rewrite, +737/−…) · FriendsPanel.jsx · HolographicProfile.jsx · index.css · tailwind.config.js · src/assets/fonts/
- Mobile: authKit.tsx · (auth)/forgot.tsx · (auth)/{login,register,verify,_layout}.tsx · AuthShell.tsx · ProfileView.tsx · (tabs)/friends.tsx · index.tsx · app.json · package.json · assets/fonts/
- Docs: instructions/{SKILLS,WORKFLOWS}.md · spidr-client/mobile/README.md

## Changes
- Implemented mobile server voice webs + group calls against the existing web signaling contract. Group calls address the mesh as `serverId: 'group'` / `channelId: <groupId>`, byte-matching `KineticChat.jsx:374`; DM calls remain `'dm'`. Presence via `VoiceSession` rows, so web and mobile see each other's occupants.
- Kept `voiceRoom` deliberately separate from `callManager`: nothing in a voice web rings, so it needs no Firebase, no CallKeep, no APNs — only `react-native-webrtc` + `react-native-incall-manager`.
- Fixed a latent cross-feature bug in `callManager.end()`: bare `socket.off('voice:signal')` would have stripped `voiceRoom`'s handlers off the shared socket singleton when a DM call ended mid-voice-web. Now detaches by reference.
- Corrected three stale doc claims, each of which would have misdirected a future session:
  1. **Apple developer account is not a blocker** (goal.md said so in 3 places; 16 signed iOS device builds disprove it). Real distance to TestFlight is that no `production`-profile build or App Store Connect submission has ever been attempted — zero non-`development` iOS builds on record.
  2. **APEX billing is real, not simulated** (CLAUDE.md gotcha). `routes/payments.js:89` creates a real Stripe Checkout session, `:121` a real billing portal, and `routes/webhooks/stripe.js` verifies `STRIPE_WEBHOOK_SECRET` and is the sole writer of `apex_tier`. There is no `routes/apex.js`.
  3. **SPIDR_SYS is 60 entries, not 63.**
- Added two CLAUDE.md gotchas: the overloaded voice-room id contract (`'group'`/`'dm'` literals — wrong literal fails *silently*, joining a correctly-named empty room), and detaching socket listeners by reference.
- Fixed the `/dev` skill's stale hardcoded `JAVA_HOME` (redhat.java extension bumped `1.55.0` → `1.56.0`); the machine-level `JAVA_HOME` at `C:\Program Files\Java\jdk-21` works. **The skill file itself was not edited — the fix was applied ad hoc.**
- Corrected the `native-calls-setup` memory index line, which contradicted its own file body.

## Failed
- **`/dev` auth service, first launch** — `JAVA_HOME` in `.claude/commands/dev/` points at `redhat.java-1.55.0-.../jre/21.0.11-...`, which no longer exists. Relaunching without the override worked. The skill file still carries the dead path and will fail again next `/dev`.
- **Local dev stack OOM-killed three times** — `:4000` died twice and `:5173`/`:8080` once, during `tsc` and `expo export`. Machine has ~3.4 GB free of 15.3 GB with CurseForge holding ~1.2 GB. Not a code fault. Metro with `--tunnel` is heavier than any of the three services and will be the next thing squeezed.
- **Mobile↔web cross-testing on localhost will not work** — mobile reads `extra.apiUrl` from `app.json` → Railway; local web reads `.env.development` → `localhost:4000`. Two different Socket.io servers means two different meshes, and the failure is silent (each side sits alone in a same-named room). Use the deployed web app at `spidrapp.infinitetechteam.com`, or two phones.
- **Voice never exercised on a device.** Static verification only.

## Next Step
**Run `npx expo start --tunnel --clear` in `spidr-client/mobile/`, open the existing dev client on the iPhone via the `https://` tunnel URL (not `http://` — iOS ATS blocks it), and join a server voice web.** If it connects on the same wifi but dies cross-network, the cause is `routes/voice.js` returning STUN-only — `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` are unset, and phone-on-cellular ↔ desktop-on-wifi is exactly the symmetric-NAT case STUN alone cannot solve.
