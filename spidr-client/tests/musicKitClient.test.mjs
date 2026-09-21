import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicKitClient } from '../src/lib/musicKitClient.js';

function fixture({ connected = false, owner = null, authorized = false, electron = false } = {}) {
  const storage = new Map([['spidr_token', 'session-a']]);
  if (owner) storage.set('spidr_apple_music_owner', owner);
  const browser = new EventTarget();
  const calls = { configure: 0, authorize: 0, save: 0, unauthorize: 0 };
  const player = Object.assign(new EventTarget(), {
    isAuthorized: authorized,
    async authorize() { calls.authorize++; this.isAuthorized = true; return 'private-apple-token'; },
    async unauthorize() { calls.unauthorize++; this.isAuthorized = false; },
    async stop() {},
  });
  Object.assign(browser, {
    CustomEvent,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    MusicKit: { async configure() { calls.configure++; return player; }, PlaybackStates: { playing: 2 } },
    electronAPI: { isElectron: electron }, open: url => { calls.open = url; },
  });
  const status = { configured: true, user_id: 'user-a', connected };
  const api = {
    async status() { return { ...status }; },
    async devToken() { return { token: 'developer-token' }; },
    async saveUserToken() { calls.save++; status.connected = true; },
    async disconnect() { status.connected = false; },
    async connectionLink() { return { url: 'https://example.test/apple-music/connect#ticket' }; },
  };
  return { browser, storage, player, calls, status, api, client: createMusicKitClient(api, browser) };
}

test('shared initialization and verified connect/disconnect', async () => {
  const f = fixture();
  await Promise.all([f.client.boot(), f.client.boot(), f.client.boot()]);
  assert.equal(f.calls.configure, 1);
  assert.equal(f.client.getSnapshot().connected, false);
  await f.client.authorize();
  assert.equal(f.calls.save, 1);
  assert.equal(f.client.getSnapshot().authorized, true);
  assert.equal(f.storage.get('spidr_apple_music_owner'), 'user-a');
  await f.client.unauthorize();
  assert.equal(f.client.getSnapshot().connected, false);
  assert.equal(f.storage.has('spidr_apple_music_owner'), false);
});

test('cancel and save failures never claim a connection; retry works', async () => {
  const f = fixture();
  await f.client.boot();
  f.player.authorize = async () => null;
  await assert.rejects(f.client.authorize(), /cancelled/);
  assert.equal(f.calls.save, 0);
  f.player.authorize = async () => { f.player.isAuthorized = true; return 'token'; };
  f.api.saveUserToken = async () => { throw new Error('Save failed'); };
  await assert.rejects(f.client.authorize(), /Save failed/);
  assert.equal(f.client.getSnapshot().authorized, false);
  assert.equal(f.client.getSnapshot().connected, false);
  assert.equal(f.client.getSnapshot().busy, false);
  f.api.saveUserToken = async () => {};
  await f.client.authorize();
  assert.equal(f.client.getSnapshot().connected, true);
  f.api.disconnect = async () => { throw new Error('Disconnect failed'); };
  await assert.rejects(f.client.unauthorize(), /Disconnect failed/);
  assert.equal(f.client.getSnapshot().connected, true);
});

test('cached MusicKit authorization belongs only to its linked Spidr account', async () => {
  const f = fixture({ connected: true, authorized: true, owner: 'another-user' });
  await f.client.boot();
  assert.equal(f.calls.unauthorize, 1);
  assert.equal(f.client.getSnapshot().authorized, false);
  await f.client.authorize();
  f.storage.set('spidr_token', 'session-b');
  f.status.user_id = 'user-b';
  f.status.connected = false;
  await f.client.boot();
  assert.equal(f.client.getSnapshot().connected, false);
  assert.equal(f.client.getSnapshot().authorized, false);
});

test('authorization finishing after an account switch is not saved', async () => {
  const f = fixture();
  await f.client.boot();
  f.player.authorize = async () => { f.storage.set('spidr_token', 'session-b'); return 'wrong-account-token'; };
  await assert.rejects(f.client.authorize(), /account changed/);
  assert.equal(f.calls.save, 0);
});

test('desktop handoff waits for server confirmation and supports cancellation', async () => {
  const f = fixture({ electron: true });
  await f.client.boot();
  assert.equal(f.calls.configure, 0);
  assert.deepEqual(await f.client.authorize(), { pending: true });
  assert.equal(f.client.getSnapshot().connected, false);
  assert.match(f.calls.open, /#ticket$/);
  f.status.connected = true;
  await f.client.refresh();
  assert.equal(f.client.getSnapshot().pending, false);
  assert.equal(f.client.getSnapshot().connected, true);
  await f.client.unauthorize();
  await f.client.authorize();
  await f.client.unauthorize();
  assert.equal(f.client.getSnapshot().pending, false);
});

test('missing server setup remains visible and can be retried', async () => {
  const f = fixture();
  f.status.configured = false;
  await f.client.boot();
  assert.equal(f.calls.configure, 0);
  assert.equal(f.client.getSnapshot().ready, false);
  f.status.configured = true;
  await f.client.boot(true);
  assert.equal(f.client.getSnapshot().ready, true);
});
