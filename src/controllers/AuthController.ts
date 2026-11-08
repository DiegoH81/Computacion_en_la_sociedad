import { AuthService } from '../services/AuthService';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '../store/syncStore';

export interface LoginControllerResult {
  success: boolean;
  errorMessage?: string;
  redirectTo?: '/dashboard' | '/parroquias/seleccionar';
}

/**
 * Orquesta el flujo de login: valida entrada, invoca el Service,
 * actualiza el store de sesión con el resultado, y decide a qué
 * ruta debe navegar la View según el rol del usuario.
 *
 * No sabe cómo se hace el fetch (eso es AuthService/apiClient).
 * No sabe cómo se renderiza nada (eso es LoginPage).
 */
export async function handleLogin(
  username: string,
  password: string,
): Promise<LoginControllerResult> {
  if (!username.trim() || !password.trim()) {
    return { success: false, errorMessage: 'Ingrese usuario y contraseña.' };
  }

  try {
    const response = await AuthService.login(username, password);

    useSessionStore.getState().setSession({
      token: response.token,
      usuarioId: response.usuario.id,
      usuarioNombre: response.usuario.nombre_completo,
      rol: response.usuario.rol,
      parroquiaId: response.usuario.parroquia_id,
      // El administrador general no es de ninguna parroquia: elige cuál consultar en SelectParishPage.
      parroquiaActivaId: response.usuario.parroquia_id ?? 0,
      parroquiaActivaNombre: response.usuario.parroquia_nombre ?? '',
    });

    const redirectTo =
      response.usuario.rol === 'admin_general' ? '/parroquias/seleccionar' : '/dashboard';

    return { success: true, redirectTo };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: 'Ocurrió un error inesperado.' };
  }
}

/** Aunque falle el cierre en Electron, la pantalla no debe seguir mostrando la sesión. */
export async function handleLogout(): Promise<void> {
  try {
    await AuthService.logout();
  } catch (error) {
    console.error('No se pudo cerrar la sesión local:', error);
  } finally {
    useSyncStore.getState().setStatus(null);
    useSessionStore.getState().clearSession();
  }
}
