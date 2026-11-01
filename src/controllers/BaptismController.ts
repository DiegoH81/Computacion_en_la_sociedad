import { BaptismService, type BaptismFormValuesBackend } from '../services/BaptismService';
import type { BaptismFormValues } from '../components/features/BaptismForm';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';
import { formatFechaDisplay } from './MarriageController';

export interface BaptismRowUI {
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
  baptisms?: BaptismRowUI[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

export { formatFechaDisplay };

export async function searchBaptisms(params: {
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

    const response = await BaptismService.search({ ...params, sortBy: sortByBackend });

    const baptisms: BaptismRowUI[] = response.baptisms.map((b) => ({
      id: b.id,
      parroquiaId: b.parroquia_id,
      parroquiaNombre: b.parroquia_nombre,
      numeroLibro: b.numero_libro,
      numeroFolio: b.numero_folio,
      numeroRegistro: b.numero_registro,
      nombreCompleto: b.nombre,
      apellidoPaterno: b.apellido_paterno,
      apellidoMaterno: b.apellido_materno,
      estado: b.estado,
    }));

    return { success: true, baptisms, totalPages: response.totalPages };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al buscar partidas.',
    };
  }
}

function uiValuesToBackend(values: BaptismFormValues): BaptismFormValuesBackend {
  return {
    fechaSacramento: values.fechaSacramento,
    numeroLibro: values.numeroLibro,
    numeroFolio: values.numeroFolio,
    numeroRegistro: values.numeroRegistro,
    dni: values.dni || undefined,
    nombre: values.nombre,
    apellidoPaterno: values.apellidoPaterno,
    apellidoMaterno: values.apellidoMaterno,
    fechaNacimiento: values.fechaNacimiento || undefined,
    edad: values.edad || undefined,
    lugarNacimiento: values.lugarNacimiento || undefined,
    padreNombre: values.padreNombre || undefined,
    madreNombre: values.madreNombre || undefined,
    fechaBautizo: values.fechaBautizo || undefined,
    celebranteId: values.celebranteId,
    padrino: values.padrino || undefined,
    madrina: values.madrina || undefined,
    anotaciones: values.anotaciones || undefined,
  };
}

export async function createBaptism(values: BaptismFormValues): Promise<MutationResult> {
  try {
    const parroquiaActivaId = useSessionStore.getState().parroquiaActivaId;
    const rol = useSessionStore.getState().rol;

    const parroquiaId = rol === 'admin' ? (parroquiaActivaId ?? undefined) : undefined;

    await BaptismService.create(uiValuesToBackend(values), parroquiaId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al crear la partida.',
    };
  }
}

export async function updateBaptism(
  baptismId: number,
  values: BaptismFormValues,
): Promise<MutationResult> {
  try {
    await BaptismService.update(baptismId, uiValuesToBackend(values));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al editar la partida.',
    };
  }
}

export async function annulBaptism(baptismId: number, motivo: string): Promise<MutationResult> {
  try {
    await BaptismService.annul(baptismId, motivo);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof ApiError ? error.message : 'Error al anular la partida.',
    };
  }
}
