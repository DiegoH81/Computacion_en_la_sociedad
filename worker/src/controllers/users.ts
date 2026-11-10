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
//                                          { parroquia_id }  la parroquia (si no se manda, la de origen de la cuenta)
//   PUT    /api/users/:id/parishes/:pid    agregar una parroquia adicional o cambiarle el rol   { rol }   (solo admin_general)
//   DELETE /api/users/:id/parishes/:pid    quitar una parroquia adicional                             (solo admin_general)
//   GET    /api/users/me                   ->  { principal }   si quien pregunta es el principal (general o de su parroquia)
import { Hono } from 'hono';
import type { NameColumn, SearchFilters, SearchPage, User } from '../../../shared/models';
import {
	actor_in_parish,
	can_manage_users,
	cannot_change_parishes,
	cannot_create,
	cannot_disable,
	cannot_make_principal,
	cannot_modify,
	is_role,
	NEW_PRINCIPAL_SQL,
	password_error,
	read_memberships,
	read_target_in_parish,
	role_parish_error,
	USERNAME_PATTERN,
	type Actor,
	type SavedTarget,
	type TargetUser,
} from '../models/user';
import { USERS_MAX_PAGE, USERS_MAX_PAGE_SIZE, USERS_PAGE_SIZE } from '../utils/config';
import { hash_password, type TokenUser } from '../utils/crypto';
import { clean_text, read_int, read_json_body, require_json_body } from '../utils/helpers';
import { ServiceError, type AppEnv } from '../utils/middleware';

const NOT_FOUND = 'Usuario no encontrado.';

const SORT_COLUMNS: Record<NameColumn, string> =
{
	nombres: 'nombre',
	apellido_paterno: 'apellido_paterno',
	apellido_materno: 'apellido_materno',
};

async function check_can_manage(db: D1Database, user: TokenUser): Promise<void>
{
	if (can_manage_users(user.rol))
		return;

	const memberships = await read_memberships(db, user.usuarioId);
	if (!memberships.some((row) => can_manage_users(row.rol)))
		throw new ServiceError('Solo un administrador puede gestionar usuarios.', 403);
}

export async function is_principal(db: D1Database, user: TokenUser): Promise<boolean>
{
	return (await actor_in_parish(db, user, user.parroquiaId)).principal;
}

export async function pair_in_parish(db: D1Database, user: TokenUser, user_id: number): Promise<{ actor: Actor; target: SavedTarget }>
{
	let parish_id: number | null = null;
	if (user.rol !== 'admin_general')
	{
		const own = new Set((await read_memberships(db, user.usuarioId)).map((row) => row.parroquia_id));
		const shared = (await read_memberships(db, user_id)).find((row) => own.has(row.parroquia_id));
		parish_id = shared?.parroquia_id ?? null;
	}

	const target = await read_target_in_parish(db, user_id, parish_id);
	if (!target)
		throw new ServiceError(NOT_FOUND, 404);

	return { actor: await actor_in_parish(db, user, parish_id ?? target.parroquia_id), target: target };
}

function is_duplicate_error(error: unknown, column: string): boolean
{
	if (!(error instanceof Error))
		return false;

	return error.message.includes('UNIQUE constraint failed') && error.message.includes(column);
}

async function check_can_modify(db: D1Database, user: TokenUser, user_id: number): Promise<SavedTarget>
{
	const { actor, target } = await pair_in_parish(db, user, user_id);
	const reason = cannot_modify(actor, target);
	if (reason)
		throw new ServiceError(reason, 403);

	return target;
}

