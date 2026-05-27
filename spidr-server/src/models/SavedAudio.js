const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:       { type: String, required: true, index: true },
  audio_id:      { type: String, index: true },
  audio_track_id:String,
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('SavedAudio', s);
