# Spidr Fix Pass — Summary

Each fix below lists the files touched and what changed in plain terms.

---

## 1. Online / offline status fixed

**The bug:** Users stayed marked "online" even after closing the app or losing connection. Multiple tabs also kicked each other's presence.

**Server — `spidr-server/src/socket/handlers.js`:**
- On server boot, all users still marked online/idle/streaming get reset to offline. Stale state can't survive a restart.
- Presence map is now `userId → Set<socketId>` instead of `userId → socketId`. Multiple tabs from the same user now coexist correctly.
- A reaper runs every 15 seconds. Any socket with no `presence:ping` in the last 60 seconds is force-disconnected and the user is dropped to offline if it was their last connection.
- The user is only marked offline when *all* of their sockets are gone, not just one.
- DM and friend notifications now fan out to every socket the recipient has open.

**Server — `spidr-server/src/models/UserProfile.js`:**
- New field: `last_seen` (Date) — refreshed on every ping.

**Client — `spidr-client/src/App.jsx`:**
- Sends `socket.emit('presence:ping')` immediately on auth and every 25 seconds thereafter.
- Disconnects cleanly on `beforeunload` so a tab refresh doesn't leave a 60-second zombie.

---

## 2. Servers no longer show up on a user's list if they're not in it

**Client — `spidr-client/src/components/spidr/Sidebar.jsx`:**
- The sidebar's expanded server list previously rendered every server in the database. Now it filters to servers the user owns or has a membership row in.

**Client — `spidr-client/src/pages/Home.jsx`:**
- The "Recent Servers" grid on the home page had the same problem. Now identically filtered.

---

## 3. Server invite links

**Server — `spidr-server/src/routes/servers.js`:**
- `POST /servers/:id/invite` — any member generates (or rotates) a unique 8-character code. Body `{ rotate: true }` forces a new code.
- `POST /servers/join` — accepts an invite code and adds the caller to the server's members list. Idempotent — already-members get a no-op response.
- `GET /servers/lookup/:code` — public preview of a server (name, description, icon, member count) for the join page.

**Server — `spidr-server/src/models/Server.js`:**
- Already had `invite_code` — now actually used.

**Client — `spidr-client/src/api/apiClient.js`:**
- `entities.Server.generateInvite(id, rotate)`, `joinByCode(code, user)`, and `lookupByCode(code)` wrap the three new endpoints.

**Client — `spidr-client/src/components/spidr/ServerInviteModal.jsx`** *(new file)***:**
- Modal that shows the invite URL, an 8-character code, Copy and Rotate buttons. Generates on open.

**Client — `spidr-client/src/components/spidr/ServersPanel.jsx`:**
- New UserPlus icon in the server header next to the settings chevron — opens the invite modal.
- Context-menu "Invite People" action now opens the modal too instead of silently copying a `spidr://invite/...` URL no one could resolve.

**Client — `spidr-client/src/pages/JoinServer.jsx`** *(new file)***:**
- Landing page at `/join/:code`. Looks up the server, shows a preview card, and has an "Accept Invite" button. On accept it joins and routes to `/Home#server-:id`.

**Client — `spidr-client/src/App.jsx`:**
- New route `/join/:code` mounted between login and the protected pages.

---

## 4. "Add to Server" button now works

**The two real bugs:**

1. **`spidr-client/src/pages/Home.jsx`:** When the profile was opened from the home page, `HolographicProfile` was rendered without the `open` prop, but the component does `if (!open) return null` at the top — so nothing rendered at all. Fixed by passing `open={true}` and also wiring `onOpenDM` so the Message button works.

2. **`spidr-client/src/components/spidr/HolographicProfile.jsx`:** The `addToServer` mutation did `if (!server) return` then *still* fired the success toast on the empty result. It now properly throws, uses `onError`, and the button correctly shows a pending state. The dropdown also:
   - Includes servers you own (previously only servers where you appeared in `members` showed up).
   - Shows a helpful empty state when you're not in any servers yet.
   - Disables (and labels) entries for servers the target user is already a member of.

---

## 5. Username font + color customization — free, no APEX required

**Server — `spidr-server/src/models/UserProfile.js`:**
- New fields: `username_font`, `username_weight`, `username_style`, `username_color`. All optional, all default to sensible values.

**Client — `spidr-client/src/lib/usernameStyle.js`** *(new file)***:**
- Shared `USERNAME_FONTS` (6 options: Default, Serif, Mono, Display, Handwriting, Rounded), `USERNAME_WEIGHTS` (4 options), `USERNAME_STYLES` (Normal, Italic).
- `buildUsernameStyle(profile, opts)` produces the React CSS object so every place that renders a username can be consistent.

