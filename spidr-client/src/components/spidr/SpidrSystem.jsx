import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * SpidrSystem — a "system terminal" news/patch feed anchored bottom-right of the
 * home page. Collapsed: a one-line ticker. Expanded: a scrollable panel of
 * announcements with a typewriter intro on the newest note.
 *
 * Data: ships with mock notes so it renders instantly, then tries to refresh
 * from GET {API}/system/news. A glowing "Spider-Sense" badge appears when there
 * are unread notes (tracked by the newest id in localStorage).
 */

const MOCK_NEWS = [
  { id: 'p1936', title: 'Patch 1.9.36 — Delete accounts, admin console, seven live bugs', date: '2026-07-08', type: 'UPDATE', description: 'Big release-prep sweep. Account self-service: Settings → Privacy → Danger Zone lets any user permanently delete their account. The delete cascade runs server-side and erases everything they touched — profile, wallet, DMs (sent and received), messages, clips, comments, feed posts, friends, notifications, voice sessions, installed modules, saved audio, custom bots, plus their servers and every group membership. Type DELETE to confirm; no recovery. Platform admin console lives at /admin, gated by User.role === admin. Admins see every user with search across username/email/name, can ban with a reason (the login route already blocks banned users), unban, grant/revoke admin, and permanently delete another account through the same cascade. Every destructive action requires typed confirmation. Bugs fixed that were breaking release: (1) the notification bell fired on YOUR OWN sent DMs because dm:new was broadcast to the whole conversation room including the sender with an empty payload the client could not self-skip — dm:new now goes only to the recipient with proper sender_id in the payload, and a new dm:sent event tells the sender it landed without notifying them. (2) REST-posted server messages never emitted message:new, so @-mentions and channel replies never lit the bell — the route now emits properly. (3) The Biomass page rendered but nothing worked because Mongoose Maps serialize as empty objects by default, so inventory lookups always found zero items — the wallet route now flattens the Map before responding. (4) Online/Invisible/Busy/Away picker looked empty because entities.UserProfile.update was silently failing (swallowed catch) — status changes now surface errors, auto-create the profile row if missing, and invalidate every caching layer that displays presence. (5) SPIDR WEB heads in the friends page had only toggle-pin on right-click — now open the standard tactical menu with View Profile, Send Message, Pin/Unpin, Remove Friend, Block, Copy ID for DMs and Open Group + Pin/Unpin for groups. (6) Spidr AI stayed in voice channels after the last human left (and kept talking) — now auto-leaves the moment humans hit zero, with local TTS cancelled instantly so audio stops the moment the room empties.' },
  { id: 'p1935', title: 'Patch 1.9.35 — Voice hardening + homepage rail + release polish', date: '2026-07-08', type: 'UPDATE', description: 'Nine fixes and refinements packed for release. Voice calls: the deafen headphones button is now in the expanded call dock (was only reachable from the pill); screen sharing finally sends audio too — the video track was forwarded to peers but the system-audio track from getDisplayMedia was captured and dropped, so viewers saw your share but heard nothing (the "others can\'t hear me while streaming" bug); the minimized call PiP video now switches to whoever is CURRENTLY SPEAKING (per-peer analysers ranked live, only peers with camera on can win, sticky so silence doesn\'t blank the video); mobile joiners appear as tiles now — the old code bound remoteStreams[0] to EVERY remote session so the third joiner\'s tile went blank (audible but invisible), now matched by userId through the peers map; the DJ Booth host gets a local volume slider matching the listener knob; and the Spidr AI voice-call menu drops OS emojis for custom Spidr iconography in accent colors, matching the AI\'s look everywhere else. Homepage: recent DMs and group chats now live in a persistent right rail on wider screens, one click to hop back in — and the mid-column duplicate is gone. Group Chat Settings: Save Changes now actually persists for non-owner members — the CRUD PATCH was owner-only and silently 403-ing on member edits despite the UI promising "any member can save name/avatar changes"; the group route now allows any member to update name/avatar/banner (owner still controls everything else) plus a proper error toast so future failures surface loudly instead of vanishing.' },
  { id: 'p1934', title: 'Patch 1.9.34 — Tactical context menus everywhere', date: '2026-07-08', type: 'UPDATE', description: 'The server member right-click menu has been rebuilt from scratch — the emoji-and-clashing-colors popup is dead. Right-clicking a member now opens the same frosted-glass tactical palette used across Spidr, upgraded for the job: an identity header with their avatar and live in-voice status, sharp vector icons on every row, and a strict tone hierarchy — neutral actions glow white, reversible moderation (kick, voice disconnect) glows orange, and destructive actions (permanent ban) glow Spidr red only when you hover them. Voice moderation folds in cleanly: server mute and deafen flip their labels to match the member\'s current state, and Move to Channel expands inline with the actual channel list. Profile and Direct Message sit at the top as first-class actions. THE WEB gets fuller right-click powers on every strand: Save to Collection opens your picker, Relay to Your Web toggles (and reads Un-Relay when already relayed), View Their Web jumps into the creator\'s profile, and your own posts gain a red Delete. Unpinning is everywhere it should be: friend and group right-click menus read Unpin from Spidr Web when something is pinned, and right-clicking a pinned head in the Spidr Web row unpins it instantly.' },
  { id: 'p1933', title: 'Patch 1.9.33 — Hotfix: Friends page crash + call join error', date: '2026-07-08', type: 'FIX', description: 'Two runtime crashes squashed. The Friends page went blank with \'pinned is not defined\' — the pinned-groups row referenced a variable that only existed in a different component scope; since that row only ever renders pinned groups, the pin badge now renders unconditionally there. And joining any voice call threw \'getMediaPrefs is not defined\' — the device-preferences import never landed in the WebRTC engine, so your chosen mic and camera settings crashed the join instead of applying. Both fixed, plus a codebase-wide sweep for the same class of bug (identifiers used without their import — the one failure our bundler cannot catch) came back clean.' },
  { id: 'p1932', title: 'Patch 1.9.32 — Speaking rings resurrected + TURN relay', date: '2026-07-08', type: 'FIX', description: 'Root-caused the dead speaking animations: every voice tile spun up its own Web Audio context, the minimized pill added another, and each mute or deafen toggle tore them down and rebuilt them — Chrome allows about six audio contexts per page, the pool exhausted mid-call, and every speaking ring in the app silently died. All analysers now share ONE app-wide audio context that never closes, and the pill\'s broadcaster reads mute state through a ref so toggling never churns audio plumbing. Rings pulse again — tiles, expanded deck, and the minimized pill. Second fix: cross-network calling. The client has always requested ICE relay config from /voice/ice, but that endpoint did not exist — every call silently fell back to STUN-only, which cannot punch through strict NATs, producing the classic \'call connects on the same wifi but never between homes\' failure. The endpoint now exists and serves your TURN relay credentials from server env (Metered free tier or any provider; see .env.example) alongside STUN. Set TURN_URLS, TURN_USERNAME, and TURN_CREDENTIAL on the server and cross-network + Electron↔web calls have a guaranteed path.' },
  { id: 'p1931', title: 'Patch 1.9.31 — One Spidr Web, not two', date: '2026-07-08', type: 'FIX', description: 'The Friends page briefly showed two pinned rows — a duplicate "Pinned to your web" strip stacked on top of the real SPIDR WEB row. The duplicate is gone. Pins now live INSIDE the Spidr Web row itself: pinned conversations render first with a red pin badge (keeping their live unread counts and presence dots), recents follow, and nothing appears twice. Right-click any head to pin or unpin it on the spot — same for the pin action in friend and group right-click menus, which feeds the same single store, synced to your profile so pins follow you across devices.' },
  { id: 'p1930', title: 'Patch 1.9.30 — Real device detection + full-app audit', date: '2026-07-07', type: 'UPDATE', description: 'Voice & Video settings now detect your ACTUAL hardware: every microphone, speaker, and camera on your system enumerates by name (with a one-tap permission grant, since browsers hide device labels until mic access is allowed once), hot-plug refreshes the lists live, and your picks persist and apply to real calls — mic and camera constraints in WebRTC capture, speakers via setSinkId on every incoming voice stream. Plus a live mic meter and camera preview so you can verify a device before joining. The homepage gets a JUMP BACK IN section: your recent DM conversations and group chats, one tap to land inside. Outgoing friend requests are now cancellable from the Sent list — cancelling removes both sides of the pair so no ghost request lingers. And a full-codebase audit (every one of ~390 files parse-checked, every client write diffed against server schemas, every dispatched event traced to a listener, every API path matched to a route) surfaced and fixed six silent data-loss bugs: SERVER BANS never persisted (banned users could just rejoin), server-invite DMs lost their invite card on reload, event creator attribution, moderator report resolutions, voice speaking sync, and imported-bot metadata were all being dropped by schema strict mode. Right-click Reply on a comment now actually opens the reply box, and a malformed dead file that could have broken future builds was removed.' },
  { id: 'p1929', title: 'Patch 1.9.29 — Voice polish + Apple Music module', date: '2026-07-07', type: 'UPDATE', description: 'The minimized call pill finally reacts to your voice — its tick-ring pulses live with your mic amplitude (the animation was always built in; nothing ever fed it a signal). Deafen now truly deafens: it silences every incoming voice INCLUDING people who join after you toggled it — late joiners used to slip through unmuted. Group chats get identity: set a group pfp AND a wide banner, static images or animated GIFs (GIFs skip the cropper so the animation survives), and both render in the chat header — plus a schema fix means pfp changes actually persist now instead of silently vanishing. The desktop app gets the big one: Electron denies mic/camera/screen permission requests by default when no handler is registered — a permission handler now grants the media family, and the macOS build gains the entitlements + usage descriptions Apple requires, which unblocks calling and streaming in the packaged exe/app. And Apple Music joins Module Nexus: an installable Now Playing widget with connect-in-place, live track when you\'re playing through Spidr, and an honest LAST PLAYED fallback (Apple has no live API) — visitors see the profile owner\'s spins, never their own.' },
  { id: 'p1928', title: 'Patch 1.9.28 — QA polish sweep', date: '2026-07-07', type: 'FIX', description: 'Unread DM badges now clear the moment you open a conversation — the mark-read call was landing server-side but the friends-list badge cache was never told to refresh, so the count haunted you until a reload. Spidr AI drops the OS emojis: every message from the AI now renders custom Spidr-system iconography inline (the spider gets its own bespoke sigil), in channels, DMs, and the AI panel. Verified functional this pass: tapping any post tile on a WEB profile (yours or anyone\'s) jumps the feed straight to that strand; usernames and avatars in feed comments open that user\'s full WEB profile; ENTER USER WEB routes from any profile card in the app onto THE WEB with their node open; Pin to Web from the friends page persists to your profile and surfaces in the DM sidebar; status changes ask how long (30m / 1h / 4h / 8h / until changed) and auto-revert on expiry; the Biomass shop stocks exactly custom titles, chat colors, and chat fonts — buy, equip, and they render on your nameplate and messages; the bookmark on any strand opens a collection picker (choose, toggle, or create-new); and servers carry #tags editable in Server Settings that Signal Radar filters on.' },
  { id: 'p1927', title: 'Patch 1.9.27 — Apple Music arrives', date: '2026-07-06', type: 'UPDATE', description: 'Spidr now speaks Apple Music — something Discord flat-out does not have. Connect your account from Neural Config (Apple\'s own authorization popup, your credentials never touch our servers). The DJ Booth gets an APPLE MUSIC tab next to Spotify: Apple still ships 30-second previews for virtually its entire catalog, so every listener hears the booth — and if you\'re a connected Apple Music subscriber, the booth upgrades you to the FULL track, synced to the session clock, with a Full Track badge so you know you\'re getting the real thing. Playing through Spidr broadcasts your now-playing to friends in real time via the same presence pipeline as Spotify and the desktop OS reader. Honest print: Apple has no live now-playing API, so presence comes from playback through Spidr or the desktop Music app — and full-track mode requires an active Apple Music subscription; previews cover everyone else.' },
  { id: 'p1926', title: 'Patch 1.9.26 — THE WEB grows up + desktop release prep', date: '2026-07-05', type: 'UPDATE', description: 'THE WEB sheds its last borrowed feather: the personalized feed label is now YOUR WEB (no more TikTok-style wording), and tapping any creator\'s name or avatar in the feed opens THEIR full WEB profile — strands and relays included — right inside the feed. Sling to DM is real now, with its own lane: slung posts land in the new SIGNALS tab instead of your actual DMs, so sharing clips never floods real conversations. The DJ Booth finally makes sound — when the host picks a track, everyone in the channel hears the 30-second preview looped in rough sync, with local volume control (tracks Spotify ships no preview for say so honestly instead of playing silence). Spidr AI is audible to the whole call, not just whoever summoned it. The DJ stage swaps its grid-lines backdrop for a deep red/purple gradient. Nameplates get the Sonic Uplink (glowing 4-bar equalizer when someone\'s broadcasting music) and the Activity Blade (a razor-thin frosted tag showing what they\'re playing) — rich presence the Spidr way, no bulky Discord rectangles. Notification & sound toggles in Settings actually save and apply now. And the desktop app gears up for release: a woven-web boot splash, a fully transparent title bar that lets your background bleed through, collapsible server and channel sidebars, and the Spidr mascot as the real .exe / .app icon.' },
  { id: 'p1925', title: 'Patch 1.9.25 — Spidr Apex + platform hardening', date: '2026-07-05', type: 'UPDATE', description: 'Spidr Apex ($7.99/mo, $69.99/yr) subscription flow is live end-to-end — signed Stripe webhook writes apex_tier, checkout + billing portal routes, 30-day trial gated by a burn-once flag on the profile so cancel-and-resubscribe pays from day one, and idempotent webhook processing means Stripe redeliveries can\'t double-flip anyone. Platform-wide security pass: every user-owned CRUD collection (AI logs, DMs, group chats, friends, collections, saved audio, custom bots, community assets, servers, events, feeds, reports) now locks PATCH/DELETE to the owner — no more cross-account writes. Server audit logs are now truly append-only via HTTP. Legacy Node.js auth endpoints return 410 for anything except TOTP, so the Spring Boot MFA gate can\'t be bypassed. Node dependency vulns cleared (nodemailer + uuid majors bumped).' },
  { id: 'p1924', title: 'Patch 1.9.24 — Streak Counter + Steam Now Playing modules unlocked', date: '2026-07-02', type: 'UPDATE', description: 'Two modules step out of Coming Soon. The Daily Streak Counter is now real — instead of guessing your streak from message activity, the server tracks a proper day-by-day login streak on your profile: a /streak/ping endpoint fires once per session on login so consecutive days count up, missing a day resets the current streak to zero, and best and total-days climb alongside it. The streak fields are locked at the CRUD layer so nobody can PATCH themselves a higher number. Steam Now Playing is unlocked in the Module Nexus and installs like any other module — enter your 64-bit Steam ID, pick a game from your library, and the widget renders the game\'s header art, total hours, past-two-weeks hours, and achievement progress against Steam\'s public API. The widget UI and the server\'s /steam/games and /steam/stats routes were already in the tree; they were just gated by the padlock overlay in ModuleCard until now.' },
  { id: 'p1923', title: 'Patch 1.9.23 — Bot Lab tidy + Spidr Protocol fixes', date: '2026-06-30', type: 'FIX', description: 'Two cleanup passes. The Bot Laboratory drops the Data Analyst bot and swaps its category-grouped layout for a single alphabetical list — one clean A→Z grid of official bots instead of Scientists / Guardians / Utility sections. And the Spidr Protocol ghost overlay finally sends messages properly and drags where you want it: sends now route to the correct backend for DMs, group chats, and server channels (group chats were silently hitting the wrong endpoint before), and grabbing the top drag rail no longer flips interactive mode off mid-drag so the overlay pins wherever you put it. A colored status pill next to the input surfaces send success or failure inline.' },
  { id: 'p1922', title: 'Patch 1.9.22 — Tablet chat headers + server avatars', date: '2026-06-30', type: 'FIX', description: 'A polish pass for chat headers and avatars. The DM and group chat headers no longer crowd themselves on tablets — they collapse into the same compact hamburger menu that mobile already uses, so the floating top-right action cluster stops fighting for space. Sticky Web has been renamed Memory Web in the quick-actions dropdown. And server channel messages now show live profile avatars the same way DMs and group chats already do — when someone changes their picture, it updates everywhere their messages appear, not just in DMs.' },
  { id: 'p1921', title: 'Patch 1.9.21 — Spotify module privacy fix', date: '2026-06-29', type: 'FIX', description: 'Spotify module privacy fix. The Spotify Now Playing module used to show YOUR track on every profile — now each profile shows its owner\'s track, just like the Weather widget. Visitors see what the profile owner is listening to (if they\'ve connected Spotify), and the "Connect Spotify" and "Disconnect" controls only appear on your own profile.' },
  { id: 'p192', title: 'Patch 1.9.2 — Bot Lab cleanup + mobile polish', date: '2026-06-28', type: 'UPDATE', description: 'A focused cleanup release. Music Master and Game Master have been retired — the Bot Laboratory now only ships the official guardian and scientist bots that are fully working. The "My Bots" / Fabricator tab is hidden until user-created bots are ready. Mobile polish lands across DMs, Friends, Servers, the Bot Lab, and the home dashboard — headers collapse cleanly on small screens, the DM action rail tucks into a dropdown menu, and the Friends tab strip scrolls horizontally instead of wrapping. Flickery UI signals (typing banners, web vibration alerts) are now smoothed so they don\'t flash on brief gaps. And SPIDR_SYS itself got a plain-language rewrite — every patch note now reads like product news, not a code review.' },
  { id: 'p191', title: 'Patch 1.9.1 — Home + chat polish', date: '2026-06-27', type: 'FIX', description: 'A polish pass for the home page and chats. Activity Feed and Recent Servers on the home page now collapse with a chevron, and your choice is remembered. Biomass catches no longer spam the chat you\'re in — they\'re logged into the Spidr System DM with their toast instead. And message avatars across DMs and group chats now update everywhere when someone changes their profile picture.' },
  { id: 'p19m', title: 'Patch 1.9 — Spidr Mobile (Phase 1) is now live', date: '2026-06-20', type: 'UPDATE', description: 'Spidr is officially on iPhone and Android. Your friends, DMs, servers, and clips all come with you — log in once, everything stays in sync with the web app. THE WEB feed swipes vertically like TikTok, comments slide up from the bottom, and likes and follows count toward your personalized feed across web and mobile. Voice channels and the upload studio are coming in Phase 2.' },
  { id: 'p185', title: 'Patch 1.8.5 is now live', date: '2026-06-16', type: 'UPDATE', description: 'Three changes this patch. Friend avatars are now live everywhere — when a friend changes their profile picture, you see it instantly across the Friends panel, Spidr Web, and pending requests. Spotify presence is faster and lighter on traffic. And there\'s a brand-new 404 page — a hand-drawn cave-and-web scene with the Spidr mascot lost in the middle of the web.' },
  { id: 'p184', title: 'Patch 1.8.4 is now live', date: '2026-06-16', type: 'UPDATE', description: 'DJ Booth is live in voice channels. Pick the green Music icon in the call dock, search Spotify, and the whole room sees synchronized DJ visuals — spinning album art, pulse rings, and a bouncing audience. Note: this is the visual layer — each listener still plays the host\'s track on their own Spotify. Plus: Spotify search actually returns results now, expanding a minimized call routes you home properly, and the Mutuals tab is hidden on your own profile.' },
  { id: 'p183', title: 'Patch 1.8.3 is now live', date: '2026-06-15', type: 'FIX', description: 'Weather widget privacy fix. The Weather widget used to show YOUR weather on every profile — now each user has their own saved location, and viewing a profile shows THEIR weather. The city and region name have also been removed from the display, so the owner\'s exact location stays private.' },
  { id: 'p182', title: 'Patch 1.8.2 is now live', date: '2026-06-15', type: 'UPDATE', description: 'A big features patch. Voice channels get Theater Mode when someone shares their screen, and minimized calls now show a live preview of what\'s happening. Repost lands on THE WEB — share any clip to your feed. Profile Anthem lets you set a song that auto-plays (muted) when someone views your profile. Plus: a nameplate cropper, shareable server invite cards, clickable links in chat, a Join by Invite Code tab on the Create Server dialog, comment replies in the notification center, and Spotify Now Playing in your browser (closed beta — ping Chris for access).' },
  { id: 'p181', title: 'Patch 1.8.1 is now live', date: '2026-06-12', type: 'FIX', description: 'Welcome Bot now greets every new member, not just the ones who joined via invite link. Browse-and-Join users get the greeting too.' },
  { id: 'p18web', title: 'Patch 1.8 — The Web Fixes', date: '2026-06-12', type: 'FIX', description: 'Slash commands got a serious upgrade. The autocomplete popup is now grouped by bot with avatars and colors, hides admin-only commands from non-admins, and shows up to 30 results with arrow-key navigation. New Auto Moderator commands: /modhelp, /modreset, /modtest, /modset unban all. New Welcome Bot commands: /welcomehelp, /welcomeconfig, /welcomedelete. Admins can now delete bot and system messages in their server. Plus a fix for the Copy Channel ID toast that flashed before the copy actually finished.' },
  { id: 'p18', title: 'Patch 1.8 is now live', date: '2026-06-10', type: 'UPDATE', description: 'All four official bots are now fully working. Auto Moderator scans every message for spam and banned words — configure thresholds and word lists in the Bot Laboratory. Welcome Bot greets new members in your server\'s first text channel with a template you control. Game Master runs trivia: /trivia posts a question with four options, first correct answer wins. Music Master\'s /play now shows the actual song title, and /skip and /stop clear cleanly.' },
  { id: 'p172', title: 'Patch 1.7.2 is now live', date: '2026-06-09', type: 'FIX', description: 'A polish pass on THE WEB. "Cocoons" is now called "Saved" everywhere — feed, profile tabs, and collections. The volume slider no longer disappears when you reach for it. GIF and image panels in comments close automatically when you scroll to a new video. And clicking a saved clip jumps you straight to it in the feed.' },
  { id: 'p171', title: 'Patch 1.7.1 is now live', date: '2026-06-08', type: 'FIX', description: 'Adding a friend you\'ve already added now shows "You already added this user!" instead of a confusing error. And SPIDR_SYS got caught up — patches 1.6.2, 1.7, and the deploy fix are all in the feed now.' },
  { id: 'p17', title: 'Patch 1.7 is now live', date: '2026-06-03', type: 'UPDATE', description: 'Module Nexus got a big overhaul. Gaming Uplink now detects games from every launcher — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more — with auto-extracted icons. Background apps (Medal, Discord, Spotify, OBS) no longer get mistaken for games. Spotify Now Playing is live in the desktop app: connect Spotify in Settings and your current track shows on your profile. New "Don\'t see your game?" form lets you flag missing detection. Plus desktop app polish: Spidr icon, drag the window from the top, resize, and the APEX upgrade dialog actually shows up now.' },
  { id: 'p162', title: 'Patch 1.6.2 is now live', date: '2026-06-02', type: 'UPDATE', description: 'A behind-the-scenes rebuild of the app\'s shell — same look, but the mobile menu is cleaner and pages load faster. A few legacy pages were retired to make room for the newer home dashboard and integrated profile flows.' },
  { id: 'p162b', title: 'Deploy pipeline fixed', date: '2026-06-02', type: 'FIX', description: 'Fixed the production deploy pipeline — releases to the web app no longer time out, so updates land reliably again.' },
  { id: 'p161', title: 'Patch 1.6.1 is now live', date: '2026-05-31', type: 'FIX', description: 'A polish pass on Patch 1.6. Voice channels now drop a vertical "web thread" to glowing crimson avatar nodes. The expanded call deck got a cleaner glass look, and screen share splits into a proper Main Stage with a collapsible sidebar of audio-reactive user pills. Minimized calls became a tiny "Micro-Tactical HUD" pill that fades when idle. New: a transparent "Spidr Protocol" overlay (desktop) lets you chat over a game without leaving it. Fixes: group chats no longer render blank, voice calls no longer show duplicate users, the message feed is cleaner, and the profile widget stopped overlapping content.' },
  { id: 'p16', title: 'Patch 1.6 is now live', date: '2026-05-31', type: 'UPDATE', description: 'The biggest visual and functionality pass yet. THE WEB feed: trending posts physically pulse, The Weaver upload studio gets signature filters, a precision dual-handle video scrubber, and external audio from YouTube / Spotify / Apple Music. New: tap-to-expand image lightbox in chat, rich GIF and image comments, and long-press menus on mobile. The channel sidebar, server chat, and Bot Laboratory all got reskinned in the crimson palette. Custom backgrounds now flow across the whole app. Plus a bunch of fixes: minimized calls work reliably, server permissions are correct, mute and deafen are properly distinct, "Pin to Web" confirms, tapping a Memory Web message jumps to it, voice channels show their members, and mobile is fully responsive.' },
  { id: 'p15', title: 'Patch 1.5 is now live', date: '2026-05-29', type: 'UPDATE', description: 'APEX Symbiote suite lands: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: minimized calls use the new Web Node design everywhere, minimizing no longer disconnects you, the sidebar logo box is gone, APEX activation is fixed, and trending servers no longer 404.' },
  { id: 'p14', title: 'Patch 1.4 is now live', date: '2026-05-24', type: 'UPDATE', description: 'APEX gets hanging threads and mini voice visualizers. Calls auto-minimize when you navigate, the desktop app supports picture-in-picture, and you can now "Pin to Spidr Web" across Friends, DMs, and Groups.' },
  { id: 'voicefix', title: 'Voice messages fixed everywhere', date: '2026-05-24', type: 'FIX', description: 'Voice messages now send everywhere — DMs, group chats, and server channels. Fixed the upload error that was blocking them.' },
  { id: 'webnode', title: 'Suspended Web Node', date: '2026-05-23', type: 'UPDATE', description: 'Minimized calls now appear as a draggable "web node" — a glowing radial pill with an active-speaker waveform and your APEX-colored thread.' },
  { id: 'unicall', title: 'Universal calling', date: '2026-05-23', type: 'UPDATE', description: 'DM and group calls now use the exact same voice deck and screen share as server channels — one unified call experience.' },
  { id: 'trending', title: 'Trending server join flow', date: '2026-05-22', type: 'FIX', description: 'Opening a server from Trending no longer 404s. Non-members now see a proper Join / Request Invite screen.' },
];

