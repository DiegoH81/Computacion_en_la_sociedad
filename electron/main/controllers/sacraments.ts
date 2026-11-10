// Las partidas: buscar, ver, registrar, editar, anular y ver su historial.
//
//   sacraments.search / sacraments.get   consultar (cualquier parroquia)
//   sacraments.create                    registrar, en la parroquia de la sesión
//   sacraments.update                    un administrador edita; un usuario pide el cambio (controllers/requests.ts)
//   sacraments.annul                     anular, con motivo (solo un administrador)
//   sacraments.restore                   rehabilitar una partida anulada, con motivo (solo un administrador)
//   sacraments.history                   el historial de la partida (solo administradores)
//
// Cada cambio queda en el historial de la partida (models/history.ts) y en la cola para subirse.

import type { Baptism, HistoryEntry, Marriage, NameColumn, RangeFilter, SacramentRecord, SearchFilters, SearchPage } from '../../../shared/models';
import { NOTES_MAX_LENGTH } from '../../../shared/record_fields';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { insert_requests } from '../models/change_request';
import { add_history, read_history } from '../models/history';
import { check_parish_read, parish_for_new } from '../models/parish';
import { name_condition, save_corrections } from '../models/person';
import { check_required, corrections_of, insert_detail, insert_people, NOT_FOUND, queue_sacrament, read_record, save_edit } from '../models/record';
import { check_can_manage, detail_table, insert_sacrament, is_sacrament_type } from '../models/sacrament';
import type { Session } from '../models/session';
import { add_to_queue } from '../sync/queue';
import { PAGE_SIZE } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { clean_text, page_of, positive_id, sort_direction } from '../utils/helpers';
import type { Routes } from '../utils/middleware';
import { request_changes, resolve_on_edit } from './requests';

export { read_marriage, read_person_sacrament, read_record } from '../models/record';

export type PersonSacramentType = 'bautismo' | 'confirmacion';

const NAME_COLUMNS: NameColumn[] = ['nombres', 'apellido_paterno', 'apellido_materno'];

function check_type(value: unknown): SacramentType
{
	if (!is_sacrament_type(value))
		throw new ServiceError('Tipo de sacramento inválido.', 400);

	return value;
}

// ---------------------------------------------------------------------------
// Buscar
// ---------------------------------------------------------------------------

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d+$/;

// Lo que se busca por parte del texto (LIKE): la condición recibe el patrón una vez por cada "?".
function contains(conditions: string[], values: (string | number)[], text: unknown, sql: string): void
{
	const clean = clean_text(text);
	if (!clean)
		return;

	conditions.push(`(${sql})`);
	const count = sql.split('?').length - 1;
	for (let i = 0; i < count; i++)
		values.push(`%${clean}%`);
}

// Un filtro con operador ("=", desde, hasta o entre) sobre una expresión SQL: devuelve la condición y
// sus valores, o null si no se llenó bien. Las fechas se comparan como texto AAAA-MM-DD; libro, folio y
// número, como número cuando lo escrito es un número (así el folio 9 queda antes que el 10).
type RangeKind = 'registro' | 'fecha';

function range_condition(filter: unknown, sql: string, kind: RangeKind): { sql: string; values: (string | number)[] } | null
{
	if (!filter || typeof filter !== 'object')
		return null;

	const { operador, valor, hasta } = filter as RangeFilter;
	const first = clean_text(valor);
	const second = clean_text(hasta);
	if (!first || (kind === 'fecha' && !DATE_PATTERN.test(first)))
		return null;

	if (operador === '=')
	{
		if (kind === 'fecha')
			return { sql: `${sql} = ?`, values: [first] };

		return { sql: `${sql} = ? COLLATE NOCASE`, values: [first] };
	}

	const bounds: [string, string][] = [];
	if (operador === 'desde')
		bounds.push(['>=', first]);
	else if (operador === 'hasta')
		bounds.push(['<=', first]);
	else if (operador === 'entre')
	{
		bounds.push(['>=', first]);
		if (second && (kind === 'registro' || DATE_PATTERN.test(second)))
			bounds.push(['<=', second]);
	}
	else
		return null;

	const signs = bounds.map(([sign]) => sign);
	const limits = bounds.map(([, value]) => value);

	if (kind === 'fecha')
		return { sql: signs.map((sign) => `${sql} ${sign} ?`).join(' AND '), values: limits };

	if (!limits.every((value) => NUMBER_PATTERN.test(value)))
		return { sql: signs.map((sign) => `${sql} ${sign} ? COLLATE NOCASE`).join(' AND '), values: limits };

	// Solo las partidas cuyo valor es un número entero (un libro "B" no está "entre 1 y 5").
	const numeric = signs.map((sign) => `CAST(${sql} AS INTEGER) ${sign} ?`);
	return {
		sql: `${sql} <> '' AND ${sql} NOT GLOB '*[^0-9]*' AND ${numeric.join(' AND ')}`,
		values: limits.map((value) => Number(value)),
	};
}

