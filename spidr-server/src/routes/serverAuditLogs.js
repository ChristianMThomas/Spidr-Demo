const crudRouter = require('../utils/crudRouter');
const ServerAuditLog = require('../models/ServerAuditLog');
module.exports = crudRouter(ServerAuditLog);
