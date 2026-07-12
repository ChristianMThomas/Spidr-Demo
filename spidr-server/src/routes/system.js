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
    id: 'p195m',
    title: 'Patch 1.9.5 — Spidr Mobile (Phase 2) is now live',
    date: '2026-07-06',
    type: 'UPDATE',
    description: 'Mobile catches up to the web. Phase 2 wires up every "Coming soon" prompt that was left after the initial React Native ship — emojis, GIFs, media uploads, audio playback, group chats, ghost mode, signals, and profile modules all work on your phone now. Emoji + GIF picker is a proper bottom sheet with SERVER / EMOJI / GIFS tabs matching the web exactly: your servers\' custom emojis + the Hive community set, the standard emoji categories, and the same LLM-backed Giphy search + curated system GIFs; picking an emoji inserts it inline (or the :shortcode: for custom ones), picking a GIF sends it immediately as an image/gif attachment. Chat bubbles now render attachments — images and animated GIFs via expo-image, images animate on both iOS and Android, and inline :shortcode: custom emojis inline-mix with regular text with the jumbo "all-emoji message" rule from the web. Photos come from the phone\'s library through expo-image-picker with cropping + multi-attach previews, upload straight to /upload, and land in the message the same way voice/GIFs do. Voice message playback works through expo-audio — tap the play pill in any DM/channel/group and the recording streams from the CDN with a scrubbable progress bar; profile anthems play the same way with a purple accent. The Friends tab is fully live: real friend requests through /users/search + both reciprocal Friend rows, a working Signals tab that groups DMs from non-friends by sender, Groups tab that lists every group chat you\'re in with a Create Group sheet (name + friend multi-select), and every notification for mentions / requests / accepts now lands as a Spidr System DM so the system-account inbox is the actual notification center. Group chats got their own screen — multi-author bubbles with live avatars, live group:notify socket relay so REST-sent messages wake every member, members sheet with admin crowns, and a Group Settings sheet (rename for owners, kick members, leave for non-owners). Profile page is the small-screen web card verbatim: BIO / MODS / MUTUALS / LINKS tabs, VIBE CHECK + NEON SIGN inline editors that PATCH your profile row directly, the timezone auto-detects on your own profile so other viewers see your real local time, and the MODS tab actually renders LIVE widgets — Spotify Now Playing pulls from the socket, static/display/api-sync/live-feed modules all render their real payloads and LLM-backed data cards. The action rail on other-user profiles matches the web mockup 1:1 — LINK NODE / Accept + Deny / Signal Sent — Pending / MESSAGE + ADD depending on friendship, the [ ENTER USER WEB ] button opens their real vertical clip archive using the same feed pager, ADD sends a consent-based server invite through their DMs (never adds them silently), and REPORT files through the same Report entity the web uses with the same reason list. Ghost mode toggles on DMs (purple accent + text_effect=ghost stamp on outgoing messages). Voice/video call buttons no longer stub with "coming soon" — they gracefully explain that native calls need a custom dev client and point you at the web version so you can actually start the call. Emoji picker Modal was rewrapped in a proper flex-end root so the sheet lands at the bottom on every platform (fixes the "tap the tab, nothing opens" case). MODS get proper breathing room now — widget padding bumped, gaps opened up, tab content margin loosened so cards no longer feel crushed against the edges.',
  },
  {
    id: 'p19m',
    title: 'Patch 1.9 — Spidr Mobile (Phase 1) is now live',
    date: '2026-06-20',
    type: 'UPDATE',
    description: 'Spidr is now on your phone. Patch 1.9 ships the first React Native build of the app — iOS + Android via Expo SDK 54 — hitting the same Railway-hosted services as the web client so your friends, DMs, servers, and clips travel with you. Auth (login, register, OTP verify) shares the Spring Boot pipeline, tokens live in AsyncStorage, and the socket layer reuses the same JWT auth so live updates work the same as web. DMs render oldest-to-newest with auto-scroll-to-bottom, live current avatars on every bubble (no more stale snapshots when a friend changes pfp), and honor the private per-friend nickname you set; the send path is fixed end-to-end (REST POST + dm:notify socket ping so both sides update instantly). Servers tab lists only servers you actually own or joined, each server screen has a banner + Main Web / Voice Webs categories, and text channels run the same live multi-author avatar lookup, date dividers, and optimistic send pattern as DMs — voice channels show a Phase 2 prompt because they need react-native-webrtc and a custom dev client. THE WEB is wired up properly — a vertical TikTok-style snap-scroll clip feed powered by expo-video, autoplay on the visible card, tap-to-pause, full action rail (avatar+follow, like, comment, mute), and a slide-up bottom sheet for comments with nested replies — plus a LINKED tab that filters the same pool to accepted friends only. Likes persist via the same Clip endpoint web uses, follow/unfollow hits the same /follows route, and watch-time telemetry POSTs to the FYP algorithm so your mobile dwell counts toward your personalization profile. The bottom tab bar is HOME / FRIENDS / SERVERS / WEB / SETTINGS — the new Settings tab groups every preference into Account / App / Media / System cards, with a profile preview row that pushes into the rich profile view (banner, accent-bordered avatar with APEX halo + status dot, BIO / MODS / LINKS tabs, Level + XP card, Now Playing widget). Phase 2 features (uploader, voice channels on mobile, settings sub-screens, edit-in-place for bio fields) fire a "Phase 2 — Coming soon" alert when tapped so nothing dead-ends. Security hardening landed in the same patch: profile social links and clip video URLs now go through a strict http(s) scheme allowlist before being handed to Linking.openURL or the video player, so a malicious server response can\'t inject javascript: or file:// schemes.',
  },
  {
    id: 'p185',
    title: 'Patch 1.8.5 is now live',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'Three changes this patch. Spotify presence got rebuilt — instead of every browser polling every few seconds, the server now runs a single adaptive poller per Spotify-connected user and broadcasts updates over Socket.io. Per-friend HTTP traffic dropped from O(viewers × friends) to O(friends), with intervals that ramp from 10s while playing down to 5 minutes when nothing\'s on, and idle users stop being polled entirely. Friend avatars are now live — the Friends panel, Spidr Web rosters, and pending request rows all read from the live UserProfile instead of the stale snapshot baked into the Friend row when you first added them, so updated profile pics show up immediately across every tab. And there\'s a brand-new 404 page — a hand-drawn cave-and-web scene with the Spidr mascot lost in the middle of the web, replacing the host\'s default not-found page; auth-aware CTAs route you back home, back to the previous page, or to the sign-in screen depending on whether you\'re logged in.',
  },
  {
    id: 'p184',
    title: 'Patch 1.8.4 is now live',
    date: '2026-06-16',
    type: 'UPDATE',
    description: 'DJ Booth in voice channels — pick the green Music icon in the call dock, search Spotify, and the whole room sees a synchronized DJ matrix with spinning album art, three Spotify-green pulse rings, and a bouncing audience. Server now tracks who\'s DJing per channel (/voice-channels/:id/dj-session), broadcasts changes over Socket.io, and auto-ends the session if the host leaves the call. Note: this is the visual presence layer — every listener still plays the host\'s track on their own Spotify; true synchronized playback is coming later (needs Web Playback SDK + Premium). Spotify search itself was missing the backend endpoint — typing in the picker now actually returns tracks. Expand on a minimized call is fixed — clicking the pill or PiP now routes you back to the call\'s home page instead of flashing open and immediately re-minimizing. Mutuals tab is hidden on your own profile (you can\'t have mutuals with yourself). DJ result lists capped at 10 per Spotify dev-mode quota; once the app exits closed beta the limit goes back to 50.',
  },
  {
    id: 'p183',
    title: 'Patch 1.8.3 is now live',
    date: '2026-06-15',
    type: 'FIX',
    description: 'Weather module fix and privacy upgrade. The Weather widget was showing YOUR weather on every profile because it was pulling coordinates from the viewer\'s browser instead of the profile owner\'s saved location — now each user has their own weather coordinates stored on their profile, and viewing someone\'s profile shows THEIR temperature, condition, humidity, and wind. The city / county / region name has been removed from the display entirely — only the raw weather data is shown, so the owner\'s precise location stays private even though their weather is shared. First-time setup is automatic on your own profile (geolocation prompts once, lat/lon saved silently). Profiles that haven\'t configured weather now show "Weather not configured" instead of leaking the viewer\'s data.',
  },
  {
    id: 'p182',
    title: 'Patch 1.8.2 is now live',
    date: '2026-06-15',
    type: 'UPDATE',
    description: 'Voice channel Theater Mode: when someone shares their screen, a full-bleed Theater Stage now fills the view instead of the old grid layout. Minimized calls now show a live Picture-in-Picture preview of the active stream — screen share takes priority over camera. Repost is live on THE WEB — tap the repost button on any clip to share it to your feed. Profile Anthem: set a song on your profile that auto-plays (muted) when someone views it. Nameplate Cropper: resize and reposition your nameplate image directly in-app. Server Invite Cards: generate a shareable invite card for your server. Linkify: URLs in chat are now automatically converted to clickable links. Create Server modal rebuilt from scratch — fixed animation glitches and added a Join by Invite Code tab so you can enter a code without leaving the dialog. Activity-feed reply notifications: when someone comments on your post you get a Holo-Ping (purple) in the notification center, and the post glows in your feed until you read it. Spotify Now Playing on web (closed beta): the widget used to only work in the Electron desktop app because browsers are sandboxed and can\'t read the OS media session. Now it ships a "Connect Spotify" button on your profile — link your account via OAuth and Spidr polls the Spotify API every 10s to keep your current track in sync. Tokens are stored server-side and auto-refreshed. Currently capped at 25 whitelisted testers per Spotify dev-mode rules — ping Chris for access. Non-whitelisted users now get a friendly "closed beta" toast instead of a cryptic Spotify error. Holographic Profile rate-limit fix: the timezone auto-detect was firing on every render and flooding the server with 429s — now runs once when your timezone is missing and never again. Electron desktop app: custom title bar with minimize, maximize/restore, and close buttons — no more borderless window with no controls.',
  },
  {
    id: 'p181',
    title: 'Patch 1.8.1 is now live',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Welcome Bot now fires for every join path. Previously the greeting only triggered when a member joined via an invite link — users who joined a public server through the Browse / Join button were silently skipped. Welcome Bot logic is now in a shared server utility so it runs consistently across all join routes, and failures are logged without blocking the join itself.',
  },
  {
    id: 'p18web',
    title: 'Patch 1.8 — The Web Fixes',
    date: '2026-06-12',
    type: 'FIX',
    description: 'Slash command autocomplete rebuilt as Discord-style grouped cards — commands are sorted by bot (avatar, color, name) and rendered in a portal so the popup never clips inside the chat panel. Shows up to 30 commands at once with keyboard navigation (↑↓ to move, ↵ to select, Esc to dismiss) and auto-scroll to keep the highlighted row in view. Admin-only commands (/modset, /modlog, /modreset, /modtest, /welcomeset, /welcomeconfig, /welcomedelete) are hidden from non-admins in the autocomplete and blocked at execution if typed manually. Commands from bots not installed on the server are filtered out. New Auto Moderator commands: /modhelp (full usage guide), /modreset (wipe all config), /modtest <text> (dry-run text against the live filter without sending), and /modset unban all (clear every banned word at once). New Welcome Bot commands: /welcomehelp (usage guide), /welcomeconfig (show current message and channel), /welcomedelete (remove the welcome message). Admins can now delete bot responses and system messages — a trash button appears on hover. Server owners and admins can delete any message in their server (previously author-only). Copy Channel ID now properly awaits the clipboard write before showing a success toast — fixes phantom "Copied" in Electron.',
  },
  {
    id: 'p18',
    title: 'Patch 1.8 is now live',
    date: '2026-06-10',
    type: 'UPDATE',
    description: 'Bot system overhaul — all four official bots are now fully functional. Auto Moderator runs server-side on every message: spam detection flags users who send too many messages in a short window, and a word filter blocks slurs and any custom banned words before the message lands in chat. Configure thresholds, banned words, and allowed exceptions from the Bot Laboratory\'s Configure panel. Welcome Bot fires a customizable greeting in your server\'s first text channel whenever a new member joins — set your own template with {user} and {server} placeholders. Game Master trivia is live: /trivia posts a question with four options, players answer with a single letter, and the first correct answer wins — a 30-second timer reveals the answer if nobody gets it. Music Master improvements: /play now fetches the YouTube video title for the queue display, and /skip and /stop reliably clear the cinema stream from the voice channel.',
  },
  {
    id: 'p172',
    title: 'Patch 1.7.2 is now live',
    date: '2026-06-09',
    type: 'FIX',
    description: 'Polish and UX pass. "Cocoons" renamed to "Saved" across THE WEB feed, profile tabs, and collections. Volume slider in the feed no longer disappears when you move the mouse to adjust it — fixed a CSS hover gap that was losing the pointer. GIF picker and image upload panels in comments now collapse automatically when you scroll to a new video. Clicking a saved clip in your Saved collections now jumps directly to that video in the feed.',
  },
  {
    id: 'p171',
    title: 'Patch 1.7.1 is now live',
    date: '2026-06-08',
    type: 'FIX',
    description: 'Security and polish pass. Adding a friend you\'ve already added now shows "You already added this user!" instead of leaking internal database errors. SPIDR_SYS was missing patches 1.6.2, 1.7, and the deploy pipeline fix — the server feed is now fully in sync with all release history.',
  },
  {
    id: 'p17',
    title: 'Patch 1.7 is now live',
    date: '2026-06-03',
    type: 'UPDATE',
    description: 'Module Nexus overhaul. Gaming Uplink now detects games from any launcher with automatic icon extraction — League of Legends, VALORANT, TFT, Steam, Epic, Battle.net, Game Pass, and more. Background apps (Medal, Discord, Spotify, OBS) are no longer misidentified as games. Spotify Now Playing is live: connect your Spotify account in Settings → Neural and your current track appears in your profile widget. New: a "Don\'t see your game?" report form lets users flag missing detection. Module Nexus now clearly marks which widgets are under construction vs. live. Electron desktop app improvements: Spidr branding icon, window dragging from the top edge, and resizable window. APEX upgrade dialog fixed — it was rendering behind the store overlay and appearing invisible. Two new support routes added to the server: /spotify for OAuth and /support/game-report for the feedback form.',
  },
  {
    id: 'p162',
    title: 'Patch 1.6.2 is now live',
    date: '2026-06-02',
    type: 'UPDATE',
    description: 'Shell architecture overhaul. SpidrShell is now the unified layout wrapper for the entire app — the old AppShell has been retired. Mobile navigation is rebuilt: a new MobileMenuPanel gives a clean, full-featured drawer for phones and tablets. Legacy components removed: TopFeedBar, UserProfilePod, GroupChatMembers, and the old Home page are gone, replaced by the HomeDashboard and integrated profile flows. KineticChat, NotificationCenter, Sidebar, BotLaboratory, DirectMessages, FriendsPanel, ServersPanel, NerveCenter, SettingsPanel, MobileBottomBar, and UserStatusChip all received updates to wire into the new shell and clean up stale references.',
  },
  {
    id: 'p162b',
    title: 'Deploy pipeline fixed',
    date: '2026-06-02',
    type: 'FIX',
    description: 'Switched the production deploy workflow from plain FTP to FTPS (FTP over TLS). The old config was timing out due to firewall restrictions on GitHub Actions runners — FTPS resolves the control socket timeout so web deploys to Hostinger complete reliably again.',
  },
  {
    id: 'p161',
    title: 'Patch 1.6.1 is now live',
    date: '2026-05-31',
    type: 'FIX',
    description: 'A polish-and-stability pass on top of 1.6. Voice channels: connected users now drop down a vertical "web thread" to glowing crimson avatar nodes instead of the old branch. The expanded voice deck got a cleaner glass reskin with a soft crimson glow and smooth-cornered participant tiles. Screen share now splits into a proper Main Stage (with a > LIVE_FEED tag) plus a vertical glass sidebar of compact, audio-reactive user pills you can collapse for full-screen. The minimized call is now a tiny "Micro-Tactical HUD" pill that fades out when idle and expands on hover into mute / deafen / volume / record controls. New: an out-of-app "Spidr Protocol" transparent overlay (desktop) so you can read and send chat over a game without leaving it — with click-through and a Shift+Enter typing hotkey. Fixes: group chats no longer render blank (a media-only message could crash them); DM/group voice calls no longer show duplicate users when someone joins; the clean no-lines message feed; and the top-right profile widget no longer overlaps content.',
  },
  {
    id: 'p16',
    title: 'Patch 1.6 is now live',
    date: '2026-05-31',
    type: 'UPDATE',
    description: 'The biggest visual + functionality pass yet. THE WEB feed: trending posts now physically pulse, The Weaver upload studio gets signature filters (Dormant / Glitch / Neon Tear) + a terminal caption, a precision dual-handle video scrubber, and external audio grafting from YouTube / Spotify / Apple Music with scroll-based auto-play. New: tap-to-expand image lightbox in chat, rich GIF/image comments, and long-press context menus for mobile. Channel sidebar rebuilt as glowing pill-nodes; server chat reskinned to the crimson palette with status dots, role badges and themed media embeds; and the Bot Laboratory got the full terminal/glass treatment. Custom backgrounds now flow across the whole app (home, THE WEB, Signal Radar, Settings, and the sidebar) and render far smoother. Fixes: the minimized voice node now animates and its buttons work reliably (no more vanishing calls); server permissions no longer treat everyone as admin; deafen and mute are properly distinct and you cannot deafen others in DMs/groups; "Pin to Web" confirms; tapping a message in the Memory Web jumps to it; voice channels show who joined again; full mobile responsiveness with no cut-off sidebars.',
  },
  {
    id: 'p15',
    title: 'Patch 1.5 is now live',
    date: '2026-05-29',
    type: 'UPDATE',
    description: 'APEX Symbiote suite: Profile Takeover overlay, Stream HUD with live telemetry, Frame Vault, Nexus Grid sidebar, and custom Nameplates & Badges. Plus fixes: the minimized call now uses the new Web Node design across servers, DMs, and groups; minimizing no longer disconnects you; the sidebar logo box is gone; APEX activation and access are fixed; and trending servers no longer 404.',
  },
  {
    id: 'p14',
    title: 'Patch 1.4 is now live',
    date: '2026-05-24',
    type: 'UPDATE',
    description: 'APEX hanging threads + mini voice visualizers, auto-minimize on navigation, Electron picture-in-picture, and "Pin to Spidr Web" across Friends, DMs, and Groups.',
  },
  {
    id: 'voicefix',
    title: 'Voice messages fixed everywhere',
    date: '2026-05-24',
    type: 'FIX',
    description: 'Resolved the upload rejection that blocked voice notes. Voice messages now send in DMs, group chats, and server channels.',
  },
  {
    id: 'webnode',
    title: 'Suspended Web Node',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'The minimized call is now a draggable radial "web node" with a radial active-speaker waveform and APEX-colored thread.',
  },
  {
    id: 'unicall',
    title: 'Universal calling',
    date: '2026-05-23',
    type: 'UPDATE',
    description: 'DM and group calls now use the exact same voice deck, context menus, and screen share as server channels.',
  },
  {
    id: 'trending',
    title: 'Trending server join flow',
    date: '2026-05-22',
    type: 'FIX',
    description: 'Opening a server from Trending no longer 404s — non-members get a Join / Request Invite screen.',
  },
];

router.get('/news', (_req, res) => {
  res.json(NEWS);
});

module.exports = router;
