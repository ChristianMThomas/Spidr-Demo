const express       = require('express');
  const crudRouter    = require('../utils/crudRouter');
  const authMW        = require('../middleware/auth');
  const DirectMessage = require('../models/DirectMessage');

  const router = express.Router();

  // Bulk mark-read for a conversation. Single write beats N per-message PATCHes
  // from the client (which had race conditions with cache hydration and with
  // is_read boolean coercion through URL query params). The receiver_id filter
  // scopes the update to the caller's own incoming messages.
  router.post('/mark-conversation-read', authMW, async (req, res) => {
    try {
      const uid = req.user._id ? req.user._id.toString() : req.user.id;
      const { conversation_id } = req.body || {};
      if (!conversation_id || typeof conversation_id !== 'string') {
        return res.status(400).json({ error: 'conversation_id required' });
      }
      const result = await DirectMessage.updateMany(
        { conversation_id, receiver_id: uid, is_read: false },
        { $set: { is_read: true } },
      );
      res.json({ marked: result.modifiedCount || 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Standard CRUD fallthrough — sender owns their messages (blocks cross-account
  // PATCH/DELETE of other users' DMs).
  router.use('/', crudRouter(DirectMessage, { ownerField: 'sender_id' }));

  module.exports = router;