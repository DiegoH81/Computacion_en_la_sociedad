import type { IndexEntry } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import { localRequest } from '../lib/localClient';

export const SacramentIndexService = {
  listBooks(tipo: SacramentType, parroquia_id: number): Promise<{ libros: string[] }> {
    return localRequest('sacramentIndex.books', { tipo, parroquia_id });
  },

  /** Sin libro devuelve las entradas de todos los libros. */
  getEntries(tipo: SacramentType, parroquia_id: number, libro: string | null): Promise<{ entradas: IndexEntry[] }> {
    return localRequest('sacramentIndex.entries', { tipo, parroquia_id, libro });
  },
};
