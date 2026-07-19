const express = require('express');
const jwt = require('jsonwebtoken');
const authMW = require('../middleware/auth');
const UserProfile = require('../models/UserProfile');

/**
 * Apple Music (MusicKit) integration — Spidr's edge over Discord, which has
 * NO Apple Music support at all.
 *
 *   GET    /apple-music/dev-token        — MusicKit developer token (JWT ES256)
 *   GET    /apple-music/search?q=        — catalog search (dev token only —
 *                                          works for EVERY user, no connection
 *                                          needed, previews included)
 *   POST   /apple-music/user-token       — store the Music User Token minted by
 *                                          MusicKit JS `authorize()` client-side
 *   GET    /apple-music/recently-played  — the user's last played track (Apple
 *                                          has NO live now-playing endpoint;
 *                                          this is the closest official signal)
 *   DELETE /apple-music/disconnect       — clear stored connection
 *
 * Required env (Apple Developer Program → Certificates → Keys → MusicKit):
 *   APPLE_TEAM_ID              e.g. "AB12CD34EF"
 *   APPLE_MUSICKIT_KEY_ID      e.g. "XYZ123ABCD"
 *   APPLE_MUSICKIT_PRIVATE_KEY the .p8 contents (literal newlines or \n-escaped)
 *
 * Without these, /dev-token returns 503 { configured: false } and the client
 * hides all Apple Music UI — the feature degrades to invisible, never broken.
 */

const router = express.Router();

const TEAM_ID = process.env.APPLE_TEAM_ID || '';
const KEY_ID = process.env.APPLE_MUSICKIT_KEY_ID || '';
const PRIVATE_KEY = (process.env.APPLE_MUSICKIT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const STOREFRONT_DEFAULT = process.env.APPLE_MUSIC_STOREFRONT || 'us';

const configured = () => !!(TEAM_ID && KEY_ID && PRIVATE_KEY);

// ── Developer token (cached; Apple allows up to 6 months, we mint 12h) ──────
let devTokenCache = { token: null, expiresAt: 0 };
function getDevToken() {
  if (!configured()) return null;
  if (devTokenCache.token && Date.now() < devTokenCache.expiresAt - 60_000) {
    return devTokenCache.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: TEAM_ID, iat: now, exp: now + 12 * 60 * 60 },
    PRIVATE_KEY,
    { algorithm: 'ES256', keyid: KEY_ID }
  );
  devTokenCache = { token, expiresAt: (now + 12 * 60 * 60) * 1000 };
  return token;
}

router.get('/dev-token', authMW, (req, res) => {
  if (!configured()) {
    return res.status(503).json({ configured: false, error: 'Apple Music is not configured on this server' });
  }
  try {
    res.json({ configured: true, token: getDevToken() });
  } catch (err) {
    console.error('[apple-music] dev token mint failed:', err.message);
    res.status(500).json({ configured: true, error: 'Could not mint developer token — check APPLE_MUSICKIT_PRIVATE_KEY format' });
  }
});

// ── Catalog search ───────────────────────────────────────────────────────────
// Same track shape as /spotify/search so every existing selection surface
// (DJ booth, anthem picker) can consume results with zero changes:
// { id, name, artist, album, album_art_url, preview_url, external_url,
//   duration_ms, source: 'apple' }
router.get('/search', authMW, async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'Apple Music not configured', tracks: [] });
  try {
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 25);
    if (!q) return res.json({ tracks: [] });

    const url = `https://api.music.apple.com/v1/catalog/${STOREFRONT_DEFAULT}/search` +
      `?types=songs&limit=${limit}&term=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${getDevToken()}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[apple-music] search ${r.status} for q="${q}":`, body.slice(0, 300));
      if (r.status === 401) devTokenCache = { token: null, expiresAt: 0 };
      return res.status(502).json({ error: 'Apple Music search failed', status: r.status });
    }
    const data = await r.json();
    const songs = data?.results?.songs?.data || [];
    const tracks = songs.map((s) => {
      const a = s.attributes || {};
      // Artwork URL templates use {w}x{h} placeholders.
      const art = a.artwork?.url
        ? a.artwork.url.replace('{w}', '300').replace('{h}', '300')
        : null;
      return {
        id: s.id,
        name: a.name || '',
        artist: a.artistName || 'Unknown',
        album: a.albumName || '',
        album_art_url: art,
        // Apple still ships previews for virtually the whole catalog —
        // unlike Spotify post-2024. This is why DJ Apple Music "just works".
        preview_url: a.previews?.[0]?.url || null,
        external_url: a.url || `https://music.apple.com/${STOREFRONT_DEFAULT}/song/${s.id}`,
        duration_ms: a.durationInMillis || 0,
        source: 'apple',
      };
    });
    res.json({ tracks });
  } catch (err) {
    console.error('[apple-music] search error:', err.message);
    res.status(503).json({ error: err.message, tracks: [] });
  }
});

// ── Store the Music User Token (client mints it via MusicKit authorize()) ───
router.post('/user-token', authMW, async (req, res) => {
  try {
    const token = (req.body?.music_user_token || '').toString();
    if (!token) return res.status(400).json({ error: 'music_user_token required' });
    await UserProfile.updateOne(
      { user_id: req.user.id },
      {
        $set: {
          'neural_links.apple_music_connected': true,
          'neural_links.apple_music_user_token': token,
          'neural_links.apple_music_connected_at': new Date(),
        },
      },
      { upsert: false }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Recently played (closest official signal to "listening now") ────────────
// Honest limitation: Apple Music's API has NO real-time now-playing endpoint.
// Live presence comes from playback through Spidr (MusicKit player) or the
// desktop OS media session; this endpoint is the "recently played" fallback.
router.get('/recently-played', authMW, async (req, res) => {
  if (!configured()) return res.status(503).json({ error: 'Apple Music not configured' });
  try {
    const profile = await UserProfile.findOne(
      { user_id: req.user.id },
      { neural_links: 1 }
    ).lean();
    const userToken = profile?.neural_links?.apple_music_user_token;
    if (!userToken) return res.status(400).json({ error: 'Apple Music not connected' });

    const r = await fetch('https://api.music.apple.com/v1/me/recent/played/tracks?limit=1', {
      headers: {
        Authorization: `Bearer ${getDevToken()}`,
        'Music-User-Token': userToken,
      },
    });
    if (r.status === 403) {
      // Token revoked / expired — flip the connection flag off honestly.
      await UserProfile.updateOne(
        { user_id: req.user.id },
        { $set: { 'neural_links.apple_music_connected': false } }
      );
      return res.status(403).json({ error: 'Apple Music session expired — reconnect' });
    }
    if (!r.ok) return res.status(502).json({ error: `Apple Music ${r.status}` });
    const data = await r.json();
    const t = data?.data?.[0]?.attributes;
    if (!t) return res.json({ track: null });
    res.json({
      track: {
        name: t.name,
        artist: t.artistName,
        album_art_url: t.artwork?.url?.replace('{w}', '120').replace('{h}', '120') || null,
        external_url: t.url || null,
      },
    });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

router.delete('/disconnect', authMW, async (req, res) => {
  try {
    await UserProfile.updateOne(
      { user_id: req.user.id },
      {
        $set: { 'neural_links.apple_music_connected': false },
        $unset: { 'neural_links.apple_music_user_token': '' },
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
