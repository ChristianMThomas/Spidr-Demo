/**
 * crudRouter(Model)
 * Generates a standard REST router for a Mongoose model.
 * Supports: GET / (list + filter), GET /:id, POST /, PATCH /:id, DELETE /:id
 */
const express   = require('express');
const authMiddleware = require('../middleware/auth');

module.exports = function crudRouter(Model, opts = {}) {
  const router = express.Router();
  const {
    protect = true,
    ownerField = null,
    // Fields any authenticated user (not just the owner) may patch. Designed
    // for "social interaction" fields on a resource someone else owns —
    // e.g. likes/reactions/comments_count on a Clip — without granting full
    // write access. The document owner can still patch anything (minus
    // PROTECTED_FIELDS). Leave empty/unset to lock PATCH to the owner only.
    publicWriteFields = [],
  } = opts;
  const publicWriteSet = new Set(publicWriteFields);

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
      if (err.code === 11000) {
        return res.status(409).json({ error: 'already_exists' });
      }
      res.status(400).json({ error: err.message });
    }
  });

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  // Strip sensitive/protected fields and MongoDB operator keys from the update body.
  const PROTECTED_FIELDS = new Set([
    'password', 'is_banned', 'role', 'is_verified', 'is_admin',
    'twoFactorSecret', 'twoFactorMethod',
    // streak fields are server-computed; only the /streak route may write them
    'streak_current', 'streak_best', 'streak_total_days', 'streak_last_active_date',
    // Apex tier + Stripe subscription state — only routes/webhooks/stripe.js
    // (verified signature, bypasses this crudRouter) may write these. Without
    // this, any authenticated user could PATCH themselves to apex_tier:'apex'
    // for free. apex_features stays writable so the client can still toggle
    // cosmetic Apex perks (thread_skin, badge style, etc.).
    'apex_tier',
    'stripe_customer_id',
    'stripe_subscription_id',
    'stripe_subscription_status',
    'stripe_current_period_end',
    'stripe_cancel_at_period_end',
    'apex_first_activated_at',
  ]);

  router.patch('/:id', guard, async (req, res) => {
    try {
      const existing = await Model.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const owner = isOwner(existing, req.user?.id);
      // Non-owners get blocked unless this model has explicitly opted in to
      // public-writable interaction fields. Even then, they may only patch
      // the keys in publicWriteSet — caption / video / pinned / etc. stay
      // owner-only.
      if (!owner && publicWriteSet.size === 0) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const safeBody = {};
      for (const [k, v] of Object.entries(req.body)) {
        if (k.startsWith('$') || PROTECTED_FIELDS.has(k)) continue;
        if (!owner && !publicWriteSet.has(k)) continue; // strip non-allowlisted keys
        safeBody[k] = v;
      }

      // Non-owner request with nothing left after the allowlist filter — they
      // were trying to write fields they don't have access to. Surface a 403
      // rather than silently no-op so the caller can see the problem.
      if (!owner && Object.keys(safeBody).length === 0) {
        return res.status(403).json({ error: 'Forbidden' });
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
