import type { ChangeRequest } from '../../../shared/models';
import { requestLabel } from '../../lib/changeRequests';
import { ArrowRightIcon } from '../ui/MenuIcons';

/** Lo que viene de la nota marginal: las correcciones de nombres y el texto de la nota. */
const isMarginalNote = (request: ChangeRequest) => request.tipo === 'nota_marginal' || (request.parte === 'sacramento' && request.campo === 'anotaciones');

const GROUPS = [
  { key: 'nota', title: 'Nota marginal', effect: 'el nombre anterior se sigue buscando', color: 'bg-solid-blue', matches: isMarginalNote },
  { key: 'dato', title: 'Dato mal escrito', effect: 'el valor anterior se reemplaza', color: 'bg-darker-app', matches: (request: ChangeRequest) => !isMarginalNote(request) },
];

/**
 * Lo que se pidió cambiar, agrupado: primero lo que viene de la nota marginal y después los datos mal
 * escritos. Cada grupo dice qué pasa al aprobar; cada dato muestra el valor actual, una flecha y el nuevo.
 */
export function ChangeRequestList({ requests }: { requests: ChangeRequest[] }) {
  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((group) => {
        const rows = requests.filter(group.matches);
        if (rows.length === 0) return null;

        return (
          <section key={group.key} aria-label={group.title} className="flex flex-col overflow-hidden rounded-xl border border-slate-200">
            <header className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2 text-white ${group.color}`}>
              <h4 className="text-xs font-bold tracking-wider uppercase">{group.title}</h4>
              <span className="text-xs">
                {rows.length === 1 ? '1 cambio' : `${rows.length} cambios`} · {group.effect}
              </span>
            </header>
            <ul className="flex flex-col gap-1.5 bg-lighter-green p-2">
              {rows.map((request) => (
                <li
                  key={request.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg bg-white p-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto_minmax(0,1fr)]"
                >
                  <span className="text-xs font-bold text-slate-600 uppercase">{requestLabel(request)}</span>
                  <span className="rounded-md bg-slate-100 px-3 py-1.5 break-words whitespace-pre-wrap text-slate-600">{request.texto_anterior ?? '(vacío)'}</span>
                  <ArrowRightIcon className="hidden h-6 w-6 text-darker-app sm:block" />
                  <span className="rounded-md bg-white px-3 py-1.5 font-semibold break-words whitespace-pre-wrap text-slate-900 ring-2 ring-solid-green ring-inset">
                    {request.texto_nuevo ?? '(vacío)'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
