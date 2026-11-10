// Una "PC" para las pruebas de sincronización: su propia base local cifrada y el código real de Electron
// (controllers y sync), hablando con el Worker real. Lo único simulado es la red: cada PC puede quedarse
// sin internet (online = false) y la sesión de Electron, que es una sola por proceso, se activa para la
// PC que está trabajando en cada momento.

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inject } from 'vitest';
import type { Baptism, User } from '../../shared/models';
import type { LoginResponse, ParishRole } from '../../shared/sync';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { save_credential, verify_offline } from '../../electron/main/controllers/login';
import { start_session, type Session } from '../../electron/main/models/session';
import { request_login, type RemoteOptions, type RemoteRequest } from '../../electron/main/sync/online';
import { read_queue_summary, refresh_reference, run_sync } from '../../electron/main/sync/sync';
import { ServiceError } from '../../electron/main/utils/errors';
import { baptism } from '../unit/helpers/records';

export const SEED = {
  general: { username: 'admin', password: 'admin123' },
  parroco1: { username: 'parroco1', password: 'parroco123' },
  // Los celebrantes que trae la base de prueba: uno por parroquia (ids del servidor).
  minister: { 1: 1, 2: 2 } as Record<number, number>,
};

/** Una llamada HTTP al Worker de pruebas, con los mismos errores que remote_request de Electron. */
async function http<T>(requestPath: string, options: RemoteOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${inject('workerUrl')}${requestPath}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = (await response.json().catch(() => null)) as { message?: unknown } | null;

  if (!response.ok) throw new ServiceError(data?.message ? String(data.message) : 'Ocurrió un error inesperado.', response.status);
  return data as T;
}

/** Lo que el administrador general hace directo en el servidor (como desde otra PC con internet). */
export const server = {
  async token(username = SEED.general.username, password = SEED.general.password): Promise<string> {
    return (await request_login(http as RemoteRequest, username, password)).token;
  },

  async createUser(values: { username: string; password: string; rol: User['rol']; parroquia_id: number | null }): Promise<number> {
    const token = await server.token();
    const body = { nombre: 'Prueba', apellido_paterno: values.username, apellido_materno: '', ...values };
    return (await http<{ id: number }>('/api/users', { method: 'POST', body, token })).id;
  },

  async toggleUser(id: number): Promise<void> {
    await http(`/api/users/${id}/toggle-active`, { method: 'PATCH', token: await server.token() });
  },

  async changePassword(id: number, user: { nombre: string; apellido_paterno: string; apellido_materno: string }, password: string): Promise<void> {
    await http(`/api/users/${id}`, { method: 'PUT', body: { ...user, password }, token: await server.token() });
  },

  async setParish(id: number, parishId: number, rol: ParishRole): Promise<void> {
    await http(`/api/users/${id}/parishes/${parishId}`, { method: 'PUT', body: { rol }, token: await server.token() });
  },

  async removeParish(id: number, parishId: number): Promise<void> {
    await http(`/api/users/${id}/parishes/${parishId}`, { method: 'DELETE', token: await server.token() });
  },

  async toggleParish(parishId: number): Promise<void> {
    await http(`/api/parishes/${parishId}/toggle-active`, { method: 'PATCH', token: await server.token() });
  },

  async userId(username: string): Promise<number | null> {
    const page = await http<{ resultados: { id: number; username: string }[] }>(`/api/users?apellido_paterno=${encodeURIComponent(username)}`, {
      token: await server.token(),
    });
    return page.resultados.find((row) => row.username === username)?.id ?? null;
  },
};

