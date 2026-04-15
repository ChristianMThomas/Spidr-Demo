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
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('GroupChatMessage', s);
