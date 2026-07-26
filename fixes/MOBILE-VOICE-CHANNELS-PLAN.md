# Mobile Voice Channels — Real WebRTC Wiring Plan

**Status**: PLANNED — not started
**Owner**: Chris
**Scope**: Wire server voice-channel join on the Expo mobile app to real WebRTC audio, mesh-topology, interoperable with the existing web VC client.

---

## Why this doc exists

Today, tapping a voice channel in the mobile server view (`spidr-client/mobile/app/server/[id]/index.tsx:538`) fires an `Alert.alert("Phase 2 — use web client for now")`. The UI row renders, but there is zero WebRTC installed anywhere in the mobile bundle. The 1:1 DM call modals (`mobile/components/call/*`) are UI shells — no peer-connection code behind them.

This plan lays out what it takes to make server VC join *actually work* on mobile so a mobile user and a web user can be in the same voice room together.

---

## What the web already does (the target we mirror)

- `spidr-client/src/components/spidr/VoiceChannel.jsx` — 2,515 LOC. Renders the room, member tiles, mute/deafen/screen-share/theater.
- `spidr-client/src/components/spidr/useWebRTC.js` — the actual peer-connection engine. Mesh topology (each participant holds one `RTCPeerConnection` per other participant).
- Signaling: `spidr-server/src/socket/handlers.js` — socket.io events for `join`/`offer`/`answer`/`ice`/`leave`. Route mounts at `/voice-channels` (see `spidr-server/src/routes/djSessions.js` — misleadingly named; it's the VC/DJ signaling REST surface).

The mobile client must speak the **exact same socket event names and payload shapes** so a mobile ⇄ web session works out of the box.

---

## The blocker: Expo Go can't load native WebRTC

`react-native-webrtc` is a native module. Expo Go bundles a fixed set of native modules and WebRTC isn't one of them. To use it we must eject to a **custom dev client** (`expo-dev-client` + `expo prebuild` + EAS Build or local native builds).

Once ejected, day-to-day dev flow changes:
- `npx expo start` still works for JS reload
- The QR-in-Expo-Go loop is dead — install a one-time custom dev-client APK/IPA that hosts the JS bundle
- iOS builds require Xcode on a Mac
- Android builds require Android Studio SDK on any OS

---

## Hard prerequisites (before Phase 0 begins)

| Prereq | Required for | Chris's state |
|---|---|---|
| Consent to run `npx expo prebuild` | Generates `ios/` + `android/` folders in the repo; irreversible without git surgery | Need to confirm |
| Android Studio + SDK installed locally | `npx expo run:android` builds | ? |
| Mac + Xcode | `npx expo run:ios` builds | ? |
| Apple Developer account ($99/yr) | TestFlight / App Store distribution | **Not owned** (per session memory) — iOS free-provisioning to own device still works (7-day cert via Xcode) |
| Physical Android or iOS test device | End-to-end mic + audio smoke test (simulator is unreliable for real WebRTC audio) | ? |

---

## Phase 0 — Eject from Expo Go

```powershell
cd spidr-client/mobile
npx expo install expo-dev-client react-native-webrtc @config-plugins/react-native-webrtc
```

Edits to `mobile/app.json`:

```jsonc
{
  "expo": {
    // ... existing fields ...
    "plugins": [
      "expo-router",
      "expo-video",
      "expo-audio",
      "@config-plugins/react-native-webrtc"
    ],
    "ios": {
      // ... existing ...
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Spidr needs your mic so you can talk in voice channels."
      }
    },
    "android": {
      // ... existing ...
      "permissions": [
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS"
      ]
    }
  }
}
```

Then:

```powershell
npx expo prebuild            # writes ios/ + android/
npx expo run:android         # builds + installs dev client on connected device/emulator
# OR (Mac only)
npx expo run:ios
```

**After this step**, `mobile/README.md` needs an update: Phase 2 workflow (`prebuild` + `run:android`/`run:ios`) replaces the Expo Go instructions. Do NOT delete the Expo Go section — leave it as historical context and mark it superseded.

---

## Phase 1 — Signaling hook

Port `spidr-client/src/components/spidr/useWebRTC.js` → `spidr-client/mobile/hooks/useWebRTC.ts`.

Key adapters:
- `navigator.mediaDevices.getUserMedia` → `mediaDevices.getUserMedia` from `react-native-webrtc`
- `RTCPeerConnection` / `RTCSessionDescription` / `RTCIceCandidate` — re-exported by `react-native-webrtc` with identical APIs
- Web audio playback of remote streams: `<audio ref>` → `<RTCView streamURL={remoteStream.toURL()} />` for video; for audio-only, `react-native-webrtc` auto-plays remote audio tracks — no element needed
- No `AudioContext` / analyzer nodes on RN — punt on the speaking-detector for v1, add later via `react-native-webrtc-web-shim`-style workaround or native poll of `getStats()`

Signaling contract (from `spidr-server/src/socket/handlers.js` — confirm exact names during implementation):
- `vc:join` `{ channelId, userId }`
- `vc:offer` / `vc:answer` `{ toId, sdp }`
- `vc:ice` `{ toId, candidate }`
- `vc:peer-joined` / `vc:peer-left` broadcasts
- `vc:leave`

---

## Phase 2 — UI

New file: `spidr-client/mobile/app/server/[id]/voice/[channelId].tsx`

Minimum viable room:
- Header: server name · channel name · leave button
- Member grid: avatar + name + speaking indicator (v2) + muted indicator
- Bottom control bar: mic toggle, deafen toggle, leave
- Sticky "connected to #general" banner when minimised — sits above the tab bar and re-opens the full sheet on tap (mirror what the web `VoiceChannel.jsx` does with `onMinimize`)

Wire the tap:

`spidr-client/mobile/app/server/[id]/index.tsx:538` — replace the `Alert.alert(...)` in the voice `ChannelRow` `onPress` with `router.push(\`/server/${id}/voice/${c.id || c._id}\`)`.

Deferred to v2 (not blockers for shipping v1):
- Video / screen share
- Theater mode
- Spotify listen-along
- DJ sessions
- Soundboard
- Voice equaliser

---

## Phase 3 — Real-device smoke test

Minimum coverage before merging:
1. Mobile ⇄ web: mobile joins, web joins, both hear each other
2. Mobile ⇄ mobile: two mobile clients in same VC
3. Mute round-trip: mobile mutes → web sees mute icon appear
4. Backgrounding: mobile app goes to background → audio keeps flowing (needs iOS `UIBackgroundModes: audio` + Android foreground service — flag as v2 if it's more than a config edit)
5. Bad network: airplane mode drop → clean `vc:leave` propagates and web removes the tile

Simulator/emulator is fine for signaling and dev-loop iteration but **not** for confirming real audio path. Physical device required for #1–#3.

---

## Files this will touch

New:
- `spidr-client/mobile/hooks/useWebRTC.ts`
- `spidr-client/mobile/app/server/[id]/voice/[channelId].tsx`
- `spidr-client/mobile/components/voice/VoiceControls.tsx`
- `spidr-client/mobile/components/voice/VoiceMemberTile.tsx`
- `spidr-client/mobile/lib/webrtcConfig.ts` (STUN/TURN URLs — confirm what web uses)

Modified:
- `spidr-client/mobile/app.json` (plugin + perms)
- `spidr-client/mobile/package.json` (deps)
- `spidr-client/mobile/app/server/[id]/index.tsx` (unwire the Alert, wire the router.push)
- `spidr-client/mobile/README.md` (Phase 2 workflow notes)
- `mobile/CLAUDE.md` if one exists at that level (mention custom dev client)

Generated (committed):
- `spidr-client/mobile/ios/**`
- `spidr-client/mobile/android/**`

---

## Cost estimate

- **Coding time**: ~600–900 LOC net new; realistically **2–3 focused sessions** (Phase 0 in one, Phase 1+2 in the next, Phase 3 debugging in the third).
- **Ongoing tax**: build times go from "scan QR" (5 sec) to "native build" (60–180 sec first time, ~15 sec incremental). JS reload still instant.
- **Money**: $0 unless you go to TestFlight ($99/yr Apple Dev), or use EAS Build's cloud tier for iOS without a Mac (free tier + $29/mo Pro).

---

## Rollback plan

If Phase 0 goes badly:

```powershell
cd spidr-client/mobile
git rm -rf ios android
# revert package.json / app.json edits
git checkout -- package.json app.json
npm install
```

The `ios/`+`android/` dirs are gitignored in stock Expo projects but prebuild un-gitignores them. Removing them cleanly restores the Expo Go workflow.

---

## Decisions needed before starting

1. Are `ios/` + `android/` committed to git, or gitignored and rebuilt in CI? (Committed is standard for custom dev clients, but bloats the repo ~200MB. Gitignore + regenerate on CI is cleaner if we set up EAS.)
2. STUN/TURN: what does web use? Free Google STUN works for symmetric NATs, but for reliable joins we may need a TURN relay (Twilio, Coturn, or Cloudflare's new one). Confirm before Phase 1.
3. Ship Android-first (no Mac needed) or wait for iOS parity?

---

**When to pick this up**: after the next Spidr Beta phase ships and before opening TestFlight for the broader test group. Voice being a "can I actually talk to my friends" table-stakes feature makes it a good beta-visibility win.
