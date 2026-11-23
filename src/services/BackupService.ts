import type { BackupLogEntry } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/**
 * Cuántas partidas trae el respaldo y cuántos cambios sin subir (se suben al sincronizar). Al exportar,
 * también el nombre del archivo.
 */
export type BackupResult = { cancelado: false; partidas: number; pendientes: number; archivo?: string } | { cancelado: true };

/** Cuántas partidas de la parroquia van en el Excel, y el nombre del archivo. */
export type ExcelResult = { cancelado: false; partidas: number; archivo: string } | { cancelado: true };

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

  /** Abre el diálogo para guardar el Excel de la parroquia (partidas e historial, sin contraseña). */
  exportExcel(): Promise<ExcelResult> {
    return localRequest('backup.exportExcel');
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
