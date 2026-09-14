/**
 * crudRouter(Model)
 * Generates a standard REST router for a Mongoose model.
 * Supports: GET / (list + filter), GET /:id, POST /, PATCH /:id, DELETE /:id
 *
 * opts:
 *   ownerField        string | string[] — who owns a doc. Gates PATCH/DELETE,
 *                     and is stamped onto the doc on POST.
 *   privateRead       true = LIST is force-scoped to the caller's own rows and
 *                     GET /:id 404s for non-owners. REQUIRED for any resource
 *                     whose rows are private to one user (DMs, AI logs, saved
 *                     audio). Without it, ownerField protects WRITES ONLY and
 *                     every row is readable by any authenticated user.
 *                     Left off for resources that must be cross-readable
 *                     (UserProfile — rendering @handle#tag needs another
 *                     user's profile; Friend, Server, Clip, Comment, Feed).
 *   publicWriteFields fields a non-owner may PATCH (likes/reactions).
 *   protectedFields   extra field names no client may ever set, on create or
 *                     update. PROTECTED_FIELDS below is a shared blocklist of
 *                     User/Stripe/streak names; per-model trust flags
 *                     (CustomBot.is_official, Comment.is_pinned) belong here.
 */
const express   = require('express');
const authMiddleware = require('../middleware/auth');

module.exports = function crudRouter(Model, opts = {}) {
  const router = express.Router();
  const {
    protect = true,
    ownerField = null,
    // See header. Off by default because most resources are cross-readable;
    // turning it on is how a resource becomes private.
    privateRead = false,
    protectedFields = [],
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

  const ownerFields = ownerField
    ? (Array.isArray(ownerField) ? ownerField : [ownerField])
    : [];
  // ownerField may be an array (OR-checked on read); the field actually
  // stamped at create time is the first entry. Assigning the array itself
  // produced a literal "user_id,author_id" key and left the doc ownerless.
  const primaryOwnerField = ownerFields[0] || null;

  // Strips keys no client may set, on create and update alike.
  function sanitise(body) {
    const out = {};
    for (const [k, v] of Object.entries(body || {})) {
      if (k.startsWith('$')) continue;
      if (PROTECTED_FIELDS.has(k) || extraProtected.has(k)) continue;
      out[k] = v;
    }
    return out;
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

      // Private resources: force owner scoping so LIST can never return
      // another user's rows, whatever filters the caller supplies.
      if (privateRead && ownerFields.length) {
        const uid = req.user?.id?.toString();
        query.$or = ownerFields.map(f => ({ [f]: uid }));
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
      // 404 rather than 403 — for a private row, existence is itself
      // information, and an id-guessing caller shouldn't learn it.
      if (privateRead && !isOwner(doc, req.user?.id)) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(normalise(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────
  router.post('/', guard, async (req, res) => {
    try {
      // Same filter PATCH applies. Without it, Model.create(req.body) let a
      // client set ANY schema field at creation time — e.g. CustomBot's
      // is_official, minting a bot that renders as Spidr-endorsed.
      const data = sanitise(req.body);
      if (primaryOwnerField) data[primaryOwnerField] = req.user?.id;
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
    // #tag: only POST /user-profiles/tag may set this. A blanket PATCH would
    // skip validation, case-folding, reserved words and collision checks —
    // i.e. a user could hand themselves "#admin" or duplicate someone else.
    'discriminator',
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

  // Per-model additions to the blocklist above (see opts.protectedFields).
  const extraProtected = new Set(protectedFields);

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
        if (k.startsWith('$') || PROTECTED_FIELDS.has(k) || extraProtected.has(k)) continue;
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
