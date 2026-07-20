const crudRouter = require('../utils/crudRouter');
const Report = require('../models/Report');
// ownerField: 'reporter_id' — users can only PATCH/DELETE their own filed
// reports. Ideally reports are immutable after filing and moderator status
// updates go through a dedicated /admin/reports/:id/review route; this at
// least closes the "any user can edit anyone's report" vulnerability.
module.exports = crudRouter(Report, { ownerField: 'reporter_id' });
