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
    install_count: 12400,
  },
  {
    name: 'Data Analyst',
    description: 'Analyze server statistics and generate reports on demand.',
    category: 'scientists',
    icon_emoji: '📊',
    code: 'builtin:data-analyst',
    features: ['Analytics dashboard', 'Custom reports', 'Trend analysis'],
    commands: [
      { trigger: '/stats', description: 'Show server stats overview' },
      { trigger: '/top', description: 'Show top active members this week' },
    ],
    install_count: 5200,
  },

  // ── Entertainers ──────────────────────────────────────────────────────────
  {
    name: 'Music Master',
    description: 'Queue and play music from YouTube/SoundCloud links in voice channels.',
    category: 'entertainers',
    icon_emoji: '🎵',
    code: 'builtin:music-master',
    features: ['Multi-platform support', 'Playlist creation', 'Queue management'],
    commands: [
      { trigger: '/play', description: 'Play a song or add to queue' },
      { trigger: '/skip', description: 'Skip the current song' },
      { trigger: '/queue', description: 'Show the current queue' },
      { trigger: '/stop', description: 'Stop playback and clear queue' },
    ],
    install_count: 18700,
  },
  {
    name: 'Game Master',
    description: 'Host interactive games and trivia for your community.',
    category: 'entertainers',
    icon_emoji: '🎮',
    code: 'builtin:game-master',
    features: ['Trivia games', 'Leaderboards', 'Custom games'],
    commands: [
      { trigger: '/trivia', description: 'Start a trivia round' },
      { trigger: '/roll', description: 'Roll a die (default d6)' },
      { trigger: '/8ball', description: 'Magic 8-ball answer' },
      { trigger: '/coinflip', description: 'Flip a coin' },
    ],
    install_count: 11300,
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
    install_count: 22100,
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
    install_count: 9800,
  },
];

async function seedDefaultBots() {
  try {
    let created = 0;
    let updated = 0;
    for (const def of DEFAULT_BOTS) {
      const existing = await CustomBot.findOne({
        name: def.name,
        author_id: SPIDR_AUTHOR_ID,
      });
      if (existing) {
        const realisticInstalls = Math.max(existing.install_count || 0, def.install_count || 0);
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
              install_count: realisticInstalls,
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
