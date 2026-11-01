import type { LocalDatabase } from '../localDb/database';
import { ServiceError, type SacramentType, type Session } from './common';

export interface SacramentIndexEntry {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  libro: string;
  folio: string;
  registro: string;
}

const PEOPLE: Record<SacramentType, { table: string; personColumn: string }[]> = {
  bautismo: [{ table: 'bautismos', personColumn: 'persona_id' }],
  confirmacion: [{ table: 'confirmaciones', personColumn: 'persona_id' }],
  matrimonio: [
    { table: 'matrimonios', personColumn: 'conyuge_1_id' },
    { table: 'matrimonios', personColumn: 'conyuge_2_id' },
  ],
};

const compareText = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

function assertValidRequest(session: Session, tipo: unknown, parroquiaId: unknown): asserts tipo is SacramentType {
  if (typeof tipo !== 'string' || !Object.hasOwn(PEOPLE, tipo)) {
    throw new ServiceError('Tipo de sacramento no válido.', 404);
  }
  if (!Number.isInteger(parroquiaId) || (parroquiaId as number) <= 0) {
    throw new ServiceError('Debe especificar la parroquia.', 400);
  }
  if (session.rol !== 'admin' && session.parroquiaId !== parroquiaId) {
    throw new ServiceError('No tiene permiso para imprimir el índice de otra parroquia.', 403);
  }
}

export function listIndexBooks(db: LocalDatabase, session: Session, tipo: unknown, parroquiaId: unknown): string[] {
  assertValidRequest(session, tipo, parroquiaId);
  const books = db
    .prepare(
      `SELECT DISTINCT libro FROM sacramentos
       WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'`,
    )
    .pluck()
    .all(tipo, parroquiaId) as string[];
  return books.sort(compareText);
}

export function getIndexEntries(
  db: LocalDatabase,
  session: Session,
  tipo: unknown,
  parroquiaId: unknown,
  libro: string | null,
): SacramentIndexEntry[] {
  assertValidRequest(session, tipo, parroquiaId);

  const entries = PEOPLE[tipo].flatMap(
    ({ table, personColumn }) =>
      db
        .prepare(
          `SELECT pe.nombres, pe.apellido_paterno AS apellidoPaterno, pe.apellido_materno AS apellidoMaterno,
                  s.libro, s.folio, s.numero AS registro
           FROM ${table} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.${personColumn}
           WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`,
        )
        .all(parroquiaId, libro, libro) as SacramentIndexEntry[],
  );

  return entries.sort(
    (a, b) =>
      compareText(a.apellidoPaterno, b.apellidoPaterno) ||
      compareText(a.apellidoMaterno, b.apellidoMaterno) ||
      compareText(a.nombres, b.nombres) ||
      compareText(a.libro, b.libro) ||
      compareText(a.folio, b.folio) ||
      compareText(a.registro, b.registro),
  );
}
