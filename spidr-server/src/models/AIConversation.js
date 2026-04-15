const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, required: true, index: true },
  title:        String,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('AIConversation', s);
