const { Schema, model } = require('mongoose');

module.exports = model('AppleMusicLink', new Schema({
  user_id: { type: String, required: true, index: true },
  token_hash: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true, expires: 0 },
}));