**Client — `spidr-client/src/components/spidr/SettingsPanel.jsx`:**
- New "Username Style" section in the Appearance tab. Live-preview, font picker (rendered in the actual font), weight picker, italic toggle, and a color row with the auto-from-accent option plus a custom color picker.
- Section sits above the existing Profile Customization block; available to all users.

**Client — `spidr-client/src/components/spidr/HolographicProfile.jsx`:**
- The display-name `<h2>` now reads the user's stored font/weight/style/color through `buildUsernameStyle` and renders accordingly.

---

## 6. Global Reports page — UI rebuilt to match the mock

**Client — `spidr-client/src/pages/GlobalReports.jsx`:**

Full rewrite of the page chrome (logic and mutations are unchanged). The page now matches the screenshot:
- Header: red pulse-line icon, "GLOBAL OVERWATCH" large bold, "AUTH: ... • CLEARANCE: ADMIN" red mono subline.
- Four large stat cards — Total Reports (white), Pending (yellow), Escalated (orange), Critical (red) — with giant numbers on top and uppercase labels below.
- Status filter row (ALL / PENDING / ESCALATED / REVIEWING / RESOLVED / DISMISSED) with red active state.
- Severity filter row (ALL / CRITICAL / HIGH / MEDIUM / LOW) with dark active state.
- Each report row gets a colored severity bar down the left, then a stacked-pill row: black SPAM-style reason pill, colored status pill (RESOLVED green / PENDING yellow / etc.), solid severity pill (LOW blue / etc.), then "in <server name>" and the timestamp on the right.
- The detail modal and Ban / Unban actions are preserved exactly.

---

## 7. Nerve Center page — UI rebuilt to match the mock

**Client — `spidr-client/src/components/spidr/NerveCenter.jsx`:**

Full rewrite of the visual layout to match the SPIDR NERVE CENTER mock:
- Header: red pulse Activity icon, "SPIDR NERVE CENTER" / "ADMIN TELEMETRY // LIVE", with a "SIGNAL ACTIVE" pill on the right.
- **CORE RESONANCE — SYSTEM VITALS** panel: five glowing ring gauges
  - GRID TENSION (red) — CPU load %
  - VOICE NODES (purple) — active voice sessions
  - SYMBIOTE PULSE (cyan) — latency ms
  - APEX DENSITY (red) — APEX users / total users
  - THREAT INDEX (red/grey) — pending reports
- **DATA SILK FLOW — LIVE SIGNAL MONITOR** panel: two stacked filled-gradient line charts (grid tension over time, latency over time), drawn on a DPR-aware canvas so they're crisp on retina.
- 8 stat tiles in a 4-wide grid: Registered Users, Active Servers, Messages Sent, Clips Posted, Voice Sessions, APEX Members, Audio Tracks, Pending Reports.
- **SERVER TOPOLOGY — NODE REGISTRY** panel listing each server with icon, member/channel counts, and an ACTIVE indicator.

All wired to the same telemetry socket and entity queries the old version used.

---

## 8. GIF / emoji upload to servers — the actual fix

**The bug:** Uploading an emoji in Server Settings looked successful but only added it to local state. Reopening the modal lost it. The user had to remember to also click "Save Changes" at the bottom.

**Client — `spidr-client/src/components/spidr/ServerSettingsModal.jsx`:**
- `addEmoji` now persists immediately to the server, invalidates the relevant queries, and shows a clear success toast. Includes basic validation (duplicate-name check, valid-id slugging).
- `removeEmoji` also persists immediately, with rollback on failure.

**Client — `spidr-client/src/components/gifs/Fabricator.jsx`:**
- After uploading to the Hive, the Fabricator now invalidates `['community-assets']`, `['community-gifs-picker']`, `['community-emojis-picker']`, and `['community-assets-emojis']`. Previously it only invalidated the first one, so new Hive uploads didn't appear in the GIF or emoji pickers until the page refreshed.

