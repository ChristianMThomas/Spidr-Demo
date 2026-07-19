const { Schema, model } = require('mongoose');

// WebMessage — "Sling to DM" on THE WEB. A lightweight, separate inbox for
// sharing clips user-to-user WITHOUT touching the main app DMs (so post
// sharing never floods real conversations). One doc per slung post.
const s = new Schema({
  sender_id:     { type: String, required: true, index: true },
  sender_name:   { type: String, default: '' },
  sender_avatar: { type: String, default: '' },
  recipient_id:  { type: String, required: true, index: true },
  clip_id:       { type: String, required: true },
  // Cached clip preview so the inbox renders without N extra clip fetches.
  clip_title:    { type: String, default: '' },
  clip_thumb:    { type: String, default: '' },
  note:          { type: String, default: '' },   // optional message with the sling
  read:          { type: Boolean, default: false, index: true },
}, { timestamps: true });

s.index({ recipient_id: 1, createdAt: -1 });

module.exports = model('WebMessage', s);
