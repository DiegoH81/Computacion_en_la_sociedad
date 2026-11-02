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

/** Convierte YYYY-MM-DD en "25 de febrero de 1979". Un valor con otro formato se deja como está. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} de ${MONTHS[Number(match[2]) - 1]} de ${match[1]}`;
}

export function todayLongDate(): string {
  const today = new Date();
  return `${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`;
}
