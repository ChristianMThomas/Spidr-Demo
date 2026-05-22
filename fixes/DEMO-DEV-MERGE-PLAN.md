# Merge Plan: Spidr-Demo-dev → spidr-app

## Context
A work partner delivered `Spidr-Demo-dev/` — a copy of the project with a full fix/feature pass (documented in their `CHANGES.md`). Some of those fixes are already in the main branch (previous PRs merged: fix-vc, fix-cost-optimization, etc.). This merge brings in only what is genuinely new.

**Source:** `spidr-app/Spidr-Demo-dev/`  
**Target:** `spidr-app/`  
**Recommended branch:** `fix-ui-vc` (or new branch `merge/demo-dev-features`)

---

## Discovery Summary

Total files in Demo-dev: ~350 (excluding node_modules, dist, target)
- **62 files differ only in line endings** (Demo = LF, Main = CRLF). Content is byte-identical. → **No action** (do NOT import LF files and break Windows line endings).
- **3 files are NEW** (exist only in Demo-dev) → **Add**.
- **22 files have genuine content differences** (Demo has more code) → **Overwrite with Demo version** (Demo is superset in every case).
- **1 file is a genuine conflict** → **Manual merge** (SpidrShell.jsx).
- **~96 files exist only in main** (spidr-landing, .env files, CLAUDE.md, .claude configs, PR notes) → **Leave untouched**.

---

## Files to Add (NEW): 3

| File | What it does |
|------|--------------|
| `spidr-client/src/components/feed/WebUserResults.jsx` | User search for THE WEB feed — lists matching profiles with a "Link" (friend) button |
| `spidr-client/src/components/spidr/UserStatusChip.jsx` | Redesigned top-right profile control — animated audio-reactive ring, status dots (online/idle/dnd/invisible), mic/deafen toggles, replaces the inline avatar button |
| `spidr-client/src/components/spidr/VoiceRecorder.jsx` | Records short audio clips via MediaRecorder, uploads them as voice message attachments |

---

## Files Unchanged (CRLF-only diff): 62

Content is identical; they differ only because Demo uses LF and main uses CRLF. Representative list:
- All spidr-server models, routes, socket handlers, utils
- `App.jsx`, `pages.config.js`, all pages except Radar
- `handlers.js`, `voiceSignaling.js`, `index.js`, `middleware/auth.js`
- All shadcn/ui components, landing components, most spidr components
- `AuthController.java`, `package-lock.json`

→ **No file will be touched for this group.**

---

## Files with Genuine Content Differences (SUPERSET): 22

All 22 cases: Demo adds new code; nothing is removed from the main version's logic. Safe to overwrite. **Take a backup before each overwrite.**

### Documentation
1. **`CHANGES.md`** — +161 lines of partner's fix documentation added to the top.

### Backend
2. **`spidr-server/src/routes/biomass.js`** — Adds `POST /biomass/fly` endpoint (rewards 10 biomass per fly caught, 200/day cap, transaction recorded as "Caught a fly").

### Frontend — Core / Shared
3. **`spidr-client/src/api/apiClient.js`** — +1 line: adds `catchFly: () => api.post('/biomass/fly', {})` to the biomass entity.
4. **`spidr-client/src/lib/utils.js`** — +11 lines: adds `dmConversationId(a, b)` utility (canonical sorted-id DM conversation key).
5. **`spidr-client/src/context/AppShellContext.jsx`** — +41 lines: adds `refreshCurrentUser()` (re-fetches user+profile and merges) + `spidr-profile-updated` window event listener so any surface that edits a profile can broadcast the update to the shell.
6. **`spidr-client/src/index.css`** — +32 lines: new CSS keyframe animations (spinning ring for `UserStatusChip`, additional username effect polish).

### Frontend — UI Primitives
7. **`spidr-client/src/components/ui/SpidrMenu.jsx`** — +20 lines: adds `web_post` and `web_comment` menu types (Copy Link, Sling to DMs, Save Clip, Report Post, Delete Comment) for THE WEB feed right-click contexts.

### Frontend — Voice / WebRTC
8. **`spidr-client/src/components/spidr/useWebRTC.js`** — +88 lines: adds per-user volume control (`remoteVolumes` map, `setUserVolume`, socket-id → user-id mapping) and a `vlog` debug helper.
9. **`spidr-client/src/components/spidr/VoiceChannel.jsx`** — +73 lines: exposes per-user volume sliders in the voice roster UI; wires up `setUserVolume` from `useWebRTC`.
10. **`spidr-client/src/components/spidr/CallOverlay.jsx`** — +28 lines: volume control additions to the full-screen call overlay.

### Frontend — Chat / Messaging
11. **`spidr-client/src/components/spidr/ServersPanel.jsx`** — +68 lines: biomass import + new UI features in the server channel panel.
12. **`spidr-client/src/components/spidr/RichComments.jsx`** — +59 lines: richer comment rendering.
13. **`spidr-client/src/components/spidr/MessageItem.jsx`** — +30 lines: message rendering enhancements.
14. **`spidr-client/src/components/spidr/MessageInputBar.jsx`** — +7 lines: minor input bar additions.

