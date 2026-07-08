const { Schema, model } = require('mongoose');
const s = new Schema({
  name:          { type: String, required: true },
  // Discovery metadata — Signal Radar already filtered on these, but they
  // were never in the schema so Mongoose silently dropped every write.
  category: { type: String, default: '' },
  tags:     { type: [String], default: [] }, // lowercase #tags, max 5 enforced client-side
  description:   String,
  icon_url:      String,
  banner_url:    String,
  owner_id:      { type: String, required: true },
  members:       [Schema.Types.Mixed],
  // Ban list — user_ids barred from rejoining. The kick/ban flow has always
  // written this; it was absent from the schema so strict mode dropped it and
  // BANS NEVER PERSISTED (banned users could rejoin immediately).
  banned_users: { type: [String], default: [] },
  channels:      [Schema.Types.Mixed],
  roles:         [Schema.Types.Mixed],
  emojis:        [Schema.Types.Mixed],
  muted_members: [String],
  timeouts:      [Schema.Types.Mixed],
  hidden_roles:  [String],
  // When false, role badges next to usernames in chat are hidden.
  // Default true so existing servers keep the label visible.
  show_role_labels: { type: Boolean, default: true },
  sanctuary:     { type: Schema.Types.Mixed, default: {} },
  airlock:       { type: Schema.Types.Mixed, default: {} },
  // Installed bots (added via BotLaboratory)
  bots:          { type: [Schema.Types.Mixed], default: [] },
  // Bot configuration — welcome message, automod settings, etc.
  bot_config:    { type: Schema.Types.Mixed, default: {} },
  is_public:     { type: Boolean, default: true },
  invite_code:   String,
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true, minimize: false, strict: false });

// Track new-vs-update so the post-save hook only fires on creation
s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  try {
    // Look up the owner's profile for nice attribution
    const UserProfile = require('./UserProfile');
    const profiles = await UserProfile.find({ user_id: doc.owner_id }).limit(1);
    const ownerProfile = profiles[0];

    const feedEvents = require('../utils/feedEvents');
    feedEvents.milestone({
      user_id:     doc.owner_id,
      user_name:   ownerProfile?.display_name || 'A user',
      user_avatar: ownerProfile?.avatar_url || '',
      title:       `Launched a new server: ${doc.name}`,
      content:     doc.description || '',
    });
  } catch (err) {
    console.warn('Server feed hook failed:', err?.message);
  }
});

module.exports = model('Server', s);
