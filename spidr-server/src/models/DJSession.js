const { Schema, model } = require('mongoose');

const s = new Schema({
  channel_id:      { type: String, required: true, unique: true, index: true },
  host_id:         { type: String, required: true, index: true },
  host_user_name:  String,
  host_user_avatar:String,
  track_id:        { type: String, required: true },
  started_at:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('DJSession', s);
