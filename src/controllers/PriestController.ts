import { PriestService, type PriestFormValues } from '../services/PriestService';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';

export interface PriestRowUI {
  id: number;
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

function requireToken(): string {
  const token = useSessionStore.getState().token;
  if (!token) throw new ApiError('Sesión no válida.', 401);
  return token;
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
    const token = requireToken();

    // Traduce el nombre de campo de UI (camelCase) al que espera el backend (snake_case).
    const sortByBackend =
      params.sortBy === 'apellidoPaterno'
        ? 'apellido_paterno'
        : params.sortBy === 'apellidoMaterno'
          ? 'apellido_materno'
          : 'nombre';

    const response = await PriestService.search(
      { ...params, sortBy: sortByBackend },
      token,
    );

    const priests: PriestRowUI[] = response.priests.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellidoPaterno: p.apellido_paterno,
      apellidoMaterno: p.apellido_materno,
      parroquiaNombre: p.parroquia_nombre,
      parroquiaId: p.parroquia_id,
      activo: p.activo === 1,
    }));

    return { success: true, priests, totalPages: response.totalPages };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar sacerdotes.',
    };
  }
}

export async function createPriest(values: PriestFormValues): Promise<MutationResult> {
  try {
    const token = requireToken();
    const parroquiaActivaId = useSessionStore.getState().parroquiaActivaId;
    const rol = useSessionStore.getState().rol;

    // Solo se envía parroquiaId explícito cuando el rol es admin (§5, confirmado);
    // para usuario_parroquia el Worker ignora este campo y usa el del JWT.
    const parroquiaId = rol === 'admin' ? (parroquiaActivaId ?? undefined) : undefined;

    await PriestService.create(values, parroquiaId, token);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear el sacerdote.',
    };
  }
}

export async function updatePriest(
  priestId: number,
  values: PriestFormValues,
): Promise<MutationResult> {
  try {
    const token = requireToken();
    await PriestService.update(priestId, values, token);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al editar el sacerdote.',
    };
  }
}

export async function togglePriestActive(priestId: number): Promise<MutationResult> {
  try {
    const token = requireToken();
    await PriestService.toggleActive(priestId, token);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al cambiar el estado.',
    };
  }
}
