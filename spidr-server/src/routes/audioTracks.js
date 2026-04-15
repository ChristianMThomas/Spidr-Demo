const crudRouter = require('../utils/crudRouter');
const AudioTrack = require('../models/AudioTrack');
module.exports = crudRouter(AudioTrack);
