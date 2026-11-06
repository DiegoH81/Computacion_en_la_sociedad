// Convierte partidas y ministros entre la base local y el JSON que viaja al servidor (ver online.ts).
//
//   read_local_record / read_local_minister             base local  ->  JSON para subir
//   save_downloaded_record / save_downloaded_minister   JSON descargado  ->  base local

import type { Minister, Sacrament } from '../../../shared/models';
import type { MinisterData, PersonCorrection, PersonData, RecordData, SacramentType, SyncEntity } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { PERSON_COLUMNS } from '../models/person';
import { detail_table, person_columns } from '../models/sacrament';
import { is_in_queue, remove_from_queue } from './queue';

// La partida descargada nombra algo que esta base todavía no tiene (por ejemplo, un ministro nuevo).
// sync.ts lo arregla bajando de nuevo la referencia y reintentando.
export class MissingReferenceError extends Error {}

// Las columnas propias de cada tipo (el "detalle" del JSON).
const GODPARENT_COLUMNS = ['padrino_1', 'padrino_2'];
const MARRIAGE_COLUMNS =
[
	'lugar',
	'testigo_1',
	'testigo_2',
	'testigo_3',
	'testigo_4',
	'conyuge_1_bautismo_parroquia',
	'conyuge_1_bautismo_fecha',
	'conyuge_2_bautismo_parroquia',
	'conyuge_2_bautismo_fecha',
];

