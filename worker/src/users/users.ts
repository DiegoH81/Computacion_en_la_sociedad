// Gestión de cuentas de usuario. Solo un admin puede usar estas funciones.
//
// Cada función devuelve { success: true, ... } o un Failure con el código HTTP y el mensaje,
// y user_routes.ts lo convierte en la respuesta.

import { hash_password } from '../auth/password';
import type { TokenUser } from '../auth/jwt';
import type { JsonObject } from '../http';

export interface Failure
{
	success: false;
	status: number;
	message: string;
}

export interface UserListRow
{
	id: number;
	username: string;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	parroquia_nombre: string | null; // null en las cuentas admin
	activo: number;
}

export type SortField = 'nombre' | 'apellido_paterno' | 'apellido_materno';

export interface UserSearch
{
	first_name?: string;
	father_last_name?: string;
	mother_last_name?: string;
	sort_by: SortField;
	sort_direction: 'asc' | 'desc';
	page: number;
	page_size: number;
}

// Lo que manda la app al crear o editar. Los nombres de los campos vienen del JSON de la app.
export interface NewUserBody
{
	nombre: string;
	apellidoPaterno: string;
	apellidoMaterno?: string;
	username: string;
	password: string;
	parroquia: { kind: 'existing'; parroquiaId: number } | { kind: 'new'; nombre: string };
}

export interface EditUserBody
{
	nombre: string;
	apellidoPaterno: string;
	apellidoMaterno?: string;
	password?: string; // vacío o ausente: se queda la contraseña actual
}

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const SORT_FIELDS: SortField[] = ['nombre', 'apellido_paterno', 'apellido_materno'];

function fail(status: number, message: string): Failure
{
	return { success: false, status: status, message: message };
}

// El cuerpo llega de la red sin revisar: cualquier campo podría no ser texto.
function clean_text(value: unknown): string
{
	if (typeof value !== 'string')
		return '';

	return value.trim();
}

function only_admin(user: TokenUser): Failure | null
{
	if (user.rol !== 'admin')
		return fail(403, 'Solo un administrador puede gestionar usuarios.');

	return null;
}

function is_duplicate_error(error: unknown, column: string): boolean
{
	if (!(error instanceof Error))
		return false;

	return error.message.includes('UNIQUE constraint failed') && error.message.includes(column);
}

async function user_exists(db: D1Database, user_id: number): Promise<boolean>
{
	const row = await db.prepare('SELECT id FROM usuarios WHERE id = ?').bind(user_id).first();
	return row !== null;
}

