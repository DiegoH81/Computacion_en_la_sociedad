import { useEffect, useState } from 'react';
import { loadParishes } from '../../controllers/UserController';
import { useSessionStore } from '../../store/sessionStore';
import type { Parish } from '../../../shared/models';
import type { RecordParish } from './SacramentRegisterPanel';

/** La parroquia que se está viendo, con su ubicación: para mostrarla en una partida nueva. */
export function useActiveParish(): RecordParish {
  const parroquiaActivaId = useSessionStore((state) => state.parroquiaActivaId);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const [ubicacion, setUbicacion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadParishes().then((result) => {
      if (cancelled || !result.success) return;
      const parish = result.parishes?.find((item) => item.id === parroquiaActivaId);
      setUbicacion(parish?.ubicacion ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [parroquiaActivaId]);

  return { nombre: parroquiaActivaNombre ?? '', ubicacion };
}

/** La parroquia de una partida guardada (puede no venir, en una partida a medio cargar). */
export function recordParish(parish: Parish | null | undefined): RecordParish {
  return { nombre: parish?.nombre ?? '', ubicacion: parish?.ubicacion ?? null };
}
