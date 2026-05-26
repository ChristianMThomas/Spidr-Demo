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
  // Crop region from the Spidr Studio cropper (Part 6): { x, y, width, height }
  // in the source video's natural pixels. Used to render the correct framing
  // in the feed (and could drive an FFmpeg crop=w:h:x:y filter if a transcode
  // pipeline is added later).
  crop_data:     { type: Schema.Types.Mixed, default: null },
  style:         { type: Schema.Types.Mixed, default: {} },

  // optional server promotion — when set, the clip shows a "Join Server" CTA
  // in the feed so creators can funnel viewers into their community.
  server_id:     { type: String, index: true },
  server_name:   String,
  server_icon:   String,

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

// Grant biomass for posting a clip. 100/clip, cap 200/day.
s.post('save', async function (doc) {
  if (!doc.wasNew) return;
  if (!doc.author_id) return;
  try {
    const biomass = require('../utils/biomass');
    await biomass.grant(doc.author_id, 100, 'Clip posted', doc._id.toString(), 'clip');
  } catch (err) {
    console.warn('Biomass grant on clip failed:', err?.message);
  }
});

// Track new-vs-update for the post-save hook above
s.pre('save', function (next) {
  this.wasNew = this.isNew;
  next();
});

module.exports = model('Clip', s);
