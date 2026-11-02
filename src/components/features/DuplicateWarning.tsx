import { useState } from 'react';
import type { DuplicateMatch } from '../../services/DuplicateService';

const COLLAPSED_ROWS = 3;

interface DuplicateWarningProps {
  /** Nombre del sacramento en minúscula, ej. "matrimonio". */
  sacramento: string;
  matches: DuplicateMatch[];
  /** Todas las coincidencias encontradas, aunque solo lleguen las más altas. */
  total: number;
}

function MatchRow({ match }: { match: DuplicateMatch }) {
  const isHigh = match.nivel === 'alta';

  return (
    <li className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 py-2">
      <span
        className={`rounded-full px-2 py-0.5 text-center text-xs font-bold whitespace-nowrap ${
          isHigh ? 'bg-red-100 text-solid-red' : 'bg-amber-100 text-amber-800'
        }`}
      >
        {isHigh ? 'Alta' : 'Posible'} · {match.porcentaje}%
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {match.para && <span className="mr-1 font-medium text-slate-500">{match.para}:</span>}
          {match.nombreCompleto}
        </p>
        <p className="truncate text-xs text-slate-600">
          {match.parroquia} · Libro {match.libro} · Folio {match.folio} · N.° {match.numero}
          <span className="text-slate-500"> · Coincide en {match.coincide.join(', ')}</span>
        </p>
      </div>
    </li>
  );
}

/** No impide guardar: un viudo puede volver a casarse, y hay personas homónimas. */
export function DuplicateWarning({ sacramento, matches, total }: DuplicateWarningProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (matches.length === 0) return null;

  // Vienen ordenadas: si hay alguna alta, es la primera.
  const hasHigh = matches[0].nivel === 'alta';
  const visible = isExpanded ? matches : matches.slice(0, COLLAPSED_ROWS);

  return (
    <section
      role="status"
      aria-label="Aviso de posible duplicado"
      className="flex max-h-[45vh] shrink-0 flex-col rounded-xl bg-white px-4 py-3 shadow-sm"
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
            hasHigh ? 'bg-solid-red' : 'bg-amber-500'
          }`}
        >
          !
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
          {hasHigh ? `Esta persona parece tener ya una partida de ${sacramento}` : `Podría tener ya una partida de ${sacramento}`}
        </h3>
        {matches.length > COLLAPSED_ROWS && (
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="shrink-0 text-xs font-semibold text-solid-blue hover:underline"
          >
            {isExpanded ? 'Ver menos' : `Ver todas (${total})`}
          </button>
        )}
      </header>

      <ul className="mt-1 min-h-0 divide-y divide-slate-100 overflow-y-auto pr-1">
        {visible.map((match) => (
          <MatchRow key={`${match.para}-${match.sacramentoId}`} match={match} />
        ))}
      </ul>

      {isExpanded && total > matches.length && (
        <p className="mt-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          Se muestran las {matches.length} más altas de {total}. Complete más datos, como el DNI o los padres, para afinar la búsqueda.
        </p>
      )}
    </section>
  );
}
