const crudRouter = require('../utils/crudRouter');
const AIChatLog = require('../models/AIChatLog');
module.exports = crudRouter(AIChatLog);
