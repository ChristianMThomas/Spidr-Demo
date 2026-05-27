const { Schema, model } = require('mongoose');
const s = new Schema({
  user_id:      { type: String, index: true },
  author_id:    { type: String, index: true },
  author_name:  String,
  author_avatar:String,
  name:         String,
  type:         { type: String, index: true }, // 'gif' | 'emoji' | 'sticker'
  url:          String,
  tags:         [String],
  likes:        [String],
  is_public:    { type: Boolean, default: true },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('CommunityAsset', s);
