import type { SearchFilters, User } from '../../shared/models';
import type { ParishRole } from '../../shared/sync';
import { UserService } from '../services/UserService';
import { AuthService, type Parish } from '../services/AuthService';
import { toErrorResult } from '../lib/workerAccess';
import { useSessionStore } from '../store/sessionStore';
import { password_error } from '../../shared/users';

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

// Validación del lado del cliente: da respuesta inmediata, pero Electron y el Worker repiten
// estas reglas y son la barrera real. Los textos coinciden con los suyos.

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
  const reason = password_error(password);
  if (reason) {
    return reason;
  }
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

/**
 * El administrador general no es de ninguna parroquia. Las demás cuentas sí: el admin general la elige,
 * y para el administrador de una parroquia la pone Electron (la suya).
 */
function validateParish(user: User): string | null {
  if (user.rol === 'admin_general') return null;
  if (useSessionStore.getState().rol !== 'admin_general') return null;
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
    const page = await UserService.search(filters);
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
    const body: User = { ...trimNames(user), username: user.username.trim() };
    delete body.parroquia_nueva;
    if (body.rol === 'admin_general') body.parroquia_id = null;

    await UserService.create(body);
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

  // Una cuenta que todavía no subió puede cambiar su nombre de usuario (y una que lo perdió, debe).
  if ((user.id ?? 0) < 0 && !user.username.trim()) {
    return { success: false, errorMessage: 'El nombre de usuario es requerido.' };
  }

  try {
    const body = { ...trimNames(user), username: user.username.trim() };
    if (!body.password) delete body.password;

    await UserService.update(body);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al editar el usuario.');
  }
}

/** Si falla, se toma como que no es el principal: la pantalla solo oculta opciones. */
export async function loadIsPrincipal(): Promise<boolean> {
  try {
    const response = await UserService.me();
    return response.principal;
  } catch {
    return false;
  }
}

/** Pasar la marca de principal se hace en el servidor (Electron lo pide): necesita internet. */
export async function makePrincipal(username: string, parishId?: number): Promise<MutationResult> {
  try {
    await UserService.makePrincipal(username, parishId);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al pasar la marca de administrador principal.');
  }
}

/** Parroquias adicionales: solo el admin_general, en el servidor (necesita internet). */
export async function setUserParish(userId: number, parishId: number, rol: ParishRole): Promise<MutationResult> {
  try {
    await UserService.setParish(userId, parishId, rol);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al guardar la parroquia de la cuenta.');
  }
}

export async function removeUserParish(userId: number, parishId: number): Promise<MutationResult> {
  try {
    await UserService.removeParish(userId, parishId);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al quitar la parroquia de la cuenta.');
  }
}

export async function toggleUserActive(userId: number): Promise<MutationResult> {
  try {
    await UserService.toggleActive(userId);
    return { success: true };
  } catch (error) {
    return toErrorResult(error, 'Error al cambiar el estado del usuario.');
  }
}
