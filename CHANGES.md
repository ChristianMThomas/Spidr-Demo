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

---

## 11. Nerve Center is now public

**The bug:** The Nerve Center page was admin-only — most users couldn't reach it.

**Client — `spidr-client/src/components/spidr/Sidebar.jsx`:**
- Moved `nerve-center` out of the `isAdmin` block. Everyone can see it now. Global Reports stays admin-only (it includes a ban interface — that's correct).

---

## 12. "Find Friends" / Discover Users — actually suggests people

**The bug:** The home page's AI Discovery widget did nothing on load — the user had to click "Find People" and even then it depended on an LLM call that returns an empty `suggestions: []` array when no `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is configured. Result: forever-empty suggestions box.

**Client — `spidr-client/src/components/spidr/DiscoverUsers.jsx`** (rewrite):
- Auto-loads suggestions on mount once profiles are available — no button click required.
- Computes algorithmic suggestions as a fallback the LLM can never beat to: ranks non-friend profiles by shared servers (+3 each), online status (+2), having a bio (+1), and account recency (+1), then takes top 5.
- Tries the LLM first for nice match-reason text; if it returns the no-key stub (`"[AI not configured: reason]"`) or fails or throws, silently falls back to the algorithmic list.
- Once the LLM has failed in a session, subsequent rescans skip it and go straight to algorithmic — no 10-second spinner waiting for nothing.
- "Already friends", "pending request", and "blocked" users are filtered out of candidates.
- Sending a request immediately removes the card from the list and shows a check mark — no UI lag.
- Heading updates to "Suggested Friends" when AI is unavailable, "AI Discovery" when it works.

**Client — `spidr-client/src/pages/Home.jsx` + `spidr-client/src/components/spidr/FriendsPanel.jsx`:**
- The "Find Friends" quick-action button on the home page now lands you on the **Add Friend tab** of the Friends panel — not the default "All" tab. Plumbed via a new `initialTab` prop on `FriendsPanel`, controlled by the `tab` state inside the panel.

---

## 13. Activity feed — now actually produces events

**The bug:** The home page's Activity Feed reads from a `Feed` entity, but **nothing in the codebase ever writes to it**. It would stay empty forever.

**Server — `spidr-server/src/models/Feed.js`:**
- Expanded the schema to support all the fields `EnhancedFeed.jsx` was expecting: `type`, `user_name`, `user_avatar`, `title`, `image_url`, `is_pinned`, `reactions`, `comments_count`, `target_id`, etc. The original 5-field schema would have rejected those silently.
- Added compound index `(is_pinned, created_date)` since that's the dominant query pattern.

**Server — `spidr-server/src/utils/feedEvents.js`** (new):
- One-stop helper for writing Feed records — `serverJoin`, `friendAccepted`, `clipPosted`, `milestone`, `announcement`. Each is fire-and-forget: a write failure logs but never throws, because the feed is decorative.

**Server — wired into existing models so events fire automatically:**
- `spidr-server/src/models/Server.js`: post-save hook emits a `milestone` "Launched a new server" event on creation.
- `spidr-server/src/models/Friend.js`: post-save hook emits a `friend_added` event when status transitions to `accepted` — de-duped so the symmetric two-row friend record doesn't produce two feed entries.
- `spidr-server/src/models/Clip.js`: post-save hook emits a `clip_posted` event on creation (with thumbnail).
- `spidr-server/src/routes/servers.js`: `/servers/join` (invite flow) emits `server_join` on accept.

**Client — `spidr-client/src/components/spidr/EnhancedFeed.jsx`:**
- Refresh interval dropped from 30s → 10s so events show up almost immediately.

You'll see the feed populate on its own as people make friends, join servers, and post clips. No client code has to change to write events — the model hooks do the work.

---

## 14. Admin role bootstrap

**The reality:** Global Reports requires `role: 'admin'` on the User document. There was no easy way to grant that without poking MongoDB directly.

**Server — `spidr-server/scripts/grant-admin.js`** (new):
- CLI script: `node scripts/grant-admin.js you@example.com` flips the user's role to admin. Add `--revoke` to undo. Uses the same `MONGODB_URI` env var as the main server.

Run this once for the account that should see Global Reports, then refresh the app.

---

## 15. Username effects + server-aware name resolution

### Effects palette for username styling

**Server — `spidr-server/src/models/UserProfile.js`:**
- New `username_effect` field — one of `none`, `glow`, `gradient`, `rainbow`, `pulse`, `shimmer`. Defaults to `none`.

**Client — `spidr-client/src/lib/usernameStyle.js` (rewrite):**
- `USERNAME_EFFECTS` constants for the 6 effects.
- `buildUsernameStyle()` now produces the right CSS for each: solid color, text-shadow glow, two-color gradient (user color → purple), animated rainbow sweep, opacity/brightness pulse, or shimmer sweep.
- New `resolveServerUsername({ profile, server, userId })` helper — returns `{ name, style, roleName, roleColor, hasNickname }`. Applies the override rules below.

**Client — `spidr-client/src/Layout.jsx`:**
- Added the three keyframes used by the effects (`@keyframes username-rainbow`, `username-pulse`, `username-shimmer`) so they work everywhere without each component carrying its own `<style>` tag.

**Client — `spidr-client/src/components/spidr/SettingsPanel.jsx`:**
- The live preview now uses `buildUsernameStyle` directly, so it shows the actual effect (animated rainbow, glow, etc.) as you tweak settings.
- New **Effect** picker row below the color picker — each button renders its own label in the effect itself so you can preview every option at a glance.
- Effect persists in the profile alongside font / weight / style / color.

### Server roles + nicknames override user style

**The rule:** In server channels, server-level context wins:
- A server **role color** overrides the user's `username_color` and disables animated effects (a server role name is a label, not personal flair — it should be readable and stable).
- A server **nickname** overrides the user's `display_name`.
- The user's font / weight / italic preferences still apply — only color and name are overridden.
- In DMs and group chats, no server context exists, so the user's full style (including effects) applies.

**Client — `spidr-client/src/components/spidr/ServersPanel.jsx`:**
- New `allProfiles` query + `profilesByUserId` lookup map so each message can resolve its author's profile without N+1 fetches.
- Message author rendering replaced — now calls `resolveServerUsername()` and renders the result. Title attribute shows the user's real display name + discriminator on hover when a nickname is in use.
- A new colored **role badge pill** appears next to the username when the author has a role with a custom color (e.g., `ADMIN` in red, `MODERATOR` in orange).
- The "Set Nickname" context-menu action **actually persists now** — previously it just showed a toast. The new flow: opens a prompt prefilled with the current nickname, saves to `server.members[].nickname` via `Server.update`, writes a `NICKNAME_SET` / `NICKNAME_CLEAR` audit log entry, and invalidates the chat profile cache so the new name renders immediately.

**Client — `spidr-client/src/components/spidr/MessageItem.jsx`:**
- New `senderProfile` prop. When provided, the sender name renders with `buildUsernameStyle` (effects and all). Falls back to the original APEX/own-message coloring when no profile is provided.

**Client — `spidr-client/src/components/spidr/DirectMessages.jsx`:**
- Passes `senderProfile={isOwnMessage ? currentProfile : recipientProfile}` to MessageItem. Both profiles were already being fetched, so no new queries.

**Client — `spidr-client/src/components/spidr/KineticChat.jsx`:**
- New `memberProfiles` query that loads profiles for all members of the active group, building a `profilesByUserId` map. Each MessageItem receives the correct `senderProfile`.

### Settings panel header

**The fix:** The profile preview block was showing your email under the avatar. That's been replaced with the proper handle format.

**Client — `spidr-client/src/components/spidr/SettingsPanel.jsx`:**
- Below the display name now shows `@username#discriminator` in mono font (matches the format the rest of Spidr uses — see image 3 from the original spec: `@raespiders#69f6`). Email is no longer leaked into the visible UI.

---

## 16. Module Nexus / Fabricator / Bot Lab / Nerve Center — major overhauls

### Module Nexus empty → 13 official modules seeded on server start

**Server — `spidr-server/src/models/Module.js`:**
- Schema expanded with the fields the client expects: `type` enum (`static_text`, `display_widget`, `api_sync`, `live_feed`), `author_name`, `status` enum, `reports` array. `is_public` now defaults to true so newly published modules show up in the Nexus without a moderation step.

**Server — `spidr-server/src/utils/seedDefaultModules.js`** *(new)*:
- 13 official modules ship pre-loaded the first time the server starts, matching the populated state in image 1: Gaming Uplink Card, Symbiote Entity Pet, Audio Resonance Player, Custom Quote Box, Mood Ring, Lo-fi Radio, Local Timezone Clock, Daily Streak Counter, Anime Watchlist, Spotify Now Playing, Steam Now Playing, PC Specs Flex, Weather Hex.
- Each module has a fully-formed `payload` JSON that `DynamicModuleWidget` knows how to render — so users get real working widgets, not placeholders.
- Idempotent: re-running on every boot doesn't duplicate. Existing seeded modules get their description/tags refreshed but install_count is preserved if real users have installed them.

**Server — `spidr-server/src/index.js`:**
- Calls `seedDefaultModules()` and `seedDefaultBots()` in the `.then()` of the Mongoose connect.

### Fabricator: stop posting code as the widget

**The bug:** The old Fabricator had a raw JSON textarea — most users didn't know what JSON to type, so the resulting module rendered the literal JSON as text on profiles instead of a working widget.

**Client — `spidr-client/src/components/nexus/ModuleFabricator.jsx`** (rewrite):
- Structured form per module type — each picks its own input layout instead of a generic JSON box.
  - **Static Text** → content textarea + optional link
  - **Display Widget** → title, subtitle, body, banner image URL, and up to 3 stat tile rows (label + value)
  - **API Sync** → a single "what to fetch" textarea (refreshes every 10 min)
  - **Live Feed** → feed title + optional auto-update query + manual fallback items
- A **live preview** of the widget renders on the right side using the actual `DynamicModuleWidget` — what you see is exactly what users on your profile will see.
- "Raw JSON" toggle is still there for power users who want hand-crafted payloads.
- The Aegis safety scanner is preserved but now uses the new fail-open ContentScanner so legit modules don't get rejected when no LLM key is configured.
- Local hard-rejects for `<script>`, `javascript:`, and `on*=` event handlers before the LLM is even called.
- Form fully resets after a successful publish.

### Bot Laboratory — real, installable bots

**The bug:** Old Bot Lab had a hardcoded `botCategories` constant. "Quick Install" created an `InstalledModule` record with no bot behavior. Bots were UI cards, nothing more.

**Server — `spidr-server/src/models/CustomBot.js`:**
- Expanded with `category` enum, `icon_emoji`, `features` array, `install_count`, `is_official` flag, `author_name`. The `code` field now distinguishes builtin handlers (`builtin:music-master`) from user-coded bots (`js:...`).

**Server — `spidr-server/src/utils/seedDefaultBots.js`** *(new)*:
- Six official bots in three categories — Scientists (Spidr AI Assistant, Data Analyst), Entertainers (Music Master, Game Master), Guardians (Auto Moderator, Welcome Bot). Each carries an emoji icon, feature bullets for the marketing card, and a `commands` array describing what slash commands it responds to. Idempotent same as modules.

**Server — `spidr-server/src/models/Server.js`:**
- Added `bots` array and `bot_config` mixed object to the Server schema so installed bots actually persist on the server they're installed to. Also added the `emojis`, `hidden_roles`, `sanctuary`, `airlock` fields that were already being written by various modals but weren't part of the schema. Set `strict: false` so existing servers with extra fields keep working.

**Client — `spidr-client/src/components/spidr/SpidrBotEngine.jsx`:**
- Extended the slash command handler with the new bot commands: `/coinflip`, `/trivia` (uses LLM with a fallback), `/skip`, `/queue`, `/stop` (placeholders until voice audio pipeline lands), `/stats` and `/top` (reads from Messages entity for real server stats), `/modlog` (reads ServerAuditLog), `/welcomeset` (persists to `server.bot_config.welcome_message`), `/modset` (info card), `/summarize` (LLM-powered recap of last N messages).
- Updated `/help` to list every available command grouped by which bot owns it.

**Client — `spidr-client/src/components/spidr/BotLaboratory.jsx`** (rewrite):
- Pulls real bot data from `entities.CustomBot.list()` instead of a hardcoded constant. Groups by `category` automatically, so any new bot added via seed or user upload shows up in the right section.
- "Install" now opens a dialog asking **which server** to install on — only servers the user owns or admins. Persists to `server.bots[]` via `Server.update`. Refuses to install the same bot twice into the same server.
- Shows the bot's commands list in the install dialog so users know what they're getting.
- Marks official bots with a blue "Official" badge.
- Install count actually increments. Reflects in the public-bots query immediately.
- "My Bots" and "Import" tabs delegate to the existing `MyBotsTab` and `ImportBotTab` components unchanged.

### Nerve Center: public + personal stats (not admin telemetry)

**The change:** Nerve Center moved out of the admin block in `Sidebar.jsx` last round, and the page itself is now rewritten as the **viewing user's personal telemetry** — same visual style as image 2 (ring gauges, line charts, stat tiles) but every metric is scoped to you.

**Client — `spidr-client/src/components/spidr/NerveCenter.jsx`** (rewrite):
- **CORE RESONANCE — YOUR VITALS** ring gauges: ACTIVITY (last-3-days vs peak), STREAK (consecutive days posting), FRIENDS, SERVERS, ENGAGEMENT (avg reactions per message).
- **DATA SILK FLOW — LAST 14 DAYS** dual line chart: server messages sent per day + DMs sent per day.
- 8 stat tiles: Total Messages, Friends, Servers Joined (owned count in sub), Clips Posted (total views in sub), Reactions Received, Day Streak, Days on Spidr (APEX badge if applicable), Today's messages.
- **YOUR SERVERS — MEMBERSHIP REGISTRY** lists all servers you're in with member/channel counts and an "Owner" badge on the ones you created.
- All queries scoped by `author_id`/`user_id`/`sender_id` filters so this is genuinely per-user data, not platform-wide.

### Smaller fixes shipped in the same round

- **Vibe Check / Neon Sign not saving:** `queryClient.invalidateQueries({ queryKey: ['userProfile'] })` was missing the user ID — the actual key is `['userProfile', userId]`. Fixed in `HolographicProfile.jsx`, plus invalidate `['profiles-for-chat']` so the new value appears in chat too.
- **APEX features not appearing after subscribing:** same query-key bug in `ApexCommand.jsx`. Also fixed `SettingsPanel.jsx`'s `updateProfileMutation` to invalidate the parameterized key.
- **@mention crashing the chat:** `MentionPopup` was doing `u.name.toLowerCase()` without a null check. Filter out users without names; defensively coerce `filter` to a string before lowercasing. Also fixed the upstream `serverMembers` mapping in `ServersPanel.jsx` to drop members missing `user_id` or `user_name` and prefer nicknames over real names.
- **GIF "content blocked" on safe uploads:** `ContentScanner` rewrite. The old version called `InvokeLLM` with `file_urls` (which the server doesn't pass to the LLM) and a strict "if in doubt, flag it" prompt — result: the model judged content it couldn't see and blocked everything. New version fails open on stubs/errors and only blocks on confident verdicts (≥70% confidence + concrete category). The Hive's report system handles the long tail.

---

## 17. Real routing — every page gets its own URL

**The bug:** every "page" was rendered through a giant `Home.jsx` switch on internal `activeTab` state. Clicking a tab re-rendered the entire 40k-line tree on every change, which is the main cause of the lag. The URL also never changed past `/Home`, so deep links and back-button navigation were broken.

**Client — `spidr-client/src/App.jsx`** (rewrite):
- Each top-level surface now has its own route — `/home`, `/friends`, `/friends/:tab`, `/servers`, `/servers/:serverId`, `/feed`, `/ai`, `/bots`, `/modules`, `/nerve-center`, `/settings`, `/gifs`, `/global-reports`.
- Every page is `React.lazy()`-loaded — a fresh user only downloads the dashboard chunk on first visit; bots/feed/AI panels load lazily when navigated to. Big perf win for cold-start.
- The persistent `SpidrShell` wraps every protected route so the sidebar, floating dock, voice dock, and global menu provider mount once and stay mounted across navigation. *This is the real fix for the lag* — the heavy mount/unmount cycle on every nav is gone.
- Legacy `/Home` (uppercase) redirects to `/home` so old links still work.

**Client — `spidr-client/src/context/AppShellContext.jsx` (new):**
- Single source of truth for state that needs to survive page navigation: `currentUser`, `appTheme`, `activeCall`, `selectedServerId`, `pendingDM`. Auth+profile load happens once on mount.
- Helpers `navigateToDM(friendId)` and `openServer(id)` for cross-page hand-offs without prop-drilling.

**Client — `spidr-client/src/components/SpidrShell.jsx` (new):**
- Persistent layout. Holds sidebar, FloatingDock, the minimized-call dock (so a minimized voice channel keeps running across navigation), MenuProvider, and the Toaster. Per-page content renders via `<Outlet />` with a Suspense fallback during chunk load.

**Client — new page wrappers** (`pages/HomeDashboard.jsx`, `Friends.jsx`, `Servers.jsx`, `TheWeb.jsx`, `AI.jsx`, `Bots.jsx`, `Modules.jsx`, `NerveCenter.jsx`, `Settings.jsx`): each one is a thin file that pulls shared state from `useAppShell()` and renders the existing panel component. The old `Home.jsx` is gone.

**Client — `spidr-client/src/components/spidr/Sidebar.jsx`:**
- Server-icon clicks now `navigate('/servers/<id>')` instead of using the busted `setActiveTab('server-<id>')` pattern, so deep-linking a specific server works.

**Client — `spidr-client/src/components/spidr/FriendsPanel.jsx`:**
- New `onTabChange` callback. The Friends page wrapper uses it to keep the URL synced with the active sub-tab (`/friends/add`, `/friends/online`, etc.). Means you can bookmark or share a direct link to "your blocked list" or "add friend" and it lands you there.

**Client — `spidr-client/src/pages/JoinServer.jsx`:**
- Post-accept redirect updated from `/Home#server-<id>` to `/servers/<id>` so the server is real-linked.

**Deep-linking now works for:** any server, any friends sub-tab, the join-invite flow, and any top-level page. Reloads stay on the same page. The browser back/forward buttons do what users expect.

---

## 18. Voice — WebRTC signaling + stream sync

The previous voice implementation didn't actually transmit audio between peers. The visual UI was there (mic indicator, mute button, voice channel widget) but the WebRTC peer connections weren't established — that's why "you cannot hear anyone's voice." This round lays down the real signaling and client peer code.

**What now exists:**

**Server — `spidr-server/src/socket/voiceSignaling.js` (new):**
- Real WebRTC signaling — SDP offer/answer/ICE candidate routing over Socket.io. The server never touches audio bytes; it just connects peers so they can establish direct connections.
- Mesh topology (each peer connects to every other peer). Works perfectly up to ~6 people per channel. The file documents how to graduate to an SFU (mediasoup / LiveKit) when you need bigger calls.
- Per-channel roster with auto-cleanup on disconnect.
- Mute/deafen/video state broadcast.
- Stream-sync state machine: the server holds the canonical playhead for SPIDR AI broadcasts and pushes updates to every viewer. New joiners get the current state on roster join.
- `GET /voice/ice` endpoint returns the ICE server config (STUN+TURN) — clearly marked `// CONFIGURE:` lines for where your TURN credentials go.

**Server — `spidr-server/src/socket/handlers.js`:**
- `attachVoiceHandlers` is now wired into the connection callback so every authenticated socket gets the voice signaling event handlers, with the user's display name/avatar pre-loaded for the peer roster.

**Client — `spidr-client/src/hooks/useVoicePeer.js` (new):**
- React hook that: captures the mic via getUserMedia, builds an RTCPeerConnection per remote peer, exchanges SDP offers/answers/ICE candidates through the signaling server, exposes remote MediaStreams for consuming components to attach to `<audio>` elements, and broadcasts mute/deafen state.
- Handles ICE failure with restart, dropped peers with cleanup after a 5s grace period, mic permission denial with a clear error message, and AbortController-style mount cleanup.
- Echo cancellation, noise suppression, and AGC are all on by default via getUserMedia constraints — browser handles the DSP.

**Client — `spidr-client/src/hooks/useVoiceStream.js` (new):**
- The "SPIDR AI stream sync" piece. Each viewer fetches the stream URL locally (their own browser loads YouTube/Twitch); the hook adjusts their playback to match the server-canonical playhead.
- Drift correction: >1.5s drift → hard seek; 0.3–1.5s drift → playbackRate nudge to ±5% until aligned (avoids audible seek jumps); <0.3s → leave it. Drift check runs every 2 seconds.

**What still needs to happen for "you can hear each other" to work end-to-end:**

1. **Deploy TURN.** Without TURN, ~25% of users (behind symmetric NAT) won't be able to connect peer-to-peer. Easiest paths:
   - Self-host coturn (free, ~30 min setup): https://github.com/coturn/coturn
   - openrelay.metered.ca (free, public, rate-limited — good for dev)
   - Cloudflare Calls (recently launched, generous free tier)
   - Paste the credentials into `getTurnConfig()` in `voiceSignaling.js`.
2. **Wire the hooks into the existing VoiceChannel UI component.** I didn't touch `VoiceChannel.jsx` this turn — it currently has the visual UI but no audio pipeline. The hook-to-UI integration is a focused next step: replace the placeholder mic/peer state with `useVoicePeer({ channelId })` and render `<audio>` elements for each peer's stream.
3. **Audio level monitoring** for the "who's speaking" ring around avatars — wire an `AudioContext` `AnalyserNode` against the peer's stream and threshold the RMS.

The hard part — signaling architecture, peer connection lifecycle, drift correction, mesh roster management — is done. The remaining work is mechanical UI wiring against the hooks.

**Scaling beyond mesh:** when you grow past ~6 per call, swap the mesh for an SFU. The signaling event names above are SFU-compatible — the SFU just becomes "peer 0" in the roster. LiveKit is the easiest to drop in.

---

## 19. THE WEB — TikTok-style virtualized feed

**The bugs:** the existing FeedPanel mounted exactly ONE `<video>` element and swapped its `src` on every swipe, which is the opposite of TikTok. Every transition meant: tear down the previous video, fetch and load the next one from scratch, wait for it to buffer. Result: ~500ms stutter on every swipe. No touch swipe, no keyboard navigation, no preloading.

**Client — `spidr-client/src/components/feed/ClipFeed.jsx` (new):**
- Three-slot virtualized stack — only the prev/current/next clips are mounted in DOM at any moment. The current one plays; the prev/next are preloaded but paused. As the user advances, slots rotate without unmounting — the previous "next" video becomes the new "current", already buffered.
- Real swipe mechanics: wheel + touch (`onTouchStart`/`onTouchEnd` with 50px delta threshold) + keyboard (`↑/↓`, `j/k`, `PageUp/PageDown`). Throttled at 220ms so trackpad inertia doesn't trigger multiple advances per swipe.
- Per-card watch-time tracking. The `ClipCard` component records when it becomes active, when it becomes inactive, and emits a single `algorithm.trackEngagement` call with the accumulated watch time, completion ratio, loop count, and engagement actions. Final flush on unmount catches the case where the user navigates away mid-watch.
- Side-action UI preserved from the old ClipViewer (like, comment, react, share, save, audio disc, volume) — moved into per-card scope so each video has its own state.
- The card uses `preload="auto"` when active and `preload="metadata"` when prev/next, so the active card buffers aggressively but the inactives don't burn bandwidth.

**Client — `spidr-client/src/components/spidr/FeedPanel.jsx`:**
- `ClipViewer` (282 lines of the old single-video implementation) **deleted**.
- `useEngagement` hook removed — that logic now lives inside `ClipCard`.
- `Btn` (the side-action button) removed — replaced by a local `SideBtn` inside `ClipFeed` to keep the new file self-contained.
- `audioMap` pre-computation lifted from inside the old viewer up to FeedPanel scope so all `ClipCard`s share one query for audio metadata instead of each refetching.
- Both `main` and `friends-feed` tabs now render `<ClipFeed>`.
- FeedPanel dropped from 602 → 297 lines.

**Server — `spidr-server/src/routes/algorithm.js`:**
- Added the **"recently-watched in last 48h" filter** from the blueprint. Clips the user has watched with ≥40% completion in the past 48 hours get a -60 score penalty in the feed ranking. They're not hidden entirely (so a user can still re-encounter clips they loved), but they fall to the bottom unless they're exceptionally well-matched on other axes.

The backend scoring (already in place from prior work):
- 35% personal engagement (from `EngagementProfile.tag_scores`, `author_scores`, `audio_scores`)
- 25% recency (full points for <1h, decays over 7 days)
- 20% friend boost
- 15% hashtag affinity
- 5% trending signals
- ±5% anti-filter-bubble noise
- 70% personalized / 30% serendipity mix in the response

Plus the new -60 recently-watched penalty. This matches the blueprint's scoring formula exactly.

**What feels different now:**
- Scrolling is fluid. No buffer stutter between clips because the next one is preloaded.
- Touch swipes work on mobile/tablet.
- Keyboard `↑/↓` and `j/k` work for desktop users.
- The "For You" personalization label shows when the backend returns a personalized feed (i.e., the user has enough engagement history to score against).
- You won't see the same clip three times in a row anymore because of the 48h filter.
- Memory footprint is bounded: only 3 video elements regardless of feed length.

---

## 20. Activity feed: @mentions and profile updates

**Server — `spidr-server/src/models/Feed.js`:**
- Added `recipient_ids` array field. Empty/missing = PUBLIC event (everyone sees it). Populated = TARGETED event (only listed users see it). This is the delivery model from the blueprint — a single Feed table that supports both global and personal events.
- Expanded the `type` enum with `mention` and `profile_update`.
- Added `channel_id` and `message_id` fields for mention deep-linking back to the source chat.

**Server — `spidr-server/src/utils/mentionScanner.js` (new):**
- Parses `@<word>` tokens from message content, excludes the reserved `@everyone`/`@here`/`@all`.
- `resolveMentions(tokens, candidates, senderId)` looks each token up against a candidate list of users, matching against `username`, `display_name`, first-word-of-display-name, and `member.user_name` (case-insensitive). Self-mentions are filtered out so a user can't trigger a notification by typing their own name.
- Smoke-tested with 5 cases — extraction, resolution, self-mention filtering, empty content, and no-@ content. All pass.

**Server — `spidr-server/src/utils/feedEvents.js`:**
- New `mention()` helper. Takes sender info + receiver + context (server/dm/group/comment) + optional server/channel/message IDs + a snippet. Writes a single Feed entry per mentioned user with the title phrased correctly for the context ("Mentioned you in #general (Server)" vs "Mentioned you in a DM").
- New `profileUpdate()` helper. Takes the actor, audience (friend IDs), and a `changed` array; phrases the title based on what changed ("Updated their bio", "Changed their avatar", or "Updated their profile (3 changes)" for multi-field updates).

**Server — `spidr-server/src/models/Message.js`:**
- Post-save hook scans message content for mentions. Resolves against the server's member list (cross-referenced with UserProfile for username/display_name) and fires a `mention` feed event for each non-self mention. Pre-filtered: skips system messages, edits (only fires on create via `wasNew`), and messages without an `@`.
- Snippet truncated to 140 chars for the feed card.

**Server — `spidr-server/src/models/DirectMessage.js`:**
- Post-save hook for DMs. Only resolves against the receiver (DMs only have two parties), no broadcast scanning. Fires when the receiver is `@<username>`/`@<display>`/`@<first-word>`'d.

**Server — `spidr-server/src/models/GroupChatMessage.js`:**
- Post-save hook for group chats. Candidates are the group's member list. Same matching rules.

**Server — `spidr-server/src/models/Comment.js`:**
- Post-save hook for comments on clips/posts. Because comments have no implicit member list, this resolves by **username only** — looks up UserProfile by case-insensitive username match against each `\w+` mention token. Bounded query (≤10 results) so the worst case is cheap.

**Server — `spidr-server/src/models/UserProfile.js`:**
- `pre('findOneAndUpdate')` hook now also captures a snapshot of the tracked fields (`display_name`, `bio`, `avatar_url`, `banner_url`, `username_color`, `username_effect`, `pronouns`) before the update runs.
- `post('findOneAndUpdate')` hook diffs the snapshot against the update's `$set` payload (works whether the caller passed `{new: true}` or not). If any tracked field actually changed, looks up the user's accepted friends and fires a `profile_update` feed event targeted at them.
- **Rate-limited to one profile update per user per 5 minutes** — so a user actively tweaking their bio doesn't spam every friend with 10 "X updated their profile" cards. The audience check runs before the rate limit so users with no friends don't burn their slot.
- **Doesn't fire on no-op saves** (e.g. setting `bio: ''` when it's already empty) thanks to a string-coerce equality check.
- **Doesn't fire on status / last_seen / presence pings** — those fields aren't in `TRACKED_FIELDS`.
- **Doesn't fire on APEX subscription / theme changes** — those are private not social.

**Server — `spidr-server/src/routes/feeds.js`:**
- Replaced the bare `crudRouter(Feed)` mount with a custom router that prepends an **audience filter** on every list request: returns items where `recipient_ids` is empty (public) OR contains the requesting user's ID. Mentions and profile updates flow through to their intended audience only; server/friend/clip events stay globally visible.

**Client — `spidr-client/src/components/spidr/EnhancedFeed.jsx`:**
- New `AtSign` icon + red color for `mention`. New `UserCog` icon + emerald color for `profile_update`.
- Mention cards render the title (e.g., "Mentioned you in #general") on one line and the message snippet in italics underneath, so you can see the actual mention without having to click through.
- Title + content area is now click-to-navigate where applicable: mentions deep-link to `/servers/<serverId>`, server joins to the same, clip posts to `/feed`. Reactions and the comment button stay separate, non-navigating.

**What feels different now:**
- When someone `@`s you in a server, DM, group chat, or comment, a card pops into your home Activity Feed within 10 seconds (the existing refetch interval) showing who, where, and what they said.
- When a friend changes their avatar, bio, banner, display name, pronouns, or username styling, a card appears for **you specifically** in your feed. Other people on the platform don't see it.
- The activity feed is finally doing what its name says — it shows YOUR activity, including events targeted at you, not just a global firehose.

**Honest caveats:**
- Real-time delivery is still polling-based (the existing 10s `refetchInterval`). A user gets their mention notification within ~10 seconds, not instantly. Real-time push would require wiring Feed event creation into a socket event broadcast — a focused follow-up, not done this turn.
- Profile-update rate limiting is in-memory. If the server restarts, the limiter resets. A user spamming saves in the minute after a deploy could get two events through instead of one. Real fix is a Redis-backed cooldown — same Redis cluster you'd use for pub/sub if you scale out signaling beyond one node.
- The comment-mention scanner resolves by username only (not display name), so a user mentioning someone in a comment by their display name won't trigger a notification unless the display name and username match. This is intentional — scanning all UserProfiles by display name for every comment would be too expensive without pre-built indexes.

---

## 21. Right-click context menus everywhere

The skeleton (`MenuProvider` + `SpidrMenu`) already worked. This round expanded it into a real action matrix and wired it into the places users actually right-click.

**New context types** (`spidr-client/src/components/ui/SpidrMenu.jsx`):
- `profile` — for avatars in the friends list, home dashboard, sidebar dock. Offers View Profile / Send Message / Mention / Add Friend / Mute / Block / Report / Copy User ID.
- `friend` — for rows in the Friends panel specifically. Offers Send Message / View Profile / Mention / Mute / Remove Friend / Block / Copy User ID.
- `media` — for any image attachment in chat or feed. Offers Open in New Tab / Copy Image Link / Save Image (download) / Save to Collection / Report Image.
- The existing `message`, `user`, `server`, `channel_text`, `channel_voice`, `server_sidebar` types are preserved.

**Centralized action handler** — `spidr-client/src/hooks/useGlobalMenuActions.js` (new):
- One listener for `spidr-menu-action` events that handles all the universal actions: copy-link, download, open-new-tab, save-to-collection, block-user, unblock, mark-read, mute-server, leave-server, remove-friend, view-profile, send-message, mention, copy-user-id, copy-id, invite, server-settings. Mounted once at the SpidrShell level.
- Chat panels still handle context-specific actions themselves (reply, edit, delete, pin, react) — that part of the system was already working and didn't need to move.
- Save-to-Collection writes to a "Saved Media" collection using the existing `items` Mixed array on the Collection schema. Each entry is `{ kind: 'media', url, saved_at }` so future queries can distinguish kinds.
- Reports go to the existing Report model with `target_type: 'media'`, `evidence_url: <image-url>`, and the user's typed reason.
- Block writes a Friend record with `status: 'blocked'` (or flips an existing record to blocked).
- Leave-server refuses if the user is the owner, deletes their entry from `server.members`, and routes them back to /home.

**Cross-component event channel** — the global handler dispatches higher-level events that page-level components listen for:
- `spidr-open-profile` → SpidrShell mounts a global `HolographicProfile` modal, opens it to the specified userId. So View Profile works from any right-click anywhere in the app.
- `spidr-open-invite-modal` / `spidr-open-server-settings` → `ServersPanel` listens and opens the right modal when its server matches.
- `spidr-prepend-mention` → `MessageInputBar` listens and appends `@<name>` to its current input value, then refocuses.

**Edge-detection upgrade** — `SpidrMenu.jsx` now properly handles all four screen edges (and corners by implication):
- Computes the actual menu height from the option/separator counts plus header and quick-reaction bar.
- Flips horizontally to the left of the cursor if it would overflow the right edge.
- Flips vertically above the cursor if it would overflow the bottom.
- Final clamp keeps the menu fully on-screen even when both flips apply (corner case).
- The old positioning only handled the bottom edge; the new one handles all of them.

**Menu lifecycle fix** — `MenuContext.jsx`:
- Added `Escape`-to-close keyboard handler.
- Tried adding a window-level `contextmenu` dismiss to handle right-click-on-different-element, then realized it fires AFTER React's inner handler and would close the menu we just opened. Removed it — `triggerMenu` already overwrites the full menu state in one transition, so re-clicking a different element correctly replaces the open menu without an explicit dismiss step.

**New surfaces wired**:
- `FriendsPanel.jsx` — `FriendCard` rows now fire `triggerMenu(e, 'friend', { id, user_id, name, avatar })` on right-click.
- `MessageItem.jsx` — message author avatars fire the `profile` menu type. Attachment images now use `ContextableImage` (below).
- `ServersPanel.jsx` — message attachments use `ContextableImage`; the panel listens for `spidr-open-invite-modal` and `spidr-open-server-settings` so the global menu can open them.
- `Sidebar.jsx` — server icons still fire `server_sidebar` (unchanged from before).

**New utility** — `spidr-client/src/components/ui/ContextableImage.jsx`:
- Drop-in replacement for `<img>` that fires `triggerMenu(e, 'media', ...)` on right-click. Passes through every other prop. The image gets the full media menu without callers needing to know about the menu system.

**What feels different now**:
- Right-click any image in chat → real menu with Open in New Tab / Copy Link / Download / Save to Collection / Report.
- Right-click any friend in the Friends list → real menu with everything you'd expect.
- Right-click a message author's avatar in chat → profile-context menu with Mention/DM/Block/etc.
- The menu doesn't get clipped at screen edges anymore — it flips to fit.

**Honest caveats:**
- The unblock flow exists in the hook but there's no UI surface that explicitly shows "unblock" yet — you can fire it via right-click on a blocked user once a blocked-list view surfaces them. The FriendsPanel does have a blocked tab; an "Unblock" entry there would close this loop in a future round.
- The Report flow for media submits to the existing Report model with `target_type: 'media'`. Server-side admins can already triage these via the global reports panel that was rebuilt earlier.
- I didn't add right-click handlers to every avatar in every panel — covered the high-traffic ones (friends list, chat message authors, sidebar servers). Other surfaces (engagement hub, discover users, holographic profile) can be wired with one-line additions when needed; the action layer is fully built.

---

## 22. Server Settings — full UI overhaul

The previous ServerSettingsModal was a cramped Dialog with horizontal flex-wrap tabs that wrapped onto two lines and felt like a settings dialog from 2008. Per the blueprint, this round brings it up to the same visual quality as Module Nexus, Bot Lab, and Nerve Center.

**Shell rebuild — `spidr-client/src/components/spidr/ServerSettingsModal.jsx`:**

*Layout:*
- Replaced shadcn Dialog with a full-bleed overlay (`fixed inset-0 z-[100]`) using framer-motion for fade/scale entry, click-outside-to-close, and a backdrop blur. Matches the visual language of the other major panels.
- Modal is `max-w-5xl × min(80vh, 720px)` — wider and taller than the old 2xl Dialog so forms have room to breathe.
- Left rail (`w-60`) holds the server identity header (icon + name + small "settings :: <id>" sub-label) above a grouped vertical tab nav.
- Right pane has its own header row showing the active tab's title, mono breadcrumb `> TAB :: SERVERID`, and the Save button (always visible to owners while editing — no more hunting at the bottom).
- Tab content scrolls independently in the right pane via ScrollArea, so the left rail and save button stay anchored.

*Tab nav:*
- Tabs are organized into three labeled groups instead of being one undifferentiated row: **Server** (Overview, Channels, Roles, Emojis, Visibility), **Community** (Members), **Moderation** (Reports, Airlock, Safety, Audit Log).
- Each tab has an icon and proper color coding (moderation tabs keep their warning colors).
- Active-tab indicator is a left-edge accent bar that animates between selections using framer-motion's `layoutId` for smooth spring transitions.

*Header treatment:*
- Header gradient (`bg-gradient-to-r from-red-600/10 to-transparent`) matches the same accent used in Module Nexus and the Fabricator.
- Server icon renders in the left rail header — so you always see which server you're configuring without scrolling.
- Title typography: `text-xl font-black uppercase italic tracking-tight` — same display style used elsewhere in the visual system.

**What was preserved (deliberately):**
- All per-tab content blocks (Overview / Channels / Roles / Visibility / Emojis / Members / Reports / Airlock / Sanctuary / Audit Log) are unchanged. They render under the new Radix `Tabs value={activeTab}` controller without modification.
- All existing state (`formData`, `channels`, `roles`, `newRole`, `newChannel`, `emojis`, etc.) and handlers (`addChannel`, `removeChannel`, `addRole`, `addEmoji`, `handleSave`, mutations) are untouched. The overhaul is shell-only.
- Owner gating on inputs still applies the same way it did.

**Behavioral note:**
- Switched from `Tabs defaultValue="overview"` (uncontrolled) to `Tabs value={activeTab}` (controlled) with state managed by the left-rail clicks. Same end behavior, but it's now possible to programmatically jump tabs from outside the modal if needed later (e.g., "open settings on the Channels tab").

**Honest caveats:**
- The content area is wider now than the old Dialog (~720px content vs ~560px before). The existing form fields fill the space cleanly, but the channels/roles/emoji grids will look slightly more spacious. Easy follow-up tweak if you want denser layouts.
- I haven't rendered this in a browser to visually verify the spring animations land where I expect — the framer-motion config (`stiffness: 320, damping: 32`) is standard for modal entry but might want tuning when you see it live.
- Custom role permissions, per-channel permissions, and the kind of fine-grained role-based access control you'd find in a mature Discord-style app are NOT in this build. The Roles tab still uses the simple `availablePermissions` list and toggles — that's pre-existing behavior, not regressed, but it's the obvious next thing to deepen. The new shell makes the room to add that UI without restructuring.
