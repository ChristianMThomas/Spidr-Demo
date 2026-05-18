/**
 * /feeds — activity feed read/write API.
 *
 * Key behavior: when listing feed items, returns:
 *   • All PUBLIC items (recipient_ids empty/missing), AND
 *   • All TARGETED items where the requesting user is in recipient_ids.
 *
 * This is the audience filter that makes mentions and profile updates
 * visible only to their intended audience while leaving the rest of the
 * feed (server joins, friend events, clip posts) globally visible.
 *
 * Falls back to the generic crudRouter for individual document reads,
 * updates, and reactions/likes so existing client code keeps working.
 */
const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const Feed = require('../models/Feed');

const router = express.Router();

// ── LIST with audience filter — must come BEFORE the crudRouter mount ──────
router.get('/', authMW, async (req, res) => {
  try {
    const userId = (req.user.id || req.user._id).toString();
    const { _orderBy, _limit, ...filters } = req.query;

    // Build user-supplied filters first (simple equality), same rules as crudRouter
    const userQuery = {};
    for (const [k, v] of Object.entries(filters)) {
      if (k.startsWith('$')) continue;
      if (typeof v === 'string' && v.includes(',')) {
        userQuery[k] = { $in: v.split(',') };
      } else if (typeof v === 'object' && v !== null) {
        continue;
      } else {
        userQuery[k] = v;
      }
    }

    // Audience filter: public OR targeted-at-me. Combined with user filters
    // via $and so both must hold.
    const audienceFilter = {
      $or: [
        { recipient_ids: { $exists: false } },
        { recipient_ids: { $size: 0 } },
        { recipient_ids: userId },
      ],
    };

    const query = Object.keys(userQuery).length > 0
      ? { $and: [userQuery, audienceFilter] }
      : audienceFilter;

    let q = Feed.find(query);

    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field)) {
        const dir = _orderBy.startsWith('-') ? -1 : 1;
        q = q.sort({ [field]: dir });
      }
    } else {
      // Default: newest first
      q = q.sort({ created_date: -1 });
    }

    const cap = Math.min(Math.max(parseInt(_limit, 10) || 30, 1), 200);
    q = q.limit(cap);

    const docs = await q.lean();

    // Normalize _id → id for client consistency
    const items = docs.map(d => ({ ...d, id: d._id.toString() }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All other endpoints (GET /:id, POST, PATCH, DELETE) fall through to the
// generic CRUD router. Mounting at '/' means the route order matters:
// our custom GET / above is matched first; the generic router only handles
// what we didn't intercept.
router.use('/', crudRouter(Feed));

module.exports = router;
