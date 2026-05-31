const { contextBridge, ipcRenderer } = require('electron');

// Expose safe window control APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
  minimize:  () => ipcRenderer.send('minimize-window'),
  maximize:  () => ipcRenderer.send('maximize-window'),
  close:     () => ipcRenderer.send('close-window'),
  isElectron: true,
  platform:  process.platform,

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
});
