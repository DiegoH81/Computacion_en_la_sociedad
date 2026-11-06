import type { Baptism, Marriage, NameColumn, Person, Sacrament, SacramentRecord, SearchFilters, SearchPage } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { parish_for_new } from '../models/parish';
import { apply_corrections, insert_person, name_condition, read_person, save_corrections, update_person } from '../models/person';
import { check_can_manage, detail_table, insert_sacrament, is_sacrament_type, read_sacrament, update_sacrament } from '../models/sacrament';
import type { Session } from '../models/session';
import { add_to_queue } from '../sync/queue';
import { PAGE_SIZE } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { clean_text, page_of, positive_id, sort_direction } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

export type PersonSacramentType = 'bautismo' | 'confirmacion';

const NAME_COLUMNS: NameColumn[] = ['nombres', 'apellido_paterno', 'apellido_materno'];

const NOT_FOUND = 'Partida no encontrada.';

function check_type(value: unknown): SacramentType
{
	if (!is_sacrament_type(value))
		throw new ServiceError('Tipo de sacramento inválido.', 400);

	return value;
}


export function read_person_sacrament(db: LocalDatabase, type: PersonSacramentType, sacrament_id: number): Baptism
{
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== type)
		throw new ServiceError(NOT_FOUND, 404);

	const detail = db.prepare(`SELECT * FROM ${detail_table(type)} WHERE sacramento_id = ?`).get(sacrament_id) as { persona_id: number; padrino_1: string | null; padrino_2: string | null };

	return {
		sacramento: sacrament,
		persona: read_person(db, detail.persona_id),
		padrino_1: detail.padrino_1,
		padrino_2: detail.padrino_2,
	};
}

export function read_marriage(db: LocalDatabase, sacrament_id: number): Marriage
{
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== 'matrimonio')
		throw new ServiceError(NOT_FOUND, 404);

	const detail = db.prepare('SELECT * FROM matrimonios WHERE sacramento_id = ?').get(sacrament_id) as Omit<Marriage, 'sacramento' | 'conyuge_1' | 'conyuge_2'> & { conyuge_1_id: number; conyuge_2_id: number };

	return {
		sacramento: sacrament,
		conyuge_1: read_person(db, detail.conyuge_1_id),
		conyuge_2: read_person(db, detail.conyuge_2_id),
		lugar: detail.lugar,
		testigo_1: detail.testigo_1,
		testigo_2: detail.testigo_2,
		testigo_3: detail.testigo_3,
		testigo_4: detail.testigo_4,
		conyuge_1_bautismo_parroquia: detail.conyuge_1_bautismo_parroquia,
		conyuge_1_bautismo_fecha: detail.conyuge_1_bautismo_fecha,
		conyuge_2_bautismo_parroquia: detail.conyuge_2_bautismo_parroquia,
		conyuge_2_bautismo_fecha: detail.conyuge_2_bautismo_fecha,
	};
}

export function read_record(db: LocalDatabase, sacrament_id: number): SacramentRecord
{
	const row = db.prepare('SELECT tipo FROM sacramentos WHERE id = ?').get(sacrament_id) as { tipo: SacramentType } | undefined;
	if (!row)
		throw new ServiceError(NOT_FOUND, 404);

	if (row.tipo === 'matrimonio')
		return read_marriage(db, sacrament_id);

	return read_person_sacrament(db, row.tipo, sacrament_id);
}


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


// QUEUE
function queue_sacrament(db: LocalDatabase, sacrament_id: number): void
{
	const current = db.prepare('SELECT tipo, client_id, version FROM sacramentos WHERE id = ?').get(sacrament_id) as { tipo: SacramentType; client_id: string; version: number };
	add_to_queue(db, current.tipo, current.client_id, current.version);
}

function create_sacrament(db: LocalDatabase, type: SacramentType, parish_id: number, sacrament: Sacrament): number
{
	const client_id = crypto.randomUUID();
	add_to_queue(db, type, client_id, null);

	return insert_sacrament(db, client_id, type, parish_id, sacrament);
}

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
	});
	annul();
}


function check_names(person: Person | undefined): void
{
    if (!clean_text(person?.nombres) || !clean_text(person?.apellido_paterno) || !clean_text(person?.apellido_materno))
		throw new ServiceError('Nombre y apellidos son requeridos.', 400);
}

