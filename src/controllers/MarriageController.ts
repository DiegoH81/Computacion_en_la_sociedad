import { MarriageService, type MarriageFormValuesBackend } from '../services/MarriageService';
import type { MarriageFormValues } from '../components/features/MarriageForm';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';

export interface MarriageRowUI {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposoNombreCompleto: string;
  esposaNombreCompleto: string;
  estado: 'vigente' | 'anulado';
}

export interface SearchResult {
  success: boolean;
  marriages?: MarriageRowUI[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

/**
 * Convierte una fecha ISO (YYYY-MM-DD, formato de almacenamiento en D1)
 * a DD/MM/AAAA (formato de presentación confirmado para Perú).
 * La conversión vive aquí, nunca en el Worker ni en D1.
 */
export function formatFechaDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export async function searchMarriages(params: {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';
  sortDirection: 'asc' | 'desc';
  page: number;
}): Promise<SearchResult> {
  try {
    const sortByBackend =
      params.sortBy === 'apellidoPaterno'
        ? 'apellido_paterno'
        : params.sortBy === 'apellidoMaterno'
          ? 'apellido_materno'
          : 'nombre';

    const response = await MarriageService.search({ ...params, sortBy: sortByBackend });

    const marriages: MarriageRowUI[] = response.marriages.map((m) => ({
      id: m.id,
      parroquiaId: m.parroquia_id,
      parroquiaNombre: m.parroquia_nombre,
      numeroLibro: m.numero_libro,
      numeroFolio: m.numero_folio,
      numeroRegistro: m.numero_registro,
      esposoNombreCompleto: `${m.esposo_nombre} ${m.esposo_apellido_paterno} ${m.esposo_apellido_materno}`,
      esposaNombreCompleto: `${m.esposa_nombre} ${m.esposa_apellido_paterno} ${m.esposa_apellido_materno}`,
      estado: m.estado,
    }));

    return { success: true, marriages, totalPages: response.totalPages };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar partidas.',
    };
  }
}

function uiValuesToBackend(values: MarriageFormValues): MarriageFormValuesBackend {
  return {
    fechaSacramento: values.fechaSacramento,
    numeroLibro: values.numeroLibro,
    numeroFolio: values.numeroFolio,
    numeroRegistro: values.numeroRegistro,
    esposo: values.esposo,
    esposa: values.esposa,
    fechaMatrimonio: values.fechaMatrimonio || undefined,
    celebranteId: values.celebranteId,
    lugarMatrimonio: values.lugarMatrimonio || undefined,
    testigo1: values.testigo1 || undefined,
    testigo2: values.testigo2 || undefined,
    testigo3: values.testigo3 || undefined,
    testigo4: values.testigo4 || undefined,
    notasMarginales: values.notasMarginales || undefined,
  };
}

export async function createMarriage(values: MarriageFormValues): Promise<MutationResult> {
  try {
    const parroquiaActivaId = useSessionStore.getState().parroquiaActivaId;
    const rol = useSessionStore.getState().rol;

    const parroquiaId = rol === 'admin' ? (parroquiaActivaId ?? undefined) : undefined;

    await MarriageService.create(uiValuesToBackend(values), parroquiaId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear la partida.',
    };
  }
}

export async function updateMarriage(
  marriageId: number,
  values: MarriageFormValues,
): Promise<MutationResult> {
  try {
    await MarriageService.update(marriageId, uiValuesToBackend(values));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al editar la partida.',
    };
  }
}

export async function annulMarriage(
  marriageId: number,
  motivo: string,
): Promise<MutationResult> {
  try {
    await MarriageService.annul(marriageId, motivo);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al anular la partida.',
    };
  }
}
