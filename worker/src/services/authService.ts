import { verifyPassword } from '../lib/password';
import { signJwt } from '../lib/jwt';

interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  rol: 'admin' | 'usuario_parroquia';
  parroquia_id: number | null;
  activo: number;
}

interface ParroquiaRow {
  id: number;
  nombre: string;
}

export interface LoginResult {
  success: true;
  token: string;
  usuario: {
    id: number;
    nombreCompleto: string;
    rol: 'admin' | 'usuario_parroquia';
    parroquiaId: number | null;
    parroquiaNombre: string | null;
  };
}

export interface LoginError {
  success: false;
  message: string;
}

export async function login(
  db: D1Database,
  jwtSecret: string,
  username: string,
  plainPassword: string,
): Promise<LoginResult | LoginError> {
  const usuario = await db
    .prepare(
      `SELECT id, username, password_hash, nombre, apellido_paterno, apellido_materno,
              rol, parroquia_id, activo
       FROM usuarios WHERE username = ?`,
    )
    .bind(username)
    .first<UsuarioRow>();

  // Mensaje genérico en ambos casos (usuario inexistente o password incorrecto)
  // para no permitir enumeración de usuarios válidos (regla de negocio, §0/Fase 1).
  const genericError: LoginError = {
    success: false,
    message: 'Usuario o contraseña incorrectos.',
  };

  if (!usuario) {
    return genericError;
  }

  if (usuario.activo !== 1) {
    return genericError;
  }

  const isPasswordValid = await verifyPassword(plainPassword, usuario.password_hash);
  if (!isPasswordValid) {
    return genericError;
  }

  let parroquiaNombre: string | null = null;
  if (usuario.parroquia_id !== null) {
    const parroquia = await db
      .prepare('SELECT id, nombre FROM parroquias WHERE id = ?')
      .bind(usuario.parroquia_id)
      .first<ParroquiaRow>();
    parroquiaNombre = parroquia?.nombre ?? null;
  }

  const token = await signJwt(
    {
      usuarioId: usuario.id,
      rol: usuario.rol,
      parroquiaId: usuario.parroquia_id,
    },
    jwtSecret,
  );

  return {
    success: true,
    token,
    usuario: {
      id: usuario.id,
      // filter(Boolean): una cuenta sin apellido materno no deja espacios sobrantes.
      nombreCompleto: [usuario.nombre, usuario.apellido_paterno, usuario.apellido_materno]
        .filter(Boolean)
        .join(' '),
      rol: usuario.rol,
      parroquiaId: usuario.parroquia_id,
      parroquiaNombre,
    },
  };
}
