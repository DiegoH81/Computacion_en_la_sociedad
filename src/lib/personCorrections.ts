import type { NameColumn, Person, PersonChange, SacramentRecord } from '../../shared/models';

/** En un matrimonio, a qué cónyuge corresponde una corrección. */
export type SpouseKey = 'conyuge_1' | 'conyuge_2';

/**
 * Fila del subformulario de notas marginales. `field` es la clave de una CorrectionOption:
 * el nombre de la columna ("nombres") o, en un matrimonio, "conyuge_1.nombres".
 */
export interface CorrectionDraft {
  id: string;
  field: string;
  valor_nuevo: string;
}

export interface CorrectionOption {
  key: string;
  label: string;
  currentValue: string;
}

/** Una corrección ya registrada, con el texto para mostrarla. */
export interface RecordedChange {
  label: string;
  change: PersonChange;
}

const FIELD_LABELS: Record<NameColumn, string> = {
  nombres: 'Nombres',
  apellido_paterno: 'Apellido paterno',
  apellido_materno: 'Apellido materno',
};

const NAME_COLUMNS = Object.keys(FIELD_LABELS) as NameColumn[];

const SPOUSE_SUFFIX: Record<SpouseKey, string> = {
  conyuge_1: 'del esposo',
  conyuge_2: 'de la esposa',
};

function labelOf(column: NameColumn, spouse?: SpouseKey): string {
  return spouse ? `${FIELD_LABELS[column]} ${SPOUSE_SUFFIX[spouse]}` : FIELD_LABELS[column];
}

/** Los datos que se pueden corregir de una persona, con su valor actual. */
export function personOptions(person: Person, spouse?: SpouseKey): CorrectionOption[] {
  return NAME_COLUMNS.map((column) => ({
    key: spouse ? `${spouse}.${column}` : column,
    label: labelOf(column, spouse),
    currentValue: person[column],
  }));
}

/** Las correcciones nuevas de una persona, a partir de las filas del subformulario. */
export function newChanges(drafts: CorrectionDraft[], spouse?: SpouseKey): PersonChange[] {
  const prefix = spouse ? `${spouse}.` : '';
  return drafts
    .filter((draft) => draft.field.startsWith(prefix) && (spouse || !draft.field.includes('.')))
    .map((draft) => ({ campo_cambio: draft.field.slice(prefix.length) as NameColumn, valor_nuevo: draft.valor_nuevo }));
}

/** Las correcciones ya registradas de una persona, para mostrarlas. */
export function recordedChanges(person: Person, spouse?: SpouseKey): RecordedChange[] {
  return person.cambios
    .filter((change) => change.id !== undefined)
    .map((change) => ({ label: labelOf(change.campo_cambio, spouse), change }));
}

/** Las personas de una partida: una en bautismo y confirmación, dos en matrimonio. */
export function recordPeople(record: SacramentRecord): Person[] {
  if ('persona' in record) return [record.persona];
  return [record.conyuge_1, record.conyuge_2];
}

/** Lo que la tabla muestra de las anotaciones marginales de una partida. */
export interface MarginalNoteSummary {
  hasText: boolean;
  corrections: number;
  /** Datos que pidió cambiar un usuario y esperan al administrador. */
  pending: number;
}

export function marginalNoteSummary(record: SacramentRecord): MarginalNoteSummary {
  const changes = recordPeople(record).flatMap((person) => person.cambios);
  return {
    hasText: Boolean(record.sacramento.anotaciones?.trim()),
    corrections: changes.filter((change) => change.estado === 'aprobado' || change.estado === undefined).length,
    pending: (record.sacramento.solicitudes ?? []).filter((request) => request.estado === 'pendiente').length,
  };
}
