import type { LocalDatabase } from '../localDb/database';
import { ServiceError, text, type Session } from './common';

export interface PersonInput {
  dni?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  edad?: string | number | null;
  lugarNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
}

/** Un dato que una nota marginal cambia. `persona` solo aplica a partidas de dos personas. */
export interface CorrectionInput {
  persona?: string;
  campo?: string;
  valorNuevo?: string;
}

export interface PendingCorrection {
  campo: string;
  anterior: string;
  nuevo: string;
}

const PERSON_COLUMNS = [
  'dni',
  'nombres',
  'apellido_paterno',
  'apellido_materno',
  'fecha_nacimiento',
  'edad',
  'lugar_nacimiento',
  'padre',
  'madre',
] as const;

type PersonColumn = (typeof PERSON_COLUMNS)[number];
type PersonRow = Record<PersonColumn, string | number | null>;

const CORRECTABLE_FIELDS = {
  nombres: { input: 'nombre', label: 'Nombres' },
  apellido_paterno: { input: 'apellidoPaterno', label: 'Apellido paterno' },
  apellido_materno: { input: 'apellidoMaterno', label: 'Apellido materno' },
} as const;

function parseAge(value: PersonInput['edad']): number | null {
  if (value === undefined || value === null || value === '') return null;
  const age = Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 150) {
    throw new ServiceError('La edad debe ser un número entre 0 y 150.', 400);
  }
  return age;
}

function toRow(input: PersonInput): PersonRow {
  return {
    dni: text(input.dni),
    nombres: text(input.nombre) ?? '',
    apellido_paterno: text(input.apellidoPaterno) ?? '',
    apellido_materno: text(input.apellidoMaterno) ?? '',
    fecha_nacimiento: text(input.fechaNacimiento),
    edad: parseAge(input.edad),
    lugar_nacimiento: text(input.lugarNacimiento),
    padre: text(input.padreNombre),
    madre: text(input.madreNombre),
  };
}

export function insertPerson(db: LocalDatabase, parroquiaId: number, input: PersonInput): number {
  const row = toRow(input);
  return Number(
    db
      .prepare(
        `INSERT INTO personas (client_id, parroquia_id, ${PERSON_COLUMNS.join(', ')})
         VALUES (?, ?, ${PERSON_COLUMNS.map(() => '?').join(', ')})`,
      )
      .run(crypto.randomUUID(), parroquiaId, ...PERSON_COLUMNS.map((column) => row[column]))
      .lastInsertRowid,
  );
}

/** Actualiza los datos de la persona. Solo una nota marginal deja constancia en cambios_persona. */
export function updatePerson(db: LocalDatabase, personaId: number, input: PersonInput): void {
  const next = toRow(input);
  const current = db
    .prepare(`SELECT ${PERSON_COLUMNS.join(', ')} FROM personas WHERE id = ?`)
    .get(personaId) as PersonRow;

  const changed = PERSON_COLUMNS.filter((column) => current[column] !== next[column]);
  if (changed.length === 0) return;

  db.prepare(`UPDATE personas SET ${changed.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(
    ...changed.map((column) => next[column]),
    personaId,
  );
}

/**
 * Aplica sobre los datos del formulario lo que indica la nota marginal: el valor anterior es el
 * que está en el formulario al guardar. Devuelve la persona corregida y lo que hay que registrar.
 */
export function applyCorrections(
  person: PersonInput,
  corrections: CorrectionInput[],
): { person: PersonInput; records: PendingCorrection[] } {
  const corrected: PersonInput = { ...person };
  const records: PendingCorrection[] = [];

  for (const correction of corrections) {
    const campo = correction.campo as keyof typeof CORRECTABLE_FIELDS;
    const field = Object.hasOwn(CORRECTABLE_FIELDS, campo) ? CORRECTABLE_FIELDS[campo] : undefined;
    if (!field) throw new ServiceError('La nota marginal indica un campo que no se puede corregir.', 400);
    if (records.some((record) => record.campo === campo)) {
      throw new ServiceError(`La nota marginal repite el campo ${field.label}.`, 400);
    }

    const anterior = text(person[field.input]);
    const nuevo = text(correction.valorNuevo);
    if (!anterior) throw new ServiceError(`Complete ${field.label} antes de corregirlo en la nota marginal.`, 400);
    if (!nuevo) throw new ServiceError(`Indique el valor nuevo de ${field.label} en la nota marginal.`, 400);
    if (nuevo === anterior) throw new ServiceError(`El valor nuevo de ${field.label} es igual al anterior.`, 400);

    corrected[field.input] = nuevo;
    records.push({ campo, anterior, nuevo });
  }

  return { person: corrected, records };
}

export function recordCorrections(
  db: LocalDatabase,
  session: Session,
  personaId: number,
  sacramentoId: number,
  records: PendingCorrection[],
): void {
  const insert = db.prepare(
    `INSERT INTO cambios_persona
       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const { campo, anterior, nuevo } of records) {
    insert.run(crypto.randomUUID(), personaId, sacramentoId, session.usuarioId, campo, anterior, nuevo);
  }
}

export function listCorrections(db: LocalDatabase, sacramentoId: number) {
  return db
    .prepare(
      `SELECT persona_id, campo_cambio AS campo, valor_anterior, valor_nuevo, fecha_cambio
       FROM cambios_persona WHERE sacramento_id = ? ORDER BY id`,
    )
    .all(sacramentoId) as {
    persona_id: number;
    campo: string;
    valor_anterior: string | null;
    valor_nuevo: string | null;
    fecha_cambio: string;
  }[];
}

export function correctionList(value: unknown): CorrectionInput[] {
  return Array.isArray(value) ? (value as CorrectionInput[]) : [];
}

export function nameMatch(alias: string, column: 'nombres' | 'apellido_paterno' | 'apellido_materno'): string {
  return `(${alias}.${column} LIKE ? OR EXISTS (
    SELECT 1 FROM cambios_persona cp
    WHERE cp.persona_id = ${alias}.id AND cp.campo_cambio = '${column}' AND cp.valor_anterior LIKE ?
  ))`;
}
