const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const { filterOrphans } = require('../utils/filterExistingUsers');

const router = express.Router();

// A DM has three participant fields: sender_id, receiver_id (required) and
// recipient_id (an alias some frontend code writes instead). Any of them
// matching the caller makes them a participant, so all three must be checked
// or a legitimate reader gets a spurious 404.
const PARTICIPANT_FIELDS = ['sender_id', 'receiver_id', 'recipient_id'];

function isParticipant(doc, userId) {
  const uid = userId?.toString();
  return PARTICIPANT_FIELDS.some(f => doc[f]?.toString() === uid);
}

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
    // Force participant scoping. Without this, GET /direct-messages with no
    // filters returned up to 200 arbitrary users' private DMs to any
    // authenticated caller (GAPS.md #1). Applied AFTER the client filters are
    // built so no supplied filter can widen it back out.
    const uid = req.user?.id?.toString();
    query.$or = PARTICIPANT_FIELDS.map(f => ({ [f]: uid }));

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

// GET /:id — participant-scoped. Must be declared BEFORE the crudRouter
// mount below, whose bare findById would otherwise hand any DM to anyone who
// can guess an ObjectId. Recipients need reads, so this checks participancy
// rather than the stricter sender-only ownership used for writes.
router.get('/:id', authMW, async (req, res) => {
  try {
    const doc = await DirectMessage.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    // 404 rather than 403 — a DM's existence is itself private.
    if (!isParticipant(doc, req.user?.id)) return res.status(404).json({ error: 'Not found' });
    const { _id, __v, ...rest } = doc;
    res.json({ id: _id?.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Standard CRUD — sender owns their messages (writes stay sender-only).
router.use('/', crudRouter(DirectMessage, { ownerField: 'sender_id' }));

module.exports = router;
