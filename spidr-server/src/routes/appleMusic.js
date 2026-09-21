const express = require('express');
const path = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const rateLimit = require('express-rate-limit');
const authMW = require('../middleware/auth');
const Connection = require('../models/AppleMusicConnection');
const Link = require('../models/AppleMusicLink');
const User = require('../models/User');
const service = require('../utils/appleMusicService');
const router = express.Router();
const hash = value => createHash('sha256').update(value).digest('hex');
const handle = fn => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not update Apple Music connection.', code: error.code || 'connection_error' }); }
};
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Electron blocks remote auth windows. Use a single-use browser handoff,
// never the user's Spidr session JWT.
router.get('/connect', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'none'; script-src 'self' https://js-cdn.music.apple.com; style-src 'self'; connect-src 'self' https://*.apple.com https://*.itunes.apple.com; img-src 'self' data: https://*.mzstatic.com; frame-src https://*.apple.com https://*.itunes.apple.com; media-src blob: https:; worker-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.set('Referrer-Policy', 'no-referrer');
  res.sendFile(path.join(__dirname, '../public/apple-music-connect.html'));
});
router.get('/connect.js', (req, res) => res.sendFile(path.join(__dirname, '../public/apple-music-connect.js')));
router.get('/connect.css', (req, res) => res.sendFile(path.join(__dirname, '../public/apple-music-connect.css')));

const browserLimit = rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false });
const linkAuth = handle(async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw service.failure(403, 'Reopen Apple Music connection from Spidr.', 'invalid_link');
  const link = await Link.findOne({ token_hash: hash(token), expires_at: { $gt: new Date() } }).lean();
  if (!link) throw service.failure(403, 'This connection link expired. Reopen it from Spidr.', 'invalid_link');
  req.appleLink = link;
  next();
});
router.post('/auth/link', authMW, handle(async (req, res) => {
  service.developerToken();
  const token = randomBytes(32).toString('hex');
  const url = new URL('/apple-music/connect', process.env.SERVER_URL || 'http://localhost:4000');
  if (!['http:', 'https:'].includes(url.protocol)) throw service.failure(503, 'Apple Music browser URL is not configured.', 'invalid_configuration');
  await Link.deleteMany({ user_id: req.user.id });
  await Link.create({ user_id: req.user.id, token_hash: hash(token), expires_at: new Date(Date.now() + 300000) });
  url.hash = token;
  res.json({ url: url.href });
}));
router.post('/auth/session', browserLimit, linkAuth, handle(async (req, res) => {
  res.json({ configured: true, ...service.developerToken() });
}));
router.post('/auth/complete', browserLimit, linkAuth, handle(async (req, res) => {
  const token = req.body?.music_user_token;
  const storefront = await service.validateUserToken(token);
  const claimed = await Link.findOneAndDelete({ _id: req.appleLink._id, expires_at: { $gt: new Date() } });
  if (!claimed) throw service.failure(403, 'This connection link has already been used.', 'invalid_link');
  if (!await User.exists({ _id: claimed.user_id, is_banned: { $ne: true } })) throw service.failure(403, 'This Spidr account is no longer available.', 'invalid_link');
  await service.saveConnection(req.appleLink.user_id, token, storefront);
  res.json({ connected: true, storefront });
}));
router.get('/status', authMW, handle(async (req, res) => {
  const connection = await Connection.findOne({ user_id: req.user.id }).lean();
  res.json({ ...service.configuration(), user_id: req.user.id, connected: !!connection, storefront: connection?.storefront || null, connected_at: connection?.connected_at || null });
}));
router.get('/dev-token', authMW, handle(async (req, res) => {
  const config = service.configuration();
  if (!config.configured) return res.status(503).json(config);
  res.json({ configured: true, ...service.developerToken() });
}));
router.post('/user-token', authMW, handle(async (req, res) => {
  const token = req.body?.music_user_token;
  const storefront = await service.validateUserToken(token);
  await service.saveConnection(req.user.id, token, storefront);
  res.json({ connected: true, storefront });
}));
router.get('/search', authMW, handle(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 300) : '';
  if (!q) return res.json({ tracks: [] });
  const connection = await Connection.findOne({ user_id: req.user.id }).lean();
  const storefront = connection?.storefront || process.env.APPLE_MUSIC_STOREFRONT || 'us';
  if (!/^[a-z]{2}$/i.test(storefront)) throw service.failure(503, 'Apple Music storefront is not configured correctly.', 'invalid_configuration');
  const params = new URLSearchParams({ types: 'songs', limit: String(Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 25)), term: q });
  const data = await service.appleRequest(`/catalog/${storefront}/search?${params}`);
  res.json({ tracks: (data?.results?.songs?.data || []).map(song => service.trackShape(song, storefront)) });
}));
router.get('/recently-played', authMW, handle(async (req, res) => {
  const connection = await Connection.findOne({ user_id: req.user.id }).select('+user_token').lean();
  if (!connection) return res.json({ connected: false, track: null });
  try {
    const data = await service.appleRequest('/me/recent/played/tracks?limit=1', connection.user_token);
    res.json({ connected: true, track: data?.data?.[0] ? service.trackShape(data.data[0], connection.storefront) : null });
  } catch (error) {
    if (error.code === 'reconnect_required') await service.disconnect(req.user.id, connection.user_token);
    throw error;
  }
}));
router.delete('/disconnect', authMW, handle(async (req, res) => {
  await Link.deleteMany({ user_id: req.user.id });
  await service.disconnect(req.user.id);
  res.json({ connected: false });
}));
module.exports = router;
