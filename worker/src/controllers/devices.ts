
//   PUT /api/devices/:id/key   stores key    { clave }  ->  { parroquiaId }
//   GET /api/devices/:id/key   returns key              ->  { clave }

// Security copy of DEVICE key

import { Hono, type Context } from 'hono';
import { decrypt_device_key, encrypt_device_key } from '../utils/crypto';
import { read_json_body } from '../utils/helpers';
import { ServiceError, type AppEnv } from '../utils/middleware';

const DEVICE_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

interface Device
{
	id: string;
	parroquia_id: number | null;
	clave_cifrada: string;
	creado_en: string;
	actualizado_en: string;
}

function device_secret(c: Context<AppEnv>): string
{
	if (!c.env.DEVICE_KEY_SECRET)
	{
		console.error('Falta configurar el secreto DEVICE_KEY_SECRET.');
		throw new ServiceError('El servidor no tiene configurada la copia de claves.', 503);
	}

	return c.env.DEVICE_KEY_SECRET;
}

function check_device_id(device_id: string): void
{
	if (!DEVICE_ID_PATTERN.test(device_id))
		throw new ServiceError('Identificador de PC no válido.', 400);
}

function read_device(db: D1Database, device_id: string): Promise<Pick<Device, 'parroquia_id' | 'clave_cifrada'> | null>
{
	return db.prepare('SELECT parroquia_id, clave_cifrada FROM dispositivos WHERE id = ?').bind(device_id).first();
}

const OTHER_PARISH = 'Esta PC pertenece a otra parroquia.';

export const devices_router = new Hono<AppEnv>();

devices_router.put('/:id/key', async (c) =>
{
	const secret = device_secret(c);
	const user = c.get('user');
	const device_id = c.req.param('id');
	const body = await read_json_body(c);
	const key = body?.clave;

	check_device_id(device_id);

	if (typeof key !== 'string' || !HEX_KEY_PATTERN.test(key))
		throw new ServiceError('La clave no es válida.', 400);

	const db = c.env.prelatura_db;
	const device = await read_device(db, device_id);
	if (device && user.rol !== 'admin_general' && device.parroquia_id !== null && device.parroquia_id !== user.parroquiaId)
		throw new ServiceError(OTHER_PARISH, 403);

	
	let parish_id: number | null = null;
	if (user.parroquiaId !== null)
		parish_id = user.parroquiaId;
	else if (device)
		parish_id = device.parroquia_id;

	await db
		.prepare(
			`INSERT INTO dispositivos (id, parroquia_id, clave_cifrada) VALUES (?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET
				parroquia_id = excluded.parroquia_id,
				clave_cifrada = excluded.clave_cifrada,
				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
		)
		.bind(device_id, parish_id, await encrypt_device_key(key, secret))
		.run();

	return c.json({ parroquiaId: parish_id });
});

devices_router.get('/:id/key', async (c) =>
{
	const secret = device_secret(c);
	const user = c.get('user');
	const device_id = c.req.param('id');

	check_device_id(device_id);

	const device = await read_device(c.env.prelatura_db, device_id);
	if (!device)
		throw new ServiceError('No hay copia de la clave de esta PC.', 404);

	if (user.rol !== 'admin_general' && device.parroquia_id !== user.parroquiaId)
		throw new ServiceError(OTHER_PARISH, 403);

	return c.json({ clave: await decrypt_device_key(device.clave_cifrada, secret) });
});
