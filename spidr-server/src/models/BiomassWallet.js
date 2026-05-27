const { Schema, model } = require('mongoose');

/**
 * BiomassWallet — Spidr's in-app currency ledger.
 *
 * One wallet per user. Balances are integers (no fractional biomass).
 * The transactions array is a rolling log of recent activity for the
 * user's history view; we cap it at 50 entries to keep documents small.
 *
 * Earning rules live in /utils/biomass.js — schema is a pure ledger.
 */
const transactionSchema = new Schema({
  amount:      Number,             // positive = earn, negative = spend
  reason:      String,             // human label ("Daily login", "Bought neon effect")
  ref_id:      String,             // optional foreign key to whatever caused it
  created_date: { type: Date, default: Date.now },
}, { _id: false });

const walletSchema = new Schema({
  user_id:           { type: String, required: true, index: true, unique: true },
  balance:           { type: Number, default: 0 },
  lifetime_earned:   { type: Number, default: 0 },
  last_daily_claim:  { type: Date },
  // Rolling log of last 50 transactions. Older ones get shifted out.
  transactions:      { type: [transactionSchema], default: [] },
  // Inventory of unlocked items. Keys are item ids; value is { unlocked_at }.
  inventory:         { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  created_date:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('BiomassWallet', walletSchema);
