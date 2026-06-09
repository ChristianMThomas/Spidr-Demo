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
