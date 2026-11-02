import { localRequest } from '../lib/localClient';

export type DuplicateSacrament = 'bautismo' | 'confirmacion' | 'matrimonio';

export interface DuplicatePerson {
  para?: string;
  dni: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  padreNombre: string;
  madreNombre: string;
}

export interface DuplicateMatch {
  sacramentoId: number;
  para: string;
  nivel: 'alta' | 'posible';
  porcentaje: number;
  coincide: string[];
  nombreCompleto: string;
  parroquia: string;
  libro: string;
  folio: string;
  numero: string;
}

export interface DuplicateResult {
  matches: DuplicateMatch[];
  total: number;
}

export const DuplicateService = {
  find(tipo: DuplicateSacrament, excludeId: number | undefined, personas: DuplicatePerson[]): Promise<DuplicateResult> {
    return localRequest('sacraments.findDuplicates', { tipo, excludeId, personas });
  },
};
