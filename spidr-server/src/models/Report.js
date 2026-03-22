const { Schema, model } = require('mongoose');
const s = new Schema({
  reporter_id:   { type: String, required: true, index: true },
  server_id:     { type: String, index: true },
  target_id:     String,
  target_type:   String,
  target_name:   String,
  target_content:String,
  reason:        String,
  details:       String,
  evidence_url:  String,
  status:        { type: String, enum: ['pending','reviewed','resolved','dismissed'], default: 'pending', index: true },
  reviewer_id:   String,
  review_notes:  String,
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Report', s);
