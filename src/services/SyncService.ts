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
  en_curso: boolean;
  pendientes: number;
  conflictos: number;
  rechazados: number;
  ultima_sync: string | null;
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

  resolve(entidad: string, client_id: string, eleccion: ConflictChoice): Promise<SyncStatus> {
    return localRequest<SyncStatus>('sync.resolve', { entidad, client_id, eleccion });
  },

  dismissNotice(): Promise<unknown> {
    return localRequest('sync.dismissNotice');
  },
};
