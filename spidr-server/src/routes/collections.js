const crudRouter = require('../utils/crudRouter');
const Collection = require('../models/Collection');
module.exports = crudRouter(Collection);
