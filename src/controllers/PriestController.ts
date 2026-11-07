import type { Minister, SearchFilters } from '../../shared/models';
import { ApiError } from '../lib/apiClient';
import { PriestService } from '../services/PriestService';

export interface SearchResult {
  success: boolean;
  priests?: Minister[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

/** "Manuel Torres Rios": como se muestra un ministro en las listas. */
export function ministerName(minister: Minister): string {
  return [minister.nombre, minister.apellido_paterno, minister.apellido_materno].filter(Boolean).join(' ');
}

/** Con parroquia_id busca solo en esa parroquia; sin él, en todas. */
export async function searchPriests(filters: SearchFilters): Promise<SearchResult> {
  try {
    const page = await PriestService.search(filters);
    return { success: true, priests: page.resultados, totalPages: page.total_paginas };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar ministros.',
    };
  }
}

/** Se crea siempre en la parroquia del usuario (lo decide Electron). */
export async function createPriest(minister: Minister): Promise<MutationResult & { id?: number }> {
  try {
    const { id } = await PriestService.create(minister);
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear el ministro.',
    };
  }
}

export async function updatePriest(minister: Minister): Promise<MutationResult> {
  try {
    await PriestService.update(minister);
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
