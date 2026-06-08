const Module = require('../models/Module');

// Official modules that have been retired — removed from seed and deleted from DB on startup.
const REMOVED_MODULE_NAMES = [
  'Mood Ring',
  'Audio Resonance Player',
  'Local Timezone Clock',
];

async function cleanupRemovedModules() {
  try {
    const result = await Module.deleteMany({
      name: { $in: REMOVED_MODULE_NAMES },
      author_id: 'spidr-official',
    });
    if (result.deletedCount > 0) {
      console.log(`✓ Removed ${result.deletedCount} retired module(s) from DB`);
    }
  } catch (err) {
    console.warn('Module cleanup failed:', err?.message);
  }
}

module.exports = { cleanupRemovedModules };
