// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../electron/main/models/session';
import { ServiceError } from '../../electron/main/utils/errors';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { save_reference_data } from '../../electron/main/sync/sync';
import type { LocalResponse } from '../../electron/shared';
import type { Baptism, Marriage, Minister, SearchPage } from '../../shared/models';
import { baptism, marriage, minister, type BaptismValues } from './helpers/records';

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

vi.mock('../../electron/main/db/app_database', () => ({
  get_database: () => state.db,
}));

vi.mock('../../electron/main/models/session', async () => {
  const { ServiceError } = await import('../../electron/main/utils/errors');
  return {
    require_session: () => {
      if (!state.session) throw new ServiceError('Sesión no válida.', 401);
      return state.session;
    },
    end_session: vi.fn(),
  };
});

vi.mock('../../electron/main/sync/auto_sync', () => {
  const sync_now = vi.fn(async () => undefined);
  state.sync_now = sync_now;
  return {
    sync_now: sync_now,
    get_sync_status: () => ({ pendientes: 0, modo: 'en-linea' }),
    resolve_sync_conflict: vi.fn(async () => undefined),
    dismiss_sync_notice: vi.fn(),
    stop_auto_sync: vi.fn(),
    reset_sync_status: vi.fn(),
  };
});

const { register_routes } = await import('../../electron/main/app');
register_routes();

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

