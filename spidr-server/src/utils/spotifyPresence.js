/**
 * spotifyPresence — server-side Spotify now-playing poller + broadcaster.
 *
 * Replaces the "every viewer polls every 25s" model with:
 *   1. ONE poller per Spotify-connected user (not per viewer)
 *   2. Cached last-known state served instantly to new subscribers
 *   3. Socket.io broadcast to a per-user room (spotify:<userId>) on change
 *   4. Adaptive interval: playing 10s → paused 30s → idle backs off to 5m
 *   5. Lazy: only polls users with at least one subscribed viewer
 *
 * Cost: O(active connected users with ≥1 viewer), not O(viewers × users).
 */

const UserProfile = require('../models/UserProfile');

// userId → poller state
//   viewerCount    — how many sockets subscribed to spotify:<userId>
//   timer          — setTimeout handle for next poll (null when stopped)
//   currentInterval— ms until next poll
//   lastTrack      — last normalized payload broadcast (also served from cache)
//   lastChangeAt   — Date.now() of last detected track/state change
const presence = new Map();

const INTERVAL_PLAYING       = 10_000;
const INTERVAL_PAUSED        = 30_000;
const INTERVAL_IDLE_START    = 60_000;
const INTERVAL_IDLE_MAX      = 5 * 60_000;
const IDLE_BACKOFF_AFTER_MS  = 2 * 60_000;  // how long "nothing playing" before we start backing off

let ioRef = null;

function init(io) {
  ioRef = io;
  console.log('[spotifyPresence] worker initialized');
}

// ── Token + Spotify fetch ────────────────────────────────────────────────────
async function refreshToken(userId, refreshTok) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Spotify refresh failed');
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

function normalize(userId, raw, isPlaying) {
  // raw is the Spotify "item" object (track or episode)
  if (!raw) return { userId, connected: true, is_playing: false, sampled_at: Date.now() };
  return {
    userId,
    connected:     true,
    is_playing:    !!isPlaying,
    track_id:      raw.id,
    track_name:    raw.name,
    artist:        raw.artists?.map(a => a.name).join(', ') || raw.show?.name || 'Unknown',
    album:         raw.album?.name || raw.show?.name || '',
    album_art_url: raw.album?.images?.[0]?.url || raw.images?.[0]?.url || null,
    spotify_url:   raw.external_urls?.spotify || null,
    duration_ms:   raw.duration_ms || 0,
    progress_ms:   0, // filled by caller
    sampled_at:    Date.now(),
  };
}

async function fetchNowPlaying(userId) {
  const profile = await UserProfile.findOne({ user_id: userId }).lean();
  if (!profile?.neural_links?.spotify_connected) {
    return { userId, connected: false, is_playing: false, sampled_at: Date.now() };
  }

  let token = profile.neural_links.spotify_access_token;
  const refTok = profile.neural_links.spotify_refresh_token;
  const exp = profile.neural_links.spotify_token_expires || 0;

  if (Date.now() > exp - 60_000) {
    try { token = await refreshToken(userId, refTok); }
    catch { return { userId, connected: true, is_playing: false, error: 'token_expired', sampled_at: Date.now() }; }
  }

  let r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (r.status === 401 && refTok) {
    try {
      token = await refreshToken(userId, refTok);
      r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      return { userId, connected: true, is_playing: false, error: 'token_expired', sampled_at: Date.now() };
    }
  }

  if (r.status === 403) {
    return { userId, connected: true, is_playing: false, error: 'quota_exceeded', sampled_at: Date.now() };
  }

  // 204 = no active player. Fall back to recently-played so the widget still
  // shows the last track (greyed out / paused state on the frontend).
  if (r.status === 204 || !r.ok) {
    const rp = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (rp.ok) {
      const data = await rp.json();
      const item = data.items?.[0]?.track;
      if (item) {
        const payload = normalize(userId, item, false);
        payload.progress_ms = 0;
        return payload;
      }
    }
    return { userId, connected: true, is_playing: false, sampled_at: Date.now() };
  }

  const data = await r.json();
  if (!data?.item || data.currently_playing_type === 'ad') {
    return { userId, connected: true, is_playing: false, sampled_at: Date.now() };
  }

  const payload = normalize(userId, data.item, data.is_playing);
  payload.progress_ms = data.progress_ms || 0;
  return payload;
}

