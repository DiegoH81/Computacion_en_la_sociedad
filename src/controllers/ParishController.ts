import type { Parish } from '../../shared/models';
import { ParishService } from '../services/ParishService';
import { requireToken, toErrorResult } from '../lib/workerAccess';

// Gestión de parroquias (solo admin). Las parroquias no se borran: se deshabilitan.
// Las PCs reciben los cambios en su siguiente sincronización.

const OFFLINE_MESSAGE = 'La gestión de parroquias necesita conexión a internet.';

/** Lo que se edita de una parroquia; sin id es una parroquia nueva. */
export type ParishFields = Pick<Parish, 'nombre' | 'ubicacion'> & { id?: number };

export interface ParishListResult {
  success: boolean;
  parishes?: Parish[];
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

/** Nombre sin espacios sobrantes y ubicación vacía como null. El Worker repite estas reglas. */
function cleanParish(parish: Pick<Parish, 'nombre' | 'ubicacion'>): Pick<Parish, 'nombre' | 'ubicacion'> | null {
  const nombre = parish.nombre.trim();
  if (!nombre) return null;
  return { nombre, ubicacion: parish.ubicacion?.trim() || null };
}

export async function loadAllParishes(): Promise<ParishListResult> {
  try {
    const response = await ParishService.listAll(requireToken(OFFLINE_MESSAGE));
    return { success: true, parishes: response.parroquias };
  } catch (error) {
    return toErrorResult(error, 'No se pudieron cargar las parroquias.');
  }
}

/** Crea la parroquia si no tiene id; si lo tiene, la edita. */
export async function saveParish(parish: ParishFields): Promise<MutationResult> {
  const values = cleanParish(parish);
  if (!values) return { success: false, errorMessage: 'El nombre de la parroquia es requerido.' };

  try {
    const token = requireToken(OFFLINE_MESSAGE);
    if (parish.id === undefined) {
      await ParishService.create(values, token);
    } else {
      await ParishService.update({ ...values, id: parish.id }, token);
    }
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al guardar la parroquia.');
  }
}

export async function toggleParishActive(parishId: number): Promise<MutationResult> {
  try {
    await ParishService.toggleActive(parishId, requireToken(OFFLINE_MESSAGE));
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al cambiar el estado de la parroquia.');
  }
}