export async function search_users(
	db: D1Database,
	user: TokenUser,
	search: UserSearch,
): Promise<{ success: true; users: UserListRow[]; totalPages: number } | Failure>
{
	const denied = only_admin(user);
	if (denied)
		return denied;

	// El nombre de una columna no se puede pasar con "?", así que solo
	// aceptamos los de la lista. Nunca se pega en el SQL un texto que mandó el cliente.
	let sort_field: SortField = 'nombre';
	if (SORT_FIELDS.includes(search.sort_by))
		sort_field = search.sort_by;

	let sort_direction = 'ASC';
	if (search.sort_direction === 'desc')
		sort_direction = 'DESC';

	const conditions: string[] = [];
	const values: string[] = [];

	if (search.first_name)
	{
		conditions.push('u.nombre LIKE ?');
		values.push(`%${search.first_name}%`);
	}
	if (search.father_last_name)
	{
		conditions.push('u.apellido_paterno LIKE ?');
		values.push(`%${search.father_last_name}%`);
	}
	if (search.mother_last_name)
	{
		conditions.push('u.apellido_materno LIKE ?');
		values.push(`%${search.mother_last_name}%`);
	}

	let where = '';
	if (conditions.length > 0)
		where = 'WHERE ' + conditions.join(' AND ');

	const count = await db.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${where}`).bind(...values).first<{ total: number }>();
	const total = count ? count.total : 0;
	const total_pages = Math.max(1, Math.ceil(total / search.page_size));
	const offset = (search.page - 1) * search.page_size;

	// password_hash nunca se lee aquí. LEFT JOIN porque los admin no tienen parroquia.
	const page = await db
		.prepare(
			`SELECT u.id, u.username, u.nombre, u.apellido_paterno, u.apellido_materno, p.nombre AS parroquia_nombre, u.activo
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 ${where}
			 ORDER BY u.${sort_field} ${sort_direction}
			 LIMIT ? OFFSET ?`,
		)
		.bind(...values, search.page_size, offset)
		.all<UserListRow>();

	return { success: true, users: page.results, totalPages: total_pages };
}

export async function create_user(db: D1Database, user: TokenUser, body: NewUserBody): Promise<{ success: true; id: number } | Failure>
{
	const denied = only_admin(user);
	if (denied)
		return denied;

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellidoPaterno);
	const mother_last_name = clean_text(body.apellidoMaterno);
	const username = clean_text(body.username);
	const password = typeof body.password === 'string' ? body.password : '';

	if (!first_name || !father_last_name)
		return fail(400, 'Nombre y apellido paterno son requeridos.');

	if (!USERNAME_PATTERN.test(username))
		return fail(400, 'El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.');

	if (password.length < PASSWORD_MIN_LENGTH)
		return fail(400, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);

	// La parroquia puede ser una que ya existe o una nueva que se crea junto con el usuario.
	const parish = body.parroquia as JsonObject | undefined;
	let existing_parish_id: number | null = null;
	let new_parish_name = '';

	if (parish?.kind === 'new')
	{
		new_parish_name = clean_text(parish.nombre);
		if (!new_parish_name)
			return fail(400, 'El nombre de la parroquia nueva es requerido.');
	}
	else if (parish?.kind === 'existing' && typeof parish.parroquiaId === 'number')
		existing_parish_id = parish.parroquiaId;
	else
		return fail(400, 'Debe seleccionar una parroquia.');

	// Estas consultas solo sirven para dar un mensaje claro.
	// Los índices UNIQUE de la base igual impiden duplicados (ver el catch de abajo).
	const username_taken = await db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE').bind(username).first();
	if (username_taken)
		return fail(409, 'Ese nombre de usuario ya existe.');

	if (existing_parish_id !== null)
	{
		const found = await db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').bind(existing_parish_id).first();
		if (!found)
			return fail(400, 'La parroquia seleccionada no existe.');
	}
	else
	{
		const parish_taken = await db.prepare('SELECT 1 FROM parroquias WHERE nombre = ? COLLATE NOCASE').bind(new_parish_name).first();
		if (parish_taken)
			return fail(409, 'Ya existe una parroquia con ese nombre.');
	}

	const password_hash = await hash_password(password);

	// El rol siempre es usuario_parroquia: por aquí no se pueden crear admins,
	// mande lo que mande el cliente.
	try
	{
		if (existing_parish_id !== null)
		{
			const insert = await db
				.prepare(
					`INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
					 VALUES (?, ?, ?, ?, ?, 'usuario_parroquia', ?, 1)`,
				)
				.bind(username, password_hash, first_name, father_last_name, mother_last_name, existing_parish_id)
				.run();

			return { success: true, id: insert.meta.last_row_id as number };
		}

		// db.batch() es una transacción: si falla el usuario, tampoco se crea la parroquia.
		// last_insert_rowid() es el id de la parroquia que se acaba de insertar.
		const results = await db.batch([
			db.prepare('INSERT INTO parroquias (nombre, activa) VALUES (?, 1)').bind(new_parish_name),
			db
				.prepare(
					`INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
					 VALUES (?, ?, ?, ?, ?, 'usuario_parroquia', last_insert_rowid(), 1)`,
				)
				.bind(username, password_hash, first_name, father_last_name, mother_last_name),
		]);

		return { success: true, id: results[1].meta.last_row_id as number };
	}
	catch (error)
	{
		// Pasa si otra petición creó el mismo nombre entre la consulta de arriba y el INSERT.
		if (is_duplicate_error(error, 'usuarios.username'))
			return fail(409, 'Ese nombre de usuario ya existe.');

		if (is_duplicate_error(error, 'parroquias.nombre'))
			return fail(409, 'Ya existe una parroquia con ese nombre.');

		throw error;
	}
}

// Solo se cambian el nombre, los apellidos y, si se manda, la contraseña.
// El username, el rol y la parroquia no se pueden cambiar.
export async function update_user(db: D1Database, user: TokenUser, user_id: number, body: EditUserBody): Promise<{ success: true } | Failure>
{
	const denied = only_admin(user);
	if (denied)
		return denied;

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellidoPaterno);
	const mother_last_name = clean_text(body.apellidoMaterno);
	const password = typeof body.password === 'string' ? body.password : '';

	if (!first_name || !father_last_name)
		return fail(400, 'Nombre y apellido paterno son requeridos.');

	if (password && password.length < PASSWORD_MIN_LENGTH)
		return fail(400, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);

	if (!(await user_exists(db, user_id)))
		return fail(404, 'Usuario no encontrado.');

	if (password)
	{
		const password_hash = await hash_password(password);
		await db
			.prepare('UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, password_hash = ? WHERE id = ?')
			.bind(first_name, father_last_name, mother_last_name, password_hash, user_id)
			.run();
	}
	else
	{
		await db
			.prepare('UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?')
			.bind(first_name, father_last_name, mother_last_name, user_id)
			.run();
	}

	return { success: true };
}

export async function toggle_user_active(db: D1Database, user: TokenUser, user_id: number): Promise<{ success: true } | Failure>
{
	const denied = only_admin(user);
	if (denied)
		return denied;

	// Un admin no puede deshabilitarse a sí mismo, así siempre queda alguien que administre.
	if (user_id === user.usuarioId)
		return fail(400, 'No puede deshabilitar su propia cuenta.');

	if (!(await user_exists(db, user_id)))
		return fail(404, 'Usuario no encontrado.');

	await db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').bind(user_id).run();
	return { success: true };
}