function detail_columns(type: SacramentType): string[]
{
	if (type === 'matrimonio')
		return MARRIAGE_COLUMNS;

	return GODPARENT_COLUMNS;
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------

// Los triggers de la base suben "version" en cada UPDATE que no la cambia.
// Para guardar la versión que dice el servidor, primero se pone -1 y después la versión real:
// como en los dos UPDATE la versión sí cambia, el trigger no se dispara.
function allow_version_write(db: LocalDatabase, table: 'sacramentos' | 'ministros', id: number): void
{
	db.prepare(`UPDATE ${table} SET version = -1 WHERE id = ?`).run(id);
}

// Guarda la versión que asignó el servidor, sin tocar los datos.
export function set_server_version(db: LocalDatabase, entity: SyncEntity, client_id: string, version: number): void
{
	const table = entity === 'ministro' ? 'ministros' : 'sacramentos';
	db.prepare(`UPDATE ${table} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, client_id, version);
}

// ---------------------------------------------------------------------------
// Leer de la base local para subir
// ---------------------------------------------------------------------------

export function read_local_minister(db: LocalDatabase, client_id: string): MinisterData
{
	return db
		.prepare('SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?')
		.get(client_id) as MinisterData;
}

export function read_local_record(db: LocalDatabase, client_id: string): RecordData
{
	const sacrament = db
		.prepare(
			`SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
				s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion
			 FROM sacramentos s
			 LEFT JOIN ministros m ON m.id = s.ministro_id
			 WHERE s.client_id = ?`,
		)
		.get(client_id) as Omit<RecordData, 'personas' | 'detalle' | 'cambios'> & { id: number };

	const type = sacrament.tipo;
	const detail_row = db.prepare(`SELECT * FROM ${detail_table(type)} WHERE sacramento_id = ?`).get(sacrament.id) as Record<string, string | number | null>;

	const read_person = db.prepare(`SELECT client_id, ${PERSON_COLUMNS.join(', ')} FROM personas WHERE id = ?`);
	const people: PersonData[] = [];
	for (const column of person_columns(type))
		people.push(read_person.get(detail_row[column]) as PersonData);

	const detail: Record<string, string | null> = {};
	for (const column of detail_columns(type))
		detail[column] = detail_row[column] as string | null;

	const corrections = db
		.prepare(
			`SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio, c.valor_anterior, c.valor_nuevo, c.fecha_cambio
			 FROM cambios_persona c
			 JOIN personas p ON p.id = c.persona_id
			 WHERE c.sacramento_id = ?
			 ORDER BY c.id`,
		)
		.all(sacrament.id) as PersonCorrection[];

	return {
		tipo: type,
		client_id: sacrament.client_id,
		parroquia_id: sacrament.parroquia_id,
		ministro_client_id: sacrament.ministro_client_id,
		libro: sacrament.libro,
		folio: sacrament.folio,
		numero: sacrament.numero,
		fecha_emision: sacrament.fecha_emision,
		fecha_evento: sacrament.fecha_evento,
		anotaciones: sacrament.anotaciones,
		estado: sacrament.estado,
		anulado_por_usuario_id: sacrament.anulado_por_usuario_id,
		anulado_en: sacrament.anulado_en,
		motivo_anulacion: sacrament.motivo_anulacion,
		personas: people,
		detalle: detail,
		cambios: corrections,
	};
}

// ---------------------------------------------------------------------------
// Guardar lo descargado en la base local
// ---------------------------------------------------------------------------

// Crea o actualiza la persona y devuelve su id local.
function save_downloaded_person(db: LocalDatabase, parish_id: number, person: PersonData): number
{
	const values = PERSON_COLUMNS.map((column) => person[column]);
	const existing = db.prepare('SELECT id FROM personas WHERE client_id = ?').get(person.client_id) as { id: number } | undefined;

	if (existing)
	{
		const assignments = PERSON_COLUMNS.map((column) => `${column} = ?`).join(', ');
		db.prepare(`UPDATE personas SET ${assignments} WHERE id = ?`).run(...values, existing.id);
		return existing.id;
	}

	const marks = PERSON_COLUMNS.map(() => '?').join(', ');
	const result = db
		.prepare(`INSERT INTO personas (client_id, parroquia_id, ${PERSON_COLUMNS.join(', ')}) VALUES (?, ?, ${marks})`)
		.run(person.client_id, parish_id, ...values);

	return Number(result.lastInsertRowid);
}

// El id local del ministro que nombra la partida.
function local_minister_id(db: LocalDatabase, client_id: string | null): number | null
{
	if (!client_id)
		return null;

	const row = db.prepare('SELECT id FROM ministros WHERE client_id = ?').get(client_id) as { id: number } | undefined;
	if (!row)
		throw new MissingReferenceError(`Ministro desconocido: ${client_id}`);

	return row.id;
}

// Guarda una partida que vino del servidor.
//
// Normalmente no toca una partida que tiene cambios sin subir: esos cambios se suben primero,
// y si otra PC la cambió, el servidor la marca como conflicto.
// Con force = true (el usuario eligió "usar la del servidor") se pisa la versión local.
export function save_downloaded_record(db: LocalDatabase, record: RecordData, force: boolean = false): void
{
	const version = record.version ?? 1;
	const local = db.prepare('SELECT id, version FROM sacramentos WHERE client_id = ?').get(record.client_id) as Pick<Required<Sacrament>, 'id' | 'version'> | undefined;

	if (!force)
	{
		if (is_in_queue(db, record.tipo, record.client_id))
			return;

		if (local && local.version === version)
			return;
	}

	const minister_id = local_minister_id(db, record.ministro_client_id);
	const people_ids = record.personas.map((person) => save_downloaded_person(db, record.parroquia_id, person));
	const updated_at = record.updated_at ?? new Date().toISOString();

	// Los mismos valores, en el mismo orden, para el UPDATE y el INSERT.
	const values =
	[
		minister_id,
		record.libro,
		record.folio,
		record.numero,
		record.fecha_emision,
		record.fecha_evento,
		record.anotaciones,
		record.estado,
		record.anulado_por_usuario_id,
		record.anulado_en,
		record.motivo_anulacion,
		version,
		updated_at,
	];

	let sacrament_id: number;
	if (local)
	{
		sacrament_id = local.id;
		allow_version_write(db, 'sacramentos', local.id);
		db.prepare(
			`UPDATE sacramentos SET
				ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,
				estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?
			 WHERE id = ?`,
		).run(...values, local.id);
	}
	else
	{
		const result = db
			.prepare(
				`INSERT INTO sacramentos
					(ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
					 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,
					 client_id, tipo, parroquia_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(...values, record.client_id, record.tipo, record.parroquia_id);
		sacrament_id = Number(result.lastInsertRowid);
	}

	save_downloaded_detail(db, record, sacrament_id, people_ids);
	save_downloaded_corrections(db, record, sacrament_id, people_ids);

	if (force)
	{
		// Se descartó la versión local: sus correcciones sin subir ya no corresponden.
		const kept_ids = JSON.stringify(record.cambios.map((correction) => correction.client_id));
		db.prepare('DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))').run(sacrament_id, kept_ids);

		remove_from_queue(db, record.tipo, record.client_id);
	}
}

// La fila de bautismos, confirmaciones o matrimonios.
function save_downloaded_detail(db: LocalDatabase, record: RecordData, sacrament_id: number, people_ids: number[]): void
{
	const detail = record.detalle;

	if (record.tipo === 'matrimonio')
	{
		db.prepare(
			`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (sacramento_id) DO UPDATE SET
				conyuge_1_id = excluded.conyuge_1_id,
				conyuge_2_id = excluded.conyuge_2_id,
				lugar = excluded.lugar,
				testigo_1 = excluded.testigo_1,
				testigo_2 = excluded.testigo_2,
				testigo_3 = excluded.testigo_3,
				testigo_4 = excluded.testigo_4,
				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,
				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,
				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,
				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha`,
		).run(
			sacrament_id,
			people_ids[0],
			people_ids[1],
			detail.lugar ?? null,
			detail.testigo_1 ?? null,
			detail.testigo_2 ?? null,
			detail.testigo_3 ?? null,
			detail.testigo_4 ?? null,
			detail.conyuge_1_bautismo_parroquia ?? null,
			detail.conyuge_1_bautismo_fecha ?? null,
			detail.conyuge_2_bautismo_parroquia ?? null,
			detail.conyuge_2_bautismo_fecha ?? null,
		);
		return;
	}

	db.prepare(
		`INSERT INTO ${detail_table(record.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (sacramento_id) DO UPDATE SET
			persona_id = excluded.persona_id,
			padrino_1 = excluded.padrino_1,
			padrino_2 = excluded.padrino_2`,
	).run(sacrament_id, people_ids[0], detail.padrino_1 ?? null, detail.padrino_2 ?? null);
}

// Una corrección que ya estaba (mismo client_id) no se duplica.
function save_downloaded_corrections(db: LocalDatabase, record: RecordData, sacrament_id: number, people_ids: number[]): void
{
	// client_id de cada persona  ->  su id local
	const local_person_ids = new Map<string, number>();
	record.personas.forEach((person, i) => local_person_ids.set(person.client_id, people_ids[i]));

	const insert = db.prepare(
		`INSERT INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO NOTHING`,
	);

	for (const correction of record.cambios)
	{
		insert.run(
			correction.client_id,
			local_person_ids.get(correction.persona_client_id),
			sacrament_id,
			correction.usuario_id,
			correction.campo_cambio,
			correction.valor_anterior,
			correction.valor_nuevo,
			correction.fecha_cambio,
		);
	}
}

const MINISTER_FIELDS = ['titulo', 'nombre', 'apellido_paterno', 'apellido_materno', 'activo'] as const;

// Guarda un ministro que vino del servidor. force igual que en save_downloaded_record.
export function save_downloaded_minister(db: LocalDatabase, minister: MinisterData, force: boolean = false): void
{
	const version = minister.version ?? 1;
	const updated_at = minister.updated_at ?? new Date().toISOString();
	const local = db
		.prepare('SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?')
		.get(minister.client_id) as Pick<Required<Minister>, 'id' | 'version' | (typeof MINISTER_FIELDS)[number]> | undefined;

	if (!force && is_in_queue(db, 'ministro', minister.client_id))
	{
		// Las bases de la versión 3 anotaron en la cola ministros que solo se descargaron.
		// Si son iguales a los del servidor y nunca se subieron, no hay nada que subir: se quitan de la cola.
		const same_data = local !== undefined && MINISTER_FIELDS.every((field) => (local[field] ?? null) === (minister[field] ?? null));
		const queued = db.prepare('SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?').get('ministro', minister.client_id) as { version_base: number | null };

		if (!same_data || queued.version_base !== null)
			return;

		remove_from_queue(db, 'ministro', minister.client_id);
		set_server_version(db, 'ministro', minister.client_id, version);
		return;
	}

	if (!local)
	{
		db.prepare(
			`INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(minister.client_id, minister.parroquia_id, minister.titulo ?? null, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, version, updated_at);
		return;
	}

	if (force || local.version !== version)
	{
		allow_version_write(db, 'ministros', local.id);
		db.prepare(
			`UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?
			 WHERE id = ?`,
		).run(minister.titulo ?? null, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, version, updated_at, local.id);
	}

	if (force)
		remove_from_queue(db, 'ministro', minister.client_id);
}
