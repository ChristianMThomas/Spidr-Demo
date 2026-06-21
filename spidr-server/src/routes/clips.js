const express    = require('express');
const crudRouter = require('../utils/crudRouter');
const authMiddleware = require('../middleware/auth');
const Clip = require('../models/Clip');

// Non-owners (anyone authenticated viewing someone else's clip) may PATCH
// only these engagement fields. Editing the caption, swapping the video,
// pinning, overclocking, etc. all stay owner-only. DELETE is owner-only.
const PUBLIC_INTERACTION_FIELDS = [
  'likes',           // toggle membership in the likes array
  'reactions',       // emoji reaction map
  'comments_count',  // bumped by the client when a comment posts (legacy)
  'shares_count',    // bumped on share
  'views',           // bumped on view
  'relays',          // Signal Relay (repost) — toggle membership in relays[]
];

const router = express.Router();

// ── Atomic view increment ────────────────────────────────────────────────────
// POST /clips/:id/view  →  { id, views }
//
// Previously the client had NO view-tracking at all — clip.views was rendered
// but never written, so the count was frozen at 0. A plain PATCH { views: n }
// would also be racy (last-write-wins $set), so two concurrent viewers reading
// the same stale value would clobber each other. This route uses an atomic
// $inc so every counted view lands exactly once regardless of concurrency.
router.post('/:id/view', authMiddleware, async (req, res) => {
  try {
    const doc = await Clip.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true, projection: { views: 1 } }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ id: doc._id.toString(), views: doc.views });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Signal Relay (repost) toggle ─────────────────────────────────────────────
// POST /clips/:id/relay  →  { id, relays, relayed }
//
// Atomic, idempotent membership toggle on relays[]. Using $addToSet / $pull
// means a double-tap can't create duplicates and concurrent relays from
// different users never clobber the array (the bug a PATCH { relays: [...] }
// with a stale snapshot would cause).
router.post('/:id/relay', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await Clip.findById(req.params.id, { relays: 1 }).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const alreadyRelayed = (existing.relays || []).includes(userId);
    const update = alreadyRelayed
      ? { $pull:   { relays: userId } }
      : { $addToSet: { relays: userId } };

    const doc = await Clip.findByIdAndUpdate(
      req.params.id, update, { new: true, projection: { relays: 1 } }
    ).lean();

    res.json({
      id:      doc._id.toString(),
      relays:  doc.relays || [],
      relayed: !alreadyRelayed,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Standard CRUD (list / get / create / patch / delete) for everything else.
router.use('/', crudRouter(Clip, {
  ownerField: 'author_id',
  publicWriteFields: PUBLIC_INTERACTION_FIELDS,
}));

module.exports = router;
