import type { SyncEntity } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';

export interface QueueRow
{
	id: number;
	entidad: SyncEntity;
	client_id: string;
	version_base: number | null;
	cola_id: string;            
	revision: number;           
	estado: 'pendiente' | 'conflicto' | 'rechazado';
	motivo: string | null;
}

export function add_to_queue(db: LocalDatabase, entity: SyncEntity, client_id: string, version_base: number | null): void
{
	db.prepare(
		`INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)
		 ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1`,
	).run(entity, client_id, version_base, crypto.randomUUID());
}

export function is_in_queue(db: LocalDatabase, entity: SyncEntity, client_id: string): boolean
{
	const row = db.prepare('SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?').get(entity, client_id);
	return row !== undefined;
}

export function remove_from_queue(db: LocalDatabase, entity: SyncEntity, client_id: string): void
{
	db.prepare('DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?').run(entity, client_id);
}

export function get_sync_value(db: LocalDatabase, key: string): string | null
{
	const row = db.prepare('SELECT valor FROM sync_estado WHERE clave = ?').get(key) as { valor: string | null } | undefined;
	if (!row)
		return null;

	return row.valor;
}

export function set_sync_value(db: LocalDatabase, key: string, value: string | null): void
{
	db.prepare(
		`INSERT INTO sync_estado (clave, valor) VALUES (?, ?)
		 ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
	).run(key, value);
}
