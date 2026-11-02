import { app, ipcMain } from 'electron';
import { LOCAL_REQUEST_CHANNEL, type LocalResponse } from '../../shared';
import { getLocalDb } from '../localDb';
import { positiveId, ServiceError, type SacramentType, type SearchFilters } from './common';
import { findDuplicates, type DuplicatePersonInput } from './duplicates';
import { marriages, type MarriageInput } from './marriages';
import { ministers, type MinisterInput } from './ministers';
import { readParishLogo, saveParishLogo } from './parishLogo';
import { listParishes } from './reference';
import { getIndexEntries, listIndexBooks } from './sacramentIndex';
import { dismissSyncNotice, getSyncStatus, login, logout, requireSession, resolveSyncConflict, syncNow } from './session';
import { singlePersonSacrament, type SinglePersonInput } from './singlePersonSacraments';
import { getStatistics } from './statistics';
import type { ConflictChoice } from './syncEngine';
import type { SyncEntity } from './syncQueue';

const baptisms = singlePersonSacrament('bautismo');
const confirmations = singlePersonSacrament('confirmacion');

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
  'auth.logout': () => {
    logout();
    return { success: true };
  },
  'sync.status': () => getSyncStatus(),
  'sync.run': async () => {
    requireSession();
    await syncNow();
    return getSyncStatus();
  },
  'sync.resolve': async ({ entidad, clientId, choice }: { entidad: SyncEntity; clientId: string; choice: ConflictChoice }) => {
    await resolveSyncConflict(entidad, clientId, choice);
    return getSyncStatus();
  },
  'sync.dismissNotice': () => {
    dismissSyncNotice();
    return { success: true };
  },
  'parishes.list': () => {
    requireSession();
    return { parishes: listParishes(getLocalDb()) };
  },
  'sacraments.findDuplicates': ({ tipo, excludeId, personas }: { tipo: SacramentType; excludeId?: number; personas: DuplicatePersonInput[] }) => {
    requireSession();
    return findDuplicates(getLocalDb(), tipo, excludeId, personas);
  },
  'statistics.get': ({ parroquiaId, anio }: { parroquiaId: unknown; anio: unknown }) => {
    requireSession();
    return getStatistics(getLocalDb(), positiveId(parroquiaId), anio);
  },
  'parishes.logo': ({ id }: { id: unknown }) => {
    requireSession();
    return { logo: readParishLogo(app.getPath('userData'), positiveId(id)) };
  },
  'parishes.saveLogo': ({ id, logo }: { id: unknown; logo: unknown }) => {
    saveParishLogo(app.getPath('userData'), requireSession(), positiveId(id), logo);
    return { success: true };
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
