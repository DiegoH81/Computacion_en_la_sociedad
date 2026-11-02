import type { SacramentKey } from '../services/StatisticsService';

// Cada sacramento conserva su color en todos los gráficos. Orden validado con validate_palette.js
// sobre fondo blanco (daltonismo incluido): no cambiarlo sin volver a validar.
export const SACRAMENT_SERIES: { key: SacramentKey; label: string; color: string }[] = [
  { key: 'bautismo', label: 'Bautismos', color: '#2a78d6' },
  { key: 'confirmacion', label: 'Confirmaciones', color: '#eb6834' },
  { key: 'matrimonio', label: 'Matrimonios', color: '#1baf7a' },
];

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
export const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** Marcas redondas del eje, de 0 a un máximo que contiene al valor mayor. */
export function axisTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const roughStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = Math.max(1, [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= roughStep) ?? magnitude);
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step; tick += step) ticks.push(tick);
  return ticks;
}
