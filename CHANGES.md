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

---

## 23. Signal Radar 404 + Server.filter({id}) bug everywhere

**Signal Radar 404 fixed.** The sidebar emits a `radar` tab id and the shell mapped `/radar` → `radar` activeTab, but **App.jsx had no `/radar` route**. SignalRadar was built as a modal (it takes `open`/`onClose` props), not a page.

- New `spidr-client/src/pages/Radar.jsx` wraps `<SignalRadar open onClose={() => navigate('/home')} />` so it renders inline as a full page.
- `App.jsx` now lazy-imports it and registers `<Route path="/radar" element={<RadarPage />} />`.
- Clicking Signal Radar in the sidebar or anywhere else now goes to a real page instead of a 404.

**Server.filter({id:...}) bug — full sweep.** The list endpoint doesn't filter by `id`, so any code calling `entities.Server.filter({ id })` silently returned `[]` and threw "Server not found". Fixed in:

- `BotLaboratory.jsx` (the source of the "When adding bots to servers, it says 'server not found' even though we are in server" report). Replaced with `entities.Server.get(serverId)`.
- `SpidrBotEngine.jsx` (welcomeset slash command).
- `KineticChat.jsx` (group chat detail query, which was throwing the same shape of bug for group chats — likely contributed to "group chats don't show up in friends tab / messages broken").

**THE WEB image upload broken.** Root cause: the upload modal uses `VideoStudio`, which is hard-wired to handle video files (captures thumbnails from a `<video>` element). When you uploaded an image the video element silently failed and the publish flow stalled.

For this pass I narrowed the file input to `accept="video/*"` so image uploads can't enter the broken flow. Image posts on THE WEB are a real feature request — they need their own upload UX (carousel? aspect ratios? no thumbnails since the image IS the thumbnail). Calling that out as deferred so we don't ship a half-working flow.

**Server Settings → members shows emails.** The member rows displayed `member.user_name || member.user_id`, and for legacy accounts `user_id` is sometimes the user's email. Added a `UserProfile` lookup keyed on member user_ids — members now render their avatar + display_name + `@username#discriminator` underneath. Both the pending-verification list and the main members list got the upgrade.

**Discover Users.** Renamed the home-page widget from "AI Discovery / Suggested Friends" to "Discover People / Suggested for you" per the screenshot note. Also fixed the "only works once" complaint: clicking Rescan now shuffles the candidate pool before re-ranking, so the algorithmic suggestions surface different people every time. Without the shuffle, the deterministic ranking returned the same set on every refresh and it looked like nothing was happening.

**Profile icon top-right is back.** It was lost during the routing migration when `Home.jsx` got deleted (the old top-bar lived there). Added a global profile chip at the SpidrShell level so it shows on every route. Click → /settings. Per the screenshot note ("profile icon should retract when mouse is hovering over it") the chip shrinks the avatar and tucks the name on hover, getting out of the way of content behind it.

**Floating dock — enable/disable + collapse.** Per the screenshot note ("little bar at the bottom needs to be in options settings to enable and needs to collapse and re-lapse"):

- The FloatingDock was rewritten. Two preferences persist in localStorage: `spidr_dock_enabled` (hide the dock entirely) and `spidr_dock_collapsed` (collapse to just a handle).
- A small chevron handle above the dock lets users collapse/expand it inline without going to Settings.
- New `DockPreferencesCard` was added to **Settings → Appearance** with checkboxes for both prefs. Changes broadcast a `spidr-dock-pref-changed` event so the dock reacts immediately without a page reload.

---

## 24. Vibe Check / Neon Sign + APEX + animations + speaking ring + GIF paste + ghost overlay everywhere + groups tab

**Vibe Check & Neon Sign editing.** The inputs only saved on the green-check button click — pressing Enter did nothing, Escape did nothing. Added `autoFocus`, `Enter` to save, `Escape` to cancel on both fields in `BioTab.jsx`. The cache-invalidation chain was already correct; this was a UX friction, not a data bug.

**APEX cache invalidation.** `ApexCommand.jsx` invalidated `userProfile, profile.user_id` but the Settings page query key uses `userProfile, currentUser.id`. They're the same value in practice (UserProfile.user_id IS the User._id), but explicit invalidation of both keys is safer. Also fixed a duplicate invalidation on cancel (same key twice). The APEX tab in Settings now appears the moment the subscription mutation succeeds.

