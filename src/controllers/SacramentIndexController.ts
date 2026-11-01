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
  request: (parroquiaId: number, token: string) => Promise<T>,
): Promise<Result<T>> {
  const { token, parroquiaActivaId } = useSessionStore.getState();
  if (!token || !parroquiaActivaId) {
    return { success: false, errorMessage: 'Sesión no válida.' };
  }

  try {
    return { success: true, data: await request(parroquiaActivaId, token) };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : fallbackMessage,
    };
  }
}

export function loadIndexBooks(tipo: SacramentType): Promise<Result<string[]>> {
  return withActiveParish('Error al cargar los libros.', async (parroquiaId, token) => {
    const { libros } = await SacramentIndexService.listBooks(tipo, parroquiaId, token);
    return libros;
  });
}

export function loadIndexEntries(
  tipo: SacramentType,
  libro: string | null,
): Promise<Result<SacramentIndexEntry[]>> {
  return withActiveParish('Error al cargar el índice.', async (parroquiaId, token) => {
    const { entries } = await SacramentIndexService.getEntries(tipo, parroquiaId, libro, token);
    return entries;
  });
}
