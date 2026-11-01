import type { LocalDatabase } from '../localDb/database';
import { enqueueChange } from './syncQueue';

export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';

export interface Session {
  usuarioId: number;
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
  token: string;
}

export class ServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
  }
}

export const PAGE_SIZE = 20;

export interface SearchFilters {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy?: string;
  sortDirection?: string;
  page?: number;
}

export function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function positiveId(value: unknown, notFound: 'Partida' | 'Ministro' = 'Partida'): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new ServiceError(notFound === 'Partida' ? 'Partida no encontrada.' : 'Ministro no encontrado.', 404);
  }
  return value as number;
}

export function pagination(filters: SearchFilters, total: number) {
  const page = Number.isInteger(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  return {
    offset: (page - 1) * PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export function sortDirection(filters: SearchFilters): 'ASC' | 'DESC' {
  return filters.sortDirection === 'desc' ? 'DESC' : 'ASC';
}

export function targetParish(session: Session, requestedParishId: unknown): number {
  if (session.rol === 'admin') {
    if (!Number.isInteger(requestedParishId) || (requestedParishId as number) <= 0) {
      throw new ServiceError('Debe especificar la parroquia.', 400);
    }
    return requestedParishId as number;
  }
  if (!session.parroquiaId) {
    throw new ServiceError('El usuario no tiene una parroquia asignada.', 400);
  }
  return session.parroquiaId;
}

export function assertCanManage(
  db: LocalDatabase,
  session: Session,
  sacramentId: number,
  tipo: SacramentType,
): void {
  const sacrament = db
    .prepare('SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?')
    .get(sacramentId, tipo) as { parroquia_id: number } | undefined;

  if (!sacrament) {
    throw new ServiceError('Partida no encontrada.', 404);
  }
  if (session.rol !== 'admin' && sacrament.parroquia_id !== session.parroquiaId) {
    throw new ServiceError('No tiene permiso para modificar partidas de otra parroquia.', 403);
  }
}

export interface SacramentHeader {
  fechaSacramento?: string;
  numeroLibro?: string;
  numeroFolio?: string;
  numeroRegistro?: string;
  celebranteId?: number | null;
}

function headerColumns(header: SacramentHeader, fechaEvento: unknown, anotaciones: unknown) {
  const fechaEmision = text(header.fechaSacramento);
  const libro = text(header.numeroLibro);
  const folio = text(header.numeroFolio);
  const numero = text(header.numeroRegistro);

  if (!fechaEmision || !libro || !folio || !numero) {
    throw new ServiceError('La fecha, el libro, el folio y el número de registro son requeridos.', 400);
  }

  return {
    fechaEmision,
    libro,
    folio,
    numero,
    ministroId: header.celebranteId ?? null,
    fechaEvento: text(fechaEvento),
    anotaciones: text(anotaciones),
  };
}

export function insertSacrament(
  db: LocalDatabase,
  tipo: SacramentType,
  parroquiaId: number,
  header: SacramentHeader,
  fechaEvento: unknown,
  anotaciones: unknown,
): number {
  const columns = headerColumns(header, fechaEvento, anotaciones);
  const clientId = crypto.randomUUID();
  enqueueChange(db, tipo, clientId, null);
  return Number(
    db
      .prepare(
        `INSERT INTO sacramentos
           (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        clientId,
        tipo,
        parroquiaId,
        columns.ministroId,
        columns.libro,
        columns.folio,
        columns.numero,
        columns.fechaEmision,
        columns.fechaEvento,
        columns.anotaciones,
      ).lastInsertRowid,
  );
}

function enqueueSacramentChange(db: LocalDatabase, sacramentId: number): void {
  const current = db
    .prepare('SELECT tipo, client_id, version FROM sacramentos WHERE id = ?')
    .get(sacramentId) as { tipo: SacramentType; client_id: string; version: number };
  enqueueChange(db, current.tipo, current.client_id, current.version);
}

export function updateSacrament(
  db: LocalDatabase,
  sacramentId: number,
  header: SacramentHeader,
  fechaEvento: unknown,
  anotaciones: unknown,
): void {
  const columns = headerColumns(header, fechaEvento, anotaciones);
  enqueueSacramentChange(db, sacramentId);
  db.prepare(
    `UPDATE sacramentos
     SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?
     WHERE id = ?`,
  ).run(
    columns.ministroId,
    columns.libro,
    columns.folio,
    columns.numero,
    columns.fechaEmision,
    columns.fechaEvento,
    columns.anotaciones,
    sacramentId,
  );
}

export function annulSacrament(
  db: LocalDatabase,
  session: Session,
  sacramentId: number,
  tipo: SacramentType,
  motivo: unknown,
): void {
  assertCanManage(db, session, sacramentId, tipo);

  const reason = text(motivo);
  if (!reason) {
    throw new ServiceError('El motivo de anulación es requerido.', 400);
  }

  db.transaction(() => {
    enqueueSacramentChange(db, sacramentId);
    db.prepare(
      `UPDATE sacramentos
       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
       WHERE id = ?`,
    ).run(session.usuarioId, new Date().toISOString(), reason, sacramentId);
  })();
}

export const HEADER_SELECT = `
  s.id, s.parroquia_id, par.nombre AS parroquia_nombre,
  s.fecha_emision AS fecha_sacramento, s.libro AS numero_libro, s.folio AS numero_folio,
  s.numero AS numero_registro, s.estado`;

export const MINISTER_NAME_SELECT = `
  min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS celebrante_nombre`;
