const crudRouter = require('../utils/crudRouter');
const VoiceSession = require('../models/VoiceSession');
module.exports = crudRouter(VoiceSession);
