const { Schema, model } = require('mongoose');
const s = new Schema({
  sender_id:       { type: String, required: true, index: true },
  receiver_id:     { type: String, required: true, index: true },
  recipient_id:    { type: String, index: true },       // alias used by some frontend code
  conversation_id: { type: String, index: true },       // groups a DM thread
  sender_name:     String,
  sender_avatar:   String,
  content:         String,
  clip_id:         String,
  thumbnail:       String,
  caption:         String,
  author:          String,
  attachments:     [Schema.Types.Mixed],
  reactions:       { type: Schema.Types.Mixed, default: {} },
  is_read:         { type: Boolean, default: false },
  is_webbed:       { type: Boolean, default: false },   // "pinned"
  edited_at:       Date,
  text_effect:     { type: String, default: 'normal' },
  reply_to:        String,
  created_date:    { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('DirectMessage', s);
