# Electron Auto-Update via GitHub Releases

How to publish desktop app updates so installed Spidr clients update themselves instead of forcing users to re-download the installer.

**Audience:** Anyone shipping a new desktop build — Chris, FiFi, or a future contributor. Assumes you can run `npm` commands and use a browser. No prior electron-builder experience required.

---

## The Big Picture

```
   You (dev laptop)                GitHub                 User's installed Spidr
   ─────────────────               ──────                 ──────────────────────
   npm run publish-exe   ──►   Release v1.9.57    ◄──   electron-updater checks
   (builds + uploads)          + SpidrSetup.exe          latest.yml every launch
                               + latest.yml              downloads new .exe silently
                                                         prompts user to restart
```

Three moving pieces need to line up:

1. **`package.json` version** — the "current" version electron-updater compares against.
2. **GitHub Release tag** — must match `v<version>` (e.g. `v1.9.57`).
3. **`latest.yml`** — the manifest electron-builder auto-generates and uploads. If this file isn't in the release assets, **no client ever sees the update**. This is the #1 thing that goes wrong.

---

## One-Time Setup (do this once, per person)

### 1. Generate a GitHub Personal Access Token

`electron-builder` needs permission to create releases on your behalf.

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it something like `spidr-electron-publish`
4. Expiration: 90 days is fine (you'll rotate)
5. Scopes:
   - If `Spidr-Demo` is **public** → check `public_repo`
   - If `Spidr-Demo` is **private** → check the full `repo` scope
6. Click **"Generate token"** at the bottom
7. **Copy the token immediately** — GitHub only shows it once. It starts with `ghp_`.

### 2. Store the token so PowerShell can find it

You have two options.

**Option A — Set it per-session** (safest, but you retype it each time you publish):
```powershell
$env:GH_TOKEN = "ghp_yourTokenHere"
```
This lasts only for the current terminal window.

**Option B — Save it permanently** for your Windows user:
```powershell
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_yourTokenHere', 'User')
```
Close and reopen your terminal after running this. The token is now saved and every new PowerShell session will pick it up.

**Never commit this token to git.** It has permission to create releases on your account.

### 3. Verify the publish config in `package.json`

Already set — you shouldn't need to touch this, but confirm it points at the right repo:

```json
"publish": [
  {
    "provider": "github",
    "owner": "ChristianMThomas",
    "repo": "Spidr-Demo",
    "releaseType": "release"
  }
]
```

If you ever move release artifacts to a dedicated public repo (see "Gotchas" below), change `repo` here.

---

## Per-Release Workflow (do this every time you ship)

### 1. Bump the version in `spidr-client/package.json`

Only one field matters:

```json
"version": "1.9.57"
```

`electron-updater` reads this to know "what am I currently?" and compares it to whatever GitHub says the latest release is. If they match, no update happens. If GitHub's version is higher, the update flow triggers.

**Rule of thumb:** patch bump for bug fixes (1.9.56 → 1.9.57), minor for features (1.9 → 1.10), major only for breaking changes (1 → 2).

### 2. Log the patch note

Run `/patch` (the slash command). It updates both `NEWS` in `spidr-server/src/routes/system.js` and `MOCK_NEWS` in `spidr-client/src/components/spidr/SpidrSystem.jsx`. Do not hand-edit these files — they must stay byte-identical.

### 3. Make sure your `GH_TOKEN` is set

```powershell
echo $env:GH_TOKEN
```
Should print `ghp_...`. If it's blank, do step 2 of "One-Time Setup" above.

### 4. Build and publish

From `spidr-client/`:

```powershell
npm run publish-exe
```

This will:
- Run `vite build` (compiles the React app to `dist/`)
- Run `electron-builder --publish=always` (packages the `.exe` and uploads to GitHub)
- Take **3–8 minutes** — the upload step is the slow part

Watch the terminal for a line like:
```
• publishing publisher=Github (owner=ChristianMThomas, repo=Spidr-Demo, version=1.9.57)
• uploading file=SpidrSetup-1.9.57.exe
• uploading file=latest.yml
```

If you see `latest.yml` upload successfully, you're good. If you don't, **stop and fix it before proceeding** — without `latest.yml`, no user will get the update.

### 5. Publish the draft on GitHub

`electron-builder` creates the release as a **draft**. It won't be visible to installed apps until you publish it manually.

1. Go to https://github.com/ChristianMThomas/Spidr-Demo/releases
2. You'll see a draft release at the top labeled `v1.9.57`
3. Click into it, scroll to the bottom, click **"Publish release"**

Once published, installed Spidr clients will see it on their next launch (or within ~10 minutes if already running, depending on the check interval in `electron/main.js`).

### 6. Commit and push the version bump

```powershell
git add spidr-client/package.json
git commit -m "Bump desktop client to 1.9.57"
git push
```

Or just use `/ship` for the full pipeline (security audit + patch note + push).

---

## Testing the Update Flow

The only real way to test is to install an **older** version, then publish a **newer** one, and watch the older install update itself.

### First-time test

1. Build v1.9.56 → publish to GitHub
2. Install `SpidrSetup-1.9.56.exe` on your machine (or a VM, or FiFi's machine)
3. Bump to v1.9.57, publish
4. Launch the installed v1.9.56 app
5. Within ~1 minute, the `UpdatesCard` on the home page (`spidr-client/src/components/spidr/UpdatesCard.jsx`) should show "Update available"
6. It downloads in the background, then prompts "Restart to install"

### If nothing happens

Open DevTools in the installed app (Ctrl+Shift+I) and check the console. `electron-updater` logs to the main process, so you may also need to look at the log file:
- Windows: `%APPDATA%\Spidr\logs\main.log`
- Mac: `~/Library/Logs/Spidr/main.log`
- Linux: `~/.config/Spidr/logs/main.log`

Common causes:
- `package.json` version wasn't bumped (installed version == GitHub version → no update)
- The release is still a draft (not published on GitHub)
- `latest.yml` is missing from the release assets
- The repo is private and users don't have access

---

## Gotchas

### `latest.yml` is the whole game
If this file isn't in your release, updates don't work. Period. Always verify it uploaded. If you accidentally deleted it from a published release, either re-upload it manually or re-run `npm run publish-exe` with the same version (electron-builder will re-upload).

### Private repo means no updates for end users
If `Spidr-Demo` stays private, installed apps can't fetch the update feed anonymously. Two options:
- **Make the repo public** (simplest)
- **Create a dedicated public repo** like `spidr-releases`, change `publish.repo` in `package.json` to point at it, and only publish binaries there. Source stays private.

### Unsigned builds trigger SmartScreen warnings
The build command intentionally clears code-signing (`CSC_LINK=`). Updates still work, but Windows shows "Unknown publisher" every time. To fix long-term, buy a code-signing certificate (~$100–400/yr) and set `CSC_LINK` + `CSC_KEY_PASSWORD` to the cert path and password.

### macOS auto-update needs signing + notarization
Windows updates work unsigned. macOS updates **do not** — Gatekeeper blocks unsigned `.dmg` files from auto-updating. If we ever ship a real Mac build, we'll need an Apple Developer account ($99/yr) and notarization set up.

### Never re-use a version number
Once v1.9.57 is published, don't republish v1.9.57 with different content. `electron-updater` caches by version — users who already downloaded won't re-download, and users who haven't will get whichever build GitHub currently serves. Always bump.

### Version in `package.json` vs. patch note
These are separate. Bumping to 1.9.57 in `package.json` doesn't automatically add a patch note. Run `/patch` for the note, edit `package.json` for the version. Keep them in sync manually.

---

## Quick Reference

| Task | Command |
|---|---|
| Set token (session) | `$env:GH_TOKEN = "ghp_..."` |
| Set token (permanent) | `[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'ghp_...', 'User')` |
| Build + publish | `npm run publish-exe` (from `spidr-client/`) |
| View releases | https://github.com/ChristianMThomas/Spidr-Demo/releases |
| Update logs (Windows) | `%APPDATA%\Spidr\logs\main.log` |

## Files Involved

- `spidr-client/package.json` — version + publish config + build scripts
- `spidr-client/electron/main.js` — where `autoUpdater` is called
- `spidr-client/electron/preload.js` — exposes update events to the renderer
- `spidr-client/src/components/spidr/UpdatesCard.jsx` — the UI that shows update state
