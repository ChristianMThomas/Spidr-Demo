const crudRouter = require('../utils/crudRouter');
const Comment = require('../models/Comment');
module.exports = crudRouter(Comment, { ownerField: 'user_id' });
