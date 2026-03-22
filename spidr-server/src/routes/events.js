const crudRouter = require('../utils/crudRouter');
const Event = require('../models/Event');
module.exports = crudRouter(Event);
