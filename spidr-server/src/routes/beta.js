const express = require('express');
const router = express.Router();
const BetaSignup = require('../models/BetaSignup');

const BETA_CAP = 50;

// GET /beta/status — public, returns live spot count
router.get('/status', async (_req, res) => {
  try {
    const count = await BetaSignup.countDocuments();
    res.json({
      count,
      spotsLeft: Math.max(0, BETA_CAP - count),
      isFull: count >= BETA_CAP,
      cap: BETA_CAP,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch beta status' });
  }
});

// POST /beta/signup — public, register for beta
router.post('/signup', async (req, res) => {
  const { email, name } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    const count = await BetaSignup.countDocuments();
    if (count >= BETA_CAP) {
      return res.status(409).json({ error: 'Beta is full. No spots remaining.' });
    }

    const existing = await BetaSignup.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered for beta.' });
    }

    await BetaSignup.create({ email, name: name || '' });

    const newCount = count + 1;
    res.status(201).json({
      message: 'You\'re in! Welcome to the Spidr beta.',
      spotsLeft: Math.max(0, BETA_CAP - newCount),
      isFull: newCount >= BETA_CAP,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This email is already registered for beta.' });
    }
    res.status(500).json({ error: 'Failed to register for beta.' });
  }
});

module.exports = router;
