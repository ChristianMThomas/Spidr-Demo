const crudRouter = require('../utils/crudRouter');
const Message = require('../models/Message');
module.exports = crudRouter(Message);
