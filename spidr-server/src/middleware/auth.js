const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Spring Boot's JwtService calls Decoders.BASE64.decode(secretKey) before signing,
// so Node.js must also base64-decode JWT_SECRET to use the same raw key bytes.
// In dev (no JWT_SECRET set) we decode Spring Boot's application.properties fallback
// so tokens issued by either service are cross-compatible out of the box.
const SPRING_BOOT_DEV_FALLBACK =
  'c3BpZHItZGV2LWZhbGxiYWNrLXNlY3JldC1rZXktcGxlYXNlLXNldC1pbi1lbnY=';

const getSecret = () => {
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return Buffer.from(SPRING_BOOT_DEV_FALLBACK, 'base64');
  }
  return Buffer.from(raw, 'base64');
};

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
