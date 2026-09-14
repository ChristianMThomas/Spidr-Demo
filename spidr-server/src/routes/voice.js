const express = require('express');
const authMW = require('../middleware/auth');

/**
 * Voice infrastructure config.
 *
 *   GET /voice/ice - ICE server list for RTCPeerConnection.
 *
 * This is the ONLY /voice/ice handler. socket/voiceSignaling.js has a
 * getTurnConfig() that looks like a second one, but it is dead code: it was
 * registered in index.js *after* the '/voice' router mount, so Express never
 * reached it. Its openrelay fallback lives here now instead.
 *
 * STUN alone only works when both peers can discover a direct path; users
 * behind symmetric NATs / strict firewalls (very common on home + mobile
 * networks, and the packaged Electron app) NEED a TURN relay or the call
 * connects locally and dies cross-network - the classic "we can't call
 * each other" failure. phone-on-cellular <-> desktop-on-wifi is exactly
 * that case, so we never serve a STUN-only list.
 *
 * Configure any TURN provider (Metered.ca has a free tier, Twilio NTS,
 * or self-hosted coturn) via env:
 *   TURN_URLS        comma-separated, e.g. "turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp"
 *   TURN_USERNAME
 *   TURN_CREDENTIAL
 *
 * Without full TURN env, falls back to the free public openrelay pool.
 */
const router = express.Router();

const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Free public TURN - rate-limited and occasionally down, but it connects the
// symmetric-NAT pairs STUN cannot reach at all. Replace via TURN_* env.
const FALLBACK_TURN = [
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

router.get('/ice', authMW, (req, res) => {
  // TURN_URL (singular) is accepted too - the dead voiceSignaling.js copy used
  // that spelling, so either may already be set in a deploy env.
  const urls = (process.env.TURN_URLS || process.env.TURN_URL || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const turnConfigured = urls.length > 0
    && !!process.env.TURN_USERNAME
    && !!process.env.TURN_CREDENTIAL;

  const turn = turnConfigured
    ? [{ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }]
    : FALLBACK_TURN;

  res.json({ iceServers: [...STUN, ...turn], turnConfigured });
});

module.exports = router;
