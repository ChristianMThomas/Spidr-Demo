const express = require('express');
const crudRouter = require('../utils/crudRouter');
const authMW = require('../middleware/auth');
const Friend = require('../models/Friend');
const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const { filterOrphans } = require('../utils/filterExistingUsers');

const router = express.Router();

// GET / — same query surface as crudRouter, but drops rows whose friend_id
// points to a deleted User so ghost friends stop appearing in the UI.
router.get('/', authMW, async (req, res) => {
  try {
    const { _orderBy, _limit, ...filters } = req.query;
    const query = {};
    for (const [k, v] of Object.entries(filters)) {
      if (k.startsWith('$')) continue;
      if (typeof v === 'string' && v.includes(',')) query[k] = { $in: v.split(',') };
      else if (typeof v === 'object' && v !== null) continue;
      else query[k] = v;
    }
    let q = Friend.find(query);
    if (_orderBy) {
      const field = _orderBy.startsWith('-') ? _orderBy.slice(1) : _orderBy;
      if (/^[a-zA-Z0-9_.]+$/.test(field)) {
        q = q.sort({ [field]: _orderBy.startsWith('-') ? -1 : 1 });
      }
    }
    if (_limit) {
      const cap = Math.min(Math.max(parseInt(_limit, 10) || 50, 1), 200);
      q = q.limit(cap);
    }
    const docs = await q.lean();
    const filtered = await filterOrphans(docs, 'friend_id');
    res.json(filtered.map(({ _id, __v, ...rest }) => ({ id: _id?.toString(), ...rest })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/close — toggle the close-friend flag on a Friend row.
// Only the row's owner (user_id) can flip their own side.
router.patch('/:id/close', authMW, async (req, res) => {
  try {
    const row = await Friend.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Friend not found' });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Not your friend row' });
    row.is_close_friend = !!req.body.close;
    await row.save();
    res.json({ id: row._id.toString(), is_close_friend: row.is_close_friend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — friend-request override.
// crudRouter force-overwrites user_id with req.user.id on every POST, which
// means clients can't insert the recipient's mirror row (user_id: target,
// status: pending_incoming) — that write silently collides with the sender's
// own row on the unique {user_id, friend_id} index and 409s. Result: only
// the sender's pending_outgoing row survives and the recipient never sees an
// incoming request. This handler mirrors both rows server-side when the
// payload is shaped like a friend request. Blocks / accepts / anything else
// falls through to crudRouter unchanged.
router.post('/', authMW, async (req, res, next) => {
  const { friend_id, status } = req.body || {};
  const isPendingRequest = !status || status === 'pending' || status === 'pending_outgoing';
  // 'accepted' covers the "accept a DM from a stranger" (SignalRequests) path
  // where no pending_incoming row exists — the caller wants both sides to be
  // linked immediately. crudRouter can't do this because it can't insert on
  // the target's behalf, so we handle it here.
  const isAcceptedRequest = status === 'accepted';
  if (!friend_id || (!isPendingRequest && !isAcceptedRequest)) return next();
  if (friend_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot friend yourself' });
  }
  try {
    // Skip if a row already exists in either direction (accepted, blocked,
    // or a request already pending). Let the caller handle the current state.
    const existing = await Friend.findOne({
      $or: [
        { user_id: req.user.id, friend_id },
        { user_id: friend_id,   friend_id: req.user.id },
      ],
    }).lean();
    if (existing) return res.status(409).json({ error: 'already_exists' });

    const [myProfile, targetProfile, targetUser] = await Promise.all([
      UserProfile.findOne({ user_id: req.user.id }).lean(),
      UserProfile.findOne({ user_id: friend_id }).lean(),
      User.findById(friend_id).lean(),
    ]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const myName     = myProfile?.display_name || req.user.full_name || req.user.username || 'User';
    const myAvatar   = myProfile?.avatar_url   || req.user.avatar_url || '';
    const theirName  = req.body.friend_name  || targetProfile?.display_name || targetUser.username || 'User';
    const theirAvatar = req.body.friend_avatar || targetProfile?.avatar_url || targetUser.avatar_url || '';

    const senderStatus = isAcceptedRequest ? 'accepted' : 'pending_outgoing';
    const mirrorStatus = isAcceptedRequest ? 'accepted' : 'pending_incoming';

    const outgoing = await Friend.create({
      user_id:      req.user.id,
      friend_id,
      friend_name:  theirName,
      friend_avatar: theirAvatar,
      friend_discriminator: targetProfile?.discriminator || '',
      status: senderStatus,
    });
    // Best-effort mirror row. If it collides we still succeed — the sender
    // row is what the caller expects back.
    try {
      await Friend.create({
        user_id:      friend_id,
        friend_id:    req.user.id,
        friend_name:  myName,
        friend_avatar: myAvatar,
        friend_discriminator: myProfile?.discriminator || '',
        status: mirrorStatus,
      });
    } catch (mirrorErr) {
      if (mirrorErr.code !== 11000) throw mirrorErr;
    }

    const obj = outgoing.toObject();
    const { _id, __v, ...rest } = obj;
    return res.status(201).json({ id: _id.toString(), ...rest });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'already_exists' });
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /:id — accept override.
// crudRouter's ownership check blocks the recipient from PATCHing the
// sender's mirror row, so clients that accepted only flipped their own side
// and the sender stayed on pending_outgoing forever. This intercepts the
// accept case and flips both rows atomically. All other PATCHes fall through.
router.patch('/:id', authMW, async (req, res, next) => {
  if (req.body?.status !== 'accepted') return next();
  try {
    const row = await Friend.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Friend not found' });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Not your friend row' });

    row.status = 'accepted';
    await row.save();

    // Flip the mirror row only if it's still pending — don't clobber blocked
    // or anything else the other side has set independently.
    const mirrorFlip = await Friend.updateOne(
      {
        user_id:   row.friend_id,
        friend_id: row.user_id,
        status:    { $in: ['pending', 'pending_outgoing', 'pending_incoming'] },
      },
      { $set: { status: 'accepted' } },
    );

    // No mirror at all (legacy row, or the original request write never
    // mirrored) — create one now so the accepter's friends list isn't
    // one-sided. Guarded by matchedCount so we don't clobber an existing
    // blocked/accepted mirror.
    if (mirrorFlip.matchedCount === 0) {
      const anyMirror = await Friend.findOne({
        user_id: row.friend_id, friend_id: row.user_id,
      }).lean();
      if (!anyMirror) {
        // Mirror sits on the OTHER user's side, so its friend_* fields
        // describe ME (row.user_id === req.user.id).
        const [myProfile, myUser] = await Promise.all([
          UserProfile.findOne({ user_id: row.user_id }).lean(),
          User.findById(row.user_id).lean(),
        ]);
        const myName   = myProfile?.display_name || myUser?.full_name || myUser?.username || 'User';
        const myAvatar = myProfile?.avatar_url   || myUser?.avatar_url || '';
        try {
          await Friend.create({
            user_id:      row.friend_id,
            friend_id:    row.user_id,
            friend_name:  myName,
            friend_avatar: myAvatar,
            friend_discriminator: myProfile?.discriminator || '',
            status: 'accepted',
          });
        } catch (e) { if (e.code !== 11000) throw e; }
      }
    }

    const obj = row.toObject();
    const { _id, __v, ...rest } = obj;
    return res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /:id — mutual unfriend. crudRouter would only delete the caller's
// side, leaving the other user with an orphan accepted mirror ("half friend"
// — visible in their list but the sender has no record). Wipe both sides,
// but never touch a mirror the other user has independently set to `blocked`.
router.delete('/:id', authMW, async (req, res) => {
  try {
    const row = await Friend.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: 'Not your friend row' });
    await Friend.deleteOne({ _id: row._id });
    await Friend.deleteOne({
      user_id:   row.friend_id,
      friend_id: row.user_id,
      status:    { $ne: 'blocked' },
    });
    return res.status(204).end();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.use('/', crudRouter(Friend, { ownerField: 'user_id' }));

module.exports = router;
