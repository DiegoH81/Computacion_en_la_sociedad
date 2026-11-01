import { localRequest } from '../lib/localClient';

export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';

export interface SacramentIndexEntry {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  libro: string;
  folio: string;
  registro: string;
}

export const SacramentIndexService = {
  listBooks(tipo: SacramentType, parroquiaId: number): Promise<{ libros: string[] }> {
    return localRequest('sacramentIndex.books', { tipo, parroquiaId });
  },

  /** Sin libro devuelve las entradas de todos los libros. */
  getEntries(
    tipo: SacramentType,
    parroquiaId: number,
    libro: string | null,
  ): Promise<{ entries: SacramentIndexEntry[] }> {
    return localRequest('sacramentIndex.entries', { tipo, parroquiaId, libro });
  },
};
