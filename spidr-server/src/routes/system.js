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
 *
 * WRITING PATCH NOTES — read this before editing:
 * These are shown to end users in the home-page terminal. Write them in plain
 * English. Explain what CHANGED for the user, not how the code got there.
 * No file paths, no function names, no library versions, no error codes.
 * Aim for 2–4 short sentences. Match the tone of recent entries.
 */
const NEWS = [
  {
    id: 'p1969',
    title: 'Patch 1.9.69 — Notification overhaul',
    date: '2026-08-26',
    type: 'UPDATE',
    description:
      'Notifications from a person now show that person\'s profile picture and the actual message instead of the Spidr logo and a bare "New message". Mentions and group chats get the full group treatment: the server or group picture, who posted, where they posted it, and what they said — and when a server or group has no picture of its own, the sender\'s shows instead. Servers and group chats now ping you on every message by default, with new switches to narrow either one down to @mentions only, plus a per-server and per-group control so you can set any single one to All, @mentions only, or Muted without touching the rest. Signing in now asks for microphone, camera and notification access in one short setup step rather than interrupting your first call. Also includes a background security update to the realtime connection layer.',
  },
  {
    id: 'p1968',
    title: 'Patch 1.9.68 — Symbiote edit bar',
    date: '2026-08-22',
    type: 'UPDATE',
    description:
      'Editing a message no longer shows a flat gray box with an OS emoji glued to it. The bar is now a symbiote clamp over the composer: a crimson-tinted chassis with a red border whose aura BREATHES on a 2.8 second loop, and a bright highlight that crawls along the top edge like something moving under the surface. The pencil is a sharp vector now rather than the platform emoji, which rendered differently on every operating system and made the whole component read as a web template. Editing message sits in red above a small mono esc to cancel hint, with an explicit Cancel pill on the right. One thing that had to be fixed to ship this honestly: the design advertises esc to cancel, but Escape only ever dismissed the slash-command palette and then fell through with nothing listening — the label would have been a lie. Escape now genuinely cancels an in-progress edit. The animation respects prefers-reduced-motion: the glow stays, the breathing and the crawl stop.',
  },
  {
    id: 'p1967',
    title: 'Patch 1.9.67 — Sidebar pop-outs + Bot Lab chassis',
    date: '2026-08-22',
    type: 'UPDATE',
    description:
      'Every sidebar icon now slides open on hover into a glowing pill that names it — the icon holds position while the chassis expands rightward with a red border and aura, and the label fades in a beat later on a slide, giving it that HUD feel. Bot Lab gets its own grade of the same physics: the aggressive mech-border chassis with angled cybernetic corners cut at each edge, a brighter aura, black italic type, and its real badge artwork in place of the generic chat glyph. Identical expansion timing across both grades so the rail stays cohesive when you run the mouse down it. Two engineering notes. The Bot Lab art was converted to TRUE transparency rather than the usual mix-blend-screen trick — screen-blending makes every black pixel vanish, which would have gutted the badge\'s own black outlines, the spider\'s shading, and the dark panel behind the circuit traces, and it only looks right on a pure-black backdrop. Instead the background was flood-filled from the image borders, so the black BEHIND the badge is stripped while every black pixel INSIDE the artwork survives, and the cut edge is feathered so the neon glow does not look razor-cut. The pop-out itself is rendered as a viewport-anchored overlay measured from each item, because the nav rail clips horizontal overflow at 72px — an in-flow hover expansion would have been sliced flat at the rail edge.',
  },
  {
    id: 'p1966',
    title: 'Patch 1.9.66 — Friends flow self-heals',
    date: '2026-08-22',
    type: 'FIX',
    description: 'Accepting a friend request no longer leaves your friends list one-sided — if the sender\'s side never mirrored to you the first time, accepting now creates the missing row so both of you actually see each other as friends. Unfriending someone also clears both sides at once, so nobody is left with a phantom friend that has no record of them. And on a shared browser, your pinned conversations and pinned group chats are now scoped to your account, so switching users doesn\'t leak the last person\'s pins into your sidebar.',
  },
  {
    id: 'p1965',
    title: 'Patch 1.9.65 — Account safety + mobile polish',
    date: '2026-08-21',
    type: 'UPDATE',
    description: 'Sign-in, verification, and account-recovery messages no longer reveal whether an email is registered, so nobody can fish for who has a Spidr account. Rate limits on those flows now apply per email address instead of only per network, so someone rotating networks can\'t keep hammering one account. The mobile app also picks up its new branded icon and splash screen, the Settings screen is stripped down to clean rows, and a maintenance fix backfills friend requests that could get stuck showing accepted on one side and still pending on the other.',
  },
  {
    id: 'p1964',
    title: 'Patch 1.9.64 — iOS notifications now work',
    date: '2026-08-20',
    type: 'FIX',
    description: 'iOS notifications finally light up your lock screen — you\'ll get a banner when a friend messages you or calls, even with the app closed. The mobile home tab also gets a Jump Back In shortcut and a pinned-favorites panel alongside your recent servers.',
  },
  {
    id: 'p1963',
    title: 'Patch 1.9.63 — Mobile DM unread badges',
    date: '2026-08-20',
    type: 'FIX',
    description: 'Direct message unread counts on mobile now show up the moment a friend messages you and clear the moment you open the chat. The badge appears in three places instead of one: the Friends tab, the home page Friends tile, and each friend\'s avatar in your Recents strip. A DM that lands overnight bumps the badge the moment you reopen the app.',
  },
  {
    id: 'p1962',
    title: 'Patch 1.9.62 — Cleaner missed-call notes',
    date: '2026-08-19',
    type: 'FIX',
    description: 'Missed call notes in your chats got three fixes. Group calls now leave a proper "you tried calling this group" or "<name> called this group" note, hanging up a connected call no longer stamps a fake "didn\'t answer" row on top of it, and every note now shows the real caller name instead of "Someone". Mobile chat threads render missed calls as clean centered alerts instead of raw message bubbles.',
  },
  {
    id: 'p1961',
    title: 'Patch 1.9.61 — Notification controls + Close Friends',
    date: '2026-08-19',
    type: 'UPDATE',
    description: 'Notification toggles on mobile finally do what they say — every switch (DMs, mentions, friend requests, calls) is now enforced on the server, and Do Not Disturb actually silences pushes. Close Friends is a real feature now: tap the star on any friend\'s profile and they can break through DND when it matters. The DM header video button now actually starts a video call (it was silently starting voice), and tapping a notification takes you straight to the right conversation, server, or friend request.',
  },
  {
    id: 'p1960',
    title: 'Patch 1.9.60 — Native mobile calls',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Native mobile calling is back online. An incoming Spidr call now lights up your phone\'s real lock-screen call UI, just like a normal phone call. Mobile callers land in the exact same voice room as web callers so everyone joins one session, and your Voice & Video settings (mic, camera-on-join, speaker default) apply automatically. The in-call screen is a fresh full-screen UI with a pulsing avatar for voice and self-view picture-in-picture for video.',
  },
  {
    id: 'p1959',
    title: 'Patch 1.9.59 — The Spidr Web Matrix',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'Jump Back In and the Spidr Web pinned strip are now ONE tabbed panel on the homepage. The Jump Back In tab lists recent DMs and group chats with hover rings in symbiote red. The Spidr Web tab shows your pinned connections wearing the signature red-to-purple gradient ring with a pushpin badge, a live presence dot on pinned DMs, and a hover wash that bleeds red into purple. Pins update instantly when you pin someone from anywhere in the app, and the panel appears at every screen size.',
  },
  {
    id: 'p1958',
    title: 'Patch 1.9.58 — The Core actually lands this time',
    date: '2026-08-18',
    type: 'FIX',
    description: 'The Spidr Core — the breathing home button — is now in the desktop sidebar where you\'ll actually see it (last patch put it in a dead file nobody rendered). Hover it to lunge the spider to full color, click it to fire a synthesized symbiote heartbeat, and when you\'re on the home page the mascot and its red aura breathe on a three-second loop with a glowing red bar on the left rail.',
  },
  {
    id: 'p1957',
    title: 'Patch 1.9.57 — The Spidr Core breathes + native title bar',
    date: '2026-08-18',
    type: 'UPDATE',
    description: 'The home button in the floating dock is now the Spidr Core. Dormant it sits desaturated and dim; hovering lunges it to full color and scale; active it BREATHES on a three-second loop, so the app\'s anchor point feels alive instead of static. Clicking fires a synthesized symbiote heartbeat — a two-beat low thump. Windows and Linux now use the real system minimize/maximize/close buttons on the header (like VS Code and Discord). A broken avatar or server icon anywhere in the app now falls back to a spider placeholder instead of the browser\'s torn-page glyph.',
  },
  {
    id: 'p1956',
    title: 'Patch 1.9.56 — In-app updates + "Likes" rename',
    date: '2026-07-26',
    type: 'UPDATE',
    description: 'The desktop app now updates itself — a new patch drops, you see "Update available", and it installs when you next quit. No more manual re-download from spidrapp.com. "Resonance" on profiles is now called "Likes" everywhere (web and mobile). Also picked up: tap-to-react and share sheets on mobile, a proper Not Found screen for dead links, and a home page card that mirrors the SPIDR_SYS terminal.',
  },
  {
    id: 'p1955',
    title: 'Patch 1.9.55 — APEX store knows you\'re already subscribed',
    date: '2026-07-22',
    type: 'FIX',
    description: 'Opening APEX while you\'re already subscribed no longer pitches you the price again. The panel now shows a clear "YOU ALREADY HAVE APEX" confirmation with a Manage Subscription button, and the header pill switches from UNLOCKED to ACTIVE. The feature grid and the top-right settings gear are unchanged, so managing the subscription is still one click away.',
  },
  {
    id: 'p1954',
    title: 'Patch 1.9.54 — Landing redesign + safer desktop links',
    date: '2026-07-22',
    type: 'UPDATE',
    description: 'The spidrapp.com landing site got a full design refresh across Hero, Navbar, Community, Platforms, WhySpidr, and Footer, and the "SPOTS LEFT" counter is live again on first paint. On desktop, every clicked link is now validated before it can leave the app — anything that isn\'t a normal http, https, or mailto link is blocked, so a crafted chat link can\'t hijack your system.',
  },
  {
    id: 'p1953',
    title: 'Patch 1.9.53 — Signals tab no longer erases requests',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Two fixes for the Signals inbox on the Friends panel. Peeking at a stranger\'s DM used to make their request vanish with no way to accept or block — requests now stay put until you actually act on one. And DMs from deleted accounts no longer show up as ghost conversations in Jump Back In or your DM list.',
  },
  {
    id: 'p1952',
    title: 'Patch 1.9.52 — Ghost members purged + real fly-catch DMs',
    date: '2026-07-21',
    type: 'FIX',
    description: 'Deleted accounts no longer leave ghost avatars behind. Their leftover rows in server member lists, friend lists, group chats, and DMs are now cleaned up in one sweep instead of lingering in your sidebars. And when you catch a fly for Biomass, the "+N Biomass" note now comes from the real Spidr System account instead of a fake sender that landed in a broken thread.',
  },
  {
    id: 'p1925',
    title: 'Patch 1.9.25 — Spidr Apex + platform hardening',
    date: '2026-07-05',
    type: 'UPDATE',
    description: 'Spidr Apex ($7.99/mo, $69.99/yr) is live end-to-end — start a 30-day trial, upgrade, or manage your subscription from the app. Under the hood: every user-owned area (DMs, groups, friends, servers, saved audio, custom bots, collections, feeds, reports) is now locked to the owner, so nobody can edit anyone else\'s data. Server audit logs are permanent.',
  },
  {
    id: 'p1924',
    title: 'Patch 1.9.24 — Streak Counter + Steam Now Playing unlocked',
    date: '2026-07-02',
    type: 'UPDATE',
    description: 'Two modules step out of "Coming Soon". The Daily Streak Counter now tracks a real day-by-day login streak on your profile — miss a day and it resets, keep showing up and current, best, and total-days climb alongside it. Steam Now Playing is installable: enter your Steam ID, pick a game from your library, and your profile shows the game\'s art, hours played, and achievement progress.',
  },
  {
    id: 'p1923',
    title: 'Patch 1.9.23 — Bot Lab tidy + Spidr Protocol fixes',
    date: '2026-06-30',
    type: 'FIX',
    description: 'The Bot Laboratory drops the Data Analyst bot and lays every remaining bot out in a single alphabetical A→Z list instead of separate category grids. The Spidr Protocol overlay now sends messages properly to DMs, group chats, and server channels (group chats were silently hitting the wrong place), and dragging the top rail no longer flips interactive mode off mid-move so it stays where you drop it.',
  },
  {
    id: 'p1922',
    title: 'Patch 1.9.22 — Tablet chat headers + server avatars',
    date: '2026-06-30',
    type: 'FIX',
    description: 'Chat headers on tablets no longer crowd themselves — they collapse into the same hamburger menu mobile uses. "Sticky Web" is now called "Memory Web" in the quick-actions dropdown. And server channel messages now update people\'s avatars in real time, just like DMs and group chats already did.',
  },
  {
    id: 'p1921',
    title: 'Patch 1.9.21 — Spotify module privacy fix',
    date: '2026-06-29',
    type: 'FIX',
    description: 'The Spotify Now Playing widget on profiles used to show YOUR current track on everyone else\'s profile. It now shows the profile owner\'s track, so visitors see what THAT person is listening to. Connect and disconnect controls only appear on your own profile.',
  },
  {
    id: 'p192',
    title: 'Patch 1.9.2 — Bot Lab cleanup + mobile polish',
    date: '2026-06-28',
    type: 'UPDATE',
    description: 'A focused cleanup. Music Master and Game Master are retired — the Bot Laboratory now only ships the official bots that are fully working. "My Bots" is hidden until user-created bots are ready. Mobile polish lands across DMs, Friends, Servers, the Bot Lab, and the home dashboard — headers collapse cleanly on small screens, action rails tuck into dropdowns, and the Friends tab strip scrolls horizontally instead of wrapping. Flickery signals (typing banners, web alerts) are now smoothed.',
  },
  {
    id: 'p191',
    title: 'Patch 1.9.1 — Home + chat polish',
    date: '2026-06-27',
    type: 'FIX',
    description: 'A polish pass for the home page and chats. Activity Feed and Recent Servers on the home page now collapse with a chevron and remember your choice. Biomass fly-catches no longer spam whichever chat you\'re in — they log into your Spidr System DM instead. And message avatars in DMs and group chats now update everywhere the moment someone changes their profile picture.',
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
    title: 'Patch 1.8.4 — DJ Booth in voice channels',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'DJ Booth is live in voice channels. Hit the green Music icon in the call dock, search Spotify, and the whole room sees synchronized DJ visuals — spinning album art, pulse rings, and a bouncing audience. Each listener still plays the host\'s track on their own Spotify. Also: Spotify search actually returns results now, expanding a minimized call routes you home properly, and the Mutuals tab is hidden on your own profile.',
  },
  {
    id: 'p183',
    title: 'Patch 1.8.3 — Weather widget privacy fix',
    date: '2026-06-15',
    type: 'FIX',
    description: 'The Weather widget used to show YOUR weather on every profile. Now each user has their own saved location, and viewing a profile shows THEIR weather. The city and region are hidden from the display so the profile owner\'s exact location stays private.',
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
