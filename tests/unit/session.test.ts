// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_TOKEN } from '../../electron/shared';
import { ServiceError } from '../../electron/main/utils/errors';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { create_person_sacrament } from '../../electron/main/controllers/sacraments';
import { baptism, TEST_MINISTER } from './helpers/records';
import type { RemoteOptions } from '../../electron/main/sync/online';

// La sesión con un servidor falso: login con y sin internet, token vencido y sincronización.

type Route = (options: RemoteOptions) => unknown;

const state = vi.hoisted(() => ({
  db: null as unknown,
  routes: {} as Record<string, Route>,
  calls: [] as { path: string; options: RemoteOptions }[],
  offline: false,
}));

// current_key: null hace que no se suba la copia de la clave.
vi.mock('../../electron/main/db/app_database', () => ({
  get_database: () => state.db,
  database_needs_recovery: () => false,
  current_key: () => null,
}));

vi.mock('../../electron/main/sync/online', async (original) => {
  const real = await original<typeof import('../../electron/main/sync/online')>();
  const { ServiceError } = await import('../../electron/main/utils/errors');
  return {
    ...real,
    remote_request: async (url: string, options: RemoteOptions = {}) => {
      state.calls.push({ path: url, options });
      if (state.offline) throw new ServiceError('No se pudo conectar con el servidor. Verifique su conexión.', 0);
      const route = Object.keys(state.routes).find((prefix) => url.startsWith(prefix));
      if (!route) throw new ServiceError('Not Found', 404);
      return state.routes[route](options);
    },
  };
});

// La sesión quedó repartida en tres módulos: el login, la sincronización automática y quién inició sesión.
const session = {
  ...(await import('../../electron/main/controllers/login')),
  ...(await import('../../electron/main/sync/auto_sync')),
  ...(await import('../../electron/main/models/session')),
};

const PASSWORD = 'clave-correcta';
let valid_tokens = new Set<string>();
let token_counter = 0;
let dir: string;
let db: LocalDatabase;

const REFERENCE = {
  parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
  ministros: [TEST_MINISTER],
  usuarios: [{ id: 1, parroquia_id: 1, username: 'ana', rol: 'admin_parroquia', nombre: 'Ana', apellido_paterno: 'Rojas', apellido_materno: 'Paz', activo: 1 }],
};

function require_token(options: RemoteOptions): void {
  if (!options.token || !valid_tokens.has(options.token)) throw new ServiceError('Sesión inválida o expirada.', 401);
}

function default_routes(): Record<string, Route> {
  return {
    '/api/auth/login': (options) => {
      const body = options.body as { username: string; password: string };
      if (body.username !== 'ana' || body.password !== PASSWORD) throw new ServiceError('Usuario o contraseña incorrectos.', 401);
      const token = `token-${++token_counter}`;
      valid_tokens.add(token);
      return {
        token,
        usuario: { id: 1, nombre_completo: 'Ana Rojas Paz', rol: 'admin_parroquia', parroquia_id: 1, parroquia_nombre: 'Parroquia 1' },
      };
    },
    '/api/reference': (options) => {
      require_token(options);
      return REFERENCE;
    },
    '/api/sync/push': (options) => {
      require_token(options);
      const { cambios } = options.body as { cambios: { entidad: string; client_id: string }[] };
      return { resultados: cambios.map((cambio) => ({ entidad: cambio.entidad, client_id: cambio.client_id, estado: 'aplicado', version: 2 })) };
    },
    '/api/sync/pull': (options) => {
      require_token(options);
      return { partidas: [], cursor: 0, hayMas: false };
    },
  };
}

const paths = () => state.calls.map((call) => call.path.split('?')[0]);
const pending = () => db.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get();

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-session-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  state.db = db;
  state.routes = default_routes();
  state.calls = [];
  state.offline = false;
  valid_tokens = new Set();
  token_counter = 0;
});

