const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:              { type: String, required: true, index: true },
  friend_id:            { type: String, required: true, index: true },
  // mirror info for display without extra lookup
  friend_name:          String,
  friend_discriminator: String,
  friend_avatar:        String,
  status: {
    type: String,
    enum: ['pending', 'pending_outgoing', 'pending_incoming', 'accepted', 'blocked'],
    default: 'pending',
    index: true,
  },
  nickname:    String,
  created_date:{ type: Date, default: Date.now },
}, { timestamps: true });
s.index({ user_id: 1, friend_id: 1 }, { unique: true, sparse: true });

// True when either side of the row is the Spidr System account — its
// friendships are provisioned by ensureSystemFriendship (which deliberately
// bypasses these hooks via updateOne) and must never generate notifications.
async function involvesSystemUser(doc) {
  const { ensureSystemUser } = require('../utils/spidrSystem');
  const sysId = await ensureSystemUser();
  return String(doc.user_id) === sysId || String(doc.friend_id) === sysId;
}

// Notify the requester (doc.friend_id) that doc.user_id accepted — exactly
// once per pair. The accept flow updates both reciprocal rows to 'accepted'
// in sequence; only the FIRST flip sees the reciprocal row still pending, so
// gating on that gives natural dedupe (and skips unblocks, where the other
// row is already accepted or missing).
async function notifyAcceptedOnce(doc, FriendModel) {
  const recip = await FriendModel.findOne({ user_id: doc.friend_id, friend_id: doc.user_id })
    .select('status').lean();
  if (!recip || !['pending_outgoing', 'pending'].includes(recip.status)) return;

  const UserProfile = require('./UserProfile');
  const me = await UserProfile.findOne({ user_id: doc.user_id }).select('display_name').lean();
  const { sendSystemDM } = require('../utils/spidrSystem');
  await sendSystemDM(
    doc.friend_id,
    `🤝 ${me?.display_name || 'Someone'} accepted your friend request. You're now connected — say hi from the FRIENDS tab.`,
  );
}

// Emit a Feed event when a friendship becomes accepted.
// Only fires from the `user_id` side so we don't double-write — the client
// usually creates two Friend rows (one each side) and we only want one entry.
s.post('save', async function (doc) {
  // Incoming request row → ping the recipient through the Spidr System DM.
  // (The row's owner is the RECIPIENT; friend_name mirrors the requester.)
  if (doc.status === 'pending_incoming') {
    try {
      if (await involvesSystemUser(doc)) return;
      const { sendSystemDM } = require('../utils/spidrSystem');
      await sendSystemDM(
        doc.user_id,
        `📡 ${doc.friend_name || 'Someone'} sent you a friend request. Open the FRIENDS tab to respond.`,
      );
    } catch (err) {
      console.warn('Friend request notify failed:', err?.message);
    }
    return;
  }

  if (doc.status !== 'accepted') return;
  try {
    // Look up self profile for avatar/name attribution
    const UserProfile = require('./UserProfile');
    const myProfiles = await UserProfile.find({ user_id: doc.user_id }).limit(1);
    const myProfile = myProfiles[0];
    if (!myProfile) return;

    if (await involvesSystemUser(doc)) return;

    // System DM to the requester — direct-save accepts (rare path; most
    // accepts arrive via PATCH → findOneAndUpdate hook below).
    notifyAcceptedOnce(doc, this.constructor).catch((err) =>
      console.warn('Friend accept notify failed:', err?.message));

    // De-dupe: skip if we already wrote a friend_added event between these two
    const Feed = require('./Feed');
    const existing = await Feed.findOne({
      type: 'friend_added',
      user_id: doc.user_id,
      target_id: doc.friend_id,
    });
    if (existing) return;

    const feedEvents = require('../utils/feedEvents');
    feedEvents.friendAccepted({
      user_id:     doc.user_id,
      user_name:   myProfile.display_name || 'A user',
      user_avatar: myProfile.avatar_url || '',
      friend_id:   doc.friend_id,
      friend_name: doc.friend_name || 'someone',
    });
  } catch (err) {
    // Decorative — never block
    console.warn('Friend feed hook failed:', err?.message);
  }
});

// The accept path every client actually uses is PATCH /friends/:id →
// findByIdAndUpdate, which does NOT fire post('save'). Hook the update
// pipeline too so "accepted your friend request" system DMs fire for real
// accepts (crudRouter passes { new: true }, so `doc` is the updated row).
s.post('findOneAndUpdate', async function (doc) {
  if (!doc || doc.status !== 'accepted') return;
  try {
    if (await involvesSystemUser(doc)) return;
    await notifyAcceptedOnce(doc, this.model);
  } catch (err) {
    console.warn('Friend accept notify failed:', err?.message);
  }
});

module.exports = model('Friend', s);
