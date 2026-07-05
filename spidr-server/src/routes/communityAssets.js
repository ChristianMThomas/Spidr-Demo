const crudRouter = require('../utils/crudRouter');
const CommunityAsset = require('../models/CommunityAsset');
module.exports = crudRouter(CommunityAsset, { ownerField: ['user_id', 'author_id'] });
