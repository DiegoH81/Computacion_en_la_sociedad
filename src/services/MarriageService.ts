import { apiRequest } from '../lib/apiClient';

export interface MarriageRow {
  id: number;
  parroquia_id: number;
  parroquia_nombre: string;
  fecha_sacramento: string;
  numero_libro: string;
  numero_folio: string;
  numero_registro: string;
  esposo_nombre: string;
  esposo_apellido_paterno: string;
  esposo_apellido_materno: string;
  esposa_nombre: string;
  esposa_apellido_paterno: string;
  esposa_apellido_materno: string;
  estado: 'vigente' | 'anulado';
}

export interface SearchMarriagesParams {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
}

export interface PersonFormValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  parroquiaBautismo?: string;
  fechaBautismo?: string;
  padreNombre?: string;
  padreApellido?: string;
  padreDni?: string;
  madreNombre?: string;
  madreApellido?: string;
  madreDni?: string;
}

export interface MarriageFormValuesBackend {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposo: PersonFormValues;
  esposa: PersonFormValues;
  fechaMatrimonio?: string;
  celebranteId?: number | null;
  lugarMatrimonio?: string;
  testigo1?: string;
  testigo2?: string;
  testigo3?: string;
  testigo4?: string;
  notasMarginales?: string;
}

const PAGE_SIZE = 20;

export const MarriageService = {
  search(
    params: SearchMarriagesParams,
    token: string,
  ): Promise<{ marriages: MarriageRow[]; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.nombre) query.set('nombre', params.nombre);
    if (params.apellidoPaterno) query.set('apellidoPaterno', params.apellidoPaterno);
    if (params.apellidoMaterno) query.set('apellidoMaterno', params.apellidoMaterno);
    query.set('sortBy', params.sortBy);
    query.set('sortDirection', params.sortDirection);
    query.set('page', String(params.page));
    query.set('pageSize', String(PAGE_SIZE));

    return apiRequest(`/api/marriages?${query.toString()}`, { token });
  },

  getById(id: number, token: string): Promise<{ marriage: Record<string, unknown> }> {
    return apiRequest(`/api/marriages/${id}`, { token });
  },

  create(
    values: MarriageFormValuesBackend,
    parroquiaId: number | undefined,
    token: string,
  ): Promise<{ id: number }> {
    return apiRequest('/api/marriages', {
      method: 'POST',
      body: { ...values, parroquiaId },
      token,
    });
  },

  update(
    id: number,
    values: MarriageFormValuesBackend,
    token: string,
  ): Promise<{ success: true }> {
    return apiRequest(`/api/marriages/${id}`, {
      method: 'PUT',
      body: values,
      token,
    });
  },

  annul(id: number, motivo: string, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/marriages/${id}/annul`, {
      method: 'PATCH',
      body: { motivo },
      token,
    });
  },
};
