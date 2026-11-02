import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { signJwt } from '../src/lib/jwt';
import type { CambioEntrante, MinistroSync, PartidaSync, ResultadoSync } from '../src/services/syncTypes';
import { resetDatabase } from './helpers/resetDatabase';

const db = () => env.prelatura_db;
const DEVICE = '11111111-2222-4333-8444-555555555555';
const KEY = 'ab'.repeat(32);

const tokenParish1 = () => signJwt({ usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1 }, env.JWT_SECRET);
const tokenParish2 = () => signJwt({ usuarioId: 2, rol: 'usuario_parroquia', parroquiaId: 2 }, env.JWT_SECRET);
const tokenAdmin = () => signJwt({ usuarioId: 3, rol: 'admin', parroquiaId: null }, env.JWT_SECRET);

function api(path: string, token: string, init: { method?: string; body?: unknown } = {}) {
  return SELF.fetch(`https://example.com${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

async function push(token: string, cambios: CambioEntrante[]): Promise<ResultadoSync[]> {
  const response = await api('/api/sync/push', token, { method: 'POST', body: { cambios } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { resultados: ResultadoSync[] }).resultados;
}

async function pull(token: string, cursor = 0) {
  const response = await api(`/api/sync/pull?cursor=${cursor}`, token);
  expect(response.status).toBe(200);
  return (await response.json()) as { partidas: PartidaSync[]; cursor: number; hayMas: boolean };
}

const persona = (client_id: string, nombres = 'Diego') => ({
  client_id,
  dni: '12345678',
  nombres,
  apellido_paterno: 'Guido',
  apellido_materno: 'Alvaro',
  fecha_nacimiento: null,
  edad: 30,
  lugar_nacimiento: null,
  padre: null,
  madre: null,
});

const bautismo = (overrides: Partial<PartidaSync> = {}): PartidaSync => ({
  tipo: 'bautismo',
  client_id: 'partida-1',
  parroquia_id: 1,
  ministro_client_id: 'ministro-1',
  libro: '1',
  folio: '2',
  numero: '3',
  fecha_emision: '2020-01-01',
  fecha_evento: null,
  anotaciones: null,
  estado: 'vigente',
  anulado_por_usuario_id: null,
  anulado_en: null,
  motivo_anulacion: null,
  personas: [persona('persona-1')],
  detalle: { padrino_1: 'Pedro', padrino_2: null },
  cambios: [],
  ...overrides,
});

const matrimonio = (overrides: Partial<PartidaSync> = {}): PartidaSync => ({
  ...bautismo(),
  tipo: 'matrimonio',
  client_id: 'matrimonio-1',
  personas: [persona('conyuge-1', 'Braulio'), persona('conyuge-2', 'Maria')],
  detalle: { lugar: 'Puno', testigo_1: 'Ana', conyuge_2_bautismo_parroquia: 'San Juan' },
  ...overrides,
});

const cambio = (datos: PartidaSync | MinistroSync, version_base: number | null, cola_id = 'cola-1'): CambioEntrante => ({
  entidad: 'tipo' in datos ? datos.tipo : 'ministro',
  client_id: datos.client_id,
  version_base,
  cola_id,
  datos,
});

const resultado = (r: ResultadoSync) => r.estado;
const count = async (table: string) =>
  (await db().prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{ total: number }>())?.total;

beforeEach(async () => {
  await resetDatabase(db());
  await db().batch([
    db().prepare(`INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1'), (2, 'Parroquia 2')`),
    db().prepare(
      `INSERT INTO usuarios (id, username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno)
       VALUES (1, 'p1', 'hash-secreto', 'usuario_parroquia', 1, 'P', 'U', 'N'),
              (2, 'p2', 'hash-secreto', 'usuario_parroquia', 2, 'P', 'D', 'S'),
              (3, 'adm', 'hash-secreto', 'admin', NULL, 'A', 'D', 'M')`,
    ),
    db().prepare(
      `INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno, updated_at)
       VALUES ('ministro-1', 1, 'Manuel', 'Torres', 'Rios', '2026-01-01T00:00:00.000Z')`,
    ),
  ]);
});

