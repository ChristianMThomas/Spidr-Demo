const { Schema, model } = require('mongoose');

// Stripe delivers webhooks at-least-once. When our handler responds slowly
// (or the network flaps between Stripe and Railway), the same event id will
// arrive again minutes or hours later. We insert here BEFORE processing;
// a duplicate hits the unique index and the handler short-circuits with
// { received: true, duplicate: true } instead of double-applying the state
// change (e.g. re-flipping apex_tier or double-setting apex_first_activated_at,
// which would silently break trial-eligibility).
const s = new Schema({
  eventId:     { type: String, unique: true, required: true, index: true },
  type:        { type: String },
  processedAt: { type: Date, default: Date.now },
});

module.exports = model('StripeWebhookEvent', s);
