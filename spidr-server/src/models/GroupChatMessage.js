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

s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

/**
 * Fan-out for a new group message: a push to every other member, plus feed
 * events for anyone @mentioned. Candidates for the mention scan are the
 * group's member list.
 *
 * Clients write group messages over REST (`entities.GroupChatMessage.create`),
 * not the socket, so this hook is the only place that sees every message —
 * the `group:send` socket handler is legacy and nothing emits to it.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  // Missed-call rows are system messages the thread renders itself; pushing
  // them would double up with the call-ended signal.
  if (doc.is_missed_call) return;

  try {
    const { scanMentions } = require('../utils/mentionScanner');
    const feedEvents = require('../utils/feedEvents');
    const notifications = require('../utils/notifications');
    const GroupChat = require('./GroupChat');
    const UserProfile = require('./UserProfile');

    const group = await GroupChat.findById(doc.group_id)
      .select('members member_ids name avatar_url icon_url').lean();
    if (!group) return;

    // `members` predates `member_ids` and may hold either raw ids or objects.
    const memberIds = [...new Set([
      ...(group.members || []).map(m => (typeof m === 'string' ? m : m?.user_id)),
      ...(group.member_ids || []),
    ].filter(Boolean).map(String))];
    if (memberIds.length === 0) return;

    const senderName = doc.user_name || 'Someone';
    const senderAvatar = doc.user_avatar || '';
    const snippet = !doc.content
      ? 'Sent an attachment'
      : (doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content);

    // ── @mentions: feed events, and a distinct push signal ───────────────
    // Mentions ride `group_mention` rather than `group_message` so the
    // "@mentions only" switch has something to keep when it drops the rest.
    let mentionedIds = new Set();
    if (doc.content && doc.content.includes('@')) {
      const profiles = await UserProfile.find({ user_id: { $in: memberIds } })
        .select('user_id username display_name').lean();
      const profileById = Object.fromEntries(profiles.map(p => [p.user_id, p]));

      const candidates = memberIds.map(uid => ({
        user_id: uid,
        username:     profileById[uid]?.username,
        display_name: profileById[uid]?.display_name,
      }));

      const mentioned = scanMentions(doc.content, candidates, doc.user_id);
      mentionedIds = new Set(mentioned.map(m => String(m.user_id)));

      for (const m of mentioned) {
        feedEvents.mention({
          sender_id:     doc.user_id,
          sender_name:   senderName,
          sender_avatar: senderAvatar,
          recipient_id:  m.user_id,
          context:       'group',
          message_id:    doc._id.toString(),
          snippet,
        });
      }
    }

    // ── Push to every member but the sender ──────────────────────────────
    // Shaped like an iMessage group banner: sender on top, group name in the
    // middle, message at the bottom. The icon is the group's own pfp when it
    // has one and the sender's when it doesn't, so the banner never falls
    // back to the Spidr logo. `avatar_url` is the current pfp field;
    // `icon_url` is the legacy one still set on older groups.
    const groupIcon = group.avatar_url || group.icon_url || '';
    const groupName = group.name || 'Group chat';
    const payload = {
      title: senderName,
      subtitle: groupName,
      body: snippet,
      image: groupIcon || senderAvatar || undefined,
      data: {
        type: 'group_message',
        groupId: String(doc.group_id),
        groupName,
        messageId: doc._id.toString(),
        senderId: String(doc.user_id),
        senderName,
        senderAvatar,
      },
    };

    for (const uid of memberIds) {
      if (uid === String(doc.user_id)) continue;
      const isMention = mentionedIds.has(uid);
      notifications.dispatch(
        isMention ? 'group_mention' : 'group_message',
        uid,
        payload,
        // groupId lets the broker apply this member's per-group override.
        { senderId: doc.user_id, groupId: doc.group_id },
      );
    }
  } catch (err) {
    console.warn('Group message fan-out failed:', err?.message);
  }
});

module.exports = model('GroupChatMessage', s);
