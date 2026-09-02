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

// Self-removal — the caller pulls themselves off the group. Members can't
// achieve this through PATCH because MEMBER_WRITABLE deliberately excludes
// `members`/`member_ids` (widening it would let any member kick anyone).
// If the caller is the last member, the group is deleted so it doesn't linger
// empty. Owner leaving with others still present is allowed to match the
// web client's existing behavior; the group is then effectively ownerless
// (a known design gap that predates this route).
router.post('/:id/leave', authMW, async (req, res, next) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const group = await GroupChat.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ error: 'Not found' });
    const isMember =
      (group.members || []).some(m => m.user_id === uid) ||
      (group.member_ids || []).includes(uid);
    if (!isMember) return res.status(404).json({ error: 'Not a member' });

    const remainingMembers = (group.members || []).filter(m => m.user_id !== uid);
    if (remainingMembers.length === 0) {
      await GroupChat.deleteOne({ _id: req.params.id });
      return res.json({ left: true, deleted: true });
    }

    const doc = await GroupChat.findByIdAndUpdate(
      req.params.id,
      { $pull: { members: { user_id: uid }, member_ids: uid } },
      { new: true },
    ).lean();
    return res.json({ left: true, deleted: false, ...doc, id: doc._id.toString() });
  } catch (err) { next(err); }
});

// Everything else (list, get, create, delete) inherits standard behavior.
router.use(crudRouter(GroupChat, { ownerField: 'owner_id' }));

module.exports = router;
