const express = require('express');
const authMW  = require('../middleware/auth');
const ServerAuditLog = require('../models/ServerAuditLog');
const Server = require('../models/Server');

// Audit logs are append-only. Writes happen internally via
// ServerAuditLog.create() from privileged code paths (e.g., moderation
// actions in routes/servers.js); they must NEVER be created, mutated, or
// deleted through public HTTP. Only GET is exposed.
const router = express.Router();

// Audit logs are moderation records. authMW alone let any authenticated user
// read any server's log by filtering ?server_id= or guessing a row id, so both
// reads now require owner/moderator standing in that specific server.
async function isServerMod(userId, serverId) {
  const uid = userId?.toString();
  if (!serverId) return false;
  try {
    const server = await Server.findById(serverId, 'owner_id members').lean();
    if (!server) return false;
    if (server.owner_id?.toString() === uid) return true;
    return (server.members || []).some(m =>
      m.user_id?.toString() === uid &&
      ['admin', 'mod', 'moderator', 'owner'].includes(String(m.role || '').toLowerCase()));
  } catch {
    return false;
  }
}

router.get('/', authMW, async (req, res) => {
  try {
    const { _orderBy, _limit, ...filters } = req.query;
    // Scope is mandatory — an unscoped list would be a platform-wide dump.
    if (!filters.server_id) return res.status(400).json({ error: 'server_id is required' });
    if (!(await isServerMod(req.user?.id, filters.server_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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
    if (!(await isServerMod(req.user?.id, doc.server_id))) {
      return res.status(404).json({ error: 'Not found' });
    }
    const { _id, __v, ...rest } = doc;
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
