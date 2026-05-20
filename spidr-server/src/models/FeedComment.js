const { Schema, model } = require('mongoose');

/**
 * FeedComment — user comments and replies on activity feed items.
 *
 * Comments are flat in the DB but render as a 1-level reply tree on the
 * client: top-level comments have parent_comment_id === null, replies
 * have parent_comment_id === <some comment id>. Deeper nesting would
 * make the UI a pain on mobile, so we cap visual depth at 1.
 *
 * The denormalized `comments_count` on the Feed item gets +1 on save and
 * -1 on delete via the hooks below. Approximations are fine — we never
 * rely on this count being authoritative.
 */
const s = new Schema({
  feed_id:           { type: String, required: true, index: true },
  parent_comment_id: { type: String, default: null, index: true },
  author_id:         { type: String, required: true, index: true },
  author_name:       { type: String, default: 'Anonymous' },
  author_avatar:     { type: String, default: '' },
  content:           { type: String, required: true, maxlength: 1000 },
  // Like reactions on messages. Map of emoji → [user_id, ...]
  reactions:         { type: Map, of: [String], default: () => new Map() },
  edited_at:         { type: Date, default: null },
  created_date:      { type: Date, default: Date.now },
}, { timestamps: true });

s.index({ feed_id: 1, created_date: -1 });

// Track wasNew for the post-save hook so we only bump count on creation.
s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

// Bump the parent Feed item's denormalized count on creation. Wrapped so
// failure doesn't roll back the comment save.
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  try {
    const Feed = require('./Feed');
    await Feed.updateOne(
      { _id: doc.feed_id },
      { $inc: { comments_count: 1 } }
    );
  } catch (err) {
    console.warn('Feed comments_count increment failed:', err?.message);
  }
});

// Decrement on delete.
s.post('findOneAndDelete', async function (doc) {
  if (!doc) return;
  try {
    const Feed = require('./Feed');
    await Feed.updateOne(
      { _id: doc.feed_id },
      { $inc: { comments_count: -1 } }
    );
  } catch (err) {
    console.warn('Feed comments_count decrement failed:', err?.message);
  }
});

module.exports = model('FeedComment', s);
