const crudRouter = require('../utils/crudRouter');
const AIChatLog = require('../models/AIChatLog');
// privateRead: AI chat transcripts are readable only by their own user.
module.exports = crudRouter(AIChatLog, { ownerField: 'user_id', privateRead: true });
