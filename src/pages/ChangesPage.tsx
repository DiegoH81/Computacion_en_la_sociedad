import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Person } from '../../shared/models';
import { ChangeRequestList } from '../components/features/ChangeRequestList';
import { MainMenuLayout } from '../components/features/MainMenuLayout';
import { ConfirmActionDialog } from '../components/ui/ConfirmActionDialog';
import { ApiError } from '../lib/apiClient';
import { pendingRequests, requestedBy } from '../lib/changeRequests';
import { recordPeople } from '../lib/personCorrections';
import { RequestService, type PendingChanges, type ReviewDecision } from '../services/RequestService';
import { useSessionStore } from '../store/sessionStore';

const TYPE_LABELS = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' } as const;

const fullName = (person: Person) => [person.nombres, person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' ');

/** Los cambios que pidieron los usuarios de la parroquia, para que un administrador los apruebe o rechace. */
export function ChangesPage() {
  const navigate = useNavigate();
  const usuarioNombre = useSessionStore((state) => state.usuarioNombre);
  const parroquiaActivaNombre = useSessionStore((state) => state.parroquiaActivaNombre);

  const [items, setItems] = useState<PendingChanges[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [confirming, setConfirming] = useState<{ id: number; decision: ReviewDecision } | null>(null);

  useEffect(() => {
    let cancelled = false;
    RequestService.pending()
      .then((response) => {
        if (!cancelled) setItems(response.pendientes);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof ApiError ? error.message : 'No se pudieron cargar los cambios.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCounter]);

  async function review() {
    if (!confirming) return;
    try {
      await RequestService.review(confirming.id, confirming.decision);
      setConfirming(null);
      setReloadCounter((count) => count + 1);
    } catch (error) {
      setConfirming(null);
      setErrorMessage(error instanceof ApiError ? error.message : 'No se pudo guardar la revisión.');
    }
  }

  return (
    <MainMenuLayout
      title="Cambios por aprobar"
      parroquiaActivaNombre={parroquiaActivaNombre ?? ''}
      usuarioNombre={usuarioNombre ?? ''}
      onBack={() => navigate('/dashboard')}
    >
      <div className="flex flex-col gap-4">
        <h1 className="rounded-xl bg-black px-4 py-2 text-xl font-bold text-white uppercase">Cambios por aprobar</h1>

        {errorMessage && (
          <p role="alert" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-solid-red">
            {errorMessage}
          </p>
        )}

        {!isLoading && items.length === 0 && (
          <p className="rounded-lg bg-white px-4 py-3 text-slate-700">No hay cambios pendientes.</p>
        )}

        {items.map(({ partida }) => {
          const sacramento = partida.sacramento;
          const id = sacramento.id as number;
          const requests = pendingRequests(partida);

          return (
            <article key={id} aria-label={`Cambio de la partida ${sacramento.numero}`} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {TYPE_LABELS[sacramento.tipo]}: {recordPeople(partida).map(fullName).join(' y ')}
                </h2>
                <span className="text-sm text-slate-600">
                  Libro {sacramento.libro} · Folio {sacramento.folio} · N.° {sacramento.numero}
                </span>
              </header>

              <ChangeRequestList requests={requests} />

              <footer className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-slate-600">
                  Pedido por {requestedBy(requests)}. <span className="font-semibold text-pending-ink">Espera su aprobación.</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming({ id, decision: 'rechazado' })}
                    className="rounded-lg bg-solid-red px-4 py-1.5 text-sm font-bold text-white uppercase hover:opacity-90"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming({ id, decision: 'aprobado' })}
                    className="rounded-lg bg-solid-green px-4 py-1.5 text-sm font-bold text-white uppercase hover:opacity-90"
                  >
                    Aprobar
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {confirming && (
        <ConfirmActionDialog
          title={confirming.decision === 'aprobado' ? 'Aprobar cambio' : 'Rechazar cambio'}
          description={
            confirming.decision === 'aprobado'
              ? 'Se cambiarán los datos de la partida por los valores nuevos. Una corrección por nota marginal conserva el nombre anterior en la búsqueda.'
              : 'Los datos de la partida quedarán como estaban.'
          }
          confirmLabel={confirming.decision === 'aprobado' ? 'Aprobar' : 'Rechazar'}
          onConfirm={review}
          onDismiss={() => setConfirming(null)}
        />
      )}
    </MainMenuLayout>
  );
}
