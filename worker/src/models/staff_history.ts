import type { StaffEvent, StaffHistoryData } from '../../../shared/sync';
import type { TokenUser } from '../utils/crypto';

export function insert_staff_history(db: D1Database, entry: StaffHistoryData): D1PreparedStatement
{
	return db
		.prepare(
			`INSERT INTO historial_ministros_cuentas
				(client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (client_id) DO NOTHING`,
		)
		.bind(
			entry.client_id,
			entry.parroquia_id,
			entry.entidad,
			entry.entidad_client_id,
			entry.usuario_client_id,
			entry.evento,
			entry.detalle,
			entry.fecha,
		);
}

export async function add_account_history(
	db: D1Database,
	actor: TokenUser,
	target_id: number,
	parish_id: number | null,
	event: StaffEvent,
	detail: string | null = null,
): Promise<void>
{
	const [actor_rows, target_rows] = await db.batch<{ client_id: string }>([
		db.prepare('SELECT client_id FROM usuarios WHERE id = ?').bind(actor.usuarioId),
		db.prepare('SELECT client_id FROM usuarios WHERE id = ?').bind(target_id),
	]);

	const target = target_rows.results[0];
	if (!target)
		return;

	await insert_staff_history(db, {
		client_id: crypto.randomUUID(),
		parroquia_id: parish_id,
		entidad: 'usuario',
		entidad_client_id: target.client_id,
		usuario_client_id: actor_rows.results[0]?.client_id ?? null,
		evento: event,
		detalle: detail,
		fecha: new Date().toISOString(),
	}).run();
}

export async function read_staff_history_since(db: D1Database, since: number): Promise<{ filas: StaffHistoryData[]; cursor: number }>
{
	const rows = await db
		.prepare(
			`SELECT id, client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha
			 FROM historial_ministros_cuentas WHERE id > ? ORDER BY id`,
		)
		.bind(since)
		.all<StaffHistoryData & { id: number }>();

	const cursor = rows.results.length > 0 ? rows.results[rows.results.length - 1].id : since;
	return { filas: rows.results.map(({ id: _id, ...row }) => row), cursor: cursor };
}
