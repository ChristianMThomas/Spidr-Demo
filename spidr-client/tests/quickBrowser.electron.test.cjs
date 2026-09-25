const { _electron } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/download') { res.writeHead(200, { 'content-disposition': 'attachment; filename="test.txt"' }); return res.end('blocked download'); }
    res.setHeader('content-type', 'text/html');
    res.end(`<html><head><title>${req.url}</title></head><body style="margin:0;background:${req.url === '/app' ? '#16181c' : '#dfece8'};color:#152c25;font-family:sans-serif"><h1>${req.url}</h1><a href="/second" target="_blank">Second page</a><script>window.localValue = typeof electronAPI;</script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const env = { ...process.env, QUICK_BROWSER_TEST_URL: origin + '/app' };
  delete env.ELECTRON_RUN_AS_NODE;
  let electron;
  try {
    electron = await _electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, 'quickBrowser.electron.cjs')], env });
    const page = await electron.firstWindow();
    await page.waitForFunction(() => !!window.electronAPI?.quickBrowser);
    const invoke = (method, payload) => page.evaluate(({ method, payload }) => window.electronAPI.quickBrowser[method](payload), { method, payload });
    await invoke('open');
    await invoke('layout', { bounds: { x: 650, y: 120, width: 420, height: 500 }, visible: true });
    await invoke('navigate', origin + '/first');
    const inspect = () => electron.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const view = win.contentView.children[0];
      const wc = view?.webContents;
      return { count: win.contentView.children.length, bounds: view?.getBounds(), url: wc?.getURL(), muted: wc?.isAudioMuted(), sameSession: wc?.session === win.webContents.session, prefs: wc?.getLastWebPreferences() };
    });
    const waitForURL = async url => {
      for (let i = 0; i < 100; i++) { if ((await inspect()).url === url) return; await new Promise(resolve => setTimeout(resolve, 50)); }
      throw new Error('Native page did not navigate to ' + url);
    };
    await waitForURL(origin + '/first');
    let state = await inspect();
    assert.equal(state.muted, true); assert.equal(state.sameSession, false);
    assert.equal(state.prefs.sandbox, true); assert.equal(state.prefs.contextIsolation, true); assert.equal(state.prefs.nodeIntegration, false); assert.ok(!state.prefs.preload);
    assert.deepEqual(state.bounds, { x: 650, y: 120, width: 420, height: 500 });
    const remote = await electron.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript('({node:typeof process, bridge:typeof electronAPI, require:typeof require})'));
    assert.deepEqual(remote, { node: 'undefined', bridge: 'undefined', require: 'undefined' });
    assert.match((await invoke('navigate', 'file:///C:/Windows/win.ini')).error, /HTTP/);
    assert.equal((await inspect()).url, origin + '/first');
    await electron.evaluate(async ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript('document.querySelector("a").click()'));
    await waitForURL(origin + '/second');
    assert.equal(await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    await invoke('action', 'back'); await waitForURL(origin + '/first');
    await invoke('action', 'forward'); await waitForURL(origin + '/second');
    await invoke('action', 'mute'); assert.equal((await inspect()).muted, false);
    await invoke('action', 'external'); assert.equal(await electron.evaluate(() => global.externalOpened), origin + '/second');
    assert.equal((await invoke('layout', { visible: false })).ok, true);
    await invoke('layout', { bounds: { x: 650, y: 120, width: 420, height: 500 }, visible: true });
    const capture = await electron.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
      return { empty: image.isEmpty(), size: image.getSize() };
    });
    assert.equal(capture.empty, false);
    assert.ok(capture.size.width > 0);
    await invoke('close'); assert.equal((await inspect()).count, 0);
    await invoke('open'); await invoke('navigate', origin + '/first'); await waitForURL(origin + '/first');
    await page.reload(); assert.equal((await inspect()).count, 0, 'main app reload releases native browsing content');
    console.log('PASS: real Electron WebContentsView isolation, navigation, popup containment, bounds, mute, external action, visibility and cleanup.');
  } catch (error) {
    console.error('Electron verification failed:', error);
    throw error;
  } finally {
    await electron?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
