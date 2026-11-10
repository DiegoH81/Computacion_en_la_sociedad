// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { open_local_database, type LocalDatabase, device_id, local_paths, open_or_detect, type KeyStore } from '../../electron/main/db/database';
import { REBUILT_NOTICE, recover_local_database, upload_key_copy } from '../../electron/main/sync/recovery';
import type { Session } from '../../electron/main/models/session';
import { ServiceError } from '../../electron/main/utils/errors';
import { create_verifier, matches_verifier } from '../../electron/main/utils/crypto';
import { save_credential, verify_offline } from '../../electron/main/controllers/login';
import { create_person_sacrament, read_marriage, read_person_sacrament, search_sacraments, update_person_sacrament } from '../../electron/main/controllers/sacraments';
import { baptism, change, minister, type BaptismValues } from './helpers/records';
import { create_minister, update_minister } from '../../electron/main/controllers/ministers';
import { save_reference_data, pull_changes, push_pending, read_queue_summary, resolve_conflict, run_sync } from '../../electron/main/sync/sync';
import type { RecordData } from '../../shared/sync';
import type { ReferenceData, RemoteOptions, RemoteRequest } from '../../electron/main/sync/online';
import { get_sync_value, set_sync_value } from '../../electron/main/sync/queue';
import { read_local_record } from '../../electron/main/sync/records';
import { PUSH_BATCH_SIZE } from '../../electron/main/utils/config';

const parish1: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };

const reference: ReferenceData = {
  parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
  ministros: [{ id: 7, client_id: 'ministro-1', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1, version: 3 }],
  usuarios: [
    { id: 1, parroquia_id: 1, username: 'parroco1', rol: 'admin_parroquia', nombre: 'Uno', apellido_paterno: 'P', apellido_materno: 'M', activo: 1 },
    { id: 9, parroquia_id: null, username: 'admin', rol: 'admin_general', nombre: 'Admin', apellido_paterno: 'A', apellido_materno: 'B', activo: 1 },
  ],
};

// Un bautismo de Diago Guido Alvaro, libro 1, folio 2, número 3.
const input = (values: BaptismValues = {}) =>
  baptism('bautismo', {
    ...values,
    sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '2', numero: '3', ...values.sacramento },
    persona: { nombres: 'Diago', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', ...values.persona },
  });

