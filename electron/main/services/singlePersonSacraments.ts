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
import { insertPerson, nameMatch, updatePersonWithHistory, type PersonInput } from './people';

export interface SinglePersonInput extends SacramentHeader, PersonInput {
  fechaBautizo?: string;
  fechaConfirmacion?: string;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  nombre: 'pe.nombres',
  apellido_paterno: 'pe.apellido_paterno',
  apellido_materno: 'pe.apellido_materno',
};

const CONFIG = {
  bautismo: { table: 'bautismos', eventInput: 'fechaBautizo', eventColumn: 'fecha_bautizo' },
  confirmacion: { table: 'confirmaciones', eventInput: 'fechaConfirmacion', eventColumn: 'fecha_confirmacion' },
} as const;

export function singlePersonSacrament(tipo: keyof typeof CONFIG) {
  const { table, eventInput, eventColumn } = CONFIG[tipo];

  function requireNames(input: SinglePersonInput): void {
    if (!text(input.nombre) || !text(input.apellidoPaterno) || !text(input.apellidoMaterno)) {
      throw new ServiceError('Nombre y apellidos son requeridos.', 400);
    }
  }

  return {
    search(db: LocalDatabase, filters: SearchFilters) {
      const conditions: string[] = [];
      const params: string[] = [];
      const add = (value: string | undefined, column: 'nombres' | 'apellido_paterno' | 'apellido_materno') => {
        if (!value) return;
        conditions.push(nameMatch('pe', column));
        params.push(`%${value}%`, `%${value}%`);
      };
      add(filters.nombre, 'nombres');
      add(filters.apellidoPaterno, 'apellido_paterno');
      add(filters.apellidoMaterno, 'apellido_materno');

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const from = `FROM ${table} sub
        JOIN sacramentos s ON s.id = sub.sacramento_id
        JOIN personas pe ON pe.id = sub.persona_id
        JOIN parroquias par ON par.id = s.parroquia_id`;

      const { total } = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...params) as { total: number };
      const { offset, totalPages } = pagination(filters, total);
      const sortColumn = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.nombre;

      const rows = db
        .prepare(
          `SELECT ${HEADER_SELECT},
                  pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno
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
                  s.fecha_evento AS ${eventColumn}, s.ministro_id AS celebrante_id, s.anotaciones, s.created_at, s.updated_at,
                  s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                  pe.dni, pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno,
                  pe.fecha_nacimiento, pe.edad, pe.lugar_nacimiento,
                  pe.padre AS padre_nombre, pe.madre AS madre_nombre,
                  sub.padrino_1 AS padrino, sub.padrino_2 AS madrina
           FROM ${table} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.persona_id
           JOIN parroquias par ON par.id = s.parroquia_id
           LEFT JOIN ministros min ON min.id = s.ministro_id
           WHERE s.id = ?`,
        )
        .get(id);

      if (!row) throw new ServiceError('Partida no encontrada.', 404);
      return row;
    },

    create(db: LocalDatabase, session: Session, input: SinglePersonInput, requestedParishId: unknown): number {
      const parroquiaId = targetParish(session, requestedParishId);
      requireNames(input);

      return db.transaction(() => {
        const personaId = insertPerson(db, parroquiaId, input);
        const sacramentId = insertSacrament(db, tipo, parroquiaId, input, input[eventInput], input.anotaciones);
        db.prepare(`INSERT INTO ${table} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(
          sacramentId,
          personaId,
          text(input.padrino),
          text(input.madrina),
        );
        return sacramentId;
      })();
    },

    update(db: LocalDatabase, session: Session, id: number, input: SinglePersonInput): void {
      assertCanManage(db, session, id, tipo);
      requireNames(input);

      db.transaction(() => {
        const { persona_id: personaId } = db
          .prepare(`SELECT persona_id FROM ${table} WHERE sacramento_id = ?`)
          .get(id) as { persona_id: number };

        updatePersonWithHistory(db, session, personaId, id, input);
        updateSacrament(db, id, input, input[eventInput], input.anotaciones);
        db.prepare(`UPDATE ${table} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(
          text(input.padrino),
          text(input.madrina),
          id,
        );
      })();
    },

    annul(db: LocalDatabase, session: Session, id: number, motivo: unknown): void {
      annulSacrament(db, session, id, tipo, motivo);
    },
  };
}
