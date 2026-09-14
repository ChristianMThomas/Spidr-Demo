const express = require('express');
const authMiddleware = require('../middleware/auth');
const VoiceSession = require('../models/VoiceSession');
const DJSession = require('../models/DJSession');
const Server = require('../models/Server');

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

// Owner of the presence row, or a moderator of the server the row sits in
// (voice kicks legitimately remove somebody else's session).
async function canMutateSession(req, session) {
  const uid = req.user?.id?.toString();
  if (session.user_id?.toString() === uid) return true;
  const sid = session.server_id;
  // 'group' / 'dm' are overloaded literals, not real server ids - no mod tier.
  if (!sid || sid === 'group' || sid === 'dm') return false;
  try {
    const server = await Server.findById(sid, 'owner_id members').lean();
    if (!server) return false;
    if (server.owner_id?.toString() === uid) return true;
    return (server.members || []).some(m =>
      m.user_id?.toString() === uid &&
      ['admin', 'mod', 'moderator', 'owner'].includes(String(m.role || '').toLowerCase()));
  } catch {
    return false;
  }
}

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_name, user_avatar, server_id, channel_id, group_id,
            conversation_id, is_muted, is_deafened, is_video_on,
            is_screen_sharing, is_spidr_ai, stream_url, stream_type } = req.body;
    const doc = await VoiceSession.create({
      // Forced server-side: the body used to carry an arbitrary user_id, so a
      // caller could plant a presence row under someone else's identity.
      user_id: req.user.id,
      user_name, user_avatar, server_id, channel_id, group_id,
      conversation_id, is_muted, is_deafened, is_video_on,
      is_screen_sharing, is_spidr_ai, stream_url, stream_type,
    });
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
    // Was unchecked: anyone could mute/deafen or rewrite anyone's stream state.
    if (!(await canMutateSession(req, existing))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
    // Was unchecked: anyone could evict anyone from voice presence (and
    // trigger the DJ host-handoff below as a side effect).
    if (!(await canMutateSession(req, existing))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await VoiceSession.findByIdAndDelete(req.params.id);
    emitSessionChanged(req, existing);

    // If the leaver was hosting a DJ session in this channel, end it.
    // Listeners can't enjoy a session whose host's Spotify they can no longer poll.
    if (existing.channel_id && existing.user_id) {
      const dj = await DJSession.findOne({ channel_id: existing.channel_id, host_id: existing.user_id });
      if (dj) {
        await DJSession.deleteOne({ _id: dj._id });
        const io = req.app.get('io');
        if (io) {
          io.emit('voice:dj-session-changed', { channel_id: existing.channel_id, session: null });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
