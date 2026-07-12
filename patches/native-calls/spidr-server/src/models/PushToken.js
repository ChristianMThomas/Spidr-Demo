const { Schema, model } = require('mongoose');

/**
 * Device push tokens for native mobile clients (Patch 1.9.x calls).
 * One row per device token; a user can have several devices. FCM covers both
 * Android and iOS (regular pushes). `apns-voip` is reserved for the future
 * PushKit path once an Apple Developer account exists.
 */
const s = new Schema({
  user_id:  { type: String, required: true, index: true },
  token:    { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  provider: { type: String, enum: ['fcm', 'apns-voip'], default: 'fcm' },
}, { timestamps: true });

module.exports = model('PushToken', s);
