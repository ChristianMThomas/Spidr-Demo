const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, required: true, index: true },
  content:      String,
  media_url:    String,
  media_type:   String,
  likes:        [String],
  tags:         [String],
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Feed', s);
