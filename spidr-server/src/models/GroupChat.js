const { Schema, model } = require('mongoose');
const s = new Schema({
  name:         String,
  owner_id:     { type: String, index: true },
  members:      [Schema.Types.Mixed],
  member_ids:   [String],
  icon_url:     String,
  description:  String,
  is_archived:  { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('GroupChat', s);
