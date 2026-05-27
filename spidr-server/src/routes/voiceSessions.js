const express = require('express');
const authMiddleware = require('../middleware/auth');
const VoiceSession = require('../models/VoiceSession');

const router = express.Router();

function normalise(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}

function emitSessionChanged(req, session) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit('voice:session-changed', {
    server_id: session.server_id,
    channel_id: session.channel_id,
    group_id: session.group_id,
    conversation_id: session.conversation_id,
  });
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { _orderBy, _limit, ...filters } = req.query;
    const query = {};
    for (const [k, v] of Object.entries(filters)) {
      if (k.startsWith('$')) continue;
      if (typeof v === 'string' && v.includes(',')) {
        query[k] = { $in: v.split(',') };
      } else if (typeof v === 'object' && v !== null) {
        continue;
      } else {
        query[k] = v;
      }
    }
    let q = VoiceSession.find(query);
    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field)) {
        q = q.sort({ [field]: _orderBy.startsWith('-') ? -1 : 1 });
      }
    }
    if (_limit) {
      q = q.limit(Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200));
    }
    const docs = await q.lean();
    res.json(docs.map(normalise));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await VoiceSession.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(normalise(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const doc = await VoiceSession.create(req.body);
    const session = normalise(doc.toObject());
    emitSessionChanged(req, session);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await VoiceSession.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const safeBody = {};
    for (const [k, v] of Object.entries(req.body)) {
      if (k.startsWith('$')) continue;
      safeBody[k] = v;
    }
    const doc = await VoiceSession.findByIdAndUpdate(
      req.params.id,
      { $set: safeBody },
      { new: true, runValidators: true }
    ).lean();
    const session = normalise(doc);
    emitSessionChanged(req, session);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await VoiceSession.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await VoiceSession.findByIdAndDelete(req.params.id);
    emitSessionChanged(req, existing);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
