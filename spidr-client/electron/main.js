const { app, BrowserWindow, ipcMain, shell } = require('electron');
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
