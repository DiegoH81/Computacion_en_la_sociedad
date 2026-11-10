// What online PCs get from online DB
//
//   read_page        registers that changed after CURSOR
//   read_record      one register to solve a conlict
//   read_reference   parrishes, ministers and users

import type { ChangeRequestData, HistoryData, HistoryFieldData, PersonCorrection, PersonData, RecordData } from '../../../shared/sync';
import { detail_columns } from '../../../shared/record_fields';
import type { JsonObject } from '../utils/helpers';


const SACRAMENT_COLUMNS = `s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
	s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
	s.version, s.created_at, s.updated_at`;

const MINISTER_SELECT = `SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at
	FROM ministros`;

const USER_SELECT = `SELECT id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, version, updated_at FROM usuarios`;

type Row = JsonObject;


function by_sacrament_id(rows: Row[]): Map<number, Row>
{
	const map = new Map<number, Row>();
	for (const row of rows)
		map.set(row.sacramento_id, row);

	return map;
}

function without(row: Row, columns: string[]): Row
{
	const copy = { ...row };
	for (const column of columns)
		delete copy[column];

	return copy;
}

async function read_full_records(db: D1Database, sacraments_sql: string, ids_sql: string, values: unknown[]): Promise<{ seq: number; record: RecordData }[]>
{
	const [sacraments, baptisms, confirmations, marriages, people, corrections, requests, history, history_fields] = await db.batch<Row>([
		db.prepare(sacraments_sql).bind(...values),

		db.prepare(`SELECT * FROM bautismos WHERE sacramento_id IN (${ids_sql})`).bind(...values),
		db.prepare(`SELECT * FROM confirmaciones WHERE sacramento_id IN (${ids_sql})`).bind(...values),
		db.prepare(`SELECT * FROM matrimonios WHERE sacramento_id IN (${ids_sql})`).bind(...values),

		db
			.prepare(
				`SELECT id, client_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre
				 FROM personas
				 WHERE id IN (
					SELECT persona_id FROM bautismos WHERE sacramento_id IN (${ids_sql})
					UNION ALL SELECT persona_id FROM confirmaciones WHERE sacramento_id IN (${ids_sql})
					UNION ALL SELECT conyuge_1_id FROM matrimonios WHERE sacramento_id IN (${ids_sql})
					UNION ALL SELECT conyuge_2_id FROM matrimonios WHERE sacramento_id IN (${ids_sql})
				 )`,
			)
			.bind(...values, ...values, ...values, ...values),

		db
			.prepare(
				`SELECT c.client_id, c.sacramento_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio,
				        c.valor_anterior, c.valor_nuevo, c.fecha_cambio, c.estado, c.revisado_por_usuario_id, c.revisado_en
				 FROM cambios_persona c
				 JOIN personas p ON p.id = c.persona_id
				 WHERE c.sacramento_id IN (${ids_sql})
				 ORDER BY c.id`,
			)
			.bind(...values),

		db
			.prepare(
				`SELECT client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
				        revisado_por_usuario_id, revisado_en, creado_en
				 FROM solicitudes_cambio WHERE sacramento_id IN (${ids_sql}) ORDER BY id`,
			)
			.bind(...values),

		db
			.prepare(`SELECT id, client_id, sacramento_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id IN (${ids_sql}) ORDER BY id`)
			.bind(...values),

		db
			.prepare(
				`SELECT historial_id, parte, campo, valor_anterior, valor_nuevo FROM historial_campos
				 WHERE historial_id IN (SELECT id FROM historial_partidas WHERE sacramento_id IN (${ids_sql})) ORDER BY id`,
			)
			.bind(...values),
	]);

	const baptism_rows = by_sacrament_id(baptisms.results);
	const confirmation_rows = by_sacrament_id(confirmations.results);
	const marriage_rows = by_sacrament_id(marriages.results);

	const people_by_id = new Map<number, PersonData>();
	for (const row of people.results)
	{
		const { id, ...person } = row;
		people_by_id.set(id, person as PersonData);
	}

	// Los datos de cada evento del historial, por su id.
	const fields_by_history = new Map<number, HistoryFieldData[]>();
	for (const { historial_id, ...field } of history_fields.results)
		fields_by_history.set(historial_id, [...(fields_by_history.get(historial_id) ?? []), field as HistoryFieldData]);

	const output: { seq: number; record: RecordData }[] = [];

	for (const row of sacraments.results)
	{
		const { id, seq, ...sacrament } = row;

		
		let detail_row: Row | undefined;
		let people_ids: number[] = [];

		if (row.tipo === 'bautismo')
		{
			detail_row = baptism_rows.get(id);
			if (detail_row)
				people_ids = [detail_row.persona_id];
		}
		else if (row.tipo === 'confirmacion')
		{
			detail_row = confirmation_rows.get(id);
			if (detail_row)
				people_ids = [detail_row.persona_id];
		}
		else
		{
			detail_row = marriage_rows.get(id);
			if (detail_row)
				people_ids = [detail_row.conyuge_1_id, detail_row.conyuge_2_id];
		}

		const detail: Record<string, string | null> = {};
		for (const column of detail_columns(row.tipo))
			detail[column] = detail_row?.[column] ?? null;

		const record_people: PersonData[] = [];
		for (const person_id of people_ids)
			record_people.push({ ...people_by_id.get(person_id) } as PersonData);

		const record_corrections: PersonCorrection[] = [];
		for (const correction of corrections.results)
		{
			if (correction.sacramento_id !== id)
				continue;

			const clean = { ...correction };
			delete clean.sacramento_id;
			record_corrections.push(clean as PersonCorrection);
		}

		const record_requests = requests.results
			.filter((request) => request.sacramento_id === id)
			.map((request) => without(request, ['sacramento_id']) as ChangeRequestData);

		const record_history = history.results
			.filter((entry) => entry.sacramento_id === id)
			.map((entry) => ({ ...without(entry, ['id', 'sacramento_id']), campos: fields_by_history.get(entry.id) ?? [] }) as HistoryData);

		const record = {
			...sacrament,
			personas: record_people,
			detalle: detail,
			cambios: record_corrections,
			solicitudes: record_requests,
			historial: record_history,
		} as RecordData;
		output.push({ seq: seq, record: record });
	}

	return output;
}

