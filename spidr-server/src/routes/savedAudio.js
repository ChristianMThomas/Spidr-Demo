const crudRouter = require('../utils/crudRouter');
const SavedAudio = require('../models/SavedAudio');
// privateRead: saved audio is per-user and not cross-readable.
module.exports = crudRouter(SavedAudio, { ownerField: 'user_id', privateRead: true });
