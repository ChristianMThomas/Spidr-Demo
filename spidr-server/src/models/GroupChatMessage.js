const { Schema, model } = require('mongoose');
const s = new Schema({
  group_id:     { type: String, required: true, index: true },
  user_id:      { type: String, required: true },
  user_name:    String,
  user_avatar:  String,
  content:      String,
  attachments:  [Schema.Types.Mixed],
  // ── Search & Media Hub flags ───────────────────────────────────────────
  // Computed at write time (see utils/messageMeta) and indexed, so the
  // Images/Links tabs are an index hit instead of a full scan over history.
  has_images:   { type: Boolean, default: false, index: true },
  has_links:    { type: Boolean, default: false, index: true },
  media_urls:   { type: [String], default: [] },
  link_urls:    { type: [String], default: [] },

  reactions:    { type: Schema.Types.Mixed, default: {} },
  is_webbed:    { type: Boolean, default: false },
  edited_at:    Date,
  text_effect:  { type: String, default: 'normal' },
  reply_to:     String,
  // Missed-call system messages — rendered as a centered alert bubble.
  is_missed_call:      { type: Boolean, default: false },
  missed_call_reason:  { type: String, default: '' },
  caller_id:           { type: String, default: '' },
  caller_name:         { type: String, default: '' },
  // Group name snapshotted at write time so the caller's client can render
  // "<group> didn't answer" without a second lookup.
  group_name:          { type: String, default: '' },
  created_date: { type: Date, default: Date.now },
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

    // @everyone / @here in a GROUP CHAT fans out to every member. The
    // mention scanner deliberately treats these as reserved tokens and never
    // expands them (correct for large server channels — you don't want one
    // admin generating thousands of feed rows). Group chats are small and
    // private, so the broadcast is both wanted and cheap here. No permission
    // gate: everyone in a group DM is a peer. Server channels keep the old
    // suppressed behavior.
    const isEveryonePing = /@(everyone|here)\b/i.test(doc.content || '');
    const everyoneTargets = isEveryonePing
      ? memberIds.filter(uid => uid !== doc.user_id)
      : [];

    // Union so a message like "@everyone and @alice" doesn't notify alice twice.
    const recipientIds = new Set([
      ...mentioned.map(m => m.user_id),
      ...everyoneTargets,
    ]);
    if (recipientIds.size === 0) return;

    const snippet = doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content;

    for (const uid of recipientIds) {
      const m = { user_id: uid };
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
