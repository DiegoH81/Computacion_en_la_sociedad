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

export const PARTIAL_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

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

/** Hoy como AAAA-MM-DD, en la hora de la PC (toISOString usaría la de Greenwich y de noche daría mañana). */
export function todayIsoDate(): string {
  const today = new Date();
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}
