import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { LOCAL_CHANGE_EVENT } from '../lib/localClient';
import { SyncService, type ConflictChoice, type SyncStatus } from '../services/SyncService';
import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '../store/syncStore';

const POLL_INTERVAL_MS = 5_000;

function publish(status: SyncStatus): void {
  useSyncStore.getState().setStatus(status);
  // El token se renueva en Electron al volver internet: la gestión de usuarios lo necesita.
  const session = useSessionStore.getState();
  if (session.isAuthenticated && session.token !== status.token) session.setToken(status.token);
}

/** Mantiene el estado al día. Lo usa solo el indicador, que está en todas las pantallas con sesión. */
export function useSyncPolling(): void {
  useEffect(() => {
    const refresh = () => {
      SyncService.status()
        .then(publish)
        .catch(() => useSyncStore.getState().setStatus(null));
    };

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener(LOCAL_CHANGE_EVENT, refresh);
    return () => {
      clearInterval(interval);
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
    resolve: (entidad: string, clientId: string, choice: ConflictChoice) =>
      perform(() => SyncService.resolve(entidad, clientId, choice)),
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
