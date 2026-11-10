// Cuentas que trabajan en varias parroquias (migración 0019): la parroquia de origen sigue en usuarios,
// las adicionales en usuario_parroquias, y la vista membresias junta las dos.
import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { sign_jwt, type TokenUser } from '../src/utils/crypto';
import { make_principal, remove_parish, search_users, set_parish, toggle_user_active } from '../src/controllers/users';
import type { ChangeResult, RecordData, SyncChange } from '../../shared/sync';
import { resetDatabase } from './helpers/resetDatabase';

const db = () => env.prelatura_db;

// 1 general · 2 juan (admin y principal de la 1) · 3 ana (usuario de la 1)
// 4 luis (usuario de la 2) · 5 rosa (admin y principal de la 2) · la parroquia 3 no tiene a nadie.
const GENERAL: TokenUser = { usuarioId: 1, rol: 'admin_general', parroquiaId: null };
const JUAN: TokenUser = { usuarioId: 2, rol: 'admin_parroquia', parroquiaId: 1 };
const ANA: TokenUser = { usuarioId: 3, rol: 'usuario', parroquiaId: 1 };
const ROSA: TokenUser = { usuarioId: 5, rol: 'admin_parroquia', parroquiaId: 2 };

const PAGE = { orden: 'nombres' as const, direccion: 'asc' as const, pagina: 1 };

beforeEach(async () => {
  await resetDatabase(db());
  await db().batch([
    db().prepare(`INSERT INTO parroquias (id, nombre) VALUES (1, 'San Pedro'), (2, 'Santa Rosa'), (3, 'San José')`),
    db().prepare(
      `INSERT INTO usuarios (id, username, password_hash, rol, parroquia_id, principal, nombre, apellido_paterno, apellido_materno)
       VALUES (1, 'general', 'hash', 'admin_general', NULL, 1, 'Gen', 'Eral', ''),
              (2, 'juan', 'hash', 'admin_parroquia', 1, 1, 'Juan', 'Uno', ''),
              (3, 'ana', 'hash', 'usuario', 1, 0, 'Ana', 'Dos', ''),
              (4, 'luis', 'hash', 'usuario', 2, 0, 'Luis', 'Tres', ''),
              (5, 'rosa', 'hash', 'admin_parroquia', 2, 1, 'Rosa', 'Cuatro', '')`,
    ),
    db().prepare(
      `INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno)
       VALUES ('ministro-2', 2, 'Manuel', 'Torres', 'Rios')`,
    ),
  ]);
});

async function memberships(user_id: number) {
  const rows = await db()
    .prepare('SELECT parroquia_id, rol, principal, origen FROM membresias WHERE usuario_id = ? ORDER BY parroquia_id')
    .bind(user_id)
    .all();
  return rows.results;
}

