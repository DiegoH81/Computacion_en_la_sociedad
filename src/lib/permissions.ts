import type { Role } from '../../shared/sync';
import { useSessionStore } from '../store/sessionStore';

// Lo que la pantalla muestra según el rol. Es solo comodidad: Electron y el Worker revisan lo mismo
// en cada operación (electron/main/models/parish.ts y shared/users.ts).
//
//   admin_general     consulta todas las parroquias; gestiona parroquias y cuentas.
//   admin_parroquia   en su parroquia: registra, edita, anula, aprueba correcciones e importa.
//   usuario           en su parroquia: registra partidas y ministros, y pide correcciones.

export const ROLE_LABELS: Record<Role, string> = {
  admin_general: 'Administrador general',
  admin_parroquia: 'Administrador de parroquia',
  usuario: 'Usuario',
};

export interface Permissions {
  /** Está viendo su propia parroquia y puede registrar en ella. */
  canWrite: boolean;
  /** Puede editar directamente, anular y aprobar correcciones (el párroco, en su parroquia). */
  canAdminister: boolean;
  /** Solo puede pedir correcciones de las partidas existentes. */
  onlyRequestsCorrections: boolean;
  canManageUsers: boolean;
  canManageParishes: boolean;
}

export function permissionsOf(rol: Role | null, parroquiaId: number | null, parroquiaActivaId: number | null): Permissions {
  const inOwnParish = rol !== 'admin_general' && parroquiaId !== null && parroquiaActivaId === parroquiaId;

  return {
    canWrite: inOwnParish,
    canAdminister: inOwnParish && rol === 'admin_parroquia',
    onlyRequestsCorrections: inOwnParish && rol === 'usuario',
    canManageUsers: rol === 'admin_general' || rol === 'admin_parroquia',
    canManageParishes: rol === 'admin_general',
  };
}

export function usePermissions(): Permissions {
  const rol = useSessionStore((state) => state.rol);
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);

  return permissionsOf(rol, parroquiaId, parroquiaActivaId);
}
