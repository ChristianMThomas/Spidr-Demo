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
  reactions:    { type: Schema.Types.Mixed, default: {} },
  is_webbed:    { type: Boolean, default: false },
  edited_at:    Date,
  text_effect:  { type: String, default: 'normal' },
  reply_to:     String,
  is_system:    { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

// Virtual aliases so both field names work
s.virtual('effectiveUserId').get(function() { return this.user_id || this.author_id; });
s.virtual('effectiveName').get(function() { return this.user_name || this.author_name; });

// Mark new-vs-update for the mention scanner hook below
s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

/**
 * Mention scanner — runs after a message is saved. Parses `@mentions` from
 * content, resolves them against the server's member list, and fires a
 * targeted Feed event for each mentioned user.
 *
 * Skipped for system messages, edits, and bot messages. Errors are swallowed
 * because feed events are decorative and must never block a message send.
 */
s.post('save', async function (doc) {
  if (!doc.wasNew) return;          // only fire on creation, not edits
  if (doc.is_system) return;        // system messages don't mention people
  if (!doc.content) return;         // attachments-only message, nothing to scan
  if (!doc.content.includes('@')) return; // cheap pre-filter

  try {
    const { scanMentions } = require('../utils/mentionScanner');
    const feedEvents = require('../utils/feedEvents');
    const Server = require('./Server');
    const UserProfile = require('./UserProfile');

    const senderId = doc.author_id || doc.user_id;
    if (!senderId) return;

    const server = await Server.findById(doc.server_id).select('name channels members').lean();
    if (!server) return;

    // Candidates = server members. Cross-reference UserProfile for username/display_name.
    const memberIds = (server.members || []).map(m => m.user_id).filter(Boolean);
    if (memberIds.length === 0) return;

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
    if (mentioned.length === 0) return;

    // Resolve channel name for nicer phrasing
    const channel = (server.channels || []).find(c =>
      String(c.id) === String(doc.channel_id) || String(c._id) === String(doc.channel_id)
    );

    // Truncate the message to a short snippet for the feed card
    const snippet = doc.content.length > 140 ? doc.content.slice(0, 137) + '…' : doc.content;

    for (const m of mentioned) {
      feedEvents.mention({
        sender_id:     senderId,
        sender_name:   doc.author_name || doc.user_name || 'Someone',
        sender_avatar: doc.author_avatar || doc.user_avatar || '',
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
  } catch (err) {
    console.warn('Message mention scan failed:', err?.message);
  }
});

module.exports = model('Message', s);