export async function search_users(db: D1Database, user: TokenUser, filters: SearchFilters, page_size: number): Promise<SearchPage<User>>
{
	await check_can_manage(db, user);

	let sort_column = SORT_COLUMNS.nombres;
	if (filters.orden && Object.hasOwn(SORT_COLUMNS, filters.orden))
		sort_column = SORT_COLUMNS[filters.orden];

	let sort_direction = 'ASC';
	if (filters.direccion === 'desc')
		sort_direction = 'DESC';

	const values: (string | number)[] = [];

	// El admin de una parroquia solo ve las cuentas de una parroquia donde es administrador: la pedida,
	// o su parroquia de origen. Con parroquia, el rol y la marca son los que la cuenta tiene en ella.
	let parish_filter = filters.parroquia_id;
	if (user.rol !== 'admin_general')
	{
		const actor = await actor_in_parish(db, user, filters.parroquia_id ?? user.parroquiaId);
		parish_filter = actor.rol === 'admin_parroquia' && actor.parroquia_id !== null ? actor.parroquia_id : -1;
	}

	let from = 'FROM usuarios u LEFT JOIN parroquias p ON p.id = u.parroquia_id';
	let role_columns = 'u.rol, u.parroquia_id, u.principal';
	if (Number.isInteger(parish_filter))
	{
		from = 'FROM usuarios u JOIN membresias m ON m.usuario_id = u.id AND m.parroquia_id = ? LEFT JOIN parroquias p ON p.id = m.parroquia_id';
		role_columns = 'm.rol, m.parroquia_id, m.principal';
		values.push(parish_filter as number);
	}

	const conditions: string[] = [];
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
	const count = await db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).bind(...values).first<{ total: number }>();
	const total = count ? count.total : 0;
	const total_pages = Math.max(1, Math.ceil(total / page_size));
	const offset = (page - 1) * page_size;

	const rows = await db
		.prepare(
			`SELECT u.id, u.username, ${role_columns}, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
				p.nombre AS parroquia_nombre
			 ${from}
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
	await check_can_manage(db, user);

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

	const bad_password = password_error(password);
	if (bad_password)
		throw new ServiceError(bad_password, 400);

	if (!is_role(role))
		throw new ServiceError('El rol no es válido.', 400);

	// El admin de una parroquia crea cuentas en una parroquia suya: la pedida, o su parroquia de origen.
	const asked_parish = typeof body.parroquia_id === 'number' ? body.parroquia_id : user.parroquiaId;
	const actor = await actor_in_parish(db, user, asked_parish);

	// La parroquia es una existente o (solo el admin_general) una nueva que se crea con la cuenta.
	let existing_parish_id: number | null = null;
	let new_parish_name = '';

	if (role === 'admin_general')
		existing_parish_id = null;
	else if (user.rol !== 'admin_general')
		existing_parish_id = actor.parroquia_id;
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
	await check_can_manage_or_self(db, user, user_id);

	const first_name = clean_text(body.nombre);
	const father_last_name = clean_text(body.apellido_paterno);
	const mother_last_name = clean_text(body.apellido_materno);
	const password = typeof body.password === 'string' ? body.password : '';

	if (!first_name || !father_last_name)
		throw new ServiceError('Nombre y apellido paterno son requeridos.', 400);

	const bad_password = password ? password_error(password) : null;
	if (bad_password)
		throw new ServiceError(bad_password, 400);

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
async function check_can_manage_or_self(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	if (user_id !== user.usuarioId)
		await check_can_manage(db, user);
}

export async function toggle_user_active(db: D1Database, user: TokenUser, user_id: number): Promise<void>
{
	await check_can_manage(db, user);

	if (user_id === user.usuarioId)
		throw new ServiceError('No puede deshabilitar su propia cuenta.', 400);

	const target = await check_can_modify(db, user, user_id);
	const disable_reason = target.activo === 1 ? cannot_disable(target) : null;
	if (disable_reason)
		throw new ServiceError(disable_reason, 400);

	await db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').bind(user_id).run();
}

export async function make_principal(db: D1Database, user: TokenUser, user_id: number, parish_id: number | null = null): Promise<void>
{
	await check_can_manage(db, user);

	const origin = await read_target_in_parish(db, user_id, null);
	if (!origin)
		throw new ServiceError(NOT_FOUND, 404);

	let target = origin;
	if (origin.rol !== 'admin_general' && parish_id !== null)
	{
		const in_parish = await read_target_in_parish(db, user_id, parish_id);
		if (!in_parish || in_parish.parroquia_id !== parish_id)
			throw new ServiceError('La cuenta no trabaja en esa parroquia.', 400);

		target = in_parish;
	}

	if (target.principal)
		throw new ServiceError('Esta cuenta ya es la principal.', 400);

	if (target.rol === 'usuario')
		throw new ServiceError('La marca de principal solo se pasa a un administrador.', 400);

	const reason = cannot_make_principal(await actor_in_parish(db, user, target.parroquia_id), target);
	if (reason)
		throw new ServiceError(reason, 403);

	if (target.activo !== 1)
		throw new ServiceError('La marca de principal solo se puede pasar a un administrador activo.', 400);

	if (target.rol === 'admin_general')
	{
		await db.batch([
			db.prepare('UPDATE usuarios SET principal = 0 WHERE principal = 1 AND parroquia_id IS NULL'),
			db.prepare('UPDATE usuarios SET principal = 1 WHERE id = ?').bind(user_id),
		]);
		return;
	}

	// Primero se le quita al anterior, por los índices que permiten un solo principal en cada parroquia.
	const is_origin = target.parroquias.some((row) => row.parroquia_id === target.parroquia_id && row.origen === 1);
	const give_mark = is_origin
		? db.prepare('UPDATE usuarios SET principal = 1 WHERE id = ?').bind(user_id)
		: db.prepare('UPDATE usuario_parroquias SET principal = 1 WHERE usuario_id = ? AND parroquia_id = ?').bind(user_id, target.parroquia_id);

	await db.batch([
		db.prepare('UPDATE usuarios SET principal = 0 WHERE principal = 1 AND parroquia_id = ?').bind(target.parroquia_id),
		db.prepare('UPDATE usuario_parroquias SET principal = 0 WHERE principal = 1 AND parroquia_id = ?').bind(target.parroquia_id),
		give_mark,
	]);
}

// Agrega una parroquia adicional a la cuenta, o le cambia el rol en ella. Si entra como administrador
// a una parroquia sin principal, queda como su principal (igual que el primer administrador).
export async function set_parish(db: D1Database, user: TokenUser, user_id: number, parish_id: number, role: unknown): Promise<void>
{
	if (role !== 'admin_parroquia' && role !== 'usuario')
		throw new ServiceError('El rol en la parroquia debe ser administrador o usuario.', 400);

	const target = await read_target_in_parish(db, user_id, null);
	if (!target)
		throw new ServiceError(NOT_FOUND, 404);

	const reason = cannot_change_parishes(await actor_in_parish(db, user, null), target);
	if (reason)
		throw new ServiceError(reason, 403);

	if (target.parroquia_id === parish_id)
		throw new ServiceError('Esa es la parroquia de origen de la cuenta: no se cambia.', 400);

	const parish = await db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').bind(parish_id).first();
	if (!parish)
		throw new ServiceError('La parroquia seleccionada no existe.', 400);

	const current = target.parroquias.find((row) => row.parroquia_id === parish_id);
	if (current?.principal === 1 && role !== 'admin_parroquia')
		throw new ServiceError('Es el administrador principal de esa parroquia: primero pase la marca a otro administrador.', 400);

	await db
		.prepare(
			`INSERT INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)
			 VALUES (?, ?, ?, ${NEW_PRINCIPAL_SQL})
			 ON CONFLICT (usuario_id, parroquia_id) DO UPDATE SET rol = excluded.rol`,
		)
		.bind(user_id, parish_id, role, role, parish_id)
		.run();
}

export async function remove_parish(db: D1Database, user: TokenUser, user_id: number, parish_id: number): Promise<void>
{
	const target = await read_target_in_parish(db, user_id, null);
	if (!target)
		throw new ServiceError(NOT_FOUND, 404);

	const reason = cannot_change_parishes(await actor_in_parish(db, user, null), target);
	if (reason)
		throw new ServiceError(reason, 403);

	const current = target.parroquias.find((row) => row.parroquia_id === parish_id && row.origen === 0);
	if (!current)
		throw new ServiceError('La cuenta no tiene esa parroquia adicional.', 404);

	if (current.principal === 1)
		throw new ServiceError('Es el administrador principal de esa parroquia: primero pase la marca a otro administrador.', 400);

	await db.prepare('DELETE FROM usuario_parroquias WHERE usuario_id = ? AND parroquia_id = ?').bind(user_id, parish_id).run();
}


export const users_router = new Hono<AppEnv>();

users_router.get('/me', async (c) =>
{
	await check_can_manage(c.env.prelatura_db, c.get('user'));
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
	const body = await read_json_body(c);
	const parish_id = Number.isInteger(body?.parroquia_id) ? (body?.parroquia_id as number) : null;
	await make_principal(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')), parish_id);
	return c.json({ success: true });
});

users_router.put('/:id{[0-9]+}/parishes/:parish_id{[0-9]+}', async (c) =>
{
	const body = await require_json_body(c);
	await set_parish(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')), Number(c.req.param('parish_id')), body.rol);
	return c.json({ success: true });
});

users_router.delete('/:id{[0-9]+}/parishes/:parish_id{[0-9]+}', async (c) =>
{
	await remove_parish(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')), Number(c.req.param('parish_id')));
	return c.json({ success: true });
});
