import type { SacramentRecord, SearchFilters, SearchPage } from '../../shared/models';
import type { SacramentType } from '../../shared/sync';
import { ApiError } from '../lib/apiClient';
import { SacramentService } from '../services/SacramentService';
import { useSessionStore } from '../store/sessionStore';

export interface SearchResult<T> {
  success: boolean;
  page?: SearchPage<T>;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export async function searchSacraments<T extends SacramentRecord>(tipo: SacramentType, filters: SearchFilters): Promise<SearchResult<T>> {
  try {
    const parroquia_id = useSessionStore.getState().parroquiaActivaId ?? undefined;
    return { success: true, page: await SacramentService.search<T>(tipo, { ...filters, parroquia_id }) };
  } catch (error) {
    return { success: false, errorMessage: messageOf(error, 'Error al buscar partidas.') };
  }
}

/**
 * Crea la partida si todavía no tiene id (siempre en la parroquia del usuario); si no, la edita.
 * Un usuario (ayudante) no edita: Electron guarda solo la corrección que pide, que queda pendiente.
 */
/** Guarda la partida. Devuelve su id, para poder imprimirla justo después. */
export async function saveSacrament(record: SacramentRecord): Promise<MutationResult & { id?: number }> {
  const isNew = record.sacramento.id === undefined;
  try {
    if (isNew) {
      const { id } = await SacramentService.create(record);
      return { success: true, id };
    }
    await SacramentService.update(record);
    return { success: true, id: record.sacramento.id };
  } catch (error) {
    return { success: false, errorMessage: messageOf(error, isNew ? 'Error al crear la partida.' : 'Error al editar la partida.') };
  }
}

export async function annulSacrament(id: number, motivo: string): Promise<MutationResult> {
  try {
    await SacramentService.annul(id, motivo);
    return { success: true };
  } catch (error) {
    return { success: false, errorMessage: messageOf(error, 'Error al anular la partida.') };
  }
}

export async function restoreSacrament(id: number, motivo: string): Promise<MutationResult> {
  try {
    await SacramentService.restore(id, motivo);
    return { success: true };
  } catch (error) {
    return { success: false, errorMessage: messageOf(error, 'Error al rehabilitar la partida.') };
  }
}