/** Un nombre de usuario que no se repite entre pruebas (todas comparten el mismo Worker). */
export function uniqueName(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

let registryCounter = 0;
/** Un número de registro distinto para cada partida de prueba, para encontrarla después. */
export function nextRegistry(): string {
  registryCounter += 1;
  return `${Date.now() % 100000}${registryCounter}`;
}

export type SyncOutcome = 'ok' | 'sin-conexion' | 'requiere-login';

export class Pc {
  readonly db: LocalDatabase;
  /** false: la PC no tiene internet (toda llamada al servidor falla como sin conexión). */
  online = true;
  session: Session | null = null;
  private readonly dir: string;
  private username = '';
  private password = '';

  readonly name: string;

  constructor(name: string) {
    this.name = name;
    this.dir = mkdtempSync(path.join(tmpdir(), `prelatura-${name}-`));
    this.db = open_local_database(path.join(this.dir, 'local.db'), randomBytes(32).toString('hex'));
  }

  readonly request: RemoteRequest = async <T>(requestPath: string, options?: RemoteOptions): Promise<T> => {
    if (!this.online) throw new ServiceError('No se pudo conectar con el servidor. Verifique su conexión.', 0);
    return http<T>(requestPath, options);
  };

  /** Como el login de Electron: primero la contraseña guardada en esta PC; si no, con internet. */
  async login(username: string, password: string): Promise<void> {
    this.username = username;
    this.password = password;

    const local = await verify_offline(this.db, username, password);
    if (local.ok) {
      this.session = { user_id: local.usuario.id, role: local.usuario.rol, parish_id: local.usuario.parroquia_id, token: '' };
      this.activate();
      if (this.online) await this.sync();
      return;
    }

    const response: LoginResponse = await request_login(this.request, username, password);
    this.session = { user_id: response.usuario.id, role: response.usuario.rol, parish_id: response.usuario.parroquia_id, token: response.token };
    this.activate();
    await refresh_reference(this.db, this.request, response.token);
    await save_credential(this.db, response.usuario.id, password);
    await this.sync();
  }

  /** La sesión de Electron pasa a ser la de esta PC (el objeto es el mismo: lo que cambie se ve aquí). */
  activate(): void {
    if (!this.session) throw new Error(`${this.name}: no hay sesión iniciada`);
    start_session(this.session, this.username, this.password);
  }

  /** Lo que hace la sincronización automática (auto_sync.ts): renueva el token si hace falta y sincroniza. */
  async sync(): Promise<SyncOutcome> {
    this.activate();
    const session = this.session as Session;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!session.token) {
        try {
          session.token = (await request_login(this.request, this.username, this.password)).token;
        } catch (error) {
          if (error instanceof ServiceError && (error.status === 0 || error.status >= 500)) return 'sin-conexion';
          return 'requiere-login';
        }
      }

      try {
        await run_sync(this.db, this.request, session.token);
        return 'ok';
      } catch (error) {
        if (error instanceof ServiceError && error.status === 0) return 'sin-conexion';
        if (error instanceof ServiceError && error.status === 401) {
          session.token = '';
          continue;
        }
        throw error;
      }
    }
    return 'requiere-login';
  }

  /** Trabaja en esta PC con su sesión. */
  as<T>(action: (db: LocalDatabase, session: Session) => T): T {
    this.activate();
    return action(this.db, this.session as Session);
  }

  queue() {
    return read_queue_summary(this.db);
  }

  /** Las partidas de esta PC con ese número de registro. */
  recordsWithRegistry(numero: string): { id: number; client_id: string; parroquia_id: number; version: number; estado: string; nombres: string }[] {
    return this.db
      .prepare(
        `SELECT s.id, s.client_id, s.parroquia_id, s.version, s.estado, p.nombres
         FROM sacramentos s JOIN bautismos b ON b.sacramento_id = s.id JOIN personas p ON p.id = b.persona_id
         WHERE s.numero = ? ORDER BY s.id`,
      )
      .all(numero) as { id: number; client_id: string; parroquia_id: number; version: number; estado: string; nombres: string }[];
  }

  close(): void {
    this.db.close();
    rmSync(this.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/** Un bautismo de la parroquia indicada, con el celebrante de esa parroquia. */
export function baptismIn(parishId: number, numero: string, nombres = 'Prueba', extra: { libro?: string; folio?: string } = {}): Baptism {
  return baptism('bautismo', {
    sacramento: { fecha_emision: '2020-01-01', fecha_evento: '2020-01-01', libro: extra.libro ?? '50', folio: extra.folio ?? '1', numero, ministro_id: SEED.minister[parishId] },
    persona: { nombres, apellido_paterno: 'Sincro', apellido_materno: 'Prueba' },
  });
}
