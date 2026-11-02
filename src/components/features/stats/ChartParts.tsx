import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SACRAMENT_SERIES } from '../../../lib/statisticsConfig';
import type { TooltipState } from './useChartTooltip';

// El texto crece con la pantalla: este ancho deja entrar "Confirmaciones" también en las grandes.
const TOOLTIP_WIDTH = 320;

export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;

  const flip = tooltip.x + TOOLTIP_WIDTH + 24 > window.innerWidth;
  const left = flip ? tooltip.x - TOOLTIP_WIDTH - 12 : tooltip.x + 12;

  return createPortal(
    <div
      role="status"
      style={{ left, top: Math.max(8, tooltip.y - 12), width: TOOLTIP_WIDTH }}
      className="pointer-events-none fixed z-50 rounded-lg bg-white p-3 text-sm text-slate-900 shadow-xl ring-1 ring-black/10"
    >
      <p className="mb-1 text-xs font-medium text-slate-600">{tooltip.title}</p>
      {tooltip.rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          {row.color && <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ background: row.color }} />}
          <span className="font-bold tabular-nums">{row.value}</span>
          <span className="min-w-0 truncate text-slate-600">{row.label}</span>
        </p>
      ))}
    </div>,
    document.body,
  );
}

export function SacramentLegend({ mark }: { mark: 'bar' | 'line' }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {SACRAMENT_SERIES.map((series) => (
        <li key={series.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={mark === 'bar' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-4 rounded'}
            style={{ background: series.color }}
          />
          {series.label}
        </li>
      ))}
    </ul>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table?: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode;
}

/** Tarjeta de un gráfico. La tabla garantiza que ningún dato dependa de ver colores o de pasar el ratón. */
export function ChartCard({ title, subtitle, legend, table, children }: ChartCardProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
        {legend}
      </header>

      {children}

      {table && (
        <details className="text-sm text-slate-800">
          <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">Ver como tabla</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  {table.headers.map((header, index) => (
                    <th key={header} className={`border-b border-slate-300 py-1 pr-3 font-semibold ${index > 0 ? 'text-right' : ''}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, index) => (
                      <td key={index} className={`border-b border-slate-100 py-1 pr-3 ${index > 0 ? 'text-right tabular-nums' : ''}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

interface StatTileProps {
  label: string;
  value: number;
  testId?: string;
  color?: string;
  details?: string[];
}

export function StatTile({ label, value, testId, color, details = [] }: StatTileProps) {
  return (
    <section aria-label={label} className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {color && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </h2>
      <p data-testid={testId} className="text-3xl font-semibold text-slate-950">
        {value.toLocaleString('es-PE')}
      </p>
      {details.map((detail) => (
        <p key={detail} className="text-xs text-slate-600">
          {detail}
        </p>
      ))}
    </section>
  );
}
