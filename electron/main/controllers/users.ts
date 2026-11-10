import type { AdditionalParish, NameColumn, SearchFilters, SearchPage, User } from '../../../shared/models';
import {
	can_manage_users,
	cannot_change_parishes,
	cannot_create,
	cannot_disable,
	cannot_modify,
	is_role,
	password_error,
	role_parish_error,
	USERNAME_PATTERN,
	type Actor,
	type TargetUser,
} from '../../../shared/users';
import type { LocalDatabase } from '../db/database';
import { current_session, type Session } from '../models/session';
import { actor_in_parish, read_target_in_parish, type LocalTarget } from '../models/user';
import { sync_now } from '../sync/auto_sync';
import { remote_request } from '../sync/online';
import { add_to_queue } from '../sync/queue';
import { PAGE_SIZE } from '../utils/config';
import { create_server_hash } from '../utils/crypto';
import { ServiceError } from '../utils/errors';
import { clean_text, page_of, sort_direction } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

const NOT_FOUND = 'Usuario no encontrado.';

const PARISHES_NEED_INTERNET = 'Agregar o quitar parroquias necesita conexión a internet: la cuenta tiene que estar en el servidor.';

const SORT_COLUMNS: Record<NameColumn, string> =
{
	nombres: 'nombre',
	apellido_paterno: 'apellido_paterno',
	apellido_materno: 'apellido_materno',
};

function check_can_manage(session: Session): void
{
	if (!can_manage_users(session.role))
		throw new ServiceError('Solo un administrador puede gestionar usuarios.', 403);
}

function actor_of(db: LocalDatabase, session: Session): Actor
{
	return actor_in_parish(db, session.user_id, session.role, session.parish_id);
}

function read_target(db: LocalDatabase, session: Session, user_id: number): LocalTarget
{
	const target = read_target_in_parish(db, user_id, session.parish_id);
	if (!target)
		throw new ServiceError(NOT_FOUND, 404);

	return target;
}

function becomes_principal(db: LocalDatabase, role: string, parish_id: number | null): number
{
	if (role !== 'admin_parroquia')
		return 0;

	const has_principal = db.prepare('SELECT 1 FROM membresias WHERE principal = 1 AND parroquia_id = ?').get(parish_id) !== undefined;
	return has_principal ? 0 : 1;
}

function check_password(password: string, required: boolean): void
{
	if (!password && !required)
		return;

	const reason = password_error(password);
	if (reason)
		throw new ServiceError(reason, 400);
}

function clean_names(user: User): { nombre: string; apellido_paterno: string; apellido_materno: string }
{
	const nombre = clean_text(user?.nombre);
	const apellido_paterno = clean_text(user?.apellido_paterno);

	if (!nombre || !apellido_paterno)
		throw new ServiceError('Nombre y apellido paterno son requeridos.', 400);

	return { nombre: nombre, apellido_paterno: apellido_paterno, apellido_materno: clean_text(user.apellido_materno) ?? '' };
}

