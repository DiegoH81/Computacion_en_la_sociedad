// Copia de seguridad de la clave de la base local de cada PC.
//
// Cada PC cifra su base con una clave propia. Si esa clave se pierde (por ejemplo, al reinstalar
// Windows), la PC la vuelve a pedir aquí. El Worker la guarda cifrada con DEVICE_KEY_SECRET,
// así que quien lea la tabla "dispositivos" no puede usarla.
//
//   PUT /api/devices/:id/key   guarda la clave         { clave }  ->  { parroquiaId }
//   GET /api/devices/:id/key   devuelve la clave                  ->  { clave }

import type { TokenUser } from '../auth/jwt';
import { error_response, json_response, read_json_body } from '../http';

const DEVICE_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

interface DeviceRow
{
	parroquia_id: number | null;
	clave_cifrada: string;
}

function to_base64(bytes: Uint8Array): string
{
	return btoa(String.fromCharCode(...bytes));
}

function from_base64(text: string): Uint8Array<ArrayBuffer>
{
	return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
}

// Convierte el secreto del servidor en una clave AES de 256 bits.
async function server_key(secret: string): Promise<CryptoKey>
{
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Devuelve "iv:datos", los dos en base64.
async function encrypt(text: string, secret: string): Promise<string>
{
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, await server_key(secret), new TextEncoder().encode(text));

	return `${to_base64(iv)}:${to_base64(new Uint8Array(data))}`;
}

async function decrypt(stored: string, secret: string): Promise<string>
{
	const [iv, data] = stored.split(':');
	const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: from_base64(iv) }, await server_key(secret), from_base64(data));

	return new TextDecoder().decode(text);
}

function read_device(db: D1Database, device_id: string): Promise<DeviceRow | null>
{
	return db.prepare('SELECT parroquia_id, clave_cifrada FROM dispositivos WHERE id = ?').bind(device_id).first<DeviceRow>();
}

function other_parish_response(): Response
{
	return error_response('Esta PC pertenece a otra parroquia.', 403);
}

function invalid_device_response(): Response
{
	return error_response('Identificador de PC no válido.', 400);
}

export async function handle_save_device_key(db: D1Database, secret: string, user: TokenUser, device_id: string, request: Request): Promise<Response>
{
	const body = await read_json_body(request);
	const key = body?.clave;

	if (!DEVICE_ID_PATTERN.test(device_id))
		return invalid_device_response();

	if (typeof key !== 'string' || !HEX_KEY_PATTERN.test(key))
		return error_response('La clave no es válida.', 400);

	// Un usuario de parroquia no puede pisar la clave de una PC de otra parroquia.
	const device = await read_device(db, device_id);
	if (device && user.rol !== 'admin' && device.parroquia_id !== null && device.parroquia_id !== user.parroquiaId)
		return other_parish_response();

	// Si guarda un admin (que no tiene parroquia), la PC conserva la parroquia que ya tenía.
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
		.bind(device_id, parish_id, await encrypt(key, secret))
		.run();

	return json_response({ parroquiaId: parish_id });
}

export async function handle_get_device_key(db: D1Database, secret: string, user: TokenUser, device_id: string): Promise<Response>
{
	if (!DEVICE_ID_PATTERN.test(device_id))
		return invalid_device_response();

	const device = await read_device(db, device_id);
	if (!device)
		return error_response('No hay copia de la clave de esta PC.', 404);

	if (user.rol !== 'admin' && device.parroquia_id !== user.parroquiaId)
		return other_parish_response();

	const key = await decrypt(device.clave_cifrada, secret);
	return json_response({ clave: key });
}
