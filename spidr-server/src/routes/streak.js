/**
 * Streak Routes — daily-login streak for the Streak Counter module.
 *
 * The client fires POST /streak/ping on app mount (see AuthContext). This
 * route is the ONLY writer of the streak_* fields on UserProfile — direct
 * PATCH via /user-profiles is blocked by PROTECTED_FIELDS in crudRouter.
 *
 * Day math is done in UTC ('YYYY-MM-DD' strings) so it never gets tripped up
 * by client TZ or DST — one boundary per calendar day, consistently.
 *
 *   ping()  today === last_active  → no-op (return current values)
 *           yesterday === last_active → current++, total++, best = max
 *           anything else            → reset current to 1, total++, best = max
 */

const express = require('express');
const authMW  = require('../middleware/auth');
const UserProfile = require('../models/UserProfile');

const router = express.Router();

// 'YYYY-MM-DD' for a Date, in UTC.
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// Given a 'YYYY-MM-DD' string, return the same date - 1 day, also as 'YYYY-MM-DD'.
function prevYmd(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return ymd(d);
}

async function computeAndApplyStreak(userId) {
  const profile = await UserProfile.findOne({ user_id: userId });
  if (!profile) return null;

  const today = ymd(new Date());
  const last  = profile.streak_last_active_date || '';

  if (last === today) {
    // already pinged today — no-op
    return {
      current: profile.streak_current,
      best:    profile.streak_best,
      total:   profile.streak_total_days,
      last_active_date: last,
    };
  }

  let current;
  if (last && prevYmd(today) === last) {
    current = (profile.streak_current || 0) + 1;
  } else {
    // missed at least one day (or never pinged) — restart at 1
    current = 1;
  }
  const best  = Math.max(profile.streak_best || 0, current);
  const total = (profile.streak_total_days || 0) + 1;

  profile.streak_current          = current;
  profile.streak_best             = best;
  profile.streak_total_days       = total;
  profile.streak_last_active_date = today;
  await profile.save();

  return { current, best, total, last_active_date: today };
}

// POST /streak/ping — records today's activity, returns updated values.
router.post('/ping', authMW, async (req, res) => {
  try {
    const result = await computeAndApplyStreak(req.user.id);
    if (!result) return res.status(404).json({ error: 'profile not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /streak/me — read the caller's streak without touching it.
router.get('/me', authMW, async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.user.id }).lean();
    if (!profile) return res.status(404).json({ error: 'profile not found' });
    res.json({
      current: profile.streak_current || 0,
      best:    profile.streak_best || 0,
      total:   profile.streak_total_days || 0,
      last_active_date: profile.streak_last_active_date || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /streak/:userId — public read for the widget on other users' profiles.
router.get('/:userId', authMW, async (req, res) => {
  try {
    const profile = await UserProfile.findOne({ user_id: req.params.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'profile not found' });
    res.json({
      current: profile.streak_current || 0,
      best:    profile.streak_best || 0,
      total:   profile.streak_total_days || 0,
      last_active_date: profile.streak_last_active_date || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
