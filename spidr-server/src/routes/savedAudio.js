const crudRouter = require('../utils/crudRouter');
const SavedAudio = require('../models/SavedAudio');
module.exports = crudRouter(SavedAudio);
