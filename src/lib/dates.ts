import { PARTIAL_DATE_PATTERN } from '../../shared/partial_date';

export { PARTIAL_DATE_PATTERN };

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * "1979-02-25" -> "25 de febrero de 1979", "1979-02" -> "febrero de 1979", "1979" -> "1979".
 * Un valor con otro formato se deja como está.
 */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = PARTIAL_DATE_PATTERN.exec(iso);
  if (!match) return iso;

  const [, year, month, day] = match;
  if (!month) return year;
  if (!day) return `${MONTHS[Number(month) - 1]} de ${year}`;
  return `${Number(day)} de ${MONTHS[Number(month) - 1]} de ${year}`;
}

export function todayLongDate(): string {
  const today = new Date();
  return `${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`;
}

/** El día de un momento guardado ("2026-11-03T15:24:00Z"), en la hora de la PC: "03/11/2026". */
export function formatTimestampDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}