export function create_person_sacrament(db: LocalDatabase, type: PersonSacramentType, session: Session, record: Baptism): number
{
	const parish_id = parish_for_new(session, record.sacramento?.parroquia_id);
	check_names(record.persona);

	const corrected = apply_corrections(record.persona);

	const create = db.transaction(() =>
	{
		const person_id = insert_person(db, parish_id, corrected.person);
		const sacrament_id = create_sacrament(db, type, parish_id, record.sacramento);

		db.prepare(`INSERT INTO ${detail_table(type)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`)
			.run(sacrament_id, person_id, clean_text(record.padrino_1), clean_text(record.padrino_2));

		save_corrections(db, session, person_id, sacrament_id, corrected.corrections);
		return sacrament_id;
	});

	return create();
}

export function update_person_sacrament(db: LocalDatabase, type: PersonSacramentType, session: Session, record: Baptism): void
{
	const id = positive_id(record.sacramento?.id);
	check_can_manage(db, session, id, type);
	check_names(record.persona);

	const corrected = apply_corrections(record.persona);
	const table = detail_table(type);

	const update = db.transaction(() =>
	{
		queue_sacrament(db, id);

		const row = db.prepare(`SELECT persona_id FROM ${table} WHERE sacramento_id = ?`).get(id) as { persona_id: number };

		update_person(db, row.persona_id, corrected.person);
		save_corrections(db, session, row.persona_id, id, corrected.corrections);
		update_sacrament(db, id, record.sacramento);

		db.prepare(`UPDATE ${table} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`)
			.run(clean_text(record.padrino_1), clean_text(record.padrino_2), id);
	});

	update();
}

function check_spouses(record: Marriage): void
{
	if (!clean_text(record.conyuge_1?.nombres) || !clean_text(record.conyuge_2?.nombres))
		throw new ServiceError('Los nombres de ambos cónyuges son requeridos.', 400);
}

function marriage_values(record: Marriage): (string | null)[]
{
	return [
		clean_text(record.lugar),
		clean_text(record.testigo_1),
		clean_text(record.testigo_2),
		clean_text(record.testigo_3),
		clean_text(record.testigo_4),
		clean_text(record.conyuge_1_bautismo_parroquia),
		clean_text(record.conyuge_1_bautismo_fecha),
		clean_text(record.conyuge_2_bautismo_parroquia),
		clean_text(record.conyuge_2_bautismo_fecha),
	];
}

export function create_marriage(db: LocalDatabase, session: Session, record: Marriage): number
{
	const parish_id = parish_for_new(session, record.sacramento?.parroquia_id);
	check_spouses(record);

	const husband = apply_corrections(record.conyuge_1);
	const wife = apply_corrections(record.conyuge_2);

	const create = db.transaction(() =>
	{
		const husband_id = insert_person(db, parish_id, husband.person);
		const wife_id = insert_person(db, parish_id, wife.person);
		const sacrament_id = create_sacrament(db, 'matrimonio', parish_id, record.sacramento);

		db.prepare(
			`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(sacrament_id, husband_id, wife_id, ...marriage_values(record));

		save_corrections(db, session, husband_id, sacrament_id, husband.corrections);
		save_corrections(db, session, wife_id, sacrament_id, wife.corrections);

		return sacrament_id;
	});

	return create();
}

export function update_marriage(db: LocalDatabase, session: Session, record: Marriage): void
{
	const id = positive_id(record.sacramento?.id);
	check_can_manage(db, session, id, 'matrimonio');
	check_spouses(record);

	const husband = apply_corrections(record.conyuge_1);
	const wife = apply_corrections(record.conyuge_2);

	const update = db.transaction(() =>
	{
		queue_sacrament(db, id);

		const spouses = db.prepare('SELECT conyuge_1_id, conyuge_2_id FROM matrimonios WHERE sacramento_id = ?').get(id) as { conyuge_1_id: number; conyuge_2_id: number };

		update_person(db, spouses.conyuge_1_id, husband.person);
		update_person(db, spouses.conyuge_2_id, wife.person);
		save_corrections(db, session, spouses.conyuge_1_id, id, husband.corrections);
		save_corrections(db, session, spouses.conyuge_2_id, id, wife.corrections);
		update_sacrament(db, id, record.sacramento);

		db.prepare(
			`UPDATE matrimonios SET
				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
			 WHERE sacramento_id = ?`,
		).run(...marriage_values(record), id);
	});

	update();
}

export function create_record(db: LocalDatabase, session: Session, record: SacramentRecord): number
{
	const type = check_type(record?.sacramento?.tipo);
	if (type === 'matrimonio')
		return create_marriage(db, session, record as Marriage);

	return create_person_sacrament(db, type, session, record as Baptism);
}

export function update_record(db: LocalDatabase, session: Session, record: SacramentRecord): void
{
	const type = check_type(record?.sacramento?.tipo);
	if (type === 'matrimonio')
		update_marriage(db, session, record as Marriage);
	else
		update_person_sacrament(db, type, session, record as Baptism);
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
};