// La partida de Ana Rojas Paz, libro 1, folio 2, número 3, tal como la manda el formulario.
const REGISTRO = { fecha_emision: '2020-02-02', libro: '1', folio: '2', numero: '3' };
const ANA = { nombres: 'Ana', apellido_paterno: 'Rojas', apellido_materno: 'Paz' };
const partida = (tipo: 'bautismo' | 'confirmacion', values: BaptismValues = {}) =>
  baptism(tipo, { ...values, sacramento: { ...REGISTRO, ...values.sacramento }, persona: { ...ANA, ...values.persona } });

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-ipc-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number | null, rol: 'admin' | 'usuario_parroquia') => ({
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
    for (const method of ['sacraments.search', 'sacraments.get', 'ministers.search', 'parishes.list', 'statistics.get']) {
      expect(await call(method, { tipo: 'bautismo', parroquia_id: 1 })).toEqual({ ok: false, message: 'Sesión no válida.', status: 401 });
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

  it('bautismos: crear, buscar, ver, editar y anular con el mismo model', async () => {
    const { id } = await data<{ id: number }>('sacraments.create', partida('bautismo', { sacramento: { fecha_evento: '2020-01-01' }, padrino_1: 'Luis' }));
    expect(id).toBeGreaterThan(0);

    const found = await data<SearchPage<Baptism>>('sacraments.search', { tipo: 'bautismo', nombres: 'Ana' });
    expect(found.total_paginas).toBe(1);
    expect(found.resultados.map((record) => record.sacramento.id)).toEqual([id]);

    const record = await data<Baptism>('sacraments.get', { id });
    expect(record).toMatchObject({
      sacramento: { id, tipo: 'bautismo', fecha_evento: '2020-01-01', parroquia: { nombre: 'Parroquia 1' } },
      persona: { nombres: 'Ana', cambios: [] },
      padrino_1: 'Luis',
    });
    // La búsqueda trae la misma partida completa que la ficha.
    expect(found.resultados[0]).toEqual(record);

    // Lo que se lee se puede volver a guardar tal cual, cambiando solo lo que se edita.
    expect(await data('sacraments.update', { ...record, padrino_1: 'Pedro' })).toEqual({ success: true });
    expect((await data<Baptism>('sacraments.get', { id })).padrino_1).toBe('Pedro');

    expect(await data('sacraments.annul', { id, motivo_anulacion: 'Duplicada' })).toEqual({ success: true });
    expect((await data<Baptism>('sacraments.get', { id })).sacramento.estado).toBe('anulado');
  });

  it('confirmaciones: usan su propia tabla', async () => {
    const { id } = await data<{ id: number }>('sacraments.create', partida('confirmacion', { sacramento: { fecha_evento: '2021-05-05' } }));

    expect((await data<Baptism>('sacraments.get', { id })).sacramento).toMatchObject({ tipo: 'confirmacion', fecha_evento: '2021-05-05' });

    expect((await data<SearchPage<Baptism>>('sacraments.search', { tipo: 'confirmacion' })).resultados).toHaveLength(1);
    expect((await data<SearchPage<Baptism>>('sacraments.search', { tipo: 'bautismo' })).resultados).toHaveLength(0);

    // Una confirmación no se puede guardar como bautismo.
    expect(await call('sacraments.update', partida('bautismo', { sacramento: { id } }))).toEqual({ ok: false, message: 'Partida no encontrada.', status: 404 });

    expect(await data('sacraments.update', partida('confirmacion', { sacramento: { id, fecha_evento: '2021-06-06' } }))).toEqual({ success: true });
    expect(await data('sacraments.annul', { id, motivo_anulacion: 'Error' })).toEqual({ success: true });
  });

  it('matrimonios: crear, buscar por cualquiera de los cónyuges, ver, editar y anular', async () => {
    const values = marriage({
      sacramento: REGISTRO,
      conyuge_1: { nombres: 'Juan', apellido_paterno: 'Quispe', apellido_materno: 'Mamani' },
      conyuge_2: { nombres: 'Rosa', apellido_paterno: 'Flores', apellido_materno: 'Huaman' },
      lugar: 'Templo',
    });
    const { id } = await data<{ id: number }>('sacraments.create', values);

    const byWife = await data<SearchPage<Marriage>>('sacraments.search', { tipo: 'matrimonio', nombres: 'Rosa' });
    expect(byWife.resultados.map((record) => record.sacramento.id)).toEqual([id]);
    expect((await data<SearchPage<Marriage>>('sacraments.search', { tipo: 'matrimonio', apellido_paterno: 'Quispe' })).resultados).toHaveLength(1);

    const record = await data<Marriage>('sacraments.get', { id });
    expect(record).toMatchObject({ conyuge_1: { nombres: 'Juan' }, conyuge_2: { nombres: 'Rosa' }, lugar: 'Templo' });

    expect(await data('sacraments.update', { ...record, testigo_1: 'Testigo' })).toEqual({ success: true });
    expect((await data<Marriage>('sacraments.get', { id })).testigo_1).toBe('Testigo');
    expect(await data('sacraments.annul', { id, motivo_anulacion: 'Error' })).toEqual({ success: true });
  });

  it('un tipo desconocido se rechaza', async () => {
    expect(await call('sacraments.search', { tipo: 'otro' })).toEqual({ ok: false, message: 'Tipo de sacramento inválido.', status: 400 });
    expect(await call('sacraments.create', { sacramento: { tipo: 'otro' } })).toEqual({ ok: false, message: 'Tipo de sacramento inválido.', status: 400 });
    expect(await call('sacraments.create', {})).toEqual({ ok: false, message: 'Tipo de sacramento inválido.', status: 400 });
  });

  it('un id que no es un entero positivo responde "no encontrado"', async () => {
    for (const id of [0, -1, 1.5, '1', null, undefined]) {
      expect(await call('sacraments.get', { id })).toEqual({ ok: false, message: 'Partida no encontrada.', status: 404 });
      expect(await call('sacraments.update', partida('bautismo', { sacramento: { id: id as number } }))).toEqual({ ok: false, message: 'Partida no encontrada.', status: 404 });
      expect(await call('ministers.update', minister({ id: id as number }))).toEqual({ ok: false, message: 'Ministro no encontrado.', status: 404 });
    }
  });

  it('ministros: crear, buscar, editar y deshabilitar', async () => {
    const { id } = await data<{ id: number }>('ministers.create', minister({ titulo: 'Pbro.', nombre: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega' }));

    const found = await data<SearchPage<Minister>>('ministers.search', { nombres: 'Luis' });
    expect(found.resultados).toMatchObject([{ id, titulo: 'Pbro.', parroquia: { nombre: 'Parroquia 1' } }]);

    expect(await data('ministers.update', { ...found.resultados[0], apellido_materno: 'Soto' })).toEqual({ success: true });
    expect(await data('ministers.toggleActive', { id })).toEqual({ success: true });
    expect((await data<SearchPage<Minister>>('ministers.search', {})).resultados[0]).toMatchObject({ apellido_materno: 'Soto', activo: 0 });
  });

  it('un usuario no puede modificar partidas ni ministros de otra parroquia', async () => {
    const { id } = await data<{ id: number }>('sacraments.create', partida('bautismo'));
    const created = await data<{ id: number }>('ministers.create', minister({ nombre: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega' }));

    state.session = parish2;
    expect(await call('sacraments.update', partida('bautismo', { sacramento: { id } }))).toMatchObject({ ok: false, status: 403 });
    expect(await call('sacraments.annul', { id, motivo_anulacion: 'x' })).toMatchObject({ ok: false, status: 403 });
    expect(await call('ministers.toggleActive', { id: created.id })).toMatchObject({ ok: false, status: 403 });
    expect(await call('parishes.saveLogo', { parroquia_id: 1, logo: null })).toMatchObject({ ok: false, status: 403 });
  });

  it('un admin tiene que elegir la parroquia al crear', async () => {
    state.session = admin;
    expect(await call('sacraments.create', partida('bautismo'))).toEqual({ ok: false, message: 'Debe especificar la parroquia.', status: 400 });

    const { id } = await data<{ id: number }>('sacraments.create', partida('bautismo', { sacramento: { parroquia_id: 2 } }));
    expect((await data<Baptism>('sacraments.get', { id })).sacramento.parroquia_id).toBe(2);
  });

  it('parroquias, logo, índice, estadísticas y duplicados', async () => {
    expect(await data('parishes.list')).toEqual({ parroquias: [{ id: 1, nombre: 'Parroquia 1' }, { id: 2, nombre: 'Parroquia 2' }] });

    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    expect(await data('parishes.saveLogo', { parroquia_id: 1, logo })).toEqual({ success: true });
    expect(await data('parishes.logo', { parroquia_id: 1 })).toEqual({ logo });

    await data('sacraments.create', partida('bautismo', { sacramento: { fecha_evento: '2020-03-03' } }));

    expect(await data('sacramentIndex.books', { tipo: 'bautismo', parroquia_id: 1 })).toEqual({ libros: ['1'] });
    const index = await data<{ entradas: { nombres: string }[] }>('sacramentIndex.entries', { tipo: 'bautismo', parroquia_id: 1, libro: null });
    expect(index.entradas).toEqual([{ ...ANA, libro: '1', folio: '2', numero: '3' }]);

    const stats = await data<{ anio: number; totales: { bautismo: { anio: number } } }>('statistics.get', { parroquia_id: 1, anio: 2020 });
    expect(stats.anio).toBe(2020);
    expect(stats.totales.bautismo.anio).toBe(1);

    const duplicates = await data<{ matches: { nivel: string; nombre_completo: string }[]; total: number }>('sacraments.findDuplicates', {
      tipo: 'bautismo',
      personas: [{ para: '', ...ANA }],
    });
    expect(duplicates.total).toBe(1);
    expect(duplicates.matches[0].nombre_completo).toBe('Ana Rojas Paz');
  });

  it('sesión y sincronización', async () => {
    expect(await data('auth.logout')).toEqual({ success: true });
    expect(await data('sync.status')).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(await data('sync.run')).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(state.sync_now).toHaveBeenCalled();
    expect(await data('sync.resolve', { entidad: 'bautismo', client_id: 'x', eleccion: 'local' })).toEqual({ pendientes: 0, modo: 'en-linea' });
    expect(await data('sync.dismissNotice')).toEqual({ success: true });

    state.session = null;
    expect(await call('sync.run')).toEqual({ ok: false, message: 'Sesión no válida.', status: 401 });
  });
});
