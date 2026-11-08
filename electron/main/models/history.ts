import type { HistoryEntry } from '../../../shared/models';
import type { FieldChange, RecordPart } from '../../../shared/record_fields';
import type { HistoryData, HistoryEvent, HistoryFieldData } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { full_name } from '../utils/helpers';
import { display_text, stored_value } from './field_values';


export function add_history(db: LocalDatabase, sacrament_id: number, user_id: number, event: HistoryEvent, fields: FieldChange[] = [], reason: string | null = null): void
{
	const result = db
		.prepare('INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha) VALUES (?, ?, ?, ?, ?, ?)')
		.run(crypto.randomUUID(), sacrament_id, user_id, event, reason, new Date().toISOString());

	const history_id = Number(result.lastInsertRowid);
	const insert_field = db.prepare('INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)');

	for (const field of fields)
	{
		insert_field.run(
			history_id,
			field.parte,
			field.campo,
			stored_value(db, field.campo, field.valor_anterior),
			stored_value(db, field.campo, field.valor_nuevo),
		);
	}
}

function read_fields(db: LocalDatabase, history_id: number): HistoryFieldData[]
{
	return db
		.prepare('SELECT parte, campo, valor_anterior, valor_nuevo FROM historial_campos WHERE historial_id = ? ORDER BY id')
		.all(history_id) as HistoryFieldData[];
}

export function read_history(db: LocalDatabase, sacrament_id: number): HistoryEntry[]
{
	const rows = db
		.prepare(
			`SELECT h.id, h.evento, h.motivo, h.fecha, u.nombre, u.apellido_paterno, u.apellido_materno, u.username
			 FROM historial_partidas h
			 LEFT JOIN usuarios u ON u.id = h.usuario_id
			 WHERE h.sacramento_id = ?
			 ORDER BY h.fecha DESC, h.id DESC`,
		)
		.all(sacrament_id) as (Omit<HistoryEntry, 'usuario' | 'campos'> & { nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null; username: string | null })[];

	return rows.map((row) => ({
		id: row.id,
		evento: row.evento,
		motivo: row.motivo,
		fecha: row.fecha,
		usuario: full_name(row.nombre, row.apellido_paterno, row.apellido_materno) || row.username || 'Usuario desconocido',
		campos: read_fields(db, row.id).map((field) => ({
			parte: field.parte as RecordPart,
			campo: field.campo,
			texto_anterior: display_text(db, field.campo, field.valor_anterior),
			texto_nuevo: display_text(db, field.campo, field.valor_nuevo),
		})),
	}));
}

export function read_history_data(db: LocalDatabase, sacrament_id: number): HistoryData[]
{
	const rows = db
		.prepare('SELECT id, client_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id = ? ORDER BY id')
		.all(sacrament_id) as (Omit<HistoryData, 'campos'> & { id: number })[];

	return rows.map(({ id, ...row }) => ({ ...row, campos: read_fields(db, id) }));
}

export function save_downloaded_history(db: LocalDatabase, sacrament_id: number, entries: HistoryData[]): void
{
	const insert = db.prepare(
		`INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO NOTHING`,
	);
	const insert_field = db.prepare('INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)');

	for (const entry of entries)
	{
		const result = insert.run(entry.client_id, sacrament_id, entry.usuario_id, entry.evento, entry.motivo, entry.fecha);
		if (result.changes === 0)
			continue;

		for (const field of entry.campos)
			insert_field.run(Number(result.lastInsertRowid), field.parte, field.campo, field.valor_anterior, field.valor_nuevo);

	}
}

export function discard_unsent_history(db: LocalDatabase, sacrament_id: number, kept: HistoryData[]): void
{
	const kept_ids = JSON.stringify(kept.map((entry) => entry.client_id));
	const discarded = `SELECT id FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))`;

	db.prepare(`DELETE FROM historial_campos WHERE historial_id IN (${discarded})`).run(sacrament_id, kept_ids);
	db.prepare('DELETE FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))').run(sacrament_id, kept_ids);
}
