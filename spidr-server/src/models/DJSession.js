const { Schema, model } = require('mongoose');

const s = new Schema({
  channel_id:      { type: String, required: true, unique: true, index: true },
  host_id:         { type: String, required: true, index: true },
  host_user_name:  String,
  host_user_avatar:String,
  track_id:        { type: String, required: true },
  // Full track metadata cached at start/next time (schema-first — Mongoose
  // strict mode drops unknown fields). This is what lets every listener's
  // client actually PLAY audio: the 30s preview URL is broadcast with the
  // session instead of listeners passively watching the host's now-playing.
  track_name:      { type: String, default: '' },
  track_artist:    { type: String, default: '' },
  album_art_url:   { type: String, default: '' },
  preview_url:     { type: String, default: '' },
  external_url:    { type: String, default: '' },
  duration_ms:     { type: Number, default: 0 },
  started_at:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('DJSession', s);
