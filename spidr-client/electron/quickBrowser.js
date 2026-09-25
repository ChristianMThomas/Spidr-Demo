const { randomUUID } = require('node:crypto');

function webUrl(input, search = false) {
  if (typeof input !== 'string' || input.length > 4096 || /[\x00-\x1f\x7f]/.test(input)) throw new Error('Enter a valid web address.');
  const value = input.trim();
  if (!value) throw new Error('Enter an address or search term.');
  let candidate = value;
  if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[\w.-]+:\d+(?:\/|$)/.test(value)) throw new Error('Only HTTP and HTTPS addresses are supported.');
    if (!search) throw new Error('Only HTTP and HTTPS addresses are supported.');
    candidate = /\s/.test(value) || !/^(localhost|[\w-]+(?:\.[\w-]+)+|\[[a-f\d:]+\])(?::\d+)?(?:[/?#]|$)/i.test(value)
      ? 'https://www.google.com/search?q=' + encodeURIComponent(value)
      : 'https://' + value;
  }
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only HTTP and HTTPS addresses without embedded credentials are supported.');
  return url.href;
}

function viewBounds(raw, size, zoom = 1) {
  if (!raw || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(raw[key])) || raw.width <= 0 || raw.height <= 0) return null;
  const x = Math.max(0, Math.min(size[0], Math.round(raw.x * zoom)));
  const y = Math.max(40, Math.min(size[1], Math.round(raw.y * zoom)));
  const right = Math.max(x, Math.min(size[0], Math.round((raw.x + raw.width) * zoom)));
  const bottom = Math.max(y, Math.min(size[1], Math.round((raw.y + raw.height) * zoom)));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

