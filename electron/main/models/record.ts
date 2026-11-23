import type { Baptism, Marriage, Sacrament, SacramentRecord } from '../../../shared/models';
import { changed_fields, person_at, person_parts, type FieldChange, type RecordPart } from '../../../shared/record_fields';
import { date_problem } from '../../../shared/partial_date';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { add_to_queue } from '../sync/queue';
import { ServiceError } from '../utils/errors';
import { clean_text } from '../utils/helpers';
import { read_requests } from './change_request';
import { apply_corrections, insert_person, read_person, save_corrections, update_person, type Correction } from './person';
import { detail_table, read_sacrament, update_sacrament } from './sacrament';
import type { Session } from './session';

export const NOT_FOUND = 'Partida no encontrada.';


function read_full_sacrament(db: LocalDatabase, sacrament_id: number, type: SacramentType): Sacrament
{
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== type)
		throw new ServiceError(NOT_FOUND, 404);

	return { ...sacrament, solicitudes: read_requests(db, sacrament_id) };
}

export function read_person_sacrament(db: LocalDatabase, type: 'bautismo' | 'confirmacion', sacrament_id: number): Baptism
{
	const sacrament = read_full_sacrament(db, sacrament_id, type);
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
	const sacrament = read_full_sacrament(db, sacrament_id, 'matrimonio');
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

const WHO: Record<RecordPart, string> = { persona: '', conyuge_1: ' del esposo', conyuge_2: ' de la esposa', sacramento: '', detalle: '' };

function check_date(value: string | null | undefined, label: string): void
{
	const problem = date_problem(value);
	if (problem)
		throw new ServiceError(`La ${label} está incompleta: ${problem}.`, 400);
}

export function check_dates(record: SacramentRecord): void
{
	check_date(record.sacramento?.fecha_evento, 'fecha del sacramento');

	for (const part of person_parts(record.sacramento.tipo))
		check_date(person_at(record, part)?.fecha_nacimiento, `fecha de nacimiento${WHO[part]}`);

	if (record.sacramento.tipo === 'matrimonio')
	{
		const marriage = record as Marriage;
		check_date(marriage.conyuge_1_bautismo_fecha, 'fecha de bautismo del esposo');
		check_date(marriage.conyuge_2_bautismo_fecha, 'fecha de bautismo de la esposa');
	}
}


export function queue_sacrament(db: LocalDatabase, sacrament_id: number): void
{
	const current = db.prepare('SELECT tipo, client_id, version FROM sacramentos WHERE id = ?').get(sacrament_id) as { tipo: SacramentType; client_id: string; version: number };
	add_to_queue(db, current.tipo, current.client_id, current.version);
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

function as_corrections(part: RecordPart, corrections: Correction[]): FieldChange[]
{
	return corrections.map((correction) => ({
		parte: part,
		campo: correction.campo_cambio,
		valor_anterior: correction.valor_anterior ?? null,
		valor_nuevo: correction.valor_nuevo,
	}));
}

export interface NewPerson
{
	id: number;
	part: RecordPart;
	corrections: Correction[];
}

export function insert_people(db: LocalDatabase, parish_id: number, record: SacramentRecord, apply: boolean): NewPerson[]
{
	return person_parts(record.sacramento.tipo).map((part) =>
	{
		const person = person_at(record, part);
		const corrected = apply_corrections(person);
		const id = insert_person(db, parish_id, apply ? corrected.person : person);
		return { id: id, part: part, corrections: corrected.corrections };
	});
}

export function corrections_of(people: NewPerson[]): FieldChange[]
{
	return people.flatMap((person) => as_corrections(person.part, person.corrections));
}

export function insert_detail(db: LocalDatabase, sacrament_id: number, record: SacramentRecord, people_ids: number[]): void
{
	const type = record.sacramento.tipo;

	if (type === 'matrimonio')
	{
		db.prepare(
			`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(sacrament_id, people_ids[0], people_ids[1], ...marriage_values(record as Marriage));
		return;
	}

	const baptism = record as Baptism;
	db.prepare(`INSERT INTO ${detail_table(type)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`)
		.run(sacrament_id, people_ids[0], clean_text(baptism.padrino_1), clean_text(baptism.padrino_2));
}

function update_detail(db: LocalDatabase, sacrament_id: number, record: SacramentRecord): void
{
	const type = record.sacramento.tipo;

	if (type === 'matrimonio')
	{
		db.prepare(
			`UPDATE matrimonios SET
				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
			 WHERE sacramento_id = ?`,
		).run(...marriage_values(record as Marriage), sacrament_id);
		return;
	}

	const baptism = record as Baptism;
	db.prepare(`UPDATE ${detail_table(type)} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`)
		.run(clean_text(baptism.padrino_1), clean_text(baptism.padrino_2), sacrament_id);
}

export interface EditResult
{
	fields: FieldChange[];
	corrections: FieldChange[];
}

export function save_edit(db: LocalDatabase, session: Session, saved: SacramentRecord, record: SacramentRecord): EditResult
{
	check_dates(record);

	const sacrament_id = saved.sacramento.id as number;
	const corrections: FieldChange[] = [];

	for (const part of person_parts(saved.sacramento.tipo))
	{
		const saved_person = person_at(saved, part);
		const person_id = saved_person.id as number;
		const incoming = person_at(record, part);
		const new_changes = (incoming.cambios ?? []).filter((change) => change.id === undefined);
		const corrected = apply_corrections({ ...incoming, cambios: [...saved_person.cambios, ...new_changes] });

		update_person(db, person_id, corrected.person);
		save_corrections(db, session, person_id, sacrament_id, corrected.corrections);
		corrections.push(...as_corrections(part, corrected.corrections));
	}

	update_sacrament(db, sacrament_id, record.sacramento);
	update_detail(db, sacrament_id, record);

	return { fields: changed_fields(saved, record), corrections: corrections };
}

export function with_correction(record: SacramentRecord, part: RecordPart, field: string, value: string | null): SacramentRecord
{
	const person = person_at(record, part);
	const change = { campo_cambio: field as Correction['campo_cambio'], valor_nuevo: value };
	return { ...record, [part]: { ...person, cambios: [...(person.cambios ?? []), change] } } as SacramentRecord;
}
