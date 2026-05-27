const crudRouter = require('../utils/crudRouter');
const InstalledModule = require('../models/InstalledModule');
module.exports = crudRouter(InstalledModule);
