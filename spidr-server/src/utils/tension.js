const TensionProfile = require('../models/TensionProfile');

/**
 * Server-side XP ("tension") helpers.
 *
 * Level curve: the cumulative XP required to REACH level L is
 *     totalXpForLevel(L) = round(100 * (L-1)^1.5)
 * so level 1 starts at 0, level 2 at 100, level 3 at ~283, level 4 at ~520, …
 * Gentle early, steeper later — comfortable for a chat app.
 *
 * Earning is server-authoritative and per-source daily-capped so XP can't be
 * farmed by spamming. Like utils/biomass.js, grant failures MUST NOT break the
 * action they're attached to — call sites wrap in try/catch.
 */

// Cumulative XP needed to have reached a given level.
function totalXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5));
}

// Given a lifetime XP value, what level is that?
function levelForXp(xp) {
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level += 1;
  return level;
}

// Progress breakdown for UI: current level, xp into this level, xp needed for
// next level, and a 0..1 fraction.
function progressForXp(xp) {
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceil = totalXpForLevel(level + 1);
  const intoLevel = xp - floor;
  const span = Math.max(1, ceil - floor);
  return {
    xp,
    level,
    xpIntoLevel: intoLevel,
    xpForNextLevel: ceil - floor,
    xpToNextLevel: Math.max(0, ceil - xp),
    fraction: Math.min(1, intoLevel / span),
    nextLevelAt: ceil,
  };
}

// XP awarded per action, and the max number of times per day each action earns.
const RULES = {
  message:     { xp: 5,  dailyMax: 40 },  // up to 200 xp/day from messages
  fly:         { xp: 10, dailyMax: 20 },  // up to 200 xp/day from flies
  voice_join:  { xp: 15, dailyMax: 8 },   // up to 120 xp/day from calls
  clip_post:   { xp: 20, dailyMax: 5 },   // up to 100 xp/day from clips
  daily_login: { xp: 25, dailyMax: 1 },   // 25 xp/day
  reaction:    { xp: 2,  dailyMax: 30 },
};

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function getOrCreate(userId) {
  let p = await TensionProfile.findOne({ user_id: userId });
  if (!p) p = await TensionProfile.create({ user_id: userId });
  return p;
}

function pushEvent(profile, amount, reason, ref_id) {
  profile.events.unshift({ amount, reason, ref_id, created_date: new Date() });
  if (profile.events.length > 50) profile.events.length = 50;
}

/**
 * Grant XP for an action. Returns { granted, leveledUp, fromLevel, toLevel,
 * progress } or { granted: 0, capped: true } when the daily cap is hit.
 *
 * `source` must be a key in RULES. `reason` is a human label for the log.
 */
async function grantXp(userId, source, reason, ref_id) {
  const rule = RULES[source];
  if (!userId || !rule) return { granted: 0 };

  const profile = await getOrCreate(userId);

  // Reset daily counters if the stored day changed.
  const today = dayKey();
  if (profile.daily_key !== today) {
    profile.daily_key = today;
    profile.daily_counts = new Map();
  }

  const used = profile.daily_counts.get(source) || 0;
  if (used >= rule.dailyMax) {
    return { granted: 0, capped: true, progress: progressForXp(profile.xp) };
  }

  const fromLevel = levelForXp(profile.xp);
  profile.xp += rule.xp;
  profile.daily_counts.set(source, used + 1);
  const toLevel = levelForXp(profile.xp);
  profile.level = toLevel;
  pushEvent(profile, rule.xp, reason || source, ref_id);
  await profile.save();

  return {
    granted: rule.xp,
    leveledUp: toLevel > fromLevel,
    fromLevel,
    toLevel,
    progress: progressForXp(profile.xp),
  };
}

module.exports = {
  totalXpForLevel,
  levelForXp,
  progressForXp,
  grantXp,
  getOrCreate,
  RULES,
};
