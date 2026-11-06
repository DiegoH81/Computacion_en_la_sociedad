import type { Minister } from '../../shared/models';
import { formatLongDate } from './dates';

/** Texto para imprimir: lo que no se llenó queda vacío. */
export const printText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function fullName(...parts: unknown[]): string {
  return parts.map(printText).filter(Boolean).join(' ');
}

/** La partida física puede traer la fecha de nacimiento o solo la edad. */
export function birthValue(fecha: string | null, edad: number | null): string {
  const date = formatLongDate(printText(fecha));
  if (date) return date;
  return edad !== null ? `${edad} años` : '';
}

/** "Pbro. Manuel Torres Rios", o vacío si la partida no tiene celebrante. */
export function celebrantName(ministro: Minister | null | undefined): string {
  if (!ministro) return '';
  return fullName(ministro.titulo, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno);
}
