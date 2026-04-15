const { contextBridge, ipcRenderer } = require('electron');

// Expose safe window control APIs to the React renderer
contextBridge.exposeInMainWorld('electronAPI', {
  minimize:  () => ipcRenderer.send('minimize-window'),
  maximize:  () => ipcRenderer.send('maximize-window'),
  close:     () => ipcRenderer.send('close-window'),
  isElectron: true,
  platform:  process.platform,
});
