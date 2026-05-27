/**
 * seedDefaultModules.js — populates the Module Nexus with the official
 * Spidr modules on first server start.
 *
 * Idempotent: re-running won't create duplicates. Modules are matched by
 * name + author_id ('spidr-official').
 */
const Module = require('../models/Module');

const SPIDR_AUTHOR_ID = 'spidr-official';
const SPIDR_AUTHOR_NAME = 'Spidr';

// Each module is a (mostly) self-contained widget. The `payload` JSON is
// what DynamicModuleWidget reads on the client to render the actual widget.
const DEFAULT_MODULES = [
  {
    name: 'Gaming Uplink Card',
    description: 'A live gaming flex card with glowing animations showcasing what you’re currently playing, your main, and mastery stats.',
    type: 'display_widget',
    category: 'gaming',
    tags: ['gaming', 'flex', 'profile'],
    install_count: 208500,
    payload: JSON.stringify({
      title: 'Now Playing',
      stats: { main: 'Apex Predator', kd: '2.4', rank: 'Diamond' },
    }),
  },
  {
    name: 'Symbiote Entity Pet',
    description: 'A living, breathing liquid companion on your profile that reacts when visitors click or poke it. Feed it, anger it, watch it morph.',
    type: 'display_widget',
    category: 'fun',
    tags: ['pet', 'interactive', 'fun'],
    install_count: 112401,
    payload: JSON.stringify({ title: 'My Symbiote', mood: 'happy' }),
  },
  {
    name: 'Audio Resonance Player',
    description: 'A sleek music player with a live dancing equalizer. Visitors can play/pause to hear your profile’s theme song.',
    type: 'live_feed',
    category: 'audio',
    tags: ['music', 'audio', 'theme'],
    install_count: 85100,
    payload: JSON.stringify({ feed_title: 'Theme Song', items: [] }),
  },
  {
    name: 'Custom Quote Box',
    description: 'Pin your favorite quote, lyric, or motto to your profile card.',
    type: 'static_text',
    category: 'personalization',
    tags: ['quote', 'text', 'profile'],
    install_count: 42000,
    payload: JSON.stringify({ content: 'The web is woven from light.' }),
  },
  {
    name: 'Mood Ring',
    description: 'Set your current mood with animated emoji and color that tints your profile card.',
    type: 'display_widget',
    category: 'personalization',
    tags: ['mood', 'emoji', 'status'],
    install_count: 27500,
    payload: JSON.stringify({ title: 'Mood', subtitle: '✨ Vibing', content: 'Feeling creative today' }),
  },
  {
    name: 'Lo-fi Radio',
    description: 'Embed a mini lo-fi beats player on your profile for chill vibes.',
    type: 'live_feed',
    category: 'audio',
    tags: ['music', 'lofi', 'radio'],
    install_count: 21000,
    payload: JSON.stringify({ feed_title: 'Lo-fi Stream', items: [{ title: 'beats to study to', detail: 'live' }] }),
  },
  {
    name: 'Local Timezone Clock',
    description: 'Displays your local time so friends in other timezones always know when you’re awake.',
    type: 'display_widget',
    category: 'utility',
    tags: ['clock', 'time', 'utility'],
    install_count: 19800,
    payload: JSON.stringify({ title: 'Local Time', timezone: 'auto' }),
  },
  {
    name: 'Daily Streak Counter',
    description: 'Track how many consecutive days you’ve been active on Spidr.',
    type: 'display_widget',
    category: 'stats',
    tags: ['streak', 'stats', 'gamification'],
    install_count: 18600,
    payload: JSON.stringify({ title: 'Streak', stats: { current: '0', best: '0', total: '0' } }),
  },
  {
    name: 'Anime Watchlist',
    description: 'Display your current anime watchlist with progress bars and ratings.',
    type: 'static_text',
    category: 'media',
    tags: ['anime', 'watchlist', 'media'],
    install_count: 15300,
    payload: JSON.stringify({ content: 'No shows yet. Add one!' }),
  },
  {
    name: 'Spotify Now Playing',
    description: 'Display your current Spotify track on your profile with album art and progress bar.',
    type: 'api_sync',
    category: 'audio',
    tags: ['music', 'spotify', 'live'],
    install_count: 14201,
    payload: JSON.stringify({ query: 'Latest Spotify charts top track', service: 'spotify' }),
  },
  {
    name: 'Steam Now Playing',
    description: 'Show what game you’re currently playing on Steam with playtime stats.',
    type: 'api_sync',
    category: 'gaming',
    tags: ['gaming', 'steam', 'live'],
    install_count: 11400,
    payload: JSON.stringify({ query: 'Trending Steam games this week', service: 'steam' }),
  },
  {
    name: 'PC Specs Flex',
    description: 'Show off your rig specs — GPU, CPU, RAM, and storage in a clean card.',
    type: 'display_widget',
    category: 'gaming',
    tags: ['pc', 'specs', 'gaming'],
    install_count: 9201,
    payload: JSON.stringify({
      title: 'My Rig',
      stats: { gpu: 'RTX 4080', cpu: 'i9-13900K', ram: '64GB DDR5' },
    }),
  },
  {
    name: 'Weather Hex',
    description: 'A live weather card that fetches the current conditions for your area.',
    type: 'api_sync',
    category: 'utility',
    tags: ['weather', 'live', 'utility'],
    install_count: 7500,
    payload: JSON.stringify({ service: 'weather' }),
  },
];

async function seedDefaultModules() {
  try {
    let created = 0;
    let updated = 0;
    for (const def of DEFAULT_MODULES) {
      const existing = await Module.findOne({
        name: def.name,
        author_id: SPIDR_AUTHOR_ID,
      });
      if (existing) {
        // Update fields that may have changed, but preserve install_count
        // if it grew past our seed value (real users installed it).
        const realisticInstalls = Math.max(existing.install_count || 0, def.install_count || 0);
        await Module.updateOne(
          { _id: existing._id },
          {
            $set: {
              description: def.description,
              type: def.type,
              category: def.category,
              tags: def.tags,
              payload: def.payload,
              install_count: realisticInstalls,
              is_public: true,
              status: 'approved',
              author_name: SPIDR_AUTHOR_NAME,
            },
          }
        );
        updated++;
      } else {
        await Module.create({
          ...def,
          author_id: SPIDR_AUTHOR_ID,
          author_name: SPIDR_AUTHOR_NAME,
          is_public: true,
          status: 'approved',
          version: '1.0.0',
        });
        created++;
      }
    }
    if (created > 0 || updated > 0) {
      console.log(`✓ Module seed: ${created} created, ${updated} updated`);
    }
  } catch (err) {
    console.warn('Module seed failed:', err?.message);
  }
}

module.exports = { seedDefaultModules };
