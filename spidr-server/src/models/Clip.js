const { Schema, model } = require('mongoose');
const s = new Schema({
  // author info
  author_id:     { type: String, index: true },
  author_name:   String,
  author_avatar: String,

  // content
  video_url:     String,
  thumbnail_url: String,
  caption:       String,
  hashtags:      [String],
  audio_id:      String,
  duration:      { type: Number, default: 0 },
  aspect_ratio:  { type: String, default: '9:16' },
  style:         { type: Schema.Types.Mixed, default: {} },

  // engagement
  likes:          [String],          // array of user_ids
  reactions:      { type: Schema.Types.Mixed, default: {} },
  comments_count: { type: Number, default: 0 },
  shares_count:   { type: Number, default: 0 },
  views:          { type: Number, default: 0 },

  // ML scoring
  engagement_scores: {
    avg:   { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },

  created_date: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
module.exports = model('Clip', s);
