const { Schema, model } = require('mongoose');
const s = new Schema({
  name:          String,
  description:   String,
  author_id:     { type: String, index: true },
  code:          String,
  icon_url:      String,
  version:       { type: String, default: '1.0.0' },
  category:      String,
  tags:          [String],
  install_count: { type: Number, default: 0 },
  rating:        { type: Number, default: 0 },
  is_public:     { type: Boolean, default: false },
  payload:       String,
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Module', s);
