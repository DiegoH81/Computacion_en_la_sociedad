import { apiRequest } from '../lib/apiClient';

export interface Priest {
  id: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  parroquia_id: number;
  parroquia_nombre: string;
  activo: number;
}

export interface SearchPriestsParams {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
}

export interface PriestFormValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

const PAGE_SIZE = 20;

export const PriestService = {
  search(params: SearchPriestsParams, token: string): Promise<{ priests: Priest[]; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.nombre) query.set('nombre', params.nombre);
    if (params.apellidoPaterno) query.set('apellidoPaterno', params.apellidoPaterno);
    if (params.apellidoMaterno) query.set('apellidoMaterno', params.apellidoMaterno);
    query.set('sortBy', params.sortBy);
    query.set('sortDirection', params.sortDirection);
    query.set('page', String(params.page));
    query.set('pageSize', String(PAGE_SIZE));

    return apiRequest(`/api/priests?${query.toString()}`, { token });
  },

  create(
    values: PriestFormValues,
    parroquiaId: number | undefined,
    token: string,
  ): Promise<{ id: number }> {
    return apiRequest('/api/priests', {
      method: 'POST',
      body: { ...values, parroquiaId },
      token,
    });
  },

  update(priestId: number, values: PriestFormValues, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/priests/${priestId}`, {
      method: 'PUT',
      body: values,
      token,
    });
  },

  toggleActive(priestId: number, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/priests/${priestId}/toggle-active`, {
      method: 'PATCH',
      token,
    });
  },
};
