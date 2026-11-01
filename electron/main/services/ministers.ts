import type { LocalDatabase } from '../localDb/database';
import { enqueueChange } from './syncQueue';
import { pagination, PAGE_SIZE, ServiceError, sortDirection, targetParish, text, type SearchFilters, type Session } from './common';

export interface MinisterInput {
  titulo?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  nombre: 'min.nombre',
  apellido_paterno: 'min.apellido_paterno',
  apellido_materno: 'min.apellido_materno',
};

function requiredNames(input: MinisterInput) {
  const nombre = text(input.nombre);
  const apellidoPaterno = text(input.apellidoPaterno);
  const apellidoMaterno = text(input.apellidoMaterno);
  if (!nombre || !apellidoPaterno || !apellidoMaterno) {
    throw new ServiceError('Nombre y apellidos son requeridos.', 400);
  }
  return { titulo: text(input.titulo), nombre, apellidoPaterno, apellidoMaterno };
}

function assertCanManage(db: LocalDatabase, session: Session, id: number): void {
  const minister = db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').get(id) as
    | { parroquia_id: number }
    | undefined;

  if (!minister) {
    throw new ServiceError('Ministro no encontrado.', 404);
  }
  if (session.rol !== 'admin' && minister.parroquia_id !== session.parroquiaId) {
    throw new ServiceError('No tiene permiso para modificar ministros de otra parroquia.', 403);
  }
}

function enqueueMinisterChange(db: LocalDatabase, id: number): void {
  const current = db.prepare('SELECT client_id, version FROM ministros WHERE id = ?').get(id) as {
    client_id: string;
    version: number;
  };
  enqueueChange(db, 'ministro', current.client_id, current.version);
}

export const ministers = {
  search(db: LocalDatabase, filters: SearchFilters) {
    const conditions: string[] = [];
    const params: string[] = [];
    const add = (value: string | undefined, column: string) => {
      if (!value) return;
      conditions.push(`min.${column} LIKE ?`);
      params.push(`%${value}%`);
    };
    add(filters.nombre, 'nombre');
    add(filters.apellidoPaterno, 'apellido_paterno');
    add(filters.apellidoMaterno, 'apellido_materno');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ministros min ${where}`).get(...params) as {
      total: number;
    };
    const { offset, totalPages } = pagination(filters, total);
    const sortColumn = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.nombre;

    const priests = db
      .prepare(
        `SELECT min.id, min.titulo, min.nombre, min.apellido_paterno, min.apellido_materno,
                min.parroquia_id, par.nombre AS parroquia_nombre, min.activo
         FROM ministros min
         JOIN parroquias par ON par.id = min.parroquia_id
         ${where}
         ORDER BY ${sortColumn} ${sortDirection(filters)}, min.id
         LIMIT ? OFFSET ?`,
      )
      .all(...params, PAGE_SIZE, offset);

    return { priests, totalPages };
  },

  create(db: LocalDatabase, session: Session, input: MinisterInput, requestedParishId: unknown): number {
    const parroquiaId = targetParish(session, requestedParishId);
    const values = requiredNames(input);
    const clientId = crypto.randomUUID();

    return db.transaction(() => {
      enqueueChange(db, 'ministro', clientId, null);
      return Number(
        db
          .prepare(
            `INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(clientId, parroquiaId, values.titulo, values.nombre, values.apellidoPaterno, values.apellidoMaterno)
          .lastInsertRowid,
      );
    })();
  },

  update(db: LocalDatabase, session: Session, id: number, input: MinisterInput): void {
    assertCanManage(db, session, id);
    const values = requiredNames(input);

    db.transaction(() => {
      enqueueMinisterChange(db, id);
      db.prepare('UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?').run(
        values.titulo,
        values.nombre,
        values.apellidoPaterno,
        values.apellidoMaterno,
        id,
      );
    })();
  },

  toggleActive(db: LocalDatabase, session: Session, id: number): void {
    assertCanManage(db, session, id);

    db.transaction(() => {
      enqueueMinisterChange(db, id);
      db.prepare('UPDATE ministros SET activo = NOT activo WHERE id = ?').run(id);
    })();
  },
};
