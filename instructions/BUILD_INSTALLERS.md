# Building Spidr Installers

Spidr ships as native installers on **macOS**, **Windows**, and **Linux**.
This document covers every distribution path — the recommended one (GitHub
Actions CI), local per-OS builds, and the caveats around code signing.

---

## Quick Start — GitHub Actions (recommended)

The repo ships with `.github/workflows/build-installers.yml` which builds
all three platforms on their native runners (macOS on `macos-latest`,
Windows on `windows-latest`, Linux on `ubuntu-latest`).

### One-time repo setup

1. Push the repo to GitHub.
2. **(Optional but recommended)** In *Settings → Secrets and variables → Actions*, add:
   - `VITE_API_URL` — your production API URL (e.g. `https://api.spidr.example.com`)
   - `VITE_WS_URL` — same URL (Socket.io shares the origin)
   - `VITE_AUTH_URL` — your auth service URL

   Without these, the workflow falls back to whatever is in `spidr-client/.env.production`.

### Trigger a build

**Option A — Tag release (recommended for users):**
```bash
git tag v1.0.0
git push --tags
```

The workflow runs, builds every OS, AND creates a GitHub Release with
downloadable `.exe`, `.dmg`, and `.AppImage` files attached. Share the
release URL — that's your download page.

**Option B — Manual dispatch (for internal testing):**
Go to *Actions → Build Installers → Run workflow*. Artifacts are attached
to the workflow run (no Release created).

### What you get

- `Spidr-1.0.0-win-x64.exe` — Windows NSIS installer (change install dir, start menu, desktop shortcut)
- `Spidr-1.0.0-win-x64-portable.exe` — Windows portable (no install)
- `Spidr-1.0.0-mac-x64.dmg` — macOS Intel
- `Spidr-1.0.0-mac-arm64.dmg` — macOS Apple Silicon
- `Spidr-1.0.0-linux-x64.AppImage` — Linux universal binary
- `Spidr-1.0.0-linux-x64.deb` — Debian/Ubuntu package

---

## Local Builds

Only build for the OS you're on. **You cannot cross-build to macOS from
Linux/Windows** — Apple's toolchain (`hdiutil`, code signing) requires macOS.

### Prerequisites (all platforms)

- Node.js 20+
- `spidr-client/.env.production` must exist with your production URLs.
  Copy `.env.production.template` and fill it in.

### macOS

```bash
cd spidr-client
npm ci
npm run electron:pack:mac    # produces .dmg + .zip for both x64 and arm64
open dist_installer/Spidr-*.dmg
```

Output in `spidr-client/dist_installer/`. Unsigned builds work for
distribution to trusted users; macOS Gatekeeper will require the user to
right-click → Open the first time. For signed public distribution see the
*Code Signing* section below.

### Windows

```bash
cd spidr-client
npm ci
npm run electron:pack:win    # produces .exe installer + portable .exe
```

Unsigned builds will trigger Windows SmartScreen ("Windows protected your
PC"). Users click *More info → Run anyway*. See *Code Signing* below for
a paid cert setup that eliminates this.

### Linux

```bash
cd spidr-client
npm ci
npm run electron:pack:linux  # produces .AppImage + .deb
chmod +x dist_installer/Spidr-*.AppImage
./dist_installer/Spidr-*.AppImage
```

AppImage is universal — runs on every mainstream distro without install.
The `.deb` targets Debian/Ubuntu (`sudo apt install ./Spidr-*.deb`).

---

## Code Signing (optional but recommended for public releases)

### Windows

Windows SmartScreen will warn on any unsigned `.exe`. To sign:

1. Buy a code-signing certificate (DigiCert, Sectigo, etc. — ~$300/year).
2. Store the cert as a repo secret named `WIN_CSC_LINK` (base64-encoded `.pfx`) and password as `WIN_CSC_KEY_PASSWORD`.
3. Uncomment the signing block in `.github/workflows/build-installers.yml`.

Even signed, first-time downloads may still hit SmartScreen until Microsoft
builds reputation for the certificate. EV certs bypass this immediately but
cost more (~$500-700/year).

### macOS

macOS Gatekeeper blocks unsigned/unnotarized apps by default. To sign + notarize:

1. Apple Developer account ($99/year).
2. Create a *Developer ID Application* certificate in Xcode / developer.apple.com.
3. Export as `.p12`, base64-encode it, store as repo secret `MAC_CSC_LINK` (password as `MAC_CSC_KEY_PASSWORD`).
4. Generate an app-specific password on appleid.apple.com; store as `APPLE_ID_PASSWORD` (with `APPLE_ID` = your Apple ID email).
5. In `build-installers.yml`, remove `CSC_IDENTITY_AUTO_DISCOVERY: false` and add the notarization step.

---

## Auto-Update (future)

`electron-builder` supports `electron-updater` for in-app auto-updates via
GitHub Releases. To enable:

1. Set `"publish": { "provider": "github" }` in `package.json`'s `build`
   block (currently `null` for local-only builds).
2. Add `electron-updater` to dependencies:
   ```bash
   npm install electron-updater
   ```
3. In `electron/main.js`, after app-ready:
   ```js
   const { autoUpdater } = require('electron-updater');
   autoUpdater.checkForUpdatesAndNotify();
   ```

Users on installed builds will auto-download new versions the moment you
push a new tag.

---

## Troubleshooting

**Q: `.env.production` doesn't seem to be picked up.**
A: Vite reads it at build time. Verify by inspecting `spidr-client/dist/`
after `npm run build` — grep for your API URL:
```bash
grep -r "your-server" dist/
```
If it's not there, the env file was empty or misnamed.

**Q: macOS says "Spidr.app is damaged and can't be opened."**
A: Unsigned + downloaded via Safari triggers Gatekeeper quarantine. On the
target machine:
```bash
xattr -cr /Applications/Spidr.app
```
Then reopen. Signing eliminates this.

**Q: Windows SmartScreen refuses to run the installer.**
A: Click *More info → Run anyway*. Ships-with-cert distribution requires
the paid signing step above.

**Q: Linux AppImage won't launch.**
A: Chmod +x it first. Some distros require `libfuse2`:
```bash
sudo apt install libfuse2
```

**Q: Bundle is huge (~200MB).**
A: That's Electron + Chromium baseline. Optimizations don't move the
needle much — every Electron app ships this size.
