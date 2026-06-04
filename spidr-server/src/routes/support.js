const express = require('express');
const router = express.Router();
const { sendSupportEmail } = require('../utils/mailer');

const gameReportLog = new Map(); // ip → timestamp
const REPORT_COOLDOWN = 24 * 60 * 60 * 1000;

router.post('/game-report', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const last = gameReportLog.get(ip) || 0;
  if (Date.now() - last < REPORT_COOLDOWN) {
    return res.status(429).json({ error: 'You already submitted a report. Try again in 24 hours.' });
  }
  gameReportLog.set(ip, Date.now());
  const { email, issue, launcher, description } = req.body;
  if (!email || !issue || !launcher) {
    return res.status(400).json({ error: 'email, issue, and launcher are required' });
  }

  try {
    await sendSupportEmail({ email, issue, launcher, description: description || '' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Support email failed:', err.message);
    res.status(500).json({ error: 'Failed to send report' });
  }
});

module.exports = router;
