// Punto de entrada de Electron: crea la ventana y conecta los eventos de la app.
// Todo lo demás (base local, rutas, sincronización) lo arma app.ts.

import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finish_pending_sync, setup, shutdown } from './app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let main_window: BrowserWindow | null = null;
let quit_sync_done = false;

function create_window(): void
{
	main_window = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, 'index.mjs'),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	// Solo para desarrollo: con PRELATURA_SECOND_SCREEN=1 la ventana se abre en la otra pantalla.
	// Sin la variable no cambia nada.
	if (process.env.PRELATURA_SECOND_SCREEN === '1')
	{
		const other_screen = screen.getAllDisplays().find((display) => display.id !== screen.getPrimaryDisplay().id);
		if (other_screen)
			main_window.setBounds(other_screen.workArea);
	}

	main_window.maximize();

	if (VITE_DEV_SERVER_URL)
	{
		main_window.loadURL(VITE_DEV_SERVER_URL);
		main_window.webContents.openDevTools();
	}
	else
		main_window.loadFile(path.join(__dirname, '../dist/index.html'));

	main_window.on('closed', () =>
	{
		main_window = null;
	});
}

app.whenReady().then(() =>
{
	setup();
	create_window();
});

// Antes de cerrar se intenta subir lo pendiente, sin retener el cierre más de unos segundos.
app.on('before-quit', (event) =>
{
	if (quit_sync_done)
		return;

	event.preventDefault();
	quit_sync_done = true;

	finish_pending_sync().finally(() => app.quit());
});

app.on('will-quit', shutdown);

app.on('window-all-closed', () =>
{
	if (process.platform !== 'darwin')
		app.quit();
});

app.on('activate', () =>
{
	if (BrowserWindow.getAllWindows().length === 0)
		create_window();
});
