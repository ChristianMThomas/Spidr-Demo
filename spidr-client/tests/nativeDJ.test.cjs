const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const ts = require('../mobile/node_modules/typescript');

function harness() {
  const players = [];
  const socket = new EventEmitter();
  let response = null;
  const createAudioPlayer = () => {
    const player = { duration: 30, isLoaded: false, volume: 1, muted: false, plays: 0, removed: false,
      play() { this.plays++; }, pause() {}, remove() { this.removed = true; }, seekTo: async () => {},
      addListener(_name, cb) { this.status = cb; return { remove() {} }; },
    };
    players.push(player); return player;
  };
  const source = fs.readFileSync(require.resolve('../mobile/lib/djPlayback.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const requireMock = name => name === 'expo-audio' ? { createAudioPlayer } : { default: { get: async () => response } };
  new Function('require', 'exports', 'setInterval', 'clearInterval', compiled)(requireMock, exports, () => 1, () => {});
  const dj = exports.djPlayback;
  dj.start('room', socket, () => {});
  const session = (patch = {}) => ({ host_id: 'host', track_id: 'one', preview_url: 'https://example.test/one', started_at: new Date().toISOString(), audio_route: 'preview', ...patch });
  const change = value => { response = value; socket.emit('voice:dj-session-changed', { channel_id: 'room', session: value }); };
  return { dj, socket, players, session, change };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('native DJ survives UI absence and disposes sources on track change / leaving', async () => {
  const h = harness(); h.change(h.session());
  const first = h.players[0]; first.status({ isLoaded: true }); await flush();
  assert.equal(first.plays, 1);
  h.change(h.session({ track_id: 'two' }));
  assert.equal(first.removed, true); assert.equal(h.players.length, 2);
  first.status({ isLoaded: true }); await flush();
  assert.equal(first.plays, 1, 'old load callbacks cannot revive released music');
  h.dj.stop(); assert.equal(h.players[1].removed, true);
  assert.equal(h.socket.listenerCount('voice:dj-session-changed'), 0);
});
test('native DJ pause/deafen and volume affect the player; previews never loop', async () => {
  const h = harness(); h.change(h.session());
  const player = h.players[0]; player.status({ isLoaded: true }); await flush();
  h.dj.toggle(); assert.equal(h.dj.getSnapshot().status, 'paused');
  h.dj.setOutput(true, false); assert.equal(player.muted, true);
  h.dj.setVolume(0.3); assert.equal(player.volume, 0.3);
  h.dj.toggle(); await flush(); assert.equal(player.plays, 2);
  h.dj.stop();
  const ended = harness(); ended.change(ended.session({ started_at: new Date(Date.now() - 60000).toISOString() }));
  ended.players[0].status({ isLoaded: true }); await flush();
  assert.equal(ended.players[0].plays, 0); assert.equal(ended.dj.getSnapshot().status, 'ended');
  ended.dj.stop();
});
test('incoming stream suppresses native previews and a missing live source waits silently', () => {
  const h = harness(); h.change(h.session());
  h.dj.setOutput(false, true); assert.equal(h.players[0].removed, true);
  assert.equal(h.dj.getSnapshot().status, 'live');
  h.change(h.session({ audio_route: 'stream' })); h.dj.setOutput(false, false);
  assert.equal(h.dj.getSnapshot().status, 'waiting');
  assert.equal(h.players.length, 1);
  h.dj.stop();
});
test('in-flight refresh cannot resurrect a session after leaving', async () => {
  const h = harness(); h.change(h.session());
  const request = h.dj.refresh(); h.dj.stop(); await request;
  assert.equal(h.dj.getSnapshot().session, null);
  assert.equal(h.players.length, 1);
});
