// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLocalDatabase, type LocalDatabase } from '../../electron/main/localDb/database';
import { AVISO_RECONSTRUIDA, deviceId, localPaths, openOrDetect, recoverLocalDatabase, uploadKeyCopy, type KeyStore } from '../../electron/main/localDb/recovery';
import { ServiceError, type Session } from '../../electron/main/services/common';
import { createVerifier, matchesVerifier, saveCredential, verifyOffline } from '../../electron/main/services/credentials';
import { marriages } from '../../electron/main/services/marriages';
import { ministers } from '../../electron/main/services/ministers';
import { applyReferenceData, type ReferenceData } from '../../electron/main/services/reference';
import type { RemoteOptions, RemoteRequest } from '../../electron/main/services/remote';
import { singlePersonSacrament, type SinglePersonInput } from '../../electron/main/services/singlePersonSacraments';
import { getSyncValue, pullChanges, pushPending, readQueueSummary, resolveConflict, runSync, setSyncValue } from '../../electron/main/services/syncEngine';
import { readPartida, type PartidaSync } from '../../electron/main/services/syncRecords';

const baptisms = singlePersonSacrament('bautismo');
const parish1: Session = { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1, token: 't' };

const reference: ReferenceData = {
  parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
  ministros: [{ id: 7, client_id: 'ministro-1', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1, version: 3 }],
  usuarios: [
    { id: 1, parroquia_id: 1, username: 'parroco1', rol: 'usuario_parroquia', nombre: 'Uno', apellido_paterno: 'P', apellido_materno: 'M', activo: 1 },
    { id: 9, parroquia_id: null, username: 'admin', rol: 'admin', nombre: 'Admin', apellido_paterno: 'A', apellido_materno: 'B', activo: 1 },
  ],
};

const input = (overrides: Partial<SinglePersonInput> = {}): SinglePersonInput => ({
  fechaSacramento: '2020-01-01',
  numeroLibro: '1',
  numeroFolio: '2',
  numeroRegistro: '3',
  nombre: 'Diago',
  apellidoPaterno: 'Guido',
  apellidoMaterno: 'Alvaro',
  ...overrides,
});

const remotePartida = (overrides: Partial<PartidaSync> = {}): PartidaSync => ({
  tipo: 'bautismo',
  client_id: 'remota-1',
  parroquia_id: 1,
  ministro_client_id: 'ministro-1',
  libro: '9',
  folio: '9',
  numero: '9',
  fecha_emision: '2021-01-01',
  fecha_evento: null,
  anotaciones: null,
  estado: 'vigente',
  anulado_por_usuario_id: null,
  anulado_en: null,
  motivo_anulacion: null,
  version: 4,
  updated_at: '2026-01-01T00:00:00.000Z',
  personas: [
    { client_id: 'persona-remota', dni: null, nombres: 'Ana', apellido_paterno: 'Paz', apellido_materno: 'Rey', fecha_nacimiento: null, edad: 5, lugar_nacimiento: null, padre: null, madre: null },
  ],
  detalle: { padrino_1: 'Pedro', padrino_2: null },
  cambios: [],
  ...overrides,
});

type Handler = (path: string, options: RemoteOptions) => unknown;

/** Servidor falso: responde lo que indique el handler; si lanza, simula el fallo. */
function fakeRemote(handler: Handler) {
  const calls: { path: string; options: RemoteOptions }[] = [];
  const request = (async (requestPath: string, options: RemoteOptions = {}) => {
    calls.push({ path: requestPath, options });
    return handler(requestPath, options);
  }) as RemoteRequest;
  return { request, calls };
}

const pushBody = (options: RemoteOptions) =>
  (options.body as { cambios: { entidad: string; client_id: string; version_base: number | null; cola_id: string; datos: PartidaSync }[] }).cambios;

