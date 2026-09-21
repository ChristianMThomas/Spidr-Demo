/**
 * spotifySync.js — driving a listener's own Spotify player from an Apple
 * Music DJ session ("Listen Along").
 *
 * The problem this solves
 * ──────────────────────
 * The DJ booth is Apple Music only. Apple subscribers in the room play the
 * master locally through MusicKit, synced to the session clock. Everyone on
 * Spotify would otherwise be locked out — so instead of streaming them audio
 * (which we cannot legally do and could not afford to), we command each
 * listener's OWN Spotify client to play the SAME master recording at the SAME
 * position. Nobody's audio is rebroadcast; each account plays for itself.
 *
 * Why ISRC and not a title search
 * ───────────────────────────────
 * Searching Spotify for "title artist" finds *a* recording, not *the*
 * recording — it lands on remasters, live cuts, radio edits and re-records
 * constantly, and the room ends up hearing different lengths of a song they
 * believe is identical, which desynchronises everything downstream. The ISRC
 * identifies one master recording globally. Apple gives it to us on the
 * catalog song; Spotify indexes it as `isrc:` in search. That is the join key.
 *
 * Hard requirements Spotify puts on this, all of which are surfaced rather
 * than swallowed:
 *   • Premium. `PUT /v1/me/player/play` is 403 for free accounts, always.
 *   • Scopes. user-modify-playback-state to control the player, and
 *     user-read-private to read the Premium flag at all.
 *   • An active device. Playback commands go to a device, and a user with no
 *     Spotify client open anywhere has none — 404 NO_ACTIVE_DEVICE. We look
 *     for a device to wake rather than reporting a generic failure.
 *
 * Every function here returns or throws a SyncError carrying a stable `code`,
 * so the UI can say the true thing ("open Spotify on a device") instead of
 * "something went wrong".
 */

const UserProfile = require('../models/UserProfile');

const API = 'https://api.spotify.com/v1';
const TIMEOUT_MS = 10_000;

// Scopes this feature needs on top of the read-only set the app originally
// requested. A token minted before this shipped simply does not carry them,
// and Spotify's answer to that is an opaque 403 — so we record what was
// granted at callback time and check it up front instead.
const REQUIRED_SCOPES = ['user-modify-playback-state', 'user-read-private'];

class SyncError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status = 400) => { throw new SyncError(code, message, status); };

async function call(token, path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    fail('upstream_unavailable', 'Spotify is not responding. Try again in a moment.', 503);
  }
  // 204 is the success answer for most player commands.
  if (response.status === 204) return null;
  let data = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (response.ok) return data;

  const reason = data?.error?.reason;
  if (response.status === 401) fail('token_expired', 'Spotify authorization expired.', 401);
  if (reason === 'NO_ACTIVE_DEVICE') fail('no_active_device', 'Open Spotify on a device to listen along.', 409);
  if (reason === 'PREMIUM_REQUIRED' || response.status === 403) {
    fail('premium_required', 'Spotify Premium is required to listen along.', 403);
  }
  if (response.status === 404) fail('no_active_device', 'Open Spotify on a device to listen along.', 409);
  if (response.status === 429) fail('rate_limited', 'Spotify is rate-limiting this account. Try again shortly.', 429);
  fail('upstream_error', data?.error?.message || 'Spotify could not complete this request.', 502);
}

/**
 * Premium + scope check. Returns { allowed, reason, code, product } rather
 * than throwing, because "this user cannot join" is an ordinary answer the
 * card has to render, not an exception.
 */
async function checkSpotifyPremium(token) {
  let profile;
  try {
    profile = await call(token, '/me');
  } catch (error) {
    // A token minted before user-read-private was requested cannot read the
    // product field, which looks identical to a revoked token from here.
    if (error.code === 'token_expired' || error.code === 'premium_required') {
      return { allowed: false, code: 'reconnect_required', reason: 'Reconnect Spotify to enable Listen Along.' };
    }
    throw error;
  }
  if (!profile?.product) {
    return { allowed: false, code: 'reconnect_required', reason: 'Reconnect Spotify to enable Listen Along.' };
  }
  if (profile.product !== 'premium') {
    return {
      allowed: false,
      code: 'premium_required',
      reason: 'Spotify Premium is required to join Listen Along parties.',
      product: profile.product,
    };
  }
  return { allowed: true, product: profile.product, user: { id: profile.id, name: profile.display_name } };
}

/** Resolves an Apple Music ISRC to a Spotify track. Null when unmatched. */
async function resolveIsrc(token, isrc) {
  if (!isrc || !/^[A-Za-z0-9]{12}$/.test(isrc)) return null;
  const params = new URLSearchParams({ q: `isrc:${isrc}`, type: 'track', limit: '1' });
  const data = await call(token, `/search?${params}`);
  return data?.tracks?.items?.[0] || null;
}

/**
 * Finds a device to play on. Spotify will not start playback "nowhere": if
 * nothing is active we pick the most plausible idle device and address the
 * command to it explicitly, which is what wakes a phone or desktop app that
 * is open but idle. Only when the account has no devices at all is there
 * genuinely nothing we can do but tell the user.
 */
