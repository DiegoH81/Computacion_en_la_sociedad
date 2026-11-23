import type { ModificationFilters, ModificationPage } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/** El módulo "Modificaciones": todo lo que se cambió en la parroquia. */
export const ModificationService = {
  list(filters: ModificationFilters): Promise<ModificationPage> {
    return localRequest('modifications.list', filters);
  },
};
