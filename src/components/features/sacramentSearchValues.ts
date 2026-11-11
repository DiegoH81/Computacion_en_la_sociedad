import type { RangeFilter, SearchFilters } from '../../../shared/models';

export type SacramentSearchValues = Omit<SearchFilters, 'orden' | 'direccion' | 'pagina' | 'parroquia_id' | 'texto'>;

export interface SearchParish {
  id: number;
  nombre: string;
}

export type TextKey = 'nombres' | 'apellido_paterno' | 'apellido_materno' | 'celebrante' | 'padre' | 'madre' | 'dni' | 'padrino';
export type RangeKey = 'libro' | 'folio' | 'numero' | 'fecha_evento' | 'fecha_nacimiento' | 'fecha_cambio';

export interface RangeValue {
  de: string;
  a: string;
}

export interface FormValues {
  texts: Record<TextKey, string>;
  ranges: Record<RangeKey, RangeValue>;
  estado: string;
  anotaciones: string;
  /** Si se busca también en otras parroquias, y cuáles están marcadas. */
  otherParishes: boolean;
  chosenParishes: number[];
}

export const NUMBER_ROWS: { key: RangeKey; label: string; example: string }[] = [
  { key: 'libro', label: 'Libro', example: 'ej. 21' },
  { key: 'folio', label: 'Folio', example: 'ej. 10' },
  { key: 'numero', label: 'Registro', example: 'ej. 336' },
];

export const DATE_ROWS: { key: RangeKey; label: string }[] = [
  { key: 'fecha_evento', label: 'Fecha del sacramento' },
  { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
  { key: 'fecha_cambio', label: 'Registrada o modificada' },
];

const RANGE_KEYS: RangeKey[] = [...NUMBER_ROWS, ...DATE_ROWS].map((row) => row.key);
const ADVANCED_TEXT_KEYS: TextKey[] = ['celebrante', 'padre', 'madre', 'dni', 'padrino'];

export function emptyValues(): FormValues {
  const ranges = {} as Record<RangeKey, RangeValue>;
  for (const key of RANGE_KEYS) ranges[key] = { de: '', a: '' };

  return {
    texts: { nombres: '', apellido_paterno: '', apellido_materno: '', celebrante: '', padre: '', madre: '', dni: '', padrino: '' },
    ranges,
    estado: '',
    anotaciones: '',
    otherParishes: false,
    chosenParishes: [],
  };
}

/** "de" y "a" convertidos al filtro que entiende la búsqueda. */
function toRangeFilter(range: RangeValue): RangeFilter | null {
  const de = range.de.trim();
  const a = range.a.trim();

  if (de && a) return { operador: 'entre', valor: de, hasta: a };
  if (de) return { operador: '=', valor: de };
  if (a) return { operador: 'hasta', valor: a };
  return null;
}

/** Las parroquias donde se busca; vacío es solo la que se está viendo. */
export function chosenParishIds(values: FormValues, currentParishId: number | null): number[] {
  if (!values.otherParishes) return [];
  if (values.chosenParishes.length === 1 && values.chosenParishes[0] === currentParishId) return [];
  return values.chosenParishes;
}

/** Lo que se llenó, listo para mandar a la búsqueda (lo vacío no se manda). */
export function toSearchFilters(values: FormValues, currentParishId: number | null): SacramentSearchValues {
  const filters: SacramentSearchValues = {};

  for (const key of Object.keys(values.texts) as TextKey[]) {
    const value = values.texts[key].trim();
    if (value) filters[key] = value;
  }

  for (const key of RANGE_KEYS) {
    const range = toRangeFilter(values.ranges[key]);
    if (range) filters[key] = range;
  }

  if (values.estado === 'vigente' || values.estado === 'anulado') filters.estado = values.estado;
  if (values.anotaciones) filters.con_anotaciones = values.anotaciones === 'con';

  const parishes = chosenParishIds(values, currentParishId);
  if (parishes.length > 0) filters.parroquias = parishes;

  return filters;
}

/** Cuántos filtros avanzados hay llenos: se muestra en el botón cuando la sección está cerrada. */
export function countAdvanced(values: FormValues, currentParishId: number | null): number {
  const texts = ADVANCED_TEXT_KEYS.filter((key) => values.texts[key].trim() !== '').length;
  const ranges = RANGE_KEYS.filter((key) => toRangeFilter(values.ranges[key]) !== null).length;
  const selects = [values.estado, values.anotaciones].filter((value) => value !== '').length;
  const parishes = chosenParishIds(values, currentParishId).length > 0 ? 1 : 0;
  return texts + ranges + selects + parishes;
}

/** AAAA-MM-DD como DD/MM/AAAA, para la frase. */
function readableDate(value: string): string {
  const [year, month, day] = value.split('-');
  return day && month ? `${day}/${month}/${year}` : value;
}

export function describeRange(label: string, range: RangeValue, isDate: boolean): string | null {
  const show = (value: string) => (isDate ? readableDate(value) : value);
  const de = range.de.trim();
  const a = range.a.trim();
  const name = label.toLowerCase();

  if (de && a) return `${name} del ${show(de)} al ${show(a)}`;
  if (de) return isDate ? `${name} el ${show(de)}` : `${name} ${de}`;
  if (a) return `${name} hasta ${show(a)}`;
  return null;
}

