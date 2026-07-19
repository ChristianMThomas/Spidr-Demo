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
  ['Friend',          (uid) => ({ $or: [{ user_id: uid }, { friend_id: uid }] })],
  ['DirectMessage',   (uid) => ({ $or: [{ sender_id: uid }, { recipient_id: uid }, { receiver_id: uid }] })],
  ['GroupChat',       (uid) => ({ owner_id: uid })], // owned groups die; non-owned handled below
  ['GroupChatMessage',(uid) => ({ user_id: uid })],
  ['Message',         (uid) => ({ $or: [{ user_id: uid }, { author_id: uid }] })],
  ['Clip',            (uid) => ({ author_id: uid })],
  ['Comment',         (uid) => ({ author_id: uid })],
  ['Feed',            (uid) => ({ author_id: uid })],
  ['FeedComment',     (uid) => ({ author_id: uid })],
  ['Collection',      (uid) => ({ user_id: uid })],
  ['Notification',    (uid) => ({ user_id: uid })],
  ['InstalledModule', (uid) => ({ user_id: uid })],
  ['CustomBot',       (uid) => ({ owner_id: uid })],
  ['AudioTrack',      (uid) => ({ user_id: uid })],
  ['SavedAudio',      (uid) => ({ user_id: uid })],
  ['Report',          (uid) => ({ $or: [{ reporter_id: uid }, { reported_user_id: uid }] })],
  ['VoiceSession',    (uid) => ({ user_id: uid })],
  ['Event',           (uid) => ({ created_by: uid })],
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
  // Remove the user from every server's members / banned_users arrays too.
  try {
    const Server = require('../models/Server');
    await Server.updateMany(
      {},
      { $pull: { members: { user_id: userId }, banned_users: userId } }
    );
    // Delete servers owned by this user
    const owned = await Server.deleteMany({ owner_id: userId });
    results.Server = owned.deletedCount || 0;
  } catch (err) { results.Server = `error: ${err.message}`; }
  // Remove from every group's member list
  try {
    const GroupChat = require('../models/GroupChat');
    await GroupChat.updateMany({}, { $pull: { members: { user_id: userId } } });
  } catch {}
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