async function api(path: string, user: TokenUser, init: { method?: string; body?: unknown } = {}) {
  const token = await sign_jwt(user, env.JWT_SECRET);
  return SELF.fetch(`https://example.com${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

function baptism(client_id: string, parish_id: number): RecordData {
  return {
    tipo: 'bautismo',
    client_id,
    parroquia_id: parish_id,
    ministro_client_id: 'ministro-2',
    libro: '1',
    folio: '1',
    numero: client_id,
    fecha_emision: '2020-01-01',
    fecha_evento: null,
    anotaciones: null,
    estado: 'vigente',
    anulado_por_usuario_id: null,
    anulado_en: null,
    motivo_anulacion: null,
    personas: [
      {
        client_id: `${client_id}-persona`,
        dni: null,
        nombres: 'Diego',
        apellido_paterno: 'Guido',
        apellido_materno: 'Alvaro',
        fecha_nacimiento: null,
        fecha_aproximada: null,
        lugar_nacimiento: null,
        padre: null,
        madre: null,
      },
    ],
    detalle: { padrino_1: null, padrino_2: null },
    cambios: [],
    solicitudes: [],
    historial: [],
  };
}

async function push(user: TokenUser, record: RecordData): Promise<ChangeResult> {
  const change: SyncChange = { entidad: 'bautismo', client_id: record.client_id, version_base: null, cola_id: `cola-${record.client_id}`, datos: record };
  const response = await api('/api/sync/push', user, { method: 'POST', body: { cambios: [change] } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { resultados: ChangeResult[] }).resultados[0];
}

describe('parroquias adicionales', () => {
  it('el general agrega una parroquia; como admin de una parroquia sin principal, queda de principal', async () => {
    await set_parish(db(), GENERAL, 2, 3, 'admin_parroquia');

    expect(await memberships(2)).toEqual([
      { parroquia_id: 1, rol: 'admin_parroquia', principal: 1, origen: 1 },
      { parroquia_id: 3, rol: 'admin_parroquia', principal: 1, origen: 0 },
    ]);
  });

  it('en una parroquia que ya tiene principal entra como administrador común', async () => {
    await set_parish(db(), GENERAL, 2, 2, 'admin_parroquia');
    expect(await memberships(2)).toContainEqual({ parroquia_id: 2, rol: 'admin_parroquia', principal: 0, origen: 0 });
  });

  it('cambiar el rol usa la misma ruta', async () => {
    await set_parish(db(), GENERAL, 3, 2, 'usuario');
    await set_parish(db(), GENERAL, 3, 2, 'admin_parroquia');
    expect(await memberships(3)).toContainEqual({ parroquia_id: 2, rol: 'admin_parroquia', principal: 0, origen: 0 });
  });

  it('solo el general agrega o quita parroquias', async () => {
    await expect(set_parish(db(), JUAN, 3, 2, 'usuario')).rejects.toMatchObject({ status: 403 });
    await set_parish(db(), GENERAL, 3, 2, 'usuario');
    await expect(remove_parish(db(), ROSA, 3, 2)).rejects.toMatchObject({ status: 403 });
  });

  it('la parroquia de origen no se agrega ni se quita, y un general no tiene parroquias', async () => {
    await expect(set_parish(db(), GENERAL, 2, 1, 'usuario')).rejects.toMatchObject({ status: 400 });
    await expect(remove_parish(db(), GENERAL, 2, 1)).rejects.toMatchObject({ status: 404 });
    await expect(set_parish(db(), GENERAL, 1, 2, 'usuario')).rejects.toMatchObject({ status: 403 });
    await expect(set_parish(db(), GENERAL, 3, 2, 'admin_general')).rejects.toMatchObject({ status: 400 });
  });

  it('el principal de una parroquia adicional no se quita ni baja a usuario sin pasar la marca', async () => {
    await set_parish(db(), GENERAL, 2, 3, 'admin_parroquia');

    await expect(remove_parish(db(), GENERAL, 2, 3)).rejects.toMatchObject({ status: 400 });
    await expect(set_parish(db(), GENERAL, 2, 3, 'usuario')).rejects.toMatchObject({ status: 400 });

    await set_parish(db(), GENERAL, 5, 3, 'admin_parroquia');
    await make_principal(db(), GENERAL, 5, 3);
    await remove_parish(db(), GENERAL, 2, 3);
    expect(await memberships(2)).toHaveLength(1);
  });
});

describe('principal por parroquia', () => {
  it('se pasa entre la tabla de origen y la de adicionales, y queda uno solo', async () => {
    await set_parish(db(), GENERAL, 2, 2, 'admin_parroquia');

    // Rosa, principal de Santa Rosa, se la pasa a Juan (Santa Rosa es adicional para él).
    await make_principal(db(), ROSA, 2, 2);
    expect(await memberships(2)).toContainEqual({ parroquia_id: 2, rol: 'admin_parroquia', principal: 1, origen: 0 });
    expect(await memberships(5)).toEqual([{ parroquia_id: 2, rol: 'admin_parroquia', principal: 0, origen: 1 }]);

    // Juan la devuelve desde su parroquia adicional.
    await make_principal(db(), JUAN, 5, 2);
    expect(await memberships(5)).toEqual([{ parroquia_id: 2, rol: 'admin_parroquia', principal: 1, origen: 1 }]);
    expect(await memberships(2)).toContainEqual({ parroquia_id: 2, rol: 'admin_parroquia', principal: 0, origen: 0 });
  });

  it('el principal de otra parroquia no pasa la marca de esta', async () => {
    await set_parish(db(), GENERAL, 3, 2, 'admin_parroquia');
    await expect(make_principal(db(), JUAN, 3, 2)).rejects.toMatchObject({ status: 403 });
  });

  it('una cuenta puede ser principal de dos parroquias, y así no se deshabilita', async () => {
    await set_parish(db(), GENERAL, 3, 3, 'admin_parroquia');
    expect(await memberships(3)).toContainEqual({ parroquia_id: 3, rol: 'admin_parroquia', principal: 1, origen: 0 });

    // Ana es usuario en su origen, pero principal de San José.
    await expect(toggle_user_active(db(), GENERAL, 3)).rejects.toMatchObject({ status: 400 });
  });
});

describe('quién gestiona a quién', () => {
  it('a una cuenta de varias parroquias la modifica solo el general', async () => {
    expect(await toggle_user_active(db(), ROSA, 4)).toBeUndefined();
    await toggle_user_active(db(), ROSA, 4);

    await set_parish(db(), GENERAL, 4, 1, 'usuario');
    await expect(toggle_user_active(db(), ROSA, 4)).rejects.toMatchObject({ status: 403 });
    await expect(toggle_user_active(db(), JUAN, 4)).rejects.toMatchObject({ status: 403 });
    await toggle_user_active(db(), GENERAL, 4);
  });

  it('quien es usuario en su origen pero administrador en otra parroquia gestiona las cuentas de esa', async () => {
    await set_parish(db(), GENERAL, 3, 2, 'admin_parroquia');

    const page = await search_users(db(), ANA, { ...PAGE, parroquia_id: 2 }, 20);
    expect(page.resultados.map((user) => [user.username, user.rol])).toEqual([
      ['ana', 'admin_parroquia'],
      ['luis', 'usuario'],
      ['rosa', 'admin_parroquia'],
    ]);

    // En su parroquia de origen no es administradora: no ve nada.
    expect((await search_users(db(), ANA, { ...PAGE, parroquia_id: 1 }, 20)).resultados).toEqual([]);
  });
});

describe('sincronización y login', () => {
  it('cada partida se revisa con el rol en su parroquia', async () => {
    await set_parish(db(), GENERAL, 2, 2, 'admin_parroquia');

    expect((await push(JUAN, baptism('b-juan', 2))).estado).toBe('aplicado');
    expect(await push(ANA, baptism('b-ana', 2))).toMatchObject({ estado: 'rechazado' });
  });

  it('una partida que nombra a alguien de esa parroquia se acepta; si ya no está y no figuraba, no', async () => {
    await set_parish(db(), GENERAL, 3, 2, 'usuario');
    const record = baptism('b-historial', 2);
    record.historial = [{ client_id: 'h-1', usuario_id: 3, evento: 'registrada', motivo: null, fecha: '2026-11-08T00:00:00.000Z', campos: [] }];
    expect((await push(ROSA, record)).estado).toBe('aplicado');

    // Le quitan la parroquia: la partida que ya la nombraba se sigue pudiendo editar.
    await remove_parish(db(), GENERAL, 3, 2);
    const change: SyncChange = { entidad: 'bautismo', client_id: record.client_id, version_base: 1, cola_id: 'cola-2', datos: { ...record, anotaciones: 'nota' } };
    const response = await api('/api/sync/push', ROSA, { method: 'POST', body: { cambios: [change] } });
    expect(((await response.json()) as { resultados: ChangeResult[] }).resultados[0].estado).toBe('aplicado');

    // Pero una partida nueva que la nombra ya no.
    const other = baptism('b-otra', 2);
    other.historial = [{ client_id: 'h-2', usuario_id: 3, evento: 'registrada', motivo: null, fecha: '2026-11-08T00:00:00.000Z', campos: [] }];
    expect(await push(ROSA, other)).toMatchObject({ estado: 'rechazado' });
  });

  it('el login trae todas las parroquias de la cuenta, primero la de origen', async () => {
    const hash = '100000:ONr8hN0xK3ji61Hi4jmtVQ==:ODk7gds76M2Wqs/FpbZ7Shvj4JpVdYiABTVmNnpVPSc=';
    await db().prepare('UPDATE usuarios SET password_hash = ? WHERE id = 2').bind(hash).run();
    await set_parish(db(), GENERAL, 2, 3, 'usuario');

    const response = await SELF.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'juan', password: 'admin123' }),
    });
    const body = (await response.json()) as { usuario: { parroquias: unknown[] } };
    expect(body.usuario.parroquias).toEqual([
      { id: 1, nombre: 'San Pedro', rol: 'admin_parroquia' },
      { id: 3, nombre: 'San José', rol: 'usuario' },
    ]);
  });

  it('la referencia trae las parroquias adicionales', async () => {
    await set_parish(db(), GENERAL, 4, 1, 'usuario');
    const data = (await (await api('/api/reference', ANA)).json()) as { usuario_parroquias: unknown[] };
    expect(data.usuario_parroquias).toEqual([{ usuario_id: 4, parroquia_id: 1, rol: 'usuario', principal: 0 }]);
  });

  it('las rutas de parroquias responden por HTTP', async () => {
    expect((await api('/api/users/3/parishes/2', GENERAL, { method: 'PUT', body: { rol: 'usuario' } })).status).toBe(200);
    expect((await api('/api/users/3/parishes/2', JUAN, { method: 'DELETE' })).status).toBe(403);
    expect((await api('/api/users/3/parishes/2', GENERAL, { method: 'DELETE' })).status).toBe(200);
    expect(await memberships(3)).toHaveLength(1);
  });
});
