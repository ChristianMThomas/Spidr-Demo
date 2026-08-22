const express = require('express');
const authMW = require('../middleware/auth');
const User = require('../models/User');

/**
 * Account management — self-service delete + platform-admin moderation.
 *
 *   DELETE /account/me          — user deletes their OWN account (irreversible)
 *   POST   /account/admin/ban   — platform admin bans a user (is_banned=true;
 *                                  the login route already refuses banned users)
 *   POST   /account/admin/unban
 *   DELETE /account/admin/:id   — platform admin deletes another user
 *   GET    /account/admin/users — platform admin lists all users
 *
 * A user is a PLATFORM ADMIN when User.role === 'admin' (existing schema
 * field; default 'user'). Only platform admins pass the requirePlatformAdmin
 * check — server owners and moderators get server-scoped powers via the
 * existing kick/ban routes, not global ones.
 */

const router = express.Router();

// ── Delete cascade — every collection that stores user-authored data ────────
// Each entry: { modelName, filter(userId) → mongo query }. Kept explicit
// (rather than "sweep every model with user_id") so a future model with a
// non-standard ownership field can't silently escape the delete.
const DELETE_CASCADE = [
  ['UserProfile',     (uid) => ({ user_id: uid })],
  ['BiomassWallet',   (uid) => ({ user_id: uid })],
  ['EngagementProfile', (uid) => ({ user_id: uid })],
  ['TensionProfile',  (uid) => ({ user_id: uid })],
  ['Friend',          (uid) => ({ $or: [{ user_id: uid }, { friend_id: uid }] })],
  ['Follow',          (uid) => ({ $or: [{ follower_id: uid }, { following_id: uid }] })],
  ['DirectMessage',   (uid) => ({ $or: [{ sender_id: uid }, { recipient_id: uid }, { receiver_id: uid }] })],
  ['GroupChat',       (uid) => ({ owner_id: uid })], // owned groups die; non-owned handled below
  ['GroupChatMessage',(uid) => ({ user_id: uid })],
  ['Message',         (uid) => ({ $or: [{ user_id: uid }, { author_id: uid }] })],
  ['Clip',            (uid) => ({ author_id: uid })],
  ['Comment',         (uid) => ({ $or: [{ author_id: uid }, { user_id: uid }] })],
  ['Feed',            (uid) => ({ user_id: uid })],
  ['FeedComment',     (uid) => ({ author_id: uid })],
  ['Collection',      (uid) => ({ user_id: uid })],
  ['CommunityAsset',  (uid) => ({ $or: [{ user_id: uid }, { author_id: uid }] })],
  ['Module',          (uid) => ({ author_id: uid })],
  ['InstalledModule', (uid) => ({ user_id: uid })],
  ['CustomBot',       (uid) => ({ $or: [{ owner_id: uid }, { author_id: uid }] })],
  ['PushToken',       (uid) => ({ user_id: uid })],
  ['AudioTrack',      (uid) => ({ user_id: uid })],
  ['SavedAudio',      (uid) => ({ user_id: uid })],
  ['Report',          (uid) => ({ $or: [
    { reporter_id: uid },
    { target_id: uid, target_type: 'user' },
    { reviewer_id: uid },
    { resolved_by: uid },
  ] })],
  ['VoiceSession',    (uid) => ({ user_id: uid })],
  ['Event',           (uid) => ({ $or: [{ created_by: uid }, { creator_id: uid }] })],
  ['DJSession',       (uid) => ({ host_id: uid })],
  ['WebMessage',      (uid) => ({ $or: [{ sender_id: uid }, { recipient_id: uid }] })],
  ['AIChatLog',       (uid) => ({ user_id: uid })],
  ['AIConversation',  (uid) => ({ user_id: uid })],
];

