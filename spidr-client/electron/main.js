const { app, BrowserWindow, ipcMain, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Only open DevTools in development (not in packaged .exe)
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  // Try every possible location
  const appPath = app.getAppPath();
  const possiblePaths = [
    path.join(appPath, 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
  ];

  let indexPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { indexPath = p; break; }
  }

  if (indexPath) {
    mainWindow.loadFile(indexPath);
  } else {
    // Show exactly what we searched so we can debug
    const html = `
      <html><body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px">
      <h2 style="color:#ef4444">Cannot find index.html</h2>
      <p>appPath: ${appPath}</p>
      <p>__dirname: ${__dirname}</p>
      <p>resourcesPath: ${process.resourcesPath}</p>
      <h3>Searched:</h3>
      ${possiblePaths.map(p => `<p>${p} — ${fs.existsSync(p) ? '✓ EXISTS' : '✗ NOT FOUND'}</p>`).join('')}
      <h3>Contents of appPath:</h3>
      <pre>${fs.existsSync(appPath) ? fs.readdirSync(appPath).join('\n') : 'NOT FOUND'}</pre>
      </body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // 2.2 — notify the renderer when the Spidr window loses/gains OS focus, so it
  // can offer a mini-overlay (PiP) for an active call. The renderer decides
  // whether to act (opt-in), keeping this non-intrusive.
  mainWindow.on('blur', () => { mainWindow?.webContents.send('window:blur'); });
  mainWindow.on('focus', () => { mainWindow?.webContents.send('window:focus'); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('close-window', () => mainWindow?.close());

// ── Video call pop-out (2.1) ────────────────────────────────────────────────
// A MediaStream cannot be serialized across IPC, so we don't transfer the
// stream itself. Instead we spawn a frameless, always-on-top child window that
// loads the app at a dedicated pop-out route with the call's identifiers
// (server/channel/group) as query params; that window re-joins the same call
// over the existing socket signaling and renders its own video. The parent is
// notified when the pop-out opens/closes so it can hide/show its inline grid.
let popoutWindow = null;

ipcMain.on('popout:open', (_evt, params = {}) => {
  if (popoutWindow && !popoutWindow.isDestroyed()) {
    popoutWindow.focus();
    return;
  }
  popoutWindow = new BrowserWindow({
    width: 480,
    height: 320,
    minWidth: 280,
    minHeight: 200,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  popoutWindow.once('ready-to-show', () => popoutWindow.show());

  const qs = new URLSearchParams(params).toString();
  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    popoutWindow.loadURL(`${startUrl}/#/popout/call?${qs}`);
  } else {
    // Packaged build — reuse the same index.html resolution as the main window.
    const appPath = app.getAppPath();
    const candidates = [
      path.join(appPath, 'dist', 'index.html'),
      path.join(__dirname, '..', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    ];
    const indexPath = candidates.find(p => fs.existsSync(p));
    if (indexPath) {
      popoutWindow.loadFile(indexPath, { hash: `/popout/call?${qs}` });
    }
  }

  popoutWindow.on('closed', () => {
    popoutWindow = null;
    // Tell the main window the pop-out closed so it can restore its inline grid.
    mainWindow?.webContents.send('popout:closed');
  });
});

ipcMain.on('popout:close', () => {
  if (popoutWindow && !popoutWindow.isDestroyed()) popoutWindow.close();
});

// ── Spidr Protocol text overlay (Ghost Window) ──────────────────────────────
// A frameless, transparent, always-on-top HUD that renders the protocol text
// chat over whatever game is running. By default it ignores mouse events
// entirely (click-through) so it never steals clicks from the game; a global
// hotkey (Shift+Enter) toggles "interactive" mode so the user can type, then
// click-through is restored. The renderer loads the /#/overlay/protocol route.
let protocolWindow = null;
let protocolInteractive = false;

function setProtocolInteractive(on) {
  if (!protocolWindow || protocolWindow.isDestroyed()) return;
  protocolInteractive = on;
  if (on) {
    protocolWindow.setIgnoreMouseEvents(false);
    protocolWindow.setFocusable(true);
    protocolWindow.focus();
  } else {
    // forward:true lets hover events still reach the page so the anchor node can
    // be styled, while clicks pass through to the game beneath.
    protocolWindow.setIgnoreMouseEvents(true, { forward: true });
    protocolWindow.setFocusable(false);
  }
  protocolWindow.webContents.send('protocol:interactive', on);
}

ipcMain.on('protocol:open', (_evt, params = {}) => {
  if (protocolWindow && !protocolWindow.isDestroyed()) { protocolWindow.focus(); return; }

  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;

  protocolWindow = new BrowserWindow({
    width: 420,
    height: 320,
    x: 24,
    y: Math.max(24, sh - 360),
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  protocolWindow.setAlwaysOnTop(true, 'screen-saver');
  // Show on all workspaces / over fullscreen games where supported.
  if (typeof protocolWindow.setVisibleOnAllWorkspaces === 'function') {
    protocolWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  protocolWindow.once('ready-to-show', () => {
    protocolWindow.show();
    setProtocolInteractive(false); // start click-through
  });

  const qs = new URLSearchParams(params).toString();
  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    protocolWindow.loadURL(`${startUrl}/#/overlay/protocol?${qs}`);
  } else {
    const appPath = app.getAppPath();
    const candidates = [
      path.join(appPath, 'dist', 'index.html'),
      path.join(__dirname, '..', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    ];
    const indexPath = candidates.find(p => fs.existsSync(p));
    if (indexPath) protocolWindow.loadFile(indexPath, { hash: `/overlay/protocol?${qs}` });
  }

  protocolWindow.on('closed', () => {
    protocolWindow = null;
    protocolInteractive = false;
    mainWindow?.webContents.send('protocol:closed');
  });
});

ipcMain.on('protocol:close', () => {
  if (protocolWindow && !protocolWindow.isDestroyed()) protocolWindow.close();
});

// Renderer asks to flip interactive mode (e.g. when the input loses focus, it
// can hand control back to the game).
ipcMain.on('protocol:set-interactive', (_evt, on) => setProtocolInteractive(!!on));

app.whenReady().then(() => {
  createWindow();
  // Global hotkey: Shift+Enter focuses the overlay for typing (or hands control
  // back if it's already interactive). Registered app-wide so it works while a
  // game has focus. Failures (e.g. already taken) are non-fatal.
  try {
    globalShortcut.register('Shift+Enter', () => {
      if (!protocolWindow || protocolWindow.isDestroyed()) return;
      setProtocolInteractive(!protocolInteractive);
    });
  } catch {}
});

app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
