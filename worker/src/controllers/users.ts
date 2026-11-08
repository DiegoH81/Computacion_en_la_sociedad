//   Lo usan el admin_general y el admin_parroquia (ver models/user.ts para quién puede qué).
//   La app normalmente gestiona los usuarios en la PC y los sube al sincronizar (sync/push.ts);
//   estas rutas son la forma directa, con internet.
//
//   GET    /api/users                      buscar   ?nombres=&apellido_paterno=&apellido_materno=&parroquia_id=&orden=&direccion=&pagina=&por_pagina=
//                                                   ->  { resultados, total_paginas }
//   POST   /api/users                      crear    ->  201 { id }
//   PUT    /api/users/:id                  editar nombre, apellidos y (si se manda) la contraseña
//   PATCH  /api/users/:id/toggle-active    habilitar o deshabilitar
//   PATCH  /api/users/:id/make-principal   pasarle la marca de principal a otro administrador (general o de una parroquia)
//   GET    /api/users/me                   ->  { principal }   si quien pregunta es el principal (general o de su parroquia)


import { Hono } from 'hono';
import type { NameColumn, SearchFilters, SearchPage, User } from '../../../shared/models';
import {
	can_manage_users,
	cannot_create,
	cannot_disable,
	cannot_make_principal,
	cannot_modify,
	is_role,
	NEW_PRINCIPAL_SQL,
	role_parish_error,
	USERNAME_PATTERN,
	type Actor,
	type TargetUser,
} from '../models/user';
import { PASSWORD_MIN_LENGTH, USERS_MAX_PAGE, USERS_MAX_PAGE_SIZE, USERS_PAGE_SIZE } from '../utils/config';
import { hash_password, type TokenUser } from '../utils/crypto';
import { clean_text, read_int, require_json_body } from '../utils/helpers';
import { ServiceError, type AppEnv } from '../utils/middleware';

const SORT_COLUMNS: Record<NameColumn, string> =
{
	nombres: 'nombre',
	apellido_paterno: 'apellido_paterno',
	apellido_materno: 'apellido_materno',
};

function check_can_manage(user: TokenUser): void
{
	if (!can_manage_users(user.rol))
		throw new ServiceError('Solo un administrador puede gestionar usuarios.', 403);
}

export async function is_principal(db: D1Database, user: TokenUser): Promise<boolean>
{
	const row = await db.prepare('SELECT principal FROM usuarios WHERE id = ?').bind(user.usuarioId).first<{ principal: number }>();
	return row?.principal === 1;
}

export async function read_actor(db: D1Database, user: TokenUser): Promise<Actor>
{
	return { id: user.usuarioId, rol: user.rol, parroquia_id: user.parroquiaId, principal: await is_principal(db, user) };
}

function is_duplicate_error(error: unknown, column: string): boolean
{
	if (!(error instanceof Error))
		return false;

	return error.message.includes('UNIQUE constraint failed') && error.message.includes(column);
}

async function read_target(db: D1Database, user_id: number): Promise<TargetUser>
{
	const row = await db.prepare('SELECT id, rol, parroquia_id, principal FROM usuarios WHERE id = ?').bind(user_id).first<Omit<TargetUser, 'principal'> & { principal: number }>();
	const target = row ? { ...row, principal: row.principal === 1 } : null;
	if (!target)
		throw new ServiceError('Usuario no encontrado.', 404);

	return target;
}

async function check_can_modify(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	const target = await read_target(db, user_id);
	const reason = cannot_modify(await read_actor(db, user), target);
	if (reason)
		throw new ServiceError(reason, 403);
}

