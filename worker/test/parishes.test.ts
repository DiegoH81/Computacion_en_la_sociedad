import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { sign_jwt } from '../src/utils/crypto';
import { resetDatabase } from './helpers/resetDatabase';

// Gestión de parroquias por HTTP (cualquier admin) y la marca de administrador principal por HTTP.

const ADMIN_ID = 1;
const PARISH_USER_ID = 2;

async function api(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  return SELF.fetch(`https://example.com${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('rutas /api/parishes para administradores', () => {
  let adminToken: string;
  let parishUserToken: string;

  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);
    await env.prelatura_db.batch([
      env.prelatura_db.prepare(`INSERT INTO parroquias (id, nombre, activa) VALUES (1, 'San Pedro', 1), (2, 'Cerrada', 0)`),
      env.prelatura_db.prepare(
        `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo, principal)
         VALUES (1, 'admin', 'hash', 'Admin', 'De', 'Prueba', 'admin_general', NULL, 1, 1),
                (2, 'parroco1', 'hash', 'Usuario', 'Parroquia', 'Uno', 'admin_parroquia', 1, 1, 0)`,
      ),
    ]);
    adminToken = await sign_jwt({ usuarioId: ADMIN_ID, rol: 'admin_general', parroquiaId: null }, env.JWT_SECRET);
    parishUserToken = await sign_jwt({ usuarioId: PARISH_USER_ID, rol: 'admin_parroquia', parroquiaId: 1 }, env.JWT_SECRET);
  });

  it('lista todas, también las deshabilitadas, con su ubicación', async () => {
    const response = await api('/api/parishes/todas', { token: adminToken });

    expect(await response.json()).toEqual({
      parroquias: [
        { id: 2, nombre: 'Cerrada', ubicacion: null, activa: 0 },
        { id: 1, nombre: 'San Pedro', ubicacion: null, activa: 1 },
      ],
    });
  });

  it('crea, edita y deshabilita una parroquia; la lista de los selectores solo trae las activas', async () => {
    const created = await api('/api/parishes', { method: 'POST', token: adminToken, body: { nombre: '  Nueva  ', ubicacion: 'Ayaviri' } });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const edited = await api(`/api/parishes/${id}`, { method: 'PUT', token: adminToken, body: { nombre: 'Renombrada', ubicacion: '' } });
    expect(edited.status).toBe(200);
    expect(await env.prelatura_db.prepare('SELECT nombre, ubicacion, activa FROM parroquias WHERE id = ?').bind(id).first())
      .toEqual({ nombre: 'Renombrada', ubicacion: null, activa: 1 });

    expect((await api(`/api/parishes/${id}/toggle-active`, { method: 'PATCH', token: adminToken })).status).toBe(200);
    const active = (await (await api('/api/parishes', { token: adminToken })).json()) as { parishes: { nombre: string }[] };
    expect(active.parishes.map((parish) => parish.nombre)).toEqual(['San Pedro']);
  });

  it('valida el nombre y no deja repetirlo', async () => {
    const empty = await api('/api/parishes', { method: 'POST', token: adminToken, body: { nombre: '  ' } });
    expect(empty.status).toBe(400);

    const repeated = await api('/api/parishes', { method: 'POST', token: adminToken, body: { nombre: 'SAN PEDRO' } });
    expect(repeated.status).toBe(409);
    expect(await repeated.json()).toEqual({ message: 'Ya existe una parroquia con ese nombre.' });

    // Al editar, conservar su propio nombre no cuenta como repetido.
    expect((await api('/api/parishes/1', { method: 'PUT', token: adminToken, body: { nombre: 'San Pedro', ubicacion: 'Puno' } })).status).toBe(200);
    expect((await api('/api/parishes/999', { method: 'PUT', token: adminToken, body: { nombre: 'X' } })).status).toBe(404);
  });

  it('un usuario de parroquia no las gestiona, y sin token se pide sesión', async () => {
    for (const [method, path] of [['GET', '/api/parishes/todas'], ['POST', '/api/parishes'], ['PUT', '/api/parishes/1'], ['PATCH', '/api/parishes/1/toggle-active']]) {
      const body = method === 'GET' ? undefined : { nombre: 'X' };
      expect((await api(path, { method, token: parishUserToken, body })).status, `${method} ${path}`).toBe(403);
      expect((await api(path, { method, body })).status, `${method} ${path}`).toBe(401);
    }
  });

  it('GET /api/users/me dice si el admin es el principal, y make-principal pasa la marca', async () => {
    await env.prelatura_db
      .prepare(`INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, activo) VALUES (3, 'admin2', 'hash', 'Otro', 'A', 'B', 'admin_general', 1)`)
      .run();
    const otherToken = await sign_jwt({ usuarioId: 3, rol: 'admin_general', parroquiaId: null }, env.JWT_SECRET);

    expect(await (await api('/api/users/me', { token: adminToken })).json()).toEqual({ principal: true });
    expect(await (await api('/api/users/me', { token: otherToken })).json()).toEqual({ principal: false });
    // El administrador de una parroquia también pregunta: el principal de la suya gestiona a sus administradores.
    expect((await api('/api/users/me', { token: parishUserToken })).status).toBe(200);

    expect((await api('/api/users/3/make-principal', { method: 'PATCH', token: otherToken })).status).toBe(403);
    expect((await api('/api/users/3/make-principal', { method: 'PATCH', token: adminToken })).status).toBe(200);
    expect(await (await api('/api/users/me', { token: otherToken })).json()).toEqual({ principal: true });
  });
});
