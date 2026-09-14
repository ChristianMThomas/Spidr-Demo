const express  = require('express');
const authMW   = require('../middleware/auth');
const User     = require('../models/User');
const crudRouter = require('../utils/crudRouter');

const router = express.Router();

// ── Search users by username or email (for friend requests) ───────────────────
router.get('/search', authMW, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    // Username/full_name stay partial-match so friend search still feels right.
    // Email is EXACT-match only: a partial email regex let anyone trawl the
    // user table for real addresses two characters at a time.
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [
        { username: regex },
        { full_name: regex },
        { email: String(q).toLowerCase().trim() },
      ],
      _id: { $ne: req.user._id } // Exclude self
    })
    .select('-password -twoFactorSecret')
    .limit(20)
    .lean();

    // No email in the response. You may FIND someone by their exact address,
    // but the result never hands their address back to the searcher.
    res.json(users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      status: u.status,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount standard CRUD (GET /, GET /:id, POST /, PATCH /:id, DELETE /:id)
// but strip password from all responses.
// ownerField: '_id' locks PATCH/DELETE to self — req.user.id equals
// req.user._id.toString() (auth middleware returns the full User doc),
// which matches doc._id.toString() in isOwner(). Without this any
// authenticated user could DELETE any other user's account.
const crud = crudRouter(User, { ownerField: '_id' });

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
