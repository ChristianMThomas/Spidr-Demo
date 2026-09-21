const { app, BrowserWindow, WebContentsView, ipcMain, shell, globalShortcut, desktopCapturer, session } = require('electron');
const { installQuickBrowser } = require('./quickBrowser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const https = require('https');
// electron-updater is only meaningful in a packaged build (dev has no installer
// to swap). Import is deferred to setupAutoUpdater() so `npm run electron-dev`
// still boots if the dep is missing locally.
let autoUpdater = null;

let mainWindow;
let splashWindow = null;

// ── Boot splash ──────────────────────────────────────────────────────────────
// A small frameless, transparent window with the Spidr web-weaving animation,
// shown instantly on launch and torn down when the main window is ready. This
// covers the (multi-second on cold boot) gap where Discord shows their loader
// — ours weaves a web instead.
function createSplash() {
  try {
    splashWindow = new BrowserWindow({
      width: 340,
      height: 380,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.on('closed', () => { splashWindow = null; });
  } catch (e) {
    console.warn('Splash failed (non-fatal):', e?.message);
    splashWindow = null;
  }
}
function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close(); } catch {}
  }
  splashWindow = null;
}

// The desktopCapturer source id the renderer picked in the StreamSelector,
// consumed by the display-media request handler on the next getDisplayMedia().
let pendingShareSourceId = null;

// ── Navigation / external-link hardening ────────────────────────────────────
// The renderer can be tricked into opening a hostile URL (a crafted chat link,
// a redirect from a compromised widget, etc.). Without a guard, that URL gets
// handed to shell.openExternal — which will happily launch `file://`, custom
// URI schemes registered by other apps, etc. And a top-level navigation would
// load the destination in-window with our preload attached. Both are lifted
// straight from the Electron security checklist.
const EXTERNAL_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function safeOpenExternal(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (EXTERNAL_URL_SCHEMES.has(u.protocol)) shell.openExternal(u.toString());
  } catch { /* not a parseable URL — drop */ }
}

// Origins that our own windows are allowed to load. In dev this is the Vite
// server; packaged it's the file:// URL of dist/index.html. Anything else is a
// navigation attempt and must be denied.
function isInternalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'file:') return true; // packaged build
    const devUrl = process.env.ELECTRON_START_URL;
    if (devUrl) {
      const dev = new URL(devUrl);
      return u.origin === dev.origin;
    }
    return false;
  } catch { return false; }
}

// Attach the guards to any BrowserWindow we create. Denies off-origin
// navigation; if the destination is http(s)/mailto, opens it in the OS browser
// instead. Also intercepts window.open / target=_blank the same way.
function hardenWebContents(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    safeOpenExternal(url);
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    safeOpenExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    safeOpenExternal(url);
    return { action: 'deny' };
  });
}

// ── Spidr Protocol overlay — persistent bounds ──────────────────────────────
// The protocol overlay is a separate OS-level frameless transparent window
// that floats over whatever is on screen. To let users "pin it anywhere on
// their computer", we persist its bounds (x, y, width, height) across sessions
// and validate them against the current display layout on each open so it
// never restores to a position that's offscreen after a monitor change.
const OVERLAY_BOUNDS_PATH = () => path.join(app.getPath('userData'), 'spidr-protocol-bounds.json');
const OVERLAY_DEFAULT_SIZE = { width: 420, height: 320 };

function loadOverlayBounds() {
  try {
    const raw = fs.readFileSync(OVERLAY_BOUNDS_PATH(), 'utf8');
    const b = JSON.parse(raw);
    if (typeof b?.x === 'number' && typeof b?.y === 'number') return b;
  } catch { /* file may not exist on first run */ }
  return null;
}

function saveOverlayBounds(b) {
  try { fs.writeFileSync(OVERLAY_BOUNDS_PATH(), JSON.stringify(b)); } catch {}
}

// Make sure the rect we're about to restore is still visible on SOME display.
// Without this check, a saved position on a now-disconnected monitor would
// leave the overlay invisible.
function isBoundsVisible(b) {
  if (!b) return false;
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  // Consider it visible if at least a 60×60 corner is inside any display
  return displays.some(d => {
    const dx = d.bounds.x, dy = d.bounds.y, dw = d.bounds.width, dh = d.bounds.height;
    const overlapX = Math.max(0, Math.min(b.x + (b.width || 60), dx + dw) - Math.max(b.x, dx));
    const overlapY = Math.max(0, Math.min(b.y + (b.height || 60), dy + dh) - Math.max(b.y, dy));
    return overlapX >= 60 && overlapY >= 60;
  });
}

// Default position: bottom-left of the primary display.
function defaultOverlayBounds() {
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  return {
    x: primary.workArea.x + 24,
    y: primary.workArea.y + Math.max(24, sh - 360),
    width: OVERLAY_DEFAULT_SIZE.width,
    height: OVERLAY_DEFAULT_SIZE.height,
  };
}

