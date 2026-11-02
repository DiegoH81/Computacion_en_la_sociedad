import type { LocalDatabase } from '../localDb/database';
import {
  annulSacrament,
  assertCanManage,
  HEADER_SELECT,
  insertSacrament,
  MINISTER_NAME_SELECT,
  pagination,
  PAGE_SIZE,
  ServiceError,
  sortDirection,
  targetParish,
  text,
  updateSacrament,
  type SacramentHeader,
  type SearchFilters,
  type Session,
} from './common';
import {
  applyCorrections,
  correctionList,
  insertPerson,
  listCorrections,
  nameMatch,
  recordCorrections,
  updatePerson,
  type CorrectionInput,
  type PersonInput,
} from './people';

export interface SpouseInput extends PersonInput {
  parroquiaBautismo?: string;
  fechaBautismo?: string;
}

export interface MarriageInput extends SacramentHeader {
  esposo?: SpouseInput;
  esposa?: SpouseInput;
  fechaMatrimonio?: string;
  lugarMatrimonio?: string;
  testigo1?: string;
  testigo2?: string;
  testigo3?: string;
  testigo4?: string;
  notasMarginales?: string;
  correcciones?: CorrectionInput[];
}

const SORT_COLUMNS: Record<string, string> = {
  nombre: 'c1.nombres',
  apellido_paterno: 'c1.apellido_paterno',
  apellido_materno: 'c1.apellido_materno',
};

function requireSpouses(input: MarriageInput): { esposo: SpouseInput; esposa: SpouseInput } {
  if (!text(input.esposo?.nombre) || !text(input.esposa?.nombre)) {
    throw new ServiceError('Los nombres de ambos cónyuges son requeridos.', 400);
  }
  return { esposo: input.esposo as SpouseInput, esposa: input.esposa as SpouseInput };
}

/** Reparte la nota marginal entre los dos cónyuges y aplica a cada uno lo suyo. */
function correctSpouses(input: MarriageInput, esposo: SpouseInput, esposa: SpouseInput) {
  const corrections = correctionList(input.correcciones);
  if (corrections.some(({ persona }) => persona !== 'esposo' && persona !== 'esposa')) {
    throw new ServiceError('La nota marginal debe indicar a qué cónyuge corrige.', 400);
  }
  const forSpouse = (persona: string) => corrections.filter((correction) => correction.persona === persona);
  return {
    esposo: applyCorrections(esposo, forSpouse('esposo')),
    esposa: applyCorrections(esposa, forSpouse('esposa')),
  };
}

function detailValues(input: MarriageInput, esposo: SpouseInput, esposa: SpouseInput) {
  return [
    text(input.lugarMatrimonio),
    text(input.testigo1),
    text(input.testigo2),
    text(input.testigo3),
    text(input.testigo4),
    text(esposo.parroquiaBautismo),
    text(esposo.fechaBautismo),
    text(esposa.parroquiaBautismo),
    text(esposa.fechaBautismo),
  ];
}

function spouseSelect(alias: string, prefix: string, number: 1 | 2): string {
  return `
    ${alias}.dni AS ${prefix}_dni, ${alias}.nombres AS ${prefix}_nombre,
    ${alias}.apellido_paterno AS ${prefix}_apellido_paterno,
    ${alias}.apellido_materno AS ${prefix}_apellido_materno,
    ${alias}.fecha_nacimiento AS ${prefix}_fecha_nacimiento, ${alias}.edad AS ${prefix}_edad,
    ${alias}.lugar_nacimiento AS ${prefix}_lugar_nacimiento,
    ${alias}.padre AS ${prefix}_padre_nombre, ${alias}.madre AS ${prefix}_madre_nombre,
    m.conyuge_${number}_bautismo_parroquia AS ${prefix}_parroquia_bautismo,
    m.conyuge_${number}_bautismo_fecha AS ${prefix}_fecha_bautismo`;
}

