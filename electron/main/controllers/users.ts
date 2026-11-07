// La gestión de cuentas en esta PC, también sin internet. Los cambios se anotan en la cola y se suben
// al sincronizar (sync/sync.ts); el servidor repite los mismos permisos (shared/users.ts).
//
//   users.search        buscar      { nombres, apellido_paterno, apellido_materno, parroquia_id, orden, direccion, pagina }
//   users.create        crear       el model User con password
//   users.update        editar      nombre, apellidos y (si se manda) la contraseña
//   users.toggleActive  habilitar o deshabilitar
//   users.me            { principal }  si la sesión es la del principal (general o de su parroquia)
//   users.makePrincipal pasarle la marca de principal a otro administrador (en el servidor: necesita internet)
//
// Una cuenta creada aquí recibe un id provisional negativo hasta que el servidor le da el suyo.

import type { NameColumn, SearchFilters, SearchPage, User } from '../../../shared/models';
import { can_manage_users, cannot_create, cannot_disable, cannot_modify, is_role, role_parish_error, USERNAME_PATTERN, type Actor, type TargetUser } from '../../../shared/users';
import type { LocalDatabase } from '../db/database';
import { current_session, type Session } from '../models/session';
import { sync_now } from '../sync/auto_sync';
import { remote_request } from '../sync/online';
import { add_to_queue } from '../sync/queue';
import { PAGE_SIZE } from '../utils/config';
import { create_server_hash } from '../utils/crypto';
import { ServiceError } from '../utils/errors';
import { clean_text, page_of, sort_direction } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

export const PASSWORD_MIN_LENGTH = 8;

const NOT_FOUND = 'Usuario no encontrado.';

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

function is_principal(db: LocalDatabase, session: Session): boolean
{
	const row = db.prepare('SELECT principal FROM usuarios WHERE id = ?').get(session.user_id) as { principal: number } | undefined;
	return row?.principal === 1;
}

function actor_of(db: LocalDatabase, session: Session): Actor
{
	return { id: session.user_id, rol: session.role, parroquia_id: session.parish_id, principal: is_principal(db, session) };
}

function read_target(db: LocalDatabase, user_id: number): TargetUser & { client_id: string; version: number; activo: number }
{
	const row = db.prepare('SELECT id, client_id, rol, parroquia_id, version, activo, principal FROM usuarios WHERE id = ?').get(user_id) as
		| (Omit<TargetUser, 'principal'> & { client_id: string; version: number; activo: number; principal: number })
		| undefined;

	if (!row)
		throw new ServiceError(NOT_FOUND, 404);

	return { ...row, principal: row.principal === 1 };
}

// El primer administrador de una parroquia queda como su principal (el servidor hace lo mismo al subirlo).
function becomes_principal(db: LocalDatabase, role: string, parish_id: number | null): number
{
	if (role !== 'admin_parroquia')
		return 0;

	const has_principal = db.prepare('SELECT 1 FROM usuarios WHERE principal = 1 AND parroquia_id = ?').get(parish_id) !== undefined;
	return has_principal ? 0 : 1;
}

function check_password(password: string, required: boolean): void
{
	if (!password && !required)
		return;

	if (password.length < PASSWORD_MIN_LENGTH)
		throw new ServiceError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 400);
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

export function search_users(db: LocalDatabase, session: Session, filters: SearchFilters): SearchPage<User>
{
	check_can_manage(session);

	const conditions: string[] = [];
	const values: (string | number)[] = [];

	// El admin de una parroquia solo ve las cuentas de su parroquia.
	let parish_filter = filters.parroquia_id;
	if (session.role === 'admin_parroquia')
		parish_filter = session.parish_id ?? -1;

	if (Number.isInteger(parish_filter))
	{
		conditions.push('u.parroquia_id = ?');
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

	const count = db.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${where}`).get(...values) as { total: number };
	const page = page_of(filters, count.total);
	const sort_column = SORT_COLUMNS[filters.orden ?? 'nombres'] ?? SORT_COLUMNS.nombres;

	const rows = db
		.prepare(
			`SELECT u.id, u.username, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, u.principal,
				p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 ${where}
			 ORDER BY u.${sort_column} ${sort_direction(filters)}, u.id
			 LIMIT ? OFFSET ?`,
		)
		.all(...values, PAGE_SIZE, page.offset) as User[];

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

	// El admin de una parroquia crea cuentas de la suya; el admin general elige la parroquia.
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

export async function update_user(db: LocalDatabase, session: Session, user: User): Promise<void>
{
	const id = positive_or_provisional_id(user?.id);
	if (id !== session.user_id)
		check_can_manage(session);

	const names = clean_names(user);
	const password = typeof user.password === 'string' ? user.password : '';
	check_password(password, false);

	const target = read_target(db, id);
	const reason = cannot_modify(actor_of(db, session), target);
	if (reason)
		throw new ServiceError(reason, 403);

	const hash = password ? await create_server_hash(password) : null;

	const update = db.transaction(() =>
	{
		add_to_queue(db, 'usuario', target.client_id, target.version);
		db.prepare('UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?')
			.run(names.nombre, names.apellido_paterno, names.apellido_materno, id);

		if (hash)
			save_password(db, id, hash);
	});

	update();
}

export function toggle_user_active(db: LocalDatabase, session: Session, user_id: number): void
{
	check_can_manage(session);

	if (user_id === session.user_id)
		throw new ServiceError('No puede deshabilitar su propia cuenta.', 400);

	const target = read_target(db, user_id);
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

		// Una cuenta deshabilitada deja de entrar en esta PC de inmediato.
		if (target.activo === 1)
			db.prepare('DELETE FROM credenciales_locales WHERE usuario_id = ?').run(user_id);
	});

	toggle();
}

// La marca de principal se pasa en el servidor, que es quien garantiza que haya uno solo. Antes se sube
// lo pendiente: una cuenta recién creada aquí todavía tiene su id provisional, que cambia al subirla.
// Por eso la cuenta se indica con su nombre de usuario (único y fijo). Después se sincroniza otra vez
// para que esta PC vea la marca en su nuevo dueño.
export async function make_principal(db: LocalDatabase, session: Session, username: unknown): Promise<void>
{
	check_can_manage(session);

	if (typeof username !== 'string' || !db.prepare('SELECT 1 FROM usuarios WHERE username = ?').get(username))
		throw new ServiceError(NOT_FOUND, 404);

	await sync_now();

	const server_id = db.prepare('SELECT id FROM usuarios WHERE username = ?').pluck().get(username) as number;
	const token = current_session()?.token;
	if (!token || server_id < 0)
		throw new ServiceError('Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.', 503);

	await remote_request(`/api/users/${server_id}/make-principal`, { method: 'PATCH', token: token });
	await sync_now();
}

// Las cuentas creadas aquí tienen un id negativo mientras no se suben.
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
		// Se sube enseguida (si hay internet): así la cuenta nueva ya puede entrar en otra PC
		// y sincronizar con su propia contraseña.
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

	'users.makePrincipal': async (payload: { username: unknown }, { db, session }) =>
	{
		await make_principal(db, session, payload?.username);
		return { success: true };
	},

	'users.me': (_payload, { db, session }) =>
	{
		return { principal: can_manage_users(session.role) && is_principal(db, session) };
	},
};

