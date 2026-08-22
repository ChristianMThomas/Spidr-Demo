const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { getSecret } = require('../utils/jwtSecret');
const { ensureSystemFriendship } = require('../utils/spidrSystem');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getSecret());

    // Spring Boot embeds userId (AUTH-Q7); old Node.js tokens used id
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;

    // First authenticated hit per user per process: seed the Spidr System
    // friendship + welcome DM. Fire-and-forget so signup latency isn't
    // affected; the helper has its own idempotency + per-process cache.
    ensureSystemFriendship(user._id).catch(err =>
      console.warn('[auth] ensureSystemFriendship failed:', err?.message)
    );

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
