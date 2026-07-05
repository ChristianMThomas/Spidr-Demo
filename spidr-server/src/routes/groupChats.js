const crudRouter = require('../utils/crudRouter');
const GroupChat = require('../models/GroupChat');
module.exports = crudRouter(GroupChat, { ownerField: 'owner_id' });
