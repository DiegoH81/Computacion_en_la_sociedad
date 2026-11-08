// Las partidas: buscar, ver, registrar, editar, anular y ver su historial.
//
//   sacraments.search / sacraments.get   consultar (cualquier parroquia)
//   sacraments.create                    registrar, en la parroquia de la sesión
//   sacraments.update                    un administrador edita; un usuario pide el cambio (controllers/requests.ts)
//   sacraments.annul                     anular, con motivo (solo un administrador)
//   sacraments.history                   el historial de la partida (solo administradores)
//
// Cada cambio queda en el historial de la partida (models/history.ts) y en la cola para subirse.

import type { Baptism, HistoryEntry, Marriage, NameColumn, SacramentRecord, SearchFilters, SearchPage } from '../../../shared/models';
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

function name_filters(filters: SearchFilters, aliases: string[]): { where: string; values: (string | number)[] }
{
	const conditions: string[] = [];
	const values: (string | number)[] = [];

	if (Number.isInteger(filters.parroquia_id))
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

	const { where, values } = name_filters(filters, aliases);

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

// ---------------------------------------------------------------------------
// Registrar
// ---------------------------------------------------------------------------

// Un administrador registra la partida con sus correcciones por nota marginal ya aplicadas. Un usuario
// la registra tal como la escribió, y las correcciones quedan pedidas hasta que un administrador las apruebe.
export function create_record(db: LocalDatabase, session: Session, record: SacramentRecord): number
{
	const type = check_type(record?.sacramento?.tipo);
	const parish_id = parish_for_new(session);
	check_required(record, null);

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

// ---------------------------------------------------------------------------
// Anular e historial
// ---------------------------------------------------------------------------

export function annul_sacrament(db: LocalDatabase, session: Session, sacrament_id: number, reason: unknown): void
{
	const row = db.prepare('SELECT tipo FROM sacramentos WHERE id = ?').get(sacrament_id) as { tipo: SacramentType } | undefined;
	if (!row)
		throw new ServiceError(NOT_FOUND, 404);

	check_can_manage(db, session, sacrament_id, row.tipo);

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

// Solo los administradores ven el historial: el general, de cualquier parroquia; los de parroquia, de la suya.
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

	'sacraments.history': (payload: { id: unknown }, { db, session }) =>
	{
		return { historial: sacrament_history(db, session, positive_id(payload.id)) };
	},
};