export async function read_page(db: D1Database, cursor: number, limit: number)
{
	const sacraments_sql = `SELECT f.seq, ${SACRAMENT_COLUMNS}
		FROM sync_feed f
		JOIN sacramentos s ON s.id = f.sacramento_id
		LEFT JOIN ministros m ON m.id = s.ministro_id
		WHERE f.seq > ?
		ORDER BY f.seq
		LIMIT ?`;
	const ids_sql = 'SELECT sacramento_id FROM sync_feed WHERE seq > ? ORDER BY seq LIMIT ?';

	const rows = await read_full_records(db, sacraments_sql, ids_sql, [cursor, limit]);

	
	let next_cursor = cursor;
	if (rows.length > 0)
		next_cursor = rows[rows.length - 1].seq;

	return {
		partidas: rows.map((row) => row.record),
		cursor: next_cursor,
		hayMas: rows.length === limit,
	};
}

export async function read_record(db: D1Database, entity: string, client_id: string)
{
	if (entity === 'ministro')
		return db.prepare(`${MINISTER_SELECT} WHERE client_id = ?`).bind(client_id).first();

	if (entity === 'usuario')
		return db.prepare(`${USER_SELECT} WHERE client_id = ?`).bind(client_id).first();

	const sacraments_sql = `SELECT ${SACRAMENT_COLUMNS}
		FROM sacramentos s
		LEFT JOIN ministros m ON m.id = s.ministro_id
		WHERE s.client_id = ?`;
	const ids_sql = 'SELECT id FROM sacramentos WHERE client_id = ?';

	const rows = await read_full_records(db, sacraments_sql, ids_sql, [client_id]);
	if (rows.length === 0)
		return null;

	return rows[0].record;
}

export async function read_reference(db: D1Database)
{
	const [parishes, ministers, users, memberships] = await db.batch([
		db.prepare('SELECT id, nombre, ubicacion, activa FROM parroquias'),
		db.prepare(MINISTER_SELECT),
		db.prepare(`${USER_SELECT.replace(' FROM usuarios', '')}, password_hash FROM usuarios`),
		db.prepare('SELECT usuario_id, parroquia_id, rol, principal FROM usuario_parroquias ORDER BY usuario_id, parroquia_id'),
	]);

	return {
		parroquias: parishes.results,
		ministros: ministers.results,
		usuarios: users.results,
		usuario_parroquias: memberships.results,
	};
}
