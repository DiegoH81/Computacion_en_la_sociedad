import type { StaffEntity, StaffEvent, StaffHistoryData } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import type { Session } from './session';

export interface ChangedText
{
	label: string;
	before: string | null;
	after: string | null;
}

export function changes_text(changes: ChangedText[]): string | null
{
	const parts = changes
		.filter((change) => (change.before ?? '') !== (change.after ?? ''))
		.map((change) => `${change.label}: ${change.before || '(vacío)'} → ${change.after || '(vacío)'}`);

	return parts.length > 0 ? parts.join('; ') : null;
}

export function add_staff_history(
	db: LocalDatabase,
	session: Session,
	entity: StaffEntity,
	entity_client_id: string,
	parish_id: number | null,
	event: StaffEvent,
	detail: string | null = null,
): void
{
	const actor = db.prepare('SELECT client_id FROM usuarios WHERE id = ?').pluck().get(session.user_id) as string | undefined;

	db.prepare(
		`INSERT INTO historial_ministros_cuentas
			(client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(crypto.randomUUID(), parish_id, entity, entity_client_id, actor ?? null, event, detail, new Date().toISOString());
}

export function read_staff_history_data(db: LocalDatabase, entity: StaffEntity, entity_client_id: string): StaffHistoryData[]
{
	return db
		.prepare(
			`SELECT client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha
			 FROM historial_ministros_cuentas WHERE entidad = ? AND entidad_client_id = ? ORDER BY id`,
		)
		.all(entity, entity_client_id) as StaffHistoryData[];
}

export function save_downloaded_staff_history(db: LocalDatabase, entries: StaffHistoryData[]): void
{
	const insert = db.prepare(
		`INSERT INTO historial_ministros_cuentas
			(client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)
		 VALUES (@client_id, @parroquia_id, @entidad, @entidad_client_id, @usuario_client_id, @evento, @detalle, @fecha)
		 ON CONFLICT (client_id) DO NOTHING`,
	);

	for (const entry of entries)
		insert.run(entry);
}
