/**
 * crudRouter(Model)
 * Generates a standard REST router for a Mongoose model.
 * Supports: GET / (list + filter), GET /:id, POST /, PATCH /:id, DELETE /:id
 */
const express   = require('express');
const authMiddleware = require('../middleware/auth');

module.exports = function crudRouter(Model, opts = {}) {
  const router = express.Router();
  const { protect = true, ownerField = null } = opts;

  // Returns true if the authenticated user owns the document.
  // ownerField can be a string or array of strings (checked with OR).
  function isOwner(doc, userId) {
    if (!ownerField) return true;
    const fields = Array.isArray(ownerField) ? ownerField : [ownerField];
    return fields.some(f => doc[f]?.toString() === userId?.toString());
  }

  const guard = protect ? authMiddleware : (req, res, next) => next();

  // ── LIST / FILTER ──────────────────────────────────────────────────────────
  router.get('/', guard, async (req, res) => {
    try {
      const { _orderBy, _limit, ...filters } = req.query;

      // Build query — support simple equality filters.
      // Strip keys starting with $ to block MongoDB operator injection.
      const query = {};
      for (const [k, v] of Object.entries(filters)) {
        if (k.startsWith('$')) continue; // reject operator keys
        // Allow comma-separated $in queries
        if (typeof v === 'string' && v.includes(',')) {
          query[k] = { $in: v.split(',') };
        } else if (typeof v === 'object' && v !== null) {
          continue; // reject nested objects (potential operator injection)
        } else {
          query[k] = v;
        }
      }

      let q = Model.find(query);

      if (_orderBy) {
        const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
        // Only allow simple alphanumeric field names with dots (e.g. "created_date", "meta.score")
        if (/^[a-zA-Z0-9_.]+$/.test(field)) {
          const dir = _orderBy.startsWith('-') ? -1 : 1;
          q = q.sort({ [field]: dir });
        }
      }

      if (_limit) {
        const cap = Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200);
        q = q.limit(cap);
      }

      const docs = await q.lean();
      res.json(docs.map(normalise));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET ONE ────────────────────────────────────────────────────────────────
  router.get('/:id', guard, async (req, res) => {
    try {
      const doc = await Model.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(normalise(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────
  router.post('/', guard, async (req, res) => {
    try {
      const data = req.body;
      if (ownerField) data[ownerField] = req.user?.id;
      const doc = await Model.create(data);
      res.status(201).json(normalise(doc.toObject()));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  // Strip sensitive/protected fields and MongoDB operator keys from the update body.
  const PROTECTED_FIELDS = new Set(['password', 'is_banned', 'role', 'is_verified', 'is_admin', 'twoFactorSecret', 'twoFactorMethod']);

  router.patch('/:id', guard, async (req, res) => {
    try {
      const existing = await Model.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!isOwner(existing, req.user?.id)) return res.status(403).json({ error: 'Forbidden' });

      const safeBody = {};
      for (const [k, v] of Object.entries(req.body)) {
        if (k.startsWith('$') || PROTECTED_FIELDS.has(k)) continue;
        safeBody[k] = v;
      }
      const doc = await Model.findByIdAndUpdate(
        req.params.id,
        { $set: safeBody },
        { new: true, runValidators: true }
      ).lean();
      res.json(normalise(doc));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────
  router.delete('/:id', guard, async (req, res) => {
    try {
      const existing = await Model.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (!isOwner(existing, req.user?.id)) return res.status(403).json({ error: 'Forbidden' });

      await Model.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// Map Mongo _id → id to match base44 response shape
function normalise(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}
