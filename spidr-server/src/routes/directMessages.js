const crudRouter = require('../utils/crudRouter');
const DirectMessage = require('../models/DirectMessage');
module.exports = crudRouter(DirectMessage);
