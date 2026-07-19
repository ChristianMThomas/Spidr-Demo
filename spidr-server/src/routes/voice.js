const express = require('express');
const authMW = require('../middleware/auth');

/**
 * Voice infrastructure config.
 *
 *   GET /voice/ice — ICE server list for RTCPeerConnection.
 *
 * STUN alone only works when both peers can discover a direct path; users
 * behind symmetric NATs / strict firewalls (very common on home + mobile
 * networks, and the packaged Electron app) NEED a TURN relay or the call
 * connects locally and dies cross-network — the classic "we can't call
 * each other" failure.
 *
 * Configure any TURN provider (Metered.ca has a free tier, Twilio NTS,
 * or self-hosted coturn) via env:
 *   TURN_URLS        comma-separated, e.g. "turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp"
 *   TURN_USERNAME
 *   TURN_CREDENTIAL
 *
 * Without TURN env, returns STUN-only (same behavior as before, but now
 * explicit instead of a 404 fallback).
 */
const router = express.Router();

const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

router.get('/ice', authMW, (req, res) => {
  const iceServers = [...STUN];
  const urls = (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  res.json({ iceServers, turnConfigured: urls.length > 0 });
});

module.exports = router;
