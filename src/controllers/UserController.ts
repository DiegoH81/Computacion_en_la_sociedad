import type { SearchFilters, User } from '../../shared/models';
import { UserService } from '../services/UserService';
import { AuthService, type Parish } from '../services/AuthService';
import { requireToken as requireWorkerToken, toErrorResult } from '../lib/workerAccess';

const PASSWORD_MIN_LENGTH = 8;

export interface SearchResult {
  success: boolean;
  users?: User[];
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

const requireToken = () => requireWorkerToken('La gestión de usuarios necesita conexión a internet.');

// Validación del lado del cliente: da respuesta inmediata, pero el Worker repite
// estas reglas y es la barrera real. Los textos coinciden con los del Worker.

function validateName(user: User): string | null {
  if (!user.nombre.trim() || !user.apellido_paterno.trim()) {
    return 'Nombre y apellido paterno son requeridos.';
  }
  return null;
}

/** Al crear la contraseña es obligatoria; al editar, vacía significa "no cambiar". */
function validatePassword(password: string, confirmPassword: string, mode: 'create' | 'edit'): string | null {
  if (mode === 'edit' && !password) {
    return confirmPassword ? 'Las contraseñas no coinciden.' : null;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

/**
 * La parroquia es una existente (parroquia_id) o una nueva que se crea con la cuenta (parroquia_nueva).
 * Un administrador no es de ninguna parroquia.
 */
function validateParish(user: User): string | null {
  if (user.rol === 'admin') return null;
  if (user.parroquia_nueva !== undefined) {
    return user.parroquia_nueva.trim() ? null : 'El nombre de la parroquia nueva es requerido.';
  }
  return user.parroquia_id === null ? 'Debe seleccionar una parroquia.' : null;
}

/** Nombre y apellidos sin espacios sobrantes. */
function trimNames(user: User): User {
  return {
    ...user,
    nombre: user.nombre.trim(),
    apellido_paterno: user.apellido_paterno.trim(),
    apellido_materno: user.apellido_materno.trim(),
  };
}

export async function searchUsers(filters: SearchFilters): Promise<SearchResult> {
  try {
    const token = requireToken();
    const page = await UserService.search(filters, token);
    return { success: true, users: page.resultados, totalPages: page.total_paginas };
  } catch (error) {
    return toErrorResult(error, 'Error al buscar usuarios.');
  }
}

/** Parroquias para el selector del formulario. */
export async function loadParishes(): Promise<ParishesResult> {
  try {
    const response = await AuthService.getParishes();
    return { success: true, parishes: response.parroquias };
  } catch (error) {
    return toErrorResult(error, 'No se pudieron cargar las parroquias.');
  }
}

/** confirmPassword solo sirve para validar aquí: no se envía. */
export async function createUser(user: User, confirmPassword: string): Promise<MutationResult> {
  const nameError = validateName(user);
  if (nameError) return { success: false, errorMessage: nameError };

  if (!user.username.trim()) {
    return { success: false, errorMessage: 'El nombre de usuario es requerido.' };
  }

  const parishError = validateParish(user);
  if (parishError) return { success: false, errorMessage: parishError };

  const passwordError = validatePassword(user.password ?? '', confirmPassword, 'create');
  if (passwordError) return { success: false, errorMessage: passwordError };

  try {
    const token = requireToken();
    const body: User = { ...trimNames(user), username: user.username.trim() };
    if (body.rol === 'admin') {
      body.parroquia_id = null;
      delete body.parroquia_nueva;
    } else if (body.parroquia_nueva !== undefined) {
      body.parroquia_nueva = body.parroquia_nueva.trim();
    }

    await UserService.create(body, token);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al crear el usuario.');
  }
}

/** Solo se envía la contraseña si se escribió una nueva. */
export async function updateUser(user: User, confirmPassword: string): Promise<MutationResult> {
  const nameError = validateName(user);
  if (nameError) return { success: false, errorMessage: nameError };

  const passwordError = validatePassword(user.password ?? '', confirmPassword, 'edit');
  if (passwordError) return { success: false, errorMessage: passwordError };

  try {
    const token = requireToken();
    const body = trimNames(user);
    if (!body.password) delete body.password;

    await UserService.update(body, token);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al editar el usuario.');
  }
}

/** Sin conexión o si falla, se toma como que no es el principal: la pantalla solo oculta opciones. */
export async function loadIsPrincipal(): Promise<boolean> {
  try {
    const response = await UserService.me(requireToken());
    return response.principal;
  } catch {
    return false;
  }
}

export async function makePrincipal(userId: number): Promise<MutationResult> {
  try {
    await UserService.makePrincipal(userId, requireToken());
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al pasar la marca de administrador principal.');
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
