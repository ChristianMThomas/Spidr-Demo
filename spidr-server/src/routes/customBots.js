const crudRouter = require('../utils/crudRouter');
const CustomBot = require('../models/CustomBot');
// is_official renders a bot as Spidr-endorsed. Before this was protected,
// POST /custom-bots {"is_official":true} minted a fake official bot.
module.exports = crudRouter(CustomBot, {
  ownerField: 'author_id',
  protectedFields: ['is_official'],
});
