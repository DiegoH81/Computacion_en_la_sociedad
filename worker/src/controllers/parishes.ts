//   GET    /api/parishes                      Active parishes
//   GET    /api/parishes/todas                All parishes, only      ADMIN_GENERAL
//   POST   /api/parishes                      Create parish { nombre, ubicacion }      ADMIN_GENERAL
//   PUT    /api/parishes/:id                  Edit parish nombre y ubicación      ADMIN_GENERAL
//   PATCH  /api/parishes/:id/toggle-active    Enable or disable      ADMIN_GENERAL

import { Hono } from 'hono';
import type { Parish } from '../../../shared/models';
import type { TokenUser } from '../utils/crypto';
import { clean_text, require_json_body } from '../utils/helpers';
import { authenticate, ServiceError, type AppEnv } from '../utils/middleware';

function check_admin(user: TokenUser): void
{
	if (user.rol !== 'admin_general')
		throw new ServiceError('Solo el administrador general puede gestionar parroquias.', 403);
}

function is_duplicate_error(error: unknown): boolean
{
	return error instanceof Error && error.message.includes('UNIQUE constraint failed') && error.message.includes('parroquias.nombre');
}


async function clean_parish(db: D1Database, body: Parish, parish_id: number | null): Promise<{ nombre: string; ubicacion: string | null }>
{
	const name = clean_text(body.nombre);
	if (!name)
		throw new ServiceError('El nombre de la parroquia es requerido.', 400);

	const taken = await db.prepare('SELECT 1 FROM parroquias WHERE nombre = ? COLLATE NOCASE AND id <> ?').bind(name, parish_id ?? 0).first();
	if (taken)
		throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);

	return { nombre: name, ubicacion: clean_text(body.ubicacion) || null };
}

async function check_parish_exists(db: D1Database, parish_id: number): Promise<void>
{
	const row = await db.prepare('SELECT id FROM parroquias WHERE id = ?').bind(parish_id).first();
	if (!row)
		throw new ServiceError('Parroquia no encontrada.', 404);
}

export async function create_parish(db: D1Database, user: TokenUser, body: Parish): Promise<number>
{
	check_admin(user);
	const values = await clean_parish(db, body, null);

	try
	{
		const insert = await db.prepare('INSERT INTO parroquias (nombre, ubicacion, activa) VALUES (?, ?, 1)').bind(values.nombre, values.ubicacion).run();
		return insert.meta.last_row_id as number;
	}
	catch (error)
	{
		if (is_duplicate_error(error))
			throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);

		throw error;
	}
}

export async function update_parish(db: D1Database, user: TokenUser, parish_id: number, body: Parish): Promise<void>
{
	check_admin(user);
	await check_parish_exists(db, parish_id);
	const values = await clean_parish(db, body, parish_id);

	try
	{
		await db.prepare('UPDATE parroquias SET nombre = ?, ubicacion = ? WHERE id = ?').bind(values.nombre, values.ubicacion, parish_id).run();
	}
	catch (error)
	{
		if (is_duplicate_error(error))
			throw new ServiceError('Ya existe una parroquia con ese nombre.', 409);

		throw error;
	}
}

export async function toggle_parish_active(db: D1Database, user: TokenUser, parish_id: number): Promise<void>
{
	check_admin(user);
	await check_parish_exists(db, parish_id);
	await db.prepare('UPDATE parroquias SET activa = NOT activa WHERE id = ?').bind(parish_id).run();
}



export const parishes_router = new Hono<AppEnv>();

parishes_router.get('/', authenticate, async (c) =>
{
	const parishes = await c.env.prelatura_db
		.prepare('SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC')
		.all<{ id: number; nombre: string }>();

	return c.json({ parishes: parishes.results });
});

parishes_router.get('/todas', authenticate, async (c) =>
{
	check_admin(c.get('user'));
	const parishes = await c.env.prelatura_db.prepare('SELECT * FROM parroquias ORDER BY nombre ASC').all<Parish>();
	return c.json({ parroquias: parishes.results });
});

parishes_router.post('/', authenticate, async (c) =>
{
	const body = await require_json_body(c);
	const id = await create_parish(c.env.prelatura_db, c.get('user'), body as Parish);
	return c.json({ id: id }, 201);
});

parishes_router.put('/:id{[0-9]+}', authenticate, async (c) =>
{
	const body = await require_json_body(c);
	await update_parish(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')), body as Parish);
	return c.json({ success: true });
});

parishes_router.patch('/:id{[0-9]+}/toggle-active', authenticate, async (c) =>
{
	await toggle_parish_active(c.env.prelatura_db, c.get('user'), Number(c.req.param('id')));
	return c.json({ success: true });
});
