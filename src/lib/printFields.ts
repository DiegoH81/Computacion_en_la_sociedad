import { formatLongDate } from './dates';

export type PrintRow = Record<string, unknown>;

export const printText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function fullName(...parts: unknown[]): string {
  return parts.map(printText).filter(Boolean).join(' ');
}

/** La partida física puede traer la fecha de nacimiento o solo la edad. */
export function birthValue(fecha: unknown, edad: unknown): string {
  const date = formatLongDate(printText(fecha));
  if (date) return date;
  return printText(edad) ? `${printText(edad)} años` : '';
}

export function celebrantName(row: PrintRow): string {
  return fullName(row.celebrante_titulo, row.celebrante_nombre);
}

export function printBase(row: PrintRow, logo: string | null) {
  return {
    logo,
    parroquiaNombre: printText(row.parroquia_nombre),
    ubicacion: printText(row.parroquia_ubicacion),
    numeroLibro: printText(row.numero_libro),
    numeroFolio: printText(row.numero_folio),
    numeroRegistro: printText(row.numero_registro),
  };
}