// Compute a preset position on the display the cursor is currently on (so
// "top-right" puts the overlay on the monitor the user is actually looking at).
function presetOverlayBounds(preset) {
  const { screen } = require('electron');
  const cursorPt = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPt) || screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const w = OVERLAY_DEFAULT_SIZE.width, h = OVERLAY_DEFAULT_SIZE.height, m = 24;
  const positions = {
    'top-left':     { x: dx + m,             y: dy + m },
    'top-right':    { x: dx + dw - w - m,    y: dy + m },
    'bottom-left':  { x: dx + m,             y: dy + dh - h - m },
    'bottom-right': { x: dx + dw - w - m,    y: dy + dh - h - m },
    'center':       { x: dx + Math.floor((dw - w) / 2), y: dy + Math.floor((dh - h) / 2) },
  };
  const p = positions[preset] || positions['bottom-left'];
  return { x: Math.floor(p.x), y: Math.floor(p.y), width: w, height: h };
}

function createWindow() {
  const appIcon = app.isPackaged
    ? path.join(process.resourcesPath, 'spidr-app-desktop.png')
    : path.join(__dirname, '../src/assets/spidr-app-desktop.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    // Native-feeling chrome: on Windows/Linux `titleBarStyle: 'hidden'` +
    // `titleBarOverlay` makes the OS draw REAL minimize/maximize/close
    // buttons directly over our header — same behavior as VS Code, Slack,
    // and Discord. On macOS 'hiddenInset' keeps the native traffic lights
    // in their expected position, inset into our header. Previously the
    // window used bare `frame: false`, which meant we hand-rolled window
    // controls and the bar read as an in-app strip rather than OS chrome.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 16, y: 14 } }
      : {
          titleBarOverlay: {
            color: '#0a0a0a',        // matches the app background
            symbolColor: '#ffffff',  // white min/max/close glyphs
            height: 40,              // matches our header height
          },
        }),
    icon: appIcon,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  forwardWindowState(mainWindow);
  installQuickBrowser({ window: mainWindow, ipcMain, WebContentsView, session, shell, isTrustedUrl: url => {
    try {
      const current = new URL(mainWindow.webContents.getURL());
      const candidate = new URL(url);
      return candidate.protocol === 'file:'
        ? candidate.pathname === current.pathname && candidate.pathname.endsWith('/dist/index.html')
        : !!process.env.ELECTRON_START_URL && candidate.origin === new URL(process.env.ELECTRON_START_URL).origin;
    } catch { return false; }
  } });
  hardenWebContents(mainWindow);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
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
}

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('close-window', () => mainWindow?.close());

// ── Screen-share source list ────────────────────────────────────────────────
// Returns the available capture sources (screens + windows) so the renderer's
// StreamSelector can show real thumbnails instead of mock entries. The chosen
// id is then handed back via 'desktop:set-share-source' and granted by the
// display-media request handler registered in app.whenReady().
ipcMain.handle('desktop:get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources.map(s => ({
      id:        s.id,
      name:      s.name,
      kind:      s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail?.isEmpty?.() ? null : s.thumbnail?.toDataURL() || null,
      appIcon:   s.appIcon && !s.appIcon.isEmpty?.() ? s.appIcon.toDataURL() : null,
    }));
  } catch (e) {
    console.warn('desktop:get-sources failed:', e?.message);
    return [];
  }
});
ipcMain.on('desktop:set-share-source', (_evt, id) => {
  pendingShareSourceId = (typeof id === 'string' && id) ? id : null;
});

