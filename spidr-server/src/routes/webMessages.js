const express = require('express');
const authMW  = require('../middleware/auth');
const WebMessage = require('../models/WebMessage');

// THE WEB's own DM lane ("Sling to DM"). Deliberately separate from
// /direct-messages so shared posts never mix into real conversations.
const router = express.Router();

const norm = (d) => { if (!d) return null; const { _id, __v, ...r } = d; return { id: _id.toString(), ...r }; };

// GET /web-messages?box=inbox|sent — newest first, capped at 100
router.get('/', authMW, async (req, res) => {
  try {
    const uid = req.user?.id;
    const box = req.query.box === 'sent' ? 'sent' : 'inbox';
    const q = box === 'sent' ? { sender_id: uid } : { recipient_id: uid };
    const docs = await WebMessage.find(q).sort({ createdAt: -1 }).limit(100).lean();
    res.json(docs.map(norm));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /web-messages/unread-count
router.get('/unread-count', authMW, async (req, res) => {
  try {
    const n = await WebMessage.countDocuments({ recipient_id: req.user?.id, read: false });
    res.json({ count: n });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /web-messages — sling a clip. Body: { recipient_id, clip_id, clip_title?, clip_thumb?, note? }
router.post('/', authMW, async (req, res) => {
  try {
    const uid = req.user?.id;
    const { recipient_id, clip_id, clip_title = '', clip_thumb = '', note = '' } = req.body || {};
    if (!recipient_id || !clip_id) return res.status(400).json({ error: 'recipient_id and clip_id required' });
    if (recipient_id === uid) return res.status(400).json({ error: 'Cannot sling to yourself' });
    const doc = await WebMessage.create({
      sender_id: uid,
      sender_name:   req.body.sender_name   || '',
      sender_avatar: req.body.sender_avatar || '',
      recipient_id, clip_id, clip_title, clip_thumb,
      note: String(note).slice(0, 500),
    });
    // Real-time ping so the recipient's SIGNALS badge updates instantly.
    const io = req.app.get('io');
    if (io) io.emit('web:signal-received', { recipient_id, message: norm(doc.toObject()) });
    res.status(201).json(norm(doc.toObject()));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /web-messages/:id/read — recipient marks read
router.patch('/:id/read', authMW, async (req, res) => {
  try {
    const doc = await WebMessage.findOneAndUpdate(
      { _id: req.params.id, recipient_id: req.user?.id },
      { $set: { read: true } }, { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(norm(doc));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /web-messages/:id — sender or recipient can remove
router.delete('/:id', authMW, async (req, res) => {
  try {
    const uid = req.user?.id;
    const r = await WebMessage.deleteOne({ _id: req.params.id, $or: [{ sender_id: uid }, { recipient_id: uid }] });
    if (!r.deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
