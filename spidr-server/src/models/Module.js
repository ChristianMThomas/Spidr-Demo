const { Schema, model } = require('mongoose');
const s = new Schema({
  name:          { type: String, required: true },
  description:   String,
  author_id:     { type: String, index: true },
  author_name:   String,
  type: {
    type: String,
    enum: ['static_text', 'display_widget', 'api_sync', 'live_feed'],
    default: 'static_text',
  },
  code:          String,
  icon_url:      String,
  version:       { type: String, default: '1.0.0' },
  category:      String,
  tags:          [String],
  install_count: { type: Number, default: 0 },
  rating:        { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['approved', 'pending', 'flagged', 'rejected'],
    default: 'approved',
    index: true,
  },
  is_public:     { type: Boolean, default: true },
  payload:       String,  // JSON config string consumed by DynamicModuleWidget
  reports:       { type: [Schema.Types.Mixed], default: [] },
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Module', s);
