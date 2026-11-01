import { localRequest } from '../lib/localClient';

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
  dni?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento?: string;
  edad?: string;
  lugarNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
  fechaBautizo?: string;
  celebranteId?: number | null;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

export const BaptismService = {
  search(params: SearchBaptismsParams): Promise<{ baptisms: BaptismRow[]; totalPages: number }> {
    return localRequest('baptisms.search', params);
  },

  getById(id: number): Promise<{ baptism: Record<string, unknown> }> {
    return localRequest('baptisms.get', { id });
  },

  create(values: BaptismFormValuesBackend, parroquiaId: number | undefined): Promise<{ id: number }> {
    return localRequest('baptisms.create', { values, parroquiaId });
  },

  update(id: number, values: BaptismFormValuesBackend): Promise<{ success: true }> {
    return localRequest('baptisms.update', { id, values });
  },

  annul(id: number, motivo: string): Promise<{ success: true }> {
    return localRequest('baptisms.annul', { id, motivo });
  },
};
