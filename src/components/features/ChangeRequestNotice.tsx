import type { SacramentRecord } from '../../../shared/models';
import { lastReviewed, pendingRequests, requestedBy } from '../../lib/changeRequests';
import { ChangeRequestList } from './ChangeRequestList';

interface ChangeRequestNoticeProps {
  record: SacramentRecord;
  /** Quien edita es un usuario (ayudante): no modifica la partida, pide los cambios. */
  onlyRequests: boolean;
  /** "Usar estos valores": solo para el administrador. */
  onUseValues: () => void;
}

const REVIEW_TEXT = { aprobado: 'aprobado', rechazado: 'rechazado', descartado: 'descartado' } as const;

/** El aviso de arriba del formulario de una partida ya guardada que tiene (o puede tener) cambios pedidos. */
export function ChangeRequestNotice({ record, onlyRequests, onUseValues }: ChangeRequestNoticeProps) {
  const pending = pendingRequests(record);

  if (pending.length > 0) {
    return (
      <section aria-label="Cambio pedido" className="flex flex-col gap-2 rounded-xl bg-pending-soft p-3 text-sm text-pending-ink">
        <p className="font-semibold">
          {onlyRequests
            ? 'Su pedido de cambio espera la aprobación de un administrador. Mientras tanto, la partida no se puede modificar.'
            : `Cambio pedido por ${requestedBy(pending)}.`}
        </p>
        <ChangeRequestList requests={pending} />
        {!onlyRequests && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs">Si guarda sin usar estos valores, el pedido se descarta.</p>
            <button type="button" onClick={onUseValues} className="rounded-lg bg-darker-app px-4 py-1.5 text-sm font-bold text-white hover:opacity-90">
              Usar estos valores
            </button>
          </div>
        )}
      </section>
    );
  }

  if (!onlyRequests) return null;

  const last = lastReviewed(record);
  const wasRefused = last !== null && last.estado !== 'aprobado';

  return (
    <div role="status" className="flex flex-col gap-1 rounded-lg bg-white px-4 py-2 text-sm text-slate-800">
      <p className="font-medium">
        Lo que cambie quedará pendiente hasta que un administrador de la parroquia lo apruebe. Si la nota marginal está en
        blanco, la que escriba se guarda en el momento y después ya no podrá editarla.
      </p>
      {wasRefused && (
        <p className="text-solid-red">
          Su pedido anterior fue {REVIEW_TEXT[last.estado as keyof typeof REVIEW_TEXT]}
          {last.revisado_por ? ` por ${last.revisado_por}` : ''}
          {last.motivo ? `: ${last.motivo}` : ''}.
        </p>
      )}
    </div>
  );
}
