import type { Parish } from '../../shared/models';
import { apiRequest } from '../lib/apiClient';
import { localRequest } from '../lib/localClient';

export const ParishService = {
  getLogo(parroquia_id: number): Promise<{ logo: string | null }> {
    return localRequest('parishes.logo', { parroquia_id });
  },

  /** El logo queda solo en esta PC: no se sincroniza. */
  saveLogo(parroquia_id: number, logo: string | null): Promise<{ success: true }> {
    return localRequest('parishes.saveLogo', { parroquia_id, logo });
  },

  // Gestión de parroquias en el Worker (solo admin). Se manda y recibe el model Parish.

  listAll(token: string): Promise<{ parroquias: Parish[] }> {
    return apiRequest('/api/parishes/todas', { token });
  },

  /** Una parroquia nueva todavía no tiene id ni estado: el Worker la crea habilitada. */
  create(parish: Pick<Parish, 'nombre' | 'ubicacion'>, token: string): Promise<{ id: number }> {
    return apiRequest('/api/parishes', { method: 'POST', body: parish, token });
  },

  /** El estado no se edita aquí: se cambia con toggleActive. */
  update(parish: Pick<Parish, 'id' | 'nombre' | 'ubicacion'>, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/parishes/${parish.id}`, { method: 'PUT', body: parish, token });
  },

  toggleActive(parishId: number, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/parishes/${parishId}/toggle-active`, { method: 'PATCH', token });
  },
};
