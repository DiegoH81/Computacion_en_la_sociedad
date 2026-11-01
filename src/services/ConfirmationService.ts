import { localRequest } from '../lib/localClient';

export interface ConfirmationRow {
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

export interface SearchConfirmationsParams {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
}

export interface ConfirmationFormValuesBackend {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  dni?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento?: string;
  edad?: string;
  lugarNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
  fechaConfirmacion?: string;
  celebranteId?: number | null;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

export const ConfirmationService = {
  search(
    params: SearchConfirmationsParams,
  ): Promise<{ confirmations: ConfirmationRow[]; totalPages: number }> {
    return localRequest('confirmations.search', params);
  },

  getById(id: number): Promise<{ confirmation: Record<string, unknown> }> {
    return localRequest('confirmations.get', { id });
  },

  create(values: ConfirmationFormValuesBackend, parroquiaId: number | undefined): Promise<{ id: number }> {
    return localRequest('confirmations.create', { values, parroquiaId });
  },

  update(id: number, values: ConfirmationFormValuesBackend): Promise<{ success: true }> {
    return localRequest('confirmations.update', { id, values });
  },

  annul(id: number, motivo: string): Promise<{ success: true }> {
    return localRequest('confirmations.annul', { id, motivo });
  },
};