// Forward maximize/unmaximize to renderer so the title bar can swap icons
function forwardWindowState(win) {
  win.on('maximize',   () => { if (!win.isDestroyed()) win.webContents.send('window:maximized'); });
  win.on('unmaximize', () => { if (!win.isDestroyed()) win.webContents.send('window:unmaximized'); });
}

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
  hardenWebContents(popoutWindow);

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

  // Restore the user's last-pinned bounds if they're still on a visible
  // display, otherwise fall back to the default bottom-left position.
  const saved = loadOverlayBounds();
  const bounds = isBoundsVisible(saved) ? saved : defaultOverlayBounds();

  protocolWindow = new BrowserWindow({
    width:  Math.max(280, Math.min(bounds.width  || OVERLAY_DEFAULT_SIZE.width,  2400)),
    height: Math.max(180, Math.min(bounds.height || OVERLAY_DEFAULT_SIZE.height, 1800)),
    x: bounds.x,
    y: bounds.y,
    minWidth: 280,
    minHeight: 180,
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

  hardenWebContents(protocolWindow);
  protocolWindow.setAlwaysOnTop(true, 'screen-saver');
  // Show on all workspaces / over fullscreen games where supported.
  if (typeof protocolWindow.setVisibleOnAllWorkspaces === 'function') {
    protocolWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Persist position/size as the user drags or resizes — debounced so we
  // don't hammer the disk during a long drag.
  let saveTimer = null;
  const persistBounds = () => {
    if (!protocolWindow || protocolWindow.isDestroyed()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (protocolWindow && !protocolWindow.isDestroyed()) {
        saveOverlayBounds(protocolWindow.getBounds());
      }
    }, 250);
  };
  protocolWindow.on('move',    persistBounds);
  protocolWindow.on('resize',  persistBounds);
  protocolWindow.on('moved',   persistBounds);  // macOS final position
  protocolWindow.on('resized', persistBounds);  // macOS final size

  protocolWindow.once('ready-to-show', () => {
    protocolWindow.show();
    setProtocolInteractive(false); // start click-through
    // Dev-only: open DevTools in a detached window so we can debug the overlay
    // without breaking its transparency/click-through model.
    if (!app.isPackaged) {
      protocolWindow.webContents.openDevTools({ mode: 'detach' });
    }
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

// Lightweight click-through toggle WITHOUT entering full interactive mode.
// The renderer asks for this when the mouse hovers the red anchor dot so the
// dot can receive a click (or a drag) to open the chat manually. The whole
// window is `setIgnoreMouseEvents(true, { forward: true })` in ambient mode,
// which kills clicks AND drag regions — this lets the renderer briefly open a
// hole over the dot. Skipped when already interactive (it manages its own).
ipcMain.on('protocol:set-clickthrough', (_evt, ignore) => {
  if (!protocolWindow || protocolWindow.isDestroyed()) return;
  if (protocolInteractive) return;
  if (ignore) protocolWindow.setIgnoreMouseEvents(true, { forward: true });
  else        protocolWindow.setIgnoreMouseEvents(false);
});

// ── Pin Spidr Protocol anywhere ──────────────────────────────────────────────
// Three ways the renderer can move the overlay:
//   1. protocol:set-preset — snap to a named corner/center of the user's
//      current display (handy for one-tap repositioning from settings)
//   2. protocol:set-bounds — explicit { x, y, width?, height? } for fine
//      placement (e.g. typed coords or programmatic positioning)
//   3. protocol:reset-position — forget the saved bounds and restore default
// All three save the resulting bounds so they survive an app restart.
// protocol:get-bounds returns the current rect so the UI can display it.

ipcMain.on('protocol:set-preset', (_evt, preset) => {
  const b = presetOverlayBounds(preset);
  if (protocolWindow && !protocolWindow.isDestroyed()) {
    protocolWindow.setBounds(b);
  }
  saveOverlayBounds(b);
});

ipcMain.on('protocol:set-bounds', (_evt, partial = {}) => {
  if (!protocolWindow || protocolWindow.isDestroyed()) {
    // No window open yet — just persist so the next open picks it up.
    const current = loadOverlayBounds() || defaultOverlayBounds();
    saveOverlayBounds({ ...current, ...partial });
    return;
  }
  const current = protocolWindow.getBounds();
  const next = {
    x: typeof partial.x === 'number' ? Math.floor(partial.x) : current.x,
    y: typeof partial.y === 'number' ? Math.floor(partial.y) : current.y,
    width:  Math.max(280, Math.min(typeof partial.width  === 'number' ? Math.floor(partial.width)  : current.width,  2400)),
    height: Math.max(180, Math.min(typeof partial.height === 'number' ? Math.floor(partial.height) : current.height, 1800)),
  };
  protocolWindow.setBounds(next);
  saveOverlayBounds(next);
});

ipcMain.on('protocol:reset-position', () => {
  const def = defaultOverlayBounds();
  if (protocolWindow && !protocolWindow.isDestroyed()) {
    protocolWindow.setBounds(def);
  }
  try { fs.unlinkSync(OVERLAY_BOUNDS_PATH()); } catch {}
});

ipcMain.handle('protocol:get-bounds', () => {
  if (protocolWindow && !protocolWindow.isDestroyed()) return protocolWindow.getBounds();
  return loadOverlayBounds() || defaultOverlayBounds();
});

// ── Game detection ───────────────────────────────────────────────────────────
//
// PRIMARY method: PowerShell enumerates every window and checks if its rect
// covers the primary display. Any non-system fullscreen window is treated as
// a game — even games we've never heard of.
//
// FALLBACK (process list): known process names are used to detect lobby/client
// states (e.g. League client open but not in an active game). Extend this list
// to improve named recognition for the fallback, but the primary path catches
// everything regardless of what's in this map.

// ProcessName (no .exe) → display name. Used for:
//   1. Labelling known fullscreen procs with a clean name
//   2. Detecting lobby/background state when nothing is fullscreen
const KNOWN_GAMES_WIN = {
  'LeagueClient':                  'League of Legends',
  'LeagueClientUx':                'League of Legends',
  'League of Legends':             'League of Legends',
  'VALORANT-Win64-Shipping':       'VALORANT',
  'VALORANT':                      'VALORANT',
  'TFT':                           'Teamfight Tactics',
  'FortniteClient-Win64-Shipping': 'Fortnite',
  'r5apex':                        'Apex Legends',
  'cs2':                           'CS2',
  'csgo':                          'CS2',
  'Overwatch':                     'Overwatch 2',
  'WorldOfWarcraft':               'World of Warcraft',
  'Wow':                           'World of Warcraft',
  'DiabloIV':                      'Diablo IV',
  'EscapeFromTarkov':              'Escape from Tarkov',
  'Destiny2':                      'Destiny 2',
  'RocketLeague':                  'Rocket League',
  'GenshinImpact':                 'Genshin Impact',
  'Warframe.x64':                  'Warframe',
  'MonsterHunterWilds':            'Monster Hunter Wilds',
  'MonsterHunterWorld':            'Monster Hunter World',
  'Minecraft.Windows':             'Minecraft',
  'BlackOps6':                     'Call of Duty: Black Ops 6',
  'javaw':                         null,  // too generic — skip
  'REPO':                          'R.E.P.O.',
  'repo':                          'R.E.P.O.',
  'Palworld':                      'Palworld',
  'Helldivers2':                   'Helldivers 2',
  'BaldursGate3':                  "Baldur's Gate 3",
  'bg3':                           "Baldur's Gate 3",
  'DeltaForce':                    'Delta Force',
  'MarvelRivals':                  'Marvel Rivals',
  'MarvelRivals-Win64-Shipping':   'Marvel Rivals',
  'ShooterGame-Win64-Shipping':    null,  // generic UE launcher name — skip
};

const KNOWN_GAMES_MAC = {
  'LeagueofLegends': 'League of Legends',
  'VALORANT':        'VALORANT',
  'Fortnite':        'Fortnite',
  'r5apex':          'Apex Legends',
  'cs2':             'CS2',
  'RocketLeague':    'Rocket League',
  'GenshinImpact':   'Genshin Impact',
  'WorldOfWarcraft': 'World of Warcraft',
  'Warframe':        'Warframe',
};

const GAME_MODE_LABELS = {
  CLASSIC:       'Normal',
  ARAM:          'ARAM',
  SWIFTPLAY:     'Swiftplay',
  CHERRY:        'Arena',
  URF:           'URF',
  ULTBOOK:       'Ult Spellbook',
  PRACTICETOOL:  'Practice',
  DOOMBOTSTEEMO: 'Doom Bots',
  ONEFORALL:     'One for All',
};

// Windows/system processes excluded from fullscreen detection
const FULLSCREEN_EXCLUDE = [
  'explorer', 'SearchHost', 'ShellExperienceHost', 'StartMenuExperienceHost',
  'LockApp', 'ApplicationFrameHost', 'SystemSettings', 'Taskmgr', 'dwm',
  'winlogon', 'svchost', 'spidr', 'Spidr', 'electron', 'TextInputHost',
  'ctfmon', 'WUDFHost', 'RuntimeBroker', 'taskhostw', 'conhost', 'dllhost',
  'sihost', 'fontdrvhost', 'audiodg', 'chrome', 'firefox', 'msedge', 'opera',
  'brave', 'Code', 'WindowsTerminal', 'cmd', 'powershell', 'pwsh', 'notepad',
  'mspaint', 'SnippingTool',
  // Recording / clip tools
  'Medal', 'MedalTV',
  // Chat / voice
  'Discord', 'discord', 'DiscordPTB', 'DiscordCanary',
  // Music
  'Spotify',
  // Streaming / capture
  'obs64', 'obs32', 'obs', 'OBS',
  // Game launchers (not games themselves)
  'steam', 'Steam',
  'EpicGamesLauncher',
  'RiotClientServices', 'RiotClientUx',
  'GalaxyClient',
  'Playnite.FullscreenApp',
  // Windows overlays
  'GameBar',
];

// Written once per app session; reused on every 10s scan tick
const PS_SCRIPT_PATH = path.join(os.tmpdir(), 'spidr_game_scan.ps1');

// ── OS Media Session (Windows SMTC) ────────────────────────────────────────
const SMTC_SCRIPT_PATH = path.join(os.tmpdir(), 'spidr_smtc.ps1');
let lastNowPlayingKey = '';
let mediaSessionTimer  = null;

function writeSmtcScript() {
  const lines = [
    '$out = @{ trackName=""; artist=""; isPlaying=$false; durationMs=0; positionMs=0 }',
    'try {',
    '  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue',
    '  $mc = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]',
    '  $mgr = $null',
    '  try { $mgr = $mc::RequestAsync().GetAwaiter().GetResult() } catch {}',
    '  if (-not $mgr) {',
    '    try {',
    '      $asyncOp = $mc::RequestAsync()',
    '      $exts = [System.Runtime.WindowsRuntime.WindowsRuntimeMarshal].Assembly.GetType("System.WindowsRuntimeSystemExtensions")',
    '      if ($exts) {',
    '        $m = $exts.GetMethods("Static,Public") | Where-Object { $_.Name -eq "AsTask" -and $_.IsGenericMethod } | Select-Object -First 1',
    '        if ($m) { $t = $m.MakeGenericMethod($mc).Invoke($null, @($asyncOp)); $t.Wait(2000) | Out-Null; $mgr = $t.Result }',
    '      }',
    '    } catch {}',
    '  }',
    '  if ($mgr) {',
    '    $s = $mgr.GetCurrentSession()',
    '    if ($s) {',
    '      try { $p = $s.TryGetMediaPropertiesAsync().GetAwaiter().GetResult() } catch { $p = $null }',
    '      $tl = $s.GetTimelineProperties()',
    '      $pb = $s.GetPlaybackInfo()',
    '      $playEnum = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus,Windows.Media.Control,ContentType=WindowsRuntime]',
    '      $out.trackName  = if ($p) { [string]$p.Title }  else { "" }',
    '      $out.artist     = if ($p) { [string]$p.Artist } else { "" }',
    '      $out.isPlaying  = ($pb.PlaybackStatus -eq $playEnum::Playing)',
    '      $out.durationMs = [long]$tl.EndTime.TotalMilliseconds',
    '      $out.positionMs = [long]$tl.Position.TotalMilliseconds',
    '    }',
    '  }',
    '} catch {}',
    'if (-not $out.trackName) {',
    '  try {',
    '    $sp = Get-Process Spotify -EA SilentlyContinue | Where-Object { $_.MainWindowTitle.Length -gt 10 } | Select-Object -First 1',
    '    if ($sp -and $sp.MainWindowTitle -match "^(.+?) - (.+)$") {',
    '      $out.artist = $Matches[1].Trim(); $out.trackName = $Matches[2].Trim(); $out.isPlaying = $true',
    '    }',
    '  } catch {}',
    '}',
    '$out | ConvertTo-Json -Compress',
  ];
  fs.writeFileSync(SMTC_SCRIPT_PATH, lines.join('\r\n'), 'utf8');
}

function pollMediaSession(win) {
  if (process.platform !== 'win32') return;
  exec(
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${SMTC_SCRIPT_PATH}"`,
    { timeout: 4000 },
    (_err, stdout) => {
      try {
        const data = JSON.parse(stdout?.trim() || '{}');
        const key = `${data.trackName}|${data.isPlaying}|${Math.floor((data.positionMs || 0) / 5000)}`;
        if (key !== lastNowPlayingKey) {
          lastNowPlayingKey = key;
          if (win && !win.isDestroyed()) win.webContents.send('nowplaying-change', data);
        }
      } catch {}
      mediaSessionTimer = setTimeout(() => pollMediaSession(win), 5000);
    }
  );
}

// R.E.P.O. log parsing — tracks read position so we only parse new bytes each tick
const REPO_LOG_PATH = path.join(os.homedir(), 'AppData', 'LocalLow', 'Semiwork', 'REPO', 'Player.log');
let repoLogPos   = 0;
let repoGameStats = null; // { level: number|null, lobbySize: number|null }

function writeFullscreenScript() {
  const excludeArr = FULLSCREEN_EXCLUDE.map(p => `'${p}'`).join(',');
  // IMPORTANT: PowerShell here-string closing marker ('@ ) must be at column 0
  const lines = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$sw = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width',
    '$sh = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height',
    "Add-Type @'",
    'using System; using System.Runtime.InteropServices;',
    'public class SpidrWinAPI {',
    '    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);',
    '    public struct RECT { public int L,T,R,B; }',
    '}',
    "'@",
    `$ex = @(${excludeArr})`,
    '$procs = Get-Process -ErrorAction SilentlyContinue',
    '$procs | ForEach-Object { Write-Output "PROC:$($_.ProcessName)|$($_.Path)" }',
    '$procs | Where-Object { $_.MainWindowHandle -ne 0 -and $ex -notcontains $_.ProcessName } | ForEach-Object {',
    '    $r = New-Object SpidrWinAPI+RECT',
    '    if ([SpidrWinAPI]::GetWindowRect($_.MainWindowHandle, [ref]$r)) {',
    '        $w = $r.R - $r.L; $h = $r.B - $r.T',
    '        if ($w -ge ($sw - 4) -and $h -ge ($sh - 4)) {',
    '            Write-Output "FULLSCREEN:$($_.ProcessName)|$($_.Path)"',
    '        }',
    '    }',
    '}',
  ];
  fs.writeFileSync(PS_SCRIPT_PATH, lines.join('\r\n'), 'utf8');
}

// Fast tasklist scan — used when PowerShell is unavailable or times out
function scanProcessesFast() {
  return new Promise((resolve) => {
    exec('tasklist /fo csv /nh', { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve({ active: false, game: null, character: null, inSession: false });
      for (const line of stdout.split('\n')) {
        const m = line.match(/^"([^"]+)"/);
        if (!m) continue;
        const name = m[1].replace(/\.exe$/i, '');
        const game = KNOWN_GAMES_WIN[name];
        if (game) return resolve({ active: true, inSession: false, game, character: null });
      }
      resolve({ active: false, game: null, character: null, inSession: false });
    });
  });
}

// Turn an unknown process name into something readable enough to display
function readableProcName(name) {
  return name.replace(/[-_]/g, ' ').replace(/\.exe$/i, '').trim() || name;
}

let currentGamingStatus = { active: false, game: null, character: null, inSession: false };
let gameDetectionInterval = null;

// Riot Live Client Data API — only responds during an active in-game session
function riotFetch(endpoint) {
  return new Promise((resolve) => {
    const req = https.get(
      `https://127.0.0.1:2999/liveclientdata/${endpoint}`,
      { rejectUnauthorized: false },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      }
    );
    req.setTimeout(800, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function getRiotGameData() {
  const [player, stats] = await Promise.all([
    riotFetch('activeplayer'),
    riotFetch('gamestats'),
  ]);
  const championName = player?.championName ?? null;
  const rawMode      = stats?.gameMode ?? null;
  const gameMode     = rawMode ? (GAME_MODE_LABELS[rawMode] || rawMode) : null;
  const gameTime     = typeof stats?.gameTime === 'number' ? stats.gameTime : null;
  // Convert elapsed seconds → absolute timestamp so the widget timer survives remounts
  const sessionStart = gameTime != null ? Date.now() - Math.floor(gameTime * 1000) : null;
  return { championName, gameMode, sessionStart };
}

// R.E.P.O. log parsing — reads only new bytes appended since the last tick
function parseRepoLog() {
  try {
    if (!fs.existsSync(REPO_LOG_PATH)) return;
    const stat = fs.statSync(REPO_LOG_PATH);
    if (stat.size <= repoLogPos) return;
    const fd    = fs.openSync(REPO_LOG_PATH, 'r');
    const chunk = Buffer.allocUnsafe(stat.size - repoLogPos);
    fs.readSync(fd, chunk, 0, chunk.length, repoLogPos);
    fs.closeSync(fd);
    repoLogPos = stat.size;
    const lines = chunk.toString('utf8').split('\n');
    for (const line of lines) {
      // Unity scene load: "Scene 'Level_1' loaded" or "Loading scene: Level 2"
      const lvlMatch = line.match(/(?:Scene\s+['"]?|Loading\s+scene[:\s]+['"]?)Level[_\s](\d+)/i);
      if (lvlMatch) {
        repoGameStats = { ...(repoGameStats || { level: null, lobbySize: null }), level: parseInt(lvlMatch[1], 10) };
      }
      // Photon room player count: "X players" or "Players in room: X" or "Player count: X"
      const lobbyMatch = line.match(/(?:Players?\s+(?:in\s+room|count)[:\s]+(\d+)|Joined\s+room.*?with\s+(\d+)\s+player|Room\s+player\s+count[:\s]+(\d+))/i);
      if (lobbyMatch) {
        const size = parseInt(lobbyMatch[1] || lobbyMatch[2] || lobbyMatch[3], 10);
        if (!isNaN(size)) repoGameStats = { ...(repoGameStats || { level: null, lobbySize: null }), lobbySize: size };
      }
    }
  } catch { /* non-fatal — log may not exist or be locked */ }
}

function resetRepoLog() {
  repoLogPos    = 0;
  repoGameStats = null;
}

// Enrich a status object with session timer + R.E.P.O. game stats.
// Mutates and returns newStatus — call before emitting or storing.
function enrichStatus(newStatus) {
  if (newStatus.inSession) {
    if (newStatus.game === currentGamingStatus.game && currentGamingStatus.sessionStart) {
      // Same active session — preserve existing timestamp (League overrides via Riot API)
      if (!newStatus.sessionStart) newStatus.sessionStart = currentGamingStatus.sessionStart;
    } else if (!newStatus.sessionStart) {
      // New session or new game — stamp now
      newStatus.sessionStart = Date.now();
    }
    if (newStatus.game === 'R.E.P.O.') {
      parseRepoLog();
      if (repoGameStats) newStatus.gameStats = { ...repoGameStats };
    }
  } else {
    // Session ended
    if (currentGamingStatus.game === 'R.E.P.O.') resetRepoLog();
  }
  return newStatus;
}

async function scanProcesses() {
  // ── macOS / Linux: ps-based scan for known games ──────────────────────────
  if (process.platform !== 'win32') {
    return new Promise((resolve) => {
      exec('ps -ax -o comm=', { timeout: 5000 }, async (err, stdout) => {
        if (err) return resolve(currentGamingStatus);
        for (const [proc, name] of Object.entries(KNOWN_GAMES_MAC)) {
          if (stdout.includes(proc)) {
            const newStatus = enrichStatus({ active: true, inSession: true, game: name, character: null });
            const changed = JSON.stringify(newStatus) !== JSON.stringify(currentGamingStatus);
            if (changed) { currentGamingStatus = newStatus; mainWindow?.webContents.send('gaming:status', newStatus); }
            return resolve(newStatus);
          }
        }
        const empty = enrichStatus({ active: false, game: null, character: null, inSession: false });
        const changed = JSON.stringify(empty) !== JSON.stringify(currentGamingStatus);
        if (changed) { currentGamingStatus = empty; mainWindow?.webContents.send('gaming:status', empty); }
        return resolve(empty);
      });
    });
  }

  // ── Windows: fullscreen detection via PowerShell ──────────────────────────
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${PS_SCRIPT_PATH}"`,
      { timeout: 8000 },
      async (err, stdout) => {
        if (err) {
          // PowerShell unavailable — fall back to fast tasklist scan
          const fallback = enrichStatus(await scanProcessesFast());
          const changed = JSON.stringify(fallback) !== JSON.stringify(currentGamingStatus);
          if (changed) { currentGamingStatus = fallback; mainWindow?.webContents.send('gaming:status', fallback); }
          return resolve(fallback);
        }

        const lines          = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        const fullscreenProcs = lines.filter(l => l.startsWith('FULLSCREEN:')).map(l => l.slice(11));
        const allProcs        = lines.filter(l => l.startsWith('PROC:')).map(l => l.slice(5));

        let newStatus;

        if (fullscreenProcs.length > 0) {
          // PRIMARY: fullscreen window found — any game, known or not
          // Each entry is "ProcessName|C:\path\to\game.exe"
          const [proc, exePath = null] = fullscreenProcs[0].split('|');
          const gameName = KNOWN_GAMES_WIN[proc] !== undefined
            ? KNOWN_GAMES_WIN[proc]   // may be null (e.g. javaw) → skip below
            : readableProcName(proc);

          if (gameName) {
            let character = null;
            let gameMode  = null;
            let sessionStart = null;
            if (gameName === 'League of Legends') {
              const riotData = await getRiotGameData();
              character    = riotData.championName;
              gameMode     = riotData.gameMode;
              sessionStart = riotData.sessionStart;
            }
            newStatus = enrichStatus({ active: true, inSession: true, game: gameName, character, exePath, gameMode, sessionStart });
          }
        }

        if (!newStatus) {
          // FALLBACK: known client/lobby process running in background
          const knownEntry = allProcs.find(p => KNOWN_GAMES_WIN[p.split('|')[0]]);
          if (knownEntry) {
            const [procName, exePath = null] = knownEntry.split('|');
            const game = KNOWN_GAMES_WIN[procName];
            newStatus = enrichStatus({ active: true, inSession: false, game, character: null, exePath: exePath || null });
          } else {
            newStatus = enrichStatus({ active: false, game: null, character: null, inSession: false });
          }
        }

        const changed = JSON.stringify(newStatus) !== JSON.stringify(currentGamingStatus);
        if (changed) {
          currentGamingStatus = newStatus;
          mainWindow?.webContents.send('gaming:status', newStatus);
        }
        resolve(newStatus);
      }
    );
  });
}

// Renderer can request the current status immediately (e.g. on widget mount)
ipcMain.handle('gaming:request-status', async () => {
  return await scanProcesses();
});

// Extract the native icon from a game's .exe — used for unknown/unrecognised games
ipcMain.handle('game:get-icon', async (_evt, exePath) => {
  if (!exePath) return null;
  try {
    const icon = await app.getFileIcon(exePath, { size: 'large' });
    return icon.toDataURL(); // base64 data URL, safe to send over IPC
  } catch {
    return null;
  }
});

app.whenReady().then(() => {
  createSplash();

  // ── Media permissions (fixes calling & streaming in the packaged app) ────
  // Chromium asks the embedder to approve getUserMedia / display-capture.
  // A browser shows its permission prompt; Electron has NO default UI and
  // silently DENIES when no handler is registered — so mic/camera/screen
  // requests failed inside the exe while working fine on web. Grant the
  // media family for our own app content only.
  try {
    const ALLOWED = new Set([
      'media',                 // microphone + camera
      'display-capture',       // screen share (pairs with the request handler below)
      'mediaKeySystem',
      'notifications',
      'clipboard-sanitized-write',
      'fullscreen',
      'pointerLock',
      'speaker-selection',
    ]);
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(ALLOWED.has(permission));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission) => ALLOWED.has(permission));
  } catch (e) {
    console.warn('permission handler registration:', e?.message);
  }

  // ── Screen-share capture (fixes Electron streaming) ──────────────────────
  // In a browser, navigator.mediaDevices.getDisplayMedia() pops the native
  // picker. In Electron (contextIsolation: true, nodeIntegration: false) that
  // call rejects unless the main process registers a display-media request
  // handler — which is why screen sharing silently failed on the desktop app
  // while it worked on web. We resolve the source the renderer picked (via the
  // StreamSelector → ipc 'desktop:set-share-source') and grant it; if nothing
  // was pre-selected we fall back to the primary screen. Audio uses 'loopback'
  // on Windows so system sound is captured with the screen.
  try {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'] })
        .then((sources) => {
          if (!sources || sources.length === 0) { callback({}); return; }
          let chosen = null;
          if (pendingShareSourceId) {
            chosen = sources.find(s => s.id === pendingShareSourceId) || null;
          }
          // Fall back to the first whole-screen source, else the first source.
          if (!chosen) {
            chosen = sources.find(s => s.id.startsWith('screen:')) || sources[0];
          }
          pendingShareSourceId = null; // consume the selection
          const grant = { video: chosen };
          if (process.platform === 'win32') grant.audio = 'loopback';
          callback(grant);
        })
        .catch(() => callback({}));
    }, { useSystemPicker: false });
  } catch (e) {
    // setDisplayMediaRequestHandler throws if called twice; safe to ignore.
    console.warn('display-media handler registration:', e?.message);
  }

  createWindow();
  setupAutoUpdater();
  // Global hotkey: Shift+Enter focuses the overlay for typing (or hands control
  // back if it's already interactive). Registered app-wide so it works while a
  // game has focus. Failures (e.g. already taken) are non-fatal.
  try {
    globalShortcut.register('Shift+Enter', () => {
      if (!protocolWindow || protocolWindow.isDestroyed()) return;
      setProtocolInteractive(!protocolInteractive);
    });
  } catch {}

  // Write the fullscreen detection script once, then start scanning
  writeFullscreenScript();
  scanProcesses();
  gameDetectionInterval = setInterval(scanProcesses, 10000);

  // OS media session (Windows SMTC) — polls every 5s, emits 'nowplaying-change' on change
  if (process.platform === 'win32') {
    writeSmtcScript();
    pollMediaSession(mainWindow);
  }
});

// ── In-app updates (electron-updater / GitHub Releases) ────────────────────
// Distribution is Hostinger-hosted installer, not Windows Store, so we can't
// rely on the OS to update the app. electron-updater checks the feed defined
// in package.json's `build.publish` (GitHub Releases), downloads the delta or
// full NSIS installer in the background, and — on user confirm — quits and
// re-launches into the new version. Guarded to packaged builds only; dev has
// nothing to upgrade to.
//
// Renderer contract (see preload.js):
//   invoke  'updater:check'         → { ok, current, update? } | { ok:false, error }
//   invoke  'updater:download'      → { ok } | { ok:false, error }
//   send    'updater:quit-install'  → app quits and installs on next launch
//   on      'updater:status'        → { phase, ...payload }  broadcast events
function broadcastUpdaterStatus(payload) {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('updater:status', payload);
    }
  } catch {}
}

