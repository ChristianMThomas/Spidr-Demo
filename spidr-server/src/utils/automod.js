'use strict';

// In-memory spam tracker: Map<serverId, Map<userId, number[]>> (message timestamps)
const spamTracker = new Map();

// Minimal built-in blocked word list. Admins extend via bot_config.automod.banned_words.
const DEFAULT_BLOCKED = [
  'nigger', 'nigga', 'faggot', 'fag', 'kike', 'chink', 'spic', 'wetback',
  'tranny', 'retard', 'cunt', 'twat',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recordMessage(serverId, userId) {
  if (!spamTracker.has(serverId)) spamTracker.set(serverId, new Map());
  const userMap = spamTracker.get(serverId);
  if (!userMap.has(userId)) userMap.set(userId, []);
  const timestamps = userMap.get(userId);
  timestamps.push(Date.now());
  if (timestamps.length > 100) timestamps.shift();
}

function checkContent(content, userId, serverId, cfg = {}) {
  const threshold = typeof cfg.spamThreshold === 'number' ? cfg.spamThreshold : 5;
  const windowMs = (typeof cfg.spamWindowSecs === 'number' ? cfg.spamWindowSecs : 10) * 1000;
  const customBanned = Array.isArray(cfg.banned_words) ? cfg.banned_words : [];
  const allowedSet = new Set(
    (Array.isArray(cfg.allowed_words) ? cfg.allowed_words : []).map(w => w.toLowerCase())
  );
  const slurFilterEnabled = cfg.slurFilter !== false;

  // Spam check
  const userMap = spamTracker.get(serverId);
  const timestamps = userMap?.get(userId) || [];
  const now = Date.now();
  const recent = timestamps.filter(t => now - t <= windowMs);
  if (recent.length >= threshold) {
    return { reason: 'spam', detail: `${threshold}+ messages in ${windowMs / 1000}s` };
  }

  // Word filter
  const allBanned = slurFilterEnabled
    ? [...DEFAULT_BLOCKED, ...customBanned]
    : [...customBanned];

  for (const word of allBanned) {
    if (allowedSet.has(word.toLowerCase())) continue;
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    if (pattern.test(content)) {
      return { reason: 'blocked word', detail: word };
    }
  }

  return null;
}

// Matches a server bot entry to the Auto Moderator regardless of whether
// bot_code was populated at install time (older installs may have it missing).
function isAutoModInstalled(server) {
  return (server?.bots || []).some(b =>
    b.bot_code === 'builtin:auto-moderator' ||
    b.name?.toLowerCase() === 'auto moderator'
  );
}

module.exports = { recordMessage, checkContent, isAutoModInstalled };