async function deleteUserData(userId) {
  const results = {};
  for (const [modelName, buildQuery] of DELETE_CASCADE) {
    try {
      const Model = require(`../models/${modelName}`);
      const r = await Model.deleteMany(buildQuery(userId));
      results[modelName] = r.deletedCount || 0;
    } catch (err) {
      results[modelName] = `error: ${err.message}`;
    }
  }
  // Remove the user from every server's members / banned_users / muted_members.
  try {
    const Server = require('../models/Server');
    await Server.updateMany(
      {},
      { $pull: {
        members:       { user_id: userId },
        banned_users:  userId,
        muted_members: userId,
      } }
    );
    // Delete servers owned by this user
    const owned = await Server.deleteMany({ owner_id: userId });
    results.Server = owned.deletedCount || 0;
  } catch (err) { results.Server = `error: ${err.message}`; }
  // Remove from every group's member list (both shapes: objects + legacy [String] ids)
  try {
    const GroupChat = require('../models/GroupChat');
    await GroupChat.updateMany({}, { $pull: {
      members:    { user_id: userId },
      member_ids: userId,
    } });
  } catch {}
  // Prune the user from social-engagement arrays on other users' content so
  // like counts / relay counts / attendee lists stay accurate after deletion.
  try {
    const Clip = require('../models/Clip');
    await Clip.updateMany({}, { $pull: { likes: userId, relays: userId } });
  } catch {}
  try {
    const Feed = require('../models/Feed');
    await Feed.updateMany({}, { $pull: { likes: userId, recipient_ids: userId } });
    // Reactions is a Mixed { emoji: [user_id, …] } map — pull the user id from
    // every emoji bucket in one pass. $[] with $pull on Mixed needs the array
    // path to be spelled out at read-time; keep it simple with a per-doc pass
    // only if a doc actually has reactions (cheap: skip docs with empty map).
    const withReacts = await Feed.find({ reactions: { $exists: true, $ne: {} } }, { reactions: 1 }).lean();
    for (const f of withReacts) {
      const r = f.reactions || {};
      let dirty = false;
      for (const emoji of Object.keys(r)) {
        if (Array.isArray(r[emoji]) && r[emoji].includes(userId)) {
          r[emoji] = r[emoji].filter(u => u !== userId);
          dirty = true;
        }
      }
      if (dirty) await Feed.updateOne({ _id: f._id }, { $set: { reactions: r } });
    }
  } catch {}
  try {
    const Event = require('../models/Event');
    await Event.updateMany({}, { $pull: { attendees: userId } });
  } catch {}
  // NOTE: ServerAuditLog.actor_id intentionally NOT swept — audit trail must
  // survive account deletion so past moderation actions remain attributable.
  // Finally the User record itself
  try {
    const r = await User.deleteOne({ _id: userId });
    results.User = r.deletedCount || 0;
  } catch (err) { results.User = `error: ${err.message}`; }
  return results;
}

// ── Platform admin guard ────────────────────────────────────────────────────
function requirePlatformAdmin(req, res, next) {
  User.findById(req.user?.id).lean().then((u) => {
    if (u?.role === 'admin' || u?.is_admin === true) return next();
    return res.status(403).json({ error: 'Platform admin only' });
  }).catch(() => res.status(500).json({ error: 'Admin check failed' }));
}