const acceptAll = (version = 1): Handler => (_path, options) => ({
  resultados: pushBody(options).map((c) => ({ entidad: c.entidad, client_id: c.client_id, estado: 'aplicado', version })),
});

const offline = () => {
  throw new ServiceError('sin conexión', 0);
};

let dir: string;
let db: LocalDatabase;
const queue = () => db.prepare('SELECT * FROM sync_cola ORDER BY id').all() as Record<string, unknown>[];

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-sync-'));
  db = openLocalDatabase(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  applyReferenceData(db, reference);
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('subir la cola', () => {
  it('envía la partida completa, la quita de la cola y adopta la versión del servidor', async () => {
    const id = baptisms.create(db, parish1, input({ celebranteId: 1, padrino: 'Pedro' }), undefined);
    const { request, calls } = fakeRemote(acceptAll(1));

    await pushPending(db, request, 'token');

    const [cambio] = pushBody(calls[0].options);
    expect(cambio).toMatchObject({ entidad: 'bautismo', version_base: null });
    expect(cambio.datos).toMatchObject({ libro: '1', ministro_client_id: 'ministro-1', detalle: { padrino_1: 'Pedro' } });
    expect(cambio.datos.personas[0]).toMatchObject({ nombres: 'Diago' });
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT version FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(1);
  });

  it('incluye las correcciones, y varias ediciones se envían como una sola', async () => {
    const id = baptisms.create(db, parish1, input(), undefined);
    baptisms.update(db, parish1, id, input({ correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }));
    baptisms.update(db, parish1, id, input({ nombre: 'Diego', correcciones: [{ campo: 'nombres', valorNuevo: 'Diogo' }] }));
    const { request, calls } = fakeRemote(acceptAll());

    await pushPending(db, request, 'token');

    const cambios = pushBody(calls[0].options);
    expect(cambios).toHaveLength(1);
    expect(cambios[0].datos.personas[0].nombres).toBe('Diogo');
    expect(cambios[0].datos.cambios.map((c) => c.valor_nuevo)).toEqual(['Diego', 'Diogo']);
  });

  it('sube los ministros antes que las partidas', async () => {
    baptisms.create(db, parish1, input(), undefined);
    ministers.create(db, parish1, { nombre: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Paz' }, undefined);
    const { request, calls } = fakeRemote(acceptAll());

    await pushPending(db, request, 'token');

    expect(pushBody(calls[0].options).map((c) => c.entidad)).toEqual(['ministro', 'bautismo']);
  });

  it('un corte no pierde nada y el reenvío usa el mismo cola_id', async () => {
    baptisms.create(db, parish1, input(), undefined);
    const cut = fakeRemote(offline);

    await expect(pushPending(db, cut.request, 'token')).rejects.toThrow();
    expect(queue()).toHaveLength(1);
    const colaId = pushBody(cut.calls[0].options)[0].cola_id;

    const retry = fakeRemote(acceptAll());
    await pushPending(db, retry.request, 'token');

    expect(pushBody(retry.calls[0].options)[0].cola_id).toBe(colaId);
    expect(queue()).toEqual([]);
  });

  it('si se edita mientras viaja, la edición sigue pendiente sobre la versión aceptada', async () => {
    const id = baptisms.create(db, parish1, input(), undefined);
    const { request } = fakeRemote((_path, options) => {
      baptisms.update(db, parish1, id, input({ nombre: 'Editado en vuelo' }));
      return acceptAll(5)(_path, options);
    });

    await pushPending(db, request, 'token');

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ version_base: 5, estado: 'pendiente' });
  });

  it('un conflicto queda marcado, no bloquea a los demás y no se reintenta', async () => {
    const primero = baptisms.create(db, parish1, input({ numeroRegistro: '1' }), undefined);
    baptisms.create(db, parish1, input({ numeroRegistro: '2' }), undefined);
    const primeraPartida = db.prepare('SELECT client_id FROM sacramentos WHERE id = ?').pluck().get(primero);

    const { request } = fakeRemote((_path, options) => ({
      resultados: pushBody(options).map((c) =>
        c.client_id === primeraPartida
          ? { entidad: c.entidad, client_id: c.client_id, estado: 'conflicto', version: 8, motivo: 'Otra PC' }
          : { entidad: c.entidad, client_id: c.client_id, estado: 'aplicado', version: 1 },
      ),
    }));

    await pushPending(db, request, 'token');

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ client_id: primeraPartida, estado: 'conflicto', motivo: 'Otra PC' });
    expect(readQueueSummary(db)).toMatchObject({ conflictos: 1, pendientes: 0 });

    const second = fakeRemote(acceptAll());
    await pushPending(db, second.request, 'token');
    expect(second.calls).toEqual([]);
  });

  it('un rechazo queda marcado con su motivo y se reintenta', async () => {
    baptisms.create(db, parish1, input(), undefined);
    const { request } = fakeRemote((_path, options) => ({
      resultados: pushBody(options).map((c) => ({ entidad: c.entidad, client_id: c.client_id, estado: 'rechazado', motivo: 'Sin permiso' })),
    }));

    await pushPending(db, request, 'token');
    expect(readQueueSummary(db)).toMatchObject({ rechazados: 1, items: [{ motivo: 'Sin permiso' }] });

    const retry = fakeRemote(acceptAll());
    await pushPending(db, retry.request, 'token');
    expect(queue()).toEqual([]);
  });

  it('envía en lotes de 20', async () => {
    for (let i = 0; i < 21; i += 1) baptisms.create(db, parish1, input({ numeroRegistro: String(i) }), undefined);
    const { request, calls } = fakeRemote(acceptAll());

    await pushPending(db, request, 'token');

    expect(calls.map((call) => pushBody(call.options).length)).toEqual([20, 1]);
  });
});

