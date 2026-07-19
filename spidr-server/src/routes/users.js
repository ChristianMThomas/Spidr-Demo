const express  = require('express');
const authMW   = require('../middleware/auth');
const User     = require('../models/User');
const crudRouter = require('../utils/crudRouter');

const router = express.Router();

// ── Search users by username or email (for friend requests) ───────────────────
router.get('/search', authMW, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }, { full_name: regex }],
      _id: { $ne: req.user._id } // Exclude self
    })
    .select('-password -twoFactorSecret')
    .limit(20)
    .lean();

    res.json(users.map(u => ({
      id: u._id.toString(),
      email: u.email,
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      status: u.status,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Deactivate own account — reversible; hides the user until next login ─────
router.post('/me/deactivate', authMW, async (req, res) => {
  try {
    const uid = req.user._id ? req.user._id.toString() : req.user.id;
    await User.updateOne({ _id: uid }, { $set: { is_deactivated: true, status: 'offline' } });
    const UserProfile = require('../models/UserProfile');
    await UserProfile.updateOne({ user_id: uid }, { $set: { status: 'offline' } });
    res.json({ deactivated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete own account — Apple 5.1.1(v) / Play account-deletion policy ────────
// Cascades the user's owned data and anonymizes message authorship so
// conversations stay intact for the other participants. Irreversible.
router.delete('/me', authMW, async (req, res) => {
  try {
    const uid = req.user._id ? req.user._id.toString() : req.user.id;

    const UserProfile      = require('../models/UserProfile');
    const Friend           = require('../models/Friend');
    const Clip             = require('../models/Clip');
    const Follow           = require('../models/Follow');
    const InstalledModule  = require('../models/InstalledModule');
    const BiomassWallet    = require('../models/BiomassWallet');
    const DirectMessage    = require('../models/DirectMessage');
    const Message          = require('../models/Message');
    const GroupChatMessage = require('../models/GroupChatMessage');
    const { deleteFile }   = require('../utils/azureStorage');

    // Collect owned R2/local media URLs BEFORE deleting the rows so we can
    // purge the blobs after (best-effort — storage cleanup never blocks the
    // response). Covers clip videos and profile avatar/banner; message
    // attachments stay because messages are anonymized, not deleted.
    const [profileRows, clipRows] = await Promise.all([
      UserProfile.find({ user_id: uid }).select('avatar_url banner_url').lean(),
      Clip.find({ author_id: uid }).select('video_url thumbnail_url').lean(),
    ]);
    const mediaUrls = [
      ...profileRows.flatMap((p) => [p.avatar_url, p.banner_url]),
      ...clipRows.flatMap((c) => [c.video_url, c.thumbnail_url]),
    ].filter(Boolean);

    // Owned rows — hard delete.
    await Promise.allSettled([
      UserProfile.deleteMany({ user_id: uid }),
      Friend.deleteMany({ $or: [{ user_id: uid }, { friend_id: uid }] }),
      Clip.deleteMany({ author_id: uid }),
      Follow.deleteMany({ $or: [{ follower_id: uid }, { following_id: uid }] }),
      InstalledModule.deleteMany({ user_id: uid }),
      BiomassWallet.deleteMany({ user_id: uid }),
    ]);

    // Authored messages — anonymize instead of delete so the other side of
    // every conversation keeps its history.
    const anon = { sender_name: 'Deleted User', sender_avatar: '' };
    await Promise.allSettled([
      DirectMessage.updateMany({ sender_id: uid }, { $set: anon }),
      Message.updateMany(
        { $or: [{ author_id: uid }, { user_id: uid }] },
        { $set: { author_name: 'Deleted User', author_avatar: '', user_name: 'Deleted User', user_avatar: '' } },
      ),
      GroupChatMessage.updateMany({ user_id: uid }, { $set: { user_name: 'Deleted User', user_avatar: '' } }),
    ]);

    await User.deleteOne({ _id: uid });

    // Blob cleanup — fire-and-forget; deleteFile swallows its own errors so
    // the in-app "account deleted" confirmation is never held up by R2.
    Promise.allSettled(mediaUrls.map((u) => deleteFile(u)));

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mount standard CRUD (GET /, GET /:id, POST /, PATCH /:id, DELETE /:id)
// but strip password from all responses.
// ownerField: '_id' locks PATCH/DELETE to self — req.user.id equals
// req.user._id.toString() (auth middleware returns the full User doc),
// which matches doc._id.toString() in isOwner(). Without this any
// authenticated user could DELETE any other user's account.
const crud = crudRouter(User, { ownerField: '_id' });

// Override: list should never expose passwords
router.use('/', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (Array.isArray(data)) {
      data = data.map(u => { const { password, twoFactorSecret, ...rest } = u; return rest; });
    } else if (data && data.password) {
      const { password, twoFactorSecret, ...rest } = data;
      data = rest;
    }
    return originalJson(data);
  };
  next();
});

router.use('/', crud);

module.exports = router;
