const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const music = require('../src/utils/appleMusicService');

(async () => {
  const config = music.configuration();
  if (!config.configured) throw music.failure(503, config.error, config.code);
  const developer = music.developerToken();
  console.log('Apple Music signing configured. Token expires:', new Date(developer.expiresAt).toISOString());
  if (process.argv.includes('--live')) {
    const data = await music.appleRequest('/catalog/us/charts?types=songs&limit=1');
    if (!data.results) throw new Error('Apple returned an unexpected catalog response.');
    console.log('Apple Music catalog authentication succeeded.');
  }
})().catch(error => { console.error(error.status ? error.message : 'Apple Music configuration check failed.'); process.exitCode = 1; });
