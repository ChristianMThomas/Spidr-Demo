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

// Base URL APNs/FCM can fetch images from over plain HTTP — never behind
// auth. Falls back to the known Railway origin so this doesn't silently
// break in an environment missing the env var.
const PUBLIC_BASE_URL =
  process.env.SERVER_URL || 'https://cooperative-simplicity-production-bb44.up.railway.app';
const DEFAULT_AVATAR_URL = `${PUBLIC_BASE_URL}/public/spidr-app-mobile.png`;

/**
 * APNs/FCM fetch avatar images from their own servers, so anything that isn't
 * a plain absolute http(s) URL is unusable: a `/uploads/...` path resolves to
 * nothing, and `data:`/`blob:` URIs can't be fetched at all. Absolutise what
 * we can and drop what we can't, so a bad value falls back to the Spidr logo
 * instead of silently delivering a banner with no avatar.
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${PUBLIC_BASE_URL}${trimmed}`;
  return null; // data:, blob:, bare filenames — not fetchable by APNs/FCM
}

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
    const { getMessaging } = require('firebase-admin/messaging');
    const creds = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.cert(creds) });
    // firebase-admin v12+ modular API — attach messaging() so downstream
    // callers can keep using admin.messaging().sendEachForMulticast(...).
    admin.messaging = () => getMessaging();
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
 *
 * `subtitle` is the middle line of the iOS three-line layout (sender /
 * context / message) — used for server mentions, where the context is the
 * server the mention happened in. Android has no subtitle slot, so it gets
 * folded into the title there.
 */
async function sendVisiblePush(userId, { title, body, subtitle, data = {}, image }) {
  const admin = getAdmin();
  if (!admin || !userId) return;

  const tokens = await PushToken.find({ user_id: userId, provider: 'fcm' }).lean();
  if (tokens.length === 0) return;

  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  }

  // Rich notification image — the sender's current pfp, falling back to the
  // Spidr logo so a signal never renders with no avatar at all.
  const imageUrl = normalizeImageUrl(image) || DEFAULT_AVATAR_URL;
  // FCM flattens `data` keys onto the raw APNs payload alongside `aps`, so
  // this is the ONLY reliable way to hand the URL to our own iOS
  // NotificationService extension (mobile/targets/notification-service) —
  // it reads this exact key via request.content.userInfo["image"].
  // notification.imageUrl below covers Android, which renders it natively
  // with no extension needed.
  stringData.image = imageUrl;
  // Mentions also carry the mentioner's own pfp so the extension can put a
  // person inside the group icon. Same fetchability rules apply — drop it
  // rather than hand the extension a URL it can't resolve.
  if (stringData.senderAvatar) {
    const senderAvatarUrl = normalizeImageUrl(stringData.senderAvatar);
    if (senderAvatarUrl) stringData.senderAvatar = senderAvatarUrl;
    else delete stringData.senderAvatar;
  }

  // Android collapses to two lines, so the context line rides along with the
  // title rather than being dropped.
  const androidTitle = subtitle ? `${title} · ${subtitle}` : title;
  const iosAlert = subtitle ? { title, subtitle, body } : { title, body };
  // Also send the subtitle as a plain data key. FCM merges the top-level
  // `notification` block into aps.alert, and that merge is the kind of thing
  // that can quietly drop a field — but data keys land in userInfo untouched.
  // The extension keys its group-vs-1:1 decision off THIS, not off aps, so a
  // mention can't silently render as a DM.
  if (subtitle) stringData.subtitle = subtitle;

  const res = await admin.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    data: stringData,
    notification: { title: androidTitle, body, imageUrl },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'default', imageUrl },
    },
    apns: {
      headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      // mutable-content triggers our NotificationService extension, which
      // reads the `image` data key above and rebuilds the banner as a
      // Communication Notification so the leading icon becomes the sender's
      // avatar (or the server's icon for a mention).
      // content-available keeps the JS onMessage handler firing while the
      // app is foregrounded, same as before this change.
      payload: {
        aps: { alert: iosAlert, sound: 'default', 'mutable-content': 1, 'content-available': 1 },
      },
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
