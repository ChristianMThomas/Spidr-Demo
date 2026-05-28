require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { sendBetaConfirmEmail } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://spidrapp.com',
        'https://www.spidrapp.com',
        'https://spidrapp.infinitetechteam.com',
      ]
    : '*',
}));

app.set('trust proxy', 1);

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signups from this IP. Try again later.' },
});

// ── MongoDB ───────────────────────────────────────────────────────────────────

const BetaSignup = mongoose.model('BetaSignup', new mongoose.Schema({
  // Core identity
  firstName:      { type: String, required: true, trim: true },
  lastName:       { type: String, required: true, trim: true },
  email:          { type: String, required: true, lowercase: true, trim: true, unique: true },
  username:       { type: String, required: true, trim: true, lowercase: true },

  // Demographics
  age:            { type: String, required: true },

  // Beta preferences
  platforms:      { type: [String], required: true },
  betaType:       { type: String, enum: ['closed', 'open'], required: true },
  why:            { type: String, trim: true, default: '' },

  // Consents
  agreedTerms:    { type: Boolean, required: true },
  agreedPrivacy:  { type: Boolean, required: true },
  confirmedAge:   { type: Boolean, required: true },
  marketingOptIn: { type: Boolean, default: false },

  // Meta
  ip:             { type: String },
  createdAt:      { type: Date, default: Date.now },
}));

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err.message));
} else {
  console.warn('[WARN] MONGO_URI not set — signups will not be persisted.');
}

// ── Routes ────────────────────────────────────────────────────────────────────

const BETA_CAP = 50;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/status', async (_req, res) => {
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

app.post('/signup', signupLimiter, async (req, res) => {
  const {
    firstName, lastName, email, username, age,
    platforms, betaType, why,
    agreedTerms, agreedPrivacy, confirmedAge, marketingOptIn,
  } = req.body;

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!firstName?.trim())
    return res.status(400).json({ error: 'First name is required.' });
  if (!lastName?.trim())
    return res.status(400).json({ error: 'Last name is required.' });
  if (!email?.trim())
    return res.status(400).json({ error: 'Email is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!username?.trim() || username.trim().length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (!age)
    return res.status(400).json({ error: 'Age selection is required.' });
  if (age === 'under18')
    return res.status(400).json({ error: 'You must be 18 or older to join the beta.' });
  if (!Array.isArray(platforms) || platforms.length === 0)
    return res.status(400).json({ error: 'Select at least one platform.' });
  if (!['closed', 'open'].includes(betaType))
    return res.status(400).json({ error: 'Please choose a beta track.' });
  if (!agreedTerms)
    return res.status(400).json({ error: 'You must agree to the Beta Testing Agreement.' });
  if (!agreedPrivacy)
    return res.status(400).json({ error: 'You must consent to data processing.' });
  if (!confirmedAge)
    return res.status(400).json({ error: 'You must confirm you are 18 or older.' });

  // ── Cap check ─────────────────────────────────────────────────────────────
  const currentCount = await BetaSignup.countDocuments();
  if (currentCount >= BETA_CAP) {
    return res.status(409).json({ error: 'Beta is full. No spots remaining.' });
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  try {
    await BetaSignup.create({
      firstName:   firstName.trim(),
      lastName:    lastName.trim(),
      email:       email.trim().toLowerCase(),
      username:    username.trim().toLowerCase(),
      age,
      platforms,
      betaType,
      why:         (why || '').trim(),
      agreedTerms: true,
      agreedPrivacy: true,
      confirmedAge:  true,
      marketingOptIn: !!marketingOptIn,
      ip: req.ip,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate email — return success so we don't leak existence
      return res.json({ message: "You're already on the list!" });
    }
    console.error('DB error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  try {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    await sendBetaConfirmEmail(email.trim(), fullName);
  } catch (err) {
    console.warn('Email send failed (signup still saved):', err.message);
  }

  res.json({ message: "You're on the list!" });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`spidr-beta-api running on :${PORT}`));