// ── Change detection ────────────────────────────────────────────────────────
// We DON'T broadcast every poll. We only broadcast when something meaningful
// changed — track id, play/pause, connection state. The progress_ms is ticked
// locally on the client between updates, so we don't need to spam it.
function isMeaningfulChange(prev, next) {
  if (!prev) return true;
  if (prev.connected !== next.connected)   return true;
  if (prev.is_playing !== next.is_playing) return true;
  if (prev.track_id   !== next.track_id)   return true;
  if (prev.error      !== next.error)      return true;
  // Re-emit if the client's local progress would have drifted >5s — happens
  // when the user scrubs the track. Cheap insurance against stuck progress bars.
  if (next.is_playing && prev.progress_ms != null && next.progress_ms != null) {
    const expectedProgress = prev.progress_ms + (next.sampled_at - prev.sampled_at);
    if (Math.abs(expectedProgress - next.progress_ms) > 5000) return true;
  }
  return false;
}

function pickInterval(state, payload) {
  if (payload.is_playing) return INTERVAL_PLAYING;
  if (payload.track_id)   return INTERVAL_PAUSED;
  // Nothing playing — back off the longer it's been quiet.
  const idleFor = Date.now() - (state.lastChangeAt || 0);
  if (idleFor < IDLE_BACKOFF_AFTER_MS) return INTERVAL_IDLE_START;
  const next = Math.min(state.currentInterval * 2, INTERVAL_IDLE_MAX);
  return next;
}

// ── Per-user poll loop ──────────────────────────────────────────────────────
async function pollOnce(userId) {
  const state = presence.get(userId);
  if (!state || state.viewerCount <= 0) return; // viewer left while we were waiting

  let payload;
  try {
    payload = await fetchNowPlaying(userId);
  } catch (err) {
    console.warn(`[spotifyPresence] poll error user=${userId}:`, err.message);
    payload = { userId, connected: true, is_playing: false, error: 'internal', sampled_at: Date.now() };
  }

  const changed = isMeaningfulChange(state.lastTrack, payload);
  state.lastTrack = payload;
  if (changed) {
    state.lastChangeAt = Date.now();
    broadcast(userId, payload);
  }

  state.currentInterval = pickInterval(state, payload);
  schedule(userId);
}

function schedule(userId) {
  const state = presence.get(userId);
  if (!state || state.viewerCount <= 0) return;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => pollOnce(userId).catch(() => {}), state.currentInterval);
}

function broadcast(userId, payload) {
  if (!ioRef) return;
  ioRef.to(`spotify:${userId}`).emit('spotify:now-playing', payload);
}

// ── Public API ──────────────────────────────────────────────────────────────
function subscribe(userId) {
  if (!userId) return;
  let state = presence.get(userId);
  if (!state) {
    state = {
      viewerCount: 0,
      timer: null,
      currentInterval: INTERVAL_PLAYING, // optimistic — first poll happens immediately
      lastTrack: null,
      lastChangeAt: Date.now(),
    };
    presence.set(userId, state);
  }
  state.viewerCount++;

  // First viewer: kick off a poll right now so they don't wait for the
  // first interval. Subsequent viewers get the cached payload instead.
  if (state.viewerCount === 1) {
    pollOnce(userId).catch(() => {});
  }
}

function unsubscribe(userId) {
  if (!userId) return;
  const state = presence.get(userId);
  if (!state) return;
  state.viewerCount = Math.max(0, state.viewerCount - 1);
  if (state.viewerCount === 0) {
    if (state.timer) clearTimeout(state.timer);
    presence.delete(userId);
  }
}

function getCached(userId) {
  return presence.get(userId)?.lastTrack || null;
}

module.exports = { init, subscribe, unsubscribe, getCached };
