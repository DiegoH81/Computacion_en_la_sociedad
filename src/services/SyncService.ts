import { localRequest } from '../lib/localClient';

export type ConnectionMode = 'en-linea' | 'sin-conexion' | 'requiere-login' | 'error';
export type ConflictChoice = 'servidor' | 'local';

export interface SyncItem {
  entidad: string;
  client_id: string;
  estado: 'conflicto' | 'rechazado';
  motivo: string | null;
  descripcion: string;
}

export interface SyncStatus {
  modo: ConnectionMode;
  enCurso: boolean;
  pendientes: number;
  conflictos: number;
  rechazados: number;
  ultimaSync: string | null;
  aviso: string | null;
  mensaje: string | null;
  token: string;
  items: SyncItem[];
}

export const SyncService = {
  status(): Promise<SyncStatus> {
    return localRequest<SyncStatus>('sync.status');
  },

  run(): Promise<SyncStatus> {
    return localRequest<SyncStatus>('sync.run');
  },

  resolve(entidad: string, clientId: string, choice: ConflictChoice): Promise<SyncStatus> {
    return localRequest<SyncStatus>('sync.resolve', { entidad, clientId, choice });
  },

  dismissNotice(): Promise<unknown> {
    return localRequest('sync.dismissNotice');
  },
};
