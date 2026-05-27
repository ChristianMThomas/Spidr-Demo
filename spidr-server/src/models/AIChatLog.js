const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, required: true, index: true },
  conversation_id: String,
  role:         String,
  content:      String,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('AIChatLog', s);
