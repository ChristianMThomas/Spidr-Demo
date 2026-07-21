const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const { filterOrphans } = require('../utils/filterExistingUsers');

const router = express.Router();

// GET / — same query surface as crudRouter, but drops rows whose OTHER
// participant is a deleted User. The current caller is always sender_id
// or recipient_id and exists, so this effectively hides DMs with ghost
// accounts from Jump Back In and every other DM list.
router.get('/', authMW, async (req, res) => {
  try {
    const { _orderBy, _limit, ...filters } = req.query;
    const query = {};
    for (const [k, v] of Object.entries(filters)) {
      if (k.startsWith('$')) continue;
      if (typeof v === 'string' && v.includes(',')) query[k] = { $in: v.split(',') };
      else if (typeof v === 'object' && v !== null) continue;
      else query[k] = v;
    }
    let q = DirectMessage.find(query);
    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field)) {
        q = q.sort({ [field]: _orderBy.startsWith('-') ? -1 : 1 });
      }
    }
    if (_limit) {
      const cap = Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200);
      q = q.limit(cap);
    }
    const docs = await q.lean();
    const filtered = await filterOrphans(docs, ['sender_id', 'recipient_id']);
    res.json(filtered.map(({ _id, __v, ...rest }) => ({ id: _id?.toString(), ...rest })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
