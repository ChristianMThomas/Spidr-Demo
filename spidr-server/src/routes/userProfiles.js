const crudRouter = require('../utils/crudRouter');
const UserProfile = require('../models/UserProfile');
module.exports = crudRouter(UserProfile);
