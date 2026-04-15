const { Schema, model } = require('mongoose');
const s = new Schema({
  server_id:    String,
  creator_id:   String,
  title:        String,
  description:  String,
  starts_at:    Date,
  ends_at:      Date,
  attendees:    [String],
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Event', s);
