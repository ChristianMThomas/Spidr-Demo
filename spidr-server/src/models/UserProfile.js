const { Schema, model } = require('mongoose');

function genDiscriminator() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * 36)]).join('');
}

const s = new Schema({
  user_id:        { type: String, required: true, index: true, unique: true },

  // display
  display_name:   String,
  bio:            String,
  avatar_url:     String,
  banner_url:     String,
  discriminator:  { type: String },
  status:         { type: String, enum: ['online','idle','dnd','offline','streaming'], default: 'online' },
  custom_status:  String,

  // style
  accent_color:     { type: String, default: '#dc2626' },
  profile_gradient: String,
  profile_pattern:  { type: String, default: 'none' },
  profile_frame:    { type: String, default: 'default' },

  // username display customization (free for all users)
  username_font:    { type: String, default: 'default' },   // default, serif, mono, display, handwriting
  username_weight:  { type: String, default: 'bold' },      // normal, medium, bold, black
  username_style:   { type: String, default: 'normal' },    // normal, italic
  username_color:   { type: String, default: '' },          // optional explicit color (falls back to accent_color)
  username_effect:  { type: String, default: 'none' },      // none, glow, gradient, rainbow, pulse, shimmer

  // presence
  last_seen:        { type: Date, default: Date.now },

  // subscriptions / features
  apex_tier:      { type: String, enum: ['free','apex'], default: 'free' },
  apex_features:  { type: Schema.Types.Mixed, default: {} },
  thread_skin:    String,
  squad_overclock:{ type: Boolean, default: false },
  deep_storage:   { type: Boolean, default: false },
  entry_protocol: String,
  activated_at:   Date,
  plan_type:      String,
  app_theme:      { type: Schema.Types.Mixed, default: null },

  // metadata
  links:          [{ title: String, url: String }],
  badges:         [String],
  modules:        [Schema.Types.Mixed],

  // moderation
  is_banned:      { type: Boolean, default: false },
  ban_reason:     String,
  ban_until:      Date,
  banned_by:      String,
  ban_report_id:  String,

  // THE WEB / feed profile
  web_bio:        String,
  web_hashtags:   [String],

  // PC widget
  pc_specs:       { type: Schema.Types.Mixed, default: {} },
  neural_links:   { type: Schema.Types.Mixed, default: {} },

  created_date:   { type: Date, default: Date.now },
}, { timestamps: true });

s.pre('save', function (next) {
  if (!this.discriminator) this.discriminator = genDiscriminator();
  next();
});

s.pre(['findOneAndUpdate', 'findByIdAndUpdate'], async function (next) {
  try {
    const update = this.getUpdate();
    const $set = update.$set || {};
    if (!$set.discriminator) {
      const doc = await this.model.findOne(this.getFilter()).select('discriminator').lean();
      if (!doc?.discriminator) {
        if (!update.$set) update.$set = {};
        update.$set.discriminator = genDiscriminator();
      }
    }

    // Capture the pre-update state so we can diff against it in post-update.
    // Stash it on `this` (the query) — Mongoose makes it available to the
    // post-hook via `this._preUpdateSnapshot`.
    const snapshot = await this.model.findOne(this.getFilter())
      .select('user_id display_name bio avatar_url banner_url username_color username_effect pronouns')
      .lean();
    this._preUpdateSnapshot = snapshot;

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * After a profile update, diff against the pre-update snapshot. If any of
 * the "meaningful" fields changed, fire a feed event visible to the user's
 * friends.
 *
 * "Meaningful" = display_name, bio, avatar_url, banner_url, username_color,
 * username_effect, pronouns. Status changes, last_seen ticks, presence
 * pings, and APEX field flips do NOT generate feed entries — those happen
 * constantly and would spam the feed.
 *
 * Rate-limited to one feed event per user per 5 minutes — if someone is
 * actively tweaking their profile, only the first change in a window fires
 * to avoid spamming friends with "X updated their profile" 10 times.
 */
const TRACKED_FIELDS = [
  'display_name', 'bio', 'avatar_url', 'banner_url',
  'username_color', 'username_effect', 'pronouns',
];
const profileUpdateRateLimit = new Map(); // user_id → last-emitted timestamp
const PROFILE_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;

s.post(['findOneAndUpdate', 'findByIdAndUpdate'], async function (result) {
  if (!result) return;
  const before = this._preUpdateSnapshot;
  if (!before) return; // nothing to compare against (first save)

  try {
    // Determine the "after" values for each tracked field. Prefer the update's
    // $set payload (which we KNOW is the user's intent) and fall back to the
    // returned document. This works whether the query was called with
    // {new: true} (returns post-update doc) or not (returns pre-update doc).
    const update = this.getUpdate() || {};
    const $set = update.$set || update;

    const changed = TRACKED_FIELDS.filter(field => {
      const a = before[field];
      const explicit = $set[field];
      const b = explicit !== undefined ? explicit : result[field];
      const norm = (v) => (v === null || v === undefined ? '' : String(v));
      return norm(a) !== norm(b);
    });
    if (changed.length === 0) return;

    const userId = result.user_id || before.user_id;
    if (!userId) return;

    // Resolve audience FIRST — if the user has no friends, there's nothing to
    // emit, and we shouldn't consume a rate-limit slot for a no-op.
    const Friend = require('./Friend');
    const friendDocs = await Friend.find({
      user_id: userId,
      status: 'accepted',
    }).select('friend_id').lean();
    const recipients = friendDocs.map(f => f.friend_id).filter(Boolean);
    if (recipients.length === 0) return;

    // Rate-limit: one feed event per user per 5 minutes
    const lastEmit = profileUpdateRateLimit.get(userId) || 0;
    if (Date.now() - lastEmit < PROFILE_UPDATE_COOLDOWN_MS) return;
    profileUpdateRateLimit.set(userId, Date.now());

    const feedEvents = require('../utils/feedEvents');
    feedEvents.profileUpdate({
      user_id:     userId,
      user_name:   ($set.display_name !== undefined ? $set.display_name : result.display_name) || before.display_name || 'A friend',
      user_avatar: ($set.avatar_url   !== undefined ? $set.avatar_url   : result.avatar_url)   || before.avatar_url   || '',
      recipient_ids: recipients,
      changed,
    });
  } catch (err) {
    console.warn('Profile update feed hook failed:', err?.message);
  }
});

module.exports = model('UserProfile', s);
