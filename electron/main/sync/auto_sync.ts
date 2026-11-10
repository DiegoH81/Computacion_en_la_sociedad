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

export type ConnectionMode = 'en-linea' | 'sin-conexion' | 'requiere-login' | 'error';

let mode: ConnectionMode = 'sin-conexion';
let last_error: string | null = null;
let running_sync: Promise<void> | null = null;
let sync_timer: ReturnType<typeof setInterval> | null = null;

// Starting session
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

export function reset_sync_status(): void
{
	mode = 'sin-conexion';
	last_error = null;
}

const ACCOUNT_NOT_UPLOADED = 'Esta cuenta todavía no está en el servidor. Se subirá la próxima vez que el administrador de la parroquia sincronice con internet; hasta entonces puede trabajar sin conexión.';

function is_waiting_upload(user_id: number): boolean
{
	if (user_id < 0)
		return true;

	try
	{
		const row = get_database().prepare('SELECT password_hash_pendiente FROM usuarios WHERE id = ?').get(user_id) as { password_hash_pendiente: string | null } | undefined;
		return Boolean(row?.password_hash_pendiente);
	}
	catch
	{
		return false;
	}
}

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

		if (is_waiting_upload(session.user_id))
		{
			mode = 'error';
			last_error = ACCOUNT_NOT_UPLOADED;
			return null;
		}

		mode = 'requiere-login';
		last_error = 'La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.';
		return null;
	}
}

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


export function sync_now(): Promise<void>
{
	if (!current_session())
		return Promise.resolve();

	if (!running_sync)
		running_sync = perform_sync().finally(() => { running_sync = null; });

	return running_sync;
}

export function wait_for_sync(): Promise<void>
{
	return running_sync ?? Promise.resolve();
}

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
