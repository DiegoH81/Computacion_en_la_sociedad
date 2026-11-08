import { useState } from 'react';
import { axisTicks, MONTH_NAMES, MONTHS, SACRAMENT_SERIES } from '../../../lib/statisticsConfig';
import type { BySacrament, Statistics } from '../../../services/StatisticsService';
import { ChartCard, ChartTooltip, SacramentLegend } from './ChartParts';
import { useChartTooltip } from './useChartTooltip';

const WIDTH = 900;
const HEIGHT = 260;
const MARGIN = { top: 12, right: 130, bottom: 26, left: 36 };
const MIN_LABEL_GAP = 16;

type TrendView = 'anios' | 'meses';

interface TrendPoint extends BySacrament {
  /** Lo que se lee en el eje. */
  label: string;
  /** Lo que se lee en el detalle y en la tabla. */
  name: string;
}

interface TrendChartProps {
  byYear: Statistics['tendencia'];
  byMonth: Statistics['mensual'];
  year: number;
  /** En el año en curso, los meses que faltan no son una caída a cero: no se dibujan. */
  isCurrentYear: boolean;
}

export function TrendChart({ byYear, byMonth, year, isCurrentYear }: TrendChartProps) {
  const { tooltip, bind } = useChartTooltip();
  const [view, setView] = useState<TrendView>('anios');
  const [hovered, setHovered] = useState<number | null>(null);

  const elapsedMonths = isCurrentYear ? new Date().getMonth() + 1 : 12;
  const points: TrendPoint[] =
    view === 'anios'
      ? byYear.map((row) => ({ ...row, label: String(row.anio), name: String(row.anio) }))
      : byMonth.slice(0, elapsedMonths).map((row) => ({ ...row, label: MONTHS[row.mes - 1], name: `${MONTH_NAMES[row.mes - 1]} de ${year}` }));

  const viewButton = (value: TrendView, text: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => {
        setView(value);
        setHovered(null);
      }}
      className={`rounded-md px-3 py-1 text-xs font-semibold ${view === value ? 'bg-table-panel text-white' : 'text-slate-700 hover:bg-slate-200'}`}
    >
      {text}
    </button>
  );

  const header = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SacramentLegend mark="line" />
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
        {viewButton('anios', 'Por años')}
        {viewButton('meses', `Por meses de ${year}`)}
      </div>
    </div>
  );

  const table = {
    headers: [view === 'anios' ? 'Año' : 'Mes', ...SACRAMENT_SERIES.map((series) => series.label)],
    rows: points.map((point) => [point.name, ...SACRAMENT_SERIES.map((series) => point[series.key])]),
  };

  if (points.length < 2) {
    return (
      <ChartCard title="Tendencia" legend={header} table={table}>
        <p className="text-sm text-slate-600">
          {view === 'anios' ? 'Hace falta más de un año con partidas para mostrar esta tendencia.' : 'Hace falta más de un mes para mostrar esta tendencia.'}
        </p>
      </ChartCard>
    );
  }

  const ticks = axisTicks(Math.max(...points.flatMap((point) => SACRAMENT_SERIES.map((series) => point[series.key]))));
  const top = ticks[ticks.length - 1];
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) => MARGIN.left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const bandWidth = plotWidth / (points.length - 1);
  const last = points[points.length - 1];

  // Las etiquetas finales que se pisarían se omiten: el nombre sigue en la leyenda y el valor en la tabla.
  const endLabels = [...SACRAMENT_SERIES]
    .sort((a, b) => last[b.key] - last[a.key])
    .reduce<typeof SACRAMENT_SERIES>((kept, series) => {
      const previous = kept[kept.length - 1];
      const fits = !previous || y(last[series.key]) - y(last[previous.key]) >= MIN_LABEL_GAP;
      return fits ? [...kept, series] : kept;
    }, []);

  const range = `De ${points[0].name} a ${last.name}`;

  return (
    <ChartCard title="Tendencia" subtitle={range} legend={header} table={table}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`Partidas, ${range.toLowerCase()}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#c3c2b7' : '#e1e0d9'} />
            <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="#6b7280">
              {tick}
            </text>
          </g>
        ))}

        {points.map((point, index) => (
          <text key={point.label} x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#6b7280">
            {point.label}
          </text>
        ))}

        {hovered !== null && <line x1={x(hovered)} x2={x(hovered)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="#c3c2b7" />}

        {SACRAMENT_SERIES.map((series) => (
          <polyline
            key={series.key}
            points={points.map((point, index) => `${x(index)},${y(point[series.key])}`).join(' ')}
            fill="none"
            stroke={series.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {SACRAMENT_SERIES.map((series) => {
          const index = hovered ?? points.length - 1;
          return <circle key={series.key} cx={x(index)} cy={y(points[index][series.key])} r="4" fill={series.color} stroke="#ffffff" strokeWidth="2" />;
        })}

        {endLabels.map((series) => (
          <text key={series.key} x={WIDTH - MARGIN.right + 10} y={y(last[series.key]) + 4} fontSize="12" fill="#1f2937">
            <tspan fontWeight="600">{last[series.key]}</tspan> {series.label}
          </text>
        ))}

        {points.map((point, index) => {
          const handlers = bind({
            title: point.name,
            rows: SACRAMENT_SERIES.map((series) => ({ label: series.label, value: point[series.key], color: series.color })),
          });
          return (
            <rect
              key={point.label}
              x={x(index) - bandWidth / 2}
              y={MARGIN.top}
              width={bandWidth}
              height={plotHeight}
              fill="transparent"
              tabIndex={0}
              aria-label={`${point.name}: ${SACRAMENT_SERIES.map((series) => `${point[series.key]} ${series.label}`).join(', ')}`}
              className="outline-none"
              {...handlers}
              onPointerEnter={(event) => {
                setHovered(index);
                handlers.onPointerEnter(event);
              }}
              onPointerLeave={() => {
                setHovered(null);
                handlers.onPointerLeave();
              }}
              onFocus={(event) => {
                setHovered(index);
                handlers.onFocus(event);
              }}
              onBlur={() => {
                setHovered(null);
                handlers.onBlur();
              }}
            />
          );
        })}
      </svg>

      <ChartTooltip tooltip={tooltip} />
    </ChartCard>
  );
}