describe('subir cambios', () => {
  it('guarda una partida nueva completa, en todas sus tablas', async () => {
    const [r] = await push(await tokenParish1(), [cambio(bautismo(), null)]);

    expect(r).toMatchObject({ estado: 'aplicado', version: 1 });
    expect(await count('personas')).toBe(1);
    expect(await count('sacramentos')).toBe(1);
    expect(await count('bautismos')).toBe(1);
    const fila = await db()
      .prepare(
        `SELECT s.libro, m.client_id AS ministro, b.padrino_1, p.edad FROM sacramentos s
         JOIN bautismos b ON b.sacramento_id = s.id JOIN personas p ON p.id = b.persona_id
         JOIN ministros m ON m.id = s.ministro_id`,
      )
      .first();
    expect(fila).toEqual({ libro: '1', ministro: 'ministro-1', padrino_1: 'Pedro', edad: 30 });
  });

  it('guarda un matrimonio con sus dos cónyuges', async () => {
    const [r] = await push(await tokenParish1(), [cambio(matrimonio(), null)]);

    expect(resultado(r)).toBe('aplicado');
    expect(await count('personas')).toBe(2);
    const { partidas } = await pull(await tokenParish2());
    expect(partidas[0].personas.map((p) => p.nombres)).toEqual(['Braulio', 'Maria']);
    expect(partidas[0].detalle).toMatchObject({ lugar: 'Puno', testigo_1: 'Ana', conyuge_2_bautismo_parroquia: 'San Juan' });
  });

  it('una edición sube la versión y sus correcciones no se duplican al reenviarla', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null, 'cola-1')]);

    const correccion = {
      client_id: 'cambio-1',
      persona_client_id: 'persona-1',
      usuario_id: 1,
      campo_cambio: 'nombres',
      valor_anterior: 'Diego',
      valor_nuevo: 'Diogo',
      fecha_cambio: '2026-01-02T00:00:00.000Z',
    };
    const editada = bautismo({ personas: [persona('persona-1', 'Diogo')], cambios: [correccion] });
    const [primera] = await push(token, [cambio(editada, 1, 'cola-2')]);
    expect(primera).toMatchObject({ estado: 'aplicado', version: 2 });

    // El servidor guardó, pero la respuesta no llegó: la PC reenvía la misma fila de su cola.
    const [reenvio] = await push(token, [cambio(editada, 1, 'cola-2')]);
    expect(resultado(reenvio)).toBe('aplicado');
    expect(await count('cambios_persona')).toBe(1);
    expect(await count('personas')).toBe(1);
  });

  it('un reenvío de una partida nueva no la duplica', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null)]);
    const [r] = await push(token, [cambio(bautismo(), null)]);

    expect(resultado(r)).toBe('aplicado');
    expect(await count('sacramentos')).toBe(1);
  });

  it('detecta el conflicto si otra PC cambió el registro, y no lo pisa', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null, 'pc-a-1')]);
    await push(token, [cambio(bautismo({ libro: 'PC-A' }), 1, 'pc-a-2')]);

    const [r] = await push(token, [cambio(bautismo({ libro: 'PC-B' }), 1, 'pc-b-1')]);

    expect(r).toMatchObject({ estado: 'conflicto', version: 2 });
    const fila = await db().prepare('SELECT libro FROM sacramentos').first<{ libro: string }>();
    expect(fila?.libro).toBe('PC-A');
  });

  it('dos subidas simultáneas sobre la misma versión: solo una se aplica, y entera', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null, 'inicial')]);

    const [a, b] = await Promise.all([
      push(token, [cambio(bautismo({ libro: 'A', personas: [persona('persona-1', 'A')] }), 1, 'pc-a')]),
      push(token, [cambio(bautismo({ libro: 'B', personas: [persona('persona-1', 'B')] }), 1, 'pc-b')]),
    ]);

    expect([a[0].estado, b[0].estado].sort()).toEqual(['aplicado', 'conflicto']);
    const fila = await db()
      .prepare('SELECT s.libro, s.version, p.nombres FROM sacramentos s JOIN bautismos b ON b.sacramento_id = s.id JOIN personas p ON p.id = b.persona_id')
      .first<{ libro: string; version: number; nombres: string }>();
    expect(fila?.version).toBe(2);
    expect(fila?.nombres).toBe(fila?.libro);
  });

  it('rechaza partidas de otra parroquia sin bloquear las demás', async () => {
    const [ajena, propia] = await push(await tokenParish2(), [
      cambio(bautismo(), null),
      cambio(bautismo({ client_id: 'partida-2', parroquia_id: 2, personas: [persona('persona-2')] }), null),
    ]);

    expect(ajena).toMatchObject({ estado: 'rechazado' });
    expect(propia).toMatchObject({ estado: 'aplicado' });
    expect(await count('sacramentos')).toBe(1);
  });

  it('no deja que una PC se apropie de una partida ajena cambiando su parroquia', async () => {
    await push(await tokenParish1(), [cambio(bautismo(), null)]);

    const [r] = await push(await tokenParish2(), [cambio(bautismo({ parroquia_id: 2 }), 1, 'otra')]);

    expect(r).toMatchObject({ estado: 'rechazado' });
    const fila = await db().prepare('SELECT parroquia_id FROM sacramentos').first<{ parroquia_id: number }>();
    expect(fila?.parroquia_id).toBe(1);
  });

  it('el administrador puede subir partidas de cualquier parroquia', async () => {
    const [r] = await push(await tokenAdmin(), [cambio(bautismo({ parroquia_id: 2 }), null)]);

    expect(resultado(r)).toBe('aplicado');
  });

  it('no reutiliza la persona de otra partida', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null)]);

    const [r] = await push(token, [cambio(bautismo({ client_id: 'partida-2' }), null, 'otra')]);

    expect(r).toMatchObject({ estado: 'rechazado' });
  });

  it('rechaza una corrección atribuida a un usuario de otra parroquia', async () => {
    const correccion = {
      client_id: 'cambio-1',
      persona_client_id: 'persona-1',
      usuario_id: 2,
      campo_cambio: 'nombres',
      valor_anterior: 'A',
      valor_nuevo: 'B',
      fecha_cambio: '2026-01-02T00:00:00.000Z',
    };
    const [r] = await push(await tokenParish1(), [cambio(bautismo({ cambios: [correccion] }), null)]);

    expect(r).toMatchObject({ estado: 'rechazado' });
    expect(await count('sacramentos')).toBe(0);
    expect(await count('personas')).toBe(0);
  });

  it('una partida anulada no se puede reactivar', async () => {
    const token = await tokenParish1();
    const anulada = bautismo({
      estado: 'anulado',
      anulado_por_usuario_id: 1,
      anulado_en: '2026-01-02T00:00:00.000Z',
      motivo_anulacion: 'Error',
    });
    await push(token, [cambio(anulada, null)]);

    const [r] = await push(token, [cambio(bautismo(), 1, 'otra')]);

    expect(r).toMatchObject({ estado: 'rechazado' });
  });

  it('rechaza datos inválidos y deja la base intacta', async () => {
    const [r] = await push(await tokenParish1(), [cambio(bautismo({ libro: '' }), null)]);

    expect(r).toMatchObject({ estado: 'rechazado' });
    expect(await count('personas')).toBe(0);
  });

  it('exige sesión y limita el tamaño del envío', async () => {
    const sinToken = await SELF.fetch('https://example.com/api/sync/push', { method: 'POST', body: '{}' });
    expect(sinToken.status).toBe(401);

    const grande = Array.from({ length: 21 }, () => cambio(bautismo(), null));
    const response = await api('/api/sync/push', await tokenParish1(), { method: 'POST', body: { cambios: grande } });
    expect(response.status).toBe(400);
  });
});

