const crudRouter = require('../utils/crudRouter');
const AIConversation = require('../models/AIConversation');
// privateRead: AI conversations are readable only by their own user.
module.exports = crudRouter(AIConversation, { ownerField: 'user_id', privateRead: true });
