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

module.exports = model('Message', s);
