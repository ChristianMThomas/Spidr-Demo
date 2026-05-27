const { Schema, model } = require('mongoose');
const s = new Schema({
  clip_id:      { type: String, index: true },
  post_id:      { type: String, index: true },
  user_id:      { type: String, required: true, index: true },
  user_name:    String,
  user_avatar:  String,
  content:      String,
  attachments:  [Schema.Types.Mixed],
  likes:        [String],
  reactions:    { type: Schema.Types.Mixed, default: {} },
  reply_to:     String,
  is_pinned:    { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

/**
 * Mention scanner for comments. Unlike server chats there's no explicit
 * member list, so we resolve by username only — query UserProfile for any
 * profile whose username matches a mention token in the content. Bounded
 * by the token count (typically 0-3 per comment) so this is cheap.
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

    // Look up by username (case-insensitive). Since usernames are unique
    // this resolves to at most one user per token.
    const tokenList = [...tokens];
    const regex = tokenList.map(t => `^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).join('|');
    const profiles = await UserProfile.find({
      username: { $regex: new RegExp(regex, 'i') },
    }).select('user_id username display_name').limit(10).lean();

    const mentioned = profiles
      .filter(p => p.user_id && p.user_id !== doc.user_id)
      .map(p => ({ user_id: p.user_id, display_name: p.display_name || p.username }));

    if (mentioned.length === 0) return;

    const snippet = doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content;
    for (const m of mentioned) {
      feedEvents.mention({
        sender_id:     doc.user_id,
        sender_name:   doc.user_name || 'Someone',
        sender_avatar: doc.user_avatar || '',
        recipient_id:  m.user_id,
        context:       'comment',
        message_id:    doc._id.toString(),
        target_id:     doc.clip_id || doc.post_id,
        snippet,
      });
    }
  } catch (err) {
    console.warn('Comment mention scan failed:', err?.message);
  }
});

module.exports = model('Comment', s);
