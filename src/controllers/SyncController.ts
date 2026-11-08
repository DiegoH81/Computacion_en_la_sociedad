import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { LOCAL_CHANGE_EVENT } from '../lib/localClient';
import { SyncService, type ConflictChoice, type SyncStatus } from '../services/SyncService';
import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '../store/syncStore';

const POLL_INTERVAL_MS = 5_000;
// Mientras una sincronización está en curso (por ejemplo, la que arranca sola al iniciar sesión),
// se revisa más seguido para no dejar "Sincronizando…" en pantalla cuando ya terminó.
const BUSY_POLL_INTERVAL_MS = 1_000;

function publish(status: SyncStatus): void {
  useSyncStore.getState().setStatus(status);
  // El token se renueva en Electron al volver internet: la gestión de usuarios lo necesita.
  const session = useSessionStore.getState();
  if (session.isAuthenticated && session.token !== status.token) session.setToken(status.token);
}

/** Mantiene el estado al día. Lo usa solo el indicador, que está en todas las pantallas con sesión. */
export function useSyncPolling(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const schedule = (busy: boolean) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, busy ? BUSY_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
    };

    function refresh() {
      SyncService.status()
        .then((status) => {
          publish(status);
          schedule(status.en_curso);
        })
        .catch(() => {
          useSyncStore.getState().setStatus(null);
          schedule(false);
        });
    }

    refresh();
    window.addEventListener(LOCAL_CHANGE_EVENT, refresh);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(LOCAL_CHANGE_EVENT, refresh);
    };
  }, []);
}

export function useSyncActions() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const perform = useCallback(async (action: () => Promise<SyncStatus>) => {
    setErrorMessage(null);
    try {
      publish(await action());
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.');
    }
  }, []);

  return {
    errorMessage,
    syncNow: () => perform(() => SyncService.run()),
    resolve: (entidad: string, client_id: string, eleccion: ConflictChoice) =>
      perform(() => SyncService.resolve(entidad, client_id, eleccion)),
    dismissNotice: () =>
      perform(async () => {
        await SyncService.dismissNotice();
        return SyncService.status();
      }),
  };
}

export function formatLastSync(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-PE') : 'Todavía no se ha sincronizado';
}
