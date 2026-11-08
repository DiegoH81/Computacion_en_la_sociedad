import { useSessionStore } from '../store/sessionStore';

/**
 * Las estadísticas solo se muestran para la parroquia del usuario.
 * Si el usuario no pertenece a ninguna parroquia (p. ej. un admin general) se muestran siempre.
 */
export function useCanSeeStatistics(): boolean {
  const parroquiaId = useSessionStore((state) => state.parroquiaId);
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);

  return parroquiaId === null || parroquiaActivaId === parroquiaId;
}
