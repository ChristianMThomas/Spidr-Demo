const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:          { type: String, required: true, index: true },
  user_name:        String,
  user_avatar:      String,
  server_id:        { type: String, index: true },
  channel_id:       { type: String, index: true },
  group_id:         String,
  conversation_id:  String,
  is_muted:         { type: Boolean, default: false },
  is_deafened:      { type: Boolean, default: false },
  is_video_on:      { type: Boolean, default: false },
  is_screen_sharing:{ type: Boolean, default: false },
  is_spidr_ai:      { type: Boolean, default: false },
  stream_url:       String,
  stream_type:      String,
  created_date:     { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('VoiceSession', s);