// ── DELETE /account/me — user deletes their own account ────────────────────
router.delete('/me', authMW, async (req, res) => {
  try {
    const results = await deleteUserData(req.user.id);
    res.json({ ok: true, deleted: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: list users ──────────────────────────────────────────────────────
router.get('/admin/users', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const filter = q ? { $or: [
      { username: { $regex: q, $options: 'i' } },
      { email:    { $regex: q, $options: 'i' } },
      { full_name:{ $regex: q, $options: 'i' } },
    ]} : {};
    const users = await User.find(filter, {
      username: 1, email: 1, full_name: 1, role: 1, is_admin: 1,
      is_banned: 1, created_date: 1, avatar_url: 1,
    }).sort('-created_date').limit(200).lean();
    res.json(users.map(u => ({ ...u, id: u._id.toString() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: ban / unban ─────────────────────────────────────────────────────
router.post('/admin/ban', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    const { userId, reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (userId === req.user.id) return res.status(400).json({ error: "Can't ban yourself" });
    await User.updateOne({ _id: userId }, { $set: { is_banned: true, ban_reason: reason || '' } });
    // Optional: kick their active sockets
    try {
      const io = req.app.get('io');
      io?.emit('platform:banned', { userId });
    } catch {}
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.post('/admin/unban', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await User.updateOne({ _id: userId }, { $set: { is_banned: false }, $unset: { ban_reason: '' } });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Admin: delete a user (irreversible) ────────────────────────────────────
router.delete('/admin/:id', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Use /account/me for self-delete' });
    const results = await deleteUserData(req.params.id);
    res.json({ ok: true, deleted: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: sweep orphaned rows referencing deleted users ───────────────────
// Legacy orphans exist from accounts deleted before the current cascade
// (or deleted directly in Atlas). This removes Friend / DirectMessage /
// GroupChatMessage rows pointing to non-existent users and prunes deleted
// members from every GroupChat. Safe to re-run — idempotent.
router.post('/admin/sweep-orphans', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    const results = await sweepOrphans();
    res.json({ ok: true, swept: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function sweepOrphans() {
  const results = {};
  const liveIds = new Set(
    (await User.find({}, { _id: 1 }).lean()).map(u => u._id.toString())
  );
  const orphan = (id) => id && !liveIds.has(id.toString());

  // Friend — either side references a dead user
  try {
    const Friend = require('../models/Friend');
    const rows = await Friend.find({}, { user_id: 1, friend_id: 1 }).lean();
    const dead = rows.filter(r => orphan(r.user_id) || orphan(r.friend_id)).map(r => r._id);
    if (dead.length) await Friend.deleteMany({ _id: { $in: dead } });
    results.Friend = dead.length;
  } catch (err) { results.Friend = `error: ${err.message}`; }

  // DirectMessage — either participant is dead
  try {
    const DirectMessage = require('../models/DirectMessage');
    const rows = await DirectMessage.find({}, { sender_id: 1, recipient_id: 1, receiver_id: 1 }).lean();
    const dead = rows.filter(r => orphan(r.sender_id) || orphan(r.recipient_id) || orphan(r.receiver_id)).map(r => r._id);
    if (dead.length) await DirectMessage.deleteMany({ _id: { $in: dead } });
    results.DirectMessage = dead.length;
  } catch (err) { results.DirectMessage = `error: ${err.message}`; }

  // GroupChatMessage — author is dead
  try {
    const GroupChatMessage = require('../models/GroupChatMessage');
    const rows = await GroupChatMessage.find({}, { user_id: 1 }).lean();
    const dead = rows.filter(r => orphan(r.user_id)).map(r => r._id);
    if (dead.length) await GroupChatMessage.deleteMany({ _id: { $in: dead } });
    results.GroupChatMessage = dead.length;
  } catch (err) { results.GroupChatMessage = `error: ${err.message}`; }

  // GroupChat.members[] — prune dead members from every group
  try {
    const GroupChat = require('../models/GroupChat');
    const groups = await GroupChat.find({}, { members: 1 }).lean();
    let pruned = 0;
    for (const g of groups) {
      const dead = (g.members || []).filter(m => orphan(m.user_id)).map(m => m.user_id);
      if (dead.length) {
        await GroupChat.updateOne({ _id: g._id }, { $pull: { members: { user_id: { $in: dead } } } });
        pruned += dead.length;
      }
    }
    results.GroupChatMembers = pruned;
  } catch (err) { results.GroupChatMembers = `error: ${err.message}`; }

  // Server.members[] / banned_users[] — prune dead users from every server,
  // and delete servers whose owner no longer exists (matches the live delete
  // cascade so legacy owner-less servers get cleaned up too).
  try {
    const Server = require('../models/Server');
    const servers = await Server.find({}, { members: 1, banned_users: 1, owner_id: 1 }).lean();
    let prunedMembers = 0;
    let prunedBans = 0;
    for (const s of servers) {
      const deadMembers = (s.members || []).filter(m => orphan(m.user_id)).map(m => m.user_id);
      const deadBans    = (s.banned_users || []).filter(orphan);
      const ops = {};
      if (deadMembers.length) ops.members = { user_id: { $in: deadMembers } };
      if (deadBans.length)    ops.banned_users = { $in: deadBans };
      if (Object.keys(ops).length) {
        await Server.updateOne({ _id: s._id }, { $pull: ops });
        prunedMembers += deadMembers.length;
        prunedBans    += deadBans.length;
      }
    }
    results.ServerMembers = prunedMembers;
    results.ServerBans    = prunedBans;

    const ownerless = servers.filter(s => orphan(s.owner_id)).map(s => s._id);
    if (ownerless.length) {
      const r = await Server.deleteMany({ _id: { $in: ownerless } });
      results.Server = r.deletedCount || 0;
    } else {
      results.Server = 0;
    }
  } catch (err) { results.Server = `error: ${err.message}`; }

  return results;
}

// ── Admin: grant / revoke platform admin ───────────────────────────────────
router.post('/admin/role', authMW, requirePlatformAdmin, async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    if (!userId || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'userId + role (user|admin) required' });
    }
    await User.updateOne({ _id: userId }, { $set: { role, is_admin: role === 'admin' } });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
module.exports.sweepOrphans = sweepOrphans;
