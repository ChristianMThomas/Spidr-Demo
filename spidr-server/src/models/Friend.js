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

// Emit a Feed event when a friendship becomes accepted.
// Only fires from the `user_id` side so we don't double-write — the client
// usually creates two Friend rows (one each side) and we only want one entry.
s.post('save', async function (doc) {
  if (doc.status !== 'accepted') return;
  try {
    // Look up self profile for avatar/name attribution
    const UserProfile = require('./UserProfile');
    const myProfiles = await UserProfile.find({ user_id: doc.user_id }).limit(1);
    const myProfile = myProfiles[0];
    if (!myProfile) return;

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

module.exports = model('Friend', s);
