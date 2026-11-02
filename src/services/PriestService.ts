import { localRequest } from '../lib/localClient';

export interface Priest {
  id: number;
  titulo: string | null;
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
  parroquiaId?: number;
}

export interface PriestFormValues {
  titulo: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export const PriestService = {
  search(params: SearchPriestsParams): Promise<{ priests: Priest[]; totalPages: number }> {
    return localRequest('ministers.search', params);
  },

  create(values: PriestFormValues, parroquiaId: number | undefined): Promise<{ id: number }> {
    return localRequest('ministers.create', { values, parroquiaId });
  },

  update(priestId: number, values: PriestFormValues): Promise<{ success: true }> {
    return localRequest('ministers.update', { id: priestId, values });
  },

  toggleActive(priestId: number): Promise<{ success: true }> {
    return localRequest('ministers.toggleActive', { id: priestId });
  },
};
