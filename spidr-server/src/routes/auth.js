const express = require('express');
const User    = require('../models/User');
const authMW  = require('../middleware/auth');

// Legacy credential endpoints (register, login, email OTP, password reset) were
// removed — spidr-auth (Spring Boot) owns all credential checks and JWT
// issuance. Only TOTP 2FA lives here until Spring Boot grows it (AUTH-F3).
// The /auth mount in index.js returns 410 for anything not defined below.

const router = express.Router();

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

module.exports = router;
