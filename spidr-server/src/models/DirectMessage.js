const { Schema, model } = require('mongoose');
const s = new Schema({
  sender_id:       { type: String, required: true, index: true },
  receiver_id:     { type: String, required: true, index: true },
  recipient_id:    { type: String, index: true },       // alias used by some frontend code
  conversation_id: { type: String, index: true },       // groups a DM thread
  sender_name:     String,
  sender_avatar:   String,
  content:         String,
  clip_id:         String,
  thumbnail:       String,
  caption:         String,
  author:          String,
  attachments:     [Schema.Types.Mixed],
  // ── Search & Media Hub flags ───────────────────────────────────────────
  // Computed at write time (see utils/messageMeta) and indexed, so the
  // Images/Links tabs are an index hit instead of a full scan over history.
  has_images:   { type: Boolean, default: false, index: true },
  has_links:    { type: Boolean, default: false, index: true },
  media_urls:   { type: [String], default: [] },
  link_urls:    { type: [String], default: [] },

  reactions:       { type: Schema.Types.Mixed, default: {} },
  is_read:         { type: Boolean, default: false },
  is_webbed:       { type: Boolean, default: false },   // "pinned"
  edited_at:       Date,
  text_effect:     { type: String, default: 'normal' },
  reply_to:        String,
  // Recipient denormalization (mirrors sender_*) so conversation lists can
  // label a thread even when the last message is outgoing.
  recipient_name:      { type: String, default: '' },
  recipient_avatar:    { type: String, default: '' },
  // Server-invite DMs — the interactive invite card MessageItem renders.
  // These fields were never in the schema, so invites persisted as plain
  // empty messages: the card showed once optimistically, then vanished on
  // reload for both sides.
  is_server_invite:    { type: Boolean, default: false },
  server_invite_data:  { type: require('mongoose').Schema.Types.Mixed, default: null },
  server_id:           { type: String, default: '' },
  server_name:         { type: String, default: '' },
  server_icon:         { type: String, default: '' },
  server_description:  { type: String, default: '' },
  inviter_id:          { type: String, default: '' },
  inviter_name:        { type: String, default: '' },
  member_count:        { type: Number, default: 0 },
  members_snapshot:    { type: [require('mongoose').Schema.Types.Mixed], default: [] },
  // Missed-call system messages — rendered as a centered alert bubble
  // instead of a chat bubble. reason: 'declined' | 'unanswered' | 'cancelled'
  // Generic system rows (background changed, etc). Rendered as a centered
  // pill rather than a chat bubble — see MessageItem.
  is_system_event:     { type: Boolean, default: false },
  event_type:          { type: String, default: '' },
  is_missed_call:      { type: Boolean, default: false },
  missed_call_reason:  { type: String, default: '' },
  caller_id:           { type: String, default: '' },
  caller_name:         { type: String, default: '' },
  created_date:    { type: Date, default: Date.now },
}, { timestamps: true });

// Full-text index powering keyword search in this surface.
s.index({ content: 'text' });

// Derive search/gallery metadata before every save.
s.pre('save', function (next) {
  try {
    const { extractMessageMeta } = require('../utils/messageMeta');
    const meta = extractMessageMeta(this.content, this.attachments);
    this.has_images = meta.has_images;
    this.has_links  = meta.has_links;
    this.media_urls = meta.media_urls;
    this.link_urls  = meta.link_urls;
  } catch { /* metadata is best-effort; never block a message send */ }
  next();
});

s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

/**
 * Mention scanner for DMs. The mention target in a DM is almost always the
 * receiver, but the user might also @-mention themselves or a third party
 * whose username they happen to know. We only fire feed events for the
 * receiver to keep it simple and avoid notifying random users in unrelated
 * conversations.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  if (!doc.content || !doc.content.includes('@')) return;

  try {
    const { extractMentionTokens } = require('../utils/mentionScanner');
    const feedEvents = require('../utils/feedEvents');
    const UserProfile = require('./UserProfile');

    const tokens = extractMentionTokens(doc.content);
    if (tokens.size === 0) return;

    const receiverId = doc.receiver_id || doc.recipient_id;
    if (!receiverId || receiverId === doc.sender_id) return;

    const receiver = await UserProfile.findOne({ user_id: receiverId })
      .select('user_id username display_name').lean();
    if (!receiver) return;

    const username  = (receiver.username     || '').toLowerCase();
    const display   = (receiver.display_name || '').toLowerCase();
    const firstWord = display.split(/\s+/)[0] || '';

    if (
      (username && tokens.has(username)) ||
      (display && tokens.has(display)) ||
      (firstWord && tokens.has(firstWord))
    ) {
      const snippet = doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content;
      feedEvents.mention({
        sender_id:     doc.sender_id,
        sender_name:   doc.sender_name || 'Someone',
        sender_avatar: doc.sender_avatar || '',
        recipient_id:  receiverId,
        context:       'dm',
        message_id:    doc._id.toString(),
        snippet,
      });
    }
  } catch (err) {
    console.warn('DM mention scan failed:', err?.message);
  }
});

module.exports = model('DirectMessage', s);
