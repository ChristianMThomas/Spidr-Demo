const crudRouter = require('../utils/crudRouter');
const AIConversation = require('../models/AIConversation');
module.exports = crudRouter(AIConversation);
