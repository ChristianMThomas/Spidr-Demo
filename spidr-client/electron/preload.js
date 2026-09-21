const { contextBridge, ipcRenderer } = require('electron');

// Expose safe window control APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
  minimize:  () => ipcRenderer.send('minimize-window'),
  maximize:  () => ipcRenderer.send('maximize-window'),
  close:     () => ipcRenderer.send('close-window'),
  isElectron: true,
  platform:  process.platform,
  quickBrowser: {
    open: () => ipcRenderer.invoke('quick-browser:open'),
    navigate: input => ipcRenderer.invoke('quick-browser:navigate', input),
    action: action => ipcRenderer.invoke('quick-browser:action', action),
    layout: layout => ipcRenderer.invoke('quick-browser:layout', layout),
    close: () => ipcRenderer.invoke('quick-browser:close'),
    onState: callback => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('quick-browser:state', handler);
      return () => ipcRenderer.removeListener('quick-browser:state', handler);
    },
  },

  // Screen-share capture. getDesktopSources() lists real screens/windows for
  // the StreamSelector; setShareSource(id) tells the main process which one to
  // grant on the next getDisplayMedia() call (see main.js display-media handler).
  getDesktopSources: () => ipcRenderer.invoke('desktop:get-sources'),
  setShareSource:    (id) => ipcRenderer.send('desktop:set-share-source', id),

  // Video call pop-out (2.1). openPopout takes the call's identifiers; the
  // child window re-joins the same call. onPopoutClosed lets the main window
  // restore its inline grid when the pop-out is closed.
  openPopout:  (params) => ipcRenderer.send('popout:open', params),
  closePopout: () => ipcRenderer.send('popout:close'),
  onPopoutClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('popout:closed', handler);
    return () => ipcRenderer.removeListener('popout:closed', handler);
  },

  // 2.2 — window focus/blur events for optional call PiP on focus loss.
  onWindowBlur: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('window:blur', handler);
    return () => ipcRenderer.removeListener('window:blur', handler);
  },
  onWindowFocus: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('window:focus', handler);
    return () => ipcRenderer.removeListener('window:focus', handler);
  },

  // Spidr Protocol text overlay (Ghost Window). openProtocol spawns the
  // transparent, click-through, always-on-top HUD. setProtocolInteractive lets
  // the overlay hand mouse/keyboard control back to the game when done typing.
  // onProtocolInteractive notifies the overlay when the global hotkey toggles
  // interactive mode so it can reveal/hide the input bar.
  openProtocol:  (params) => ipcRenderer.send('protocol:open', params),
  closeProtocol: () => ipcRenderer.send('protocol:close'),
  setProtocolInteractive: (on) => ipcRenderer.send('protocol:set-interactive', on),
  // Briefly open a clickable hole in the otherwise click-through overlay so the
  // user can press the red anchor dot to manually open the chat. Pass false on
  // mouseenter, true on mouseleave (or any time the renderer wants the window
  // to go back to passing mouse events through to the game underneath).
  setProtocolClickthrough: (ignore) => ipcRenderer.send('protocol:set-clickthrough', ignore),
  onProtocolInteractive: (cb) => {
    const handler = (_e, on) => cb(on);
    ipcRenderer.on('protocol:interactive', handler);
    return () => ipcRenderer.removeListener('protocol:interactive', handler);
  },
  onProtocolClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('protocol:closed', handler);
    return () => ipcRenderer.removeListener('protocol:closed', handler);
  },

  // Pin Spidr Protocol anywhere on the user's computer. The window's bounds
  // are persisted in userData and restored on next open (with off-screen
  // validation), so dragging it where you want it is enough.
  //   setProtocolPreset    — 'top-left' | 'top-right' | 'bottom-left' |
  //                          'bottom-right' | 'center' (picks the display
  //                          under the user's cursor)
  //   setProtocolBounds    — explicit { x, y, width?, height? } for fine control
  //   resetProtocolPosition — forget saved bounds, snap back to default
  //   getProtocolBounds    — current bounds (or saved/default if not open)
  setProtocolPreset:     (preset) => ipcRenderer.send('protocol:set-preset', preset),
  setProtocolBounds:     (bounds) => ipcRenderer.send('protocol:set-bounds', bounds),
  resetProtocolPosition: ()       => ipcRenderer.send('protocol:reset-position'),
  getProtocolBounds:     ()       => ipcRenderer.invoke('protocol:get-bounds'),

  // Window maximize/unmaximize — lets the title bar toggle the restore icon
  onWindowMaximize:   (cb) => { const h = () => cb(); ipcRenderer.on('window:maximized', h);   return () => ipcRenderer.removeListener('window:maximized', h); },
  onWindowUnmaximize: (cb) => { const h = () => cb(); ipcRenderer.on('window:unmaximized', h); return () => ipcRenderer.removeListener('window:unmaximized', h); },

  // NowPlaying — emitted whenever OS media session changes (Windows SMTC)
  onNowPlayingChange: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('nowplaying-change', handler);
    return () => ipcRenderer.removeListener('nowplaying-change', handler);
  },

  // Game detection — emitted whenever a known game starts or stops
  onGamingStatus: (cb) => {
    const handler = (_e, status) => cb(status);
    ipcRenderer.on('gaming:status', handler);
    return () => ipcRenderer.removeListener('gaming:status', handler);
  },
  // Ask the main process for the current status immediately (returns a promise)
  requestGamingStatus: () => ipcRenderer.invoke('gaming:request-status'),
  // Extract the native .exe icon for unrecognised games — returns a base64 data URL or null
  getGameIcon: (exePath) => ipcRenderer.invoke('game:get-icon', exePath),

  // In-app updates (electron-updater / GitHub Releases). Only meaningful in a
  // packaged build — main.js short-circuits with { ok:false } in dev.
  //   checkForUpdates  → resolves with { ok, current, update?, error? }
  //   downloadUpdate   → resolves with { ok, error? } once the download finishes
  //   quitAndInstall   → fire-and-forget: app quits and re-launches into new ver
  //   onUpdateStatus   → subscribe to phase events (checking/available/downloading/…)
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate:  () => ipcRenderer.invoke('updater:download'),
  quitAndInstall:  () => ipcRenderer.send('updater:quit-install'),
  onUpdateStatus: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
});