const remotePartida = (overrides: Partial<RecordData> = {}): RecordData => ({
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
    { client_id: 'persona-remota', dni: null, nombres: 'Ana', apellido_paterno: 'Paz', apellido_materno: 'Rey', fecha_nacimiento: null, fecha_aproximada: '5 años', lugar_nacimiento: null, padre: null, madre: null },
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
  (options.body as { cambios: { entidad: string; client_id: string; version_base: number | null; cola_id: string; datos: RecordData }[] }).cambios;

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
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  save_reference_data(db, reference);
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('subir la cola', () => {
  it('envía la partida completa, la quita de la cola y adopta la versión del servidor', async () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { ministro_id: 1 }, padrino_1: 'Pedro' }));
    const { request, calls } = fakeRemote(acceptAll(1));

    await push_pending(db, request, 'token');

    const [cambio] = pushBody(calls[0].options);
    expect(cambio).toMatchObject({ entidad: 'bautismo', version_base: null });
    expect(cambio.datos).toMatchObject({ libro: '1', ministro_client_id: 'ministro-1', detalle: { padrino_1: 'Pedro' } });
    expect(cambio.datos.personas[0]).toMatchObject({ nombres: 'Diago' });
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT version FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(1);
  });

  it('incluye las correcciones, y varias ediciones se envían como una sola', async () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, input());
    update_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { id }, persona: { cambios: [change('nombres', 'Diego')] } }));
    update_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { id }, persona: { cambios: [change('nombres', 'Diogo')] } }));
    const { request, calls } = fakeRemote(acceptAll());

    await push_pending(db, request, 'token');

    const cambios = pushBody(calls[0].options);
    expect(cambios).toHaveLength(1);
    // La persona sube con el nombre de la partida; lo corregido va en las correcciones.
    expect(cambios[0].datos.personas[0].nombres).toBe('Diago');
    expect(cambios[0].datos.cambios.map((c) => c.valor_nuevo)).toEqual(['Diego', 'Diogo']);
  });

  it('sube los ministros antes que las partidas', async () => {
    create_person_sacrament(db, 'bautismo', parish1, input());
    create_minister(db, parish1, minister({ nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz' }));
    const { request, calls } = fakeRemote(acceptAll());

    await push_pending(db, request, 'token');

    expect(pushBody(calls[0].options).map((c) => c.entidad)).toEqual(['ministro', 'bautismo']);
  });

  it('un corte no pierde nada y el reenvío usa el mismo cola_id', async () => {
    create_person_sacrament(db, 'bautismo', parish1, input());
    const cut = fakeRemote(offline);

    await expect(push_pending(db, cut.request, 'token')).rejects.toThrow();
    expect(queue()).toHaveLength(1);
    const colaId = pushBody(cut.calls[0].options)[0].cola_id;

    const retry = fakeRemote(acceptAll());
    await push_pending(db, retry.request, 'token');

    expect(pushBody(retry.calls[0].options)[0].cola_id).toBe(colaId);
    expect(queue()).toEqual([]);
  });

  it('si se edita mientras viaja, la edición sigue pendiente sobre la versión aceptada', async () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, input());
    const { request } = fakeRemote((_path, options) => {
      update_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { id }, persona: { nombres: 'Editado en vuelo' } }));
      return acceptAll(5)(_path, options);
    });

    await push_pending(db, request, 'token');

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ version_base: 5, estado: 'pendiente' });
  });

  it('un conflicto queda marcado, no bloquea a los demás y no se reintenta', async () => {
    const primero = create_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { numero: '1' } }));
    create_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { numero: '2' } }));
    const primeraPartida = db.prepare('SELECT client_id FROM sacramentos WHERE id = ?').pluck().get(primero);

    const { request } = fakeRemote((_path, options) => ({
      resultados: pushBody(options).map((c) =>
        c.client_id === primeraPartida
          ? { entidad: c.entidad, client_id: c.client_id, estado: 'conflicto', version: 8, motivo: 'Otra PC' }
          : { entidad: c.entidad, client_id: c.client_id, estado: 'aplicado', version: 1 },
      ),
    }));

    await push_pending(db, request, 'token');

    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ client_id: primeraPartida, estado: 'conflicto', motivo: 'Otra PC' });
    expect(read_queue_summary(db)).toMatchObject({ conflictos: 1, pendientes: 0 });

    const second = fakeRemote(acceptAll());
    await push_pending(db, second.request, 'token');
    expect(second.calls).toEqual([]);
  });

  it('un rechazo queda marcado con su motivo y se reintenta', async () => {
    create_person_sacrament(db, 'bautismo', parish1, input());
    const { request } = fakeRemote((_path, options) => ({
      resultados: pushBody(options).map((c) => ({ entidad: c.entidad, client_id: c.client_id, estado: 'rechazado', motivo: 'Sin permiso' })),
    }));

    await push_pending(db, request, 'token');
    expect(read_queue_summary(db)).toMatchObject({ rechazados: 1, items: [{ motivo: 'Sin permiso' }] });

    const retry = fakeRemote(acceptAll());
    await push_pending(db, retry.request, 'token');
    expect(queue()).toEqual([]);
  });

  it('envía en lotes de PUSH_BATCH_SIZE', async () => {
    for (let i = 0; i <= PUSH_BATCH_SIZE; i += 1) create_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { numero: String(i) } }));
    const { request, calls } = fakeRemote(acceptAll());

    await push_pending(db, request, 'token');

    expect(calls.map((call) => pushBody(call.options).length)).toEqual([PUSH_BATCH_SIZE, 1]);
  });
});

