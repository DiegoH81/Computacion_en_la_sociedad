import { apiRequest } from '../lib/apiClient';

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
  listBooks(tipo: SacramentType, parroquiaId: number, token: string): Promise<{ libros: string[] }> {
    return apiRequest(`/api/sacrament-index/${tipo}/libros?parroquiaId=${parroquiaId}`, { token });
  },

  /** Sin libro devuelve las entradas de todos los libros. */
  getEntries(
    tipo: SacramentType,
    parroquiaId: number,
    libro: string | null,
    token: string,
  ): Promise<{ entries: SacramentIndexEntry[] }> {
    const query = new URLSearchParams({ parroquiaId: String(parroquiaId) });
    if (libro !== null) query.set('libro', libro);
    return apiRequest(`/api/sacrament-index/${tipo}?${query.toString()}`, { token });
  },
};
