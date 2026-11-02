import { localRequest } from '../lib/localClient';

export type SacramentKey = 'bautismo' | 'confirmacion' | 'matrimonio';
export type BySacrament = Record<SacramentKey, number>;

export interface Statistics {
  anios: number[];
  anio: number;
  esAnioActual: boolean;
  totales: Record<SacramentKey, { anio: number; anterior: number; mes: number; historico: number }>;
  mensual: (BySacrament & { mes: number })[];
  tendencia: (BySacrament & { anio: number })[];
  bandasEdad: string[];
  edades: Record<SacramentKey, { bandas: number[]; sinDato: number; promedio: number | null }>;
  ministros: { nombre: string; total: number }[];
  registro: { anuladas: number; sinCelebrante: number; conCorrecciones: number };
}

export const StatisticsService = {
  get(parroquiaId: number, anio: number | undefined): Promise<Statistics> {
    return localRequest('statistics.get', { parroquiaId, anio });
  },
};
