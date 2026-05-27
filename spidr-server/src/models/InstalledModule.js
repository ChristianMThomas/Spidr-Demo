const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, required: true, index: true },
  module_id:    String,
  config:       Schema.Types.Mixed,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('InstalledModule', s);