async function pickDevice(token) {
  const data = await call(token, '/me/player/devices');
  const devices = data?.devices || [];
  if (!devices.length) return null;
  const active = devices.find(d => d.is_active && !d.is_restricted);
  if (active) return active;
  // Restricted devices (some cars, some TVs) accept no Web API commands.
  const usable = devices.filter(d => !d.is_restricted);
  if (!usable.length) return null;
  // Prefer a computer or smartphone over a speaker — the speaker is more
  // often the one that is powered off.
  return usable.find(d => d.type === 'Computer')
    || usable.find(d => d.type === 'Smartphone')
    || usable[0];
}

/**
 * Starts `uri` at `positionMs` on the listener's player.
 * Throws SyncError('no_active_device') when the account has nothing to play on.
 */
async function playAt(token, uri, positionMs) {
  const device = await pickDevice(token);
  if (!device) fail('no_active_device', 'Open Spotify on a device to listen along.', 409);
  const query = device.is_active ? '' : `?device_id=${encodeURIComponent(device.id)}`;
  await call(token, `/me/player/play${query}`, {
    method: 'PUT',
    body: { uris: [uri], position_ms: Math.max(0, Math.round(positionMs) || 0) },
  });
  return device;
}

// ── Token access ────────────────────────────────────────────────────────────
// Listen Along runs server-side (a track change re-syncs every party member at
// once), so the sync path needs its own refresh-aware token accessor rather
// than borrowing the one inlined in the /now-playing route handler.

async function refreshAccessToken(userId, refreshTok) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) fail('not_configured', 'Spotify is not configured on this server.', 503);
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  let response;
  try {
    response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    fail('upstream_unavailable', 'Spotify is not responding. Try again in a moment.', 503);
  }
  const data = await response.json().catch(() => ({}));
  if (!data.access_token) fail('reconnect_required', 'Reconnect Spotify to continue.', 401);
  await UserProfile.updateOne({ user_id: userId }, {
    $set: {
      'neural_links.spotify_access_token': data.access_token,
      'neural_links.spotify_token_expires': Date.now() + (data.expires_in || 3600) * 1000,
      ...(data.refresh_token ? { 'neural_links.spotify_refresh_token': data.refresh_token } : {}),
      // Spotify echoes the scopes actually granted. Recording them on every
      // refresh means a user who reconnects gets picked up automatically
      // rather than staying flagged as stale.
      ...(data.scope ? { 'neural_links.spotify_scopes': data.scope } : {}),
    },
  });
  return data.access_token;
}

/**
 * Returns { token, scopesOk } for a user, refreshing when close to expiry.
 * Throws SyncError('not_connected') when there is nothing stored.
 */
async function accessTokenFor(userId) {
  const profile = await UserProfile.findOne({ user_id: userId }).lean();
  const links = profile?.neural_links || {};
  if (!links.spotify_connected || !links.spotify_access_token) {
    fail('not_connected', 'Connect Spotify to listen along.', 409);
  }
  const granted = String(links.spotify_scopes || '').split(/\s+/).filter(Boolean);
  // No recorded scopes at all means the grant predates scope tracking — which
  // also means it predates the write scope, so it needs reconnecting.
  const scopesOk = REQUIRED_SCOPES.every(s => granted.includes(s));

  let token = links.spotify_access_token;
  if (Date.now() > (links.spotify_token_expires || 0) - 60_000) {
    token = await refreshAccessToken(userId, links.spotify_refresh_token);
  }
  return { token, scopesOk, refreshToken: links.spotify_refresh_token };
}

/** Runs `fn(token)`, refreshing once and retrying if Spotify rejects the token. */
async function withToken(userId, fn) {
  const { token, scopesOk, refreshToken: refTok } = await accessTokenFor(userId);
  if (!scopesOk) {
    fail('reconnect_required', 'Reconnect Spotify to grant playback control for Listen Along.', 409);
  }
  try {
    return await fn(token);
  } catch (error) {
    if (error.code !== 'token_expired' || !refTok) throw error;
    return fn(await refreshAccessToken(userId, refTok));
  }
}

/**
 * The whole join/re-sync path for one listener: verify Premium, resolve the
 * DJ's ISRC into this account's catalog, and start it at the right position.
 */
async function syncListenerToTrack(userId, { isrc, positionMs }) {
  if (!isrc) fail('no_isrc', 'This track has no ISRC, so it cannot be matched on Spotify.', 409);
  return withToken(userId, async (token) => {
    const premium = await checkSpotifyPremium(token);
    if (!premium.allowed) fail(premium.code, premium.reason, premium.code === 'premium_required' ? 403 : 409);
    const track = await resolveIsrc(token, isrc);
    if (!track) fail('not_in_catalog', 'This recording is not on Spotify in your region.', 409);
    const device = await playAt(token, track.uri, positionMs);
    return {
      track: { id: track.id, uri: track.uri, name: track.name, artist: track.artists?.map(a => a.name).join(', ') || '' },
      device: { id: device.id, name: device.name, type: device.type },
    };
  });
}

/** Stops playback for a listener leaving the party. Best-effort by design. */
async function pauseListener(userId) {
  try {
    await withToken(userId, token => call(token, '/me/player/pause', { method: 'PUT' }));
    return true;
  } catch {
    // Already paused, no device, revoked token — none of these should block
    // someone from leaving a party.
    return false;
  }
}

module.exports = {
  SyncError,
  REQUIRED_SCOPES,
  checkSpotifyPremium,
  resolveIsrc,
  pickDevice,
  playAt,
  accessTokenFor,
  refreshAccessToken,
  withToken,
  syncListenerToTrack,
  pauseListener,
};
