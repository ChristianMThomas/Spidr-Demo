const crudRouter = require('../utils/crudRouter');
const Collection = require('../models/Collection');
// privateRead: a user's saved collections are their own business.
module.exports = crudRouter(Collection, { ownerField: 'user_id', privateRead: true });
