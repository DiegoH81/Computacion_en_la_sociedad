// La sincronización automática mientras hay sesión, y el estado que muestra la pantalla.
//
// Se sincroniza cada SYNC_INTERVAL_MS. Si el token vence (dura 8 horas), se pide otro con la
// misma contraseña, sin molestar al usuario.

import type { SyncEntity } from '../../../shared/sync';
import { OFFLINE_TOKEN } from '../../shared';
import { current_key, database_paths, get_database } from '../db/app_database';
import { current_session, require_session, saved_credentials } from '../models/session';
import { SYNC_INTERVAL_MS, SYNC_KEYS } from '../utils/config';
import { ServiceError } from '../utils/errors';
import * as logger from '../utils/logger';
import { is_connection_error, remote_request, request_login } from './online';
import { set_sync_value } from './queue';
import { upload_key_copy } from './recovery';
import { read_queue_summary, resolve_conflict, run_sync, type ConflictChoice } from './sync';

//   en-linea        hay conexión y la última sincronización salió bien
//   sin-conexion    no se pudo conectar
//   requiere-login  el servidor ya no acepta la contraseña: hay que volver a entrar
//   error           la sincronización falló por otro motivo
export type ConnectionMode = 'en-linea' | 'sin-conexion' | 'requiere-login' | 'error';

let mode: ConnectionMode = 'sin-conexion';
let last_error: string | null = null;
let running_sync: Promise<void> | null = null;
let sync_timer: ReturnType<typeof setInterval> | null = null;

// Al iniciar sesión.
export function start_auto_sync(initial_mode: ConnectionMode): void
{
	if (!sync_timer)
		sync_timer = setInterval(() => void sync_now(), SYNC_INTERVAL_MS);

	mode = initial_mode;
}

export function stop_auto_sync(): void
{
	if (sync_timer)
		clearInterval(sync_timer);

	sync_timer = null;
}

// Al cerrar sesión: el estado vuelve a como estaba antes del login.
export function reset_sync_status(): void
{
	mode = 'sin-conexion';
	last_error = null;
}

// Pide un token nuevo con la contraseña guardada. Devuelve null si no se pudo, y actualiza el modo.
async function renew_token(): Promise<string | null>
{
	const session = current_session();
	const login = saved_credentials();
	if (!session || !login)
		return null;

	try
	{
		const response = await request_login(remote_request, login.username, login.password);
		session.token = response.token;
		session.role = response.usuario.rol;
		session.parish_id = response.usuario.parroquia_id;
		return response.token;
	}
	catch (error)
	{
		session.token = '';

		if (is_connection_error(error))
		{
			mode = 'sin-conexion';
			return null;
		}

		mode = 'requiere-login';
		last_error = 'La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.';
		return null;
	}
}

// Corre "action" con un token válido. Si el servidor responde 401 (el token venció tras la jornada
// de 8 horas), pide otro y lo intenta una vez más. Si no hay forma de conseguir token, no hace nada.
async function with_token(action: (token: string) => Promise<void>): Promise<void>
{
	const token = current_session()?.token || (await renew_token());
	if (!token)
		return;

	try
	{
		await action(token);
	}
	catch (error)
	{
		const token_expired = error instanceof ServiceError && error.status === 401;
		if (!token_expired)
			throw error;

		const new_token = await renew_token();
		if (new_token)
			await action(new_token);
	}
}

async function perform_sync(): Promise<void>
{
	last_error = null;

	try
	{
		let completed = false;

		await with_token(async (token) =>
		{
			const db = get_database();
			await run_sync(db, remote_request, token);
			completed = true;

			// Si falla la copia de la clave, la sincronización igual cuenta como hecha.
			const key = current_key();
			if (key)
			{
				await upload_key_copy(db, database_paths(), key, remote_request, token, current_session()?.parish_id ?? null).catch((error) =>
				{
					logger.error('No se pudo subir la copia de la clave:', error);
				});
			}
		});

		if (completed)
			mode = 'en-linea';
	}
	catch (error)
	{
		if (is_connection_error(error))
		{
			mode = 'sin-conexion';
			return;
		}

		logger.error('Falló la sincronización:', error);
		mode = 'error';
		last_error = error instanceof ServiceError ? error.message : 'Ocurrió un error al sincronizar.';
	}
}

// Nunca falla: lo que no se pudo subir sigue en la cola, y el estado se ve en get_sync_status.
// Si ya hay una sincronización en curso, devuelve esa misma en vez de empezar otra.
export function sync_now(): Promise<void>
{
	if (!current_session())
		return Promise.resolve();

	if (!running_sync)
		running_sync = perform_sync().finally(() => { running_sync = null; });

	return running_sync;
}

// Lo que muestra la pantalla de sincronización.
export function get_sync_status()
{
	require_session();

	return {
		...read_queue_summary(get_database()),
		modo: mode,
		en_curso: running_sync !== null,
		mensaje: last_error,
		token: current_session()?.token || OFFLINE_TOKEN,
	};
}

export async function resolve_sync_conflict(entity: SyncEntity, client_id: string, choice: ConflictChoice): Promise<void>
{
	require_session();

	let done = false;
	await with_token(async (token) =>
	{
		await resolve_conflict(get_database(), remote_request, token, entity, client_id, choice);
		done = true;
	});

	if (!done)
		throw new ServiceError('Se necesita conexión para resolver el conflicto.', 0);

	await sync_now();
}

export function dismiss_sync_notice(): void
{
	require_session();
	set_sync_value(get_database(), SYNC_KEYS.notice, null);
}

// Al cerrar la app: intenta subir lo pendiente, pero sin retener el cierre más de limit_ms.
export async function sync_before_quit(limit_ms: number): Promise<void>
{
	if (!current_session())
		return;

	const summary = read_queue_summary(get_database());
	if (summary.pendientes === 0)
		return;

	const time_limit = new Promise((resolve) => setTimeout(resolve, limit_ms));
	await Promise.race([sync_now(), time_limit]);
}