describe('descargar cambios', () => {
  const page = (partidas: RecordData[], cursor: number, hayMas = false) => ({ partidas, cursor, hayMas });

  it('guarda una partida de otra PC, sin anotarla en la cola, y es visible en la búsqueda', async () => {
    const { request } = fakeRemote(() => page([remotePartida()], 10));

    await pull_changes(db, request, 'token');

    expect(queue()).toEqual([]);
    expect(get_sync_value(db, 'cursor')).toBe('10');
    const row = db.prepare('SELECT version, parroquia_id FROM sacramentos WHERE client_id = ?').get('remota-1');
    expect(row).toEqual({ version: 4, parroquia_id: 1 });
    expect(search_sacraments(db, 'bautismo', { nombres: 'Ana' }).resultados).toHaveLength(1);
  });

  it('actualiza con la versión exacta del servidor, aunque coincida con la de la persona', async () => {
    const first = fakeRemote(() => page([remotePartida()], 1));
    await pull_changes(db, first.request, 'token');

    const edited = remotePartida({
      version: 5,
      libro: 'Nuevo',
      cambios: [
        { client_id: 'c1', persona_client_id: 'persona-remota', usuario_id: 1, campo_cambio: 'nombres', valor_anterior: 'Ana', valor_nuevo: 'Anita', fecha_cambio: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const second = fakeRemote(() => page([edited], 2));
    await pull_changes(db, second.request, 'token');

    expect(db.prepare('SELECT libro, version FROM sacramentos').get()).toEqual({ libro: 'Nuevo', version: 5 });
    expect(queue()).toEqual([]);
    // La corrección también llega: se encuentra por el nombre de la partida y por el corregido.
    expect(search_sacraments(db, 'bautismo', { nombres: 'Ana' }).resultados).toHaveLength(1);
    expect(search_sacraments(db, 'bautismo', { nombres: 'Anita' }).resultados).toHaveLength(1);
  });

  it('no pisa una partida con cambios sin subir', async () => {
    const first = fakeRemote(() => page([remotePartida()], 1));
    await pull_changes(db, first.request, 'token');
    const id = db.prepare('SELECT id FROM sacramentos').pluck().get() as number;
    update_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { id }, persona: { nombres: 'Local' } }));

    const second = fakeRemote(() => page([remotePartida({ version: 9, libro: 'Servidor' })], 2));
    await pull_changes(db, second.request, 'token');

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

    await pull_changes(db, request, 'token');

    const id = db.prepare('SELECT id FROM sacramentos').pluck().get() as number;
    expect(read_marriage(db, id)).toMatchObject({ conyuge_1: { nombres: 'Ana' }, conyuge_2: { nombres: 'Maria' }, lugar: 'Puno', testigo_1: 'Luz' });
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

    await pull_changes(db, request, 'token');

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

    await expect(pull_changes(db, cut.request, 'token')).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(1);
    expect(get_sync_value(db, 'cursor')).toBe('1');

    const resume = fakeRemote(() => page([two], 2));
    await pull_changes(db, resume.request, 'token');

    expect(resume.calls[0].path).toContain('cursor=1');
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
  });

  it('un fallo a mitad de una página revierte la página entera y no avanza el cursor', async () => {
    const good = remotePartida({ client_id: 'p1', personas: [{ ...remotePartida().personas[0], client_id: 'pe1' }] });
    const bad = remotePartida({ client_id: 'p2', libro: null as unknown as string, personas: [{ ...remotePartida().personas[0], client_id: 'pe2' }] });
    const { request } = fakeRemote(() => page([good, bad], 2));

    await expect(pull_changes(db, request, 'token')).rejects.toThrow();

    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(0);
    expect(db.prepare('SELECT COUNT(*) FROM personas').pluck().get()).toBe(0);
    expect(get_sync_value(db, 'cursor')).toBeNull();
  });
});

describe('datos de referencia', () => {
  it('actualiza un ministro cambiado en el servidor, pero no uno con cambios sin subir', () => {
    save_reference_data(db, { ...reference, ministros: [{ ...reference.ministros[0], nombre: 'Manolo', version: 4 }] });
    expect(db.prepare('SELECT nombre, version FROM ministros').get()).toEqual({ nombre: 'Manolo', version: 4 });

    const id = db.prepare('SELECT id FROM ministros').pluck().get() as number;
    update_minister(db, parish1, minister({ id, nombre: 'Local', apellido_paterno: 'T', apellido_materno: 'R' }));

    save_reference_data(db, { ...reference, ministros: [{ ...reference.ministros[0], nombre: 'Servidor', version: 5 }] });
    expect(db.prepare('SELECT nombre FROM ministros').pluck().get()).toBe('Local');
  });

  it('resuelve solo los ministros que la migración anotó sin haber cambiado', () => {
    db.prepare(`INSERT INTO sync_cola (entidad, client_id, cola_id) VALUES ('ministro', 'ministro-1', 'x')`).run();

    save_reference_data(db, reference);

    expect(queue()).toEqual([]);
  });

  it('una cuenta desactivada pierde su credencial local', async () => {
    await save_credential(db, 1, 'clave-larga');

    save_reference_data(db, { ...reference, usuarios: [{ ...reference.usuarios[0], activo: 0 }] });

    expect(await verify_offline(db, 'parroco1', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
  });

  it('nombres de usuario intercambiados entre cuentas no rompen la descarga', () => {
    const [a, b] = reference.usuarios;
    save_reference_data(db, { ...reference, usuarios: [{ ...a, username: b.username }, { ...b, username: a.username }] });

    expect(db.prepare('SELECT username FROM usuarios ORDER BY id').pluck().all()).toEqual(['admin', 'parroco1']);
  });
});

describe('conflictos', () => {
  async function conflicted() {
    const id = create_person_sacrament(db, 'bautismo', parish1, input());
    const clientId = db.prepare('SELECT client_id FROM sacramentos WHERE id = ?').pluck().get(id) as string;
    update_person_sacrament(db, 'bautismo', parish1, input({ sacramento: { id }, persona: { nombres: 'Diego local' } }));
    db.prepare(`UPDATE sync_cola SET estado = 'conflicto', motivo = 'x'`).run();
    const server = { ...read_local_record(db, clientId), version: 7, libro: 'Del servidor', personas: [{ ...read_local_record(db, clientId).personas[0], nombres: 'Diego servidor' }], cambios: [] };
    return { id, clientId, server };
  }

  it('"servidor" descarta lo local y sus correcciones sin subir', async () => {
    const { id, clientId, server } = await conflicted();
    const { request } = fakeRemote(() => ({ registro: server }));

    await resolve_conflict(db, request, 'token', 'bautismo', clientId, 'servidor');

    expect(read_person_sacrament(db, 'bautismo', id)).toMatchObject({ sacramento: { libro: 'Del servidor' }, persona: { nombres: 'Diego servidor' } });
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) FROM cambios_persona').pluck().get()).toBe(0);
    expect(db.prepare('SELECT version FROM sacramentos').pluck().get()).toBe(7);
  });

  it('"local" conserva lo local y lo deja listo para subir sobre la versión del servidor', async () => {
    const { id, clientId, server } = await conflicted();
    const { request } = fakeRemote(() => ({ registro: server }));

    await resolve_conflict(db, request, 'token', 'bautismo', clientId, 'local');

    expect(read_person_sacrament(db, 'bautismo', id).persona.nombres).toBe('Diego local');
    expect(queue()[0]).toMatchObject({ estado: 'pendiente', version_base: 7, motivo: null });
  });
});

describe('sincronización completa', () => {
  it('descarga referencia, sube y baja, y anota la hora', async () => {
    create_person_sacrament(db, 'bautismo', parish1, input());
    const { request, calls } = fakeRemote((requestPath, options) => {
      if (requestPath === '/api/reference') return reference;
      if (requestPath === '/api/sync/push') return acceptAll()(requestPath, options);
      return { partidas: [remotePartida()], cursor: 3, hayMas: false };
    });

    await run_sync(db, request, 'token');

    expect(calls.map((call) => call.path.split('?')[0])).toEqual(['/api/reference', '/api/sync/push', '/api/sync/pull']);
    expect(queue()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
    expect(get_sync_value(db, 'ultima_sync')).toBeTruthy();
  });

  it('un corte al sincronizar no deja la base local a medias', async () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, input());
    const { request } = fakeRemote((requestPath) => {
      if (requestPath === '/api/reference') return reference;
      return offline();
    });

    await expect(run_sync(db, request, 'token')).rejects.toThrow();

    expect(read_person_sacrament(db, 'bautismo', id).persona.nombres).toBe('Diago');
    expect(queue()).toHaveLength(1);
    expect(get_sync_value(db, 'ultima_sync')).toBeNull();
  });
});

describe('login sin internet', () => {
  it('el verificador no contiene la contraseña y distingue la correcta', async () => {
    const verifier = await create_verifier('clave-larga');

    expect(verifier).not.toContain('clave-larga');
    expect(await matches_verifier('clave-larga', verifier)).toBe(true);
    expect(await matches_verifier('otra-clave', verifier)).toBe(false);
  });

  it('entra con la contraseña guardada y devuelve sus datos', async () => {
    await save_credential(db, 1, 'clave-larga');

    expect(await verify_offline(db, 'parroco1', 'clave-larga')).toEqual({
      ok: true,
      usuario: {
        id: 1,
        rol: 'admin_parroquia',
        parroquia_id: 1,
        parroquia_nombre: 'Parroquia 1',
        nombre_completo: 'Uno P M',
        parroquias: [{ id: 1, nombre: 'Parroquia 1', rol: 'admin_parroquia' }],
      },
    });
  });

  it('rechaza una contraseña incorrecta', async () => {
    await save_credential(db, 1, 'clave-larga');

    expect(await verify_offline(db, 'parroco1', 'incorrecta')).toEqual({ ok: false, reason: 'incorrecta' });
  });

  it('sin credencial en esta PC o usuario inexistente, pide entrar con internet', async () => {
    expect(await verify_offline(db, 'parroco1', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
    expect(await verify_offline(db, 'nadie', 'clave-larga')).toEqual({ ok: false, reason: 'sin-credencial' });
  });

  it('una contraseña nueva reemplaza a la anterior', async () => {
    await save_credential(db, 1, 'clave-antigua');
    await save_credential(db, 1, 'clave-nueva');

    expect((await verify_offline(db, 'parroco1', 'clave-antigua')).ok).toBe(false);
    expect((await verify_offline(db, 'parroco1', 'clave-nueva')).ok).toBe(true);
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

  function seedDatabase(paths: ReturnType<typeof local_paths>, key: string) {
    const original = open_local_database(paths.database, key);
    save_reference_data(original, reference);
    create_person_sacrament(original, 'bautismo', parish1, input({ persona: { nombres: 'Sin subir' } }));
    original.close();
  }

  it('la primera apertura crea base y clave', () => {
    const paths = local_paths(dir);
    const keys = memoryKeys();

    const result = open_or_detect(paths, keys);

    expect(result.status).toBe('open');
    if (result.status === 'open') {
      expect(keys.store[paths.key]).toBe(result.key);
      result.db.close();
    }
  });

  it('con base pero sin clave no toca nada y pide recuperación', () => {
    const paths = local_paths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));

    expect(open_or_detect(paths, memoryKeys())).toEqual({ status: 'needs-recovery' });
    expect(existsSync(paths.database)).toBe(true);
  });

  it('con clave incorrecta o archivo dañado pide recuperación', () => {
    const paths = local_paths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));
    expect(open_or_detect(paths, memoryKeys({ [paths.key]: randomBytes(32).toString('hex') }))).toEqual({ status: 'needs-recovery' });

    writeFileSync(paths.database, randomBytes(8192));
    expect(open_or_detect(paths, memoryKeys({ [paths.key]: randomBytes(32).toString('hex') }))).toEqual({ status: 'needs-recovery' });
  });

  it('una base de una versión más nueva no se aparta: pide actualizar', () => {
    const paths = local_paths(dir);
    const key = randomBytes(32).toString('hex');
    const newer = open_local_database(paths.database, key);
    newer.pragma('user_version = 9999');
    newer.close();

    const result = open_or_detect(paths, memoryKeys({ [paths.key]: key }));

    expect(result).toMatchObject({ status: 'failed' });
    expect(existsSync(paths.database)).toBe(true);
  });

  it('recupera con la copia de la clave sin perder lo no subido', async () => {
    const paths = local_paths(dir);
    const key = randomBytes(32).toString('hex');
    seedDatabase(paths, key);
    const keys = memoryKeys();

    const { db: recovered, key: usedKey } = await recover_local_database(paths, keys, fakeRemote(rebuildHandler(key)).request, 'token');

    expect(usedKey).toBe(key);
    expect(keys.store[paths.key]).toBe(key);
    expect(search_sacraments(recovered, 'bautismo', { nombres: 'Sin subir' }).resultados).toHaveLength(1);
    expect(recovered.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get()).toBe(1);
    recovered.close();
  });

  it('sin copia, aparta el archivo, reconstruye con clave nueva y avisa', async () => {
    const paths = local_paths(dir);
    const oldKey = randomBytes(32).toString('hex');
    seedDatabase(paths, oldKey);
    const keys = memoryKeys();

    const { db: rebuilt, key } = await recover_local_database(paths, keys, fakeRemote(rebuildHandler(null)).request, 'token');

    expect(key).not.toBe(oldKey);
    expect(keys.store[paths.key]).toBe(key);
    expect(readdirSync(paths.set_aside_folder).filter((name) => name.endsWith('.db'))).toHaveLength(1);
    expect(existsSync(paths.temp_database)).toBe(false);
    expect(search_sacraments(rebuilt, 'bautismo', { nombres: 'Ana' }).resultados).toHaveLength(1);
    expect(get_sync_value(rebuilt, 'aviso')).toBe(REBUILT_NOTICE);
    rebuilt.close();
  });

  it('si la copia tampoco abre el archivo, reconstruye', async () => {
    const paths = local_paths(dir);
    writeFileSync(paths.database, randomBytes(8192));

    const { db: rebuilt } = await recover_local_database(paths, memoryKeys(), fakeRemote(rebuildHandler(randomBytes(32).toString('hex'))).request, 'token');

    expect(search_sacraments(rebuilt, 'bautismo', { nombres: 'Ana' }).resultados).toHaveLength(1);
    rebuilt.close();
  });

  it('un corte durante la reconstrucción no toca la base anterior y luego continúa', async () => {
    const paths = local_paths(dir);
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
    await expect(recover_local_database(paths, keys, cut.request, 'token')).rejects.toThrow();

    // El archivo original sigue en su sitio y se abre con su clave.
    const untouched = open_local_database(paths.database, key);
    expect(search_sacraments(untouched, 'bautismo', { nombres: 'Sin subir' }).resultados).toHaveLength(1);
    untouched.close();
    expect(keys.store[paths.key]).toBeUndefined();

    const resume = fakeRemote((requestPath) => {
      if (requestPath.includes('/api/devices/')) throw new ServiceError('No hay copia', 404);
      if (requestPath === '/api/reference') return reference;
      expect(requestPath).toContain('cursor=1');
      return { partidas: [second], cursor: 2, hayMas: false };
    });
    const { db: rebuilt } = await recover_local_database(paths, keys, resume.request, 'token');

    expect(rebuilt.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
    rebuilt.close();
  });

  it('sin conexión o sin permiso no aparta nada', async () => {
    const paths = local_paths(dir);
    seedDatabase(paths, randomBytes(32).toString('hex'));

    await expect(recover_local_database(paths, memoryKeys(), fakeRemote(offline).request, 'token')).rejects.toThrow();
    const denied = fakeRemote(() => {
      throw new ServiceError('Esta PC pertenece a otra parroquia.', 403);
    });
    await expect(recover_local_database(paths, memoryKeys(), denied.request, 'token')).rejects.toThrow('otra parroquia');

    expect(existsSync(paths.database)).toBe(true);
    expect(existsSync(paths.set_aside_folder)).toBe(false);
  });

  it('solo conserva la última base apartada', async () => {
    const paths = local_paths(dir);
    for (let i = 0; i < 2; i += 1) {
      writeFileSync(paths.database, randomBytes(8192));
      const { db: rebuilt } = await recover_local_database(paths, memoryKeys(), fakeRemote(rebuildHandler(null)).request, 'token');
      rebuilt.close();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(readdirSync(paths.set_aside_folder).filter((name) => name.endsWith('.db'))).toHaveLength(1);
  });
});

describe('copia de la clave', () => {
  it('se sube una vez y conserva el mismo identificador de PC', async () => {
    const paths = local_paths(dir);
    const key = 'ab'.repeat(32);
    const { request, calls } = fakeRemote(() => ({ parroquiaId: 1 }));

    await upload_key_copy(db, paths, key, request, 'token', 1);
    await upload_key_copy(db, paths, key, request, 'token', 1);

    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(`/api/devices/${device_id(paths)}/key`);
    expect(calls[0].options).toMatchObject({ method: 'PUT', body: { clave: key } });
  });

  it('una PC registrada por un administrador se vuelve a enviar cuando entra una parroquia', async () => {
    const paths = local_paths(dir);
    const admin = fakeRemote(() => ({ parroquiaId: null }));
    await upload_key_copy(db, paths, 'ab'.repeat(32), admin.request, 'token', null);
    await upload_key_copy(db, paths, 'ab'.repeat(32), admin.request, 'token', null);
    expect(admin.calls).toHaveLength(1);

    const parish = fakeRemote(() => ({ parroquiaId: 1 }));
    await upload_key_copy(db, paths, 'ab'.repeat(32), parish.request, 'token', 1);
    await upload_key_copy(db, paths, 'ab'.repeat(32), parish.request, 'token', 1);
    expect(parish.calls).toHaveLength(1);
    expect(get_sync_value(db, 'clave_registrada')).toBe('parroquia');
  });

  it('si falla la subida, queda pendiente', async () => {
    const paths = local_paths(dir);
    await expect(upload_key_copy(db, paths, 'ab'.repeat(32), fakeRemote(offline).request, 'token', 1)).rejects.toThrow();
    expect(get_sync_value(db, 'clave_registrada')).toBeNull();
    set_sync_value(db, 'x', 'y');
    const ok = vi.fn(() => ({ parroquiaId: 1 }));
    await upload_key_copy(db, paths, 'ab'.repeat(32), fakeRemote(ok).request, 'token', 1);
    expect(ok).toHaveBeenCalledOnce();
  });
});
