const { Schema, model } = require('mongoose');
const s = new Schema({
  server_id:    { type: String, required: true, index: true },
  channel_id:   { type: String, required: true, index: true },
  // Support both user_id (standard) and author_id (frontend sends this)
  user_id:      { type: String, index: true },
  user_name:    String,
  user_avatar:  String,
  author_id:    { type: String, index: true },
  author_name:  String,
  author_avatar:String,
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
  is_system:    { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

// Text index on content for fast full-text search (used by GET /search).
// Replaces expensive regex scans with MongoDB's $text operator.
s.index({ content: 'text' });

// Virtual aliases so both field names work
s.virtual('effectiveUserId').get(function() { return this.user_id || this.author_id; });
s.virtual('effectiveName').get(function() { return this.user_name || this.author_name; });

// Mark new-vs-update for the mention scanner hook below
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
 * Fan-out for a new server message — runs after the message is saved.
 *
 * Every member but the author gets a push. Mentions ride a separate signal
 * (`server_mention`) so the "@mentions only" switch has something to keep
 * when it drops the rest, and mentioned users additionally get a targeted
 * Feed event.
 *
 * Skipped for system messages and edits. Errors are swallowed because none of
 * this may block a message send.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;          // only fire on creation, not edits
  if (doc.is_system) return;        // system messages don't notify anyone

  try {
    const { scanMentions } = require('../utils/mentionScanner');
    const feedEvents = require('../utils/feedEvents');
    const notifications = require('../utils/notifications');
    const Server = require('./Server');
    const UserProfile = require('./UserProfile');

    const senderId = doc.author_id || doc.user_id;
    if (!senderId) return;

    const server = await Server.findById(doc.server_id).select('name icon_url channels members').lean();
    if (!server) return;

    const memberIds = (server.members || []).map(m => m.user_id).filter(Boolean);
    if (memberIds.length === 0) return;

    // Resolve channel name for nicer phrasing
    const channel = (server.channels || []).find(c =>
      String(c.id) === String(doc.channel_id) || String(c._id) === String(doc.channel_id)
    );
    const channelName = channel?.name || '';

    const senderName = doc.author_name || doc.user_name || 'Someone';
    const senderAvatar = doc.author_avatar || doc.user_avatar || '';
    const snippet = !doc.content
      ? 'Sent an attachment'
      : (doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content);

    // Mentions need the member list cross-referenced against UserProfile for
    // username/display_name, so only pay for that lookup when there's an @.
    let mentionedIds = new Set();
    if (doc.content && doc.content.includes('@')) {
      const profiles = await UserProfile.find({ user_id: { $in: memberIds } })
        .select('user_id username display_name').lean();
      const profileById = Object.fromEntries(profiles.map(p => [p.user_id, p]));

      const candidates = (server.members || []).map(m => ({
        user_id: m.user_id,
        username:     profileById[m.user_id]?.username,
        display_name: profileById[m.user_id]?.display_name,
        user_name:    m.user_name,
      }));

      const mentioned = scanMentions(doc.content, candidates, senderId);
      mentionedIds = new Set(mentioned.map(m => String(m.user_id)));

      for (const m of mentioned) {
        feedEvents.mention({
          sender_id:     senderId,
          sender_name:   senderName,
          sender_avatar: senderAvatar,
          recipient_id:  m.user_id,
          context:       'server',
          server_id:     doc.server_id,
          server_name:   server.name,
          channel_id:    String(doc.channel_id),
          channel_name:  channel?.name,
          message_id:    doc._id.toString(),
          snippet,
        });
      }
    }

    // Shaped like an iMessage GROUP notification, not a DM one: the icon is
    // the server's, the title is who posted, the subtitle is where. iOS builds
    // that three-line layout from the INSendMessageIntent the
    // notification-service extension assembles out of these data keys —
    // `image` is the group icon, `senderAvatar` the person inside it. Icon is
    // the server's own when it has one, the poster's pfp when it doesn't, so
    // a banner never falls back to the Spidr logo.
    const payload = {
      title: senderName,
      subtitle: channelName ? `${server.name} · #${channelName}` : server.name,
      body: snippet,
      image: server.icon_url || senderAvatar || undefined,
      data: {
        type: 'server_message',
        serverId: doc.server_id,
        serverName: server.name || '',
        channelId: String(doc.channel_id),
        channelName,
        messageId: doc._id.toString(),
        senderId,
        senderName,
        senderAvatar,
      },
    };

    for (const uid of memberIds) {
      if (String(uid) === String(senderId)) continue;
      const isMention = mentionedIds.has(String(uid));
      notifications.dispatch(
        isMention ? 'server_mention' : 'server_message',
        uid,
        isMention
          ? { ...payload, data: { ...payload.data, type: 'server_mention' } }
          : payload,
        // serverId lets the broker apply this member's per-server override.
        { senderId, serverId: doc.server_id },
      );
    }
  } catch (err) {
    console.warn('Message fan-out failed:', err?.message);
  }
});

/**
 * Grant biomass for the author of each new message.
 *
 * 1 biomass per message, capped at 50/day by utils/biomass.js. Skipped for
 * system messages and own-server-bot messages. Wrapped in try/catch so a
 * biomass failure never blocks message creation.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  if (doc.is_system) return;
  const senderId = doc.author_id || doc.user_id;
  if (!senderId) return;
  try {
    const biomass = require('../utils/biomass');
    await biomass.grant(senderId, 1, 'Message sent', doc._id.toString(), 'message');
  } catch (err) {
    console.warn('Biomass grant on message failed:', err?.message);
  }
});

module.exports = model('Message', s);
