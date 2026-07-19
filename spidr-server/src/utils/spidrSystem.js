/**
 * SPIDR SYSTEM — the platform's own account.
 *
 * Every user automatically has "Spidr System" as an accepted friend. It's the
 * notification center's face: important updates, patch notes, and alerts
 * arrive as DMs from this account. Think Discord's "System" user.
 *
 * - ensureSystemUser()        — idempotent boot-time upsert of the User +
 *                               UserProfile docs; caches the system user id.
 * - ensureSystemFriendship(u) — idempotent per-user upsert of BOTH reciprocal
 *                               Friend rows (accepted) + a one-time welcome DM.
 *                               Called from auth middleware (once per user per
 *                               process, guarded by an in-memory set) and the
 *                               scripts/add-spidr-system-friend.js backfill.
 * - sendSystemDM(userId, txt) — helper for future features (patch-note pushes,
 *                               moderation notices) to DM a user as the system.
 *
 * Friend rows are written with updateOne+upsert (NOT .save()) deliberately:
 * it dodges the Friend post-save hook so backfilling thousands of users
 * doesn't blast "now friends with Spidr System" events into everyone's feed,
 * and the unique (user_id, friend_id) index makes concurrent calls safe.
 */

const User          = require('../models/User');
const UserProfile   = require('../models/UserProfile');
const Friend        = require('../models/Friend');
const DirectMessage = require('../models/DirectMessage');
const crypto        = require('crypto');

const SYSTEM_EMAIL        = 'system@spidrapp.com';
const SYSTEM_USERNAME     = 'SPIDR_SYS';
const SYSTEM_DISPLAY_NAME = 'Spidr System';
// Default spidr icon — served verbatim from the deployed web client's public/
// folder, so it's a stable URL (Vite only hashes files under src/assets).
const SYSTEM_AVATAR_URL   = 'https://spidrapp.infinitetechteam.com/logo.png';
const SYSTEM_BIO          = 'Official Spidr network channel — updates, alerts, and patch notes land here. This account does not read replies.';

const WELCOME_MESSAGE = [
  '🕷️ SPIDR SYSTEM ONLINE',
  '',
  "Welcome to the web. I'm the network's official channel — patch notes, feature drops, and important account alerts will arrive in this DM.",
  '',
  'No action needed. Stay tangled.',
].join('\n');

let systemUserId = null;          // cached after first ensureSystemUser()
const ensuredThisProcess = new Set(); // user ids already checked since boot

function dmConversationId(a, b) {
  // Same convention the socket handlers + clients use: sorted join.
  return [String(a), String(b)].sort().join('-');
}

async function ensureSystemUser() {
  if (systemUserId) return systemUserId;

  let user = await User.findOne({ email: SYSTEM_EMAIL }).select('_id').lean();
  if (!user) {
    // Random password hash-alike — this account can never log in through
    // spidr-auth (it has no OTP-verified flow), the field just satisfies
    // the schema's `required`.
    const created = await User.create({
      email:       SYSTEM_EMAIL,
      password:    crypto.randomBytes(48).toString('hex'),
      username:    SYSTEM_USERNAME,
      full_name:   SYSTEM_DISPLAY_NAME,
      avatar_url:  SYSTEM_AVATAR_URL,
      bio:         SYSTEM_BIO,
      is_verified: true,
      role:        'system',
    });
    user = { _id: created._id };
    console.log(`[spidr-system] Created system user ${created._id}`);
  }

  const uid = user._id.toString();

  await UserProfile.updateOne(
    { user_id: uid },
    {
      $set: {
        display_name: SYSTEM_DISPLAY_NAME,
        avatar_url:   SYSTEM_AVATAR_URL,
        bio:          SYSTEM_BIO,
        status:       'online',
      },
      $setOnInsert: { user_id: uid },
    },
    { upsert: true },
  );

  systemUserId = uid;
  return uid;
}

