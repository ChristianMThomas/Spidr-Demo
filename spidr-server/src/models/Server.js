const { Schema, model } = require('mongoose');
const s = new Schema({
  name:          { type: String, required: true },
  description:   String,
  icon_url:      String,
  banner_url:    String,
  owner_id:      { type: String, required: true },
  members:       [Schema.Types.Mixed],
  channels:      [Schema.Types.Mixed],
  roles:         [Schema.Types.Mixed],
  muted_members: [String],
  timeouts:      [Schema.Types.Mixed],
  is_public:     { type: Boolean, default: true },
  invite_code:   String,
  created_date:  { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('Server', s);
