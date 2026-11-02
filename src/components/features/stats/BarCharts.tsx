import { SACRAMENT_SERIES } from '../../../lib/statisticsConfig';
import type { Statistics } from '../../../services/StatisticsService';
import { ChartCard } from './ChartParts';

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  color: string;
  labelClassName: string;
}

function BarRow({ label, value, max, color, labelClassName }: BarRowProps) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span title={label} className={`shrink-0 truncate text-slate-600 ${labelClassName}`}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {value > 0 && (
          <div className="h-3.5 rounded-r" style={{ width: `${Math.max(1, (value / max) * 85)}%`, background: color }} />
        )}
        <span className={`tabular-nums ${value > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{value}</span>
      </div>
    </li>
  );
}

export function AgeCharts({ bands, ages }: { bands: string[]; ages: Statistics['edades'] }) {
  // La misma escala en los tres, para que las barras se puedan comparar entre sacramentos.
  const max = Math.max(1, ...SACRAMENT_SERIES.flatMap((series) => ages[series.key].bandas));
  const notes = SACRAMENT_SERIES.filter((series) => ages[series.key].sinDato > 0).map(
    (series) => `${series.label}: ${ages[series.key].sinDato}`,
  );

  return (
    <ChartCard
      title="Edad al recibir el sacramento"
      subtitle={`Según la fecha de nacimiento o la edad registrada. En matrimonio cuenta a los dos cónyuges.${notes.length > 0 ? ` Sin dato de edad: ${notes.join(', ')}.` : ''}`}
      table={{
        headers: ['Edad', ...SACRAMENT_SERIES.map((series) => series.label)],
        rows: bands.map((band, index) => [band, ...SACRAMENT_SERIES.map((series) => ages[series.key].bandas[index])]),
      }}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SACRAMENT_SERIES.map((series) => {
          const { bandas, promedio } = ages[series.key];
          return (
            <div key={series.key} className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: series.color }} />
                {series.label}
              </h3>
              <p className="mb-2 text-xs text-slate-600">
                {promedio === null ? 'Sin edades registradas' : `Promedio: ${promedio.toLocaleString('es-PE')} años`}
              </p>
              <ul className="flex flex-col gap-1.5">
                {bands.map((band, index) => (
                  <BarRow key={band} label={band} value={bandas[index]} max={max} color={series.color} labelClassName="w-[6.5rem]" />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

export function MinisterChart({ ministers, year }: { ministers: Statistics['ministros']; year: number }) {
  const max = Math.max(1, ...ministers.map((minister) => minister.total));

  return (
    <ChartCard
      title="Celebrantes con más partidas"
      subtitle={`Los tres sacramentos juntos, en ${year}`}
      table={
        ministers.length > 0
          ? { headers: ['Celebrante', 'Partidas'], rows: ministers.map((minister) => [minister.nombre, minister.total]) }
          : undefined
      }
    >
      {ministers.length === 0 ? (
        <p className="text-sm text-slate-600">Ninguna partida de este año tiene celebrante registrado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {ministers.map((minister) => (
            <BarRow key={minister.nombre} label={minister.nombre} value={minister.total} max={max} color="#2F6E72" labelClassName="w-52" />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
