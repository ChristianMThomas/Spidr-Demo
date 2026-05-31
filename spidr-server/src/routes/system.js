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