**Client — `spidr-client/src/components/gifs/HivePanel.jsx`:**
- Hive now hides private uploads from anyone except their author. (Previously, ticking the "Publicly visible in Hive" box off in Fabricator didn't actually hide the upload from the Hive page.)

---

## Files changed

### Server
- `spidr-server/src/models/UserProfile.js` — added `last_seen`, username style fields
- `spidr-server/src/socket/handlers.js` — heartbeat reaper, reset-on-start, multi-socket presence
- `spidr-server/src/routes/servers.js` — added `/invite`, `/join`, `/lookup/:code` endpoints

### Client
- `spidr-client/src/App.jsx` — heartbeat ping, `/join/:code` route
- `spidr-client/src/api/apiClient.js` — Server entity helpers (generateInvite, joinByCode, lookupByCode)
- `spidr-client/src/pages/Home.jsx` — server-list filter, fixed HolographicProfile invocation
- `spidr-client/src/pages/GlobalReports.jsx` — full UI rebuild
- `spidr-client/src/pages/JoinServer.jsx` — **new** invite landing page
- `spidr-client/src/components/spidr/Sidebar.jsx` — server-list filter
- `spidr-client/src/components/spidr/HolographicProfile.jsx` — fixed Add to Server mutation, applied username style
- `spidr-client/src/components/spidr/SettingsPanel.jsx` — username customization UI
- `spidr-client/src/components/spidr/ServersPanel.jsx` — invite button + modal mount + scroll-gap fix + structured replies
- `spidr-client/src/components/spidr/ServerInviteModal.jsx` — **new**
- `spidr-client/src/components/spidr/ServerSettingsModal.jsx` — persist emoji add/remove immediately
- `spidr-client/src/components/spidr/NerveCenter.jsx` — full UI rebuild
- `spidr-client/src/components/spidr/CommunityPanel.jsx` — `shrink-0` to prevent flex squeeze
- `spidr-client/src/components/spidr/DirectMessages.jsx` — structured replies
- `spidr-client/src/components/spidr/KineticChat.jsx` — structured replies (group chats)
- `spidr-client/src/components/spidr/MessageItem.jsx` — renders red-themed reply card when `repliedTo` is provided
- `spidr-client/src/Layout.jsx` — global `.msg-flash` highlight animation for reply scroll-to
- `spidr-client/src/components/gifs/Fabricator.jsx` — fixed query invalidation
- `spidr-client/src/components/gifs/HivePanel.jsx` — hide private uploads
- `spidr-client/src/lib/usernameStyle.js` — **new** shared username style util

All files pass syntax-check via esbuild and node --check.

---

## 9. Scroll layout gap — fixed

**The bug:** Scrolling messages in a server channel exposed a large dark void on the left side of the screen. The chat panel was growing past its share of the flex row and pushing the sidebar / channels / server-list columns into a visual gap.

**Client — `spidr-client/src/components/spidr/ServersPanel.jsx`:**
- Added `min-w-0` to the chat panel container and the voice channel container so they respect the flex row's available width.
- Added `min-w-0` to the inner messages container.
- Added `min-w-0 overflow-hidden` to the outermost ServersPanel wrapper.
- Added `shrink-0` to the server list column (`w-60`) and the channels column (`w-56`) so they don't get squeezed when a long-content message tries to expand the chat.

**Client — `spidr-client/src/components/spidr/CommunityPanel.jsx`:**
- Added `shrink-0` to the `w-72` member-list column for the same reason.

This is the standard Tailwind fix for "flex item won't stay within its share of the row" — `shrink-0` on the fixed-width siblings plus `min-w-0` on the flexible main panel. The dark void in the recording is gone.

---

## 10. Replies — actual structured replies, themed in spidr red

**The bug:** The Reply context-menu action wasn't actually creating a reply — it just prepended `> Replying to <truncated content>\n` to the input text. The sent message was just plain text with a quote marker. The `reply_to` field that already existed on the `Message`, `DirectMessage`, and `GroupChatMessage` models was never populated or read.

**Three places fixed:**

**Client — `spidr-client/src/components/spidr/ServersPanel.jsx` (server channels):**
- New `replyingTo` state holds the structured original message (id, content, user_name, user_avatar, user_id) — not text.
- The Reply context action now sets this state instead of mangling the input.
- A red-themed reply preview chip appears above the input bar showing "Replying to <user> · <content preview>" with a cancel X. Pressing **Esc** also cancels.
- The placeholder updates to "Reply to <user>…" while replying.
- On send, `reply_to: <original message id>` is attached to the new message and state is cleared.
- Reply state clears on channel switch.

**Client — `spidr-client/src/components/spidr/DirectMessages.jsx` (DMs):** Same wiring — `replyingTo` state, structured Reply action, preview chip with cancel/Esc, `reply_to` on send, clear on conversation switch.

**Client — `spidr-client/src/components/spidr/KineticChat.jsx` (group chats):** Same wiring, clears on group switch.

**Client — `spidr-client/src/components/spidr/MessageItem.jsx`:**
- New `repliedTo` prop. When provided, renders a red-themed reply card above the message content — same shape as the `BotMessage` SPIDR_AI card (red top accent strip, glow icon container, header with name + "REPLY" pill, quoted preview in mono font) but in spidr red instead of red→purple.
- Clicking the reply card scrolls to the original message and flashes a red highlight on it (using the `.msg-flash` animation added to `Layout.jsx`).
- Falls back to "Original message no longer available" if the original was deleted or scrolled out of the loaded window.
- ServersPanel and DirectMessages and KineticChat all add `data-msg-id` to each message wrapper for the scroll-to target.

**Note on existing messages:** Messages already in the database that contain the old `> Replying to ...` text prefix will continue to render as plain text — there's no way to retroactively detect those and convert them. New replies sent after this fix will use the proper structured form.
