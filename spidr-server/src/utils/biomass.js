const BiomassWallet = require('../models/BiomassWallet');

/**
 * Server-side helpers for granting biomass to users in response to actions.
 *
 * Called from message hooks, clip publish hooks, etc. Failures here MUST NOT
 * break the action they're attached to — wrap in try/catch at the call site.
 *
 * Rate-limit-style caps live here so users can't farm by spamming the action:
 *   - Message reward: max 50 biomass per user per day
 *   - Clip reward:    max 100 per clip, capped 200/day
 */
const DAILY_CAPS = {
  message: 50,    // 1 biomass per message, cap 50/day
  clip:    200,   // 100 per clip, cap 200/day
};

function startOfDay(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function todaysEarnings(wallet, reasonPrefix) {
  const dayStart = startOfDay();
  return wallet.transactions
    .filter(t => t.amount > 0 && t.reason?.startsWith(reasonPrefix) && new Date(t.created_date) >= dayStart)
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Grant biomass to a user. Returns null on failure (caller should swallow).
 *
 * @param {string} userId      User._id (as string)
 * @param {number} amount      positive integer
 * @param {string} reason      human label that will appear in the user's history
 * @param {string} [ref_id]    optional foreign key
 * @param {string} [cap_key]   if set, enforce DAILY_CAPS[cap_key]
 */
async function grant(userId, amount, reason, ref_id, cap_key) {
  if (!userId || !amount || amount <= 0) return null;
  try {
    let w = await BiomassWallet.findOne({ user_id: userId });
    if (!w) w = await BiomassWallet.create({ user_id: userId });

    // Enforce daily cap if requested
    if (cap_key && DAILY_CAPS[cap_key]) {
      const earnedToday = todaysEarnings(w, reason.split(':')[0]);
      const remaining = DAILY_CAPS[cap_key] - earnedToday;
      if (remaining <= 0) return { capped: true, granted: 0, balance: w.balance };
      if (amount > remaining) amount = remaining;
    }

    w.balance += amount;
    w.lifetime_earned += amount;
    w.transactions.unshift({ amount, reason, ref_id, created_date: new Date() });
    if (w.transactions.length > 50) w.transactions.length = 50;
    await w.save();
    return { granted: amount, balance: w.balance };
  } catch (err) {
    console.warn('Biomass grant failed:', err.message);
    return null;
  }
}

module.exports = { grant, DAILY_CAPS };
