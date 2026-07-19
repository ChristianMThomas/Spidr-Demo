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
    name: "Gaming Uplink Card",
    description: "A live gaming flex card with glowing animations showcasing what you're currently playing, your main, and mastery stats.",
    type: "display_widget",
    category: "gaming",
    tags: ["gaming", "flex", "profile"],
    payload: JSON.stringify({
      title: "Now Playing",
      stats: { main: "Apex Predator", kd: "2.4", rank: "Diamond" },
    }),
  },
  {
    name: "Symbiote Entity Pet",
    description: "A living, breathing liquid companion on your profile that reacts when visitors click or poke it. Feed it, anger it, watch it morph.",
    type: "display_widget",
    category: "fun",
    tags: ["pet", "interactive", "fun"],
    payload: JSON.stringify({ title: "My Symbiote", mood: "happy" }),
  },
  {
    name: "Custom Quote Box",
    description: "Pin your favorite quote, lyric, or motto to your profile card.",
    type: "static_text",
    category: "personalization",
    tags: ["quote", "text", "profile"],
    payload: JSON.stringify({ content: "The web is woven from light." }),
  },
  {
    name: "Daily Streak Counter",
    description: "Track how many consecutive days you've been active on Spidr.",
    type: "display_widget",
    category: "stats",
    tags: ["streak", "stats", "gamification"],
    payload: JSON.stringify({ title: "Streak", stats: { current: "0", best: "0", total: "0" } }),
  },
  {
    name: "Spotify Now Playing",
    description: "Display your current Spotify track on your profile with album art and progress bar.",
    type: "api_sync",
    category: "audio",
    tags: ["music", "spotify", "live"],
    payload: JSON.stringify({ query: "Latest Spotify charts top track", service: "spotify" }),
  },
  {
    name: "Apple Music Now Playing",
    description: "Show what you're playing on Apple Music — connect your account, broadcast full-track DJ sessions, and let visitors see your latest spin.",
    type: "api_sync",
    category: "audio",
    tags: ["music", "apple music", "live"],
    payload: JSON.stringify({ query: "Apple Music top charts", service: "apple_music" }),
  },
  {
    name: "Steam Now Playing",
    description: "Show what game you're currently playing on Steam with playtime stats.",
    type: "api_sync",
    category: "gaming",
    tags: ["gaming", "steam", "live"],
    payload: JSON.stringify({ query: "Trending Steam games this week", service: "steam" }),
  },
  {
    name: "PC Specs Flex",
    description: "Show off your rig specs — GPU, CPU, RAM, and storage in a clean card.",
    type: "display_widget",
    category: "gaming",
    tags: ["pc", "specs", "gaming"],
    payload: JSON.stringify({
      title: "My Rig",
      stats: { gpu: "RTX 4080", cpu: "i9-13900K", ram: "64GB DDR5" },
    }),
  },
  {
    name: "Weather Hex",
    description: "A live weather card that fetches the current conditions for your area.",
    type: "api_sync",
    category: "utility",
    tags: ["weather", "live", "utility"],
    payload: JSON.stringify({ service: "weather" }),
  },
];

// Modules that used to ship but have been retired. On boot we hard-delete
// them so their card stops appearing in the Module Nexus and they can't be
// installed on any new profile.
const RETIRED_MODULES = ["Lo-fi Radio"];

async function seedDefaultModules() {
  try {
    let created = 0;
    let updated = 0;
    let retired = 0;
    for (const name of RETIRED_MODULES) {
      const res = await Module.deleteMany({ name, author_id: SPIDR_AUTHOR_ID });
      retired += res.deletedCount || 0;
    }
    for (const def of DEFAULT_MODULES) {
      const existing = await Module.findOne({
        name: def.name,
        author_id: SPIDR_AUTHOR_ID,
      });
      if (existing) {
        // Update metadata fields only — install_count is managed by
        // syncInstallCounts and the install/uninstall endpoints.
        await Module.updateOne(
          { _id: existing._id },
          {
            $set: {
              description: def.description,
              type: def.type,
              category: def.category,
              tags: def.tags,
              payload: def.payload,
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
    if (created > 0 || updated > 0 || retired > 0) {
      console.log(`✓ Module seed: ${created} created, ${updated} updated, ${retired} retired`);
    }
  } catch (err) {
    console.warn('Module seed failed:', err?.message);
  }
}

module.exports = { seedDefaultModules };
