import type { Minister, SearchFilters, SearchPage } from '../../shared/models';
import { localRequest } from '../lib/localClient';

/** Ministros (celebrantes). Se manda y recibe el model Minister de shared/models.ts. */
export const PriestService = {
  search(filters: SearchFilters): Promise<SearchPage<Minister>> {
    return localRequest('ministers.search', filters);
  },

  create(minister: Minister): Promise<{ id: number }> {
    return localRequest('ministers.create', minister);
  },

  update(minister: Minister): Promise<{ success: true }> {
    return localRequest('ministers.update', minister);
  },

  toggleActive(id: number): Promise<{ success: true }> {
    return localRequest('ministers.toggleActive', { id });
  },
};
