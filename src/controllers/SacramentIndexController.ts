import {
  SacramentIndexService,
  type SacramentIndexEntry,
  type SacramentType,
} from '../services/SacramentIndexService';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';

type Result<T> = { success: true; data: T } | { success: false; errorMessage: string };

async function withActiveParish<T>(
  fallbackMessage: string,
  request: (parroquiaId: number) => Promise<T>,
): Promise<Result<T>> {
  const { parroquiaActivaId } = useSessionStore.getState();
  if (!parroquiaActivaId) {
    return { success: false, errorMessage: 'Sesión no válida.' };
  }

  try {
    return { success: true, data: await request(parroquiaActivaId) };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : fallbackMessage,
    };
  }
}

export function loadIndexBooks(tipo: SacramentType): Promise<Result<string[]>> {
  return withActiveParish('Error al cargar los libros.', async (parroquiaId) => {
    const { libros } = await SacramentIndexService.listBooks(tipo, parroquiaId);
    return libros;
  });
}

export function loadIndexEntries(
  tipo: SacramentType,
  libro: string | null,
): Promise<Result<SacramentIndexEntry[]>> {
  return withActiveParish('Error al cargar el índice.', async (parroquiaId) => {
    const { entries } = await SacramentIndexService.getEntries(tipo, parroquiaId, libro);
    return entries;
  });
}
