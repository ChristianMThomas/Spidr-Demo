const { Schema, model } = require('mongoose');
const s = new Schema({
  server_id:    { type: String, required: true, index: true },
  actor_id:     String,
  action:       String,
  details:      Schema.Types.Mixed,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('ServerAuditLog', s);
