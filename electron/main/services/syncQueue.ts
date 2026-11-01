import type { LocalDatabase } from '../localDb/database';
import type { SacramentType } from './common';

export type SyncEntity = SacramentType | 'ministro';

/** Debe llamarse en la misma transacción que guarda el cambio y antes de modificar el registro. */
export function enqueueChange(
  db: LocalDatabase,
  entidad: SyncEntity,
  clientId: string,
  versionBase: number | null,
): void {
  // Si ya está pendiente, se conserva su fila: guarda la versión de partida correcta.
  db.prepare(
    `INSERT INTO sync_cola (entidad, client_id, version_base) VALUES (?, ?, ?)
     ON CONFLICT (entidad, client_id) DO NOTHING`,
  ).run(entidad, clientId, versionBase);
}
