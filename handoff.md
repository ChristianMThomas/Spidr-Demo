# Handoff

## Goal
Get Spidr Mobile submission-ready for App Store + Google Play. This session closed the remaining Apple 1.2 / 5.1.1(v) / Play sensitive-permission engineering blockers.

## Current State
Branch `patch-1.9_Mobile` — all engineering blockers in `COMPLIANCE.md §1` are now DONE except the moderation queue / takedown docs. Server has real account-delete + deactivate with R2 blob purge; mobile has real report + block in DMs and on feed clips; expo-location is removed from mobile entirely (widget falls back to server-set coords). Nothing device-tested yet. Remaining ship gate is store-paperwork (Apple/Play accounts, EAS build, screenshots) and a moderation surface — not code fixes.

## Files
- COMPLIANCE.md — rewritten; §1 items now checkmarked, moderation queue called out as sole engineering blocker
- spidr-server/src/utils/azureStorage.js — new `deleteFile(publicUrl)` best-effort R2/local purge
- spidr-server/src/routes/users.js — DELETE /users/me now collects avatar/banner/clip URLs before cascade and fires `deleteFile` fanout post-response
- spidr-client/mobile/components/profile/ModuleWidget.tsx — removed `expo-location` import + auto-prompt useEffect; weather widget shows "SET LOCATION FROM THE WEB APP TO ENABLE" fallback
- spidr-client/mobile/package.json — `expo-location` dep removed
- handoff.md — this file

## Changes
- Add `deleteFile(url)` to `azureStorage.js` — matches R2 public-URL prefix and issues DeleteObjectCommand; falls back to `/uploads/<key>` on local; swallows errors so callers never fail on storage cleanup
- Wire account-delete cascade: fetch UserProfile.{avatar_url,banner_url} + Clip.{video_url,thumbnail_url} before deletion, then `Promise.allSettled(deleteFile ...)` after `res.json()` — fire-and-forget so the mobile UI isn't blocked on R2
- Drop `expo-location` from mobile: removed import, `requestForegroundPermissionsAsync` useEffect, and package.json dep — Play sensitive-permission surface is now zero on the mobile bundle
- Refresh COMPLIANCE.md to reality — many items previous handoffs listed as TODO were already shipped (DM report/block, feed clip report, Twitch "Coming Soon", delete UI, support contact); moderation queue is now the lone unchecked §1 item

## Failed
- **Moderation queue still missing** — reports write to `Report` collection but there's no admin surface (`/reports` is a bare `crudRouter(Report)` — GAPS #1 ownership hole, plus no admin UI). Apple 1.2 will still flag this.
- **Nothing device-tested** — delete cascade, R2 purge, patch-DM fanout, weather-widget no-location fallback all unexercised against Railway + a device
- Pre-existing untouched: `ClipCard.tsx(86,17)` TS7006 implicit any

## Next Step
Ship the moderation queue: add `authMW + role: 'admin'` gate to `spidr-server/src/routes/reports.js` (replace bare `crudRouter(Report)`), build a `spidr-client/src/pages/admin/Reports.jsx` list with status transitions (pending→reviewed→resolved/dismissed), and document the takedown SLA in a public URL. This is the last Apple 1.2 blocker before store submission is purely paperwork.
