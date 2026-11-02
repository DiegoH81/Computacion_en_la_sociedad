import {
  UserService,
  type CreateUserBody,
  type ParishChoiceBody,
  type UpdateUserBody,
} from '../services/UserService';
import { AuthService, type Parish } from '../services/AuthService';
import type { UserFormValues } from '../components/features/UserFormModal';
import type { UserRow } from '../components/features/UserTable';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';
import { OFFLINE_TOKEN } from '../../electron/shared';

const PASSWORD_MIN_LENGTH = 8;

export interface SearchResult {
  success: boolean;
  users?: UserRow[];
  totalPages?: number;
  errorMessage?: string;
}

export interface MutationResult {
  success: boolean;
  errorMessage?: string;
}

export interface ParishesResult {
  success: boolean;
  parishes?: Parish[];
  errorMessage?: string;
}

function requireToken(): string {
  const token = useSessionStore.getState().token;
  if (!token) throw new ApiError('Sesión no válida.', 401);
  if (token === OFFLINE_TOKEN) throw new ApiError('La gestión de usuarios necesita conexión a internet.', 0);
  return token;
}

function toErrorResult(error: unknown, fallback: string): { success: false; errorMessage: string } {
  return {
    success: false,
    errorMessage: error instanceof ApiError ? error.message : fallback,
  };
}

// Validación del lado del cliente: da respuesta inmediata, pero el Worker repite
// estas reglas y es la barrera real. Los textos coinciden con los del Worker.

function validateName(values: UserFormValues): string | null {
  if (!values.nombre.trim() || !values.apellidoPaterno.trim()) {
    return 'Nombre y apellido paterno son requeridos.';
  }
  return null;
}

/** Al crear la contraseña es obligatoria; al editar, vacía significa "no cambiar". */
function validatePassword(values: UserFormValues, mode: 'create' | 'edit'): string | null {
  if (mode === 'edit' && !values.password) {
    return values.confirmPassword ? 'Las contraseñas no coinciden.' : null;
  }
  if (values.password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (values.password !== values.confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

function toParishChoice(
  parroquia: UserFormValues['parroquia'],
): { ok: true; value: ParishChoiceBody } | { ok: false; message: string } {
  if (parroquia.kind === 'new') {
    const nombre = parroquia.nombre.trim();
    return nombre
      ? { ok: true, value: { kind: 'new', nombre } }
      : { ok: false, message: 'El nombre de la parroquia nueva es requerido.' };
  }
  return parroquia.parroquiaId === null
    ? { ok: false, message: 'Debe seleccionar una parroquia.' }
    : { ok: true, value: { kind: 'existing', parroquiaId: parroquia.parroquiaId } };
}

export async function searchUsers(params: {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellidoPaterno' | 'apellidoMaterno';
  sortDirection: 'asc' | 'desc';
  page: number;
}): Promise<SearchResult> {
  try {
    const token = requireToken();

    // Traduce el nombre de campo de UI (camelCase) al del backend (snake_case).
    const sortByBackend =
      params.sortBy === 'apellidoPaterno'
        ? 'apellido_paterno'
        : params.sortBy === 'apellidoMaterno'
          ? 'apellido_materno'
          : 'nombre';

    const response = await UserService.search({ ...params, sortBy: sortByBackend }, token);

    const users: UserRow[] = response.users.map((u) => ({
      id: u.id,
      username: u.username,
      nombre: u.nombre,
      apellidoPaterno: u.apellido_paterno,
      apellidoMaterno: u.apellido_materno,
      parroquiaNombre: u.parroquia_nombre,
      activo: u.activo === 1,
    }));

    return { success: true, users, totalPages: response.totalPages };
  } catch (error) {
    return toErrorResult(error, 'Error al buscar usuarios.');
  }
}

/** Parroquias para el selector del formulario. */
export async function loadParishes(): Promise<ParishesResult> {
  try {
    const response = await AuthService.getParishes();
    return { success: true, parishes: response.parishes };
  } catch (error) {
    return toErrorResult(error, 'No se pudieron cargar las parroquias.');
  }
}

export async function createUser(values: UserFormValues): Promise<MutationResult> {
  const nameError = validateName(values);
  if (nameError) return { success: false, errorMessage: nameError };

  if (!values.username.trim()) {
    return { success: false, errorMessage: 'El nombre de usuario es requerido.' };
  }

  const parish = toParishChoice(values.parroquia);
  if (!parish.ok) return { success: false, errorMessage: parish.message };

  const passwordError = validatePassword(values, 'create');
  if (passwordError) return { success: false, errorMessage: passwordError };

  try {
    const token = requireToken();

    // confirmPassword no se envía: solo sirve para validar en el cliente.
    const body: CreateUserBody = {
      nombre: values.nombre.trim(),
      apellidoPaterno: values.apellidoPaterno.trim(),
      apellidoMaterno: values.apellidoMaterno.trim(),
      username: values.username.trim(),
      password: values.password,
      parroquia: parish.value,
    };

    await UserService.create(body, token);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al crear el usuario.');
  }
}

export async function updateUser(userId: number, values: UserFormValues): Promise<MutationResult> {
  const nameError = validateName(values);
  if (nameError) return { success: false, errorMessage: nameError };

  const passwordError = validatePassword(values, 'edit');
  if (passwordError) return { success: false, errorMessage: passwordError };

  try {
    const token = requireToken();

    const body: UpdateUserBody = {
      nombre: values.nombre.trim(),
      apellidoPaterno: values.apellidoPaterno.trim(),
      apellidoMaterno: values.apellidoMaterno.trim(),
    };
    // Solo se envía la contraseña si se escribió una nueva.
    if (values.password) {
      body.password = values.password;
    }

    await UserService.update(userId, body, token);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al editar el usuario.');
  }
}

export async function toggleUserActive(userId: number): Promise<MutationResult> {
  try {
    const token = requireToken();
    await UserService.toggleActive(userId, token);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al cambiar el estado del usuario.');
  }
}