describe('ministros', () => {
  const ministro = (overrides: Partial<MinistroSync> = {}): MinistroSync => ({
    client_id: 'ministro-2',
    parroquia_id: 1,
    titulo: 'Padre',
    nombre: 'Luis',
    apellido_paterno: 'Ramos',
    apellido_materno: 'Paz',
    activo: 1,
    ...overrides,
  });

  it('crea y edita con control de versión', async () => {
    const token = await tokenParish1();
    const [creado] = await push(token, [cambio(ministro(), null, 'a')]);
    expect(creado).toMatchObject({ estado: 'aplicado', version: 1 });

    const [editado] = await push(token, [cambio(ministro({ nombre: 'Lucho', activo: 0 }), 1, 'b')]);
    expect(editado).toMatchObject({ estado: 'aplicado', version: 2 });

    const [conflicto] = await push(token, [cambio(ministro({ nombre: 'Otro' }), 1, 'c')]);
    expect(conflicto).toMatchObject({ estado: 'conflicto', version: 2 });
  });

  it('una partida puede usar un ministro subido en el mismo envío', async () => {
    const resultados = await push(await tokenParish1(), [
      cambio(ministro(), null, 'a'),
      cambio(bautismo({ ministro_client_id: 'ministro-2' }), null, 'b'),
    ]);

    expect(resultados.map(resultado)).toEqual(['aplicado', 'aplicado']);
  });

  it('rechaza una partida cuyo ministro no llegó al servidor', async () => {
    const [r] = await push(await tokenParish1(), [cambio(bautismo({ ministro_client_id: 'no-existe' }), null)]);

    expect(r).toMatchObject({ estado: 'rechazado' });
  });

  it('no permite editar ministros de otra parroquia', async () => {
    const [r] = await push(await tokenParish2(), [cambio(ministro({ client_id: 'ministro-1' }), 1)]);

    expect(r).toMatchObject({ estado: 'rechazado' });
  });
});

