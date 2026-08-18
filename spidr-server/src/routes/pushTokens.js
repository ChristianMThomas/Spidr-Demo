const express = require('express');
const PushToken = require('../models/PushToken');
const authMW = require('../middleware/auth');

const router = express.Router();

/**
 * Device push-token registry for native call ringing (Patch 1.9.x).
 *   POST /push-tokens/register   { token, platform } — upsert for the caller
 *   POST /push-tokens/unregister { token }           — remove on logout
 */

router.post('/register', authMW, async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'token required' });
    }
    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be ios or android' });
    }
    // Upsert by token: a device that changes hands (logout → other login)
    // must ring the CURRENT user, never the previous one.
    await PushToken.findOneAndUpdate(
      { token: token.trim() },
      { user_id: req.user.id, platform, provider: 'fcm' },
      { upsert: true, new: true },
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unregister', authMW, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'token required' });
    }
    // Only the owner can unregister their token.
    await PushToken.deleteOne({ token: token.trim(), user_id: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
