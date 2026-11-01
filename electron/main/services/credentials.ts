import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { LocalDatabase } from '../localDb/database';
import type { Session } from './common';

const KEY_LENGTH = 32;
const COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer, options: ScryptOptions, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function createVerifier(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, COST, KEY_LENGTH);
  return `scrypt:${COST.N}:${COST.r}:${COST.p}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

export async function matchesVerifier(password: string, verifier: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = verifier.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64'),
    { N: Number(N), r: Number(r), p: Number(p), maxmem: COST.maxmem },
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

export async function saveCredential(db: LocalDatabase, usuarioId: number, password: string): Promise<void> {
  const verifier = await createVerifier(password);
  db.prepare(
    `INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET
       verificador = excluded.verificador,
       actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(usuarioId, verifier);
}

export interface OfflineUser {
  id: number;
  rol: Session['rol'];
  parroquiaId: number | null;
  parroquiaNombre: string | null;
  nombreCompleto: string;
}

export type OfflineLoginResult =
  | { ok: true; usuario: OfflineUser }
  | { ok: false; reason: 'sin-credencial' | 'incorrecta' };

/** Una cuenta desactivada se conoce al sincronizar: desde entonces tampoco entra sin internet. */
export async function verifyOffline(db: LocalDatabase, username: string, password: string): Promise<OfflineLoginResult> {
  const row = db
    .prepare(
      `SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
              c.verificador, p.nombre AS parroquia_nombre
       FROM usuarios u
       LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
       LEFT JOIN parroquias p ON p.id = u.parroquia_id
       WHERE u.username = ?`,
    )
    .get(username) as
    | {
        id: number;
        rol: Session['rol'];
        parroquia_id: number | null;
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string;
        activo: number;
        verificador: string | null;
        parroquia_nombre: string | null;
      }
    | undefined;

  if (!row?.verificador) return { ok: false, reason: 'sin-credencial' };
  if (row.activo !== 1 || !(await matchesVerifier(password, row.verificador))) {
    return { ok: false, reason: 'incorrecta' };
  }

  return {
    ok: true,
    usuario: {
      id: row.id,
      rol: row.rol,
      parroquiaId: row.parroquia_id,
      parroquiaNombre: row.parroquia_nombre,
      nombreCompleto: [row.nombre, row.apellido_paterno, row.apellido_materno].filter(Boolean).join(' '),
    },
  };
}