describe('descargar cambios', () => {
  const page = (partidas: PartidaSync[], cursor: number, hayMas = false) => ({ partidas, cursor, hayMas });

  it('guarda una partida de otra PC, sin anotarla en la cola, y es visible en la búsqueda', async () => {
    const { request } = fakeRemote(() => page([remotePartida()], 10));

    await pullChanges(db, request, 'token');

    expect(queue()).toEqual([]);
    expect(getSyncValue(db, 'cursor')).toBe('10');
    const row = db.prepare('SELECT version, parroquia_id FROM sacramentos WHERE client_id = ?').get('remota-1');
    expect(row).toEqual({ version: 4, parroquia_id: 1 });
    expect(baptisms.search(db, { nombre: 'Ana' }).rows).toHaveLength(1);
  });

  it('actualiza con la versión exacta del servidor, aunque coincida con la de la persona', async () => {
    const first = fakeRemote(() => page([remotePartida()], 1));
    await pullChanges(db, first.request, 'token');

    const edited = remotePartida({
      version: 5,
      libro: 'Nuevo',
      personas: [{ ...remotePartida().personas[0], nombres: 'Anita' }],
      cambios: [
        { client_id: 'c1', persona_client_id: 'persona-remota', usuario_id: 1, campo_cambio: 'nombres', valor_anterior: 'Ana', valor_nuevo: 'Anita', fecha_cambio: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const second = fakeRemote(() => page([edited], 2));
    await pullChanges(db, second.request, 'token');

    expect(db.prepare('SELECT libro, version FROM sacramentos').get()).toEqual({ libro: 'Nuevo', version: 5 });
    expect(queue()).toEqual([]);
    // La corrección también llega: se encuentra por el nombre anterior.
    expect(baptisms.search(db, { nombre: 'Ana' }).rows).toHaveLength(1);
    expect(baptisms.search(db, { nombre: 'Anita' }).rows).toHaveLength(1);
  });

  it('no pisa una partida con cambios sin subir', async () => {
    const first = fakeRemote(() => page([remotePartida()], 1));
    await pullChanges(db, first.request, 'token');
    const id = db.prepare('SELECT id FROM sacramentos').pluck().get() as number;
    baptisms.update(db, parish1, id, input({ nombre: 'Local' }));

    const second = fakeRemote(() => page([remotePartida({ version: 9, libro: 'Servidor' })], 2));
    await pullChanges(db, second.request, 'token');

    expect(db.prepare('SELECT libro FROM sacramentos').pluck().get()).toBe('1');
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ version_base: 4 });
  });

  it('un matrimonio llega con sus dos cónyuges y detalle', async () => {
    const persona = remotePartida().personas[0];
    const marriage = remotePartida({
      tipo: 'matrimonio',
      personas: [persona, { ...persona, client_id: 'persona-2', nombres: 'Maria' }],
      detalle: { lugar: 'Puno', testigo_1: 'Luz' },
    });
    const { request } = fakeRemote(() => page([marriage], 1));

    await pullChanges(db, request, 'token');

    const id = db.prepare('SELECT id FROM sacramentos').pluck().get() as number;
    expect(marriages.getById(db, id)).toMatchObject({ esposo_nombre: 'Ana', esposa_nombre: 'Maria', lugar_matrimonio: 'Puno', testigo_1: 'Luz' });
  });

  it('si la página trae un ministro desconocido, refresca la referencia y reintenta', async () => {
    let referenceCalls = 0;
    const { request } = fakeRemote((requestPath) => {
      if (requestPath === '/api/reference') {
        referenceCalls += 1;
        return { ...reference, ministros: [...reference.ministros, { ...reference.ministros[0], id: 8, client_id: 'ministro-nuevo' }] };
      }
      return page([remotePartida({ ministro_client_id: 'ministro-nuevo' })], 1);
    });

    await pullChanges(db, request, 'token');

    expect(referenceCalls).toBe(1);
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(1);
  });

  it('un corte entre páginas conserva lo aplicado y continúa desde el cursor', async () => {
    const one = remotePartida({ client_id: 'p1', personas: [{ ...remotePartida().personas[0], client_id: 'pe1' }] });
    const two = remotePartida({ client_id: 'p2', personas: [{ ...remotePartida().personas[0], client_id: 'pe2' }] });
    const cut = fakeRemote((requestPath) => {
      if (requestPath.endsWith('cursor=0')) return page([one], 1, true);
      return offline();
    });

    await expect(pullChanges(db, cut.request, 'token')).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(1);
    expect(getSyncValue(db, 'cursor')).toBe('1');

    const resume = fakeRemote(() => page([two], 2));
    await pullChanges(db, resume.request, 'token');

    expect(resume.calls[0].path).toContain('cursor=1');
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
  });

  it('un fallo a mitad de una página revierte la página entera y no avanza el cursor', async () => {
    const good = remotePartida({ client_id: 'p1', personas: [{ ...remotePartida().personas[0], client_id: 'pe1' }] });
    const bad = remotePartida({ client_id: 'p2', libro: null as unknown as string, personas: [{ ...remotePartida().personas[0], client_id: 'pe2' }] });
    const { request } = fakeRemote(() => page([good, bad], 2));

    await expect(pullChanges(db, request, 'token')).rejects.toThrow();

    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(0);
    expect(db.prepare('SELECT COUNT(*) FROM personas').pluck().get()).toBe(0);
    expect(getSyncValue(db, 'cursor')).toBeNull();
  });
});

describe('datos de referencia', () => {
  it('actualiza un ministro cambiado en el servidor, pero no uno con cambios sin subir', () => {
    applyReferenceData(db, { ...reference, ministros: [{ ...reference.ministros[0], nombre: 'Manolo', version: 4 }] });
    expect(db.prepare('SELECT nombre, version FROM ministros').get()).toEqual({ nombre: 'Manolo', version: 4 });

    const id = db.prepare('SELECT id FROM ministros').pluck().get() as number;
    ministers.update(db, parish1, id, { nombre: 'Local', apellidoPaterno: 'T', apellidoMaterno: 'R' });

    applyReferenceData(db, { ...reference, ministros: [{ ...reference.ministros[0], nombre: 'Servidor', version: 5 }] });
    expect(db.prepare('SELECT nombre FROM ministros').pluck().get()).toBe('Local');
  });

  it('resuelve solo los ministros que la migración anotó sin haber cambiado', () => {
    db.prepare(`INSERT INTO sync_cola (entidad, client_id, cola_id) VALUES ('ministro', 'ministro-1', 'x')`).run();

    applyReferenceData(db, reference);

    expect(queue()).toEqual([]);
  });

  it('una cuenta desactivada pierde su credencial local', async () => {
    await saveCredential(db, 1, 'clave-larga');

    applyReferenceData(db, { ...reference, usuarios: [{ ...reference.usuarios[0], activo: 0 }] });

    expect(await verifyOffline(db, 'parroco1', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
  });

  it('nombres de usuario intercambiados entre cuentas no rompen la descarga', () => {
    const [a, b] = reference.usuarios;
    applyReferenceData(db, { ...reference, usuarios: [{ ...a, username: b.username }, { ...b, username: a.username }] });

    expect(db.prepare('SELECT username FROM usuarios ORDER BY id').pluck().all()).toEqual(['admin', 'parroco1']);
  });
});

describe('conflictos', () => {
  async function conflicted() {
    const id = baptisms.create(db, parish1, input(), undefined);
    const clientId = db.prepare('SELECT client_id FROM sacramentos WHERE id = ?').pluck().get(id) as string;
    baptisms.update(db, parish1, id, input({ nombre: 'Diego local' }));
    db.prepare(`UPDATE sync_cola SET estado = 'conflicto', motivo = 'x'`).run();
    const server = { ...readPartida(db, clientId), version: 7, libro: 'Del servidor', personas: [{ ...readPartida(db, clientId).personas[0], nombres: 'Diego servidor' }], cambios: [] };
    return { id, clientId, server };
  }

  it('"servidor" descarta lo local y sus correcciones sin subir', async () => {
    const { id, clientId, server } = await conflicted();
    const { request } = fakeRemote(() => ({ registro: server }));

    await resolveConflict(db, request, 'token', 'bautismo', clientId, 'servidor');

    expect(baptisms.getById(db, id)).toMatchObject({ numero_libro: 'Del servidor', nombre: 'Diego servidor' });
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) FROM cambios_persona').pluck().get()).toBe(0);
    expect(db.prepare('SELECT version FROM sacramentos').pluck().get()).toBe(7);
  });

  it('"local" conserva lo local y lo deja listo para subir sobre la versión del servidor', async () => {
    const { id, clientId, server } = await conflicted();
    const { request } = fakeRemote(() => ({ registro: server }));

    await resolveConflict(db, request, 'token', 'bautismo', clientId, 'local');

    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diego local' });
    expect(queue()[0]).toMatchObject({ estado: 'pendiente', version_base: 7, motivo: null });
  });
});

describe('sincronización completa', () => {
  it('descarga referencia, sube y baja, y anota la hora', async () => {
    baptisms.create(db, parish1, input(), undefined);
    const { request, calls } = fakeRemote((requestPath, options) => {
      if (requestPath === '/api/reference') return reference;
      if (requestPath === '/api/sync/push') return acceptAll()(requestPath, options);
      return { partidas: [remotePartida()], cursor: 3, hayMas: false };
    });

    await runSync(db, request, 'token');

    expect(calls.map((call) => call.path.split('?')[0])).toEqual(['/api/reference', '/api/sync/push', '/api/sync/pull']);
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
    expect(getSyncValue(db, 'ultima_sync')).toBeTruthy();
  });

  it('un corte al sincronizar no deja la base local a medias', async () => {
    const id = baptisms.create(db, parish1, input(), undefined);
    const { request } = fakeRemote((requestPath) => {
      if (requestPath === '/api/reference') return reference;
      return offline();
    });

    await expect(runSync(db, request, 'token')).rejects.toThrow();

    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diago' });
    expect(queue()).toHaveLength(1);
    expect(getSyncValue(db, 'ultima_sync')).toBeNull();
  });
});

describe('login sin internet', () => {
  it('el verificador no contiene la contraseña y distingue la correcta', async () => {
    const verifier = await createVerifier('clave-larga');

    expect(verifier).not.toContain('clave-larga');
    expect(await matchesVerifier('clave-larga', verifier)).toBe(true);
    expect(await matchesVerifier('otra-clave', verifier)).toBe(false);
  });

  it('entra con la contraseña guardada y devuelve sus datos', async () => {
    await saveCredential(db, 1, 'clave-larga');

    expect(await verifyOffline(db, 'parroco1', 'clave-larga')).toEqual({
      ok: true,
      usuario: { id: 1, rol: 'usuario_parroquia', parroquiaId: 1, parroquiaNombre: 'Parroquia 1', nombreCompleto: 'Uno P M' },
    });
  });

  it('rechaza una contraseña incorrecta', async () => {
    await saveCredential(db, 1, 'clave-larga');

    expect(await verifyOffline(db, 'parroco1', 'incorrecta')).toEqual({ ok: false, reason: 'incorrecta' });
  });

  it('sin credencial en esta PC o usuario inexistente, pide entrar con internet', async () => {
    expect(await verifyOffline(db, 'parroco1', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
    expect(await verifyOffline(db, 'nadie', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
  });

  it('una contraseña nueva reemplaza a la anterior', async () => {
    await saveCredential(db, 1, 'clave-antigua');
    await saveCredential(db, 1, 'clave-nueva');

    expect((await verifyOffline(db, 'parroco1', 'clave-antigua')).ok).toBe(false);
    expect((await verifyOffline(db, 'parroco1', 'clave-nueva')).ok).toBe(true);
  });
});

describe('recuperación de la base local', () => {
  // Guarda la clave en texto plano: en la app real la protege Windows.
  const memoryKeys = (initial: Record<string, string> = {}): KeyStore & { store: Record<string, string> } => {
    const store = { ...initial };
    return { store, read: (file) => store[file] ?? null, write: (file, key) => { store[file] = key; } };
  };

  const rebuildHandler = (key: string | null): Handler => (requestPath) => {
    if (requestPath.includes('/api/devices/')) {
      if (key) return { clave: key };
      throw new ServiceError('No hay copia', 404);
    }
    if (requestPath === '/api/reference') return reference;
    return { partidas: [remotePartida()], cursor: 5, hayMas: false };
  };

  function seedDatabase(paths: ReturnType<typeof localPaths>, key: string) {
    const original = openLocalDatabase(paths.database, key);
    applyReferenceData(original, reference);
    baptisms.create(original, parish1, input({ nombre: 'Sin subir' }), undefined);
    original.close();
  }

  it('la primera apertura crea base y clave', () => {
    const paths = localPaths(dir);
    const keys = memoryKeys();

    const result = openOrDetect(paths, keys);

    expect(result.status).toBe('open');
    if (result.status === 'open') {
      expect(keys.store[paths.key]).toBe(result.key);
      result.db.close();
    }
  });

  it('con base pero sin clave no toca nada y pide recuperación', () => {
    const paths = localPaths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));

    expect(openOrDetect(paths, memoryKeys())).toEqual({ status: 'needs-recovery' });
    expect(existsSync(paths.database)).toBe(true);
  });

  it('con clave incorrecta o archivo dañado pide recuperación', () => {
    const paths = localPaths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));
    expect(openOrDetect(paths, memoryKeys({ [paths.key]: randomBytes(32).toString('hex') }))).toEqual({ status: 'needs-recovery' });

    writeFileSync(paths.database, randomBytes(8192));
    expect(openOrDetect(paths, memoryKeys({ [paths.key]: randomBytes(32).toString('hex') }))).toEqual({ status: 'needs-recovery' });
  });

  it('una base de una versión más nueva no se aparta: pide actualizar', () => {
    const paths = localPaths(dir);
    const key = randomBytes(32).toString('hex');
    const newer = openLocalDatabase(paths.database, key);
    newer.pragma('user_version = 9999');
    newer.close();

    const result = openOrDetect(paths, memoryKeys({ [paths.key]: key }));

    expect(result).toMatchObject({ status: 'failed' });
    expect(existsSync(paths.database)).toBe(true);
  });

  it('recupera con la copia de la clave sin perder lo no subido', async () => {
    const paths = localPaths(dir);
    const key = randomBytes(32).toString('hex');
    seedDatabase(paths, key);
    const keys = memoryKeys();

    const { db: recovered, key: usedKey } = await recoverLocalDatabase(paths, keys, fakeRemote(rebuildHandler(key)).request, 'token');

    expect(usedKey).toBe(key);
    expect(keys.store[paths.key]).toBe(key);
    expect(baptisms.search(recovered, { nombre: 'Sin subir' }).rows).toHaveLength(1);
    expect(recovered.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get()).toBe(1);
    recovered.close();
  });

  it('sin copia, aparta el archivo, reconstruye con clave nueva y avisa', async () => {
    const paths = localPaths(dir);
    const oldKey = randomBytes(32).toString('hex');
    seedDatabase(paths, oldKey);
    const keys = memoryKeys();

    const { db: rebuilt, key } = await recoverLocalDatabase(paths, keys, fakeRemote(rebuildHandler(null)).request, 'token');

    expect(key).not.toBe(oldKey);
    expect(keys.store[paths.key]).toBe(key);
    expect(readdirSync(paths.setAside).filter((name) => name.endsWith('.db'))).toHaveLength(1);
    expect(existsSync(paths.tempDatabase)).toBe(false);
    expect(baptisms.search(rebuilt, { nombre: 'Ana' }).rows).toHaveLength(1);
    expect(getSyncValue(rebuilt, 'aviso')).toBe(AVISO_RECONSTRUIDA);
    rebuilt.close();
  });

  it('si la copia tampoco abre el archivo, reconstruye', async () => {
    const paths = localPaths(dir);
    writeFileSync(paths.database, randomBytes(8192));

    const { db: rebuilt } = await recoverLocalDatabase(paths, memoryKeys(), fakeRemote(rebuildHandler(randomBytes(32).toString('hex'))).request, 'token');

    expect(baptisms.search(rebuilt, { nombre: 'Ana' }).rows).toHaveLength(1);
    rebuilt.close();
  });

  it('un corte durante la reconstrucción no toca la base anterior y luego continúa', async () => {
    const paths = localPaths(dir);
    const key = randomBytes(32).toString('hex');
    seedDatabase(paths, key);
    const keys = memoryKeys();
    const persona = remotePartida().personas[0];
    const first = remotePartida({ client_id: 'p1', personas: [{ ...persona, client_id: 'pe1' }] });
    const second = remotePartida({ client_id: 'p2', personas: [{ ...persona, client_id: 'pe2' }] });

    const cut = fakeRemote((requestPath) => {
      if (requestPath.includes('/api/devices/')) throw new ServiceError('No hay copia', 404);
      if (requestPath === '/api/reference') return reference;
      if (requestPath.endsWith('cursor=0')) return { partidas: [first], cursor: 1, hayMas: true };
      return offline();
    });
    await expect(recoverLocalDatabase(paths, keys, cut.request, 'token')).rejects.toThrow();

    // El archivo original sigue en su sitio y se abre con su clave.
    const untouched = openLocalDatabase(paths.database, key);
    expect(baptisms.search(untouched, { nombre: 'Sin subir' }).rows).toHaveLength(1);
    untouched.close();
    expect(keys.store[paths.key]).toBeUndefined();

    const resume = fakeRemote((requestPath) => {
      if (requestPath.includes('/api/devices/')) throw new ServiceError('No hay copia', 404);
      if (requestPath === '/api/reference') return reference;
      expect(requestPath).toContain('cursor=1');
      return { partidas: [second], cursor: 2, hayMas: false };
    });
    const { db: rebuilt } = await recoverLocalDatabase(paths, keys, resume.request, 'token');

    expect(rebuilt.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
    rebuilt.close();
  });

  it('sin conexión o sin permiso no aparta nada', async () => {
    const paths = localPaths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));

    await expect(recoverLocalDatabase(paths, memoryKeys(), fakeRemote(offline).request, 'token')).rejects.toThrow();
    const denied = fakeRemote(() => {
      throw new ServiceError('Esta PC pertenece a otra parroquia.', 403);
    });
    await expect(recoverLocalDatabase(paths, memoryKeys(), denied.request, 'token')).rejects.toThrow('otra parroquia');

    expect(existsSync(paths.database)).toBe(true);
    expect(existsSync(paths.setAside)).toBe(false);
  });

  it('solo conserva la última base apartada', async () => {
    const paths = localPaths(dir);
    for (let i = 0; i < 2; i += 1) {
      writeFileSync(paths.database, randomBytes(8192));
      const { db: rebuilt } = await recoverLocalDatabase(paths, memoryKeys(), fakeRemote(rebuildHandler(null)).request, 'token');
      rebuilt.close();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(readdirSync(paths.setAside).filter((name) => name.endsWith('.db'))).toHaveLength(1);
  });
});

describe('copia de la clave', () => {
  it('se sube una vez y conserva el mismo identificador de PC', async () => {
    const paths = localPaths(dir);
    const key = 'ab'.repeat(32);
    const { request, calls } = fakeRemote(() => ({ parroquiaId: 1 }));

    await uploadKeyCopy(db, paths, key, request, 'token', 1);
    await uploadKeyCopy(db, paths, key, request, 'token', 1);

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(`/api/devices/${deviceId(paths)}/key`);
    expect(calls[0].options).toMatchObject({ method: 'PUT', body: { clave: key } });
  });

  it('una PC registrada por un administrador se vuelve a enviar cuando entra una parroquia', async () => {
    const paths = localPaths(dir);
    const admin = fakeRemote(() => ({ parroquiaId: null }));
    await uploadKeyCopy(db, paths, 'ab'.repeat(32), admin.request, 'token', null);
    await uploadKeyCopy(db, paths, 'ab'.repeat(32), admin.request, 'token', null);
    expect(admin.calls).toHaveLength(1);

    const parish = fakeRemote(() => ({ parroquiaId: 1 }));
    await uploadKeyCopy(db, paths, 'ab'.repeat(32), parish.request, 'token', 1);
    await uploadKeyCopy(db, paths, 'ab'.repeat(32), parish.request, 'token', 1);
    expect(parish.calls).toHaveLength(1);
    expect(getSyncValue(db, 'clave_registrada')).toBe('parroquia');
  });

  it('si falla la subida, queda pendiente', async () => {
    const paths = localPaths(dir);
    await expect(uploadKeyCopy(db, paths, 'ab'.repeat(32), fakeRemote(offline).request, 'token', 1)).rejects.toThrow();
    expect(getSyncValue(db, 'clave_registrada')).toBeNull();
    setSyncValue(db, 'x', 'y');
    const ok = vi.fn(() => ({ parroquiaId: 1 }));
    await uploadKeyCopy(db, paths, 'ab'.repeat(32), fakeRemote(ok).request, 'token', 1);
    expect(ok).toHaveBeenCalledOnce();
  });
});
