const express = require('express');
const authMW = require('../middleware/auth');
const BiomassWallet = require('../models/BiomassWallet');
const { grantXp, progressForXp, getOrCreate } = require('../utils/tension');

const router = express.Router();

/**
 * Tension (XP) endpoints.
 *
 *   GET   /tension/me            — current user's profile + progress breakdown
 *   POST  /tension/action        — report an activity; server grants capped XP
 *                                  and, on level-up, auto-grants a biomass reward
 *
 * XP amounts and daily caps are server-authoritative (utils/tension.js); the
 * client only names the *source* of the activity, never the amount.
 */

// Sources the client is allowed to report. Server decides the XP value.
const ALLOWED_SOURCES = new Set(['message', 'fly', 'voice_join', 'clip_post', 'daily_login', 'reaction']);

// On level-up we reward biomass = newLevel * 50, recorded in the wallet log.
async function grantLevelUpBiomass(userId, newLevel) {
  try {
    let w = await BiomassWallet.findOne({ user_id: userId });
    if (!w) w = await BiomassWallet.create({ user_id: userId });
    const reward = newLevel * 50;
    w.balance += reward;
    w.lifetime_earned += reward;
    w.transactions.unshift({ amount: reward, reason: `Reached level ${newLevel}`, created_date: new Date() });
    if (w.transactions.length > 50) w.transactions.length = 50;
    await w.save();
    return reward;
  } catch {
    return 0; // never break the XP grant on a wallet hiccup
  }
}

// ── GET /tension/me ─────────────────────────────────────────────────────────
router.get('/me', authMW, async (req, res) => {
  try {
    const p = await getOrCreate(req.user.id);
    res.json({
      profile: p,
      progress: progressForXp(p.xp),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tension/action ──────────────────────────────────────────────────
// Body: { source, reason?, ref_id? }
router.post('/action', authMW, async (req, res) => {
  try {
    const { source, reason, ref_id } = req.body || {};
    if (!ALLOWED_SOURCES.has(source)) {
      return res.status(400).json({ error: 'Invalid source' });
    }
    const result = await grantXp(req.user.id, source, reason, ref_id);
    let biomassReward = 0;
    if (result.leveledUp) {
      biomassReward = await grantLevelUpBiomass(req.user.id, result.toLevel);
    }
    res.json({ ...result, biomassReward });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
