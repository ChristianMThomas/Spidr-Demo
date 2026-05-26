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
    ? ['https://spidrapp.com', 'https://www.spidrapp.com']
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
  fullName: { type: String, required: true, trim: true },
  email:    { type: String, required: true, lowercase: true, trim: true, unique: true },
  ip:       { type: String },
  createdAt:{ type: Date, default: Date.now },
}));

if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err.message));
} else {
  console.warn('[WARN] MONGO_URI not set — signups will not be persisted.');
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/signup', signupLimiter, async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName?.trim()) return res.status(400).json({ error: 'Full name is required.' });
  if (!email?.trim())    return res.status(400).json({ error: 'Email is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    await BetaSignup.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      ip: req.ip,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate email — treat as success so we don't leak existence
      return res.json({ message: "You're already on the list!" });
    }
    console.error('DB error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  try {
    await sendBetaConfirmEmail(email.trim(), fullName.trim());
  } catch (err) {
    console.warn('Email send failed (signup still saved):', err.message);
  }

  res.json({ message: "You're on the list!" });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`spidr-beta-api running on :${PORT}`));