// La misma condición sobre varias expresiones: basta con que una la cumpla (por ejemplo, la fecha de
// nacimiento de cualquiera de los dos cónyuges).
function add_range(conditions: string[], values: (string | number)[], filter: unknown, sqls: string[], kind: RangeKind): void
{
	const parts: { sql: string; values: (string | number)[] }[] = [];
	for (const sql of sqls)
	{
		const part = range_condition(filter, sql, kind);
		if (!part)
			return;

		parts.push(part);
	}

	conditions.push(`(${parts.map((part) => `(${part.sql})`).join(' OR ')})`);
	for (const part of parts)
		values.push(...part.values);
}

// La búsqueda avanzada: libro, folio y número, fechas, celebrante, padres, DNI, padrinos, estado y
// anotaciones. En matrimonio, lo de la persona vale para cualquiera de los dos cónyuges.
function advanced_filters(filters: SearchFilters, type: SacramentType, aliases: string[], conditions: string[], values: (string | number)[]): void
{
	for (const column of ['libro', 'folio', 'numero'] as const)
		add_range(conditions, values, filters[column], [`TRIM(s.${column})`], 'registro');

	add_range(conditions, values, filters.fecha_evento, ['s.fecha_evento'], 'fecha');
	add_range(conditions, values, filters.fecha_nacimiento, aliases.map((alias) => `${alias}.fecha_nacimiento`), 'fecha');

	// Registrada o modificada en esas fechas: el día según la hora de esta PC (la base guarda en UTC).
	add_range(conditions, values, filters.fecha_cambio, [`date(s.created_at, 'localtime')`, `date(s.updated_at, 'localtime')`], 'fecha');

	contains(conditions, values, filters.celebrante,
		`EXISTS (SELECT 1 FROM ministros mi WHERE mi.id = s.ministro_id
			AND (COALESCE(mi.titulo, '') || ' ' || mi.nombre || ' ' || mi.apellido_paterno || ' ' || mi.apellido_materno) LIKE ?)`);

	for (const column of ['padre', 'madre', 'dni'] as const)
		contains(conditions, values, filters[column], aliases.map((alias) => `${alias}.${column} LIKE ?`).join(' OR '));

	if (type === 'matrimonio')
		contains(conditions, values, filters.padrino, 'm.testigo_1 LIKE ? OR m.testigo_2 LIKE ? OR m.testigo_3 LIKE ? OR m.testigo_4 LIKE ?');
	else
		contains(conditions, values, filters.padrino, 'sub.padrino_1 LIKE ? OR sub.padrino_2 LIKE ?');

	if (filters.estado === 'vigente' || filters.estado === 'anulado')
	{
		conditions.push('s.estado = ?');
		values.push(filters.estado);
	}

	if (filters.con_anotaciones === true)
		conditions.push(`TRIM(COALESCE(s.anotaciones, '')) <> ''`);
	else if (filters.con_anotaciones === false)
		conditions.push(`TRIM(COALESCE(s.anotaciones, '')) = ''`);
}

function name_filters(filters: SearchFilters, type: SacramentType, aliases: string[]): { where: string; values: (string | number)[] }
{
	const conditions: string[] = [];
	const values: (string | number)[] = [];

	// Varias parroquias a la vez (búsqueda avanzada), o solo la que se está viendo.
	let parishes: number[] = [];
	if (Array.isArray(filters.parroquias))
		parishes = filters.parroquias.filter((id) => Number.isInteger(id));

	if (parishes.length > 0)
	{
		conditions.push(`s.parroquia_id IN (${parishes.map(() => '?').join(', ')})`);
		values.push(...parishes);
	}
	else if (Number.isInteger(filters.parroquia_id))
	{
		conditions.push('s.parroquia_id = ?');
		values.push(filters.parroquia_id as number);
	}

	for (const column of NAME_COLUMNS)
	{
		const text = filters[column];
		if (!text)
			continue;

		conditions.push(`(${aliases.map((alias) => name_condition(alias, column)).join(' OR ')})`);

		for (let i = 0; i < aliases.length; i++)
			values.push(`%${text}%`, `%${text}%`);
	}

	advanced_filters(filters, type, aliases, conditions, values);

	let where = '';
	if (conditions.length > 0)
		where = 'WHERE ' + conditions.join(' AND ');

	return { where: where, values: values };
}

