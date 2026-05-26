const express = require('express');
const Follow = require('../models/Follow');
const authMW = require('../middleware/auth');

const router = express.Router();

/**
 * Follow endpoints for THE WEB.
 *   GET    /follows?follower_id=  — list who I follow
 *   GET    /follows?following_id= — list my followers
 *   GET    /follows/status/:userId — { following: bool, followers, following }
 *   POST   /follows               — follow a user { following_id, names/avatars }
 *   DELETE /follows/:userId       — unfollow (by the OTHER user's id)
 */

router.get('/', authMW, async (req, res) => {
  try {
    const q = {};
    if (req.query.follower_id) q.follower_id = req.query.follower_id;
    if (req.query.following_id) q.following_id = req.query.following_id;
    const rows = await Follow.find(q).sort({ created_date: -1 }).limit(500).lean();
    res.json(rows.map(({ _id, __v, ...rest }) => ({ id: _id?.toString(), ...rest })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick status helper for a profile view: am I following them + their counts.
router.get('/status/:userId', authMW, async (req, res) => {
  try {
    const me = req.user.id;
    const them = req.params.userId;
    const [mine, followers, following] = await Promise.all([
      Follow.findOne({ follower_id: me, following_id: them }).lean(),
      Follow.countDocuments({ following_id: them }),
      Follow.countDocuments({ follower_id: them }),
    ]);
    res.json({ following: !!mine, followers, followingCount: following });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMW, async (req, res) => {
  try {
    const me = req.user.id;
    const { following_id, following_name, following_avatar, follower_name, follower_avatar } = req.body;
    if (!following_id) return res.status(400).json({ error: 'following_id required' });
    if (following_id === me) return res.status(400).json({ error: "Can't follow yourself" });
    // Upsert so a double-tap doesn't error.
    const doc = await Follow.findOneAndUpdate(
      { follower_id: me, following_id },
      { $setOnInsert: { follower_id: me, following_id, following_name, following_avatar, follower_name, follower_avatar } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(201).json({ id: doc._id?.toString(), ...doc });
  } catch (err) {
    // Duplicate key (already following) — treat as success.
    if (err.code === 11000) return res.json({ ok: true, alreadyFollowing: true });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:userId', authMW, async (req, res) => {
  try {
    await Follow.findOneAndDelete({ follower_id: req.user.id, following_id: req.params.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
