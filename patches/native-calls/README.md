# Native Calls — shelved implementation (2026-07-06)

Complete "real phone call" stack (WebRTC audio/video + CallKit/ConnectionService
lock-screen ringing + FCM push) that was built and then deliberately backed out
of the working tree so Patch 1.9.x mobile development can continue in Expo Go
without the dev-client roadblock. Everything here typechecked clean and
`expo config --type prebuild` validated before removal.

## Re-apply checklist

### 1. Copy files back (paths mirror the repo)
- `spidr-server/src/models/PushToken.js`
- `spidr-server/src/routes/pushTokens.js`
- `spidr-server/src/utils/push.js`
- `mobile/lib/nativeCalls.ts`        → `spidr-client/mobile/lib/`
- `mobile/lib/callManager.ts`        → `spidr-client/mobile/lib/`
- `mobile/index.js`                  → `spidr-client/mobile/` (custom entry w/ FCM background handler)
- `mobile/app/call/[id].tsx`         → `spidr-client/mobile/app/call/`
  **⚠ missing from this patch folder** — the in-call screen was never stashed
  here; it needs to be rebuilt on re-apply (render `callManager` state +
  remote streams, buttons for `toggleMute` / `toggleSpeaker` / `toggleCamera` / `end`).
- `mobile/components/call/IncomingCallModal.callmanager.tsx`
                                     → replaces `spidr-client/mobile/components/call/IncomingCallModal.tsx`
- `mobile/app.with-call-plugins.json` → shows the app.json ios/android/plugins blocks to restore

### 2. Dependencies
```
cd spidr-server        && npm i firebase-admin
cd spidr-client/mobile && npm i react-native-webrtc @config-plugins/react-native-webrtc react-native-callkeep @config-plugins/react-native-callkeep @react-native-firebase/app @react-native-firebase/messaging react-native-incall-manager
```

### 3. Small edits to redo
- `spidr-server/src/index.js`: mount `app.use('/push-tokens', require('./routes/pushTokens'));`
- `spidr-server/src/socket/handlers.js`, DM call signaling block: require
  `{ sendCallPush, sendCallEndPush }` from `../utils/push`; pass `kind` through
  `call:invite` → `call:incoming`; fire `sendCallPush` on invite and
  `sendCallEndPush` on accept (to the acceptor, reason `answered`), decline, cancel.
- `spidr-client/mobile/package.json`: `"main": "./index.js"`
- `spidr-client/mobile/app/dm/[id].tsx`: import `callManager`; in
  `OutgoingCallModal.onAccepted` call `callManager.startOutgoing({conversationId, peer, kind})`
  and on success `router.push('/call/[id]', { id, peerId, peerName, peerAvatar, kind })`.
- `spidr-client/mobile/lib/authContext.tsx` logout: `callManager.unregisterToken()` before `auth.logout()`.

### 4. External prerequisites (the actual blockers)
1. Firebase project → Android app `com.infinitetechteam.spidr` → `google-services.json`
   into `spidr-client/mobile/` (app.json references it).
2. Firebase service-account key → base64 → `FIREBASE_SERVICE_ACCOUNT` env on Railway
   (spidr-server). Push is a silent no-op until set.
3. EAS dev build (`eas build --profile development`) — Expo Go cannot load
   webrtc/callkeep. All native access is guarded via `lib/nativeCalls.ts`, so
   Expo Go keeps working with graceful fallbacks either way.
4. iOS lock-screen ringing additionally needs a paid Apple Developer account
   (PushKit VoIP) — code is structured for it but dormant.

## Design notes
- `callManager.joinMedia` reads Settings → Voice & Video prefs from
  `spidr-client/mobile/lib/avPrefs.ts` (already in the working tree): mic
  constraints (noise suppression / echo cancellation), join-muted,
  camera-off-on-join, and speakerphone default all apply at media join.
- Media joins the SAME mesh as web DM calls: room `voice:server:dm:<conversationId>`,
  signaling relayed over `voice:signal`, ICE from `GET /voice/ice` → mobile↔web interop.
- Ring is delivered via socket AND push; `callManager` dedupes by conversationId (30s).
- CallKeep call UUIDs are derived deterministically from the conversationId so the
  headless background handler and the JS side address the same native call.
- Killed-app answers: background handler stashes `spidr_pending_call` in AsyncStorage;
  `callManager.consumePendingBackgroundRing()` connects it on launch.