// How often to silently re-check in the background once the app is running
// (in addition to the one-shot check shortly after launch). Catches updates
// published while a user leaves Spidr open for hours/days.
const UPDATE_RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
let updateRecheckInterval = null;

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    // Lazy-require so a missing dep in dev doesn't crash the boot path.
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    console.warn('electron-updater unavailable:', e?.message);
    return;
  }

  autoUpdater.autoDownload = false;       // wait for user consent
  autoUpdater.autoInstallOnAppQuit = true; // if downloaded, install on next quit
  autoUpdater.on('checking-for-update', () => broadcastUpdaterStatus({ phase: 'checking' }));
  autoUpdater.on('update-available',    (info) => broadcastUpdaterStatus({ phase: 'available',    version: info?.version }));
  autoUpdater.on('update-not-available',(info) => broadcastUpdaterStatus({ phase: 'up-to-date',   version: info?.version }));
  autoUpdater.on('download-progress',   (p)    => broadcastUpdaterStatus({ phase: 'downloading',  percent: Math.round(p?.percent || 0), bytesPerSecond: p?.bytesPerSecond }));
  autoUpdater.on('update-downloaded',   (info) => broadcastUpdaterStatus({ phase: 'downloaded',   version: info?.version }));
  autoUpdater.on('error',               (err)  => broadcastUpdaterStatus({ phase: 'error',        message: String(err?.message || err) }));

  // Silent auto-check: fires once ~10s after launch (after the window has had
  // a moment to paint, so it never competes with startup) and then on a
  // recurring interval. Failures are swallowed — this is best-effort background
  // discovery; the user can always trigger a check by hand from the update
  // banner or Settings, and that path surfaces its own errors.
  const silentCheck = () => { autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(silentCheck, 10_000);
  updateRecheckInterval = setInterval(silentCheck, UPDATE_RECHECK_INTERVAL_MS);
}

ipcMain.handle('updater:check', async () => {
  const current = app.getVersion();
  if (!app.isPackaged || !autoUpdater) {
    return { ok: false, current, error: 'Updates are only available in the packaged app.' };
  }
  try {
    const res = await autoUpdater.checkForUpdates();
    return { ok: true, current, update: res?.updateInfo || null };
  } catch (e) {
    return { ok: false, current, error: String(e?.message || e) };
  }
});

ipcMain.handle('updater:download', async () => {
  if (!app.isPackaged || !autoUpdater) return { ok: false, error: 'not-packaged' };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.on('updater:quit-install', () => {
  if (!app.isPackaged || !autoUpdater) return;
  try { autoUpdater.quitAndInstall(); } catch (e) { console.warn('quitAndInstall:', e?.message); }
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
  if (gameDetectionInterval) clearInterval(gameDetectionInterval);
  if (mediaSessionTimer) clearTimeout(mediaSessionTimer);
  if (updateRecheckInterval) clearInterval(updateRecheckInterval);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
