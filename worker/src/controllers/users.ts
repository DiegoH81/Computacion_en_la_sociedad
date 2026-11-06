//   Only admins can use this
//
//   GET    /api/users                      buscar   ?nombres=&apellido_paterno=&apellido_materno=&parroquia_id=&orden=&direccion=&pagina=&por_pagina=
//                                                   ->  { resultados, total_paginas }
//   POST   /api/users                      crear    ->  201 { id }
//   PUT    /api/users/:id                  editar nombre, apellidos y (si se manda) la contraseña
//   PATCH  /api/users/:id/toggle-active    habilitar o deshabilitar
//   PATCH  /api/users/:id/make-principal   pasarle a otro administrador la marca de principal
//   GET    /api/users/me                   ->  { principal }   si quien pregunta es el administrador principal


import { Hono } from 'hono';
import type { NameColumn, SearchFilters, SearchPage, User } from '../../../shared/models';
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

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

function check_admin(user: TokenUser): void
{
	if (user.rol !== 'admin')
		throw new ServiceError('Solo un administrador puede gestionar usuarios.', 403);
}

export async function is_principal(db: D1Database, user: TokenUser): Promise<boolean>
{
	const row = await db.prepare('SELECT principal FROM usuarios WHERE id = ?').bind(user.usuarioId).first<{ principal: number }>();
	return row?.principal === 1;
}

async function check_principal(db: D1Database, user: TokenUser, message: string): Promise<void>
{
	if (!(await is_principal(db, user)))
		throw new ServiceError(message, 403);
}

function is_duplicate_error(error: unknown, column: string): boolean
{
	if (!(error instanceof Error))
		return false;

	return error.message.includes('UNIQUE constraint failed') && error.message.includes(column);
}

async function check_can_modify(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	const target = await db.prepare('SELECT rol FROM usuarios WHERE id = ?').bind(user_id).first<{ rol: string }>();
	if (!target)
		throw new ServiceError('Usuario no encontrado.', 404);

	if (target.rol === 'admin' && user_id !== user.usuarioId)
		await check_principal(db, user, 'Solo el administrador principal puede modificar a otros administradores.');
}

export async function search_users(db: D1Database, user: TokenUser, filters: SearchFilters, page_size: number): Promise<SearchPage<User>>
{
	check_admin(user);

	let sort_column = SORT_COLUMNS.nombres;
	if (filters.orden && Object.hasOwn(SORT_COLUMNS, filters.orden))
		sort_column = SORT_COLUMNS[filters.orden];

	let sort_direction = 'ASC';
	if (filters.direccion === 'desc')
		sort_direction = 'DESC';

	const conditions: string[] = [];
	const values: (string | number)[] = [];

	if (Number.isInteger(filters.parroquia_id))
	{
		conditions.push('u.parroquia_id = ?');
		values.push(filters.parroquia_id as number);
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
	check_admin(user);
	const is_admin_account = body.rol === 'admin';

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellido_paterno);
	const mother_last_name = clean_text(body.apellido_materno);
	const username = clean_text(body.username);
	const password = typeof body.password === 'string' ? body.password : '';

	if (!first_name || !father_last_name)
		throw new ServiceError('Nombre y apellido paterno son requeridos.', 400);

	if (!USERNAME_PATTERN.test(username))
		throw new ServiceError('El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.', 400);

	if (password.length < PASSWORD_MIN_LENGTH)
		throw new ServiceError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 400);

	let existing_parish_id: number | null = null;
	let new_parish_name = '';

	if (is_admin_account)
		await check_principal(db, user, 'Solo el administrador principal puede crear administradores.');
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


	const username_taken = await db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE').bind(username).first();
	if (username_taken)
		throw new ServiceError('Ese nombre de usuario ya existe.', 409);

	if (existing_parish_id !== null)
	{
		const found = await db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').bind(existing_parish_id).first();
		if (!found)
			throw new ServiceError('La parroquia seleccionada no existe.', 400);
	}
	else if (!is_admin_account)
	{
		const parish_taken = await db.prepare('SELECT 1 FROM parroquias WHERE nombre = ? COLLATE NOCASE').bind(new_parish_name).first();
		if (parish_taken)
			throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);
	}

	const password_hash = await hash_password(password);

	const role = is_admin_account ? 'admin' : 'usuario_parroquia';

	try
	{
		if (is_admin_account || existing_parish_id !== null)
		{
			const insert = await db
				.prepare(
					`INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
				)
				.bind(username, password_hash, first_name, father_last_name, mother_last_name, role, existing_parish_id)
				.run();

			return insert.meta.last_row_id as number;
		}

		const results = await db.batch([
			db.prepare('INSERT INTO parroquias (nombre, activa) VALUES (?, 1)').bind(new_parish_name),
			db
				.prepare(
					`INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
					 VALUES (?, ?, ?, ?, ?, 'usuario_parroquia', last_insert_rowid(), 1)`,
				)
				.bind(username, password_hash, first_name, father_last_name, mother_last_name),
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
	check_admin(user);

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

export async function toggle_user_active(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	check_admin(user);

	if (user_id === user.usuarioId)
		throw new ServiceError('No puede deshabilitar su propia cuenta.', 400);

	await check_can_modify(db, user, user_id);
	await db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').bind(user_id).run();
}

// Change normal ADMIN to principal one (this admin can create other admins)
export async function make_principal(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	check_admin(user);
	await check_principal(db, user, 'Solo el administrador principal puede pasar su marca.');

	if (user_id === user.usuarioId)
		throw new ServiceError('Esta cuenta ya es la principal.', 400);

	const target = await db.prepare('SELECT rol, activo FROM usuarios WHERE id = ?').bind(user_id).first<{ rol: string; activo: number }>();
	if (!target)
		throw new ServiceError('Usuario no encontrado.', 404);

	if (target.rol !== 'admin' || target.activo !== 1)
		throw new ServiceError('La marca de principal solo se puede pasar a un administrador activo.', 400);

	await db.batch([
		db.prepare('UPDATE usuarios SET principal = 0 WHERE id = ?').bind(user.usuarioId),
		db.prepare('UPDATE usuarios SET principal = 1 WHERE id = ?').bind(user_id),
	]);
}


export const users_router = new Hono<AppEnv>();

users_router.get('/me', async (c) =>
{
	check_admin(c.get('user'));
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
