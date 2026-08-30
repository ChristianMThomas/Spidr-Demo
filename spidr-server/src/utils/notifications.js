/**
 * Push notification broker — the single gate every non-socket push flows
 * through so per-user prefs, DND, and close-friend breakthrough are enforced
 * in ONE place instead of scattered across route handlers.
 *
 * Call sites keep emitting their existing socket events; this broker is
 * additive (push-only). If a push should be dropped, the socket signal still
 * fires — the recipient just won't get a native banner/ring.
 *
 * Signal → prefs key map lives at SIGNAL_TO_KEY. Adding a new signal type =
 * add its key here + call notifications.dispatch(type, recipientId, payload).
 */
const UserProfile = require('../models/UserProfile');
const Friend = require('../models/Friend');
const push = require('./push');

const SIGNAL_TO_KEY = {
  dm:              'dm',
  // Server and group traffic each have one on/off key covering both their
  // every-message signal and their mention signal. Narrowing to mentions is a
  // separate, deliberate switch (MENTIONS_ONLY_KEY) rather than a second
  // master — turning a surface off should mean off.
  server_message:  'server_messages',
  server_mention:  'server_messages',
  group_message:   'group_messages',
  group_mention:   'group_messages',
  friend_request:  'friend_requests',
  voice_call:      'voice_calls',
  call_ended:      'voice_calls',   // gated same as the ring itself
};

// "@mentions only" switches. Each drops its surface's every-message signal
// and leaves the mention twin alone — that's the whole point of the switch.
const MENTIONS_ONLY_KEY = {
  server_message: 'server_mentions_only',
  group_message:  'group_mentions_only',
};

// Pref keys renamed when server pushes went from mentions-only to
// every-message. Read the old key when the new one was never written, so a
// user who had already opted out doesn't get silently opted back in.
const LEGACY_KEY = {
  server_messages: 'server_mentions',
};

// Signals that can be overridden per-conversation, and where to look: the
// prefs map holding the overrides, and the opts field carrying the id.
const SCOPED_SIGNALS = {
  server_message: { map: 'server_overrides', idField: 'serverId', broad: true },
  server_mention: { map: 'server_overrides', idField: 'serverId', broad: false },
  group_message:  { map: 'group_overrides',  idField: 'groupId',  broad: true },
  group_mention:  { map: 'group_overrides',  idField: 'groupId',  broad: false },
};

/**
 * Per-conversation override, keyed by server/group id on the same profile doc
 * the broker already loads — so muting one of them costs no extra query.
 *
 *   'all'      — every message, even if the global switch says mentions-only
 *   'mentions' — only messages that name you
 *   'none'     — muted outright
 *
 * Absent = inherit the global switches. Anything else is treated as absent
 * rather than trusted, since these maps are written by clients.
 */
function scopeOverride(prefs, signalType, opts) {
  const scope = SCOPED_SIGNALS[signalType];
  if (!scope || !prefs) return null;
  const id = opts?.[scope.idField];
  if (!id) return null;
  const map = prefs[scope.map];
  if (!map || typeof map !== 'object') return null;
  const mode = map[String(id)];
  return mode === 'all' || mode === 'mentions' || mode === 'none' ? mode : null;
}

// Default = ON for all types; explicit `false` in prefs is the only way to
// suppress. New users with no prefs saved get pushes for everything.
function getPref(prefs, key) {
  if (!prefs) return true;
  if (prefs[key] === undefined && LEGACY_KEY[key]) {
    return prefs[LEGACY_KEY[key]] !== false;
  }
  return prefs[key] !== false;
}

function isMasterOff(prefs) {
  return prefs && prefs.enabled === false;
}

function isDndActive(profile) {
  if (!profile || profile.status !== 'dnd') return false;
  const exp = profile.status_expires_at;
  if (!exp) return true; // manual DND with no timer
  return new Date(exp).getTime() > Date.now();
}

async function isCloseFriend(recipientId, senderId) {
  if (!senderId) return false;
  const row = await Friend.findOne({
    user_id: recipientId,
    friend_id: senderId,
    status: 'accepted',
    is_close_friend: true,
  }).select('_id').lean();
  return !!row;
}

/**
 * Decide + send. Returns { sent: bool, reason?: string } — the reason is
 * useful for temporary debug logging but callers can ignore it entirely.
 */
async function dispatch(signalType, recipientId, payload, opts = {}) {
  if (!recipientId) return { sent: false, reason: 'no_recipient' };
  const key = SIGNAL_TO_KEY[signalType];
  if (!key) return { sent: false, reason: 'unknown_signal' };

  try {
    const profile = await UserProfile.findOne({ user_id: recipientId })
      .select('notification_prefs status status_expires_at').lean();
    const prefs = profile?.notification_prefs || null;

    // The master switch beats everything, including a per-server 'all'.
    if (isMasterOff(prefs)) return { sent: false, reason: 'master_off' };

    const override = scopeOverride(prefs, signalType, opts);

    if (override === 'none') return { sent: false, reason: 'scope_muted' };
    if (override === 'mentions' && SCOPED_SIGNALS[signalType]?.broad) {
      return { sent: false, reason: 'scope_mentions_only' };
    }

    // An explicit per-server/per-group choice is the more specific
    // instruction, so it wins over the global type toggle and the global
    // mentions-only switch for that one conversation. No override = inherit.
    if (!override) {
      if (!getPref(prefs, key)) return { sent: false, reason: 'type_off' };
      const onlyKey = MENTIONS_ONLY_KEY[signalType];
      if (onlyKey && prefs?.[onlyKey] === true) {
        return { sent: false, reason: 'mentions_only' };
      }
    }

    if (isDndActive(profile)) {
      const suppress = prefs?.dnd_suppress !== false; // default: DND suppresses
      if (suppress) {
        const urgent = prefs?.urgent_dms === true;
        if (!urgent) return { sent: false, reason: 'dnd' };
        const close = await isCloseFriend(recipientId, opts.senderId);
        if (!close) return { sent: false, reason: 'dnd_not_close' };
      }
    }

    // Route by signal shape: calls use the hybrid alert+data path so CallKit
    // still hooks in; everything else is a visible-only banner.
    if (signalType === 'voice_call') {
      await push.sendCallPush(recipientId, payload);
    } else if (signalType === 'call_ended') {
      await push.sendCallEndPush(recipientId, payload);
    } else {
      await push.sendVisiblePush(recipientId, payload);
    }
    return { sent: true };
  } catch (err) {
    console.warn('[notifications] dispatch failed:', err?.message);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { dispatch };
