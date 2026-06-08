const Module = require('../models/Module');
const InstalledModule = require('../models/InstalledModule');

async function syncInstallCounts() {
  try {
    const counts = await InstalledModule.aggregate([
      { $group: { _id: '$module_id', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const { _id, count } of counts) {
      if (_id) countMap[String(_id)] = count;
    }

    const allModules = await Module.find({}, '_id').lean();
    const ops = allModules.map(({ _id }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { install_count: countMap[String(_id)] || 0 } },
      },
    }));

    if (ops.length > 0) {
      await Module.bulkWrite(ops, { ordered: false });
    }

    const withInstalls = Object.keys(countMap).length;
    console.log(`✓ Install counts synced (${withInstalls} module${withInstalls !== 1 ? 's' : ''} have installs)`);
  } catch (err) {
    console.warn('Install count sync failed:', err?.message);
  }
}

module.exports = { syncInstallCounts };