const API_BASE = (import.meta.env.VITE_API_URL) || 'http://localhost:4000';
const TYPE_COLORS = {
  UPDATE: 'text-[#FF3333] border-[#FF3333]/40',
  ALERT:  'text-amber-400 border-amber-400/40',
  FIX:    'text-emerald-400 border-emerald-400/40',
};

export default function SpidrSystem() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // On <md, the X button fully dismisses the terminal (ticker disappears too)
  // instead of just collapsing it. Re-opening is then only possible via the
  // sidebar's "Spidr System" row (which fires `spidr-system-open`). On desktop
  // we keep the original collapse-to-ticker behavior since desktop has no
  // sidebar trigger to bring it back from a full dismiss.
  const [dismissed, setDismissed] = useState(false);
  const [news, setNews] = useState(MOCK_NEWS);
  const [hasUnread, setHasUnread] = useState(false);
  const [typed, setTyped] = useState('');
  const typeTimer = useRef(null);

  // Fetch live news (best-effort; falls back to mock).
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/system/news`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive && Array.isArray(data) && data.length) setNews(data); })
      .catch(() => { /* keep mock */ });
    return () => { alive = false; };
  }, []);

  // Unread = newest id differs from the last one the user saw.
  useEffect(() => {
    const newestId = news[0]?.id;
    if (!newestId) return;
    let seen = null;
    try { seen = localStorage.getItem('spidr_system_seen'); } catch {}
    setHasUnread(seen !== newestId);
  }, [news]);

  // External open trigger — any component can fire `spidr-system-open` to
  // pop the terminal open (e.g. the MobileMenuPanel row). Also un-dismisses
  // so the sidebar can resurrect the terminal after the user X'd it on mobile.
  useEffect(() => {
    const handler = () => { setDismissed(false); setOpen(true); };
    window.addEventListener('spidr-system-open', handler);
    return () => window.removeEventListener('spidr-system-open', handler);
  }, []);

  // Typewriter the newest note's description when the terminal opens.
  useEffect(() => {
    clearInterval(typeTimer.current);
    if (!open) { setTyped(''); return; }
    const full = news[0]?.description || '';
    let i = 0;
    typeTimer.current = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(typeTimer.current);
    }, 16);
    // Mark newest as seen.
    try { if (news[0]?.id) localStorage.setItem('spidr_system_seen', news[0].id); } catch {}
    setHasUnread(false);
    return () => clearInterval(typeTimer.current);
  }, [open, news]);

  const latest = news[0];

  // On mobile, the user has explicitly told the terminal to go away — render
  // nothing until the sidebar resurrects it via `spidr-system-open`.
  if (dismissed && isMobile) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 30, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 384 }}
            exit={{ opacity: 0, y: 30, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-80 bg-[#050505]/90 backdrop-blur-md border border-red-900/30 rounded-lg overflow-hidden flex flex-col shadow-2xl shadow-black/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-red-900/30">
              <span className="flex items-center gap-2 font-mono text-xs text-[#FF3333]">
                <Terminal size={13} /> SPIDR_SYS
              </span>
              <button
                onClick={() => { if (isMobile) setDismissed(true); else setOpen(false); }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
              {news.map((item, idx) => (
                <div key={item.id} className={idx > 0 ? 'pt-3 border-t border-red-900/20' : ''}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${TYPE_COLORS[item.type] || TYPE_COLORS.UPDATE}`}>
                      {item.type}
                    </span>
                    <span className="text-zinc-600 text-[10px]">{item.date}</span>
                  </div>
                  <p className="text-zinc-200 font-bold text-[11px]">{item.title}</p>
                  <p className="text-zinc-400 mt-0.5 leading-relaxed">
                    {idx === 0 ? typed : item.description}
                    {idx === 0 && typed.length < (item.description?.length || 0) && (
                      <span className="inline-block w-1.5 h-3 bg-[#FF3333] ml-0.5 animate-pulse align-middle" />
                    )}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(true)}
            className="relative bg-[#050505]/80 backdrop-blur-md border border-red-900/30 rounded-md px-4 py-2 flex items-center gap-2 max-w-[320px] hover:border-red-900/50 transition-colors"
          >
            <span className="font-mono text-xs text-[#FF3333] shrink-0">{'>'} SPIDR_SYS:</span>
            <span className="font-mono text-xs text-zinc-300 truncate">{latest?.title || 'All systems nominal.'}</span>

            {/* Spider-Sense unread badge — glowing node + jagged line */}
            {hasUnread && (
              <span className="absolute -top-1.5 -right-1.5">
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M4 14 L8 10 L6 8 L11 4" fill="none" stroke="#FF3333" strokeWidth="1.2" opacity="0.8" />
                  <circle cx="14" cy="6" r="4" fill="#FF3333">
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="14" cy="6" r="6" fill="none" stroke="#FF3333" strokeWidth="1" opacity="0.4" />
                </svg>
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
