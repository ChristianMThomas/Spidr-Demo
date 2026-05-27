const { Schema, model } = require('mongoose');
const s = new Schema({
  group_id:     { type: String, required: true, index: true },
  user_id:      { type: String, required: true },
  user_name:    String,
  user_avatar:  String,
  content:      String,
  attachments:  [Schema.Types.Mixed],
  reactions:    { type: Schema.Types.Mixed, default: {} },
  is_webbed:    { type: Boolean, default: false },
  edited_at:    Date,
  text_effect:  { type: String, default: 'normal' },
  reply_to:     String,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

/**
 * Mention scanner for group chats. Candidates are the group's member list.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  if (!doc.content || !doc.content.includes('@')) return;

  try {
    const { scanMentions } = require('../utils/mentionScanner');
    const feedEvents = require('../utils/feedEvents');
    const GroupChat = require('./GroupChat');
    const UserProfile = require('./UserProfile');

    const group = await GroupChat.findById(doc.group_id).select('members name').lean();
    if (!group) return;

    const memberIds = (group.members || []).map(m => (typeof m === 'string' ? m : m?.user_id)).filter(Boolean);
    if (memberIds.length === 0) return;

    const profiles = await UserProfile.find({ user_id: { $in: memberIds } })
      .select('user_id username display_name').lean();
    const profileById = Object.fromEntries(profiles.map(p => [p.user_id, p]));

    const candidates = memberIds.map(uid => ({
      user_id: uid,
      username:     profileById[uid]?.username,
      display_name: profileById[uid]?.display_name,
    }));

    const mentioned = scanMentions(doc.content, candidates, doc.user_id);
    if (mentioned.length === 0) return;

    const snippet = doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content;

    for (const m of mentioned) {
      feedEvents.mention({
        sender_id:     doc.user_id,
        sender_name:   doc.user_name || 'Someone',
        sender_avatar: doc.user_avatar || '',
        recipient_id:  m.user_id,
        context:       'group',
        message_id:    doc._id.toString(),
        snippet,
      });
    }
  } catch (err) {
    console.warn('Group message mention scan failed:', err?.message);
  }
});

module.exports = model('GroupChatMessage', s);
