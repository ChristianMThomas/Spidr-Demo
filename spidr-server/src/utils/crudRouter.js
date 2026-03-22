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

  const guard = protect ? authMiddleware : (req, res, next) => next();

  // ── LIST / FILTER ──────────────────────────────────────────────────────────
  router.get('/', guard, async (req, res) => {
    try {
      const { _orderBy, _limit, ...filters } = req.query;

      // Build query — support simple equality filters
      const query = {};
      for (const [k, v] of Object.entries(filters)) {
        // Allow comma-separated $in queries
        if (typeof v === 'string' && v.includes(',')) {
          query[k] = { $in: v.split(',') };
        } else {
          query[k] = v;
        }
      }

      let q = Model.find(query);

      if (_orderBy) {
        const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
        const dir   = _orderBy.startsWith('-') ? -1 : 1;
        q = q.sort({ [field]: dir });
      }

      if (_limit) q = q.limit(parseInt(_limit, 10));

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
  router.patch('/:id', guard, async (req, res) => {
    try {
      const doc = await Model.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(normalise(doc));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── DELETE ─────────────────────────────────────────────────────────────────
  router.delete('/:id', guard, async (req, res) => {
    try {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
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
