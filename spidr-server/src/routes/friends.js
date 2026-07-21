const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const Friend = require('../models/Friend');
const { filterOrphans } = require('../utils/filterExistingUsers');

const router = express.Router();

// GET / — same query surface as crudRouter, but drops rows whose friend_id
// points to a deleted User so ghost friends stop appearing in the UI.
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
    let q = Friend.find(query);
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
    const filtered = await filterOrphans(docs, 'friend_id');
    res.json(filtered.map(({ _id, __v, ...rest }) => ({ id: _id?.toString(), ...rest })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use('/', crudRouter(Friend, { ownerField: 'user_id' }));

module.exports = router;
