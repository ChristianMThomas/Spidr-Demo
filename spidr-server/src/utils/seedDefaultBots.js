/**
 * seedDefaultBots.js — populates the Bot Store with official Spidr bots.
 *
 * Each official bot has code = 'builtin:<id>'. The server's botEngine resolves
 * those handlers at runtime. Users install bots into their servers, which adds
 * a row to the server's `bots` list; the bot then participates in chat.
 *
 * Idempotent — matched by name + author_id ('spidr-official').
 */
const CustomBot = require('../models/CustomBot');

const SPIDR_AUTHOR_ID = 'spidr-official';
const SPIDR_AUTHOR_NAME = 'Spidr';

const DEFAULT_BOTS = [
  // ── Scientists ────────────────────────────────────────────────────────────
  {
    name: 'Spidr AI Assistant',
    description: 'Intelligent chatbot with knowledge retrieval and task automation. Mention @spidr in chat to ask anything.',
    category: 'scientists',
    icon_emoji: '🧠',
    code: 'builtin:spidr-ai',
    features: ['Natural language processing', 'Context awareness', 'Task scheduling'],
    commands: [
      { trigger: '/ask', description: 'Ask Spidr AI a question' },
      { trigger: '/summarize', description: 'Summarize the last N messages' },
    ],
    triggers: [{ pattern: '^@spidr\\b', kind: 'mention' }],
  },
  // ── Guardians ─────────────────────────────────────────────────────────────
  {
    name: 'Auto Moderator',
    description: 'Spam detection, slur filtering, and configurable auto-actions on bad messages.',
    category: 'guardians',
    icon_emoji: '🛡️',
    code: 'builtin:auto-moderator',
    features: ['Spam filtering', 'Slur detection', 'Configurable thresholds', 'Audit log'],
    commands: [
      { trigger: '/modset', description: 'Configure moderation thresholds' },
      { trigger: '/modlog', description: 'Show recent auto-actions' },
    ],
  },
  {
    name: 'Welcome Bot',
    description: 'Greet new members and auto-assign roles when they join.',
    category: 'guardians',
    icon_emoji: '👋',
    code: 'builtin:welcome-bot',
    features: ['Custom welcome messages', 'Auto-role assignment', 'DM greetings'],
    commands: [
      { trigger: '/welcomeset', description: 'Set the welcome message template' },
    ],
  },
];

async function seedDefaultBots() {
  try {
    // One-time: clear legacy seeded install counts so the display shows real installs only.
    // After this runs, install_count is no longer touched during updates — it only grows
    // via the BotLaboratory install flow.
    await CustomBot.updateMany(
      { author_id: SPIDR_AUTHOR_ID, install_count: { $gt: 0 } },
      { $set: { install_count: 0 } }
    );

    // Retired bots — Music Master + Game Master were pulled in 1.9.2. Seed is
    // upsert-only, so the existing DB rows would otherwise linger forever and
    // keep showing up in the Bot Laboratory. Purge them by name + author here.
    await CustomBot.deleteMany({
      author_id: SPIDR_AUTHOR_ID,
      name: { $in: ['Music Master', 'Game Master', 'Data Analyst'] },
    });

    let created = 0;
    let updated = 0;
    for (const def of DEFAULT_BOTS) {
      const existing = await CustomBot.findOne({
        name: def.name,
        author_id: SPIDR_AUTHOR_ID,
      });
      if (existing) {
        await CustomBot.updateOne(
          { _id: existing._id },
          {
            $set: {
              description: def.description,
              category: def.category,
              icon_emoji: def.icon_emoji,
              code: def.code,
              features: def.features || [],
              commands: def.commands || [],
              triggers: def.triggers || [],
              is_active: true,
              is_public: true,
              is_official: true,
              author_name: SPIDR_AUTHOR_NAME,
              status: 'active',
            },
          }
        );
        updated++;
      } else {
        await CustomBot.create({
          ...def,
          install_count: 0,
          author_id: SPIDR_AUTHOR_ID,
          author_name: SPIDR_AUTHOR_NAME,
          owner_id: SPIDR_AUTHOR_ID,
          is_active: true,
          is_public: true,
          is_official: true,
          status: 'active',
        });
        created++;
      }
    }
    if (created > 0 || updated > 0) {
      console.log(`✓ Bot seed: ${created} created, ${updated} updated`);
    }
  } catch (err) {
    console.warn('Bot seed failed:', err?.message);
  }
}

module.exports = { seedDefaultBots, DEFAULT_BOTS };
