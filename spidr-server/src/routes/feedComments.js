const express = require('express');
const crudRouter = require('../utils/crudRouter');
const FeedComment = require('../models/FeedComment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * Custom react-toggle endpoint for comments — mirrors the message-level
 * reactions feature. Body: { emoji }. Toggles the current user's id in
 * the reactions[emoji] array.
 */
router.post('/:id/react', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'emoji is required' });
    }
    const comment = await FeedComment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Map → plain object so we can mutate the JSON, then write back
    const reactions = comment.reactions instanceof Map
      ? Object.fromEntries(comment.reactions)
      : (comment.reactions || {});
    const users = reactions[emoji] || [];
    const uid = req.user.id?.toString();
    const idx = users.indexOf(uid);
    if (idx >= 0) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
    } else {
      reactions[emoji] = [...users, uid];
    }
    comment.reactions = reactions;
    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authorship guard for edits/deletes — only the comment author can mutate.
router.use('/', crudRouter(FeedComment, { ownerField: 'author_id' }));

module.exports = router;
