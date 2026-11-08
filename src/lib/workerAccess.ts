import { ApiError } from './apiClient';
import { useSessionStore } from '../store/sessionStore';
import { OFFLINE_TOKEN } from '../../electron/shared';

// Lo que comparten los Controllers que hablan directo con el Worker (usuarios y parroquias):
// piden el token de la sesión y convierten los errores en un mensaje para la pantalla.

/** El token para el Worker. Sin conexión no hay token real, así que se avisa con `offlineMessage`. */
export function requireToken(offlineMessage: string): string {
  const token = useSessionStore.getState().token;
  if (!token) throw new ApiError('Sesión no válida.', 401);
  if (token === OFFLINE_TOKEN) throw new ApiError(offlineMessage, 0);
  return token;
}

/** El mensaje del Worker si lo hay; si no, `fallback`. */
export function toErrorResult(error: unknown, fallback: string): { success: false; errorMessage: string } {
  return {
    success: false,
    errorMessage: error instanceof ApiError ? error.message : fallback,
  };
}