describe('descargar', () => {
  it('entrega por cursor, y una partida editada vuelve a aparecer', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null, 'a')]);
    await push(token, [cambio(bautismo({ client_id: 'partida-2', personas: [persona('persona-2')] }), null, 'b')]);

    const primera = await pull(await tokenParish2());
    expect(primera.partidas.map((p) => p.client_id)).toEqual(['partida-1', 'partida-2']);
    expect(primera.hayMas).toBe(false);

    const vacia = await pull(await tokenParish2(), primera.cursor);
    expect(vacia.partidas).toEqual([]);
    expect(vacia.cursor).toBe(primera.cursor);

    await push(token, [cambio(bautismo({ libro: 'Editado' }), 1, 'c')]);
    const siguiente = await pull(await tokenParish2(), primera.cursor);
    expect(siguiente.partidas).toHaveLength(1);
    expect(siguiente.partidas[0]).toMatchObject({ client_id: 'partida-1', libro: 'Editado', version: 2 });
    expect(siguiente.partidas[0].ministro_client_id).toBe('ministro-1');
  });

  it('pagina de 50 en 50', async () => {
    const sacramentos = Array.from({ length: 51 }, (_, i) =>
      db()
        .prepare(
          `INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision)
           VALUES (?, 'bautismo', 1, '1', '1', '1', '2020-01-01')`,
        )
        .bind(`s-${i}`),
    );
    const personas = Array.from({ length: 51 }, (_, i) =>
      db().prepare(`INSERT INTO personas (client_id, parroquia_id, nombres, apellido_paterno) VALUES (?, 1, 'A', 'B')`).bind(`p-${i}`),
    );
    const subtipos = Array.from({ length: 51 }, (_, i) =>
      db()
        .prepare(
          `INSERT INTO bautismos (sacramento_id, persona_id)
           VALUES ((SELECT id FROM sacramentos WHERE client_id = ?), (SELECT id FROM personas WHERE client_id = ?))`,
        )
        .bind(`s-${i}`, `p-${i}`),
    );
    await db().batch([...sacramentos, ...personas, ...subtipos]);

    const token = await tokenParish1();
    const primera = await pull(token);
    expect(primera.partidas).toHaveLength(50);
    expect(primera.hayMas).toBe(true);

    const segunda = await pull(token, primera.cursor);
    expect(segunda.partidas).toHaveLength(1);
    expect(segunda.hayMas).toBe(false);
  });

  it('un registro concreto se puede pedir por client_id', async () => {
    const token = await tokenParish1();
    await push(token, [cambio(bautismo(), null)]);

    const response = await api('/api/sync/record?entidad=bautismo&client_id=partida-1', token);
    expect(((await response.json()) as { registro: PartidaSync }).registro).toMatchObject({ client_id: 'partida-1', version: 1 });
    expect((await api('/api/sync/record?entidad=bautismo&client_id=nada', token)).status).toBe(404);
  });

  it('los datos de referencia nunca incluyen contraseñas', async () => {
    const response = await api('/api/reference', await tokenParish1());
    const text = await response.text();

    expect(text).not.toContain('hash');
    const data = JSON.parse(text);
    expect(data.parroquias).toHaveLength(2);
    expect(data.usuarios).toHaveLength(3);
    expect(data.ministros[0]).toMatchObject({ client_id: 'ministro-1', version: 1 });
  });
});

describe('copia de la clave de cada PC', () => {
  const path = `/api/devices/${DEVICE}/key`;
  const save = async (token: string, clave: unknown = KEY) => api(path, token, { method: 'PUT', body: { clave } });

  it('guarda la clave cifrada y la devuelve a su parroquia', async () => {
    const token = await tokenParish1();
    expect((await save(token)).status).toBe(200);

    const fila = await db()
      .prepare('SELECT clave_cifrada, parroquia_id FROM dispositivos')
      .first<{ clave_cifrada: string; parroquia_id: number }>();
    expect(fila?.clave_cifrada).not.toContain(KEY);
    expect(fila?.parroquia_id).toBe(1);

    const response = await api(path, token);
    expect(await response.json()).toEqual({ clave: KEY });
  });

  it('otra parroquia no puede leerla ni reemplazarla, y el administrador sí', async () => {
    await save(await tokenParish1());
    const otra = await tokenParish2();

    expect((await api(path, otra)).status).toBe(403);
    expect((await save(otra, 'cd'.repeat(32))).status).toBe(403);
    expect(await (await api(path, await tokenAdmin())).json()).toEqual({ clave: KEY });
  });

  it('una PC registrada por un administrador pasa a la primera parroquia que la use', async () => {
    await save(await tokenAdmin());
    const parroco = await tokenParish1();
    expect((await api(path, parroco)).status).toBe(403);

    const response = await save(parroco);
    expect(await response.json()).toEqual({ parroquiaId: 1 });
    expect((await api(path, parroco)).status).toBe(200);
  });

  it('responde 404 si no hay copia y exige sesión y datos válidos', async () => {
    const token = await tokenParish1();
    expect((await api(path, token)).status).toBe(404);
    expect((await save(token, 'corta')).status).toBe(400);
    expect((await api('/api/devices/no-valido/key', token)).status).toBe(400);
    expect((await SELF.fetch(`https://example.com${path}`)).status).toBe(401);
  });
});
