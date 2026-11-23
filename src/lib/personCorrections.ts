import type { NameColumn, Person, PersonChange, SacramentRecord } from '../../shared/models';
import { corrected_value } from '../../shared/record_fields';

export type SpouseKey = 'conyuge_1' | 'conyuge_2';

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

export function personOptions(person: Person, spouse?: SpouseKey): CorrectionOption[] {
  return NAME_COLUMNS.map((column) => ({
    key: spouse ? `${spouse}.${column}` : column,
    label: labelOf(column, spouse),
    currentValue: corrected_value(person, column),
  }));
}

export function newChanges(drafts: CorrectionDraft[], spouse?: SpouseKey): PersonChange[] {
  const prefix = spouse ? `${spouse}.` : '';
  return drafts
    .filter((draft) => draft.field.startsWith(prefix) && (spouse || !draft.field.includes('.')))
    .map((draft) => ({ campo_cambio: draft.field.slice(prefix.length) as NameColumn, valor_nuevo: draft.valor_nuevo }));
}

export function recordedChanges(person: Person, spouse?: SpouseKey): RecordedChange[] {
  return person.cambios
    .filter((change) => change.id !== undefined)
    .map((change) => ({ label: labelOf(change.campo_cambio, spouse), change }));
}

export function recordPeople(record: SacramentRecord): Person[] {
  if ('persona' in record) return [record.persona];
  return [record.conyuge_1, record.conyuge_2];
}

export interface MarginalNoteSummary {
  hasText: boolean;
  corrections: number;
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
