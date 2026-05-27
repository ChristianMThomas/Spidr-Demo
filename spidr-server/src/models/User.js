const { Schema, model } = require('mongoose');
const s = new Schema({
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  username:     { type: String, unique: true, sparse: true },
  full_name:    String,
  avatar_url:   String,
  banner_url:   String,
  bio:          String,
  status:       { type: String, default: 'online' },
  is_banned:    { type: Boolean, default: false },
  is_verified:  { type: Boolean, default: false },
  twoFactorMethod: { type: String, enum: ['none','email','totp'], default: 'none' },
  twoFactorSecret: { type: String },
  ban_until:    Date,
  ban_reason:   String,
  role:         { type: String, default: 'user' },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = model('User', s);
