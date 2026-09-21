const express = require('express');
const auth = require('../middleware/auth');
const Comment = require('../models/FeedComment');
const privacy = require('../utils/activityPrivacy');
const toggleReaction = require('../utils/activityReactions');
const router = express.Router();
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not update activity comments' }); }
};
const notFound = res => res.status(404).json({ error: 'Comment or activity not found' });
router.use(auth, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/', handle(async (req, res) => {
  if (!privacy.id(req.query.feed_id)) return res.status(400).json({ error: 'A valid feed_id is required' });
  const context = await privacy.viewerContext(req.user.id);
  if (!await privacy.visibleFeed(req.query.feed_id, context)) return notFound(res);
  const filter = { feed_id: req.query.feed_id };
  if (typeof req.query.author_id === 'string') filter.author_id = req.query.author_id;
  if (req.query.parent_comment_id) filter.parent_comment_id = req.query.parent_comment_id === 'null' ? null : req.query.parent_comment_id;
  const cap = Math.min(Math.max(parseInt(req.query._limit, 10) || 200, 1), 200);
  const direction = req.query._orderBy === '-created_date' ? -1 : 1;
  const rows = await Comment.aggregate([{ $match: filter }, ...privacy.commentStages(context), { $sort: { created_date: direction, _id: direction } }, { $limit: cap }]);
  res.json(rows.map(privacy.normalise));
}));
router.get('/:id', handle(async (req, res) => {
  const comment = await privacy.visibleComment(req.params.id, await privacy.viewerContext(req.user.id));
  if (!comment) return notFound(res);
  res.json(privacy.normalise(comment));
}));
router.post('/', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const feed = await privacy.visibleFeed(req.body?.feed_id, context);
  if (!feed) return notFound(res);
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 1000) return res.status(400).json({ error: 'Comment must be between 1 and 1000 characters' });
  let parentId = null;
  if (req.body.parent_comment_id) {
    const parent = await privacy.visibleComment(req.body.parent_comment_id, context);
    if (!parent || parent.feed_id !== String(feed._id)) return notFound(res);
    // Replies remain attached to a visible top-level comment in this feed.
    parentId = parent.parent_comment_id || String(parent._id);
  }
  const comment = await Comment.create({ feed_id: String(feed._id), parent_comment_id: parentId,
    author_id: context.uid, author_name: req.user.full_name || req.user.username || 'User',
    author_avatar: req.user.avatar_url || '', content });
  res.status(201).json(privacy.normalise(comment.toObject()));
}));
router.post('/:id/react', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const comment = await privacy.visibleComment(req.params.id, context);
  if (!comment) return notFound(res);
  res.json(privacy.normalise(await toggleReaction(Comment, comment._id, context.uid, req.body?.emoji)));
}));
router.patch('/:id', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const comment = await privacy.visibleComment(req.params.id, context);
  if (!comment) return notFound(res);
  if (comment.author_id !== context.uid) return res.status(403).json({ error: 'Forbidden' });
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content || content.length > 1000) return res.status(400).json({ error: 'Comment must be between 1 and 1000 characters' });
  const updated = await Comment.findByIdAndUpdate(comment._id, { $set: { content, edited_at: new Date() } }, { new: true, runValidators: true }).lean();
  res.json(privacy.normalise(updated));
}));
router.delete('/:id', handle(async (req, res) => {
  const context = await privacy.viewerContext(req.user.id);
  const comment = await privacy.visibleComment(req.params.id, context);
  if (!comment) return notFound(res);
  if (comment.author_id !== context.uid) return res.status(403).json({ error: 'Forbidden' });
  await Comment.findByIdAndDelete(comment._id);
  await Comment.deleteMany({ parent_comment_id: String(comment._id), feed_id: comment.feed_id });
  res.json({ success: true });
}));
module.exports = router;
