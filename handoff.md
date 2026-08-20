# Handoff

## Goal
Get iOS push notifications working end-to-end on the Spidr mobile dev build — a locked/backgrounded phone must show a banner when a DM or call arrives. Secondary: mobile/web parity fixes shipped alongside (missed-call labels, home-tab panels, mobile-web layout).

## Current State
**Push is blocked at one specific point:** `@react-native-firebase/messaging` returns falsy from `getMessaging()` at boot in the *new* iOS dev build, so no FCM token is ever minted and no device is registered server-side. Everything downstream of that is already built and believed correct (permission flow, token registration route, broker gating, hybrid alert payload). Notably `expo-notifications` **does** load natively in the new build (the OS permission dialog appears and returns `granted`), which proves the build is current and is *not* Expo Go — yet messaging still fails, and `safeRequire` did not log a throw, meaning the require resolves but yields no usable `.default`. Diagnostic logging was just added and the logs have not been captured yet.

Everything else from this session is committed and working as far as static checks go (mobile `tsc --noEmit` clean, web `npm run build` passes). None of the mobile UI work has been visually verified on a device.

## Files
Uncommitted (this session's tail end):
- spidr-client/mobile/components/spidr/SpidrWebMatrix.tsx   — NEW: mobile Jump Back In / Pinned panel
- spidr-client/mobile/app/(tabs)/index.tsx                  — mounts SpidrWebMatrix + RecentServers; ActivityFeed collapsible
- spidr-client/mobile/lib/nativeCalls.ts                    — logs why/what a native require returns (push debugging)
- spidr-client/mobile/lib/callManager.ts                    — boot-time native module inventory log
- spidr-client/mobile/app.json                              — icon/splash config (user's own edit, unrelated to push)

Committed in Patch 1.9.63 (e89ce21): missed-call label fixes, notification opt-in flow, expo-notifications wiring, web pinned-tab + layout fixes, send-test-push.js.

## Changes
- Resolve missed-call names server-side in `writeMissedCall` (mobile never sent `callerName`, so every phone-written row said "Someone"); persist `group_name` on GroupChatMessage.
- Label missed calls per viewer: DM caller sees "X didn't answer", callee "You missed a call from X"; group caller sees "You tried calling <group>", members "<caller> called <group>". Rendered on web MessageItem + new mobile MessageBubble system row.
- Guard against bogus missed-call rows: server ignores `call:cancel` for answered calls; both clients only emit cancel while the no-answer timer is pending.
- Add group no-answer timer to web KineticChat so group missed-call rows are actually reachable.
- Fix mobile group pictures — mobile read only legacy `icon_url`, web writes `avatar_url`.
- Web home Pinned tab: live avatars/names instead of stale pin snapshots; drop dicebear placeholder; rename tab "Spidr Web" → "Pinned".
- Release the 900px `min-width` floor below 900px (globals.css + Layout.jsx) — the DM header's search/hamburger were laid out off-screen and unreachable on phones.
- Enlarge DM header hamburger to a full-height 44px target.
- Mobile notifications now default OFF; first flip of the switch requests OS permission via `callManager.ensurePushPermission()`, with an Open Settings alert when blocked; persist opt-out defaults so the server's "no prefs = push everything" fallback can't contradict the UI.
- Add `expo-notifications` as an Expo Go permission fallback (prompt only — no FCM token there).
- Add `spidr-server/scripts/send-test-push.js` — sends through firebase-admin directly and prints per-token APNs/FCM errors with hints.
- Port web's Jump Back In / Pinned panel and Recent Servers to the mobile home tab; make ActivityFeed collapsible.

## Failed
- Testing push in Expo Go — dead end. No Firebase messaging module there, and SDK 53+ removed `expo-notifications`' PushTokenManager native module too (crash: `requireNativeModule` in `PushTokenManager.native.js`).
- Dev build from commit `e1424b6` (built 8/19 1:37 PM) — stale; predated `expo-notifications`, so its native module was absent.
- **Current unknown:** new dev build loads `expo-notifications` natively but still logs `messaging module loaded: false`, and `safeRequire` logged no exception. Cause not yet identified — either RNFB is absent from the binary (pod install / `plugins/withRnFirebaseDisableSpm.js` suspect) or its JS loaded with `.default` undefined. Needs the new diagnostic logs to distinguish.
- Server-side push never exercised: `send-test-push.js` has not been run, so `FIREBASE_SERVICE_ACCOUNT` on Railway and the APNs `.p8` upload in Firebase are both still unverified.

## Next Step
Reload the dev build (`r` in Metro) and capture the two new boot lines — `[callManager] native modules — webrtc: … messaging: …` and `[nativeCalls] @react-native-firebase/messaging loaded — keys: … | typeof default: …` — to determine whether RNFB is missing from the iOS binary (rebuild / Podfile plugin) or loaded with a broken export shape.
