const express  = require('express');
const authMW   = require('../middleware/auth');
const User     = require('../models/User');
const crudRouter = require('../utils/crudRouter');
const { onlineUsers } = require('../state/presence');

const router = express.Router();

// ── Search users by username or email (for friend requests) ───────────────────
router.get('/search', authMW, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }, { full_name: regex }],
      _id: { $ne: req.user._id } // Exclude self
    })
    .select('-password -twoFactorSecret')
    .limit(20)
    .lean();

    res.json(users.map(u => ({
      id: u._id.toString(),
      email: u.email,
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      status: u.status,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Returns the set of user IDs with an active socket connection right now
router.get('/online', authMW, (req, res) => {
  try {
    res.json([...onlineUsers.keys()]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount standard CRUD (GET /, GET /:id, POST /, PATCH /:id, DELETE /:id)
// but strip password from all responses
const crud = crudRouter(User);

// Override: list should never expose passwords
router.use('/', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (Array.isArray(data)) {
      data = data.map(u => { const { password, twoFactorSecret, ...rest } = u; return rest; });
    } else if (data && data.password) {
      const { password, twoFactorSecret, ...rest } = data;
      data = rest;
    }
    return originalJson(data);
  };
  next();
});

router.use('/', crud);

module.exports = router;
