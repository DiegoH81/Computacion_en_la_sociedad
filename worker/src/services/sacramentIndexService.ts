export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';

export interface SacramentIndexEntry {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  libro: string;
  folio: string;
  registro: string;
}

interface PersonColumns {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

// Lista blanca: estos nombres se interpolan en el SQL, nunca vienen del cliente.
const SOURCES: Record<SacramentType, { table: string; people: PersonColumns[] }> = {
  bautismo: {
    table: 'bautismos_legacy',
    people: [{ nombres: 'nombre', apellidoPaterno: 'apellido_paterno', apellidoMaterno: 'apellido_materno' }],
  },
  confirmacion: {
    table: 'confirmaciones_legacy',
    people: [{ nombres: 'nombre', apellidoPaterno: 'apellido_paterno', apellidoMaterno: 'apellido_materno' }],
  },
  // Cada cónyuge tiene su propia línea, para poder encontrarlo por su apellido.
  matrimonio: {
    table: 'matrimonios_legacy',
    people: [
      {
        nombres: 'esposo_nombre',
        apellidoPaterno: 'esposo_apellido_paterno',
        apellidoMaterno: 'esposo_apellido_materno',
      },
      {
        nombres: 'esposa_nombre',
        apellidoPaterno: 'esposa_apellido_paterno',
        apellidoMaterno: 'esposa_apellido_materno',
      },
    ],
  },
};

export function isSacramentType(value: string): value is SacramentType {
  return Object.hasOwn(SOURCES, value);
}

const compareText = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

export async function listIndexBooks(
  db: D1Database,
  tipo: SacramentType,
  parroquiaId: number,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT numero_libro AS libro FROM ${SOURCES[tipo].table}
       WHERE parroquia_id = ? AND estado = 'vigente'`,
    )
    .bind(parroquiaId)
    .all<{ libro: string }>();

  return results.map((row) => row.libro).sort(compareText);
}

export async function getIndexEntries(
  db: D1Database,
  tipo: SacramentType,
  parroquiaId: number,
  libro?: string,
): Promise<SacramentIndexEntry[]> {
  const { table, people } = SOURCES[tipo];
  const entries: SacramentIndexEntry[] = [];

  for (const person of people) {
    const { results } = await db
      .prepare(
        `SELECT ${person.nombres} AS nombres,
                ${person.apellidoPaterno} AS apellidoPaterno,
                ${person.apellidoMaterno} AS apellidoMaterno,
                numero_libro AS libro, numero_folio AS folio, numero_registro AS registro
         FROM ${table}
         WHERE parroquia_id = ? AND estado = 'vigente' AND (? IS NULL OR numero_libro = ?)`,
      )
      .bind(parroquiaId, libro ?? null, libro ?? null)
      .all<SacramentIndexEntry>();

    entries.push(...results);
  }

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
