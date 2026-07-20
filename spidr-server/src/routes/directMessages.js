const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');

const router = express.Router();

// ── POST /direct-messages/read-conversation ─────────────────────────────────
// { conversation_id } — the RECIPIENT marks everything addressed to them in
// that thread as read, in one bulk write. This replaces the old client loop
// of per-message PATCHes, which the ownership lockdown correctly rejected
// (the recipient isn't the sender_id owner) — the root cause of DM unread
// badges never clearing.
router.post('/read-conversation', authMW, async (req, res) => {
  try {
    const conversation_id = (req.body?.conversation_id || '').toString();
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
    const r = await DirectMessage.updateMany(
      { conversation_id, recipient_id: req.user.id, is_read: false },
      { $set: { is_read: true } }
    );
    res.json({ ok: true, marked: r.modifiedCount || 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Standard CRUD — sender owns their messages.
router.use('/', crudRouter(DirectMessage, { ownerField: 'sender_id' }));

module.exports = router;
