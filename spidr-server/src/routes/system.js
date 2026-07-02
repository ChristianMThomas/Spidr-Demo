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