### Frontend — Feed / Media
15. **`spidr-client/src/components/feed/ClipFeed.jsx`** — +31 lines: clip feed improvements.
16. **`spidr-client/src/components/spidr/AIPanel.jsx`** — +44 lines: AI panel feature additions.
17. **`spidr-client/src/components/spidr/FeedPanel.jsx`** — +6 lines: minor feed panel additions.
18. **`spidr-client/src/components/spidr/ShareWeb.jsx`** — +4 lines: minor share additions.

### Frontend — Overlays / Profile
19. **`spidr-client/src/components/spidr/GlobalGhostOverlay.jsx`** — +23 lines: Spidr Protocol overlay enhancements.
20. **`spidr-client/src/components/spidr/GhostOverlay.jsx`** — +9 lines: ghost overlay additions.
21. **`spidr-client/src/components/spidr/HolographicProfile.jsx`** — +8 lines: profile modal additions.
22. **`spidr-client/src/components/spidr/SettingsPanel.jsx`** — +6 lines: settings panel additions.

---

## File with Conflict: 1

### `spidr-client/src/components/SpidrShell.jsx`

**Difference (plain language):**
- **Demo version:** Removes `FloatingDock` from the shell. Replaces the inline avatar button with `UserStatusChip` (the new component above). Adds `sidebarSide` state (left/right configurable) with `localStorage` persistence and `spidr-sidebar-side` event listener — the sidebar can be moved to the right edge from Settings.
- **Main version:** Renders `FloatingDock` in a desktop-only `hidden md:block` wrapper. Uses an inline motion-avatar button with hover-shrink animation. Sidebar always left-anchored.

**Proposed action: Take Demo version (replace main).**

**Reason:** The Demo version was designed to work with `UserStatusChip` (new component we're adding). The `UserStatusChip` replaces the inline avatar button as the proper component for that role. The configurable sidebar docking is a genuine UX improvement. The `FloatingDock` component is NOT deleted — it still exists in `FloatingDock.jsx` — it's simply not rendered in the shell by default in this version and can be re-added later if desired.

---

## Files Only in Main (will NOT be touched): 96

- Entire `spidr-landing/` sub-project
- `CLAUDE.md`, `.claude/` configs, `.vscode/`
- `spidr-auth/.env`, `spidr-server/.env`, `spidr-client/.env.development`, `spidr-client/.env.production`
- All `pr/` PR notes
- `spidr-auth/HELP.md`, `spidr-auth/src/main/resources/application.properties`

---

## Execution Steps (when ready to implement)

### Step 1 — Backup
Create `.merge-backup/20260522-XXXXXX/` containing current copies of all 23 files about to be overwritten (22 superset files + SpidrShell.jsx).

### Step 2 — Add 3 new files
Copy from `Spidr-Demo-dev/` (these don't exist in main, no backup needed):
- `spidr-client/src/components/feed/WebUserResults.jsx`
- `spidr-client/src/components/spidr/UserStatusChip.jsx`
- `spidr-client/src/components/spidr/VoiceRecorder.jsx`

### Step 3 — Overwrite 22 superset files
Copy each file from `Spidr-Demo-dev/<path>` → `<path>` in main. Preserve CRLF line endings (convert LF→CRLF if needed, or let git's `.gitattributes` handle normalization on checkout).

### Step 4 — Resolve SpidrShell conflict
Overwrite `spidr-client/src/components/SpidrShell.jsx` with the Demo version (uses `UserStatusChip`).

### Step 5 — Skip 62 CRLF-only files
Do not touch them. Content is identical; changing line endings would create unnecessary git noise.

### Step 6 — Skip all main-only files
Do not touch `spidr-landing/`, `.env` files, `CLAUDE.md`, PR notes, `.claude/` config.

---

## Verification Checklist

After the merge executes, test these in order:

- [ ] `npm run dev` in `spidr-client/` — app launches without console errors
- [ ] Sidebar renders, `UserStatusChip` appears top-right (not the old inline avatar button)
- [ ] Navigate to `/servers/:id` — `ServersPanel` renders correctly
- [ ] Join a voice channel — `VoiceChannel` renders with per-user volume sliders
- [ ] Open THE WEB feed — right-click a post, confirm `web_post` menu items appear (Copy Link, Sling to DMs, Save Clip, Report)
- [ ] Edit your profile — `UserStatusChip` updates in real-time (tests `refreshCurrentUser` / `spidr-profile-updated`)
- [ ] `POST /biomass/fly` endpoint is reachable (or note it connects to the FlyHunt game feature)
- [ ] Voice messages: mic button in `MessageInputBar` works, shows `VoiceRecorder` UI
- [ ] THE WEB user search shows `WebUserResults` with "Link" button
