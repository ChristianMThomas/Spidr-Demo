# COMPLIANCE.md — Outstanding Work for App Store + Google Play Submission

Audit date: 2026-07 (Apple Review Guidelines + Play target-SDK fetched live).
Scope: `spidr-client/mobile` (Expo SDK 54). Items already compliant (first-party auth, no ads/tracking SDKs, no in-app purchase surface, URL allowlisting, block model on Friends tab) are omitted.

## 1. Engineering

- [x] **Account deletion** (Apple 5.1.1(v); Play account-deletion policy) — server `DELETE /users/me` cascades UserProfile/Friend/Clip/Follow/InstalledModule/BiomassWallet, anonymizes DirectMessage/Message/GroupChatMessage authorship as "Deleted User", and fires best-effort R2 blob purge via `azureStorage.deleteFile()` for avatar/banner/clip video/thumbnail URLs. Reversible deactivate at `POST /users/me/deactivate`. Mobile UI: `settings/security.tsx` DeleteAccountModal (type-to-confirm) + Deactivate button. Public deletion page: `spidr-client/src/pages/Legal.jsx` (Play data-safety URL).
- [x] **Real report + block in DMs** (Apple 1.2) — `spidr-client/mobile/app/dm/[id].tsx:714-770` writes real `entities.Report.create` and flips the `Friend` row to `blocked`.
- [x] **Report option on THE WEB feed clips** (Apple 1.2; Play UGC) — `spidr-client/mobile/components/feed/ClipCard.tsx` MoreSheet posts a real Report with `target_type: 'clip'`.
- [x] **Steam/Twitch fake toggles** — Steam is a real SteamID64→Steam-API check; Twitch is an inert `ComingSoonCard` (`spidr-client/mobile/app/settings/connections.tsx`).
- [x] **expo-location** — removed from `components/profile/ModuleWidget.tsx` and `package.json`. Weather widget now shows "SET LOCATION FROM THE WEB APP TO ENABLE" if no `weather_coords` are pre-saved; no location permission is ever requested on mobile.
- [x] **Support contact in About** — `settings/about.tsx:87` opens `mailto:christhomas0634@gmail.com`.
- [x] **Moderation queue + takedown docs** (Apple 1.2) — `spidr-server/src/routes/reports.js` rewritten as an admin-gated router: authenticated users can POST a report (reporter_id forced server-side), only `role: 'admin'` can list/read/patch/delete. Admin UI already exists at `spidr-client/src/pages/GlobalReports.jsx` (`/global-reports`) with status transitions pending→reviewed→resolved/dismissed and reviewer_id stamping. Public takedown SLA + escalation path documented in `spidr-client/src/pages/Legal.jsx` §5 (24h ack, 72h action on objectionable content).

## 2. App config & assets

- [ ] `app.json`: app **icon**, Android **adaptiveIcon**, splash image, `ios.buildNumber`, `android.versionCode`.
- [ ] `app.json` → `ios.infoPlist`: specific purpose strings — `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`. (Location string no longer needed.)
- [ ] **EAS build setup**: `eas.json`, EAS project ID. Play requires an **.aab** with Play App Signing; App Store requires a real archive — the app has only ever run in Expo Go. Build with current SDK 54 (targets API ≥35 ✔).
- [ ] Screenshots per required device size (real UI, not marketing), feature graphic (Play).

## 3. Legal & content

- [x] **Public Terms / Privacy / Data Deletion page** — `spidr-client/src/pages/Legal.jsx` mounted in `App.jsx`; ready to host on Hostinger.
- [ ] **Support email published in both store listings.**

## 4. Accounts & paperwork

- [ ] **Apple Developer Program** ($99/yr) — not yet purchased (also blocks native-calls work).
- [ ] **Google Play Developer account** ($25) — expect identity verification; new personal accounts may need a 12-tester closed-testing period before production.
- [ ] Apple: App Privacy "nutrition labels", age rating questionnaire (UGC chat + video ⇒ expect 17+), **demo account credentials in App Review notes** (app is login-walled).
- [ ] Play: Data safety form (account info, messages, photos/videos, app activity/telemetry), IARC content rating.

## Lower priority (warnings, not blockers)

- Giphy GIFs are hotlinked without SDK/attribution (`components/chat/EmojiGifPicker.tsx`) — use Giphy/Tenor SDK properly or self-host licensed assets.
- Never add an APEX purchase path or "upgrade on our website" link to the mobile binary (Apple 3.1.1); web APEX billing is simulated (GAPS #2) — no listing text implying paid tiers.
- If Google/Facebook login is ever added, "Sign in with Apple" becomes mandatory (Apple 4.8).
- R2 blob cleanup on account-delete is best-effort and non-blocking — a periodic orphan-object sweep is still nice-to-have.
