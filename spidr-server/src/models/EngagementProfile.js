const { Schema, model } = require('mongoose');

/**
 * Stores per-user engagement signals for ML-based FYP personalization.
 * Updated every time the user watches, likes, shares, or comments on a clip.
 */
const s = new Schema({
  user_id:     { type: String, required: true, unique: true, index: true },

  // Hashtag affinity map: { "tag": score } — higher = more interested
  tag_scores:  { type: Schema.Types.Mixed, default: {} },

  // Author affinity: { "author_id": watchCount } — friend-of-creator boost
  author_scores: { type: Schema.Types.Mixed, default: {} },

  // Audio affinity: tracks which audio IDs they replay
  audio_scores: { type: Schema.Types.Mixed, default: {} },

  // Total clips watched + average completion rate (for cold-start baseline)
  total_watched:   { type: Number, default: 0 },
  avg_completion:  { type: Number, default: 0 },

  updated_at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('EngagementProfile', s);
