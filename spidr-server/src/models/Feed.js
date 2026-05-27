const { Schema, model } = require('mongoose');

/**
 * Feed — activity feed events shown on the home page.
 *
 * Two delivery modes:
 *   • PUBLIC (recipient_ids is empty/missing):
 *       Visible to everyone. Used for general activity: server joins, friend
 *       acceptances, clip posts, server creation, milestones, announcements.
 *   • TARGETED (recipient_ids is a non-empty array):
 *       Only visible to the listed users. Used for personal events like
 *       @mentions, where only the mentioned user(s) should see it.
 *       Profile updates use this with `recipient_ids = [friend_id, friend_id, ...]`
 *       so only friends see "X updated their bio."
 *
 * Examples:
 *   { type: 'server_join',     user_id, user_name, user_avatar, title: 'Joined My Awesome Server', server_id }
 *   { type: 'friend_added',    user_id, user_name, user_avatar, title: 'Became friends with X' }
 *   { type: 'clip_posted',     user_id, user_name, user_avatar, title: 'Posted a new clip', image_url }
 *   { type: 'mention',         user_id (sender), recipient_ids: ['target'], title: '@safina mentioned you in #general', content: snippet }
 *   { type: 'profile_update',  user_id (updater), recipient_ids: [...friends], title: 'Updated their bio' }
 *   { type: 'announcement',    user_id: 'system', title: 'Spidr v1.2 launched', is_pinned: true }
 */
const s = new Schema({
  // Who/what this event is about (the ACTOR — the user who did the thing)
  user_id:      { type: String, required: true, index: true },
  user_name:    String,
  user_avatar:  String,

  // Audience. Empty = public event, visible to everyone.
  // Non-empty = only these user_ids see this event.
  recipient_ids: { type: [String], default: [], index: true },

  // Event classification — drives the icon and color in EnhancedFeed.jsx
  type: {
    type: String,
    enum: [
      'server_join',
      'friend_added',
      'achievement',
      'announcement',
      'activity',
      'clip_posted',
      'milestone',
      'trending',
      'mention',          // @-mention in any chat
      'profile_update',   // friend updated their bio/avatar/banner/display name
    ],
    default: 'activity',
    index: true,
  },

  // Display fields
  title:        String,   // short headline ("Joined My Awesome Server")
  content:      String,   // optional longer description (or message snippet)
  image_url:    String,   // hero image for the card
  media_url:    String,   // optional attached media
  media_type:   String,

  // Optional links — UI can use these to deep-link
  server_id:    String,
  channel_id:   String,   // for mention events: lets the UI link to the chat
  message_id:   String,   // for mention events: lets the UI scroll to the original
  target_id:    String,

  // Engagement
  is_pinned:    { type: Boolean, default: false, index: true },
  reactions:    { type: Schema.Types.Mixed, default: {} },   // { "🔥": ["user_id1", ...] }
  likes:        [String],
  comments_count: { type: Number, default: 0 },

  tags:         [String],
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

// Compound index — most queries are "newest pinned items first, then recent"
s.index({ is_pinned: -1, created_date: -1 });

module.exports = model('Feed', s);
