import { useEffect, useState } from 'react';
import { loadParishes } from '../../controllers/UserController';
import { useSessionStore } from '../../store/sessionStore';
import type { Parish } from '../../../shared/models';
import type { RecordParish } from './SacramentRegisterPanel';

/**
 * La parroquia que se está viendo, con su nombre y su ubicación por separado: para mostrarla en una
 * partida nueva. (La sesión guarda "Nombre (Lugar)", que es lo que se ve en el menú.)
 */
export function useActiveParish(): RecordParish {
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const [parish, setParish] = useState<RecordParish | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadParishes().then((result) => {
      if (cancelled || !result.success) return;
      const found = result.parishes?.find((item) => item.id === parroquiaActivaId);
      setParish(found ? { nombre: found.nombre, ubicacion: found.ubicacion ?? null } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [parroquiaActivaId]);

  return parish ?? { nombre: parroquiaActivaNombre ?? '', ubicacion: null };
}

/** La parroquia de una partida guardada (puede no venir, en una partida a medio cargar). */
export function recordParish(parish: Parish | null | undefined): RecordParish {
  return { nombre: parish?.nombre ?? '', ubicacion: parish?.ubicacion ?? null };
}
