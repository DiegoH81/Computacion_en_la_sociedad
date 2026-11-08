import type { Minister, Sacrament } from '../../../shared/models';
import type { MinisterData, PersonCorrection, PersonData, RecordData, SyncEntity, UserData } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { detail_columns, PERSON_COLUMNS } from '../../../shared/record_fields';
import { discard_unsent_requests, read_request_data, save_downloaded_requests } from '../models/change_request';
import { discard_unsent_history, read_history_data, save_downloaded_history } from '../models/history';
import { detail_table, person_columns } from '../models/sacrament';
import { is_in_queue, remove_from_queue } from './queue';

export class MissingReferenceError extends Error {}

type VersionedTable = 'sacramentos' | 'ministros' | 'usuarios';

function allow_version_write(db: LocalDatabase, table: VersionedTable, id: number): void
{
	db.prepare(`UPDATE ${table} SET version = -1 WHERE id = ?`).run(id);
}

function table_of(entity: SyncEntity): VersionedTable
{
	if (entity === 'ministro')
		return 'ministros';

	if (entity === 'usuario')
		return 'usuarios';

	return 'sacramentos';
}

export function set_server_version(db: LocalDatabase, entity: SyncEntity, client_id: string, version: number): void
{
	db.prepare(`UPDATE ${table_of(entity)} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, client_id, version);
}

// Local work
export function read_local_minister(db: LocalDatabase, client_id: string): MinisterData
{
	return db
		.prepare('SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?')
		.get(client_id) as MinisterData;
}

export function read_local_user(db: LocalDatabase, client_id: string): UserData
{
	const row = db
		.prepare(
			`SELECT client_id, id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo,
				password_hash_pendiente AS password_hash
			 FROM usuarios WHERE client_id = ?`,
		)
		.get(client_id) as UserData;

	return row;
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
			`SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio, c.valor_anterior, c.valor_nuevo, c.fecha_cambio,
				c.estado, c.revisado_por_usuario_id, c.revisado_en
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
		solicitudes: read_request_data(db, sacrament.id),
		historial: read_history_data(db, sacrament.id),
	};
}


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

function local_minister_id(db: LocalDatabase, client_id: string | null): number | null
{
	if (!client_id)
		return null;

	const row = db.prepare('SELECT id FROM ministros WHERE client_id = ?').get(client_id) as { id: number } | undefined;
	if (!row)
		throw new MissingReferenceError(`Ministro desconocido: ${client_id}`);

	return row.id;
}

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
	save_downloaded_requests(db, sacrament_id, record.solicitudes ?? []);
	save_downloaded_history(db, sacrament_id, record.historial ?? []);

	if (force)
	{
		// Se descartó la versión local: sus correcciones sin subir ya no corresponden.
		const kept_ids = JSON.stringify(record.cambios.map((correction) => correction.client_id));
		db.prepare('DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))').run(sacrament_id, kept_ids);
		discard_unsent_requests(db, sacrament_id, record.solicitudes ?? []);
		discard_unsent_history(db, sacrament_id, record.historial ?? []);

		remove_from_queue(db, record.tipo, record.client_id);
	}
}

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

function save_downloaded_corrections(db: LocalDatabase, record: RecordData, sacrament_id: number, people_ids: number[]): void
{
	const local_person_ids = new Map<string, number>();
	record.personas.forEach((person, i) => local_person_ids.set(person.client_id, people_ids[i]));

	const insert = db.prepare(
		`INSERT INTO cambios_persona
			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,
			 estado, revisado_por_usuario_id, revisado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO UPDATE SET
			estado = excluded.estado,
			revisado_por_usuario_id = excluded.revisado_por_usuario_id,
			revisado_en = excluded.revisado_en`,
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
			correction.estado ?? 'aprobado',
			correction.revisado_por_usuario_id ?? null,
			correction.revisado_en ?? null,
		);
	}
}

export function save_downloaded_user(db: LocalDatabase, user: UserData & { id: number }, force: boolean = false): void
{
	user = { ...user, client_id: user.client_id ?? `servidor-${user.id}` };

	if (!force && is_in_queue(db, 'usuario', user.client_id))
		return;

	db.prepare(`UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?`).run(user.username, user.id);
	db.prepare(`UPDATE usuarios SET client_id = '~' || id WHERE client_id = ? AND id <> ?`).run(user.client_id, user.id);

	db.prepare(
		`INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, updated_at)
		 VALUES (@id, @client_id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo, @principal, @updated_at)
		 ON CONFLICT (id) DO UPDATE SET
			client_id = @client_id, parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo,
			principal = @principal, updated_at = @updated_at, password_hash_pendiente = NULL`,
	).run({
		id: user.id,
		client_id: user.client_id,
		parroquia_id: user.parroquia_id,
		username: user.username,
		rol: user.rol,
		nombre: user.nombre,
		apellido_paterno: user.apellido_paterno,
		apellido_materno: user.apellido_materno ?? '',
		activo: user.activo,
		principal: user.principal ?? 0,
		updated_at: user.updated_at ?? new Date().toISOString(),
	});

	allow_version_write(db, 'usuarios', user.id);
	db.prepare('UPDATE usuarios SET version = ? WHERE id = ?').run(user.version ?? 1, user.id);

	if (user.password_hash)
	{
		db.prepare(
			`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
			 ON CONFLICT (usuario_id) DO UPDATE SET
				verificador = excluded.verificador,
				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
		).run(user.id, user.password_hash);
	}

	if (force)
		remove_from_queue(db, 'usuario', user.client_id);
}

export function adopt_server_user_id(db: LocalDatabase, client_id: string, server_id: number): number | null
{
	const row = db.prepare('SELECT id FROM usuarios WHERE client_id = ?').get(client_id) as { id: number } | undefined;
	if (!row || row.id === server_id)
		return null;

	const old_id = row.id;


	db.pragma('defer_foreign_keys = ON');
	db.prepare('UPDATE usuarios SET id = ? WHERE id = ?').run(server_id, old_id);
	db.prepare('UPDATE cambios_persona SET usuario_id = ? WHERE usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE cambios_persona SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE sacramentos SET anulado_por_usuario_id = ? WHERE anulado_por_usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE solicitudes_cambio SET usuario_id = ? WHERE usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE solicitudes_cambio SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE historial_partidas SET usuario_id = ? WHERE usuario_id = ?').run(server_id, old_id);
	db.prepare('UPDATE credenciales_locales SET usuario_id = ? WHERE usuario_id = ?').run(server_id, old_id);

	return old_id;
}

const MINISTER_FIELDS = ['titulo', 'nombre', 'apellido_paterno', 'apellido_materno', 'activo'] as const;

export function save_downloaded_minister(db: LocalDatabase, minister: MinisterData, force: boolean = false): void
{
	const version = minister.version ?? 1;
	const updated_at = minister.updated_at ?? new Date().toISOString();
	const local = db
		.prepare('SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?')
		.get(minister.client_id) as Pick<Required<Minister>, 'id' | 'version' | (typeof MINISTER_FIELDS)[number]> | undefined;

	if (!force && is_in_queue(db, 'ministro', minister.client_id))
	{
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
