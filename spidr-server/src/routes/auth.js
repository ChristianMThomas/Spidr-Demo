const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const Redis     = require('ioredis');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const authMW    = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/mailer');

// Strict rate limiter for sensitive auth endpoints (10 req / 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const router = express.Router();

// Redis for OTP storage (TTL = 10 min). Falls back gracefully if Redis unavailable.
let redis = null;
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', () => { redis = null; });
} catch {}

const SPRING_BOOT_DEV_FALLBACK = 'c3BpZHItZGV2LWZhbGxiYWNrLXNlY3JldC1rZXktcGxlYXNlLXNldC1pbi1lbnY=';
const getSecret = () => {
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
    console.warn('[SECURITY] JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in .env');
    return Buffer.from(SPRING_BOOT_DEV_FALLBACK, 'base64');
  }
  return Buffer.from(raw, 'base64');
};

const generateOTP  = () => require('crypto').randomInt(100000, 1000000).toString();

const signToken = (id) =>
  jwt.sign({ id }, getSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// OTP helpers — use Redis if available, else in-memory Map (dev only)
const otpMemory = new Map();

async function storeOTP(email, otp) {
  if (redis) {
    await redis.set(`otp:${email}`, otp, 'EX', 600);
  } else {
    otpMemory.set(email, { otp, expires: Date.now() + 600_000 });
  }
}

async function getOTP(email) {
  if (redis) return redis.get(`otp:${email}`);
  const entry = otpMemory.get(email);
  if (!entry) return null;
  if (Date.now() > entry.expires) { otpMemory.delete(email); return null; }
  return entry.otp;
}

async function deleteOTP(email) {
  if (redis) await redis.del(`otp:${email}`);
  else otpMemory.delete(email);
}

// ── REGISTER — creates account + sends verification OTP ──────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/\d/.test(password)) return res.status(400).json({ error: 'Password must contain at least one number' });

    const exists = await User.findOne({ $or: [{ email }, ...(username ? [{ username }] : [])] });
    if (exists) return res.status(409).json({ error: 'Email or username already taken' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hash, username, full_name, is_verified: false });

    // Send verification OTP (email failure is non-blocking)
    const otp = generateOTP();
    await storeOTP(email, otp);
    try { await sendOTPEmail(email, otp, 'verify'); } catch (e) { console.warn('Email send failed:', e.message); }

    res.status(200).json({
      message: 'Verification code sent to your email.',
      requiresVerification: true,
      email,
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LOGIN — checks credentials + sends 2FA OTP ───────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

    // Send 2FA OTP (email failure is non-blocking - OTP is always stored)
    const otp = generateOTP();
    await storeOTP(email, otp);
    try { await sendOTPEmail(email, otp, 'login'); } catch (e) { console.warn('Email send failed:', e.message); }

    res.json({ requires2FA: true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFY OTP — validates code, issues JWT ───────────────────────────────────
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and code required' });

    const stored = await getOTP(email);
    if (!stored || stored !== otp.toString()) {
      return res.status(400).json({ error: 'Invalid or expired code. Check your email.' });
    }

    await deleteOTP(email);

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.is_verified) {
      user.is_verified = true;
      await user.save();
    }

    const token = signToken(user._id);
    res.json({ token, user: sanitise(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── RESEND OTP ────────────────────────────────────────────────────────────────
router.post('/resend-otp', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account found' });

    const otp = generateOTP();
    await storeOTP(email, otp);
    await sendOTPEmail(email, otp, user.is_verified ? 'login' : 'verify');

    res.json({ message: 'New code sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ME ────────────────────────────────────────────────────────────────────────
router.get('/me', authMW, (req, res) => {
  res.json(sanitise(req.user));
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
router.post('/change-password', authMW, authLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function sanitise(user) {
  const { password, __v, _id, ...rest } = user.toObject ? user.toObject() : user;
  return { id: (_id || user._id)?.toString(), ...rest };
}

// ── TOTP 2FA SETUP ────────────────────────────────────────────────────────────
router.post('/setup-totp', authMW, async (req, res) => {
  try {
    let speakeasy, QRCode;
    try { speakeasy = require('speakeasy'); QRCode = require('qrcode'); }
    catch { return res.status(501).json({ error: 'TOTP not available — run npm install in spidr-server' }); }

    const secret = speakeasy.generateSecret({ name: `Spidr (${req.user.email})`, length: 20 });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    // Store temp secret on user (not committed until verified)
    await User.findByIdAndUpdate(req.user._id, { twoFactorSecret: secret.base32 });
    res.json({ secret: secret.base32, qrCodeUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/verify-totp-setup', authMW, async (req, res) => {
  try {
    let speakeasy;
    try { speakeasy = require('speakeasy'); } catch { return res.status(501).json({ error: 'TOTP not available' }); }
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token, window: 1 });
    if (!ok) return res.status(400).json({ error: 'Invalid authenticator code — check your app clock' });
    await User.findByIdAndUpdate(req.user._id, { twoFactorMethod: 'totp' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/disable-totp', authMW, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { twoFactorMethod: 'none', twoFactorSecret: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PASSWORD RESET (Forgot Password) ─────────────────────────────────────────
router.post('/override-request', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.json({ method: 'email', message: 'If that email exists, a reset code was sent' });

    if (user.twoFactorMethod === 'totp') {
      return res.json({ method: 'totp', message: 'Authenticator code required' });
    }
    const otp = generateOTP();
    await storeOTP('reset:' + email, otp);
    try { await sendOTPEmail(email, otp, 'reset'); } catch (e) { console.warn('Reset email failed:', e.message); }
    res.json({ method: 'email', message: 'Reset code sent to your email' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/override-verify', authLimiter, async (req, res) => {
  try {
    const { email, code, method } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid request' });

    if (method === 'totp') {
      let speakeasy;
      try { speakeasy = require('speakeasy'); } catch { return res.status(501).json({ error: 'TOTP not available' }); }
      const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
      if (!ok) return res.status(400).json({ error: 'Invalid authenticator code' });
    } else {
      const stored = await getOTP('reset:' + email);
      if (!stored || stored !== code.toString()) return res.status(400).json({ error: 'Invalid or expired code' });
      await deleteOTP('reset:' + email);
    }

    const jwt = require('jsonwebtoken');
    const resetToken = jwt.sign({ userId: user._id, intent: 'reset_password' }, getSecret(), { expiresIn: '10m' });
    res.json({ resetToken });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/override-confirm', authLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/\d/.test(newPassword)) return res.status(400).json({ error: 'Password must contain at least one number' });
    const jwt = require('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(resetToken, getSecret()); } catch { return res.status(400).json({ error: 'Reset session expired — restart the override protocol' }); }
    if (decoded.intent !== 'reset_password') return res.status(400).json({ error: 'Invalid reset token' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(decoded.userId, { password: hash });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DEV ONLY: Get current pending OTP for testing (disabled in production) ────
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-get-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const otp = await getOTP(email);
    if (!otp) return res.status(404).json({ error: 'No pending OTP (may have expired)' });
    res.json({ otp, note: 'DEV MODE ONLY — never expose in production' });
  });
}

module.exports = router;
