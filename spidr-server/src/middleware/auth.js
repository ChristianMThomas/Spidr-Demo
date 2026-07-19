const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { getSecret } = require('../utils/jwtSecret');

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

    // Every user gets Spidr System as an accepted friend. Fire-and-forget —
    // the util keeps an in-memory per-boot set so this is a no-op Set lookup
    // on all but the first request per user, and must never delay or fail
    // the actual request.
    try {
      const { ensureSystemFriendship } = require('../utils/spidrSystem');
      ensureSystemFriendship(user._id.toString()).catch(() => {});
    } catch { /* never block auth */ }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
