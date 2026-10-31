import { AuthService } from '../services/AuthService';
import { ApiError } from '../lib/apiClient';
import { useSessionStore } from '../store/sessionStore';

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
      usuarioNombre: response.usuario.nombreCompleto,
      rol: response.usuario.rol,
      parroquiaId: response.usuario.parroquiaId,
      // Para un admin sin parroquia fija, no hay parroquia activa todavía;
      // se resuelve en SelectParishPage (flujo obligatorio, Fase 1).
      parroquiaActivaId: response.usuario.parroquiaId ?? 0,
      parroquiaActivaNombre: response.usuario.parroquiaNombre ?? '',
    });

    // Regla pendiente de Fase 4: admin siempre pasa primero por selección de parroquia.
    const redirectTo =
      response.usuario.rol === 'admin' ? '/parroquias/seleccionar' : '/dashboard';

    return { success: true, redirectTo };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: 'Ocurrió un error inesperado.' };
  }
}