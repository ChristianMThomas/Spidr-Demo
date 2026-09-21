const { Schema, model } = require('mongoose');
const schema = new Schema({
  user_id: { type: String, required: true },
  scope: { type: String, enum: ['server', 'channel', 'group'], required: true },
  context_id: { type: String, required: true },
  read_at: { type: Date, required: true },
});
schema.index({ user_id: 1, scope: 1, context_id: 1 }, { unique: true });
module.exports = model('ReadState', schema);
