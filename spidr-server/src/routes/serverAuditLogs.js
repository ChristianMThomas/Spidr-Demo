const express = require('express');
const authMW  = require('../middleware/auth');
const ServerAuditLog = require('../models/ServerAuditLog');

// Audit logs are append-only. Writes happen internally via
// ServerAuditLog.create() from privileged code paths (e.g., moderation
// actions in routes/servers.js); they must NEVER be created, mutated, or
// deleted through public HTTP. Only GET is exposed.
const router = express.Router();

router.get('/', authMW, async (req, res) => {
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
    let q = ServerAuditLog.find(query);
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
    res.json(docs.map(d => { const { _id, __v, ...rest } = d; return { id: _id.toString(), ...rest }; }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMW, async (req, res) => {
  try {
    const doc = await ServerAuditLog.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const { _id, __v, ...rest } = doc;
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
