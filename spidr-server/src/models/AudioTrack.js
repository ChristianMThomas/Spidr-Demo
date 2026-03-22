const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, index: true },
  uploader_id:  { type: String, index: true },
  title:        String,
  artist:       String,
  url:          String,
  cover_url:    String,
  duration:     Number,
  tags:         [String],
  bpm:          Number,
  genre:        String,
  use_count:    { type: Number, default: 0 },
  save_count:   { type: Number, default: 0 },
  is_original:  { type: Boolean, default: false },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('AudioTrack', s);
