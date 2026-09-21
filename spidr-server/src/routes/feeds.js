const express = require('express');
const auth = require('../middleware/auth');
const Feed = require('../models/Feed');
const Comment = require('../models/FeedComment');
const privacy = require('../utils/activityPrivacy');
const toggleReaction = require('../utils/activityReactions');
const router = express.Router();
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not load activity' }); }
};
router.use(auth, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const filter = {};
  const allowed = ['user_id', 'type', 'server_id', 'channel_id', 'target_id', 'is_pinned', 'is_hidden'];
  for (const name of allowed) {
    const value = req.query[name];
    if (typeof value !== 'string') continue;
    filter[name] = name.startsWith('is_') ? value === 'true' : value.includes(',') ? { $in: value.split(',') } : value;
  }
  if (req.query._before) {
    const before = privacy.id(req.query._before);
    if (!before) return res.status(400).json({ error: 'Invalid page' });
    filter._id = { $lt: before };
  }
  const cap = Math.min(Math.max(parseInt(req.query._limit, 10) || 30, 1), 200);
  const sortName = String(req.query._orderBy || '-created_date');
  const field = sortName.replace(/^-/, '');
  const sort = ['_id', 'created_date', 'is_pinned'].includes(field) ? { [field]: sortName.startsWith('-') ? -1 : 1, ...(field !== '_id' ? { _id: -1 } : {}) } : { _id: -1 };
  // Authorization is applied before pagination, including hidden/targeted rows.
  const rows = await Feed.aggregate([{ $match: filter }, ...privacy.feedStages(context), { $sort: sort }, { $limit: cap }]);
  res.json(await privacy.withVisibleCounts(rows, context));
}));
router.get('/:id', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const feed = await privacy.visibleFeed(req.params.id, context);
  if (!feed) return res.status(404).json({ error: 'Activity not found' });
  res.json((await privacy.withVisibleCounts([feed], context))[0]);
}));
router.post('/', handle(async (req, res) => {
  const data = {};
  for (const key of ['title', 'content', 'image_url', 'media_url', 'media_type', 'server_id', 'channel_id', 'target_id', 'type', 'tags', 'recipient_ids']) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  if (req.body.is_hidden !== undefined && typeof req.body.is_hidden !== 'boolean') return res.status(400).json({ error: 'is_hidden must be a boolean' });
  const doc = await Feed.create({ ...data, user_id: String(req.user.id), user_name: req.user.full_name || req.user.username, user_avatar: req.user.avatar_url || '', is_hidden: req.body.is_hidden === true });
  res.status(201).json(privacy.normalise(doc.toObject()));
}));
router.patch('/:id', handle(async (req, res) => {
  const objectId = privacy.id(req.params.id);
  const doc = objectId && await Feed.findById(objectId).lean();
  if (!doc) return res.status(404).json({ error: 'Activity not found' });
  if (doc.user_id !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  if (req.body.is_hidden !== undefined && typeof req.body.is_hidden !== 'boolean') return res.status(400).json({ error: 'is_hidden must be a boolean' });
  const updates = {};
  for (const key of ['title', 'content', 'is_hidden']) if (req.body[key] !== undefined) updates[key] = req.body[key];
  const updated = await Feed.findByIdAndUpdate(objectId, { $set: updates }, { new: true, runValidators: true }).lean();
  res.json((await privacy.withVisibleCounts([updated], await privacy.viewerContext(req.user.id)))[0]);
}));
router.post('/:id/react', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const feed = await privacy.visibleFeed(req.params.id, context);
  if (!feed) return res.status(404).json({ error: 'Activity not found' });
  const updated = await toggleReaction(Feed, feed._id, context.uid, req.body?.emoji);
  res.json((await privacy.withVisibleCounts([updated], context))[0]);
}));
router.delete('/:id', handle(async (req, res) => {
  const objectId = privacy.id(req.params.id);
  const doc = objectId && await Feed.findById(objectId).lean();
  if (!doc) return res.status(404).json({ error: 'Activity not found' });
  if (doc.user_id !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  await Feed.findByIdAndDelete(objectId);
  await Comment.deleteMany({ feed_id: String(objectId) });
  res.json({ success: true });
}));
module.exports = router;
