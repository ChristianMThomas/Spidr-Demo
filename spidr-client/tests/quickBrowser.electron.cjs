const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');
const { installQuickBrowser } = require('../electron/quickBrowser');

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1100, height: 760, show: false,
    webPreferences: { preload: path.join(__dirname, '../electron/preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  installQuickBrowser({ window: win, ipcMain, WebContentsView, session, shell: { openExternal: async url => { global.externalOpened = url; } },
    isTrustedUrl: url => url === process.env.QUICK_BROWSER_TEST_URL });
  win.loadURL(process.env.QUICK_BROWSER_TEST_URL);
});
app.on('window-all-closed', () => app.quit());
