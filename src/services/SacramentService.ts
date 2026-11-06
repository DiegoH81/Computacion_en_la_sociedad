import type { SacramentRecord, SearchFilters, SearchPage } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import { localRequest } from '../lib/localClient';

/**
 * Partidas de bautismo, confirmación y matrimonio. Se mandan y reciben los models de shared/models.ts
 * (Baptism o Marriage), con el tipo de la partida en sacramento.tipo.
 */
export const SacramentService = {
  search<T extends SacramentRecord>(tipo: SacramentType, filters: SearchFilters): Promise<SearchPage<T>> {
    return localRequest('sacraments.search', { ...filters, tipo });
  },

  get<T extends SacramentRecord>(id: number): Promise<T> {
    return localRequest('sacraments.get', { id });
  },

  create(record: SacramentRecord): Promise<{ id: number }> {
    return localRequest('sacraments.create', record);
  },

  update(record: SacramentRecord): Promise<{ success: true }> {
    return localRequest('sacraments.update', record);
  },

  annul(id: number, motivo_anulacion: string): Promise<{ success: true }> {
    return localRequest('sacraments.annul', { id, motivo_anulacion });
  },
};
