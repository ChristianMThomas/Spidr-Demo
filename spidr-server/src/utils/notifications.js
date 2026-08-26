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
  server_mention:  'server_mentions',
  friend_request:  'friend_requests',
  voice_call:      'voice_calls',
  call_ended:      'voice_calls',   // gated same as the ring itself
  group_message:   'group_messages',
};

// Default = ON for all types; explicit `false` in prefs is the only way to
// suppress. New users with no prefs saved get pushes for everything.
function getPref(prefs, key) {
  if (!prefs) return true;
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

    if (isMasterOff(prefs)) return { sent: false, reason: 'master_off' };
    if (!getPref(prefs, key)) return { sent: false, reason: 'type_off' };

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
