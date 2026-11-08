import { axisTicks, MONTH_NAMES, MONTHS, SACRAMENT_SERIES } from '../../../lib/statisticsConfig';
import type { Statistics } from '../../../services/StatisticsService';
import { ChartCard, ChartTooltip, SacramentLegend } from './ChartParts';
import { useChartTooltip } from './useChartTooltip';

const PLOT_HEIGHT = 220;
const GAP = 2;

export function MonthlyChart({ data, year }: { data: Statistics['mensual']; year: number }) {
  const { tooltip, bind } = useChartTooltip();

  const totals = data.map((row) => SACRAMENT_SERIES.reduce((sum, series) => sum + row[series.key], 0));
  const highest = Math.max(...totals);
  const ticks = axisTicks(highest);
  const top = ticks[ticks.length - 1];
  const peakIndex = totals.indexOf(highest);

  return (
    <ChartCard
      title={`Partidas por mes en ${year}`}
      subtitle={highest > 0 ? `Mes con más partidas: ${MONTH_NAMES[peakIndex]} (${highest})` : undefined}
      legend={<SacramentLegend mark="bar" />}
      table={{
        headers: ['Mes', ...SACRAMENT_SERIES.map((series) => series.label), 'Total'],
        rows: data.map((row, index) => [MONTH_NAMES[index], ...SACRAMENT_SERIES.map((series) => row[series.key]), totals[index]]),
      }}
    >
      <div className="flex gap-2">
        <div className="relative w-8 shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 text-[11px] text-slate-500 tabular-nums"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative border-b border-[#c3c2b7]" style={{ height: PLOT_HEIGHT }}>
            {ticks.slice(1).map((tick) => (
              <div key={tick} className="absolute inset-x-0 border-t border-[#e1e0d9]" style={{ bottom: `${(tick / top) * 100}%` }} />
            ))}

            <div className="absolute inset-0 grid grid-cols-12">
              {data.map((row, index) => {
                const present = SACRAMENT_SERIES.filter((series) => row[series.key] > 0);
                return (
                  <div
                    key={row.mes}
                    tabIndex={0}
                    aria-label={`${MONTH_NAMES[index]}: ${totals[index]} partidas`}
                    {...bind({
                      title: `${MONTH_NAMES[index]} de ${year}`,
                      rows: [
                        ...SACRAMENT_SERIES.map((series) => ({ label: series.label, value: row[series.key], color: series.color })),
                        { label: 'Total', value: totals[index] },
                      ],
                    })}
                    className="flex h-full flex-col-reverse items-center rounded outline-none hover:bg-slate-100/70 focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    {present.map((series, position) => (
                      <div
                        key={series.key}
                        className={`w-full max-w-6 shrink-0 ${position === present.length - 1 ? 'rounded-t' : ''}`}
                        style={{
                          background: series.color,
                          height: Math.max(2, (row[series.key] / top) * PLOT_HEIGHT - (position > 0 ? GAP : 0)),
                          marginBottom: position > 0 ? GAP : 0,
                        }}
                      />
                    ))}
                    {index === peakIndex && highest > 0 && (
                      <span className="mb-0.5 text-xs font-semibold text-slate-900 tabular-nums">{highest}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-1 grid grid-cols-12" aria-hidden="true">
            {MONTHS.map((month) => (
              <span key={month} className="text-center text-[11px] text-slate-500">
                {month}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ChartTooltip tooltip={tooltip} />
    </ChartCard>
  );
}
