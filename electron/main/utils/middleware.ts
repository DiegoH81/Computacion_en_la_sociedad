import { app, ipcMain } from 'electron';
import { LOCAL_REQUEST_CHANNEL, type LocalResponse } from '../../shared';
import { get_database } from '../db/app_database';
import type { LocalDatabase } from '../db/database';
import { require_session, type Session } from '../models/session';
import { ServiceError } from './errors';
import * as logger from './logger';

export interface RequestContext
{
	session: Session;
	db: LocalDatabase;
	user_data_folder: string;
}

export type Routes = Record<string, (payload: any, context: RequestContext) => unknown>;
export type PublicRoutes = Record<string, (payload: any) => unknown>;

async function run(routes: Routes, public_routes: PublicRoutes, method: string, payload: unknown): Promise<unknown>
{
	if (Object.hasOwn(public_routes, method))
		return public_routes[method](payload);

	if (!Object.hasOwn(routes, method))
		throw new ServiceError('Operación no reconocida.', 404);

	const context: RequestContext =
	{
		session: require_session(),
		db: get_database(),
		user_data_folder: app.getPath('userData'),
	};

	return routes[method](payload, context);
}

export function listen(routes: Routes, public_routes: PublicRoutes): void
{
	ipcMain.handle(LOCAL_REQUEST_CHANNEL, async (_event, method: string, payload: unknown): Promise<LocalResponse> =>
	{
		try
		{
			const data = await run(routes, public_routes, method, payload);
			return { ok: true, data: data };
		}
		catch (error)
		{
			if (error instanceof ServiceError)
				return { ok: false, message: error.message, status: error.status };

			logger.error(`Error en ${method}:`, error);
			return { ok: false, message: 'Ocurrió un error inesperado.', status: 500 };
		}
	});
}
