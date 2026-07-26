# Handoff

## Goal
Give the Spidr desktop (Electron) app an in-app update mechanism so users can pull new versions without a full re-install and without Windows Store, using electron-updater against GitHub Releases.

## Current State
Fully wired end-to-end on the code side, not yet exercised against a real release. Version in `spidr-client/package.json` is now `1.9.55` (matches current SPIDR_SYS patch). `build.publish` points at the `ChristianMThomas/Spidr-Demo` GitHub Releases feed. `electron-updater` is installed and registered in `electron/main.js` (packaged builds only). An Electron-only **About** tab in Settings hosts the new `UpdatesCard` with Check → Download → Restart flow. No release has been cut yet, so the flow has not been end-to-end validated in a packaged .exe.

## Files
- `spidr-client/package.json` — version 1.0.0 → 1.9.55; added `electron-updater ^6.8.9`; replaced `"publish": null` with GitHub provider block
- `spidr-client/package-lock.json` — regenerated for the new dep
- `spidr-client/electron/main.js` — `setupAutoUpdater()` (lazy require, packaged-only) + IPC: `updater:check`, `updater:download`, `updater:quit-install`, broadcast `updater:status`
- `spidr-client/electron/preload.js` — exposed `checkForUpdates` / `downloadUpdate` / `quitAndInstall` / `onUpdateStatus` on `window.electronAPI`
- `spidr-client/src/components/spidr/SettingsPanel.jsx` — new Electron-only **About** tab (Download icon), mounts `UpdatesCard`
- `spidr-client/src/components/spidr/UpdatesCard.jsx` — new component: current version, phase-driven UI (checking / available / downloading with %, / downloaded / error), action buttons

## Changes
- Bumped desktop app version to `1.9.55` so electron-updater semver compare has a real baseline
- Added `electron-updater ^6.8.9` and configured GitHub Releases as the update feed in `build.publish`
- Wired auto-updater in Electron main process, gated on `app.isPackaged`, with lazy `require()` so dev boot doesn't break if the dep is missing
- Added preload bridge exposing check/download/quitAndInstall + a status subscription
- Added `UpdatesCard` React component with progress bar and per-phase messaging
- Added Electron-only **About** tab to `SettingsPanel` hosting the card

## Failed
None. `npm install electron-updater` completed clean (exit 0); no compile or runtime errors observed. Not yet packaged to a `.exe` for real-world verification.

## Next Step
Cut a test release: bump version to `1.9.56`, run `npm run build-exe` in `spidr-client/`, then create GitHub Release `v1.9.56` on `ChristianMThomas/Spidr-Demo` and upload both `SpidrSetup-1.9.56.exe` and `latest.yml` from `dist_installer/`. Install the current `1.9.55` build first, open Settings → About, and confirm the Check → Download → Restart flow works end-to-end.

## To Do Later
- **Auto-upload to GitHub on build**: set a `GH_TOKEN` env var and change `--publish=never` → `--publish=always` in the `build-exe` script in `spidr-client/package.json`. Right now `latest.yml` + the installer are generated locally and must be uploaded to the Release by hand.
- Portable target (`Spidr-*-portable.exe`) does not self-update — only the NSIS installer does. Consider dropping the portable target or documenting the manual-download path for those users.
- Unsigned Windows builds re-trigger SmartScreen on every update. Eventual fix is a code-signing cert.
