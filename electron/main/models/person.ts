import type { NameColumn, Person, PersonChange } from '../../../shared/models';
import { corrected_value, PERSON_COLUMNS, type PersonColumn } from '../../../shared/record_fields';
import type { LocalDatabase } from '../db/database';
import { ServiceError } from '../utils/errors';
import { clean_text } from '../utils/helpers';
import type { Session } from './session';

export type Correction = Pick<PersonChange, 'campo_cambio' | 'valor_anterior' | 'valor_nuevo'>;

const CORRECTABLE_FIELDS: { column: NameColumn; label: string }[] =
[
	{ column: 'nombres', label: 'Nombres' },
	{ column: 'apellido_paterno', label: 'Apellido paterno' },
	{ column: 'apellido_materno', label: 'Apellido materno' },
];

// Clean person Data
function clean_person(person: Person): Pick<Person, PersonColumn>
{
	return {
		dni: clean_text(person.dni),
		nombres: clean_text(person.nombres) ?? '',
		apellido_paterno: clean_text(person.apellido_paterno) ?? '',
		apellido_materno: clean_text(person.apellido_materno) ?? '',
		fecha_nacimiento: clean_text(person.fecha_nacimiento),
		fecha_aproximada: clean_text(person.fecha_aproximada),
		lugar_nacimiento: clean_text(person.lugar_nacimiento),
		padre: clean_text(person.padre),
		madre: clean_text(person.madre),
	};
}

export function read_person(db: LocalDatabase, person_id: number): Person
{
	const person = db.prepare('SELECT * FROM personas WHERE id = ?').get(person_id) as Person;
	const changes = db.prepare('SELECT * FROM cambios_persona WHERE persona_id = ? ORDER BY id').all(person_id) as PersonChange[];

	return { ...person, cambios: changes };
}

export function insert_person(db: LocalDatabase, parish_id: number, person: Person): number
{
	const row = clean_person(person);
	const result = db
		.prepare(
			`INSERT INTO personas
				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			crypto.randomUUID(),
			parish_id,
			row.dni,
			row.nombres,
			row.apellido_paterno,
			row.apellido_materno,
			row.fecha_nacimiento,
			row.fecha_aproximada,
			row.lugar_nacimiento,
			row.padre,
			row.madre,
		);

	return Number(result.lastInsertRowid);
}


export function update_person(db: LocalDatabase, person_id: number, person: Person): void
{
	const new_row = clean_person(person);
	const old_row = db.prepare(`SELECT ${PERSON_COLUMNS.join(', ')} FROM personas WHERE id = ?`).get(person_id) as Pick<Person, PersonColumn>;

	const changed_columns = PERSON_COLUMNS.filter((column) => old_row[column] !== new_row[column]);
	if (changed_columns.length === 0)
		return;

	const assignments = changed_columns.map((column) => `${column} = ?`).join(', ');
	const values = changed_columns.map((column) => new_row[column]);

	db.prepare(`UPDATE personas SET ${assignments} WHERE id = ?`).run(...values, person_id);
}


export function apply_corrections(person: Person): { person: Person; corrections: Correction[] }
{
	const changes = Array.isArray(person.cambios) ? person.cambios.filter((change) => change.id === undefined) : [];
	const result: Correction[] = [];

	for (const change of changes)
	{
		const field = CORRECTABLE_FIELDS.find((item) => item.column === change.campo_cambio);
		if (!field)
			throw new ServiceError('La nota marginal indica un campo que no se puede corregir.', 400);

		if (result.some((item) => item.campo_cambio === field.column))
			throw new ServiceError(`La nota marginal repite el campo ${field.label}.`, 400);

		const old_value = clean_text(corrected_value(person, field.column));
		const new_value = clean_text(change.valor_nuevo);

		if (!old_value)
			throw new ServiceError(`Complete ${field.label} antes de corregirlo en la nota marginal.`, 400);

		if (!new_value)
			throw new ServiceError(`Indique el valor nuevo de ${field.label} en la nota marginal.`, 400);

		if (new_value === old_value)
			throw new ServiceError(`El valor nuevo de ${field.label} es igual al anterior.`, 400);

		result.push({ campo_cambio: field.column, valor_anterior: old_value, valor_nuevo: new_value });
	}

	return { person: person, corrections: result };
}

export function save_corrections(db: LocalDatabase, session: Session, person_id: number, sacrament_id: number, corrections: Correction[]): void
{
	const insert = db.prepare(
		`INSERT INTO cambios_persona
			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?)`,
	);
	const now = new Date().toISOString();

	for (const correction of corrections)
	{
		insert.run(
			crypto.randomUUID(),
			person_id,
			sacrament_id,
			session.user_id,
			correction.campo_cambio,
			correction.valor_anterior,
			correction.valor_nuevo,
			session.user_id,
			now,
		);
	}
}

export function name_condition(table_alias: string, column: NameColumn): string
{
	return `(${table_alias}.${column} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${table_alias}.id AND cp.campo_cambio = '${column}' AND cp.estado = 'aprobado' AND cp.valor_nuevo LIKE ?
	))`;
}