import type { LoginResponse } from '../../../shared/sync';
import { OFFLINE_TOKEN } from '../../shared';
import { database_needs_recovery, database_paths, get_database, KEY_STORE, use_database } from '../db/app_database';
import type { LocalDatabase } from '../db/database';
import { end_session, select_working_parish, start_session } from '../models/session';
import { read_user_parishes, type User } from '../models/user';
import { reset_sync_status, start_auto_sync, stop_auto_sync, sync_now } from '../sync/auto_sync';
import { is_connection_error, remote_request, request_login } from '../sync/online';
import { recover_local_database } from '../sync/recovery';
import { refresh_reference } from '../sync/sync';
import { create_verifier, matches_verifier } from '../utils/crypto';
import { ServiceError } from '../utils/errors';
import { full_name } from '../utils/helpers';
import type { PublicRoutes, Routes } from '../utils/middleware';


// Without internet, verifier
export async function save_credential(db: LocalDatabase, user_id: number, password: string): Promise<void>
{
	const verifier = await create_verifier(password);
	db.prepare(
		`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
		 ON CONFLICT (usuario_id) DO UPDATE SET
			verificador = excluded.verificador,
			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
	).run(user_id, verifier);
}

export type OfflineLoginResult =
	| { ok: true; usuario: LoginResponse['usuario'] }
	| { ok: false; reason: 'sin-credencial' | 'incorrecta' };



export async function verify_offline(db: LocalDatabase, username: string, password: string): Promise<OfflineLoginResult>
{
	const row = db
		.prepare(
			`SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
				c.verificador, p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 WHERE u.username = ?`,
		)
		.get(username) as (Omit<User, 'username'> & { verificador: string | null; parroquia_nombre: string | null }) | undefined;

	if (!row || !row.verificador)
		return { ok: false, reason: 'sin-credencial' };

	if (row.activo !== 1)
		return { ok: false, reason: 'incorrecta' };

	const is_valid = await matches_verifier(password, row.verificador);
	if (!is_valid)
		return { ok: false, reason: 'incorrecta' };

	const user =
	{
		id: row.id,
		rol: row.rol,
		parroquia_id: row.parroquia_id,
		parroquia_nombre: row.parroquia_nombre,
		nombre_completo: full_name(row.nombre, row.apellido_paterno, row.apellido_materno),
		parroquias: read_user_parishes(db, row.id),
	};

	return { ok: true, usuario: user };
}

// LOGIN and LOGOUT
async function login_online(response: LoginResponse, username: string, password: string): Promise<LoginResponse>
{
	const token = response.token;
	const user = response.usuario;

	if (database_needs_recovery())
	{
		const recovered = await recover_local_database(database_paths(), KEY_STORE, remote_request, token);
		use_database(recovered.db, recovered.key);
	}

	const db = get_database();

	try
	{
		await refresh_reference(db, remote_request, token);
	}
	catch (error)
	{
		const user_is_known = db.prepare('SELECT 1 FROM usuarios WHERE id = ?').get(user.id);
		if (!user_is_known)
			throw error;
	}

	await save_credential(db, user.id, password);
	start_session({ user_id: user.id, role: user.rol, parish_id: user.parroquia_id, token: token }, username, password);
	start_auto_sync('en-linea');

	await sync_now();

	return { ...response, usuario: { ...user, parroquias: read_user_parishes(db, user.id) } };
}

function start_local_session(user: LoginResponse['usuario'], username: string, password: string): LoginResponse
{
	start_session({ user_id: user.id, role: user.rol, parish_id: user.parroquia_id, token: '' }, username, password);
	start_auto_sync('sin-conexion');
	void sync_now();

	return { token: OFFLINE_TOKEN, usuario: user };
}

export const NOT_IN_THIS_PC = 'Este usuario todavía no está en esta PC. Conéctese a internet para entrar por primera vez, o restaure un respaldo.';

export async function login(payload: { username: string; password: string }): Promise<LoginResponse>
{
	const username = typeof payload?.username === 'string' ? payload.username.trim() : '';
	const password = typeof payload?.password === 'string' ? payload.password : '';

	let local: OfflineLoginResult = { ok: false, reason: 'sin-credencial' };
	if (!database_needs_recovery())
	{
		local = await verify_offline(get_database(), username, password);
		if (local.ok)
			return start_local_session(local.usuario, username, password);
	}

	let response: LoginResponse;
	try
	{
		response = await request_login(remote_request, username, password);
	}
	catch (error)
	{
		if (!is_connection_error(error))
			throw error;

		if (database_needs_recovery())
			throw new ServiceError('La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.', 503);

		if (local.reason === 'sin-credencial')
			throw new ServiceError(NOT_IN_THIS_PC, 401);

		throw new ServiceError('Usuario o contraseña incorrectos.', 401);
	}

	return login_online(response, username, password);
}


export function logout(): void
{
	stop_auto_sync();
	end_session();
	reset_sync_status();
}

export function select_parish(db: LocalDatabase, parish_id: unknown): { rol: User['rol']; parroquia_id: number | null }
{
	if (!Number.isInteger(parish_id))
		throw new ServiceError('Parroquia no válida.', 400);

	const session = select_working_parish(db, parish_id as number);
	return { rol: session.role, parroquia_id: session.parish_id };
}

export const session_routes: Routes =
{
	'auth.selectParish': (payload: { parroquia_id: unknown }, { db }) =>
	{
		return select_parish(db, payload?.parroquia_id);
	},
};

export const login_routes: PublicRoutes =
{
	'auth.login': login,

	'auth.logout': () =>
	{
		logout();
		return { success: true };
	},
};
