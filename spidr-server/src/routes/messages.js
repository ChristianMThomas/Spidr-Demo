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

// All other methods (GET /:id, POST /, PATCH /:id, DELETE /:id) via crudRouter
router.use(base);

module.exports = router;
