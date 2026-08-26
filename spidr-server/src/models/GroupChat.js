const { Schema, model } = require('mongoose');
const s = new Schema({
  name:         String,
  owner_id:     { type: String, index: true },
  members:      [Schema.Types.Mixed],
  member_ids:   [String],
  icon_url:     String,   // legacy group pfp field
  // Group pfp — static image OR animated gif. The client has always written
  // avatar_url; it was missing from the schema so every pfp change was
  // silently dropped by strict mode (the "can't change group pfp" bug).
  avatar_url:   { type: String, default: '' },
  // Group banner — the wide header art (image or gif). Schema-first so the
  // settings PATCH isn't silently dropped by strict mode.
  banner_url:   { type: String, default: '' },
  description:  String,
  is_archived:  { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('GroupChat', s);
