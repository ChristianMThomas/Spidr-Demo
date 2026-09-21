const test = require('node:test');
const assert = require('node:assert/strict');
const { webUrl, viewBounds, installQuickBrowser } = require('../electron/quickBrowser');

test('quick browser accepts web addresses and search, never privileged schemes or credentials', () => {
  assert.equal(webUrl('example.com/guide', true), 'https://example.com/guide');
  assert.equal(webUrl('http://localhost:4000/help', true), 'http://localhost:4000/help');
  assert.equal(new URL(webUrl('build guide', true)).searchParams.get('q'), 'build guide');
  for (const input of ['file:///C:/secret.txt', 'javascript:alert(1)', 'data:text/html,test', 'steam://123', 'https://name:password@example.com', 'https://example.com\nfile:', null, '', 'x'.repeat(5000)]) {
    assert.throws(() => webUrl(input, true));
  }
  assert.throws(() => webUrl('example.com'));
});

test('native bounds are zoom-aware, clipped to the window, and protect title controls', () => {
  assert.deepEqual(viewBounds({ x: 600, y: 100, width: 300, height: 350 }, [1000, 700], 1.25), { x: 750, y: 125, width: 250, height: 438 });
  assert.deepEqual(viewBounds({ x: -5, y: -20, width: 100, height: 100 }, [800, 600]), { x: 0, y: 40, width: 95, height: 40 });
  for (const rect of [null, { x: NaN, y: 10, width: 20, height: 20 }, { x: 900, y: 30, width: 20, height: 20 }, { x: 0, y: 0, width: -1, height: 2 }]) assert.equal(viewBounds(rect, [800, 600]), null);
});

test('IPC rejects other windows, subframes and off-origin main frames before any action', async () => {
  const { EventEmitter } = require('node:events');
  const win = new EventEmitter();
  const wc = Object.assign(new EventEmitter(), { mainFrame: { url: 'https://app.test/' }, isDestroyed: () => false });
  Object.assign(win, { webContents: wc, isDestroyed: () => false });
  const handlers = new Map();
  installQuickBrowser({ window: win, ipcMain: { handle: (name, fn) => handlers.set(name, fn), removeHandler: name => handlers.delete(name) }, isTrustedUrl: url => url === 'https://app.test/' });
  for (const invoke of handlers.values()) {
    for (const event of [{ sender: {}, senderFrame: wc.mainFrame }, { sender: wc, senderFrame: { url: 'https://app.test/' } }]) await assert.rejects(invoke(event), /Untrusted/);
    wc.mainFrame.url = 'https://attacker.test/';
    await assert.rejects(invoke({ sender: wc, senderFrame: wc.mainFrame }), /Untrusted/);
    wc.mainFrame.url = 'https://app.test/';
  }
});
