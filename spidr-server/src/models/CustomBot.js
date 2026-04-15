const { Schema, model } = require('mongoose');
const s = new Schema({
  author_id:    { type: String, index: true },
  owner_id:     String,
  name:         String,
  avatar_url:   String,
  description:  String,
  personality:  String,
  commands:     [Schema.Types.Mixed],
  triggers:     [Schema.Types.Mixed],
  is_active:    { type: Boolean, default: true },
  is_public:    { type: Boolean, default: false },
  status:       { type: String, default: 'active' },
  token:        String,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('CustomBot', s);
