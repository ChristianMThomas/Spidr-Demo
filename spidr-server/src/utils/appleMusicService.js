const fs = require('node:fs');
const { createPrivateKey } = require('node:crypto');
const jwt = require('jsonwebtoken');
const Connection = require('../models/AppleMusicConnection');
const UserProfile = require('../models/UserProfile');

let cached = { token: null, expiresAt: 0 };
function failure(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}
function credentials() {
  const team = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_MUSICKIT_KEY_ID;
  const raw = process.env.APPLE_MUSICKIT_PRIVATE_KEY;
  const file = process.env.APPLE_MUSICKIT_PRIVATE_KEY_PATH;
  if (!team || !keyId || (!raw && !file)) throw failure(503, 'Apple Music is not configured on this server.', 'not_configured');
  try {
    const key = createPrivateKey(raw ? raw.replace(/\\n/g, '\n') : fs.readFileSync(file, 'utf8'));
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Wrong key type');
    return { team, keyId, key };
  } catch {
    throw failure(503, 'Apple Music signing key is not configured correctly.', 'invalid_configuration');
  }
}
function configuration() {
  try { credentials(); return { configured: true }; }
  catch (error) { return { configured: false, code: error.code, error: error.message }; }
}
function developerToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60000) return cached;
  const { team, keyId, key } = credentials();
  const now = Math.floor(Date.now() / 1000);
  cached = {
    token: jwt.sign({ iss: team, iat: now, exp: now + 43200 }, key, { algorithm: 'ES256', keyid: keyId }),
    expiresAt: (now + 43200) * 1000,
  };
  return cached;
}
function resetDeveloperToken() { cached = { token: null, expiresAt: 0 }; }
async function appleRequest(path, userToken) {
  const { token } = developerToken();
  let response;
  try {
    response = await fetch('https://api.music.apple.com/v1' + path, {
      headers: { Authorization: 'Bearer ' + token, ...(userToken ? { 'Music-User-Token': userToken } : {}) },
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw failure(503, 'Apple Music is unavailable. Please try again.', 'upstream_unavailable'); }
  if (response.status === 401) {
    resetDeveloperToken();
    throw failure(502, 'Apple Music rejected the developer credentials.', 'developer_token_rejected');
  }
  if (response.status === 403 && userToken) throw failure(409, 'Apple Music authorization expired or was declined. Reconnect your account.', 'reconnect_required');
  if (response.status === 429) throw failure(429, 'Apple Music is busy. Please try again shortly.', 'rate_limited');
  if (!response.ok) throw failure(502, 'Apple Music could not complete this request.', 'upstream_error');
  return response.json();
}
async function validateUserToken(token) {
  if (typeof token !== 'string' || !token.trim() || token.length > 16384 || /[\r\n]/.test(token)) {
    throw failure(400, 'A valid music_user_token is required.', 'invalid_user_token');
  }
  const data = await appleRequest('/me/storefront', token);
  const storefront = data?.data?.[0]?.id;
  if (!/^[a-z]{2}$/i.test(storefront || '')) throw failure(502, 'Apple Music did not return a storefront.', 'invalid_storefront');
  return storefront.toLowerCase();
}
async function saveConnection(userId, token, storefront) {
  await Connection.updateOne({ user_id: userId }, { $set: { user_token: token, storefront, connected_at: new Date() } }, { upsert: true, runValidators: true });
  await UserProfile.updateOne({ user_id: userId }, {
    $set: { 'neural_links.apple_music_connected': true },
    $unset: { 'neural_links.apple_music_user_token': '' },
  }, { upsert: true });
}
async function disconnect(userId, expectedToken) {
  const deleted = await Connection.deleteOne({ user_id: userId, ...(expectedToken ? { user_token: expectedToken } : {}) });
  if (expectedToken && !deleted.deletedCount) return;
  await UserProfile.updateOne({ user_id: userId }, {
    $set: { 'neural_links.apple_music_connected': false },
    $unset: { 'neural_links.apple_music_user_token': '', 'neural_links.apple_music_connected_at': '' },
  });
}
function trackShape(song, storefront = 'us') {
  const a = song.attributes || {};
  return { id: song.id, name: a.name || '', artist: a.artistName || 'Unknown', album: a.albumName || '',
    album_art_url: a.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || null,
    preview_url: a.previews?.[0]?.url || null, external_url: a.url || `https://music.apple.com/${storefront}/song/${song.id}`,
    duration_ms: a.durationInMillis || 0,
    // The ISRC is what lets a Spotify Premium listener land on the exact same
    // master recording during Listen Along. Apple returns it on catalog songs;
    // when it is missing (rare — mostly library uploads) cross-service sync is
    // impossible for that track, and the UI says so rather than falling back
    // to a title match, which reliably finds the wrong recording.
    isrc: a.isrc || '',
    source: 'apple' };
}
module.exports = { failure, configuration, developerToken, resetDeveloperToken, appleRequest, validateUserToken, saveConnection, disconnect, trackShape };
