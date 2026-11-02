import { localRequest } from '../lib/localClient';

export const ParishService = {
  getLogo(parroquiaId: number): Promise<{ logo: string | null }> {
    return localRequest('parishes.logo', { id: parroquiaId });
  },

  /** El logo queda solo en esta PC: no se sincroniza. */
  saveLogo(parroquiaId: number, logo: string | null): Promise<{ success: true }> {
    return localRequest('parishes.saveLogo', { id: parroquiaId, logo });
  },
};
