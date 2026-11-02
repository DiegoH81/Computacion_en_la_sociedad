import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeLocalDatabase, initLocalDatabase } from './localDb';
import { registerLocalIpc } from './services/ipc';
import { stopPeriodicSync, syncBeforeQuit } from './services/session';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

const QUIT_SYNC_LIMIT_MS = 5_000;

let mainWindow: BrowserWindow | null = null;
let quitSyncDone = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();

  if (VITE_DEV_SERVER_URL)
  {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  }
  else
  {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

app.whenReady().then(() => {
  registerLocalIpc();

  // Si falla, la app abre igual y el login informa que la base local no está disponible.
  try {
    initLocalDatabase();
  } catch (error) {
    console.error('No se pudo abrir la base local:', error);
  }
  createWindow();
});

// Último intento de subir lo pendiente. Lo que no alcance sigue en la cola para la próxima vez.
app.on('before-quit', (event) => {
  if (quitSyncDone) return;
  event.preventDefault();
  quitSyncDone = true;
  stopPeriodicSync();
  syncBeforeQuit(QUIT_SYNC_LIMIT_MS)
    .catch((error) => console.error('No se pudo sincronizar al cerrar:', error))
    .finally(() => app.quit());
});

app.on('will-quit', closeLocalDatabase);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});