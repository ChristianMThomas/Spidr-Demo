const crudRouter = require('../utils/crudRouter');
const Server = require('../models/Server');
module.exports = crudRouter(Server);
