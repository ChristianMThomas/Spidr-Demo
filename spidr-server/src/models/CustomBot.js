const { Schema, model } = require('mongoose');

/**
 * CustomBot — server-installable bots.
 *
 * Three flavors:
 *   • Built-in (author_id = 'spidr-official', code = 'builtin:<bot_id>'):
 *       Backed by a hardcoded handler in spidr-server/src/services/botEngine.js.
 *       These are the curated bots in the Bot Store (auto-mod, welcome, music, etc.).
 *   • User-coded (author_id = a real user, code = 'js:<sandboxed JS>'):
 *       A small JavaScript snippet that's run server-side against a frozen
 *       context (message, server, sender). The result is what the bot says.
 *   • Custom commands (author_id = a real user, commands = [{trigger, response}]):
 *       Simple trigger → response pairs without code, configured via UI.
 */
const s = new Schema({
  author_id:    { type: String, index: true },        // user_id of creator, or 'spidr-official'
  author_name:  String,
  owner_id:     String,                                // who owns this instance (for cloned bots)
  name:         { type: String, required: true },
  avatar_url:   String,
  icon_emoji:   String,                                // fallback when no avatar_url
  description:  String,
  category:     {
    type: String,
    enum: ['scientists', 'entertainers', 'guardians', 'utility', 'custom'],
    default: 'custom',
    index: true,
  },
  personality:  String,                                // optional persona prompt for AI-backed bots
  // Either `code` (JS snippet or 'builtin:xxx') OR `commands` (simple trigger-response) is set
  code:         String,
  commands:     { type: [Schema.Types.Mixed], default: [] },
  triggers:     { type: [Schema.Types.Mixed], default: [] },
  features:     { type: [String], default: [] },       // marketing bullet points
  install_count:{ type: Number, default: 0 },
  is_active:    { type: Boolean, default: true },
  is_public:    { type: Boolean, default: false },
  is_official:  { type: Boolean, default: false, index: true },
  status:       { type: String, default: 'active' },
  token:        String,
  created_date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = model('CustomBot', s);
