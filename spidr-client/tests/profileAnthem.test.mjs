import test from 'node:test';
import assert from 'node:assert/strict';
import { anthemPatch, readAnthem } from '../src/lib/profileAnthem.js';

test('Apple anthem stores its provider without masquerading as a Spotify ID', () => {
  const patch = anthemPatch({ id: '123456', source: 'apple', name: 'Song', isrc: 'USABC1234567' });
  assert.equal(patch.anthem_spotify_id, '');
  assert.equal(patch.anthem_provider, 'apple');
  assert.equal(patch.anthem_track_id, '123456');
  assert.equal(patch.anthem_isrc, 'USABC1234567');
  assert.match(readAnthem(patch).externalUrl, /music.apple.com/);
});
test('old Spotify anthems and new Spotify selections remain compatible', () => {
  assert.equal(readAnthem({ anthem_spotify_id: 'old' }).id, 'old');
  assert.equal(readAnthem({ anthem_spotify_id: 'old' }).provider, 'spotify');
  const patch = anthemPatch({ id: 'new', source: 'spotify' });
  assert.equal(patch.anthem_spotify_id, 'new');
  assert.equal(patch.anthem_track_id, 'new');
});
