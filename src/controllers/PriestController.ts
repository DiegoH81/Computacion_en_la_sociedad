import { PriestService, type PriestFormValues, type Priest } from '../services/PriestService';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';

export interface PriestRowUI {
  id: number;
  titulo: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parroquiaNombre: string;
  parroquiaId: number;
  activo: boolean;
}

export interface SearchResult {
  success: boolean;
  priests?: PriestRowUI[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

function toPriestRowUI(p: Priest): PriestRowUI {
  return {
    id: p.id,
    titulo: p.titulo ?? '',
    nombre: p.nombre,
    apellidoPaterno: p.apellido_paterno,
    apellidoMaterno: p.apellido_materno,
    parroquiaNombre: p.parroquia_nombre,
    parroquiaId: p.parroquia_id,
    activo: p.activo === 1,
  };
}

export async function searchPriests(params: {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';
  sortDirection: 'asc' | 'desc';
  page: number;
}): Promise<SearchResult> {
  try {
    // Traduce el nombre de campo de UI (camelCase) al que espera el backend (snake_case).
    const sortByBackend =
      params.sortBy === 'apellidoPaterno'
        ? 'apellido_paterno'
        : params.sortBy === 'apellidoMaterno'
          ? 'apellido_materno'
          : 'nombre';

    const response = await PriestService.search({ ...params, sortBy: sortByBackend });

    return { success: true, priests: response.priests.map(toPriestRowUI), totalPages: response.totalPages };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar ministros.',
    };
  }
}

export async function createPriest(values: PriestFormValues): Promise<MutationResult> {
  try {
    const parroquiaActivaId = useSessionStore.getState().parroquiaActivaId;
    const rol = useSessionStore.getState().rol;

    const parroquiaId = rol === 'admin' ? (parroquiaActivaId ?? undefined) : undefined;

    await PriestService.create(values, parroquiaId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear el ministro.',
    };
  }
}

export async function updatePriest(
  priestId: number,
  values: PriestFormValues,
): Promise<MutationResult> {
  try {
    await PriestService.update(priestId, values);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al editar el ministro.',
    };
  }
}

export async function togglePriestActive(priestId: number): Promise<MutationResult> {
  try {
    await PriestService.toggleActive(priestId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al cambiar el estado.',
    };
  }
}
