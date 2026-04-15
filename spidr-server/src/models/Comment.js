const { Schema, model } = require('mongoose');
const s = new Schema({
  clip_id:      { type: String, index: true },
  post_id:      { type: String, index: true },
  user_id:      { type: String, required: true, index: true },
  user_name:    String,
  user_avatar:  String,
  content:      String,
  attachments:  [Schema.Types.Mixed],
  likes:        [String],
  reactions:    { type: Schema.Types.Mixed, default: {} },
  reply_to:     String,
  is_pinned:    { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Comment', s);
