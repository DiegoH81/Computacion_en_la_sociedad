import type { SacramentType } from '../../shared/sync';
import { localRequest } from '../lib/localClient';

/** Una partida del Excel que ya está en el sistema: no se vuelve a cargar. */
export interface ExistingRecord {
  fila: number;
  tipo: SacramentType;
  libro: string;
  folio: string;
  numero: string;
  nombre: string;
}

export interface ImportPreview {
  cancelado: false;
  token: string;
  archivo: string;
  codigos_parroquia: string[];
  total: number;
  nuevas: number;
  por_tipo: Record<SacramentType, number>;
  existentes: ExistingRecord[];
  errores: { fila: number; motivo: string }[];
}

export interface PackageSummary {
  parroquias: number;
  usuarios: number;
  partidas: number;
}

export const ImportService = {
  /** Abre el selector de archivos y revisa el Excel del sistema anterior, sin guardar nada. */
  previewLegacyExcel(): Promise<ImportPreview | { cancelado: true }> {
    return localRequest('legacyImport.preview');
  },

  confirmLegacyExcel(token: string): Promise<{ importadas: number; omitidas: number }> {
    return localRequest('legacyImport.confirm', { token });
  },

  /** Si esta PC todavía no tiene usuarios y necesita el paquete inicial. No pide sesión. */
  packageStatus(): Promise<{ necesita_paquete: boolean }> {
    return localRequest('package.status');
  },

  /** Abre el selector de archivos y carga el paquete inicial. Solo en una PC nueva. */
  importPackage(): Promise<({ cancelado: false } & PackageSummary) | { cancelado: true }> {
    return localRequest('package.import');
  },

  /** El administrador general guarda el paquete inicial para el instalador. */
  exportPackage(): Promise<({ cancelado: false } & PackageSummary) | { cancelado: true }> {
    return localRequest('package.export');
  },
};
