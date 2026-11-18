import { SACRAMENT_SERIES } from '../../../lib/statisticsConfig';
import type { Statistics } from '../../../services/StatisticsService';

// Cuántos años se ofrecen como botones; los más viejos quedan en la lista "Otro año".
const YEAR_BUTTONS = 5;

function comparison(current: number, previous: number, year: number, isCurrentYear: boolean): string {
  const period = isCurrentYear ? `el mismo periodo de ${year - 1}` : String(year - 1);
  if (current === previous) return `Igual que ${period}`;
  const difference = current - previous;
  return `${difference > 0 ? '+' : '−'}${Math.abs(difference)} frente a ${period}`;
}

/** Una línea pequeña con la tendencia de todos los años, para ver de un vistazo si sube o baja. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const width = 120;
  const height = 28;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
  const x = 2 + ((width - 8) * index) / (values.length - 1);
  const y = height - 3 - ((height - 8) * value) / max;

  return [x, y];
});
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" aria-hidden="true">
      <polyline points={points.map((point) => point.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3.5} fill={color} />
    </svg>
  );
}

interface StatsSummaryProps {
  data: Statistics;
  selectedYear: number;
  onYearChange: (year: number) => void;
}

/** La franja de arriba: el total del año, el año elegido y un resumen de cada sacramento. */
export function StatsSummary({ data, selectedYear, onYearChange }: StatsSummaryProps) {
  const yearTotal = SACRAMENT_SERIES.reduce((sum, series) => sum + data.totales[series.key].anio, 0);
  const years = [...data.anios].sort((a, b) => b - a);
  const buttonYears = years.slice(0, YEAR_BUTTONS).reverse();
  const olderYears = years.slice(YEAR_BUTTONS);

  return (
    <section aria-label="Resumen del año" className="grid grid-cols-1 items-center gap-5 rounded-2xl bg-table-panel p-5 text-white lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-1">
        <p className="text-5xl leading-none font-bold tabular-nums" data-testid="stat-total">
          {yearTotal.toLocaleString('es-PE')}
        </p>
        <p className="text-sm text-white/90">partidas vigentes en {data.anio}</p>

        <div role="group" aria-label="Año" className="mt-3 flex flex-wrap items-center gap-1.5">
          {buttonYears.map((year) => (
            <button
              key={year}
              type="button"
              aria-pressed={year === selectedYear}
              onClick={() => onYearChange(year)}
              className={`rounded-lg border px-2.5 py-0.5 text-sm tabular-nums ${
                year === selectedYear ? 'border-white bg-white font-bold text-table-panel' : 'border-white/40 hover:bg-white/10'
              }`}
            >
              {year}
            </button>
          ))}
          {olderYears.length > 0 && (
            <select
              aria-label="Otro año"
              value={olderYears.includes(selectedYear) ? selectedYear : ''}
              onChange={(event) => onYearChange(Number(event.target.value))}
              className="rounded-lg border border-white/40 bg-table-panel px-2 py-0.5 text-sm text-white"
            >
              <option value="" disabled>
                Otro año
              </option>
              {olderYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="mt-2 text-xs text-white/80">Partidas de esta parroquia registradas en esta PC.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SACRAMENT_SERIES.map((series) => {
          const total = data.totales[series.key];
          return (
            <section key={series.key} aria-label={series.label} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-white p-3 text-slate-900">
              <h2 className="flex items-center gap-2 text-sm text-slate-600">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
                {series.label}
              </h2>
              <p data-testid={`stat-${series.key}`} className="text-3xl font-bold tabular-nums">
                {total.anio.toLocaleString('es-PE')}
              </p>
              <p className="text-xs text-slate-600">
                {comparison(total.anio, total.anterior, data.anio, data.esAnioActual)}
                {data.esAnioActual && ` · ${total.mes} este mes`}
              </p>
              <Sparkline values={data.tendencia.map((row) => row[series.key])} color={series.color} />
              <p className="text-xs text-slate-600">{total.historico.toLocaleString('es-PE')} en total, todos los años</p>
            </section>
          );
        })}
      </div>
    </section>
  );
}

/** Los datos del registro, en una franja al final. */
export function RegisterFacts({ data }: { data: Statistics }) {
  const facts = [
    { value: data.registro.anuladas, text: data.registro.anuladas === 1 ? 'partida anulada' : 'partidas anuladas', testId: 'stat-anuladas' },
    { value: data.registro.conCorrecciones, text: 'con nota marginal que corrige datos', testId: 'stat-correcciones' },
  ];

  return (
    <section aria-label="Registro" className="flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-xl bg-white px-5 py-4 shadow-sm">
      {facts.map((fact) => (
        <p key={fact.testId} className="flex items-baseline gap-2">
          <span data-testid={fact.testId} className="text-2xl font-bold text-slate-900 tabular-nums">
            {fact.value.toLocaleString('es-PE')}
          </span>
          <span className="text-sm text-slate-600">{fact.text}</span>
        </p>
      ))}
      <p className="text-xs text-slate-500">En {data.anio}.</p>
    </section>
  );
}
