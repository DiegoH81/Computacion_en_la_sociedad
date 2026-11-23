import { useEffect, useState } from 'react';
import type { ConflictDetail } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import { ApiError } from '../../lib/apiClient';
import { useOpenRecordPage } from '../../lib/openFromChanges';
import { SyncService, type ConflictChoice, type SyncItem } from '../../services/SyncService';

const SACRAMENT_TYPES: string[] = ['bautismo', 'confirmacion', 'matrimonio'];
const BUTTON = 'rounded-xl px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

const formatDate = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

interface ConflictCardProps {
  item: SyncItem;
  /** Solo un administrador ve las diferencias y elige qué versión queda. */
  canResolve: boolean;
  onResolve: (entidad: string, client_id: string, eleccion: ConflictChoice) => void;
}

/** Un registro que cambiaron dos PCs: muestra qué es distinto en cada versión y deja elegir cuál queda. */
export function ConflictCard({ item, canResolve, onResolve }: ConflictCardProps) {
  const openRecordPage = useOpenRecordPage();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!canResolve) return;
    let cancelled = false;
    SyncService.conflictDetail(item.entidad, item.client_id)
      .then((result) => !cancelled && setDetail(result))
      .catch((error) => !cancelled && setDetailError(error instanceof ApiError ? error.message : 'No se pudieron cargar las diferencias.'));
    return () => {
      cancelled = true;
    };
  }, [canResolve, item.entidad, item.client_id]);

  function who(): string | null {
    if (!detail?.cambiado_en) return null;
    const when = formatDate(detail.cambiado_en);
    return detail.cambiado_por ? `En el servidor lo cambió ${detail.cambiado_por} el ${when}, en otra PC.` : `En el servidor se cambió el ${when}, en otra PC.`;
  }

  return (
    <article aria-label={`Conflicto: ${item.descripcion}`} className="flex flex-col gap-3 rounded-xl bg-white p-4 text-sm">
      <p className="font-semibold">{item.descripcion}</p>

      {!canResolve ? (
        <p className="rounded-lg bg-pending-soft px-3 py-2 font-medium text-pending-ink">
          Otra PC cambió este registro antes de que se subiera el cambio de esta PC. Un administrador de la parroquia debe entrar en esta PC y elegir qué versión queda.
        </p>
      ) : (
        <>
          {detail === null && !detailError && <p className="text-slate-600">Cargando las diferencias...</p>}
          {detailError && <p className="text-solid-red">{detailError}</p>}

          {detail && (
            <>
              {who() && <p className="text-xs text-slate-600">{who()}</p>}
              {detail.diferencias.length === 0 ? (
                <p className="text-slate-600">Las dos versiones tienen los mismos datos: puede elegir cualquiera.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[32rem] border-collapse text-left">
                    <thead>
                      <tr className="text-xs font-bold uppercase">
                        <th className="px-3 py-2 text-slate-600">Dato</th>
                        <th className="bg-solid-blue/10 px-3 py-2 text-solid-blue">En el servidor</th>
                        <th className="bg-pending-soft px-3 py-2 text-pending-ink">En esta PC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.diferencias.map((difference) => (
                        <tr key={difference.dato} className="border-t border-slate-200 align-top">
                          <td className="px-3 py-2 font-semibold text-slate-600">{difference.dato}</td>
                          <td className="bg-solid-blue/5 px-3 py-2 break-words">{difference.servidor}</td>
                          <td className="bg-pending-soft/40 px-3 py-2 break-words">{difference.local}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {detail.diferencias.length > 0 && <p className="text-xs text-slate-600">Los demás datos son iguales en las dos versiones.</p>}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${BUTTON} bg-solid-blue`} onClick={() => onResolve(item.entidad, item.client_id, 'servidor')}>
              Quedarme con la del servidor
            </button>
            <button type="button" className={`${BUTTON} bg-pending-ink`} onClick={() => onResolve(item.entidad, item.client_id, 'local')}>
              Usar la de esta PC (reemplaza la del servidor)
            </button>
            {detail?.sacramento_id != null && SACRAMENT_TYPES.includes(item.entidad) && (
              <button
                type="button"
                onClick={() => openRecordPage(item.entidad as SacramentType, detail.sacramento_id as number, '/sincronizacion')}
                className="px-2 font-semibold text-solid-blue underline hover:opacity-80"
              >
                Abrir la partida
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}