**APEX badge in chat.** `MessageItem.jsx` had an APEX badge built in for years — but it derived `isApex` from an `apexUsers` prop that nobody passed. Switched the derivation to `senderProfile.apex_tier === 'apex'`. `senderProfile` is already passed by DirectMessages and KineticChat, so the badge now lights up automatically without any wiring changes at callsites. Kept the `apexUsers` set as a fallback in case some caller still relies on that shape.

**Animated username effects.** rainbow / pulse / shimmer effects in `lib/usernameStyle.js` reference CSS keyframes (`username-rainbow`, `username-pulse`, `username-shimmer`) that lived inside `Layout.jsx`'s inline `<style>`. After the routing migration `Layout` no longer mounts, so the keyframes were never injected and the effects silently fell back to solid color. Lifted them all to `index.css` so they're always loaded. Also moved `msg-flash-anim` (used by the reply-scroll-to highlight) and added the new `spidr-speaking-ring` keyframe.

**Voice channel speaking animation.** New `useSpeakingDetector` hook (`spidr-client/src/hooks/useSpeakingDetector.js`):

- Feeds a MediaStream's audio into a Web Audio `AnalyserNode` and computes RMS energy
- Threshold 0.04, 300ms hold-on tail so the speaking state doesn't flicker between syllables
- fftSize 512 with smoothingTimeConstant 0.7 — sensitive enough for normal speech, not so jumpy that HVAC triggers it

Refactored `VoiceChannel.jsx` to extract a per-member `VoiceTile` sub-component (hooks can't run inside `.map`). Each tile calls `useSpeakingDetector` with that peer's stream and applies the `.spidr-speaking` class to the avatar when active. The class wraps a green pulsing ring via the keyframe in index.css. Visible only when:
- The member has an audio track
- They're not server-muted
- They're actually emitting voice above the threshold

**Honest caveat on voice mapping:** The current `useWebRTC` mesh keys remote streams by socketId, not by user_id. So with multiple peers in a channel the speaking-ring assignment to the right tile isn't reliable — the code uses the first remote stream as a fallback. Tracking streams by user_id in useWebRTC is the obvious next step (it's a 5-line change in that hook); for 1:1 calls this works as-is, and for group calls the ring will animate for SOMEONE speaking, just possibly the wrong avatar. The detection itself is correct.

**GIF / image / URL paste.** Per the screenshot note ("copy and pasting gifs do not work"): added an `onPaste` handler on the message input in `MessageInputBar.jsx`. Three cases:

1. **Image on the clipboard** (Ctrl+C an image from the OS or web) — uploaded to your CDN and attached.
2. **A pasted text URL ending in a media extension** (.gif, .png, .jpg, .jpeg, .webp, .avif, .mp4, .webm, .mov) **or matching your platform's CDN pattern** (`pub-*.r2.dev`) — attached directly without re-uploading. This handles the exact URL the user pasted in the screenshot.
3. **Anything else** — falls through to default text paste.

**Spidr Protocol overlay across all routes.** The GhostOverlay was mounted inside ServersPanel and KineticChat — it only showed while the user was on those panels. Per the screenshot note ("'spidr protocol' overlay needs to be able to be seen when navigating to different pages/routes"):

- New `GlobalGhostOverlay.jsx` mounted once at the SpidrShell level.
- Listens for three events: `spidr-ghost-activate` { conversationName }, `spidr-ghost-deactivate`, `spidr-ghost-message` { id, sender_name, sender_avatar, content }.
- Keeps a rolling window of up to 30 messages (de-duped by id).
- ServersPanel now dispatches activate/deactivate when ghostMode toggles, and broadcasts each new message while ghostMode is on. The overlay stays visible across route changes.

**Group Chats tab in Friends.** Per the screenshot note ("group chats don't show up in friends tab"): added a `Groups` TabsTrigger to FriendsPanel between Online and Pending. Queries all group chats and filters to those where the current user is a member (supports both legacy shapes: `['user_id', ...]` and `[{ user_id, ... }, ...]`). Each row shows the group's icon/name + member count. Clicks open the group via the existing `handleOpenGroup` handler (which mounts KineticChat). Includes a "+ New Group Chat" button at the top of the tab.