export const marriages = {
  search(db: LocalDatabase, filters: SearchFilters) {
    const conditions: string[] = [];
    const params: string[] = [];
    const add = (value: string | undefined, column: 'nombres' | 'apellido_paterno' | 'apellido_materno') => {
      if (!value) return;
      conditions.push(`(${nameMatch('c1', column)} OR ${nameMatch('c2', column)})`);
      params.push(`%${value}%`, `%${value}%`, `%${value}%`, `%${value}%`);
    };
    add(filters.nombre, 'nombres');
    add(filters.apellidoPaterno, 'apellido_paterno');
    add(filters.apellidoMaterno, 'apellido_materno');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = `FROM matrimonios m
      JOIN sacramentos s ON s.id = m.sacramento_id
      JOIN personas c1 ON c1.id = m.conyuge_1_id
      JOIN personas c2 ON c2.id = m.conyuge_2_id
      JOIN parroquias par ON par.id = s.parroquia_id`;

    const { total } = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...params) as { total: number };
    const { offset, totalPages } = pagination(filters, total);
    const sortColumn = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.nombre;

    const rows = db
      .prepare(
        `SELECT ${HEADER_SELECT},
                c1.nombres AS esposo_nombre, c1.apellido_paterno AS esposo_apellido_paterno,
                c1.apellido_materno AS esposo_apellido_materno,
                c2.nombres AS esposa_nombre, c2.apellido_paterno AS esposa_apellido_paterno,
                c2.apellido_materno AS esposa_apellido_materno
         ${from} ${where}
         ORDER BY ${sortColumn} ${sortDirection(filters)}, s.id
         LIMIT ? OFFSET ?`,
      )
      .all(...params, PAGE_SIZE, offset);

    return { rows, totalPages };
  },

  getById(db: LocalDatabase, id: number) {
    const row = db
      .prepare(
        `SELECT ${HEADER_SELECT}, ${MINISTER_NAME_SELECT},
                s.fecha_evento AS fecha_matrimonio, s.ministro_id AS celebrante_id,
                s.anotaciones AS notas_marginales, s.created_at, s.updated_at,
                par.ubicacion AS parroquia_ubicacion,
                s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                m.conyuge_1_id, m.lugar AS lugar_matrimonio, m.testigo_1, m.testigo_2, m.testigo_3, m.testigo_4,
                ${spouseSelect('c1', 'esposo', 1)},
                ${spouseSelect('c2', 'esposa', 2)}
         FROM matrimonios m
         JOIN sacramentos s ON s.id = m.sacramento_id
         JOIN personas c1 ON c1.id = m.conyuge_1_id
         JOIN personas c2 ON c2.id = m.conyuge_2_id
         JOIN parroquias par ON par.id = s.parroquia_id
         LEFT JOIN ministros min ON min.id = s.ministro_id
         WHERE s.id = ?`,
      )
      .get(id) as ({ conyuge_1_id: number } & Record<string, unknown>) | undefined;

    if (!row) throw new ServiceError('Partida no encontrada.', 404);
    return {
      ...row,
      correcciones: listCorrections(db, id).map((correction) => ({
        ...correction,
        persona: correction.persona_id === row.conyuge_1_id ? 'esposo' : 'esposa',
      })),
    };
  },

  create(db: LocalDatabase, session: Session, input: MarriageInput, requestedParishId: unknown): number {
    const parroquiaId = targetParish(session, requestedParishId);
    const { esposo, esposa } = requireSpouses(input);
    const corrected = correctSpouses(input, esposo, esposa);

    return db.transaction(() => {
      const conyuge1 = insertPerson(db, parroquiaId, corrected.esposo.person);
      const conyuge2 = insertPerson(db, parroquiaId, corrected.esposa.person);
      const sacramentId = insertSacrament(db, 'matrimonio', parroquiaId, input, input.fechaMatrimonio, input.notasMarginales);

      db.prepare(
        `INSERT INTO matrimonios (
           sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
           conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha,
           conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(sacramentId, conyuge1, conyuge2, ...detailValues(input, esposo, esposa));
      recordCorrections(db, session, conyuge1, sacramentId, corrected.esposo.records);
      recordCorrections(db, session, conyuge2, sacramentId, corrected.esposa.records);

      return sacramentId;
    })();
  },

  update(db: LocalDatabase, session: Session, id: number, input: MarriageInput): void {
    assertCanManage(db, session, id, 'matrimonio');
    const { esposo, esposa } = requireSpouses(input);
    const corrected = correctSpouses(input, esposo, esposa);

    db.transaction(() => {
      const current = db
        .prepare('SELECT conyuge_1_id, conyuge_2_id FROM matrimonios WHERE sacramento_id = ?')
        .get(id) as { conyuge_1_id: number; conyuge_2_id: number };

      updatePerson(db, current.conyuge_1_id, corrected.esposo.person);
      updatePerson(db, current.conyuge_2_id, corrected.esposa.person);
      recordCorrections(db, session, current.conyuge_1_id, id, corrected.esposo.records);
      recordCorrections(db, session, current.conyuge_2_id, id, corrected.esposa.records);
      updateSacrament(db, id, input, input.fechaMatrimonio, input.notasMarginales);

      db.prepare(
        `UPDATE matrimonios SET
           lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
           conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
           conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
         WHERE sacramento_id = ?`,
      ).run(...detailValues(input, esposo, esposa), id);
    })();
  },

  annul(db: LocalDatabase, session: Session, id: number, motivo: unknown): void {
    annulSacrament(db, session, id, 'matrimonio', motivo);
  },
};
