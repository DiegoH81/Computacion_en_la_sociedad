import { apiRequest } from '../lib/apiClient';

export interface BaptismRow {
  id: number;
  parroquia_id: number;
  parroquia_nombre: string;
  numero_libro: string;
  numero_folio: string;
  numero_registro: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  estado: 'vigente' | 'anulado';
}

export interface SearchBaptismsParams {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
}

export interface BaptismFormValuesBackend {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
  fechaBautizo?: string;
  celebranteId?: number | null;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

const PAGE_SIZE = 20;

export const BaptismService = {
  search(
    params: SearchBaptismsParams,
    token: string,
  ): Promise<{ baptisms: BaptismRow[]; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.nombre) query.set('nombre', params.nombre);
    if (params.apellidoPaterno) query.set('apellidoPaterno', params.apellidoPaterno);
    if (params.apellidoMaterno) query.set('apellidoMaterno', params.apellidoMaterno);
    query.set('sortBy', params.sortBy);
    query.set('sortDirection', params.sortDirection);
    query.set('page', String(params.page));
    query.set('pageSize', String(PAGE_SIZE));

    return apiRequest(`/api/baptisms?${query.toString()}`, { token });
  },

  getById(id: number, token: string): Promise<{ baptism: Record<string, unknown> }> {
    return apiRequest(`/api/baptisms/${id}`, { token });
  },

  create(
    values: BaptismFormValuesBackend,
    parroquiaId: number | undefined,
    token: string,
  ): Promise<{ id: number }> {
    return apiRequest('/api/baptisms', {
      method: 'POST',
      body: { ...values, parroquiaId },
      token,
    });
  },

  update(
    id: number,
    values: BaptismFormValuesBackend,
    token: string,
  ): Promise<{ success: true }> {
    return apiRequest(`/api/baptisms/${id}`, {
      method: 'PUT',
      body: values,
      token,
    });
  },

  annul(id: number, motivo: string, token: string): Promise<{ success: true }> {
    return apiRequest(`/api/baptisms/${id}/annul`, {
      method: 'PATCH',
      body: { motivo },
      token,
    });
  },
};
