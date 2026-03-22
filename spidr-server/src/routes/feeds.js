const crudRouter = require('../utils/crudRouter');
const Feed = require('../models/Feed');
module.exports = crudRouter(Feed);
