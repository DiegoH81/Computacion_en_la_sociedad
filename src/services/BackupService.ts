import { localRequest } from '../lib/localClient';

/** Cuántas partidas trae el respaldo y cuántos cambios sin subir (se suben al sincronizar). */
export type BackupResult = { cancelado: false; partidas: number; pendientes: number } | { cancelado: true };

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

  /** Lo mismo desde el login, en una PC que todavía no tiene usuarios. */
  restoreOnEmptyPc(password: string): Promise<BackupResult> {
    return localRequest('backup.restoreEmpty', { password });
  },
};
