import { app, ipcMain } from 'electron';
import { duplicate_routes } from './controllers/duplicates';
import { login_routes } from './controllers/login';
import { minister_routes } from './controllers/ministers';
import { parish_routes } from './controllers/parishes';
import { sacrament_index_routes } from './controllers/sacrament_index';
import { sacrament_routes } from './controllers/sacraments';
import { statistics_routes } from './controllers/statistics';
import { sync_routes } from './controllers/sync';
import { close_database, open_at_startup } from './db/app_database';
import { stop_auto_sync, sync_before_quit } from './sync/auto_sync';
import { QUIT_SYNC_LIMIT_MS } from './utils/config';
import * as logger from './utils/logger';
import { listen } from './utils/middleware';

export function register_routes(): void
{
	const routes =
	{
		...parish_routes,
		...minister_routes,
		...sacrament_routes,
		...duplicate_routes,
		...statistics_routes,
		...sacrament_index_routes,
		...sync_routes,
	};

	listen(routes, login_routes);
}

export function setup(): void
{
	ipcMain.handle('app:get-version', () => app.getVersion());
	register_routes();

	try
	{
		open_at_startup();
	}
	catch (error)
	{
		logger.error('No se pudo abrir la base local:', error);
	}
}

export async function finish_pending_sync(): Promise<void>
{
	stop_auto_sync();

	try
	{
		await sync_before_quit(QUIT_SYNC_LIMIT_MS);
	}
	catch (error)
	{
		logger.error('No se pudo sincronizar al cerrar:', error);
	}
}

export function shutdown(): void
{
	close_database();
}
