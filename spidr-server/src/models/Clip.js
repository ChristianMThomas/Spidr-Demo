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

// Emit a Feed event when a clip is freshly created.
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  try {
    const feedEvents = require('../utils/feedEvents');
    feedEvents.clipPosted({
      user_id:      doc.author_id,
      user_name:    doc.author_name || 'A user',
      user_avatar:  doc.author_avatar || '',
      clip_id:      doc._id.toString(),
      image_url:    doc.thumbnail_url || '',
      title:        doc.caption ? `Posted: ${doc.caption.slice(0, 80)}` : 'Posted a new clip',
    });
  } catch (err) {
    console.warn('Clip feed hook failed:', err?.message);
  }
});

// Track new-vs-update for the post-save hook above
s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

module.exports = model('Clip', s);