// La contraseña nueva queda como credencial de esta PC y pendiente de subir al servidor.
function save_password(db: LocalDatabase, user_id: number, hash: string): void
{
	db.prepare('UPDATE usuarios SET password_hash_pendiente = ? WHERE id = ?').run(hash, user_id);
	db.prepare(
		`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
		 ON CONFLICT (usuario_id) DO UPDATE SET
			verificador = excluded.verificador,
			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
	).run(user_id, hash);
}

function read_additional_parishes(db: LocalDatabase, user_id: number): AdditionalParish[]
{
	return db
		.prepare(
			`SELECT up.parroquia_id, p.nombre AS parroquia_nombre, up.rol, up.principal
			 FROM usuario_parroquias up
			 JOIN parroquias p ON p.id = up.parroquia_id
			 WHERE up.usuario_id = ?
			 ORDER BY p.nombre`,
		)
		.all(user_id) as AdditionalParish[];
}

export function search_users(db: LocalDatabase, session: Session, filters: SearchFilters): SearchPage<User>
{
	check_can_manage(session);

	const conditions: string[] = [];
	const values: (string | number)[] = [];

	let parish_filter = filters.parroquia_id;
	if (session.role === 'admin_parroquia')
		parish_filter = session.parish_id ?? -1;

	let from = 'FROM usuarios u LEFT JOIN parroquias p ON p.id = u.parroquia_id';
	let role_columns = 'u.rol, u.parroquia_id, u.principal';
	if (Number.isInteger(parish_filter))
	{
		from = 'FROM usuarios u JOIN membresias m ON m.usuario_id = u.id AND m.parroquia_id = ? LEFT JOIN parroquias p ON p.id = m.parroquia_id';
		role_columns = 'm.rol, m.parroquia_id, m.principal';
		values.push(parish_filter as number);
	}

	for (const column of ['nombres', 'apellido_paterno', 'apellido_materno'] as NameColumn[])
	{
		const text = filters[column];
		if (!text)
			continue;

		conditions.push(`u.${SORT_COLUMNS[column]} LIKE ?`);
		values.push(`%${text}%`);
	}

	let where = '';
	if (conditions.length > 0)
		where = 'WHERE ' + conditions.join(' AND ');

	const count = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...values) as { total: number };
	const page = page_of(filters, count.total);
	const sort_column = SORT_COLUMNS[filters.orden ?? 'nombres'] ?? SORT_COLUMNS.nombres;

	const rows = db
		.prepare(
			`SELECT u.id, u.username, ${role_columns}, u.parroquia_id AS parroquia_origen_id,
				u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, p.nombre AS parroquia_nombre
			 ${from}
			 ${where}
			 ORDER BY u.${sort_column} ${sort_direction(filters)}, u.id
			 LIMIT ? OFFSET ?`,
		)
		.all(...values, PAGE_SIZE, page.offset) as User[];

	for (const row of rows)
		row.parroquias_adicionales = read_additional_parishes(db, row.id as number);

	return { resultados: rows, total_paginas: page.total_pages };
}

export async function create_user(db: LocalDatabase, session: Session, user: User): Promise<number>
{
	check_can_manage(session);

	const names = clean_names(user);
	const username = clean_text(user?.username) ?? '';
	const password = typeof user?.password === 'string' ? user.password : '';
	const role = user?.rol ?? 'usuario';

	if (!USERNAME_PATTERN.test(username))
		throw new ServiceError('El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.', 400);

	check_password(password, true);

	if (!is_role(role))
		throw new ServiceError('El rol no es válido.', 400);

	let parish_id: number | null = null;
	if (role !== 'admin_general')
		parish_id = session.role === 'admin_parroquia' ? session.parish_id : (Number.isInteger(user.parroquia_id) ? user.parroquia_id : null);

	const target: TargetUser = { rol: role, parroquia_id: parish_id };

	const parish_error = role_parish_error(target);
	if (parish_error)
		throw new ServiceError(parish_error, 400);

	const reason = cannot_create(actor_of(db, session), target);
	if (reason)
		throw new ServiceError(reason, 403);

	if (parish_id !== null && !db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').get(parish_id))
		throw new ServiceError('La parroquia seleccionada no existe.', 400);

	if (db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE').get(username))
		throw new ServiceError('Ese nombre de usuario ya existe.', 409);

	const hash = await create_server_hash(password);
	const client_id = crypto.randomUUID();

	const create = db.transaction(() =>
	{
		const lowest = db.prepare('SELECT MIN(id) FROM usuarios').pluck().get() as number | null;
		const provisional_id = Math.min(lowest ?? 0, 0) - 1;

		add_to_queue(db, 'usuario', client_id, null);
		db.prepare(
			`INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
		).run(provisional_id, client_id, parish_id, username, role, names.nombre, names.apellido_paterno, names.apellido_materno, becomes_principal(db, role, parish_id));

		save_password(db, provisional_id, hash);
		return provisional_id;
	});

	return create();
}

