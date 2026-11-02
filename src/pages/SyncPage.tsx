import { useNavigate } from 'react-router-dom';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { formatLastSync, useSyncActions } from '../controllers/SyncController';
import type { ConnectionMode } from '../services/SyncService';
import { useSessionStore } from '../store/sessionStore';
import { useSyncStore } from '../store/syncStore';

const MODE_LABELS: Record<ConnectionMode, string> = {
  'en-linea': 'En línea',
  'sin-conexion': 'Sin conexión',
  'requiere-login': 'Debe iniciar sesión de nuevo',
  error: 'Error al sincronizar',
};

const BUTTON = 'rounded-xl bg-dark-app px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

export function SyncPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);
  const status = useSyncStore((state) => state.status);
  const { errorMessage, syncNow, resolve, dismissNotice } = useSyncActions();

  return (
    <MainMenuLayout
      title="Sincronización"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/configuracion')}
    >
      {status && (
        <div className="flex flex-col gap-6 text-slate-800">
          {status.aviso && (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-amber-100 p-4 text-sm">
              <p>{status.aviso}</p>
              <button type="button" className={BUTTON} onClick={dismissNotice}>
                Entendido
              </button>
            </div>
          )}

          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="font-semibold">Estado</dt>
              <dd>{MODE_LABELS[status.modo]}</dd>
              <dt className="font-semibold">Última sincronización</dt>
              <dd>{formatLastSync(status.ultimaSync)}</dd>
              <dt className="font-semibold">Cambios sin subir</dt>
              <dd data-testid="sync-pendientes">{status.pendientes}</dd>
            </dl>
            <button type="button" className={BUTTON} disabled={status.enCurso} onClick={syncNow}>
              {status.enCurso ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </section>

          {status.mensaje && <p className="text-sm font-medium text-red-700">{status.mensaje}</p>}
          {errorMessage && <p className="text-sm font-medium text-red-700">{errorMessage}</p>}

          {status.items.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Registros por revisar</h2>
              {status.items.map((item) => (
                <article key={`${item.entidad}-${item.client_id}`} className="flex flex-col gap-2 rounded-xl bg-white p-4 text-sm">
                  <p className="font-semibold">{item.descripcion}</p>
                  <p>{item.motivo}</p>
                  {item.estado === 'conflicto' ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={BUTTON} onClick={() => resolve(item.entidad, item.client_id, 'servidor')}>
                        Usar la versión del servidor
                      </button>
                      <button type="button" className={BUTTON} onClick={() => resolve(item.entidad, item.client_id, 'local')}>
                        Conservar la de esta PC
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Se volverá a intentar en la próxima sincronización.</p>
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      )}
    </MainMenuLayout>
  );
}