function installQuickBrowser({ window: win, ipcMain, WebContentsView, session, shell, isTrustedUrl }) {
  const host = win.webContents;
  let view = null, browsingSession = null, layout = null;
  let state = { open: false, url: '', title: 'New page', loading: false, muted: true, canGoBack: false, canGoForward: false, error: '' };
  const channels = [];
  const send = patch => {
    state = { ...state, ...patch };
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('quick-browser:state', state);
    return state;
  };
  function trusted(event) {
    return !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && isTrustedUrl(event.senderFrame.url);
  }
  function sync() {
    const wc = view?.webContents;
    if (!wc || wc.isDestroyed()) return state;
    const url = wc.getURL();
    return send({ url: /^https?:/i.test(url) ? url : state.url, title: wc.getTitle().slice(0, 250) || 'New page',
      loading: wc.isLoading(), muted: wc.isAudioMuted(), canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward() });
  }
  function applyLayout() {
    if (!view || win.isDestroyed()) return;
    const bounds = viewBounds(layout?.bounds, win.getContentSize(), win.webContents.getZoomFactor());
    view.setVisible(!!bounds && layout?.visible === true);
    if (bounds) view.setBounds(bounds);
  }
  function close() {
    const old = view, oldSession = browsingSession;
    view = null; browsingSession = null; layout = null;
    if (old) {
      if (!win.isDestroyed()) win.contentView.removeChildView(old);
      if (!old.webContents.isDestroyed()) old.webContents.close({ waitForBeforeUnload: false });
    }
    if (oldSession) {
      oldSession.removeAllListeners('will-download');
      oldSession.webRequest.onBeforeRequest(null);
      oldSession.clearStorageData().catch(() => {});
      oldSession.clearCache().catch(() => {});
    }
    return send({ open: false, url: '', title: 'New page', loading: false, muted: true, canGoBack: false, canGoForward: false, error: '' });
  }
  function navigate(input) {
    const url = webUrl(input, true);
    if (!view) throw new Error('Open the quick browser first.');
    const wc = view.webContents;
    send({ error: '', url, loading: true });
    wc.loadURL(url).catch(error => {
      if (view?.webContents === wc && error.code !== 'ERR_ABORTED') send({ loading: false, error: 'This page could not load. Try again or open it externally.' });
    });
    return state;
  }
  function open() {
    if (view) return sync();
    browsingSession = session.fromPartition('spidr-quick-' + randomUUID(), { cache: false });
    browsingSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    browsingSession.setPermissionCheckHandler(() => false);
    browsingSession.setDevicePermissionHandler(() => false);
    browsingSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    browsingSession.webRequest.onBeforeRequest((details, callback) => {
      let allowed = false;
      try { allowed = ['http:', 'https:', 'data:', 'blob:', 'about:'].includes(new URL(details.url).protocol); } catch {}
      callback({ cancel: !allowed });
    });
    browsingSession.on('will-download', event => { event.preventDefault(); send({ error: 'Download blocked. Open this page in your regular browser to download.' }); });
    view = new WebContentsView({ webPreferences: {
      session: browsingSession, nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
      contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
      webviewTag: false, plugins: false, devTools: false, safeDialogs: true,
    } });
    view.setVisible(false);
    win.contentView.addChildView(view);
    const wc = view.webContents;
    wc.setAudioMuted(true);
    const guard = (event, url) => {
      try { webUrl(url); } catch { event.preventDefault(); send({ error: 'This navigation was blocked. Only HTTP and HTTPS pages are allowed.' }); }
    };
    wc.on('will-navigate', guard);
    wc.on('will-redirect', guard);
    wc.on('will-frame-navigate', event => {
      if (event.isMainFrame || !['about:blank', 'about:srcdoc'].includes(event.url)) guard(event, event.url);
    });
    wc.on('will-attach-webview', event => event.preventDefault());
    wc.on('certificate-error', (event, _url, _error, _certificate, callback) => { event.preventDefault(); callback(false); });
    wc.setWindowOpenHandler(({ url }) => {
      try { navigate(webUrl(url)); } catch { send({ error: 'This popup was blocked.' }); }
      return { action: 'deny' };
    });
    for (const name of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated']) wc.on(name, () => { if (view?.webContents === wc) sync(); });
    wc.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3 && view?.webContents === wc) send({ loading: false, error: 'This page could not load. Try again or open it externally.' });
    });
    wc.on('render-process-gone', () => { if (view?.webContents === wc) { view.setVisible(false); send({ loading: false, error: 'This page stopped responding. Reload to try again.' }); } });
    send({ open: true, error: '' });
    applyLayout();
    return state;
  }
  const handle = (name, fn) => {
    const channel = 'quick-browser:' + name;
    channels.push(channel);
    ipcMain.handle(channel, async (event, payload) => {
      if (!trusted(event)) throw new Error('Untrusted quick browser request.');
      try { return await fn(payload); }
      catch (error) { return send({ error: error.message || 'Browser action failed.' }); }
    });
  };
  handle('open', open);
  handle('navigate', navigate);
  handle('layout', payload => { layout = payload; applyLayout(); return { ok: true }; });
  handle('close', close);
  handle('action', async action => {
    if (!view) throw new Error('Open the quick browser first.');
    const wc = view.webContents;
    if (action === 'back' && wc.canGoBack()) wc.goBack();
    else if (action === 'forward' && wc.canGoForward()) wc.goForward();
    else if (action === 'reload') { send({ error: '' }); wc.reload(); }
    else if (action === 'stop') wc.stop();
    else if (action === 'mute') wc.setAudioMuted(!wc.isAudioMuted());
    else if (action === 'external') await shell.openExternal(webUrl(wc.getURL()));
    else if (!['back', 'forward'].includes(action)) throw new Error('Unsupported browser action.');
    return sync();
  });
  const navigation = (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) close(); };
  win.webContents.on('did-start-navigation', navigation);
  win.webContents.on('render-process-gone', close);
  win.on('resize', applyLayout);
  const dispose = () => {
    close();
    for (const channel of channels) ipcMain.removeHandler(channel);
    win.removeListener('resize', applyLayout);
    if (!host.isDestroyed()) {
      host.removeListener('did-start-navigation', navigation);
      host.removeListener('render-process-gone', close);
    }
  };
  win.once('closed', dispose);
  return { dispose };
}

module.exports = { installQuickBrowser, webUrl, viewBounds };