export async function search_users(db: D1Database, user: TokenUser, filters: SearchFilters, page_size: number): Promise<SearchPage<User>>
{
	check_can_manage(user);

	let sort_column = SORT_COLUMNS.nombres;
	if (filters.orden && Object.hasOwn(SORT_COLUMNS, filters.orden))
		sort_column = SORT_COLUMNS[filters.orden];

	let sort_direction = 'ASC';
	if (filters.direccion === 'desc')
		sort_direction = 'DESC';

	const conditions: string[] = [];
	const values: (string | number)[] = [];

	// El admin de una parroquia solo ve las cuentas de su parroquia.
	let parish_filter = filters.parroquia_id;
	if (user.rol === 'admin_parroquia')
		parish_filter = user.parroquiaId ?? -1;

	if (Number.isInteger(parish_filter))
	{
		conditions.push('u.parroquia_id = ?');
		values.push(parish_filter as number);
	}

	if (filters.nombres)
	{
		conditions.push('u.nombre LIKE ?');
		values.push(`%${filters.nombres}%`);
	}
	if (filters.apellido_paterno)
	{
		conditions.push('u.apellido_paterno LIKE ?');
		values.push(`%${filters.apellido_paterno}%`);
	}
	if (filters.apellido_materno)
	{
		conditions.push('u.apellido_materno LIKE ?');
		values.push(`%${filters.apellido_materno}%`);
	}

	let where = '';
	if (conditions.length > 0)
		where = 'WHERE ' + conditions.join(' AND ');

	const page = filters.pagina ?? 1;
	const count = await db.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${where}`).bind(...values).first<{ total: number }>();
	const total = count ? count.total : 0;
	const total_pages = Math.max(1, Math.ceil(total / page_size));
	const offset = (page - 1) * page_size;

	const rows = await db
		.prepare(
			`SELECT u.id, u.username, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, u.principal,
				p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 ${where}
			 ORDER BY u.${sort_column} ${sort_direction}
			 LIMIT ? OFFSET ?`,
		)
		.bind(...values, page_size, offset)
		.all<User>();

	return { resultados: rows.results, total_paginas: total_pages };
}


export async function create_user(db: D1Database, user: TokenUser, body: User): Promise<number>
{
	check_can_manage(user);

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellido_paterno);
	const mother_last_name = clean_text(body.apellido_materno);
	const username = clean_text(body.username);
	const password = typeof body.password === 'string' ? body.password : '';
	const role = body.rol ?? 'usuario';

	if (!first_name || !father_last_name)
		throw new ServiceError('Nombre y apellido paterno son requeridos.', 400);

	if (!USERNAME_PATTERN.test(username))
		throw new ServiceError('El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.', 400);

	if (password.length < PASSWORD_MIN_LENGTH)
		throw new ServiceError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 400);

	if (!is_role(role))
		throw new ServiceError('El rol no es válido.', 400);

	const actor = await read_actor(db, user);

	// La parroquia es una existente o (solo el admin_general) una nueva que se crea con la cuenta.
	let existing_parish_id: number | null = null;
	let new_parish_name = '';

	if (role === 'admin_general')
		existing_parish_id = null;
	else if (user.rol === 'admin_parroquia')
		existing_parish_id = user.parroquiaId;
	else if (body.parroquia_nueva !== undefined)
	{
		new_parish_name = clean_text(body.parroquia_nueva);
		if (!new_parish_name)
			throw new ServiceError('El nombre de la parroquia nueva es requerido.', 400);
	}
	else if (typeof body.parroquia_id === 'number')
		existing_parish_id = body.parroquia_id;
	else
		throw new ServiceError('Debe seleccionar una parroquia.', 400);

	// Con una parroquia nueva todavía no hay id: para revisar el permiso basta saber que tendrá una.
	const has_parish = existing_parish_id !== null || new_parish_name !== '';
	const target: TargetUser = { rol: role, parroquia_id: has_parish ? (existing_parish_id ?? 0) : null };

	const parish_error = role_parish_error(target);
	if (parish_error)
		throw new ServiceError(parish_error, 400);

	const reason = cannot_create(actor, target);
	if (reason)
		throw new ServiceError(reason, 403);

	const username_taken = await db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE').bind(username).first();
	if (username_taken)
		throw new ServiceError('Ese nombre de usuario ya existe.', 409);

	if (existing_parish_id !== null)
	{
		const found = await db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').bind(existing_parish_id).first();
		if (!found)
			throw new ServiceError('La parroquia seleccionada no existe.', 400);
	}
	else if (new_parish_name)
	{
		const parish_taken = await db.prepare('SELECT 1 FROM parroquias WHERE nombre = ? COLLATE NOCASE').bind(new_parish_name).first();
		if (parish_taken)
			throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);
	}

	const password_hash = await hash_password(password);
	const client_id = crypto.randomUUID();

	try
	{
		if (!new_parish_name)
		{
			const insert = await db
				.prepare(
					`INSERT INTO usuarios (client_id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo, principal)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ${NEW_PRINCIPAL_SQL})`,
				)
				.bind(client_id, username, password_hash, first_name, father_last_name, mother_last_name, role, existing_parish_id, role, existing_parish_id)
				.run();

			return insert.meta.last_row_id as number;
		}

		const results = await db.batch([
			db.prepare('INSERT INTO parroquias (nombre, activa) VALUES (?, 1)').bind(new_parish_name),
			db
				.prepare(
					`INSERT INTO usuarios (client_id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo, principal)
					 VALUES (?, ?, ?, ?, ?, ?, ?, last_insert_rowid(), 1, CASE WHEN ? = 'admin_parroquia' THEN 1 ELSE 0 END)`,
				)
				.bind(client_id, username, password_hash, first_name, father_last_name, mother_last_name, role, role),
		]);

		return results[1].meta.last_row_id as number;
	}
	catch (error)
	{
		if (is_duplicate_error(error, 'usuarios.username'))
			throw new ServiceError('Ese nombre de usuario ya existe.', 409);

		if (is_duplicate_error(error, 'parroquias.nombre'))
			throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);

		throw error;
	}
}


export async function update_user(db: D1Database, user: TokenUser, user_id: number, body: User): Promise<void>
{
	check_can_manage_or_self(user, user_id);

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellido_paterno);
	const mother_last_name = clean_text(body.apellido_materno);
	const password = typeof body.password === 'string' ? body.password : '';

	if (!first_name || !father_last_name)
		throw new ServiceError('Nombre y apellido paterno son requeridos.', 400);

	if (password && password.length < PASSWORD_MIN_LENGTH)
		throw new ServiceError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 400);

	await check_can_modify(db, user, user_id);

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
}

// Cada uno puede editar su propia cuenta; las demás, solo un administrador.
function check_can_manage_or_self(user: TokenUser, user_id: number): void
{
	if (user_id !== user.usuarioId)
		check_can_manage(user);
}

export async function toggle_user_active(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	check_can_manage(user);

	if (user_id === user.usuarioId)
		throw new ServiceError('No puede deshabilitar su propia cuenta.', 400);

	await check_can_modify(db, user, user_id);

	const target = await read_target(db, user_id);
	const is_active = await db.prepare('SELECT activo FROM usuarios WHERE id = ?').bind(user_id).first<number>('activo');
	const disable_reason = is_active === 1 ? cannot_disable(target) : null;
	if (disable_reason)
		throw new ServiceError(disable_reason, 400);

	await db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').bind(user_id).run();
}

// Pasa la marca de principal a otro administrador: entre los generales, o dentro de una parroquia
// (quién puede, en shared/users.ts). El que la tenía queda como administrador común.
export async function make_principal(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	check_can_manage(user);

	const target = await read_target(db, user_id);
	const is_active = await db.prepare('SELECT activo FROM usuarios WHERE id = ?').bind(user_id).first<number>('activo');

	if (target.principal)
		throw new ServiceError('Esta cuenta ya es la principal.', 400);

	if (target.rol === 'usuario')
		throw new ServiceError('La marca de principal solo se pasa a un administrador.', 400);

	const reason = cannot_make_principal(await read_actor(db, user), target);
	if (reason)
		throw new ServiceError(reason, 403);

	if (is_active !== 1)
		throw new ServiceError('La marca de principal solo se puede pasar a un administrador activo.', 400);

	// Primero se le quita al anterior, por el índice que permite un solo principal en cada parroquia.
	await db.batch([
		db.prepare('UPDATE usuarios SET principal = 0 WHERE principal = 1 AND IFNULL(parroquia_id, 0) = IFNULL(?, 0)').bind(target.parroquia_id),
		db.prepare('UPDATE usuarios SET principal = 1 WHERE id = ?').bind(user_id),
	]);
}


export const users_router = new Hono<AppEnv>();

// El principal (general o de una parroquia) es el único que gestiona a los demás administradores.
users_router.get('/me', async (c) =>
{
	check_can_manage(c.get('user'));
	return c.json({ principal: await is_principal(c.env.prelatura_db, c.get('user')) });
});

users_router.get('/', async (c) =>
{
	const filters: SearchFilters =
	{
		nombres: c.req.query('nombres'),
		apellido_paterno: c.req.query('apellido_paterno'),
		apellido_materno: c.req.query('apellido_materno'),
		orden: c.req.query('orden') as NameColumn | undefined,
		direccion: c.req.query('direccion') === 'desc' ? 'desc' : 'asc',
		pagina: read_int(c.req.query('pagina'), 1, 1, USERS_MAX_PAGE),
	};

	const parish_id = Number(c.req.query('parroquia_id'));
	if (Number.isInteger(parish_id) && parish_id > 0)
		filters.parroquia_id = parish_id;
	const page_size = read_int(c.req.query('por_pagina'), USERS_PAGE_SIZE, 1, USERS_MAX_PAGE_SIZE);

	return c.json(await search_users(c.env.prelatura_db, c.get('user'), filters, page_size));
});

users_router.post('/', async (c) =>
{
	const body = await require_json_body(c);
	const id = await create_user(c.env.prelatura_db, c.get('user'), body as User);
	return c.json({ id: id }, 201);
});

users_router.put('/:id{[0-9]+}', async (c) =>
{
	const body = await require_json_body(c);
	await update_user(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')), body as User);
	return c.json({ success: true });
});

users_router.patch('/:id{[0-9]+}/toggle-active', async (c) =>
{
	await toggle_user_active(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')));
	return c.json({ success: true });
});

users_router.patch('/:id{[0-9]+}/make-principal', async (c) =>
{
	await make_principal(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')));
	return c.json({ success: true });
});
