const { Schema, model } = require('mongoose');

const schema = new Schema({
  user_id: { type: String, required: true },
  source_type: { type: String, enum: ['dm', 'group', 'server'], required: true },
  message_id: { type: String, required: true },
  context_id: String,
  channel_id: String,
  context_name: String,
  sender_name: String,
  sender_avatar: String,
  content: String,
  attachments: [Schema.Types.Mixed],
  message_created_at: Date,
}, { timestamps: true });

schema.index({ user_id: 1, source_type: 1, message_id: 1 }, { unique: true });
schema.index({ user_id: 1, _id: -1 });
module.exports = model('SavedMessage', schema);
