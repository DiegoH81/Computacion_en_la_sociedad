import type { Autor } from './syncTypes';

const DEVICE_ID = /^[0-9a-f-]{36}$/i;
const HEX_KEY = /^[0-9a-f]{64}$/i;

export type DeviceKeyResult =
  | { ok: true; clave?: string; parroquiaId: number | null }
  | { ok: false; status: number; message: string };

const SIN_PERMISO: DeviceKeyResult = {
  ok: false,
  status: 403,
  message: 'Esta PC pertenece a otra parroquia.',
};
const ID_INVALIDO: DeviceKeyResult = { ok: false, status: 400, message: 'Identificador de PC no válido.' };

async function cipherKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function encrypt(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cipherKey(secret), new TextEncoder().encode(plain));
  return `${toBase64(iv)}:${toBase64(new Uint8Array(data))}`;
}

async function decrypt(stored: string, secret: string): Promise<string> {
  const [iv, data] = stored.split(':');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await cipherKey(secret), fromBase64(data));
  return new TextDecoder().decode(plain);
}

function readDevice(db: D1Database, deviceId: string) {
  return db
    .prepare('SELECT parroquia_id, clave_cifrada FROM dispositivos WHERE id = ?')
    .bind(deviceId)
    .first<{ parroquia_id: number | null; clave_cifrada: string }>();
}


export async function saveDeviceKey(
  db: D1Database,
  secret: string,
  autor: Autor,
  deviceId: string,
  clave: unknown,
): Promise<DeviceKeyResult> {
  if (!DEVICE_ID.test(deviceId))
    return ID_INVALIDO;

  if (typeof clave !== 'string' || !HEX_KEY.test(clave))
  {
    return { ok: false, status: 400, message: 'La clave no es válida.' };
  }

  const device = await readDevice(db, deviceId);
  if (
    device &&
    autor.rol !== 'admin' &&
    device.parroquia_id !== null &&
    device.parroquia_id !== autor.parroquiaId
  ) {
    return SIN_PERMISO;
  }

  const parroquiaId = autor.parroquiaId ?? device?.parroquia_id ?? null;
  await db
    .prepare(
      `INSERT INTO dispositivos (id, parroquia_id, clave_cifrada) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         parroquia_id = excluded.parroquia_id,
         clave_cifrada = excluded.clave_cifrada,
         actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(deviceId, parroquiaId, await encrypt(clave, secret))
    .run();

  return { ok: true, parroquiaId };
}

export async function getDeviceKey(
  db: D1Database,
  secret: string,
  autor: Autor,
  deviceId: string,
): Promise<DeviceKeyResult> {
  if (!DEVICE_ID.test(deviceId))
    return ID_INVALIDO;

  const device = await readDevice(db, deviceId);
  if (!device)
    return { ok: false, status: 404, message: 'No hay copia de la clave de esta PC.' };

  if (autor.rol !== 'admin' && device.parroquia_id !== autor.parroquiaId)
    return SIN_PERMISO;

  return { ok: true, clave: await decrypt(device.clave_cifrada, secret), parroquiaId: device.parroquia_id };
}
