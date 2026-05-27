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
