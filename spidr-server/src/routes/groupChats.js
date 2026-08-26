const express = require('express');
const authMW = require('../middleware/auth');
const crudRouter = require('../utils/crudRouter');
const GroupChat = require('../models/GroupChat');

/**
 * Group chats have shared identity: any MEMBER may change the group's
 * display name, avatar, or banner (this matches every mainstream chat app
 * and the "collaborative feel" the UI promises — Save Changes was silently
 * 403-ing for non-owners, which is why members reported the button
 * "doesn't actually work"). Everything else stays owner-only.
 */
const router = express.Router();

// Collaborative fields any member may PATCH.
const MEMBER_WRITABLE = new Set(['name', 'avatar_url', 'banner_url', 'icon_url', 'background_url']);

router.patch('/:id', authMW, async (req, res, next) => {
  try {
    const group = await GroupChat.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ error: 'Not found' });
    const isMember = (group.members || []).some(m => m.user_id === req.user?.id);
    const isOwner = group.owner_id === req.user?.id;
    const keys = Object.keys(req.body || {});
    const memberOnlyPatch = keys.length > 0 && keys.every(k => MEMBER_WRITABLE.has(k));
    // Owner path OR member editing only the collaborative fields → allow.
    if (isOwner || (isMember && memberOnlyPatch)) {
      const safe = {};
      for (const k of keys) if (MEMBER_WRITABLE.has(k) || isOwner) safe[k] = req.body[k];
      const doc = await GroupChat.findByIdAndUpdate(
        req.params.id, { $set: safe }, { new: true, runValidators: true }
      ).lean();
      return res.json({ ...doc, id: doc._id.toString() });
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) { next(err); }
});

// Everything else (list, get, create, delete) inherits standard behavior.
router.use(crudRouter(GroupChat, { ownerField: 'owner_id' }));

module.exports = router;
