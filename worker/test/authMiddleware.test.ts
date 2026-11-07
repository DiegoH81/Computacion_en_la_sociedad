import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { sign_jwt } from '../src/utils/crypto';
import { authenticate_request } from '../src/utils/middleware';

const ACTIVE_USER_ID = 10;
const DISABLED_USER_ID = 11;
const MISSING_USER_ID = 999;
const INVALID_SESSION_MESSAGE = 'Sesión inválida o expirada.';

function tokenFor(userId: number, secret: string = env.JWT_SECRET): Promise<string> {
  return sign_jwt({ usuarioId: userId, rol: 'admin_parroquia', parroquiaId: 1 }, secret);
}

function requestWith(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('https://example.com/api/anything', { headers });
}

describe('authMiddleware (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno,
                               rol, parroquia_id, activo)
         VALUES (?, 'usuario.activo', 'hash', 'Activo', 'De', 'Prueba', 'admin_parroquia', 1, 1),
                (?, 'usuario.deshabilitado', 'hash', 'Deshabilitado', 'De', 'Prueba', 'admin_parroquia', 1, 0)`,
      )
      .bind(ACTIVE_USER_ID, DISABLED_USER_ID)
      .run();
  });

  describe('authenticate_request', () => {
    it('acepta un token válido de un usuario activo', async () => {
      const token = await tokenFor(ACTIVE_USER_ID);

      const user = await authenticate_request(requestWith(token), env.JWT_SECRET, env.prelatura_db);

      expect(user.usuarioId).toBe(ACTIVE_USER_ID);
    });

    it('rechaza un token con firma válida si el usuario fue deshabilitado después de emitirlo', async () => {
      // El token es técnicamente válido (firma correcta, sin expirar): lo que lo
      // invalida es que la cuenta ya no está activa. Este es el caso que antes pasaba.
      const token = await tokenFor(DISABLED_USER_ID);

      await expect(authenticate_request(requestWith(token), env.JWT_SECRET, env.prelatura_db))
        .rejects.toMatchObject({ status: 401, message: INVALID_SESSION_MESSAGE });
    });

    it('rechaza un token válido si el usuario ya no existe', async () => {
      const token = await tokenFor(MISSING_USER_ID);

      await expect(authenticate_request(requestWith(token), env.JWT_SECRET, env.prelatura_db))
        .rejects.toMatchObject({ status: 401 });
    });

    it('rechaza una petición sin header Authorization', async () => {
      await expect(authenticate_request(requestWith(), env.JWT_SECRET, env.prelatura_db))
        .rejects.toMatchObject({ status: 401 });
    });

    it('rechaza un token firmado con otro secreto', async () => {
      const token = await tokenFor(ACTIVE_USER_ID, 'otro-secreto-completamente-distinto');

      await expect(authenticate_request(requestWith(token), env.JWT_SECRET, env.prelatura_db))
        .rejects.toMatchObject({ message: INVALID_SESSION_MESSAGE });
    });

    it('usa el mismo mensaje para cuenta deshabilitada que para token inválido (no da pistas)', async () => {
      const disabled = await authenticate_request(
        requestWith(await tokenFor(DISABLED_USER_ID)),
        env.JWT_SECRET,
        env.prelatura_db,
      ).catch((error: Error) => error);
      const forged = await authenticate_request(
        requestWith(await tokenFor(ACTIVE_USER_ID, 'otro-secreto')),
        env.JWT_SECRET,
        env.prelatura_db,
      ).catch((error: Error) => error);

      if (!(disabled instanceof Error) || !(forged instanceof Error))
        throw new Error('ambos casos debían ser rechazados');

      expect(disabled.message).toBe(forged.message);
    });
  });

  // Verifica el cableado: que cada endpoint protegido realmente aplica la
  // comprobación de cuenta activa. Si algún router se olvidara de pasar la base
  // de datos o de llamar a authenticate_request, este test lo detecta.
  describe('endpoints protegidos exigen una cuenta activa', () => {
    const PROTECTED_ENDPOINTS = [
      '/api/parishes',
      '/api/reference',
      '/api/sync/pull',
    ];

    it.each(PROTECTED_ENDPOINTS)('%s responde 200 a un usuario activo', async (path) => {
      const token = await tokenFor(ACTIVE_USER_ID);

      const response = await SELF.fetch(`https://example.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
    });

    it.each(PROTECTED_ENDPOINTS)('%s responde 401 a un usuario deshabilitado', async (path) => {
      const token = await tokenFor(DISABLED_USER_ID);

      const response = await SELF.fetch(`https://example.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(401);
    });
  });
});