async function sendSystemDM(userId, content) {
  const sysId = await ensureSystemUser();
  const doc = await DirectMessage.create({
    sender_id:       sysId,
    receiver_id:     String(userId),
    recipient_id:    String(userId),
    conversation_id: dmConversationId(sysId, userId),
    sender_name:     SYSTEM_DISPLAY_NAME,
    sender_avatar:   SYSTEM_AVATAR_URL,
    content,
  });

  // Live delivery — wake the DM thread (if the user has it open) and every
  // tab/device via the per-user room, so system signals land instantly like
  // any other DM instead of waiting for the next refetch.
  try {
    const { emitToRoom, emitToUser } = require('./realtime');
    const { _id, __v, ...rest } = doc.toObject();
    const out = { id: _id.toString(), ...rest };
    emitToRoom(`dm:${doc.conversation_id}`, 'dm:new', out);
    emitToUser(String(userId), 'dm:notification', out);
  } catch { /* socket layer optional — never block the write */ }

  return doc;
}

async function ensureSystemFriendship(userId) {
  const uid = String(userId || '');
  if (!uid) return;

  const sysId = await ensureSystemUser();
  if (uid === sysId) return;
  if (ensuredThisProcess.has(uid)) return;
  ensuredThisProcess.add(uid);

  // Mirror fields for the user→system row so clients render name/avatar
  // without a profile lookup even before the profiles query lands.
  const userSide = await Friend.updateOne(
    { user_id: uid, friend_id: sysId },
    {
      $setOnInsert: {
        user_id:       uid,
        friend_id:     sysId,
        status:        'accepted',
        friend_name:   SYSTEM_DISPLAY_NAME,
        friend_avatar: SYSTEM_AVATAR_URL,
      },
    },
    { upsert: true },
  );

  const profile = await UserProfile.findOne({ user_id: uid })
    .select('display_name avatar_url').lean();
  await Friend.updateOne(
    { user_id: sysId, friend_id: uid },
    {
      $setOnInsert: {
        user_id:       sysId,
        friend_id:     uid,
        status:        'accepted',
        friend_name:   profile?.display_name || '',
        friend_avatar: profile?.avatar_url || '',
      },
    },
    { upsert: true },
  );

  // Welcome DM only on the FIRST time the friendship is created — repeat
  // boots hit the existing rows (upsertedCount 0) and stay silent.
  if (userSide.upsertedCount > 0) {
    try {
      await sendSystemDM(uid, WELCOME_MESSAGE);
      console.log(`[spidr-system] Welcomed user ${uid}`);
    } catch (err) {
      console.warn(`[spidr-system] Welcome DM failed for ${uid}:`, err.message);
    }
  }
}

/**
 * Announce the newest patch note as a Spidr System DM to every user, once per
 * patch id. Called on boot after Mongo connects; the SystemState marker makes
 * repeat boots (and multi-instance deploys racing each other) near-idempotent.
 */
async function announceLatestPatch(latest) {
  if (!latest?.id || !latest?.title) return;
  const SystemState = require('../models/SystemState');
  const KEY = 'last_announced_patch_id';

  const state = await SystemState.findOne({ key: KEY }).lean();
  if (state?.value === latest.id) return;

  // Claim the marker BEFORE fanning out — if two instances boot at once only
  // the loser re-sends, and a crash mid-fanout doesn't re-DM everyone forever.
  await SystemState.updateOne({ key: KEY }, { $set: { value: latest.id } }, { upsert: true });

  const sysId = await ensureSystemUser();
  const message = [
    `📡 ${latest.title}`,
    '',
    'A new update just landed on the web. Open Settings → About to read the full patch log.',
  ].join('\n');

  const users = await User.find({ _id: { $ne: sysId } }).select('_id').lean();
  let sent = 0;
  for (const u of users) {
    try {
      await sendSystemDM(u._id.toString(), message);
      sent++;
    } catch { /* one bad user must not stop the fanout */ }
  }
  console.log(`[spidr-system] Announced ${latest.id} to ${sent}/${users.length} users`);
}

module.exports = {
  ensureSystemUser,
  ensureSystemFriendship,
  sendSystemDM,
  announceLatestPatch,
  SYSTEM_EMAIL,
  SYSTEM_USERNAME,
  SYSTEM_DISPLAY_NAME,
  SYSTEM_AVATAR_URL,
};
