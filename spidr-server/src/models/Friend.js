const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:              { type: String, required: true, index: true },
  friend_id:            { type: String, required: true, index: true },
  // mirror info for display without extra lookup
  friend_name:          String,
  friend_discriminator: String,
  friend_avatar:        String,
  status: {
    type: String,
    enum: ['pending', 'pending_incoming', 'accepted', 'blocked'],
    default: 'pending',
    index: true,
  },
  nickname:    String,
  created_date:{ type: Date, default: Date.now },
}, { timestamps: true });
s.index({ user_id: 1, friend_id: 1 }, { unique: true, sparse: true });
module.exports = model('Friend', s);
