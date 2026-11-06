import type { IndexEntry } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { check_parish_access } from '../models/parish';
import { is_sacrament_type, people_of } from '../models/sacrament';
import type { Session } from '../models/session';
import { ServiceError } from '../utils/errors';
import type { Routes } from '../utils/middleware';

const compare_text = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

function check_request(session: Session, type: unknown, parish_id: unknown): asserts type is SacramentType
{
	if (!is_sacrament_type(type))
		throw new ServiceError('Tipo de sacramento no válido.', 404);

	if (!Number.isInteger(parish_id) || (parish_id as number) <= 0)
		throw new ServiceError('Debe especificar la parroquia.', 400);

	check_parish_access(session, parish_id as number, 'No tiene permiso para imprimir el índice de otra parroquia.');
}

export function list_index_books(db: LocalDatabase, session: Session, type: unknown, parish_id: unknown): string[]
{
	check_request(session, type, parish_id);

	const books = db
		.prepare(`SELECT DISTINCT libro FROM sacramentos WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'`)
		.pluck()
		.all(type, parish_id) as string[];

	return books.sort(compare_text);
}

export function get_index_entries(db: LocalDatabase, session: Session, type: unknown, parish_id: unknown, book: string | null): IndexEntry[]
{
	check_request(session, type, parish_id);

	const entries = db
		.prepare(
			`SELECT pe.nombres, pe.apellido_paterno, pe.apellido_materno, s.libro, s.folio, s.numero
			 FROM (${people_of(type)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`,
		)
		.all(parish_id, book, book) as IndexEntry[];

	return entries.sort((a, b) =>
		compare_text(a.apellido_paterno, b.apellido_paterno) ||
		compare_text(a.apellido_materno, b.apellido_materno) ||
		compare_text(a.nombres, b.nombres) ||
		compare_text(a.libro, b.libro) ||
		compare_text(a.folio, b.folio) ||
		compare_text(a.numero, b.numero));
}

export const sacrament_index_routes: Routes =
{
	'sacramentIndex.books': (payload: { tipo: unknown; parroquia_id: unknown }, { db, session }) =>
	{
		const books = list_index_books(db, session, payload.tipo, payload.parroquia_id);
		return { libros: books };
	},

	'sacramentIndex.entries': (payload: { tipo: unknown; parroquia_id: unknown; libro: string | null }, { db, session }) =>
	{
		const entries = get_index_entries(db, session, payload.tipo, payload.parroquia_id, payload.libro);
		return { entradas: entries };
	},
};
