import { marginalNoteSummary } from '../../lib/personCorrections';
import type { SacramentRecord } from '../../../shared/models';

/** La marca de la tabla de partidas: la partida tiene anotación marginal o un cambio por aprobar. */
export function MarginalNoteBadge({ record }: { record: SacramentRecord }) {
  const summary = marginalNoteSummary(record);
  const details: string[] = [];

  if (summary.hasText) details.push('Tiene anotación marginal');
  if (summary.corrections > 0) {
    details.push(summary.corrections === 1 ? 'Corrige 1 dato' : `Corrige ${summary.corrections} datos`);
  }
  if (summary.pending > 0) {
    details.push(summary.pending === 1 ? '1 cambio por aprobar' : `${summary.pending} cambios por aprobar`);
  }

  if (details.length === 0) return null;

  const isPending = summary.pending > 0;
  const text = details.join(' · ');

  return (
    <span
      title={text}
      aria-label={text}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${
        isPending ? 'bg-pending-soft text-pending-ink' : 'bg-solid-blue text-white'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="h-3.5 w-3.5">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {isPending ? 'Por aprobar' : 'Nota'}
    </span>
  );
}
