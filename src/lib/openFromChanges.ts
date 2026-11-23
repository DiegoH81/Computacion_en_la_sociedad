import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SacramentType } from '../../shared/sync';

/** La página de cada sacramento, para abrir una partida desde otra pantalla. */
const PAGE_OF: Record<SacramentType, string> = {
  bautismo: '/bautismos',
  confirmacion: '/confirmaciones',
  matrimonio: '/matrimonios',
};

interface OpenRecordState {
  abrirPartidaId: number;
  /** A dónde volver al cerrar el formulario (por ejemplo, "Cambios por aprobar" o "Sincronización"). */
  volverA: string;
}

/** Va a la página del sacramento y abre ahí el formulario de esa partida; al cerrarlo, vuelve a return_to. */
export function useOpenRecordPage(): (tipo: SacramentType, id: number, return_to?: string) => void {
  const navigate = useNavigate();
  return (tipo, id, return_to = '/cambios') =>
    navigate(PAGE_OF[tipo], { state: { abrirPartidaId: id, volverA: return_to } satisfies OpenRecordState });
}

/**
 * En la página del sacramento: si se llegó con una partida para abrir (desde "Cambios por aprobar" o
 * "Sincronización"), la abre y, al cerrar el formulario, vuelve a esa pantalla.
 */
export function useOpenedFromChanges(openRecord: (id: number) => void): { backToChanges: () => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as Partial<OpenRecordState> | null;
  const [request] = useState(() =>
    typeof state?.abrirPartidaId === 'number' ? { id: state.abrirPartidaId, returnTo: state.volverA ?? '/cambios' } : null,
  );
  // Se abre una sola vez, al entrar: basta la función del primer dibujo.
  const openRef = useRef(openRecord);

  useEffect(() => {
    if (request === null) return;
    // Se borra el pedido para que volver a esta página no abra la partida otra vez.
    navigate(location.pathname, { replace: true, state: null });
    openRef.current(request.id);
  }, [request, navigate, location.pathname]);

  function backToChanges() {
    if (request !== null) navigate(request.returnTo);
  }

  return { backToChanges };
}
