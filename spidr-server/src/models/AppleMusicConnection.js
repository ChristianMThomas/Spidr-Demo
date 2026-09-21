const { Schema, model } = require('mongoose');

// Never expose credentials through the public profile CRUD endpoints.
module.exports = model('AppleMusicConnection', new Schema({
  user_id: { type: String, required: true, unique: true },
  user_token: { type: String, required: true, select: false },
  storefront: { type: String, required: true },
  connected_at: { type: Date, default: Date.now },
}));
