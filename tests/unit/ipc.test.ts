// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError, type Session } from '../../electron/main/common';
import { open_local_database, type LocalDatabase } from '../../electron/main/database/local_database';
import { save_reference_data } from '../../electron/main/records/parishes';
import type { LocalResponse } from '../../electron/shared';

// La pantalla habla con la base local por un único canal IPC. Estas pruebas llaman a ese canal
// como lo haría la pantalla, y revisan la forma de cada respuesta.

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  user_data: '',
  handler: null as null | ((event: unknown, method: string, payload?: unknown) => Promise<unknown>),
  sync_now: null as unknown,
}));

vi.mock('electron', () => ({
  app: { getPath: () => state.user_data },
  ipcMain: {
    handle: (_channel: string, handler: typeof state.handler) => {
      state.handler = handler;
    },
  },
  safeStorage: {},
}));

vi.mock('../../electron/main/database/local_store', () => ({
  get_database: () => state.db,
}));

vi.mock('../../electron/main/session/session', async () => {
  const { ServiceError } = await import('../../electron/main/common');
  const sync_now = vi.fn(async () => undefined);
  state.sync_now = sync_now;
  return {
    require_session: () => {
      if (!state.session) throw new ServiceError('Sesión no válida.', 401);
      return state.session;
    },
    login: vi.fn(async () => ({ token: 't', usuario: { id: 1 } })),
    logout: vi.fn(),
    sync_now: sync_now,
    get_sync_status: () => ({ pendientes: 0, modo: 'en-linea' }),
    resolve_sync_conflict: vi.fn(async () => undefined),
    dismiss_sync_notice: vi.fn(),
  };
});

const { register_local_ipc } = await import('../../electron/main/ipc');
register_local_ipc();

const parish1: Session = { user_id: 1, role: 'usuario_parroquia', parish_id: 1, token: 't' };
const parish2: Session = { user_id: 2, role: 'usuario_parroquia', parish_id: 2, token: 't' };
const admin: Session = { user_id: 3, role: 'admin', parish_id: null, token: 't' };

let dir: string;
let db: LocalDatabase;

async function call(method: string, payload?: unknown): Promise<LocalResponse> {
  return (await state.handler!(null, method, payload)) as LocalResponse;
}

async function data<T = Record<string, unknown>>(method: string, payload?: unknown): Promise<T> {
  const response = await call(method, payload);
  if (!response.ok) throw new Error(`${method} falló: ${response.message} (${response.status})`);
  return response.data as T;
}

