import type { DuplicateMatch, DuplicateQuery } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import { localRequest } from '../lib/localClient';

export interface DuplicateResult {
  matches: DuplicateMatch[];
  /** Todas las coincidencias encontradas, aunque solo lleguen las más altas. */
  total: number;
}

export const DuplicateService = {
  /** excluir_sacramento_id: la partida que se está editando, para que no se encuentre a sí misma. */
  find(tipo: SacramentType, excluir_sacramento_id: number | undefined, personas: DuplicateQuery[]): Promise<DuplicateResult> {
    return localRequest('sacraments.findDuplicates', { tipo, excluir_sacramento_id, personas });
  },
};
