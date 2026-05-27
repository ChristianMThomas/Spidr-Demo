const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, required: true, index: true },
  name:         String,
  description:  String,
  cover_url:    String,
  clip_ids:     [String],
  items:        [Schema.Types.Mixed],
  is_public:    { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Collection', s);
