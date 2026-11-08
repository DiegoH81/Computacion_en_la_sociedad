import { app, ipcMain } from 'electron';
import { request_routes } from './controllers/requests';
import { backup_public_routes, backup_routes } from './controllers/backup';
import { duplicate_routes } from './controllers/duplicates';
import { legacy_import_routes } from './controllers/legacy_import';
import { login_routes } from './controllers/login';
import { minister_routes } from './controllers/ministers';
import { load_bundled_package, package_public_routes, package_routes } from './controllers/package';
import { parish_routes } from './controllers/parishes';
import { server_routes } from './controllers/server';
import { sacrament_index_routes } from './controllers/sacrament_index';
import { sacrament_routes } from './controllers/sacraments';
import { statistics_routes } from './controllers/statistics';
import { sync_routes } from './controllers/sync';
import { user_routes } from './controllers/users';
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
		...user_routes,
		...request_routes,
		...legacy_import_routes,
		...package_routes,
		...backup_routes,
	};

	listen(routes, { ...login_routes, ...package_public_routes, ...backup_public_routes, ...server_routes });
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

	load_bundled_package();
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
