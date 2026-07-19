const { Schema, model } = require('mongoose');

/**
 * SystemState — tiny key/value store for server-side bookkeeping that has no
 * natural home on a user doc (e.g. "which patch note was last announced").
 * One doc per key.
 */
const systemStateSchema = new Schema(
  {
    key:   { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

module.exports = model('SystemState', systemStateSchema);
