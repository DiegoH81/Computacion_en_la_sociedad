import {
  ConfirmationService,
  type ConfirmationFormValuesBackend,
} from '../services/ConfirmationService';
import type { ConfirmationFormValues } from '../components/features/ConfirmationForm';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';
import { formatFechaDisplay } from './MarriageController';

export interface ConfirmationRowUI {
  id: number;
  parroquiaId: number;
  parroquiaNombre: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  nombreCompleto: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  estado: 'vigente' | 'anulado';
}

export interface SearchResult {
  success: boolean;
  confirmations?: ConfirmationRowUI[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

export { formatFechaDisplay };

export async function searchConfirmations(params: {
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

    const response = await ConfirmationService.search({ ...params, sortBy: sortByBackend });

    const confirmations: ConfirmationRowUI[] = response.confirmations.map((c) => ({
      id: c.id,
      parroquiaId: c.parroquia_id,
      parroquiaNombre: c.parroquia_nombre,
      numeroLibro: c.numero_libro,
      numeroFolio: c.numero_folio,
      numeroRegistro: c.numero_registro,
      nombreCompleto: c.nombre,
      apellidoPaterno: c.apellido_paterno,
      apellidoMaterno: c.apellido_materno,
      estado: c.estado,
    }));

    return { success: true, confirmations, totalPages: response.totalPages };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar partidas.',
    };
  }
}

function uiValuesToBackend(values: ConfirmationFormValues): ConfirmationFormValuesBackend {
  return {
    fechaSacramento: values.fechaSacramento,
    numeroLibro: values.numeroLibro,
    numeroFolio: values.numeroFolio,
    numeroRegistro: values.numeroRegistro,
    dni: values.persona.dni || undefined,
    nombre: values.persona.nombre,
    apellidoPaterno: values.persona.apellidoPaterno,
    apellidoMaterno: values.persona.apellidoMaterno,
    fechaNacimiento: values.persona.fechaNacimiento || undefined,
    edad: values.persona.edad || undefined,
    lugarNacimiento: values.persona.lugarNacimiento || undefined,
    padreNombre: values.persona.padreNombre || undefined,
    madreNombre: values.persona.madreNombre || undefined,
    fechaConfirmacion: values.celebracion.fechaCelebracion || undefined,
    celebranteId: values.celebracion.celebranteId,
    padrino: values.celebracion.padrino || undefined,
    madrina: values.celebracion.madrina || undefined,
    anotaciones: values.celebracion.anotaciones || undefined,
  };
}

export async function createConfirmation(
  values: ConfirmationFormValues,
): Promise<MutationResult> {
  try {
    const parroquiaActivaId = useSessionStore.getState().parroquiaActivaId;
    const rol = useSessionStore.getState().rol;

    const parroquiaId = rol === 'admin' ? (parroquiaActivaId ?? undefined) : undefined;

    await ConfirmationService.create(uiValuesToBackend(values), parroquiaId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear la partida.',
    };
  }
}

export async function updateConfirmation(
  confirmationId: number,
  values: ConfirmationFormValues,
): Promise<MutationResult> {
  try {
    await ConfirmationService.update(confirmationId, uiValuesToBackend(values));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al editar la partida.',
    };
  }
}

export async function annulConfirmation(
  confirmationId: number,
  motivo: string,
): Promise<MutationResult> {
  try {
    await ConfirmationService.annul(confirmationId, motivo);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al anular la partida.',
    };
  }
}