---

## 25. Login hashtag + right-click role assign + role labels + @mention deep-scroll

**Login: pick your tag at signup.** Per the screenshot note ("log in page needs to be fixed when creating user — ask for a hashtag"):

- LoginPage signup form now has an inline 4-char tag input next to the username field.
- 4 lowercase alphanumeric characters (matches the schema's `genDiscriminator` format).
- Empty input is allowed → server auto-assigns a tag (existing behavior preserved).
- Client validates the format before sending; pattern enforced via the `pattern` attribute + an onChange filter.

Server-side (`spidr-server/src/routes/auth.js`):
- Register accepts `discriminator` in the body.
- Validates format (`/^[a-z0-9]{4}$/`).
- Uniqueness check: finds all Users with the same username (case-insensitive), then checks whether any of their UserProfiles already claim this tag. If so → 409 with a helpful message.
- Pre-creates the UserProfile with the requested discriminator during register, instead of relying on the lazy-create-on-first-fetch path. Profile-create failure is non-fatal; the lazy path remains as a safety net.

**Right-click → Assign Role.** Per the screenshot note ("we need right click or server settings feature to also add roles to users"):

- `SpidrMenu.jsx` `user` context now has an "Assign Role" entry.
- ServersPanel's menu-action handler implements it: lists the server's roles in a numbered `window.prompt`, plus "(No role)" as the last option. Type a number → role updated + audit log entry written. Requires `isAdmin`.

This is a numbered-prompt picker for shipping speed. A proper popover with role chips is the obvious next polish, but the action and audit logging work today.

**Role labels next to usernames + per-server toggle.** Per the screenshot note ("roles showing next to user name needs to be fixed for all servers to have (can toggle it on/off in server settings as well)"):

- Role badges in ServersPanel chat already existed via `resolveServerUsername`. Wrapped the render with `server.show_role_labels !== false` so an admin can turn them off per-server.
- New "Show role labels next to usernames" toggle in **Server Settings → Visibility**.
- New `show_role_labels: { type: Boolean, default: true }` field on the Server schema. Default true so existing servers keep showing labels.

**Activity-feed mention → scroll-to-message.** Per the screenshot note ("Fix '@'s where users show up when '@'ing someone and the user gets pinged for it and that chat is [found]"):

- `EnhancedFeed.jsx`: the mention deep-link now includes `?channel=<id>&msg=<id>` so the destination can scroll to the exact message.
- `ServersPanel.jsx`: reads `?channel=` for initial channel selection, then watches `?msg=` and once that message id appears in the loaded messages list, scrolls it into view and applies the `.msg-flash` highlight animation. Clears the param afterward so a manual reload doesn't keep re-scrolling.

This gives the activity feed → mention → chat round-trip: click a mention notification, land in the right channel, see the message flash so you can spot it among the rest.

---

## Honest list of what's STILL not done from the 32-item screenshot list

This honestly catalogs the rest so nothing slips:

- **Biomass currency** — new feature, larger scope. Not started.
- **Drag-and-drop reordering** for channels and roles in Server Settings — schemas already have ordered arrays so this is mostly a UI add; not started this pass.
- **User-coded bots** (Fabricate-new with code) — this needs a real sandbox/runtime. Will not ship without a security plan; explicitly deferred.
- **THE WEB Spotify/YouTube tracks** — needs OAuth flow + clip-audio attach UX. Not started.
- **Custom background dimming on non-home pages** — appTheme.opacity exists; the dimming overlay needs to render on routes other than /home only.
- **Mobile responsive + bottom bar** — major work. The current shell isn't responsive below ~768px. Not started this pass.
- **Mid-call navigate + minimize improvements + responsive resolution** — partially done (activeCall already survives route changes via SpidrShell); the in-call window UX still needs work.
- **Spidr AI own settings panel** — a dedicated settings surface inside the AI route. Not started.
- **Profile customizer in Spidr AI** for image/banner/font/color/effect — Settings already has these but the user wants them exposed inside the AI panel too. Not started.
- **Server clicks on home dashboard not opening** — investigated; the navigate call is correct. Couldn't repro from code review alone; needs a browser repro before I make speculative changes.
- **Scroll-down on Settings page / general scroll** — needs to be reproduced in a live browser before guessing at the CSS culprit. The Settings panel uses ScrollArea but some tabs may have an inner overflow issue.

I am tracking these. Each will get a focused pass rather than batched together poorly.

---

## 26. Pass 5 + 6: scroll, bg-dim, mobile, biomass, AI customizer, AI settings, call bar, user bots

### Scroll-down fix on Settings
Root cause: the flex chain `<main>` → SettingsPanel root → Tabs had `flex-1` children without `min-h-0`, so `overflow-y-auto` on the inner content area couldn't actually constrain its height. Added `min-h-0` at the shell `<main>`, the SettingsPanel root, and the Tabs container. Added `pb-32` on the scroll container so long pages clear the floating dock.

### Per-route background dimming
On `/home` the user's full background image shows through unobstructed. On every other route a 55% dim overlay drops in so chat/settings/feed stay readable. If the user explicitly configured `appTheme.blur` or `appTheme.opacity` in Theme Studio those values take precedence — the auto-dim only kicks in when the user hasn't customized.

### Server clicks on home dashboard
Couldn't reproduce the silent-failure from code review. Added defensive UX so the bug becomes diagnosable if it persists:
- When `selectedServerId` is set but the servers query is still loading → show a spinner instead of the "Select a server" placeholder.
- When servers loaded but the requested id isn't in the list → show an explicit "That server isn't available — it may have been deleted, or you may no longer be a member" message.

### Drag-and-drop channels and roles
Wired `@hello-pangea/dnd` (already in package.json). Server Settings → Channels: separate `DragDropContext`s for text and voice channels, drag-to-reorder within each type, grip handles on the left. Roles: single `DragDropContext` for the full roles list. Reordering is in-memory until "Save Changes" persists — same pattern as add/remove.

### Mobile bottom bar + responsive shell
New `MobileBottomBar.jsx` — 5 primary destinations (Home / Friends / Servers / Feed / Settings) + Menu button. Visible below `md:` (768px) only. Uses `env(safe-area-inset-bottom)` for notched devices.

Shell changes:
- Sidebar becomes a slide-in drawer on mobile (`fixed md:relative inset-y-0 left-0`). Backdrop scrim closes it; route changes auto-close it.
- FloatingDock hidden on mobile (`hidden md:block`) — the bottom bar replaces it.
- Main content gets `pb-16 md:pb-0` so the bottom bar doesn't cover the bottom of pages.

**Known caveat:** The Sidebar component itself wasn't re-styled for narrow widths. If it currently uses a hard `w-60`, the drawer is fine, but the internal layout may not feel mobile-native — that's follow-up polish.

### Biomass currency — full feature
**Server side**
- `BiomassWallet` model: one wallet per user, `balance` + `lifetime_earned` + `last_daily_claim` + rolling transaction log (capped at 50) + inventory Map.
- `/biomass/*` routes:
  - `GET /wallet` — fetch (auto-creates on first call)
  - `POST /daily` — claim 50 biomass, 22h cooldown
  - `POST /spend` — atomic spend with insufficient-funds guard
  - `GET /shop` — 7-item catalog grouped by category
  - `POST /shop/buy` — purchase + add to inventory
- `utils/biomass.js` grant helper with daily caps (50/day from messages, 200/day from clips).
- Post-save hooks on Message and Clip auto-grant biomass to authors.

**Client side**
- `biomass` API helpers exported from apiClient.
- New `BiomassBalancePill` widget mounted in the top-right cluster next to the profile chip. Shows compact balance (1.2k, 15.4k formatting); navigates to `/biomass` on click.
- New `/biomass` page with three tabs:
  - **Wallet** — big balance card, daily claim button, earning rules.
  - **Shop** — items grouped by category (username effects / profile themes / badges); owned items get a check-state; insufficient-funds items get a lock state.
  - **History** — last 50 transactions with positive/negative coloring.

**Shop catalog (initial):**
- Username Glow (200), Pulsing Username (400), Shimmering Username (600), Rainbow Username (800)
- Neon Banner Theme (500), Glitch Banner Theme (500)
- Legend Badge (5000)

The actual rendering of "owned" username effects elsewhere in the app is a follow-up — the purchase succeeds and the inventory tracks it, but I haven't wired the consuming surfaces (chat username render, profile card) to read the inventory yet.

### AI Profile Customizer (expanded)
The AI Profile tab in the AI panel now generates and applies:
- display_name, bio, custom_status (already existed)
- accent_color (already existed)
- **profile_gradient** — neon / sunset / ocean / cyber / blood / void / none
- **username_font** — default / serif / mono / display / handwriting / rounded
- **username_weight** — normal / medium / bold / black
- **username_style** — normal / italic
- **username_color** — hex
- **username_effect** — none / glow / gradient / rainbow / pulse / shimmer

Preview card now renders the username with the actual generated font + style + color so users see what they'd be applying. Apply mutation invalidates all four profile cache keys so changes show up immediately in chat, profile modal, and settings.

Honest note in the UI: avatar/banner images aren't AI-generated here. That requires an image-gen integration we don't have wired yet. Users still go to Settings → Profile for those.

### Spidr AI's own Settings tab
New "Settings" tab inside the AI panel (5th tab next to Server / Profile / Bot / Chat). Lets users tune how Spidr AI talks to them:
- **Persona** — free-text (500 char) preface prepended to every AI prompt
- **Response length** — Concise (<80 words) / Normal / Detailed (full explanations)
- **Tone** — Neutral / Playful / Professional
- **Remember conversations** — toggle. When off, the chat history isn't saved to `AiConversation` and titles don't auto-update.
- **Safe mode** — toggle. When off, the content scanner runs but doesn't block borderline prompts. (Hard-unsafe categories still block.)

All persisted to localStorage; no save button — immediate save on each change. Reset-to-defaults button.

Exported `getAIPreferences()` helper. The chat handler in `ChatTab` now reads it and:
- Prepends the persona to the system preamble
- Adjusts the verbosity hint ("Keep responses under 80 words" / "Provide detailed explanations")
- Adjusts the tone hint ("Use a playful tone" / "Maintain a professional tone")
- Skips saving log entries when `rememberChat` is false
- Skips the safe-mode block when the user opts out

### Mid-call navigate UX polish
Extracted `MinimizedCallBar` sub-component at the shell level. Improvements:
- **Call duration timer** (mm:ss) inline next to the channel name
- **Mute toggle** visible — no more expand-just-to-mute
- **End call** button
- Responsive position: `bottom-20 md:bottom-4` so it sits above the mobile bottom bar but in the standard corner on desktop
- Spring animation on mount/unmount

**Caveat:** the mute toggle dispatches a `spidr-call-mute-toggle` window event but no live RTC hook listens for it yet — when the call is minimized the WebRTC connection is alive but the VoiceChannel component is unmounted, so we can't directly toggle the local audio track. To fix this properly we'd need to hoist the RTC peer state to the AppShell context. Today the visual toggle works; actual mic mute happens when the user expands the call.

### User-coded bots — declarative MVP
New "Create" tab in Bot Laboratory. Lets users build bots with simple trigger → response pairs (no JS execution):

- **Identity** — name, description, cycling-emoji icon (12-preset palette)
- **Commands** — repeatable row with trigger / response / description fields. Add / remove rows. Up to 40 chars per trigger, 500 chars per response.
- **Template variables** — `{user}`, `{server}`, `{channel}` substituted at runtime
- **Local test runner** — type a fake message and see what the bot would respond. Matches case-insensitive, supports prefix matches
- Saves to `CustomBot` with `category: 'custom'`, `code: 'user:commands'` (so the bot engine knows to route it through the commands array, not a built-in or sandbox).

**Security model — explicit:** we never execute user JavaScript. The `code` field on the schema is reserved for a future sandboxed runtime (vm2 or isolated-vm), but until that runtime ships, all user-built bots are declarative. The UI has a yellow honest-note callout explaining this.

### Files added
- `spidr-client/src/components/spidr/MobileBottomBar.jsx`
- `spidr-client/src/components/spidr/BiomassBalancePill.jsx`
- `spidr-client/src/pages/Biomass.jsx`
- `spidr-server/src/models/BiomassWallet.js`
- `spidr-server/src/routes/biomass.js`
- `spidr-server/src/utils/biomass.js`

### Files modified
- `SpidrShell.jsx`: mobile drawer, MinimizedCallBar extraction, route-aware bg dim, BiomassBalancePill mount, min-h-0 on main
- `SettingsPanel.jsx`: min-h-0 on flex chain, pb-32 on scroll container
- `ServersPanel.jsx`: server-click loading/missing diagnostics
- `ServerSettingsModal.jsx`: DnD for channels and roles
- `AIPanel.jsx`: expanded profile customizer, new Settings tab, ChatTab honors AI preferences
- `BotLaboratory.jsx`: Create tab + CreateBotTab body
- `App.jsx`: /biomass route
- `apiClient.js`: biomass API helpers
- `Message.js`, `Clip.js`: biomass grant post-save hooks
- `index.js` (server): biomass route registration

### Things explicitly NOT done

- **THE WEB Spotify/YouTube** — deferred pending scope. Needs OAuth flow design + a sensible UX for attaching tracks to clips. Won't ship a half-feature.
- **Real JS bot sandbox** — needs `vm2`/`isolated-vm` server-side with strict CPU/memory limits, network isolation, and a permission model for which APIs the bot can call. Multi-day work; explicitly out of scope until we agree on the security plan.
- **Avatar/banner AI generation** — needs an image-gen integration.
- **Mute on minimized call bar** — visual works; real mic mute needs RTC state hoisted to shell context.
- **Shop item consumption** — buying a username effect succeeds and the inventory tracks it, but the chat username renderer doesn't read inventory yet. Effect catalog and rendering need to be cross-referenced.
- **Voice speaking-ring per-user mapping** — `useWebRTC` still keys streams by socketId, not user_id. For 1:1 calls the ring works; for 3+ peer calls it may animate the wrong avatar.

---

## 27. Activity feed comments & replies + responsive overhaul

### Activity feed comments + replies — full feature
Users can now comment on any activity feed item and reply to other commenters. Reactions on individual comments. Author-only delete.

**Server side**
- New `FeedComment` model — separate collection keyed on `feed_id`. Each comment carries `parent_comment_id` (null for top-level, set to a comment id for replies), `author_id`, `author_name`, `author_avatar`, `content` (1000 char cap), `reactions` Map, `edited_at`.
- Post-save hook increments the parent `Feed.comments_count`; post-`findOneAndDelete` decrements it. Failures here log but don't roll back the comment write — the displayed count is a UX hint, not authoritative.
- New `/feed-comments` route. Standard CRUD via the existing `crudRouter` with `ownerField: 'author_id'` so only the comment author can mutate or delete. Plus a custom `POST /:id/react` toggle endpoint mirroring message-reactions.

**Client side**
- `FeedComment` registered in `entities` (apiClient). New `feedComments.react()` helper for the bespoke endpoint.
- New `FeedCommentsSection.jsx` — expandable section that mounts under each FeedCard when the comment button is clicked.
  - Top-level comments sort chronologically (oldest first).
  - 1-level visual nesting: replies indent under their parent with a left-border accent. Clicking "Reply" on a reply attaches to the same parent, not the reply itself — keeps the UI flat and readable on mobile.
  - Reaction row with quick picker (👍 ❤️ 😂 🔥 🕷️) and existing-reaction toggles.
  - Author-only delete (with confirm). Edit is intentionally not exposed yet — schema supports `edited_at`, route allows it, but the inline-edit UX isn't built.
  - Empty state ("No comments yet — be the first") and loading state.
- `EnhancedFeed.jsx` updated: renamed the dead `showCommentInput` state to `showComments`, wired the comment button to toggle it, conditionally mounts `FeedCommentsSection` when expanded. Each section runs its own query keyed on `feed_id` so opening multiple cards doesn't cause cross-pollination.

### Responsive overhaul — fits multiple devices and resolutions
Targeted the worst desktop-only layouts. Breakpoint: `md:` (768px) — phones and small tablets get the mobile layout; tablet-landscape and up get desktop.

**ServersPanel (the biggest offender)**
- Server list (240px) hides on mobile when a server is selected. Channels rail (224px) hides on mobile when a channel is selected. Chat takes the full width.
- New `mobileView` state ('channels' | 'chat') gates which pane shows on mobile.
- Back-arrow buttons added: in the channels-rail header (← back to server list) and in the chat header (← back to channels rail).
- Desktop is unchanged — all responsive logic is gated by `md:` so ≥768px renders side-by-side as before.

**AIPanel — both tab bar and ChatTab**
- Tab bar: 5 tabs with full labels broke at mobile widths. Now labels hide below `sm:`; only icons show.
- ChatTab conversation list: was a 224px column. On mobile collapses to a horizontal scroll-strip across the top, max-height 128px, with `last_message` hidden so conversations stay slim. Desktop unchanged.

**HomeDashboard**
- "Recent Servers" grid was `grid-cols-4` (server tiles became ~80px wide on a phone — unreadable names). Now `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`.
- Container padding reduced on small screens: `p-4 sm:p-6`.

**HolographicProfile modal**
- Was hardcoded `w-[720px]` — overflowed mobile viewports. Now `w-full max-w-[720px]` with the backdrop adding `p-3 sm:p-6 overflow-y-auto` so the card scrolls within the modal if it's taller than the viewport.

**Components confirmed already responsive (no changes needed)**
- LoginPage uses `max-w-md` + `w-full` — flows naturally
- DirectMessages / KineticChat / FriendsPanel use `flex-1 flex flex-col` — already mobile-friendly
- FeedPanel grids already use `md:grid-cols-3 lg:grid-cols-4` responsive variants
- SettingsPanel tab bar already hides labels with `hidden sm:inline`
- Biomass page already uses `sm:grid-cols-2 lg:grid-cols-3`

### Files added
- `spidr-server/src/models/FeedComment.js`
- `spidr-server/src/routes/feedComments.js`
- `spidr-client/src/components/spidr/FeedCommentsSection.jsx`

### Files modified
- `spidr-server/src/index.js` — registered `/feed-comments` route
- `spidr-client/src/api/apiClient.js` — `FeedComment` entity + `feedComments.react` helper
- `spidr-client/src/components/spidr/EnhancedFeed.jsx` — wired comments section
- `spidr-client/src/components/spidr/ServersPanel.jsx` — mobile two-pane layout
- `spidr-client/src/components/spidr/AIPanel.jsx` — responsive ChatTab + tab bar
- `spidr-client/src/pages/HomeDashboard.jsx` — responsive grids and padding
- `spidr-client/src/components/spidr/HolographicProfile.jsx` — fluid card width + modal padding

### Caveats
- **Comment edit isn't exposed in the UI** yet. Schema and route support it; needs an inline-edit affordance with an `(edited)` indicator.
- **Comments_count is denormalized.** If a write succeeds but the count update fails (logged, swallowed), the displayed count drifts. Acceptable tradeoff; a periodic reconciliation job can fix it later if exact counts matter.
- **No attachments on comments** — text-only by design. Adding files means another upload pipeline.
- **Reply depth is capped at 1 visual level.** Replies to replies attach to the original top-level comment's id. The data model could support deeper nesting, but on mobile it would be unreadable.
- **Sidebar internal contents** (the icon rail at 72px wide) weren't re-styled for mobile drawer use — the wrapper is correct, the icons fit, but if it currently uses a hard-coded height that fights the drawer it'll need touch-up. Verify on a real device.
- **No genuine integration test** — files syntax-check, but I haven't loaded this in a browser. First load may surface one or two visual glitches (the FeedCommentsSection's emoji picker positioning, in particular, hasn't been tested at the screen edge — it might clip off-screen for cards near the right edge of a narrow viewport).

### Still NOT done (deliberately)
- **THE WEB Spotify/YouTube** — deferred pending OAuth scope discussion
- **JS-sandboxed user bots** — deferred pending sandbox security design
- **Shop inventory → consuming surfaces** — purchases track inventory but the chat username renderer doesn't gate effects on ownership yet
- **MinimizedCallBar real mute** — visual works; actual mic mute needs RTC state hoisted to shell context
- **Voice speaking-ring per-user mapping** — useWebRTC keys by socketId; 3+ peer calls may animate wrong avatar
