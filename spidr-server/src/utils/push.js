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
 * Send a push to every registered device of a user.
 * `data` values must all be strings (FCM requirement) — stringify here.
 * Invalid/expired tokens are pruned as FCM reports them.
 *
 * iOS: HYBRID push — includes an `alert` block (so a visible banner + sound
 * fires even when the app is force-closed or the phone is locked) AND
 * `content-available: 1` so the FCM background handler still runs when the
 * app is alive, letting callManager handle dedupe + CallKit invocation.
 *
 * Android: pure data-only high-priority — the FCM background handler in
 * index.js turns it into a native ConnectionService ring via CallKeep, which
 * is what actually rings the lock screen on Android.
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

  const isIncoming = data.type === 'incoming_call';
  const callerName = data.callerName || 'Someone';
  const isVideo = data.kind === 'video';
  const iosAlert = isIncoming
    ? {
        title: isVideo ? 'Incoming Spidr video call' : 'Incoming Spidr call',
        body: `${callerName} is calling…`,
      }
    : null; // call_ended pushes stay silent

  const apnsPayload = { aps: { 'content-available': 1 } };
  if (iosAlert) {
    apnsPayload.aps.alert = iosAlert;
    apnsPayload.aps.sound = 'default';
    apnsPayload.aps.category = 'INCOMING_CALL';
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    data: stringData,
    android: { priority: 'high', ttl: 45 * 1000 }, // a ring is stale fast
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': iosAlert ? 'alert' : 'background',
      },
      payload: apnsPayload,
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

/**
 * Send a visible push (banner + sound) that is NOT a call ring.
 * Used for DMs, mentions, friend requests, etc. — anything that should
 * wake the lock screen with a normal notification, not CallKit.
 *
 * `data` fuels the mobile handlePushData deep-link. `notification` fuels
 * the OS-native tray entry so the banner still fires when the app is dead.
 */
async function sendVisiblePush(userId, { title, body, data = {} }) {
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
    notification: { title, body },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'default' },
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      payload: { aps: { alert: { title, body }, sound: 'default', 'content-available': 1 } },
    },
  });

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

module.exports = { sendDataPush, sendVisiblePush, sendCallPush, sendCallEndPush };
