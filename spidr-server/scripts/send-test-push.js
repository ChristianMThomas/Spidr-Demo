#!/usr/bin/env node
/**
 * send-test-push.js — prove the server half of push without placing a call.
 *
 * Sends straight through firebase-admin (not utils/push.js) so every
 * per-token FCM/APNs response is printed instead of swallowed — which is the
 * only way to tell "no token registered" apart from "APNs rejected us".
 *
 * Usage:
 *   node scripts/send-test-push.js you@example.com              banner + sound
 *   node scripts/send-test-push.js you@example.com --call       incoming-call data push
 *   node scripts/send-test-push.js <user_id> --call
 *   node scripts/send-test-push.js --token <fcm_token>          skip the DB lookup
 *
 * Reads FIREBASE_SERVICE_ACCOUNT + MONGO_URI from the same .env the server uses.
 */
require('dotenv').config();
const mongoose = require('mongoose');

// APNs/FCM rejection codes worth translating — these are the ones that show
// up while an iOS push setup is still half-configured.
const HINTS = {
  'messaging/third-party-auth-error':
    'APNs rejected the credential — the .p8 APNs key is missing from Firebase (Cloud Messaging → APNs Authentication Key), or its Key ID / Team ID is wrong.',
  'messaging/registration-token-not-registered':
    'The device token is dead (app deleted, or built with a different bundle id). Re-register from the device.',
  'messaging/invalid-argument':
    'Malformed token or payload — usually a token captured from a different Firebase project.',
  'messaging/mismatched-credential':
    'This token belongs to a different Firebase project than the service account.',
};

function getAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set — the server cannot push at all yet.');
    process.exit(1);
  }
  const admin = require('firebase-admin');
  const creds = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  admin.initializeApp({ credential: admin.credential.cert(creds) });
  console.log(`Firebase project: ${creds.project_id}`);
  return admin;
}

async function resolveTokens(target) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/spidr';
  await mongoose.connect(uri);

  const PushToken = require('../src/models/PushToken');
  const User = require('../src/models/User');

  let userId = target;
  if (target.includes('@')) {
    const user = await User.findOne({ email: target.toLowerCase() }).lean();
    if (!user) {
      console.error(`No user found with email "${target}"`);
      process.exit(1);
    }
    userId = user._id.toString();
    console.log(`User: ${target} → ${userId}`);
  }

  const rows = await PushToken.find({ user_id: userId }).lean();
  if (rows.length === 0) {
    console.error('No PushToken rows for this user. The device has never registered —');
    console.error('open the app, turn Notifications on in Settings → Signal Control, and');
    console.error('watch for "[callManager.registerToken] POST /push-tokens/register".');
    process.exit(1);
  }
  console.log(`${rows.length} registered device(s):`);
  for (const r of rows) {
    console.log(`  ${r.platform}/${r.provider}  ${r.token.slice(0, 24)}...(${r.token.length} chars)`);
  }
  return rows.map((r) => r.token);
}

async function main() {
  const args = process.argv.slice(2);
  const asCall = args.includes('--call');
  const tokenFlag = args.indexOf('--token');
  const target = args.find((a) => !a.startsWith('--'));

  let tokens;
  if (tokenFlag !== -1) {
    const raw = args[tokenFlag + 1];
    if (!raw) {
      console.error('--token needs a value');
      process.exit(1);
    }
    tokens = [raw];
  } else if (target) {
    tokens = await resolveTokens(target);
  } else {
    console.error('Usage: node scripts/send-test-push.js <email|user_id> [--call]');
    console.error('   or: node scripts/send-test-push.js --token <fcm_token> [--call]');
    process.exit(1);
  }

  const admin = getAdmin();

  // Mirrors utils/push.js exactly: --call is the data-only high-priority ring
  // CallKeep consumes, the default is the hybrid alert a DM would send.
  const message = asCall
    ? {
        tokens,
        data: {
          type: 'incoming_call',
          conversationId: 'test-conversation',
          kind: 'voice',
          callerId: 'test-caller',
          callerName: 'Push Test',
          callerAvatar: '',
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
          payload: {
            aps: {
              alert: { title: 'Push Test', body: 'Incoming call (test)' },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      }
    : {
        tokens,
        data: { type: 'test' },
        notification: { title: 'Spidr', body: 'Test push — the server half works.' },
        android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
          payload: {
            aps: {
              alert: { title: 'Spidr', body: 'Test push — the server half works.' },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };

  console.log(`\nSending ${asCall ? 'CALL (data-only ring)' : 'VISIBLE (banner)'} push to ${tokens.length} token(s)...\n`);
  const res = await admin.messaging().sendEachForMulticast(message);

  res.responses.forEach((r, i) => {
    const short = `${tokens[i].slice(0, 24)}...`;
    if (r.success) {
      console.log(`  ✓ ${short}  messageId=${r.messageId}`);
    } else {
      const code = r.error?.code || 'unknown';
      console.log(`  ✗ ${short}  ${code}`);
      console.log(`     ${r.error?.message || ''}`);
      if (HINTS[code]) console.log(`     → ${HINTS[code]}`);
    }
  });

  console.log(`\n${res.successCount} sent, ${res.failureCount} failed.`);
  if (res.successCount > 0) {
    console.log('A successful send means FCM accepted it. If nothing appears on the');
    console.log('device, the remaining suspects are the app build (permission not');
    console.log('granted, wrong bundle id) — not the server.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