export function search_sacraments(db: LocalDatabase, type: SacramentType, filters: SearchFilters): SearchPage<SacramentRecord>
{
	let from = `FROM ${detail_table(type)} sub
		JOIN sacramentos s ON s.id = sub.sacramento_id
		JOIN personas pe ON pe.id = sub.persona_id`;
	let aliases = ['pe'];

	if (type === 'matrimonio')
	{
		from = `FROM matrimonios m
			JOIN sacramentos s ON s.id = m.sacramento_id
			JOIN personas c1 ON c1.id = m.conyuge_1_id
			JOIN personas c2 ON c2.id = m.conyuge_2_id`;
		aliases = ['c1', 'c2'];
	}

	const { where, values } = name_filters(filters, type, aliases);

	const count = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...values) as { total: number };
	const page = page_of(filters, count.total);

	let sort_column: NameColumn = 'nombres';
	if (filters.orden && NAME_COLUMNS.includes(filters.orden))
		sort_column = filters.orden;

	const ids = db
		.prepare(
			`SELECT s.id ${from} ${where}
			 ORDER BY ${aliases[0]}.${sort_column} ${sort_direction(filters)}, s.id
			 LIMIT ? OFFSET ?`,
		)
		.pluck()
		.all(...values, PAGE_SIZE, page.offset) as number[];

	return { resultados: ids.map((id) => read_record(db, id)), total_paginas: page.total_pages };
}

function check_notes(record: SacramentRecord, saved_notes: string | null): void
{
	const notes = clean_text(record?.sacramento?.anotaciones);
	if (notes === null || notes === saved_notes)
		return;

	if (notes.length > NOTES_MAX_LENGTH)
		throw new ServiceError(`La anotación marginal puede tener hasta ${NOTES_MAX_LENGTH} caracteres, para que entre en la impresión.`, 400);
}

export function create_record(db: LocalDatabase, session: Session, record: SacramentRecord): number
{
	const type = check_type(record?.sacramento?.tipo);
	const parish_id = parish_for_new(session);
	check_required(record, null);
	check_notes(record, null);

	const is_helper = session.role === 'usuario';

	const create = db.transaction(() =>
	{
		const people = insert_people(db, parish_id, record, !is_helper);

		const client_id = crypto.randomUUID();
		add_to_queue(db, type, client_id, null);
		const sacrament_id = insert_sacrament(db, client_id, type, parish_id, record.sacramento);
		insert_detail(db, sacrament_id, record, people.map((person) => person.id));

		add_history(db, sacrament_id, session.user_id, 'registrada');

		const corrections = corrections_of(people);
		if (corrections.length === 0)
			return sacrament_id;

		if (is_helper)
		{
			const requests = corrections.map((correction) => ({ ...correction, tipo: 'nota_marginal' as const }));
			insert_requests(db, sacrament_id, session.user_id, requests);
			add_history(db, sacrament_id, session.user_id, 'cambio_pedido', requests);
			return sacrament_id;
		}

		for (const person of people)
			save_corrections(db, session, person.id, sacrament_id, person.corrections);

		add_history(db, sacrament_id, session.user_id, 'correccion', corrections);
		return sacrament_id;
	});

	return create();
}

// Con el tipo indicado aparte (bautismo o confirmación tienen la misma forma).
export function create_person_sacrament(db: LocalDatabase, type: PersonSacramentType, session: Session, record: Baptism): number
{
	return create_record(db, session, { ...record, sacramento: { ...record.sacramento, tipo: type } });
}

export function create_marriage(db: LocalDatabase, session: Session, record: Marriage): number
{
	return create_record(db, session, record);
}

// ---------------------------------------------------------------------------
// Editar
// ---------------------------------------------------------------------------

function update_as_admin(db: LocalDatabase, session: Session, record: SacramentRecord): void
{
	const sacrament_id = positive_id(record.sacramento?.id);
	check_can_manage(db, session, sacrament_id, record.sacramento.tipo);
	const saved = read_record(db, sacrament_id);

	const update = db.transaction(() =>
	{
		queue_sacrament(db, sacrament_id);
		const result = save_edit(db, session, saved, record);

		if (result.fields.length > 0)
			add_history(db, sacrament_id, session.user_id, 'editada', result.fields);

		if (result.corrections.length > 0)
			add_history(db, sacrament_id, session.user_id, 'correccion', result.corrections);

		resolve_on_edit(db, session, sacrament_id, record);
	});

	update();
}

