const { Schema, model } = require('mongoose');

/**
 * Follow — a one-directional follow relationship on THE WEB.
 *
 * follower_id follows following_id. Unlike Friends (mutual, with accept/block
 * states), follows are instant and one-way, like a social-feed follow.
 *
 * The compound unique index prevents duplicate follows.
 */
const s = new Schema({
  follower_id:        { type: String, required: true, index: true },
  following_id:       { type: String, required: true, index: true },
  // Denormalized display fields so a follower list can render without a join.
  following_name:     { type: String, default: '' },
  following_avatar:   { type: String, default: '' },
  follower_name:      { type: String, default: '' },
  follower_avatar:    { type: String, default: '' },
  created_date:       { type: Date, default: Date.now },
}, { timestamps: true });

s.index({ follower_id: 1, following_id: 1 }, { unique: true });

module.exports = model('Follow', s);
