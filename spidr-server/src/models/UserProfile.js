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
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = model('UserProfile', s);
