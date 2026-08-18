/**
 * Push notification sender (FCM via firebase-admin).
 *
 * Configured with FIREBASE_SERVICE_ACCOUNT — the base64-encoded JSON of a
 * Firebase service-account key. When unset (local dev without push), every
 * send is a silent no-op so calls still work socket-to-socket.
 *
 * Call pushes are DATA-ONLY, high-priority messages: the app (foreground or
 * headless background handler) turns them into the native incoming-call UI
 * via CallKeep. A "notification" payload would show a passive banner instead
 * of ringing, which is exactly what we don't want.
 */
const PushToken = require('../models/PushToken');

let _admin = null;
let _initFailed = false;

function getAdmin() {
  if (_admin || _initFailed) return _admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    _initFailed = true;
    console.warn('Push disabled: FIREBASE_SERVICE_ACCOUNT not set');
    return null;
  }
  try {
    const admin = require('firebase-admin');
    const creds = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    _admin = admin;
  } catch (err) {
    _initFailed = true;
    console.warn('Push disabled: firebase-admin init failed:', err.message);
  }
  return _admin;
}

/**
 * Send a data-only push to every registered device of a user.
 * `data` values must all be strings (FCM requirement) — stringify here.
 * Invalid/expired tokens are pruned as FCM reports them.
 */
async function sendDataPush(userId, data) {
  const admin = getAdmin();
  if (!admin || !userId) return;

  const tokens = await PushToken.find({ user_id: userId, provider: 'fcm' }).lean();
  if (tokens.length === 0) return;

  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    data: stringData,
    android: { priority: 'high', ttl: 45 * 1000 }, // a ring is stale fast
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { 'content-available': 1 } },
    },
  });

  // Prune tokens FCM says are dead so we stop paying for them.
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
      dead.push(tokens[i].token);
    }
  });
  if (dead.length) {
    await PushToken.deleteMany({ token: { $in: dead } }).catch(() => {});
  }
}

/** Ring a user's devices for an incoming call. */
function sendCallPush(recipientId, { conversationId, caller, kind }) {
  return sendDataPush(recipientId, {
    type: 'incoming_call',
    conversationId,
    kind: kind || 'voice',
    callerId: caller?.id || '',
    callerName: caller?.name || 'Spidr',
    callerAvatar: caller?.avatar || '',
  }).catch((err) => console.warn('call push failed:', err.message));
}

/** Stop the ring on a user's devices (caller cancelled / answered elsewhere). */
function sendCallEndPush(recipientId, { conversationId, reason }) {
  return sendDataPush(recipientId, {
    type: 'call_ended',
    conversationId,
    reason: reason || 'cancelled',
  }).catch((err) => console.warn('call-end push failed:', err.message));
}

module.exports = { sendDataPush, sendCallPush, sendCallEndPush };
