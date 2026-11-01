import type { LocalDatabase } from '../localDb/database';
import type { SacramentType } from './common';

export type SyncEntity = SacramentType | 'ministro';

export interface QueueRow {
  id: number;
  entidad: SyncEntity;
  client_id: string;
  version_base: number | null;
  cola_id: string;
  revision: number;
  estado: 'pendiente' | 'conflicto' | 'rechazado';
  motivo: string | null;
}

/** Debe llamarse en la misma transacción que guarda el cambio y antes de modificar el registro. */
export function enqueueChange(
  db: LocalDatabase,
  entidad: SyncEntity,
  clientId: string,
  versionBase: number | null,
): void {
  // Si ya está pendiente, se conserva su versión de partida: es la que conoce el servidor.
  db.prepare(
    `INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)
     ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1`,
  ).run(entidad, clientId, versionBase, crypto.randomUUID());
}

export function isQueued(db: LocalDatabase, entidad: SyncEntity, clientId: string): boolean {
  return db.prepare('SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?').get(entidad, clientId) !== undefined;
}

export function removeFromQueue(db: LocalDatabase, entidad: SyncEntity, clientId: string): void {
  db.prepare('DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?').run(entidad, clientId);
}