function username_change(db: LocalDatabase, id: number, value: unknown): string | null
{
	const username = clean_text(value);
	const current = db.prepare('SELECT username FROM usuarios WHERE id = ?').pluck().get(id) as string;
	if (!username || username === current)
		return null;

	if (id > 0)
		throw new ServiceError('El nombre de usuario no se puede cambiar: la cuenta ya está en el servidor.', 400);

	if (!USERNAME_PATTERN.test(username))
		throw new ServiceError('El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.', 400);

	if (db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE AND id <> ?').get(username, id))
		throw new ServiceError('Ese nombre de usuario ya existe.', 409);

	return username;
}

export async function update_user(db: LocalDatabase, session: Session, user: User): Promise<void>
{
	const id = positive_or_provisional_id(user?.id);
	if (id !== session.user_id)
		check_can_manage(session);

	const names = clean_names(user);
	const password = typeof user.password === 'string' ? user.password : '';
	check_password(password, false);

	const target = read_target(db, session, id);
	const reason = cannot_modify(actor_of(db, session), target);
	if (reason)
		throw new ServiceError(reason, 403);

	const hash = password ? await create_server_hash(password) : null;
	const new_username = username_change(db, id, user?.username);

	const update = db.transaction(() =>
	{
		add_to_queue(db, 'usuario', target.client_id, target.version);
		db.prepare('UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?')
			.run(names.nombre, names.apellido_paterno, names.apellido_materno, id);

		if (hash)
			save_password(db, id, hash);

		if (new_username)
		{
			db.prepare('UPDATE usuarios SET username = ? WHERE id = ?').run(new_username, id);
			db.prepare(`UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE entidad = 'usuario' AND client_id = ? AND estado = 'rechazado'`)
				.run(target.client_id);
		}
	});

	update();
}

export function toggle_user_active(db: LocalDatabase, session: Session, user_id: number): void
{
	check_can_manage(session);

	if (user_id === session.user_id)
		throw new ServiceError('No puede deshabilitar su propia cuenta.', 400);

	const target = read_target(db, session, user_id);
	const reason = cannot_modify(actor_of(db, session), target);
	if (reason)
		throw new ServiceError(reason, 403);

	const disable_reason = target.activo === 1 ? cannot_disable(target) : null;
	if (disable_reason)
		throw new ServiceError(disable_reason, 400);

	const toggle = db.transaction(() =>
	{
		add_to_queue(db, 'usuario', target.client_id, target.version);
		db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').run(user_id);

		if (target.activo === 1)
			db.prepare('DELETE FROM credenciales_locales WHERE usuario_id = ?').run(user_id);
	});

	toggle();
}

async function on_server(db: LocalDatabase, username: unknown, offline_message: string, action: (server_id: number, token: string) => Promise<void>): Promise<void>
{
	if (typeof username !== 'string' || !db.prepare('SELECT 1 FROM usuarios WHERE username = ?').get(username))
		throw new ServiceError(NOT_FOUND, 404);

	await sync_now();

	const server_id = db.prepare('SELECT id FROM usuarios WHERE username = ?').pluck().get(username) as number;
	const token = current_session()?.token;
	if (!token || server_id < 0)
		throw new ServiceError(offline_message, 503);

	await action(server_id, token);
	await sync_now();
}

export async function make_principal(db: LocalDatabase, session: Session, username: unknown, parish_id: unknown = null): Promise<void>
{
	check_can_manage(session);

	let parish: number | null = session.role === 'admin_general' ? null : session.parish_id;
	if (Number.isInteger(parish_id))
		parish = parish_id as number;

	await on_server(db, username, 'Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.', async (server_id, token) =>
	{
		await remote_request(`/api/users/${server_id}/make-principal`, { method: 'PATCH', token: token, body: { parroquia_id: parish } });
	});
}

function check_parish_change(db: LocalDatabase, session: Session, user_id: unknown, parish_id: unknown): { username: string; parish_id: number }
{
	const target = read_target(db, session, positive_or_provisional_id(user_id));
	const reason = cannot_change_parishes(actor_of(db, session), target);
	if (reason)
		throw new ServiceError(reason, 403);

	if (!Number.isInteger(parish_id))
		throw new ServiceError('Debe seleccionar una parroquia.', 400);

	const username = db.prepare('SELECT username FROM usuarios WHERE id = ?').pluck().get(target.id) as string;
	return { username: username, parish_id: parish_id as number };
}

export async function set_parish(db: LocalDatabase, session: Session, user_id: unknown, parish_id: unknown, role: unknown): Promise<void>
{
	const checked = check_parish_change(db, session, user_id, parish_id);

	await on_server(db, checked.username, PARISHES_NEED_INTERNET, async (server_id, token) =>
	{
		await remote_request(`/api/users/${server_id}/parishes/${checked.parish_id}`, { method: 'PUT', token: token, body: { rol: role } });
	});
}

export async function remove_parish(db: LocalDatabase, session: Session, user_id: unknown, parish_id: unknown): Promise<void>
{
	const checked = check_parish_change(db, session, user_id, parish_id);

	await on_server(db, checked.username, PARISHES_NEED_INTERNET, async (server_id, token) =>
	{
		await remote_request(`/api/users/${server_id}/parishes/${checked.parish_id}`, { method: 'DELETE', token: token });
	});
}

function positive_or_provisional_id(value: unknown): number
{
	if (!Number.isInteger(value) || value === 0)
		throw new ServiceError(NOT_FOUND, 404);

	return value as number;
}

export const user_routes: Routes =
{
	'users.search': (filters: SearchFilters, { db, session }) =>
	{
		return search_users(db, session, filters ?? {});
	},

	'users.create': async (user: User, { db, session }) =>
	{
		const id = await create_user(db, session, user);
		void sync_now();
		return { id: id };
	},

	'users.update': async (user: User, { db, session }) =>
	{
		await update_user(db, session, user);
		void sync_now();
		return { success: true };
	},

	'users.toggleActive': (payload: { id: unknown }, { db, session }) =>
	{
		toggle_user_active(db, session, positive_or_provisional_id(payload?.id));
		void sync_now();
		return { success: true };
	},

	'users.makePrincipal': async (payload: { username: unknown; parroquia_id?: unknown }, { db, session }) =>
	{
		await make_principal(db, session, payload?.username, payload?.parroquia_id ?? null);
		return { success: true };
	},

	'users.setParish': async (payload: { id: unknown; parroquia_id: unknown; rol: unknown }, { db, session }) =>
	{
		await set_parish(db, session, payload?.id, payload?.parroquia_id, payload?.rol);
		return { success: true };
	},

	'users.removeParish': async (payload: { id: unknown; parroquia_id: unknown }, { db, session }) =>
	{
		await remove_parish(db, session, payload?.id, payload?.parroquia_id);
		return { success: true };
	},

	'users.me': (_payload, { db, session }) =>
	{
		return { principal: can_manage_users(session.role) && actor_of(db, session).principal };
	},
};
