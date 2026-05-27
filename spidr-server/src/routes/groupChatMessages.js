const crudRouter = require('../utils/crudRouter');
const GroupChatMessage = require('../models/GroupChatMessage');
module.exports = crudRouter(GroupChatMessage);
