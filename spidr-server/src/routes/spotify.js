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
const spotifyPresence = require('../utils/spotifyPresence');

const router = express.Router();

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
].join(' ');

function redirectUri() {
  const base = process.env.SERVER_URL || 'http://127.0.0.1:4000';
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
    show_dialog:   'true',
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
    artist:   item.artists?.map(a => a.name).join(', ') || item.show?.name || 'Unknown',
    album:    item.album?.name || item.show?.name || '',
    albumArt: item.album?.images?.[0]?.url || item.images?.[0]?.url || null,
    duration: item.duration_ms,
    progress: progressMs || 0,
    url:      item.external_urls?.spotify || null,
    playing:  isPlaying,
  };
}

async function fetchNowPlaying(token) {
  const cpRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return cpRes;
}

// ── GET /spotify/now-playing (JWT required) ───────────────────────────────────
router.get('/now-playing', authMW, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const userId = req.user.id;

    const profile = await UserProfile.findOne({ user_id: userId }).lean();
    const connected = !!profile?.neural_links?.spotify_connected;
    const exp = profile?.neural_links?.spotify_token_expires || 0;
    console.log(`[spotify] userId=${userId} connected=${connected} tokenExpiry=${new Date(exp).toISOString()}`);
    if (!connected) {
      return res.json({ connected: false });
    }

    let token    = profile.neural_links.spotify_access_token;
    const refTok = profile.neural_links.spotify_refresh_token;

    // Proactively refresh if within 60s of expiry
    if (Date.now() > exp - 60_000) {
      try { token = await refreshToken(userId, refTok); }
      catch (err) {
        console.log(`[spotify] proactive refresh failed: ${err.message}`);
        return res.json({ connected: true, playing: false, error: 'token_expired' });
      }
    }

    let cpRes = await fetchNowPlaying(token);
    console.log(`[spotify] currentlyPlaying status=${cpRes.status}`);

    // Retry once with a fresh token if Spotify rejects (token revoked / clock skew)
    if (cpRes.status === 401 && refTok) {
      try {
        token = await refreshToken(userId, refTok);
        cpRes = await fetchNowPlaying(token);
        console.log(`[spotify] 401 retry status=${cpRes.status}`);
      } catch (err) {
        console.log(`[spotify] 401 refresh retry failed: ${err.message}`);
        return res.json({ connected: true, playing: false, error: 'token_expired' });
      }
    }

    if (cpRes.status === 403) {
      console.log('[spotify] 403 — app lacks Extended Access quota (playback APIs restricted in dev mode)');
      return res.json({ connected: true, playing: false, error: 'quota_exceeded' });
    }

    if (cpRes.status === 204 || !cpRes.ok) {
      console.log(`[spotify] no active player (status=${cpRes.status}), trying recently-played`);
      const rpRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (rpRes.ok) {
        const rp   = await rpRes.json();
        const item = rp.items?.[0]?.track;
        console.log(`[spotify] recently-played: ${item?.name ?? 'null'}`);
        if (item) return res.json({ connected: true, playing: false, track: trackShape(item, 0, false) });
      }
      return res.json({ connected: true, playing: false, track: null });
    }

    const data = await cpRes.json();
    if (!data?.item || data.currently_playing_type === 'ad') {
      console.log(`[spotify] skipping ad or no item (type=${data?.currently_playing_type})`);
      return res.json({ connected: true, playing: false, track: null });
    }

    console.log(`[spotify] playing: ${data.item.name} by ${data.item.artists?.[0]?.name}`);
    res.json({ connected: true, playing: data.is_playing, track: trackShape(data.item, data.progress_ms, data.is_playing) });
  } catch (err) {
    console.error('[spotify] now-playing error:', err.message);
    res.status(500).json({ connected: true, playing: false, error: 'internal' });
  }
});

// ── GET /spotify/now-playing/:userId (JWT required) ─────────────────────────
// Cached snapshot endpoint for initial paint. The viewer subscribes via socket
// (spotify:subscribe) immediately after this for live updates. If the poller
// has no cache yet (first viewer of this user, hasn't completed a poll),
// returns 202 so the client can show a "loading" state — the socket will
// deliver the real payload within ~1s.
router.get('/now-playing/:userId', authMW, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { userId } = req.params;
  const cached = spotifyPresence.getCached(userId);
  if (cached) return res.json(cached);
  return res.status(202).json({ userId, connected: null, is_playing: false, pending: true });
});

