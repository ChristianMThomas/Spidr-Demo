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
  reactions:       { type: Schema.Types.Mixed, default: {} },
  is_read:         { type: Boolean, default: false },
  is_webbed:       { type: Boolean, default: false },   // "pinned"
  edited_at:       Date,
  text_effect:     { type: String, default: 'normal' },
  reply_to:        String,
  created_date:    { type: Date, default: Date.now },
}, { timestamps: true });

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
