import { verifyJwt, type JwtPayload } from '../lib/jwt';

export interface AuthResult {
  authenticated: true;
  payload: JwtPayload;
}

export interface AuthFailure {
  authenticated: false;
  status: number;
  message: string;
}

/**
 * Extrae el JWT del header Authorization ("Bearer <token>"), verifica su firma
 * y comprueba en D1 que el usuario siga existiendo y activo.
 *
 * La comprobación en D1 (una lectura por clave primaria) es lo que hace que
 * deshabilitar una cuenta corte su sesión de inmediato, en lugar de esperar a
 * que el JWT expire (8 horas).
 */
export async function authenticateRequest(
  request: Request,
  jwtSecret: string,
  db: D1Database,
): Promise<AuthResult | AuthFailure> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, message: 'Token no proporcionado.' };
  }

  const token = authHeader.slice('Bearer '.length);

  // Mismo mensaje para todos los motivos de rechazo: no damos pistas a un atacante
  // sobre si falló la firma, expiró el token o la cuenta está deshabilitada.
  const invalidSession: AuthFailure = {
    authenticated: false,
    status: 401,
    message: 'Sesión inválida o expirada.',
  };

  let payload: JwtPayload;
  try {
    payload = await verifyJwt(token, jwtSecret);
  } catch {
    // jwtVerify lanza tanto si el token expiró como si la firma es inválida.
    return invalidSession;
  }

  // Fuera del try/catch anterior a propósito: si D1 falla, debe verse como error
  // del servidor y no confundirse con un token inválido.
  const user = await db
    .prepare('SELECT activo FROM usuarios WHERE id = ?')
    .bind(payload.usuarioId)
    .first<{ activo: number }>();

  if (!user || user.activo !== 1) {
    return invalidSession;
  }

  return { authenticated: true, payload };
}
