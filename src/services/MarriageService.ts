import type { PersonCorrection } from '../lib/personCorrections';
import { localRequest } from '../lib/localClient';

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
  dni?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  edad?: string;
  parroquiaBautismo?: string;
  fechaBautismo?: string;
  padreNombre?: string;
  madreNombre?: string;
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
  correcciones?: PersonCorrection[];
}

export const MarriageService = {
  search(params: SearchMarriagesParams): Promise<{ marriages: MarriageRow[]; totalPages: number }> {
    return localRequest('marriages.search', params);
  },

  getById(id: number): Promise<{ marriage: Record<string, unknown> }> {
    return localRequest('marriages.get', { id });
  },

  create(values: MarriageFormValuesBackend, parroquiaId: number | undefined): Promise<{ id: number }> {
    return localRequest('marriages.create', { values, parroquiaId });
  },

  update(id: number, values: MarriageFormValuesBackend): Promise<{ success: true }> {
    return localRequest('marriages.update', { id, values });
  },

  annul(id: number, motivo: string): Promise<{ success: true }> {
    return localRequest('marriages.annul', { id, motivo });
  },
};
