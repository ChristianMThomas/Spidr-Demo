const express = require('express');
const router = express.Router();

/**
 * GET /system/news — Spidr System announcements (patch notes, alerts, fixes).
 *
 * Server-curated list. Newest first. Each item:
 *   { id, title, date (ISO), type: 'UPDATE'|'ALERT'|'FIX', description }
 *
 * Kept in-code for now (no DB model needed); the client also ships a mock copy
 * so the terminal renders instantly even if this route is unreachable.
 */
const NEWS = [
  {
    id: 'p1963',
    title: 'Patch 1.9.63 — Mobile DM unread counts finally show up and clear like Discord',
    date: '2026-08-20',
    type: 'FIX',
    description: 'Direct-message unread badges on the mobile app were a ghost feature — the count query worked but the mark-as-read call POSTed to /direct-messages/mark-conversation-read while the server only exposed /direct-messages/read-conversation, so every open silently 404\'d and the badge never cleared once it appeared. Fixed by aligning the mobile unreadContext to the real route so opening a DM immediately drops the count to zero, exactly like Discord. Same pass makes the count actually visible in three places instead of one lonely tab-bar dot: the Home stat tile "Friends" now carries a red overlay badge with the current unread total (imports useUnread and threads it through a new badge prop on StatTile), the RECENTS strip on the Friends screen now paints a red count on the top-right of each SpidrWebHead avatar and re-sorts unread-first so DM\'d friends bubble to the front instead of only shuffling in Recents, and the bottom-tab Friends badge value is now coerced to a string for cross-platform safety on Expo\'s native bottom tabs. UnreadContext also grew an AppState "change → active" listener that invalidates the unread-dms query whenever the app returns to the foreground, so a DM that lands overnight (socket events don\'t fire while backgrounded) actually bumps the badge the moment the user reopens the app instead of waiting for the next manual navigation.',
  },
  {
    id: 'p1962',
    title: 'Patch 1.9.62 — Group missed-call rows + ghost-row kill + server-resolved caller names',
    date: '2026-08-19',
    type: 'FIX',
    description: 'Follow-up pass on the 1.9.61 missed-call work — three real bugs closed and the mobile side finally renders these system rows properly. Group chats now write their own missed-call bubbles: previously only DMs got a "didn\'t answer" row when a ring went unanswered or was declined; call:decline / call:cancel / no-answer on the group lane now writes a GroupChatMessage with is_missed_call set and snapshots the group name at write time, and MessageItem grew a group branch so the caller sees "You tried calling <group>" while every other member sees "<caller> called <group>". The ghost missed-call bug is closed — hanging up a connected call also fires call:cancel from the caller, which was silently stamping every completed call with a "didn\'t answer" system row on top of the real conversation; a new answeredCalls Set on the socket layer flips on the moment call:accept fires and short-circuits writeMissedCall so a hang-up after a connect leaves no ghost row behind. Caller names are now resolved server-side inside writeMissedCall — mobile\'s call:cancel and call:decline never carried callerName in the payload, so every missed-call row written from a phone rendered as "Someone" on the receiver\'s bubble; a new displayNameOf helper looks the caller\'s display_name up from UserProfile at write time and both DirectMessage.sender_name and GroupChatMessage.user_name land with the real handle regardless of which platform hung up. Mobile MessageBubble.tsx grew a centered PhoneMissed alert branch that mirrors the web output — DM lane says "<peer> didn\'t answer" for the caller and "You missed a call from <caller>" for the callee, group lane says "You tried calling <group>" for the caller and "<caller> called <group>" for members — so mobile chat threads stop rendering these rows as raw "Missed call from X" bubbles that looked like a normal chat message. Web-side DirectMessages.jsx now guards the outgoing call:cancel behind the no-answer timer being live — once that timer clears the call either connected or already wrote its own unanswered row, and cancelling again duplicated the missed-call bubble on the receiver. The DM header on narrow viewports (search + hamburger) now stretches the full 56px header height with h-full grid place-items-center so the icons stop floating in a 33px box in the middle of the bar and get a 44px hit target. Also swept up: mobile friends and group screens now prefer group.avatar_url over the older icon_url fallback so freshly-uploaded group images actually render, and web-side polish across SpidrWebMatrix, KineticChat, HomeDashboard, Layout, and globals.css tags along for the ride.',
  },
  {
    id: 'p1961',
    title: 'Patch 1.9.61 — Notifications broker + Close Friends + video-call fix',
    date: '2026-08-19',
    type: 'UPDATE',
    description: 'Mobile push finally passes through a single decision point instead of firing blindly from every socket handler. The new spidr-server/src/utils/notifications.js broker gates every non-call signal on the recipient\'s master toggle, then the per-type toggle (dm, server_mentions, friend_requests, voice_calls), then Do Not Disturb, then Close Friend breakthrough — so a user with voice_calls off is no longer woken by rings, a user in DND stays silent unless the caller is a starred close friend and urgent_dms is on, and every toggle on the mobile Notifications settings screen actually enforces at the server for the first time. DMs, @-mentions in server channels, friend requests, and voice-call invites all funnel through the broker now, riding alongside the existing socket emit so realtime UX is untouched. push.js gains sendVisiblePush — a banner+sound APNs/FCM path with a title, body, and a data envelope that survives lock-screen and cold-launch — reserved for non-call signals so CallKit stays exclusive to actual rings. Close Friends becomes a real feature: Friend gains an is_close_friend field, a new PATCH /friends/:id/close endpoint flips it (owner-guarded), and mobile ProfileView gets a yellow star toggle sitting inside the accepted-friend action row that lights up when a friend is marked close — the broker\'s DND breakthrough reads that same flag. The DM chat header video button was silently routing through the voice path because both buttons called handleStartCall(false) with no way to say "start with camera on" — it now takes an explicit startWithVideo flag that flips isVideoOn and the call:invite kind, so pressing camera actually invites the other person to a video call. Missed-call system bubbles on the caller\'s side used to say "Someone didn\'t answer" because the row echoed the caller\'s own name instead of the recipient\'s; the socket writeMissedCall now looks up the recipient\'s display_name and persists it as recipient_name on the DirectMessage row, and MessageItem renders the correct side ("Sammy123 didn\'t answer" when you called them, "You missed a call from Sammy123" when they called you). Push taps route deeper too: callManager.handlePushData now branches on dm / server_mention / friend_request and expo-router.push()es straight to the conversation, the server channel, or the friends tab, so a tapped banner lands you where the signal came from instead of an empty home screen.',
  },
  {
    id: 'p1960',
    title: 'Patch 1.9.60 — Native mobile calls: iOS PushKit prep + FCM push wiring',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Native mobile calls come back online after the July 6 shelving — the whole WebRTC + CallKeep + FCM push stack that was stashed under patches/native-calls/ is re-applied so mobile Spidr can actually ring. Server: new PushToken model + /push-tokens/register and /unregister routes for device-token registry, a firebase-admin utility that sends silent data-only high-priority pushes for incoming-call and call-ended events, and the DM socket call:invite / accept / decline / cancel handlers now fire the push alongside the socket relay so recipients ring even when backgrounded or killed. Mobile: callManager owns the call brain — socket + FCM ring dedupe, CallKit / ConnectionService for native lock-screen ring, a WebRTC mesh joined into the SAME voice:server:dm:<conversationId> room the web voice deck uses so mobile and web callers land in one session, and Settings > Voice & Video prefs (mic constraints, join-muted, camera-off-on-join, speaker default) apply at media join. The in-call screen (app/call/[id].tsx) is a fresh full-screen dark UI with a pulsing avatar for voice, RTCView remote streams with a self-view PIP for video, and a bottom row of mute / speaker / camera / end controls. A custom index.js entry registers the FCM background handler before the React tree loads so a ring push received on a killed app still fires the native ring, and callManager consumes that stashed ring on the next launch to connect the call. The web caller now passes kind: video | voice through call:invite so mobile renders the right incoming UI. EAS build pipeline scaffolded (development / preview / production), a custom Expo config plugin injects use_modular_headers! and $RNFirebaseDisableSPM into the Podfile every prebuild so react-native-firebase links cleanly against static frameworks, iOS gets the aps-environment=development entitlement plus UIBackgroundModes voip + remote-notification so APNs registration actually prompts for notification permission, and Android gets the full call-related permission set. Security hardening: root .gitignore now hard-blocks spidr-secure/, *firebase-adminsdk*.json, *serviceAccount*.json, AuthKey_*.p8, and every *.p8 / *.p12 / *.mobileprovision / *.keystore anywhere in the tree so no admin credential can drift into a commit.',
  },
  {
    id: 'p1959',
    title: 'Patch 1.9.59 — The Spidr Web Matrix',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Jump Back In and the Spidr Web pinned strip were two separate surfaces competing for space. They are now ONE tabbed glassmorphic panel on the homepage. The Jump Back In tab lists recent DMs and group chats in a unified feed where hovering rings the avatar in symbiote red and lights the name to match. The Spidr Web tab shows your pinned connections wearing the signature red-to-purple gradient ring with a pushpin badge tucked into the corner, a live presence dot on pinned DMs, and a hover wash that bleeds red into purple across the row. Tabs carry their own accent — red for recent, purple for the Web — with a glowing underline on the active one and a live pin count. Pins update instantly: pinning from any right-click menu anywhere in the app re-renders the panel through the existing pins event, no refresh. The list scrolls inside a fixed-height panel with a custom 4px scrollbar that is nearly invisible at rest and fades to symbiote red when you hover the list, so a long conversation history no longer stretches the homepage. The panel appears at every screen size — as the sticky right rail on wide displays and in the main column below that — and the old single-purpose Jump Back In component was deleted rather than left behind as dead code.',
  },
  {
    id: 'p1958',
    title: 'Patch 1.9.58 — The Core actually lands this time',
    date: '2026-08-18',
    type: 'FIX',
    description: 'The Spidr Core button was built last patch but you never saw it, and the reason was entirely my error: I implemented it in FloatingDock.jsx, a component that is not rendered anywhere in the app. Nothing imports it. The real desktop navigation rail is Sidebar.jsx, and that is where the Core now lives. Dormant it sits desaturated and dimmed behind a glass sheen; hovering drops the grayscale, cranks brightness to full, and lunges the spider up in scale; active it BREATHES on a three-second loop where the mascot and its red aura expand and contract together, with a glowing red indicator bar on the left rail and a HOME label that lights red beneath it. Clicking fires the synthesized symbiote heartbeat — a two-beat lub-dub of low sine thumps sweeping 62Hz to 34Hz, generated live by the Web Audio sound engine rather than shipped as an MP3. The orphaned FloatingDock file now carries a prominent banner warning that it is dead code and that edits there have no effect, so nobody repeats this mistake. The literal Home lucide icon that previously sat at the top of the sidebar is gone, replaced by the mascot itself.',
  },
  {
    id: 'p1957',
    title: 'Patch 1.9.57 — The Spidr Core breathes + native titlebar',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'The home button in the floating dock is now the Spidr Core. Dormant it sits desaturated and dim behind a subtle glass sheen; hovering lunges it to full color and scale; active it BREATHES — a three-second loop where the spider and its red aura expand and contract, so the app\'s anchor point feels alive instead of static. Clicking fires a symbiote heartbeat: a synthesized two-beat lub-dub, low sine thumps sweeping 62Hz down to 34Hz through a lowpass, the second beat quieter and slightly higher 145ms after the first — generated live by the existing Web Audio sound engine rather than shipped as an MP3. The sound engine now shares the app-wide audio context singleton instead of opening its own, which used to count against Chrome\'s six-context cap alongside the voice analysers. The Electron title bar switches from a hand-rolled frameless strip to native titleBarStyle + titleBarOverlay, so Windows and Linux draw REAL minimize/maximize/close buttons directly over our header (same as VS Code and Discord) and macOS keeps its traffic lights inset in the expected spot — our own window-control buttons are gone. And a global broken-image safety net lands: a single capture-phase listener at the document root now catches every <img> failure app-wide and swaps in an inline SVG spider placeholder, replacing the browser\'s torn-page glyph wherever an avatar or server icon URL goes dead.',
  },
  {
    id: 'p1956',
    title: 'Patch 1.9.56 — In-app updater + WEB profile relabel',
    date: '2026-07-26',
    type: 'UPDATE',
    description: 'Desktop gains true in-app updates — the packaged Electron client now checks a GitHub Releases feed on launch (via electron-updater), surfaces "Update available" through a new IPC bridge (checkForUpdates / downloadUpdate / quitAndInstall) that\'s guarded to packaged builds so npm run electron-dev still boots cleanly, and installs the new NSIS package on the user\'s next quit — no more manual re-download from spidrapp.com to pull a patch. WEB profile counters get their names swapped for something users actually parse — "Resonance" is now "Likes" on both web and mobile (the internal ranking algorithm still uses the word, this is a display-only rename; Strands and Impact untouched). Mobile grows two new bottom sheets — ReactionSheet for tap-to-react on clips and SlingSheet for the WEB sling menu — plus a proper NotFound screen that stops dead invite links from parking the app on an infinite spinner. Home page adds a new UpdatesCard widget that reads the same NEWS feed the SPIDR_SYS terminal uses. Also under the hood: mobile queryClient and apiClient tuning, DM/group/server-channel screen polish, landing page component refresh across Hero, Navbar, Community, Platforms, WhySpidr, Footer, Download, Features, and BetaSignupModal, and a new fixes/MOBILE-VOICE-CHANNELS-PLAN.md that lays out the react-native-webrtc + custom dev-client migration path so real server VC join can land in a future patch.',
  },
  {
    id: 'p1955',
    title: 'Patch 1.9.55 — APEX store recognizes existing subscribers',
    date: '2026-07-22',
    type: 'FIX',
    description: 'Opening the APEX upgrade screen while already subscribed used to still show the "$7.99/mo — INITIATE UPGRADE" pitch (with the CTA button just relabeled to MANAGE SUBSCRIPTION), which read like the app didn\'t know you had already paid. The pitch column now flips to a clear "YOU ALREADY HAVE APEX" confirmation with a check icon and a subdued MANAGE SUBSCRIPTION button when currentTier is apex, and the status pill in the header switches from UNLOCKED to ACTIVE. The feature grid and the top-right settings gear are unchanged, so managing the subscription is still one click away.',
  },
  {
    id: 'p1954',
    title: 'Patch 1.9.54 — Landing redesign + Electron URL hardening',
    date: '2026-07-22',
    type: 'UPDATE',
    description: 'Landing site (spidrapp.com) gets a design refresh across the marketing surface — Hero, Navbar, Community, Platforms, WhySpidr, and Footer all updated in one pass, with the beta-signup counter finally wired to the correct Railway API (spidr-demo-prod.up.railway.app) so "SPOTS LEFT" renders live on first paint again. Electron desktop gains renderer navigation hardening — a new hardenWebContents guard intercepts will-navigate, will-redirect, and window.open on every BrowserWindow (main, popout, and Spidr Protocol overlay) and refuses anything off-origin; when the destination is http, https, or mailto it is handed to the OS browser via a safeOpenExternal wrapper that validates the URL scheme against an allowlist so crafted chat links or compromised widgets can\'t launch file:// or hijack custom URI schemes registered by other apps. Also drops the standalone electron-builder.yml — the full build config now lives in package.json so there is only one source of truth for installer packaging.',
  },
  {
    id: 'p1953',
    title: 'Patch 1.9.53 — Signals tab peek-safe + ghost DMs really gone',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Fixes two related bugs in the "Signals" message-request inbox on the Friends panel. First: the tab was querying is_read: false, which meant a request from a stranger vanished the moment you peeked at their DM — no accept, no block, no way back. Semantic was wrong; the tab is "pending requests from non-friends", not "unread DMs from strangers". The query now drops the is_read filter and instead pulls the 200 most recent DMs to you, deduped by sender and filtered against your friend list, so peeking no longer erases the request. Second: the server-side ghost-user filter on GET /direct-messages was a no-op — filterOrphans used .some() (row kept if ANY participant is live), and since the caller IS a live participant, every DM row survived even when the other side had been deleted. Flipped to .every() so a DM row now needs BOTH participants alive to render, which drops ghost-participant DMs from Jump Back In, the DirectMessages panel, and Signals in one shot. Also added a disabled state on the Accept / Sever buttons while the mutation is in flight so a double-click cannot create duplicate Friend rows.',
  },
  {
    id: 'p1952',
    title: 'Patch 1.9.52 — Ghost members purged + fly-catch DMs go real',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Two piles of ghost data cleaned up server-side. First: deleted accounts used to leave "ghost members" hanging in every server\'s member list — Electron sidebars kept rendering avatars for users whose profiles no longer existed. The admin sweep-orphans job now prunes Server.members[] and Server.banned_users[] and deletes any server whose owner no longer exists, mirroring the Friend / DirectMessage / GroupChatMember cleanup it already did. GET /servers and GET /servers/:id also strip ghost members live on read, so a deletion clears from every sidebar on the next fetch without waiting for the sweep. A one-time sweep against production removed 4 orphan friends, 81 orphan DMs, 4 ghost group-chat members, 2 ghost server members, and 1 owner-less server. Second: the "You caught the fly! +N Biomass" system DM was being fabricated on the client with a fake spidr-ai sender, which landed the message in a self-DM thread instead of the real Spidr System account. The catch is now logged server-side via sendSystemDM inside /biomass/fly — one source of truth, real system sender, fire-and-forget so a DM write can\'t fail the reward. A scripts/purge-fake-fly-dms.js dry-run/--delete helper is included to sweep the fabricated rows out of production.',
  },
  {
    id: 'p1925',
    title: 'Patch 1.9.25 — Spidr Apex + platform hardening',
    date: '2026-07-05',
    type: 'UPDATE',
    description: 'Spidr Apex ($7.99/mo, $69.99/yr) subscription flow is live end-to-end — signed Stripe webhook writes apex_tier, checkout + billing portal routes, 30-day trial gated by a burn-once flag on the profile so cancel-and-resubscribe pays from day one, and idempotent webhook processing means Stripe redeliveries can\'t double-flip anyone. Platform-wide security pass: every user-owned CRUD collection (AI logs, DMs, group chats, friends, collections, saved audio, custom bots, community assets, servers, events, feeds, reports) now locks PATCH/DELETE to the owner — no more cross-account writes. Server audit logs are now truly append-only via HTTP. Legacy Node.js auth endpoints return 410 for anything except TOTP, so the Spring Boot MFA gate can\'t be bypassed. Node dependency vulns cleared (nodemailer + uuid majors bumped).',
  },
  {
    id: 'p1924',
    title: 'Patch 1.9.24 — Streak Counter + Steam Now Playing modules unlocked',
    date: '2026-07-02',
    type: 'UPDATE',
    description: 'Two modules step out of Coming Soon. The Daily Streak Counter is now real — instead of guessing your streak from message activity, the server tracks a proper day-by-day login streak on your profile: a /streak/ping endpoint fires once per session on login so consecutive days count up, missing a day resets the current streak to zero, and best and total-days climb alongside it. The streak fields are locked at the CRUD layer so nobody can PATCH themselves a higher number. Steam Now Playing is unlocked in the Module Nexus and installs like any other module — enter your 64-bit Steam ID, pick a game from your library, and the widget renders the game\'s header art, total hours, past-two-weeks hours, and achievement progress against Steam\'s public API. The widget UI and the server\'s /steam/games and /steam/stats routes were already in the tree; they were just gated by the padlock overlay in ModuleCard until now.',
  },
  {
    id: 'p1923',
    title: 'Patch 1.9.23 — Bot Lab tidy + Spidr Protocol fixes',
    date: '2026-06-30',
    type: 'FIX',
    description: 'Two cleanup passes. The Bot Laboratory drops the Data Analyst bot and swaps its category-grouped layout for a single alphabetical list — one clean A→Z grid of official bots instead of Scientists / Guardians / Utility sections. And the Spidr Protocol ghost overlay finally sends messages properly and drags where you want it: sends now route to the correct backend for DMs, group chats, and server channels (group chats were silently hitting the wrong endpoint before), and grabbing the top drag rail no longer flips interactive mode off mid-drag so the overlay pins wherever you put it. A colored status pill next to the input surfaces send success or failure inline.',
  },
  {
    id: 'p1922',
    title: 'Patch 1.9.22 — Tablet chat headers + server avatars',
    date: '2026-06-30',
    type: 'FIX',
    description: 'A polish pass for chat headers and avatars. The DM and group chat headers no longer crowd themselves on tablets — they collapse into the same compact hamburger menu that mobile already uses, so the floating top-right action cluster stops fighting for space. Sticky Web has been renamed Memory Web in the quick-actions dropdown. And server channel messages now show live profile avatars the same way DMs and group chats already do — when someone changes their picture, it updates everywhere their messages appear, not just in DMs.',
  },
  {
    id: 'p1921',
    title: 'Patch 1.9.21 — Spotify module privacy fix',
    date: '2026-06-29',
    type: 'FIX',
    description: 'Spotify module privacy fix. The Spotify Now Playing module used to show YOUR track on every profile — now each profile shows its owner\'s track, just like the Weather widget. Visitors see what the profile owner is listening to (if they\'ve connected Spotify), and the "Connect Spotify" and "Disconnect" controls only appear on your own profile.',
  },
  {
    id: 'p192',
    title: 'Patch 1.9.2 — Bot Lab cleanup + mobile polish',
    date: '2026-06-28',
    type: 'UPDATE',
    description: 'A focused cleanup release. Music Master and Game Master have been retired — the Bot Laboratory now only ships the official guardian and scientist bots that are fully working. The "My Bots" / Fabricator tab is hidden until user-created bots are ready. Mobile polish lands across DMs, Friends, Servers, the Bot Lab, and the home dashboard — headers collapse cleanly on small screens, the DM action rail tucks into a dropdown menu, and the Friends tab strip scrolls horizontally instead of wrapping. Flickery UI signals (typing banners, web vibration alerts) are now smoothed so they don\'t flash on brief gaps. And SPIDR_SYS itself got a plain-language rewrite — every patch note now reads like product news, not a code review.',
  },
  {
    id: 'p191',
    title: 'Patch 1.9.1 — Home + chat polish',
    date: '2026-06-27',
    type: 'FIX',
    description: 'A polish pass for the home page and chats. Activity Feed and Recent Servers on the home page now collapse with a chevron, and your choice is remembered. Biomass catches no longer spam the chat you\'re in — they\'re logged into the Spidr System DM with their toast instead. And message avatars across DMs and group chats now update everywhere when someone changes their profile picture.',
  },
  {
    id: 'p19m',
    title: 'Patch 1.9 — Spidr Mobile (Phase 1) is now live',
    date: '2026-06-20',
    type: 'UPDATE',
    description: 'Spidr is officially on iPhone and Android. Your friends, DMs, servers, and clips all come with you — log in once, everything stays in sync with the web app. THE WEB feed swipes vertically like TikTok, comments slide up from the bottom, and likes and follows count toward your personalized feed across web and mobile. Voice channels and the upload studio are coming in Phase 2.',
  },
  {
    id: 'p185',
    title: 'Patch 1.8.5 is now live',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'Three changes this patch. Friend avatars are now live everywhere — when a friend changes their profile picture, you see it instantly across the Friends panel, Spidr Web, and pending requests. Spotify presence is faster and lighter on traffic. And there\'s a brand-new 404 page — a hand-drawn cave-and-web scene with the Spidr mascot lost in the middle of the web.',
  },
  {
    id: 'p184',
    title: 'Patch 1.8.4 is now live',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'DJ Booth is live in voice channels. Pick the green Music icon in the call dock, search Spotify, and the whole room sees synchronized DJ visuals — spinning album art, pulse rings, and a bouncing audience. Note: this is the visual layer — each listener still plays the host\'s track on their own Spotify. Plus: Spotify search actually returns results now, expanding a minimized call routes you home properly, and the Mutuals tab is hidden on your own profile.',
  },
  {
    id: 'p183',
    title: 'Patch 1.8.3 is now live',
    date: '2026-06-15',
    type: 'FIX',
    description: 'Weather widget privacy fix. The Weather widget used to show YOUR weather on every profile — now each user has their own saved location, and viewing a profile shows THEIR weather. The city and region name have also been removed from the display, so the owner\'s exact location stays private.',
  },
  {
    id: 'p182',
    title: 'Patch 1.8.2 is now live',
    date: '2026-06-15',
    type: 'UPDATE',
    description: 'A big features patch. Voice channels get Theater Mode when someone shares their screen, and minimized calls now show a live preview of what\'s happening. Repost lands on THE WEB — share any clip to your feed. Profile Anthem lets you set a song that auto-plays (muted) when someone views your profile. Plus: a nameplate cropper, shareable server invite cards, clickable links in chat, a Join by Invite Code tab on the Create Server dialog, comment replies in the notification center, and Spotify Now Playing in your browser (closed beta — ping Chris for access).',
  },
  {
    id: 'p181',
    title: 'Patch 1.8.1 is now live',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Welcome Bot now greets every new member, not just the ones who joined via invite link. Browse-and-Join users get the greeting too.',
  },
  {
    id: 'p18web',
    title: 'Patch 1.8 — The Web Fixes',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Slash commands got a serious upgrade. The autocomplete popup is now grouped by bot with avatars and colors, hides admin-only commands from non-admins, and shows up to 30 results with arrow-key navigation. New Auto Moderator commands: /modhelp, /modreset, /modtest, /modset unban all. New Welcome Bot commands: /welcomehelp, /welcomeconfig, /welcomedelete. Admins can now delete bot and system messages in their server. Plus a fix for the Copy Channel ID toast that flashed before the copy actually finished.',
  },
  {
    id: 'p18',
    title: 'Patch 1.8 is now live',
    date: '2026-06-10',
    type: 'UPDATE',
    description: 'All four official bots are now fully working. Auto Moderator scans every message for spam and banned words — configure thresholds and word lists in the Bot Laboratory. Welcome Bot greets new members in your server\'s first text channel with a template you control. Game Master runs trivia: /trivia posts a question with four options, first correct answer wins. Music Master\'s /play now shows the actual song title, and /skip and /stop clear cleanly.',
  },
  {
    id: 'p172',
    title: 'Patch 1.7.2 is now live',
    date: '2026-06-09',
    type: 'FIX',
    description: 'A polish pass on THE WEB. "Cocoons" is now called "Saved" everywhere — feed, profile tabs, and collections. The volume slider no longer disappears when you reach for it. GIF and image panels in comments close automatically when you scroll to a new video. And clicking a saved clip jumps you straight to it in the feed.',
  },
  {
    id: 'p171',
    title: 'Patch 1.7.1 is now live',
    date: '2026-06-08',
    type: 'FIX',
    description: 'Adding a friend you\'ve already added now shows "You already added this user!" instead of a confusing error. And SPIDR_SYS got caught up — patches 1.6.2, 1.7, and the deploy fix are all in the feed now.',
  },
  {
    id: 'p17',
    title: 'Patch 1.7 is now live',
    date: '2026-06-03',
    type: 'UPDATE',
    description: 'Module Nexus got a big overhaul. Gaming Uplink now detects games from every launcher — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more — with auto-extracted icons. Background apps (Medal, Discord, Spotify, OBS) no longer get mistaken for games. Spotify Now Playing is live in the desktop app: connect Spotify in Settings and your current track shows on your profile. New "Don\'t see your game?" form lets you flag missing detection. Plus desktop app polish: Spidr icon, drag the window from the top, resize, and the APEX upgrade dialog actually shows up now.',
  },
  {
    id: 'p162',
    title: 'Patch 1.6.2 is now live',
    date: '2026-06-02',
    type: 'UPDATE',
    description: 'A behind-the-scenes rebuild of the app\'s shell — same look, but the mobile menu is cleaner and pages load faster. A few legacy pages were retired to make room for the newer home dashboard and integrated profile flows.',
  },
  {
    id: 'p162b',
    title: 'Deploy pipeline fixed',
    date: '2026-06-02',
    type: 'FIX',
    description: 'Fixed the production deploy pipeline — releases to the web app no longer time out, so updates land reliably again.',
  },
  {
    id: 'p161',
    title: 'Patch 1.6.1 is now live',
    date: '2026-05-31',
    type: 'FIX',
    description: 'A polish pass on Patch 1.6. Voice channels now drop a vertical "web thread" to glowing crimson avatar nodes. The expanded call deck got a cleaner glass look, and screen share splits into a proper Main Stage with a collapsible sidebar of audio-reactive user pills. Minimized calls became a tiny "Micro-Tactical HUD" pill that fades when idle. New: a transparent "Spidr Protocol" overlay (desktop) lets you chat over a game without leaving it. Fixes: group chats no longer render blank, voice calls no longer show duplicate users, the message feed is cleaner, and the profile widget stopped overlapping content.',
  },
  {
    id: 'p16',
    title: 'Patch 1.6 is now live',
    date: '2026-05-31',
    type: 'UPDATE',
    description: 'The biggest visual and functionality pass yet. THE WEB feed: trending posts physically pulse, The Weaver upload studio gets signature filters, a precision dual-handle video scrubber, and external audio from YouTube / Spotify / Apple Music. New: tap-to-expand image lightbox in chat, rich GIF and image comments, and long-press menus on mobile. The channel sidebar, server chat, and Bot Laboratory all got reskinned in the crimson palette. Custom backgrounds now flow across the whole app. Plus a bunch of fixes: minimized calls work reliably, server permissions are correct, mute and deafen are properly distinct, "Pin to Web" confirms, tapping a Memory Web message jumps to it, voice channels show their members, and mobile is fully responsive.',
  },
  {
    id: 'p15',
    title: 'Patch 1.5 is now live',
    date: '2026-05-29',
    type: 'UPDATE',
    description: 'APEX Symbiote suite lands: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: minimized calls use the new Web Node design everywhere, minimizing no longer disconnects you, the sidebar logo box is gone, APEX activation is fixed, and trending servers no longer 404.',
  },
  {
    id: 'p14',
    title: 'Patch 1.4 is now live',
    date: '2026-05-24',
    type: 'UPDATE',
    description: 'APEX gets hanging threads and mini voice visualizers. Calls auto-minimize when you navigate, the desktop app supports picture-in-picture, and you can now "Pin to Spidr Web" across Friends, DMs, and Groups.',
  },
  {
    id: 'voicefix',
    title: 'Voice messages fixed everywhere',
    date: '2026-05-24',
    type: 'FIX',
    description: 'Voice messages now send everywhere — DMs, group chats, and server channels. Fixed the upload error that was blocking them.',
  },
  {
    id: 'webnode',
    title: 'Suspended Web Node',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'Minimized calls now appear as a draggable "web node" — a glowing radial pill with an active-speaker waveform and your APEX-colored thread.',
  },
  {
    id: 'unicall',
    title: 'Universal calling',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'DM and group calls now use the exact same voice deck and screen share as server channels — one unified call experience.',
  },
  {
    id: 'trending',
    title: 'Trending server join flow',
    date: '2026-05-22',
    type: 'FIX',
    description: 'Opening a server from Trending no longer 404s. Non-members now see a proper Join / Request Invite screen.',
  },
];

router.get('/news', (_req, res) => {
  res.json(NEWS);
});

module.exports = router;
