const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMiddleware = require('../middleware/auth');
const Module = require('../models/Module');

const router = express.Router();

// ── Dedicated action endpoints (defined before CRUD to avoid /:id conflicts) ──

// Atomic install count increment — any authenticated user, no ownership needed
router.post('/:id/install', authMiddleware, async (req, res) => {
  try {
    const mod = await Module.findByIdAndUpdate(
      req.params.id,
      { $inc: { install_count: 1 } },
      { new: true }
    ).lean();
    if (!mod) return res.status(404).json({ error: 'Not found' });
    res.json({ install_count: mod.install_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atomic install count decrement (floor 0)
router.post('/:id/uninstall', authMiddleware, async (req, res) => {
  try {
    await Module.updateOne(
      { _id: req.params.id, install_count: { $gt: 0 } },
      { $inc: { install_count: -1 } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report a module — one report per user; auto-flags and hides at 3 reports
router.post('/:id/report', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'reason required' });

    const mod = await Module.findById(req.params.id).lean();
    if (!mod) return res.status(404).json({ error: 'Not found' });

    const existing = mod.reports || [];
    if (existing.some(r => r.reporter_id === req.user?.id)) {
      return res.status(409).json({ error: 'Already reported' });
    }

    const newReports = [
      ...existing,
      { reporter_id: req.user?.id, reason: reason.trim(), date: new Date().toISOString() },
    ];
    const update = { reports: newReports };
    if (newReports.length >= 3) {
      update.status = 'flagged';
      update.is_public = false;
    }

    await Module.findByIdAndUpdate(req.params.id, { $set: update });
    res.json({ reported: true, flagged: !!update.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Standard CRUD with author ownership protection ────────────────────────────
router.use('/', crudRouter(Module, { ownerField: 'author_id' }));

module.exports = router;