const header = { fechaSacramento: '2020-02-02', numeroLibro: '1', numeroFolio: '2', numeroRegistro: '3' };
const person = { nombre: 'Ana', apellidoPaterno: 'Rojas', apellidoMaterno: 'Paz' };

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-ipc-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number | null, rol: string) => ({
    id,
    parroquia_id,
    username: `user${id}`,
    rol,
    nombre: 'U',
    apellido_paterno: 'P',
    apellido_materno: 'M',
    activo: 1,
  });
  save_reference_data(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [],
    usuarios: [user(1, 1, 'usuario_parroquia'), user(2, 2, 'usuario_parroquia'), user(3, null, 'admin')],
  });
  state.db = db;
  state.session = parish1;
  state.user_data = dir;
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('canal IPC de la base local', () => {
  it('una operación desconocida responde 404', async () => {
    expect(await call('no.existe')).toEqual({ ok: false, message: 'Operación no reconocida.', status: 404 });
    // No se confunde con propiedades heredadas de los objetos.
    expect(await call('toString')).toMatchObject({ ok: false, status: 404 });
  });

  it('sin sesión, las operaciones de datos responden 401', async () => {
    state.session = null;
    for (const method of ['baptisms.search', 'marriages.search', 'ministers.search', 'parishes.list', 'statistics.get']) {
      expect(await call(method, { parroquiaId: 1 })).toEqual({ ok: false, message: 'Sesión no válida.', status: 401 });
    }
  });

  it('un error inesperado no expone detalles y responde 500', async () => {
    state.db = { prepare: () => { throw new Error('detalle interno'); } };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await call('parishes.list')).toEqual({ ok: false, message: 'Ocurrió un error inesperado.', status: 500 });
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('un ServiceError llega con su mensaje y su código', async () => {
    state.db = { prepare: () => { throw new ServiceError('La base local no está disponible.', 503); } };
    expect(await call('parishes.list')).toEqual({ ok: false, message: 'La base local no está disponible.', status: 503 });
  });

  it('bautismos: crear, buscar, ver, editar y anular con la forma que espera la pantalla', async () => {
    const { id } = await data<{ id: number }>('baptisms.create', { values: { ...header, ...person, fechaBautizo: '2020-01-01', padrino: 'Luis' } });
    expect(id).toBeGreaterThan(0);

    const found = await data<{ baptisms: { id: number; nombre: string }[]; totalPages: number }>('baptisms.search', { nombre: 'Ana' });
    expect(found.totalPages).toBe(1);
    expect(found.baptisms.map((row) => row.id)).toEqual([id]);

    const { baptism } = await data<{ baptism: Record<string, unknown> }>('baptisms.get', { id });
    expect(baptism).toMatchObject({ nombre: 'Ana', padrino: 'Luis', fecha_bautizo: '2020-01-01', correcciones: [] });

    expect(await data('baptisms.update', { id, values: { ...header, ...person, padrino: 'Pedro' } })).toEqual({ success: true });
    expect((await data<{ baptism: { padrino: string } }>('baptisms.get', { id })).baptism.padrino).toBe('Pedro');

    expect(await data('baptisms.annul', { id, motivo: 'Duplicada' })).toEqual({ success: true });
    expect((await data<{ baptism: { estado: string } }>('baptisms.get', { id })).baptism.estado).toBe('anulado');
  });

  it('confirmaciones: usan su propia tabla y su propio nombre de fecha', async () => {
    const { id } = await data<{ id: number }>('confirmations.create', { values: { ...header, ...person, fechaConfirmacion: '2021-05-05' } });

    const { confirmation } = await data<{ confirmation: Record<string, unknown> }>('confirmations.get', { id });
    expect(confirmation.fecha_confirmacion).toBe('2021-05-05');

    expect((await data<{ confirmations: unknown[] }>('confirmations.search', {})).confirmations).toHaveLength(1);
    expect((await data<{ baptisms: unknown[] }>('baptisms.search', {})).baptisms).toHaveLength(0);

    // Una confirmación no se puede abrir como bautismo.
    expect(await call('baptisms.get', { id })).toEqual({ ok: false, message: 'Partida no encontrada.', status: 404 });
    expect(await call('baptisms.annul', { id, motivo: 'x' })).toMatchObject({ ok: false, status: 404 });

    expect(await data('confirmations.update', { id, values: { ...header, ...person, fechaConfirmacion: '2021-06-06' } })).toEqual({ success: true });
    expect(await data('confirmations.annul', { id, motivo: 'Error' })).toEqual({ success: true });
  });

  it('matrimonios: crear, buscar por cualquiera de los cónyuges, ver, editar y anular', async () => {
    const values = {
      ...header,
      esposo: { nombre: 'Juan', apellidoPaterno: 'Quispe', apellidoMaterno: 'Mamani' },
      esposa: { nombre: 'Rosa', apellidoPaterno: 'Flores', apellidoMaterno: 'Huaman' },
      lugarMatrimonio: 'Templo',
    };
    const { id } = await data<{ id: number }>('marriages.create', { values });

    expect((await data<{ marriages: { id: number }[] }>('marriages.search', { nombre: 'Rosa' })).marriages.map((row) => row.id)).toEqual([id]);
    expect((await data<{ marriages: unknown[] }>('marriages.search', { apellidoPaterno: 'Quispe' })).marriages).toHaveLength(1);

    const { marriage } = await data<{ marriage: Record<string, unknown> }>('marriages.get', { id });
    expect(marriage).toMatchObject({ esposo_nombre: 'Juan', esposa_nombre: 'Rosa', lugar_matrimonio: 'Templo' });

    expect(await data('marriages.update', { id, values: { ...values, testigo1: 'Testigo' } })).toEqual({ success: true });
    expect((await data<{ marriage: { testigo_1: string } }>('marriages.get', { id })).marriage.testigo_1).toBe('Testigo');
    expect(await data('marriages.annul', { id, motivo: 'Error' })).toEqual({ success: true });
  });

  it('un id que no es un entero positivo responde "no encontrado"', async () => {
    for (const id of [0, -1, 1.5, '1', null, undefined]) {
      expect(await call('baptisms.get', { id })).toEqual({ ok: false, message: 'Partida no encontrada.', status: 404 });
      expect(await call('ministers.update', { id, values: {} })).toEqual({ ok: false, message: 'Ministro no encontrado.', status: 404 });
    }
  });

  it('ministros: crear, buscar, editar y deshabilitar', async () => {
    const { id } = await data<{ id: number }>('ministers.create', { values: { titulo: 'Pbro.', nombre: 'Luis', apellidoPaterno: 'Paz', apellidoMaterno: 'Vega' } });

    const found = await data<{ priests: { id: number; activo: number }[]; totalPages: number }>('ministers.search', { nombre: 'Luis' });
    expect(found.priests.map((row) => row.id)).toEqual([id]);

    expect(await data('ministers.update', { id, values: { nombre: 'Luis', apellidoPaterno: 'Paz', apellidoMaterno: 'Soto' } })).toEqual({ success: true });
    expect(await data('ministers.toggleActive', { id })).toEqual({ success: true });
    expect((await data<{ priests: { activo: number }[] }>('ministers.search', {})).priests[0].activo).toBe(0);
  });

  it('un usuario no puede modificar partidas ni ministros de otra parroquia', async () => {
    const { id } = await data<{ id: number }>('baptisms.create', { values: { ...header, ...person } });
    const minister = await data<{ id: number }>('ministers.create', { values: { nombre: 'Luis', apellidoPaterno: 'Paz', apellidoMaterno: 'Vega' } });

    state.session = parish2;
    expect(await call('baptisms.update', { id, values: { ...header, ...person } })).toMatchObject({ ok: false, status: 403 });
    expect(await call('baptisms.annul', { id, motivo: 'x' })).toMatchObject({ ok: false, status: 403 });
    expect(await call('ministers.toggleActive', { id: minister.id })).toMatchObject({ ok: false, status: 403 });
    expect(await call('parishes.saveLogo', { id: 1, logo: null })).toMatchObject({ ok: false, status: 403 });
  });

  it('un admin tiene que elegir la parroquia al crear', async () => {
    state.session = admin;
    expect(await call('baptisms.create', { values: { ...header, ...person } })).toEqual({ ok: false, message: 'Debe especificar la parroquia.', status: 400 });

    const { id } = await data<{ id: number }>('baptisms.create', { values: { ...header, ...person }, parroquiaId: 2 });
    const { baptism } = await data<{ baptism: { parroquia_id: number } }>('baptisms.get', { id });
    expect(baptism.parroquia_id).toBe(2);
  });

  it('parroquias, logo, índice, estadísticas y duplicados', async () => {
    expect(await data('parishes.list')).toEqual({ parishes: [{ id: 1, nombre: 'Parroquia 1' }, { id: 2, nombre: 'Parroquia 2' }] });

    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await data('parishes.saveLogo', { id: 1, logo })).toEqual({ success: true });
    expect(await data('parishes.logo', { id: 1 })).toEqual({ logo });

    await data('baptisms.create', { values: { ...header, ...person, fechaBautizo: '2020-03-03' } });

    expect(await data('sacramentIndex.books', { tipo: 'bautismo', parroquiaId: 1 })).toEqual({ libros: ['1'] });
    const index = await data<{ entries: { nombres: string }[] }>('sacramentIndex.entries', { tipo: 'bautismo', parroquiaId: 1, libro: null });
    expect(index.entries.map((entry) => entry.nombres)).toEqual(['Ana']);

    const stats = await data<{ anio: number; totales: { bautismo: { anio: number } } }>('statistics.get', { parroquiaId: 1, anio: 2020 });
    expect(stats.anio).toBe(2020);
    expect(stats.totales.bautismo.anio).toBe(1);

    const duplicates = await data<{ matches: { nivel: string }[]; total: number }>('sacraments.findDuplicates', {
      tipo: 'bautismo',
      personas: [{ nombre: 'Ana', apellidoPaterno: 'Rojas', apellidoMaterno: 'Paz' }],
    });
    expect(duplicates.total).toBe(1);
  });

  it('sesión y sincronización', async () => {
    expect(await data('auth.logout')).toEqual({ success: true });
    expect(await data('sync.status')).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(await data('sync.run')).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(state.sync_now).toHaveBeenCalled();
    expect(await data('sync.resolve', { entidad: 'bautismo', clientId: 'x', choice: 'local' })).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(await data('sync.dismissNotice')).toEqual({ success: true });

    state.session = null;
    expect(await call('sync.run')).toEqual({ ok: false, message: 'Sesión no válida.', status: 401 });
  });
});
