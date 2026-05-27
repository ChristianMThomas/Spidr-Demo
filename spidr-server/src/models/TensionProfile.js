const { Schema, model } = require('mongoose');

/**
 * TensionProfile — Spidr's gamified XP / leveling ledger.
 *
 * "Tension" is the Spidr-themed name for activity XP: the more you vibrate the
 * web (messaging, calling, catching flies, posting), the more tension you
 * build, and crossing a threshold "snaps" you up a level.
 *
 * One profile per user. XP is a monotonically increasing lifetime counter;
 * level is derived from it but cached on the doc so we don't recompute on every
 * read. Earning rules + the level curve live in /utils/tension.js — this schema
 * is a pure ledger, mirroring how BiomassWallet is structured.
 */
const tensionEventSchema = new Schema({
  amount:       Number,   // XP gained (always positive)
  reason:       String,   // human label ("Message sent", "Caught a fly")
  ref_id:       String,   // optional foreign key to whatever caused it
  created_date: { type: Date, default: Date.now },
}, { _id: false });

const tensionSchema = new Schema({
  user_id:      { type: String, required: true, index: true, unique: true },
  xp:           { type: Number, default: 0 },   // lifetime XP
  level:        { type: Number, default: 1 },   // cached, derived from xp
  // Per-source daily throttle counters so XP can't be farmed. Reset lazily when
  // the stored day key no longer matches today.
  daily_counts: { type: Map, of: Number, default: () => new Map() },
  daily_key:    { type: String, default: '' },  // YYYY-MM-DD this counter applies to
  // Rolling log of the last 50 XP events for the activity view.
  events:       { type: [tensionEventSchema], default: [] },
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('TensionProfile', tensionSchema);
