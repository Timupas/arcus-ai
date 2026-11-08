const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc-handlers');
const { getApiKeys } = require('./security');

// Initialize API keys from storage into environment
try {
  const keys = getApiKeys();
  if (keys.googleApiKey) {
    process.env.GOOGLE_API_KEY = keys.googleApiKey;
  }
} catch (_) {}

// Enable Chromium media & speech switches
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');

// Флаг режима разработки
const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Frameless for custom titlebar
    transparent: false,
    backgroundColor: '#000000',
    show: false, // Show when ready to prevent flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    icon: path.join(__dirname, '../../assets/icon.ico'),
  });

  // Strict 3:2 aspect ratio (1.5 = 3:2)
  mainWindow.setAspectRatio(3 / 2);

  // Enforce 3:2 during interactive window resize on Windows
  mainWindow.on('will-resize', (event, newBounds) => {
    newBounds.height = Math.round(newBounds.width / 1.5);
  });

  // Load the app — dev server or production build
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Show window when content is painted
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Window closed handler
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:3000')) return;
    event.preventDefault();
  });

  // Block new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

// ─── Window control IPC ────────────────────────────────────────
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ─── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  // Automatically grant media (microphone) permissions without browser prompts
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return permission === 'media';
  });

  registerIpcHandlers(ipcMain);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
