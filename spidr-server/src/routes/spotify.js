/**
 * Spotify Now Playing Routes
 *
 * GET    /spotify/auth/start          — redirect user to Spotify OAuth (no JWT; opens in browser)
 * GET    /spotify/auth/callback       — exchange code, store tokens, redirect to client
 * GET    /spotify/now-playing         — fetch current/recent track (JWT required)
 * DELETE /spotify/auth/disconnect     — clear stored tokens (JWT required)
 */

const express     = require('express');
const authMW      = require('../middleware/auth');
const UserProfile = require('../models/UserProfile');

const router = express.Router();

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
].join(' ');

function redirectUri() {
  const base = process.env.SERVER_URL || 'http://localhost:4000';
  return `${base}/spotify/auth/callback`;
}

// ── GET /spotify/auth/start?userId=xxx ────────────────────────────────────────
// Opens in the user's browser — no JWT, userId carried via state param.
router.get('/auth/start', (req, res) => {
  const { SPOTIFY_CLIENT_ID } = process.env;
  if (!SPOTIFY_CLIENT_ID) return res.status(503).json({ error: 'Spotify not configured on this server' });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     SPOTIFY_CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  redirectUri(),
    state:         userId,
    show_dialog:   'false',
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// ── GET /spotify/auth/callback ────────────────────────────────────────────────
router.get('/auth/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  if (error || !code || !userId) {
    return res.redirect(`${origin}/?spotify_error=cancelled`);
  }

  try {
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
    const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method:  'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access_token in Spotify response');

    await UserProfile.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          'neural_links.spotify_connected':     true,
          'neural_links.spotify_access_token':  tokens.access_token,
          'neural_links.spotify_refresh_token': tokens.refresh_token,
          'neural_links.spotify_token_expires': Date.now() + tokens.expires_in * 1000,
        },
      },
    );

    res.redirect(`${origin}/?spotify_connected=true`);
  } catch (err) {
    console.error('[spotify] callback error:', err.message);
    res.redirect(`${(process.env.CLIENT_ORIGIN || 'http://localhost:5173')}/?spotify_error=failed`);
  }
});

// ── Token refresh helper ──────────────────────────────────────────────────────
async function refreshToken(userId, refreshTok) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  const res  = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Refresh failed');

  await UserProfile.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        'neural_links.spotify_access_token':  data.access_token,
        'neural_links.spotify_token_expires': Date.now() + data.expires_in * 1000,
        ...(data.refresh_token ? { 'neural_links.spotify_refresh_token': data.refresh_token } : {}),
      },
    },
  );
  return data.access_token;
}

function trackShape(item, progressMs, isPlaying) {
  return {
    id:       item.id,
    name:     item.name,
    artist:   item.artists.map(a => a.name).join(', '),
    album:    item.album.name,
    albumArt: item.album.images?.[0]?.url || null,
    duration: item.duration_ms,
    progress: progressMs || 0,
    url:      item.external_urls?.spotify || null,
    playing:  isPlaying,
  };
}

// ── GET /spotify/now-playing (JWT required) ───────────────────────────────────
router.get('/now-playing', authMW, async (req, res) => {
  const userId = req.user.id;

  const profile = await UserProfile.findOne({ user_id: userId }).lean();
  if (!profile?.neural_links?.spotify_connected) {
    return res.json({ connected: false });
  }

  let token   = profile.neural_links.spotify_access_token;
  const exp   = profile.neural_links.spotify_token_expires || 0;
  const refTok = profile.neural_links.spotify_refresh_token;

  // Proactively refresh if within 60s of expiry
  if (Date.now() > exp - 60_000) {
    try { token = await refreshToken(userId, refTok); }
    catch { return res.json({ connected: true, playing: false, error: 'token_expired' }); }
  }

  // Current track
  const cpRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (cpRes.status === 204 || !cpRes.ok) {
    // Nothing playing — fall back to last played track
    const rpRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (rpRes.ok) {
      const rp   = await rpRes.json();
      const item = rp.items?.[0]?.track;
      if (item) return res.json({ connected: true, playing: false, track: trackShape(item, 0, false) });
    }
    return res.json({ connected: true, playing: false, track: null });
  }

  const data = await cpRes.json();
  if (!data?.item) return res.json({ connected: true, playing: false, track: null });

  res.json({ connected: true, playing: data.is_playing, track: trackShape(data.item, data.progress_ms, data.is_playing) });
});

// ── DELETE /spotify/auth/disconnect (JWT required) ───────────────────────────
router.delete('/auth/disconnect', authMW, async (req, res) => {
  await UserProfile.findOneAndUpdate(
    { user_id: req.user.id },
    {
      $set: {
        'neural_links.spotify_connected':     false,
        'neural_links.spotify_access_token':  null,
        'neural_links.spotify_refresh_token': null,
        'neural_links.spotify_token_expires': null,
      },
    },
  );
  res.json({ ok: true });
});

module.exports = router;
