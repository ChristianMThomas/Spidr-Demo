const crudRouter = require('../utils/crudRouter');
const InstalledModule = require('../models/InstalledModule');
// privateRead: the client only ever filters by its own user_id, and install
// counts are aggregated server-side in utils/syncInstallCounts.js, so scoping
// reads here costs nothing.
module.exports = crudRouter(InstalledModule, { ownerField: 'user_id', privateRead: true });
