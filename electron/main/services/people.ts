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

export function updatePersonWithHistory(
  db: LocalDatabase,
  session: Session,
  personaId: number,
  sacramentoId: number,
  input: PersonInput,
): void {
  const next = toRow(input);
  const current = db
    .prepare(`SELECT ${PERSON_COLUMNS.join(', ')} FROM personas WHERE id = ?`)
    .get(personaId) as PersonRow;

  const changed = PERSON_COLUMNS.filter((column) => current[column] !== next[column]);
  if (changed.length === 0) return;

  const history = db.prepare(
    `INSERT INTO cambios_persona
       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const asText = (value: string | number | null) => (value === null ? null : String(value));

  for (const column of changed) {
    history.run(
      crypto.randomUUID(),
      personaId,
      sacramentoId,
      session.usuarioId,
      column,
      asText(current[column]),
      asText(next[column]),
    );
  }

  db.prepare(`UPDATE personas SET ${changed.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(
    ...changed.map((column) => next[column]),
    personaId,
  );
}

export function nameMatch(alias: string, column: 'nombres' | 'apellido_paterno' | 'apellido_materno'): string {
  return `(${alias}.${column} LIKE ? OR EXISTS (
    SELECT 1 FROM cambios_persona cp
    WHERE cp.persona_id = ${alias}.id AND cp.campo_cambio = '${column}' AND cp.valor_anterior LIKE ?
  ))`;
}
