import type { SyncEntity } from '../../../shared/sync';
import { dismiss_sync_notice, get_sync_status, resolve_sync_conflict, sync_now } from '../sync/auto_sync';
import type { ConflictChoice } from '../sync/sync';
import type { Routes } from '../utils/middleware';

export const sync_routes: Routes =
{
	'sync.status': () =>
	{
		return get_sync_status();
	},

	'sync.run': async () =>
	{
		await sync_now();
		return get_sync_status();
	},

	'sync.resolve': async (payload: { entidad: SyncEntity; client_id: string; eleccion: ConflictChoice }) =>
	{
		await resolve_sync_conflict(payload.entidad, payload.client_id, payload.eleccion);
		return get_sync_status();
	},

	'sync.dismissNotice': () =>
	{
		dismiss_sync_notice();
		return { success: true };
	},
};
