import { ipcMain } from 'electron';
import { LOCAL_REQUEST_CHANNEL, type LocalResponse } from '../../shared';
import { getLocalDb } from '../localDb';
import { positiveId, ServiceError, type SearchFilters, type Session } from './common';
import { marriages, type MarriageInput } from './marriages';
import { ministers, type MinisterInput } from './ministers';
import { applyReferenceData, listParishes, type ReferenceData } from './reference';
import { getIndexEntries, listIndexBooks } from './sacramentIndex';
import { singlePersonSacrament, type SinglePersonInput } from './singlePersonSacraments';

const WORKER_BASE_URL = 'http://localhost:8787';

const baptisms = singlePersonSacrament('bautismo');
const confirmations = singlePersonSacrament('confirmacion');

let session: Session | null = null;

function requireSession(): Session {
  if (!session)
    throw new ServiceError('Sesión no válida.', 401);
  return session;
}

async function workerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${WORKER_BASE_URL}${path}`, init);
  } catch {
    throw new ServiceError('No se pudo conectar con el servidor. Verifique su conexión.', 0);
  }

  const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
  if (!response.ok) {
    throw new ServiceError(data?.message ? String(data.message) : 'Ocurrió un error inesperado.', response.status);
  }
  return data as T;
}

async function refreshReference(token: string): Promise<void> {
  const data = await workerRequest<ReferenceData>('/api/reference', {
    headers: { Authorization: `Bearer ${token}` },
  });
  applyReferenceData(getLocalDb(), data);
}

interface LoginResponse {
  token: string;
  usuario: { id: number; rol: Session['rol']; parroquiaId: number | null };
}

async function login(payload: { username: string; password: string }): Promise<LoginResponse> {
  getLocalDb();
  const response = await workerRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: payload.username, password: payload.password }),
  });

  await refreshReference(response.token);
  session = {
    usuarioId: response.usuario.id,
    rol: response.usuario.rol,
    parroquiaId: response.usuario.parroquiaId,
    token: response.token,
  };
  return response;
}

type Sacrament = typeof baptisms;

function sacramentHandlers(prefix: string, key: string, service: Sacrament) {
  return {
    [`${prefix}.search`]: (filters: SearchFilters) => {
      requireSession();
      const { rows, totalPages } = service.search(getLocalDb(), filters);
      return { [`${key}s`]: rows, totalPages };
    },
    [`${prefix}.get`]: ({ id }: { id: unknown }) => {
      requireSession();
      return { [key]: service.getById(getLocalDb(), positiveId(id)) };
    },
    [`${prefix}.create`]: ({ values, parroquiaId }: { values: SinglePersonInput; parroquiaId?: number }) => ({
      id: service.create(getLocalDb(), requireSession(), values, parroquiaId),
    }),
    [`${prefix}.update`]: ({ id, values }: { id: unknown; values: SinglePersonInput }) => {
      service.update(getLocalDb(), requireSession(), positiveId(id), values);
      return { success: true };
    },
    [`${prefix}.annul`]: ({ id, motivo }: { id: unknown; motivo: unknown }) => {
      service.annul(getLocalDb(), requireSession(), positiveId(id), motivo);
      return { success: true };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, (payload: any) => unknown> = {
  'auth.login': login,
  'parishes.list': () => {
    requireSession();
    return { parishes: listParishes(getLocalDb()) };
  },
  'ministers.search': (filters: SearchFilters) => {
    requireSession();
    return ministers.search(getLocalDb(), filters);
  },
  'ministers.create': ({ values, parroquiaId }: { values: MinisterInput; parroquiaId?: number }) => ({
    id: ministers.create(getLocalDb(), requireSession(), values, parroquiaId),
  }),
  'ministers.update': ({ id, values }: { id: unknown; values: MinisterInput }) => {
    ministers.update(getLocalDb(), requireSession(), positiveId(id, 'Ministro'), values);
    return { success: true };
  },
  'ministers.toggleActive': ({ id }: { id: unknown }) => {
    ministers.toggleActive(getLocalDb(), requireSession(), positiveId(id, 'Ministro'));
    return { success: true };
  },
  ...sacramentHandlers('baptisms', 'baptism', baptisms),
  ...sacramentHandlers('confirmations', 'confirmation', confirmations),
  'marriages.search': (filters: SearchFilters) => {
    requireSession();
    const { rows, totalPages } = marriages.search(getLocalDb(), filters);
    return { marriages: rows, totalPages };
  },
  'marriages.get': ({ id }: { id: unknown }) => {
    requireSession();
    return { marriage: marriages.getById(getLocalDb(), positiveId(id)) };
  },
  'marriages.create': ({ values, parroquiaId }: { values: MarriageInput; parroquiaId?: number }) => ({
    id: marriages.create(getLocalDb(), requireSession(), values, parroquiaId),
  }),
  'marriages.update': ({ id, values }: { id: unknown; values: MarriageInput }) => {
    marriages.update(getLocalDb(), requireSession(), positiveId(id), values);
    return { success: true };
  },
  'marriages.annul': ({ id, motivo }: { id: unknown; motivo: unknown }) => {
    marriages.annul(getLocalDb(), requireSession(), positiveId(id), motivo);
    return { success: true };
  },
  'sacramentIndex.books': ({ tipo, parroquiaId }: { tipo: unknown; parroquiaId: unknown }) => ({
    libros: listIndexBooks(getLocalDb(), requireSession(), tipo, parroquiaId),
  }),
  'sacramentIndex.entries': ({
    tipo,
    parroquiaId,
    libro,
  }: {
    tipo: unknown;
    parroquiaId: unknown;
    libro: string | null;
  }) => ({
    entries: getIndexEntries(getLocalDb(), requireSession(), tipo, parroquiaId, libro),
  }),
};

export function registerLocalIpc(): void {
  ipcMain.handle(LOCAL_REQUEST_CHANNEL, async (_event, method: string, payload: unknown): Promise<LocalResponse> => {
    try {
      if (!Object.hasOwn(handlers, method)) {
        throw new ServiceError('Operación no reconocida.', 404);
      }
      return { ok: true, data: await handlers[method](payload) };
    } catch (error) {
      if (error instanceof ServiceError) {
        return { ok: false, message: error.message, status: error.status };
      }
      console.error(`Error en ${method}:`, error);
      return { ok: false, message: 'Ocurrió un error inesperado.', status: 500 };
    }
  });
}
