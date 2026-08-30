const { Schema, model } = require('mongoose');

/**
 * ConversationSettings — the container document DMs never had.
 *
 * Direct messages are loose rows sharing a conversation_id; there was no
 * document to hang shared per-conversation state on, which is why DM
 * wallpapers were originally stored per-user on each profile. That made them
 * private by construction — the other participant never saw your choice.
 *
 * This gives a conversation a real home, so a background set by either side
 * is shared, and any future per-conversation setting (nicknames, themes,
 * pinned notes) has somewhere to live without another migration.
 */
const s = new Schema({
  conversation_id: { type: String, required: true, unique: true, index: true },
  background_url:  { type: String, default: '' },
  // Who last changed it — used for the "X set the background" system row.
  updated_by:      { type: String, default: '' },
  updated_by_name: { type: String, default: '' },
  created_date:    { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('ConversationSettings', s);
