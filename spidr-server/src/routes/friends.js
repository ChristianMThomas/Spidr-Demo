const crudRouter = require('../utils/crudRouter');
const Friend = require('../models/Friend');
module.exports = crudRouter(Friend);