// ── DELETE /spotify/auth/disconnect (JWT required) ───────────────────────────
// ── App-only Client Credentials token (cached) — used by /search and any
// catalog lookup that doesn't need a specific user's OAuth scope.
let appTokenCache = { token: null, expiresAt: 0 };
async function getAppToken() {
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt - 30_000) {
    return appTokenCache.token;
  }
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET missing)');
  }
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const data = await r.json();
  if (!data.access_token) {
    console.error('[spotify] client_credentials failed:', r.status, JSON.stringify(data).slice(0, 500));
    throw new Error(`Spotify client_credentials failed (status ${r.status}): ${data.error_description || data.error || 'no token'}`);
  }
  appTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return appTokenCache.token;
}


// ── iTunes preview enrichment ────────────────────────────────────────────────
// Spotify removed `preview_url` from Web API responses for apps created after
// Nov 2024 — our search now gets null for essentially the ENTIRE catalog,
// which silently emptied every preview-dependent surface (the DJ booth's
// playable-only picker returned zero results). Apple's iTunes Search API
// still serves 30-second previews for most of the same catalog, free and
// keyless, so we backfill missing previews from there. Cached in-memory
// (6h TTL, capped) because DJ searches repeat the same popular tracks.
const itunesCache = new Map(); // key → { url, at }
const ITUNES_TTL = 6 * 60 * 60 * 1000;
const ITUNES_CACHE_MAX = 2000;
async function itunesPreview(name, artist) {
  const key = `${(artist || '').toLowerCase()}|${(name || '').toLowerCase()}`;
  const hit = itunesCache.get(key);
  if (hit && Date.now() - hit.at < ITUNES_TTL) return hit.url;
  let url = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const term = encodeURIComponent(`${artist || ''} ${name || ''}`.trim().slice(0, 120));
    const r = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`,
      { signal: ctrl.signal }
    );
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json().catch(() => null);
      url = d?.results?.[0]?.previewUrl || null;
    }
  } catch { /* timeout / network — leave null */ }
  if (itunesCache.size > ITUNES_CACHE_MAX) itunesCache.clear();
  itunesCache.set(key, { url, at: Date.now() });
  return url;
}

// ── GET /spotify/search?q=...&limit=12 ───────────────────────────────────────
// Searches Spotify's track catalog. Returns { tracks: [{ id, name, artist,
// album, album_art_url, preview_url, external_url, duration_ms }] }.
router.get('/search', authMW, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    // Cap at 10: Spotify dev-mode apps reject limit > 10 with 400 "Invalid limit",
    // even though their public docs say max=50. Bump this once the app exits
    // dev mode / extended-quota review.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 10);
    if (!q) return res.json({ tracks: [] });

    const token = await getAppToken();
    const url = `https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.error(`[spotify] search ${r.status} for q="${q}":`, body.slice(0, 500));
      // 401 = token rejected → bust the cache so the next call mints fresh.
      if (r.status === 401) appTokenCache = { token: null, expiresAt: 0 };
      return res.status(502).json({ error: 'Spotify search failed', status: r.status, body });
    }
    const data = await r.json();
    const tracks = (data.tracks?.items || []).map(item => ({
      id:            item.id,
      name:          item.name,
      artist:        item.artists?.map(a => a.name).join(', ') || 'Unknown',
      album:         item.album?.name || '',
      album_art_url: item.album?.images?.[0]?.url || null,
      preview_url:   item.preview_url || null,
      external_url:  item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
      duration_ms:   item.duration_ms || 0,
    }));
    // Backfill previews Spotify no longer provides. Parallel, individually
    // timeboxed, and cached — worst case adds ~2.5s to a cold search.
    await Promise.all(tracks.map(async (t) => {
      if (!t.preview_url) {
        const itunes = await itunesPreview(t.name, t.artist);
        if (itunes) { t.preview_url = itunes; t.preview_source = 'itunes'; }
      }
    }));
    res.json({ tracks });
  } catch (err) {
    console.error('[spotify] search error:', err.message);
    res.status(503).json({ error: err.message, tracks: [] });
  }
});

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
