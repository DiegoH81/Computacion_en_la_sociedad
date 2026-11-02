export type SpouseKey = 'esposo' | 'esposa';

/** Fila del subformulario de notas marginales. `field` es la clave de una CorrectionOption. */
export interface CorrectionDraft {
  id: string;
  field: string;
  valorNuevo: string;
}

export interface CorrectionOption {
  key: string;
  label: string;
  currentValue: string;
}

export interface PersonCorrection {
  persona?: SpouseKey;
  campo: string;
  valorNuevo: string;
}

/** Corrección ya guardada en cambios_persona. */
export interface RecordedCorrection {
  persona?: SpouseKey;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha_cambio: string;
}

interface PersonNames {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

const FIELD_LABELS: Record<string, string> = {
  nombres: 'Nombres',
  apellido_paterno: 'Apellido paterno',
  apellido_materno: 'Apellido materno',
};

const SPOUSE_SUFFIX: Record<SpouseKey, string> = {
  esposo: 'del esposo',
  esposa: 'de la esposa',
};

function namesOf(person: PersonNames): [string, string][] {
  return [
    ['nombres', person.nombre],
    ['apellido_paterno', person.apellidoPaterno],
    ['apellido_materno', person.apellidoMaterno],
  ];
}

export function singlePersonOptions(person: PersonNames): CorrectionOption[] {
  return namesOf(person).map(([campo, currentValue]) => ({ key: campo, label: FIELD_LABELS[campo], currentValue }));
}

export function spouseOptions(esposo: PersonNames, esposa: PersonNames): CorrectionOption[] {
  const spouses: [SpouseKey, PersonNames][] = [
    ['esposo', esposo],
    ['esposa', esposa],
  ];
  return spouses.flatMap(([persona, person]) =>
    namesOf(person).map(([campo, currentValue]) => ({
      key: `${persona}.${campo}`,
      label: `${FIELD_LABELS[campo]} ${SPOUSE_SUFFIX[persona]}`,
      currentValue,
    })),
  );
}

export function draftsToBackend(drafts: CorrectionDraft[]): PersonCorrection[] {
  return drafts.map(({ field, valorNuevo }) => {
    const [first, second] = field.split('.');
    return second
      ? { persona: first as SpouseKey, campo: second, valorNuevo }
      : { campo: first, valorNuevo };
  });
}

export function recordedLabel({ persona, campo }: RecordedCorrection): string {
  const label = FIELD_LABELS[campo] ?? campo;
  return persona ? `${label} ${SPOUSE_SUFFIX[persona]}` : label;
}
