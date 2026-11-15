import type { BackupLogEntry } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/**
 * Cuántas partidas trae el respaldo y cuántos cambios sin subir (se suben al sincronizar). Al exportar,
 * también los nombres del respaldo y del Excel que se guardó a su lado.
 */
export type BackupResult = { cancelado: false; partidas: number; pendientes: number; archivo?: string; excel?: string } | { cancelado: true };

/** El respaldo de esta PC: un archivo con toda la base local, protegido con una contraseña. */
export const BackupService = {
  /** Abre el diálogo para elegir dónde guardar el respaldo. */
  exportBackup(password: string): Promise<BackupResult> {
    return localRequest('backup.export', { password });
  },

  /** Elige un respaldo y reemplaza con él los datos de esta PC. Cierra la sesión. */
  restoreBackup(password: string): Promise<BackupResult> {
    return localRequest('backup.restore', { password });
  },

  /** Quién exportó o restauró respaldos en esta PC, lo más reciente primero. */
  getLog(): Promise<{ registros: BackupLogEntry[] }> {
    return localRequest('backup.log');
  },

  /** Lo mismo desde el login, en una PC que todavía no tiene usuarios. */
  restoreOnEmptyPc(password: string): Promise<BackupResult> {
    return localRequest('backup.restoreEmpty', { password });
  },
};
