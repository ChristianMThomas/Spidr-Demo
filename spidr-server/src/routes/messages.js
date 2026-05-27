const express        = require('express');
const Message        = require('../models/Message');
const Server         = require('../models/Server');
const authMiddleware = require('../middleware/auth');
const crudRouter     = require('../utils/crudRouter');

const router = express.Router();
const base   = crudRouter(Message, { ownerField: ['user_id', 'author_id'] });

// GET / — membership-guarded list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { server_id, channel_id, _orderBy, _limit, ...rest } = req.query;

    if (server_id) {
      const server = await Server.findById(server_id).lean();
      if (!server) return res.status(404).json({ error: 'Server not found' });
      const uid = req.user?.id?.toString();
      const isMember =
        server.owner_id?.toString() === uid ||
        (server.members || []).some(m => m.user_id?.toString() === uid);
      if (!isMember) return res.status(403).json({ error: 'Not a member of this server' });
    }

    const query = {};
    if (server_id)  query.server_id  = server_id;
    if (channel_id) query.channel_id = channel_id;
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith('$') || typeof v === 'object') continue;
      query[k] = v;
    }

    let q = Message.find(query);
    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field))
        q = q.sort({ [field]: _orderBy.startsWith('-') ? -1 : 1 });
    }
    const cap = Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200);
    q = q.limit(cap);

    const docs = await q.lean();
    res.json(docs.map(({ _id, __v, ...d }) => ({ id: _id.toString(), ...d })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /search — full-text search within a server (optionally a channel).
// Query: ?server_id=...&q=...[&channel_id=...][&_limit=...]
// Uses MongoDB's $text index for optimized querying; falls back to a safe,
// escaped regex when the query is a single short token (so partial-word
// searches like "hel" still match "hello", which $text alone won't do).
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { server_id, channel_id, q, _limit } = req.query;
    const term = (q || '').trim();
    if (!server_id) return res.status(400).json({ error: 'server_id is required' });
    if (!term) return res.json([]); // empty query → empty results (handled by UI)

    // Membership guard — same as the list route.
    const server = await Server.findById(server_id).lean();
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const uid = req.user?.id?.toString();
    const isMember =
      server.owner_id?.toString() === uid ||
      (server.members || []).some(m => m.user_id?.toString() === uid);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this server' });

    const cap = Math.min(Math.max(parseInt(_limit, 10) || 40, 1), 100);
    const scope = { server_id };
    if (channel_id) scope.channel_id = channel_id;

    // Primary: $text search (fast, index-backed, relevance-sorted).
    let docs = await Message.find(
      { ...scope, $text: { $search: term } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(cap)
      .lean();

    // Fallback: $text matches whole words only. For short/partial queries that
    // returned nothing, do an escaped, anchored regex (case-insensitive).
    if (docs.length === 0) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      docs = await Message.find({ ...scope, content: { $regex: escaped, $options: 'i' } })
        .sort({ created_date: -1 })
        .limit(cap)
        .lean();
    }

    res.json(docs.map(({ _id, __v, score, ...d }) => ({ id: _id.toString(), ...d })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All other methods (GET /:id, POST /, PATCH /:id, DELETE /:id) via crudRouter
router.use(base);

module.exports = router;
