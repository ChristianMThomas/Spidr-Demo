const express = require('express');
const router = express.Router();
const { sendSupportEmail } = require('../utils/mailer');

router.post('/game-report', async (req, res) => {
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
