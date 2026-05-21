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
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
