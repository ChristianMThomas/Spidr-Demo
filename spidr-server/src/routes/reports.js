 const express = require('express');
  const authMW = require('../middleware/auth');
  const Report = require('../models/Report');

  const router = express.Router();

  // Only the reporter's own row and admins can read/mutate a report.
  // Bare crudRouter here was an Apple 1.2 blocker — any authenticated user could
  // list or edit the whole moderation queue. Admin gate + owner-scoped POST.
  function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  }

  const ALLOWED_STATUS = new Set(['pending', 'reviewed', 'resolved', 'dismissed']);

  function normalise(doc) {
    if (!doc) return doc;
    const { _id, __v, ...rest } = doc;
    return { id: _id?.toString(), ...rest };
  }

  // Anyone signed in can file a report; reporter_id is forced server-side.
  router.post('/', authMW, async (req, res) => {
    try {
      const data = { ...req.body };
      delete data.status;
      delete data.reviewer_id;
      delete data.review_notes;
      data.reporter_id = req.user._id.toString();
      const doc = await Report.create(data);
      res.status(201).json(normalise(doc.toObject()));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin-only queue read + mutations.
  router.get('/', authMW, adminOnly, async (req, res) => {
    try {
      const { _orderBy, _limit, ...filters } = req.query;
      const query = {};
      for (const [k, v] of Object.entries(filters)) {
        if (k.startsWith('$')) continue;
        if (typeof v === 'object' && v !== null) continue;
        query[k] = typeof v === 'string' && v.includes(',') ? { $in: v.split(',') } : v;
      }
      let q = Report.find(query);
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
      res.json(docs.map(normalise));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', authMW, adminOnly, async (req, res) => {
    try {
      const doc = await Report.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(normalise(doc));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', authMW, adminOnly, async (req, res) => {
    try {
      const patch = {};
      if (req.body.status !== undefined) {
        if (!ALLOWED_STATUS.has(req.body.status)) {
          return res.status(400).json({ error: 'invalid_status' });
        }
        patch.status = req.body.status;
      }
      if (req.body.review_notes !== undefined) patch.review_notes = req.body.review_notes;
      patch.reviewer_id = req.user._id.toString();

      const doc = await Report.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true }).lean();
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(normalise(doc));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:id', authMW, adminOnly, async (req, res) => {
    try {
      const doc = await Report.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  module.exports = router;