export function update_record(db: LocalDatabase, session: Session, record: SacramentRecord): void
{
	check_type(record?.sacramento?.tipo);
	const sacrament_id = positive_id(record.sacramento?.id);
	const saved_notes = db.prepare('SELECT anotaciones FROM sacramentos WHERE id = ?').pluck().get(sacrament_id) as string | null | undefined;
	check_notes(record, saved_notes ?? null);

	if (session.role === 'usuario')
		request_changes(db, session, record);
	else
		update_as_admin(db, session, record);

}

export function update_person_sacrament(db: LocalDatabase, type: PersonSacramentType, session: Session, record: Baptism): void
{
	update_record(db, session, { ...record, sacramento: { ...record.sacramento, tipo: type } });
}

export function update_marriage(db: LocalDatabase, session: Session, record: Marriage): void
{
	update_record(db, session, record);
}


type SacramentState = { tipo: SacramentType; estado: 'vigente' | 'anulado' };

export function annul_sacrament(db: LocalDatabase, session: Session, sacrament_id: number, reason: unknown): void
{
	const row = db.prepare('SELECT tipo, estado FROM sacramentos WHERE id = ?').get(sacrament_id) as SacramentState | undefined;
	if (!row)
		throw new ServiceError(NOT_FOUND, 404);

	check_can_manage(db, session, sacrament_id, row.tipo);

	if (row.estado === 'anulado')
		throw new ServiceError('La partida ya está anulada.', 400);

	const clean_reason = clean_text(reason);
	if (!clean_reason)
		throw new ServiceError('El motivo de anulación es requerido.', 400);

	const annul = db.transaction(() =>
	{
		queue_sacrament(db, sacrament_id);
		db.prepare(
			`UPDATE sacramentos
			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
			 WHERE id = ?`,
		).run(session.user_id, new Date().toISOString(), clean_reason, sacrament_id);
		add_history(db, sacrament_id, session.user_id, 'anulada', [], clean_reason);
	});
	annul();
}

export function restore_sacrament(db: LocalDatabase, session: Session, sacrament_id: number, reason: unknown): void
{
	const row = db.prepare('SELECT tipo, estado FROM sacramentos WHERE id = ?').get(sacrament_id) as SacramentState | undefined;
	if (!row)
		throw new ServiceError(NOT_FOUND, 404);

	check_can_manage(db, session, sacrament_id, row.tipo);

	if (row.estado !== 'anulado')
		throw new ServiceError('La partida no está anulada.', 400);

	const clean_reason = clean_text(reason);
	if (!clean_reason)
		throw new ServiceError('El motivo para rehabilitar la partida es requerido.', 400);

	const restore = db.transaction(() =>
	{
		queue_sacrament(db, sacrament_id);
		db.prepare(
			`UPDATE sacramentos
			 SET estado = 'vigente', anulado_por_usuario_id = NULL, anulado_en = NULL, motivo_anulacion = NULL
			 WHERE id = ?`,
		).run(sacrament_id);
		add_history(db, sacrament_id, session.user_id, 'rehabilitada', [], clean_reason);
	});
	restore();
}

export function sacrament_history(db: LocalDatabase, session: Session, sacrament_id: number): HistoryEntry[]
{
	if (session.role === 'usuario')
		throw new ServiceError('Solo un administrador puede ver el historial de una partida.', 403);

	const saved = read_record(db, sacrament_id);
	check_parish_read(session, saved.sacramento.parroquia_id as number, 'Solo puede ver el historial de las partidas de su parroquia.');

	return read_history(db, sacrament_id);
}

export const sacrament_routes: Routes =
{
	'sacraments.search': (payload: SearchFilters & { tipo: unknown }, { db }) =>
	{
		return search_sacraments(db, check_type(payload.tipo), payload);
	},

	'sacraments.get': (payload: { id: unknown }, { db }) =>
	{
		return read_record(db, positive_id(payload.id));
	},

	'sacraments.create': (record: SacramentRecord, { db, session }) =>
	{
		return { id: create_record(db, session, record) };
	},

	'sacraments.update': (record: SacramentRecord, { db, session }) =>
	{
		update_record(db, session, record);
		return { success: true };
	},

	'sacraments.annul': (payload: { id: unknown; motivo_anulacion: unknown }, { db, session }) =>
	{
		annul_sacrament(db, session, positive_id(payload.id), payload.motivo_anulacion);
		return { success: true };
	},

	'sacraments.restore': (payload: { id: unknown; motivo: unknown }, { db, session }) =>
	{
		restore_sacrament(db, session, positive_id(payload.id), payload.motivo);
		return { success: true };
	},

	'sacraments.history': (payload: { id: unknown }, { db, session }) =>
	{
		return { historial: sacrament_history(db, session, positive_id(payload.id)) };
	},
};