afterEach(() => {
  session.logout();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('sesión', () => {
  it('sin sesión, require_session responde 401', () => {
    expect(() => session.require_session()).toThrow(new ServiceError('Sesión no válida.', 401));
  });

  it('login con internet: baja la referencia, guarda la verificación y sincroniza', async () => {
    const response = await session.login({ username: 'ana', password: PASSWORD });

    expect(response.token).toBe('token-1');
    expect(response.usuario.nombre_completo).toBe('Ana Rojas Paz');
    expect(session.require_session()).toEqual({ user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 'token-1' });
    expect(db.prepare('SELECT COUNT(*) FROM credenciales_locales WHERE usuario_id = 1').pluck().get()).toBe(1);
    expect(paths()).toEqual(['/api/auth/login', '/api/reference', '/api/reference', '/api/sync/pull']);

    const status = session.get_sync_status();
    expect(status.modo).toBe('en-linea');
    expect(status.token).toBe('token-1');
    expect(status.ultimaSync).not.toBeNull();
  });

  it('con internet, una contraseña incorrecta no prueba la verificación local', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    session.logout();

    await expect(session.login({ username: 'ana', password: 'otra' })).rejects.toThrow('Usuario o contraseña incorrectos.');
    expect(() => session.require_session()).toThrow('Sesión no válida.');
  });

  it('sin internet: un usuario que esta PC no conoce no entra, y se le dice cómo', async () => {
    state.offline = true;
    await expect(session.login({ username: 'ana', password: PASSWORD })).rejects.toThrow(session.NOT_IN_THIS_PC);
  });

  it('con la contraseña guardada en esta PC entra sin preguntar al servidor, y sincroniza después', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    session.logout();
    state.calls = [];

    const response = await session.login({ username: 'ana', password: PASSWORD });

    expect(response.token).toBe(OFFLINE_TOKEN);
    expect(paths()[0]).not.toBe('/api/reference');
    await session.sync_now();
    expect(session.get_sync_status().modo).toBe('en-linea');
  });

  it('sin internet, después de un ingreso con conexión, valida contra lo guardado', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    session.logout();
    state.offline = true;

    await expect(session.login({ username: 'ana', password: 'otra' })).rejects.toThrow('Usuario o contraseña incorrectos.');

    const response = await session.login({ username: 'ana', password: PASSWORD });
    expect(response.token).toBe(OFFLINE_TOKEN);
    expect(session.require_session().token).toBe('');
    expect(session.get_sync_status()).toMatchObject({ modo: 'sin-conexion', token: OFFLINE_TOKEN });
  });

  it('lo que se guarda sin internet se sube al volver la conexión', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    session.logout();
    state.offline = true;
    await session.login({ username: 'ana', password: PASSWORD });

    create_person_sacrament(db, 'bautismo', session.require_session(), baptism('bautismo', {
      sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '1' },
      persona: { nombres: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega' },
    }));
    await session.sync_now();
    expect(pending()).toBe(1);
    expect(session.get_sync_status().modo).toBe('sin-conexion');

    state.offline = false;
    await session.sync_now();
    expect(pending()).toBe(0);
    expect(session.get_sync_status().modo).toBe('en-linea');
    expect(session.require_session().token).not.toBe('');
  });

  it('si el token vence durante la sincronización, pide otro y reintenta', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    valid_tokens.clear(); // el servidor ya no acepta el token actual
    state.calls = [];

    await session.sync_now();

    expect(paths()).toEqual(['/api/reference', '/api/auth/login', '/api/reference', '/api/sync/pull']);
    expect(session.require_session().token).toBe('token-2');
    expect(session.get_sync_status().modo).toBe('en-linea');
  });

  it('si la contraseña cambió en el servidor, pide volver a iniciar sesión', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    valid_tokens.clear();
    state.routes['/api/auth/login'] = () => {
      throw new ServiceError('Usuario o contraseña incorrectos.', 401);
    };

    await session.sync_now();

    expect(session.get_sync_status()).toMatchObject({
      modo: 'requiere-login',
      mensaje: 'La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.',
    });
  });

  it('un error del servidor (no de conexión) deja el modo en "error" con su mensaje', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    state.routes['/api/sync/pull'] = () => {
      throw new ServiceError('Cursor inválido.', 400);
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await session.sync_now();

    expect(session.get_sync_status()).toMatchObject({ modo: 'error', mensaje: 'Cursor inválido.' });
    errors.mockRestore();
  });

  it('dos sincronizaciones a la vez comparten la misma ejecución', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    state.calls = [];

    const first = session.sync_now();
    const second = session.sync_now();
    expect(session.get_sync_status().en_curso).toBe(true);
    await Promise.all([first, second]);

    expect(paths().filter((item) => item === '/api/reference')).toHaveLength(1);
    expect(session.get_sync_status().en_curso).toBe(false);
  });

  it('cerrar sesión no sincroniza y conserva lo pendiente', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    create_person_sacrament(db, 'bautismo', session.require_session(), baptism('bautismo', {
      sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '1' },
      persona: { nombres: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega' },
    }));
    state.calls = [];

    session.logout();

    expect(state.calls).toEqual([]);
    expect(pending()).toBe(1);
    expect(() => session.require_session()).toThrow('Sesión no válida.');
    await session.sync_now(); // sin sesión no hace nada
    expect(state.calls).toEqual([]);
  });

  it('al cerrar la app sube lo pendiente, sin esperar más del límite', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    create_person_sacrament(db, 'bautismo', session.require_session(), baptism('bautismo', {
      sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '1' },
      persona: { nombres: 'Luis', apellido_paterno: 'Paz', apellido_materno: 'Vega' },
    }));

    await session.sync_before_quit(5_000);
    expect(pending()).toBe(0);

    // Un servidor que nunca responde no retiene el cierre.
    create_person_sacrament(db, 'bautismo', session.require_session(), baptism('bautismo', {
      sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '2' },
      persona: { nombres: 'Rosa', apellido_paterno: 'Paz', apellido_materno: 'Vega' },
    }));
    let answer = () => undefined as void;
    state.routes['/api/reference'] = () => new Promise((resolve) => { answer = () => resolve(REFERENCE); });
    const start = Date.now();
    await session.sync_before_quit(50);
    expect(Date.now() - start).toBeLessThan(1_000);
    expect(pending()).toBe(1);

    // Cuando el servidor por fin responde, esa misma sincronización termina de subir.
    answer();
    await session.sync_now();
    expect(pending()).toBe(0);
  });

  it('resolver un conflicto sin conexión avisa que hace falta internet', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    session.logout();
    state.offline = true;
    await session.login({ username: 'ana', password: PASSWORD });

    await expect(session.resolve_sync_conflict('bautismo', 'x', 'local')).rejects.toThrow('Se necesita conexión para resolver el conflicto.');
  });

  it('descartar el aviso lo borra del estado', async () => {
    await session.login({ username: 'ana', password: PASSWORD });
    db.prepare(`INSERT INTO sync_estado (clave, valor) VALUES ('aviso', 'hola')`).run();
    expect(session.get_sync_status().aviso).toBe('hola');

    session.dismiss_sync_notice();
    expect(session.get_sync_status().aviso).toBeNull();
  });
});
