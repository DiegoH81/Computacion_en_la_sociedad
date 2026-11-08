import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { sign_jwt } from '../src/utils/crypto';

const ADMIN_ID = 1;
const PARISH_USER_ID = 2;

const NEW_USER_BODY = {
  nombre: 'Ana',
  apellido_paterno: 'Quispe',
  apellido_materno: 'Mamani',
  username: 'ana.quispe',
  password: 'passwordNueva123',
  parroquia_nueva: 'Parroquia Nueva',
};

function tokenFor(
  userId: number,
  rol: 'admin_general' | 'admin_parroquia' | 'usuario',
  parroquiaId: number | null,
): Promise<string> {
  return sign_jwt({ usuarioId: userId, rol, parroquiaId }, env.JWT_SECRET);
}

async function api(
  path: string,
  options: { method?: string; token?: string; body?: unknown; rawBody?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  return SELF.fetch(`https://example.com${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.rawBody ?? (options.body ? JSON.stringify(options.body) : undefined),
  });
}

describe('rutas /api/users (Worker real + D1)', () => {
  let adminToken: string;
  let parishUserToken: string;

  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia 1')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno,
                               rol, parroquia_id, activo)
         VALUES (?, 'admin', 'hash', 'Administrador', 'De', 'Prueba', 'admin_general', NULL, 1),
                (?, 'parroco1', 'hash', 'Usuario', 'Parroquia', 'Uno', 'usuario', 1, 1)`,
      )
      .bind(ADMIN_ID, PARISH_USER_ID)
      .run();

    adminToken = await tokenFor(ADMIN_ID, 'admin_general', null);
    parishUserToken = await tokenFor(PARISH_USER_ID, 'usuario', 1);
  });

  describe('autenticación y autorización', () => {
    it('GET /api/users sin token responde 401', async () => {
      const response = await api('/api/users');

      expect(response.status).toBe(401);
    });

    const ENDPOINTS: Array<[string, string, unknown]> = [
      ['GET', '/api/users', undefined],
      ['POST', '/api/users', NEW_USER_BODY],
      ['PUT', '/api/users/1', { nombre: 'X', apellido_paterno: 'Y' }],
      ['PATCH', '/api/users/1/toggle-active', undefined],
    ];

    it.each(ENDPOINTS)('%s %s responde 403 a un usuario (ayudante)', async (method, path, body) => {
      const response = await api(path, { method, token: parishUserToken, body });

      expect(response.status).toBe(403);
    });
  });

  describe('como admin', () => {
    it('GET /api/users devuelve la lista y nunca incluye password_hash', async () => {
      const response = await api('/api/users', { token: adminToken });
      const raw = await response.text();

      expect(response.status).toBe(200);
      expect(raw).not.toContain('password_hash');
      const data = JSON.parse(raw) as { resultados: unknown[]; total_paginas: number };
      expect(data.resultados).toHaveLength(2);
      expect(data.total_paginas).toBe(1);
    });

    it('parámetros de paginación inválidos no provocan un error 500', async () => {
      const response = await api('/api/users?pagina=abc&por_pagina=-5&orden=cualquiera', {
        token: adminToken,
      });

      expect(response.status).toBe(200);
    });

    it('POST con JSON inválido responde 400', async () => {
      const response = await api('/api/users', {
        method: 'POST',
        token: adminToken,
        rawBody: '{esto no es json',
      });

      expect(response.status).toBe(400);
    });

    it('POST con datos inválidos responde 400 con un mensaje', async () => {
      const response = await api('/api/users', {
        method: 'POST',
        token: adminToken,
        body: { ...NEW_USER_BODY, password: 'corta' },
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { message: string };
      expect(data.message).toContain('8 caracteres');
    });

    it('POST con un username repetido responde 409', async () => {
      const response = await api('/api/users', {
        method: 'POST',
        token: adminToken,
        body: { ...NEW_USER_BODY, username: 'parroco1' },
      });

      expect(response.status).toBe(409);
    });

    it('una ruta inexistente bajo /api/users responde 404', async () => {
      const response = await api('/api/users/abc', { token: adminToken });

      expect(response.status).toBe(404);
    });

    it('un admin no puede deshabilitar su propia cuenta (400)', async () => {
      const response = await api(`/api/users/${ADMIN_ID}/toggle-active`, {
        method: 'PATCH',
        token: adminToken,
      });

      expect(response.status).toBe(400);
    });
  });

  describe('flujo completo de punta a punta', () => {
    it('crear con parroquia nueva → iniciar sesión → deshabilitar → su sesión deja de valer', async () => {
      // 1. El admin crea una cuenta con una parroquia nueva.
      const created = await api('/api/users', {
        method: 'POST',
        token: adminToken,
        body: NEW_USER_BODY,
      });
      expect(created.status).toBe(201);
      const { id: newUserId } = (await created.json()) as { id: number };

      // 2. Aparece en la búsqueda, con su parroquia.
      const search = await api('/api/users?apellido_paterno=Quispe', { token: adminToken });
      const found = (await search.json()) as {
        resultados: Array<{ id: number; username: string; parroquia_nombre: string }>;
      };
      expect(found.resultados).toHaveLength(1);
      expect(found.resultados[0]).toMatchObject({
        id: newUserId,
        username: 'ana.quispe',
        parroquia_nombre: 'Parroquia Nueva',
      });

      // 3. La cuenta nueva inicia sesión por la ruta pública de login.
      const loginResponse = await api('/api/auth/login', {
        method: 'POST',
        body: { username: 'ana.quispe', password: 'passwordNueva123' },
      });
      expect(loginResponse.status).toBe(200);
      const { token: newUserToken } = (await loginResponse.json()) as { token: string };

      // 4. Con ese token puede usar el sistema.
      const before = await api('/api/sync/pull', { token: newUserToken });
      expect(before.status).toBe(200);

      // 5. El admin la deshabilita.
      const toggled = await api(`/api/users/${newUserId}/toggle-active`, {
        method: 'PATCH',
        token: adminToken,
      });
      expect(toggled.status).toBe(200);

      // 6. El token que ya tenía deja de funcionar al instante, y no puede volver a entrar.
      const after = await api('/api/sync/pull', { token: newUserToken });
      expect(after.status).toBe(401);

      const relogin = await api('/api/auth/login', {
        method: 'POST',
        body: { username: 'ana.quispe', password: 'passwordNueva123' },
      });
      expect(relogin.status).toBe(401);
    });

    it('editar la contraseña desde el admin reemplaza a la anterior', async () => {
      const response = await api(`/api/users/${PARISH_USER_ID}`, {
        method: 'PUT',
        token: adminToken,
        body: { nombre: 'Usuario', apellido_paterno: 'Parroquia', password: 'contraseñaNueva456' },
      });
      expect(response.status).toBe(200);

      const afterEdit = await api('/api/users?apellido_paterno=Parroquia', { token: adminToken });
      expect(afterEdit.status).toBe(200);
    });
  });
});
