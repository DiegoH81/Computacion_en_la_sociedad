import { useNavigate } from 'react-router-dom';
import { useSyncPolling } from '../../controllers/SyncController';
import type { SyncStatus } from '../../services/SyncService';
import { useSyncStore } from '../../store/syncStore';

function label(status: SyncStatus): string {
  if (status.conflictos + status.rechazados > 0) return 'Revisar sincronización';
  if (status.enCurso) return 'Sincronizando…';
  if (status.modo === 'requiere-login') return 'Inicie sesión de nuevo';
  if (status.modo === 'error') return 'Error al sincronizar';
  if (status.pendientes > 0) return `${status.pendientes} sin subir`;
  return status.modo === 'sin-conexion' ? 'Sin conexión' : 'Sincronizado';
}

const needsAttention = (status: SyncStatus) =>
  status.conflictos + status.rechazados > 0 || status.modo === 'requiere-login' || status.modo === 'error';

export function SyncStatusBadge() {
  const navigate = useNavigate();
  const status = useSyncStore((state) => state.status);
  useSyncPolling();

  if (!status) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/sincronizacion')}
      title="Ver el estado de la sincronización"
      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold normal-case hover:opacity-80 print:hidden ${
        needsAttention(status) ? 'bg-amber-300 text-black' : 'bg-dark-app text-white'
      }`}
    >
      {label(status)}
    </button>
  );
}
