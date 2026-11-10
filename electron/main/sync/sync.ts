import type { ChangeResult, MinisterData, PullPage, RecordData, SyncChange, SyncEntity, UserData } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { current_session, refresh_working_parish } from '../models/session';
import { PUSH_BATCH_SIZE, SYNC_KEYS } from '../utils/config';
import { get_record, get_reference, pull_page, push_changes, type ReferenceData, type RemoteRequest } from './online';
import { get_sync_value, remove_from_queue, set_sync_value, type QueueRow } from './queue';
import {
	adopt_server_user_id,
	lost_username,
	MissingReferenceError,
	read_local_minister,
	read_local_record,
	read_local_user,
	save_downloaded_minister,
	save_downloaded_record,
	save_downloaded_user,
	set_server_version,
} from './records';

export type ConflictChoice = 'servidor' | 'local';

// Reference
export function save_reference_data(db: LocalDatabase, data: ReferenceData): void
{
	const save_parish = db.prepare(
		`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)
		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa`,
	);

	const adopt_minister = db.prepare('UPDATE ministros SET client_id = ? WHERE client_id = ?');

	const save_membership = db.prepare(
		`INSERT INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)
		 SELECT @usuario_id, @parroquia_id, @rol, @principal
		 WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = @usuario_id)
			AND EXISTS (SELECT 1 FROM parroquias WHERE id = @parroquia_id)`,
	);

	const save_all = db.transaction(() =>
	{
		for (const parish of data.parroquias)
			save_parish.run(parish);

		for (const minister of data.ministros)
		{
			adopt_minister.run(minister.client_id, `servidor-${minister.id}`);
			save_downloaded_minister(db, minister);
		}

		for (const user of data.usuarios)
			save_downloaded_user(db, user);

		db.prepare('DELETE FROM usuario_parroquias').run();
		for (const membership of data.usuario_parroquias ?? [])
			save_membership.run(membership);

		db.exec('DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)');
	});

	save_all();
}

export async function refresh_reference(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	const data = await get_reference(request, token);
	save_reference_data(db, data);
	refresh_working_parish(db);
}


function read_local_data(db: LocalDatabase, row: QueueRow): RecordData | MinisterData | UserData
{
	if (row.entidad === 'ministro')
		return read_local_minister(db, row.client_id);

	if (row.entidad === 'usuario')
		return read_local_user(db, row.client_id);

	return read_local_record(db, row.client_id);
}


function adopt_user_id(db: LocalDatabase, client_id: string, server_id: number | undefined): void
{
	if (!server_id)
		return;

	const old_id = adopt_server_user_id(db, client_id, server_id);
	const session = current_session();
	if (old_id !== null && session && session.user_id === old_id)
		session.user_id = server_id;
}

function save_push_result(db: LocalDatabase, row: QueueRow, result: ChangeResult): void
{
	const save = db.transaction(() =>
	{
		if (result.estado === 'conflicto' || result.estado === 'rechazado')
		{
			db.prepare('UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?').run(result.estado, result.motivo, row.id);
			return;
		}

		if (row.entidad === 'usuario')
			adopt_user_id(db, row.client_id, result.id);

		const current = db.prepare('SELECT revision FROM sync_cola WHERE id = ?').get(row.id) as { revision: number };

		if (current.revision === row.revision)
		{
			remove_from_queue(db, row.entidad, row.client_id);
			set_server_version(db, row.entidad, row.client_id, result.version);

			if (row.entidad === 'usuario')
				db.prepare('UPDATE usuarios SET password_hash_pendiente = NULL WHERE client_id = ?').run(row.client_id);
		}
		else
		{
			db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
		}
	});

	save();
}

const NOT_YOURS_REASONS = ['El administrador general solo consulta', 'No tiene permiso para modificar'];

function can_push(db: LocalDatabase, row: { entidad: SyncEntity; client_id: string }): boolean
{
	if (row.entidad === 'usuario')
	{
		const username = db.prepare('SELECT username FROM usuarios WHERE client_id = ?').pluck().get(row.client_id) as string | undefined;
		return username === undefined || !lost_username(username);
	}

	const session = current_session();
	if (!session)
		return true;

	if (session.role === 'admin_general')
		return false;

	const table = row.entidad === 'ministro' ? 'ministros' : 'sacramentos';
	const parish_id = db.prepare(`SELECT parroquia_id FROM ${table} WHERE client_id = ?`).pluck().get(row.client_id) as number | undefined;
	if (parish_id === undefined)
		return true;

	return db.prepare('SELECT 1 FROM membresias WHERE usuario_id = ? AND parroquia_id = ?').get(session.user_id, parish_id) !== undefined;
}

function waits_for_account(db: LocalDatabase, row: { entidad: SyncEntity; client_id: string }): boolean
{
	if (row.entidad === 'usuario' || row.entidad === 'ministro')
		return false;

	const found = db
		.prepare(
			`SELECT 1 FROM sacramentos s
			 WHERE s.client_id = ?
			   AND (s.anulado_por_usuario_id < 0
				OR EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = s.id AND h.usuario_id < 0)
				OR EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND (c.usuario_id < 0 OR c.revisado_por_usuario_id < 0))
				OR EXISTS (SELECT 1 FROM solicitudes_cambio r WHERE r.sacramento_id = s.id AND (r.usuario_id < 0 OR r.revisado_por_usuario_id < 0)))`,
		)
		.get(row.client_id);

	return found !== undefined;
}

function keep_for_other_account(db: LocalDatabase, id: number): void
{
	const row = db.prepare('SELECT estado, motivo FROM sync_cola WHERE id = ?').get(id) as { estado: string; motivo: string | null };
	if (row.estado === 'rechazado' && NOT_YOURS_REASONS.some((reason) => row.motivo?.startsWith(reason)))
		db.prepare(`UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ?`).run(id);
}

export async function push_pending(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	const pending = db
		.prepare(`SELECT id, entidad, client_id FROM sync_cola WHERE estado <> 'conflicto' AND (entidad = 'usuario') = ? ORDER BY entidad = 'ministro' DESC, id`);

	for (const only_users of [1, 0])
	{
		const ids: number[] = [];
		for (const row of pending.all(only_users) as { id: number; entidad: SyncEntity; client_id: string }[])
		{
			if (waits_for_account(db, row))
				db.prepare(`UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ? AND estado = 'rechazado'`).run(row.id);
			else if (can_push(db, row))
				ids.push(row.id);
			else
				keep_for_other_account(db, row.id);
		}
		await push_rows(db, request, token, ids);
	}
}

async function push_rows(db: LocalDatabase, request: RemoteRequest, token: string, pending_ids: number[]): Promise<void>
{
	const read_row = db.prepare('SELECT * FROM sync_cola WHERE id = ?');

	for (let start = 0; start < pending_ids.length; start += PUSH_BATCH_SIZE)
	{
		const rows: QueueRow[] = [];
		for (const id of pending_ids.slice(start, start + PUSH_BATCH_SIZE))
		{
			const row = read_row.get(id) as QueueRow | undefined;
			if (row && row.estado !== 'conflicto')
				rows.push(row);
		}

		if (rows.length === 0)
			continue;

		const changes: SyncChange[] = rows.map((row) =>
		{
			return { entidad: row.entidad, client_id: row.client_id, version_base: row.version_base, cola_id: row.cola_id, datos: read_local_data(db, row) };
		});

		const response = await push_changes(request, token, changes);

		for (let i = 0; i < rows.length; i++)
		{
			if (response.resultados[i])
				save_push_result(db, rows[i], response.resultados[i]);
		}
	}
}


function save_page(db: LocalDatabase, page: PullPage): void
{
	const save = db.transaction(() =>
	{
		for (const record of page.partidas)
			save_downloaded_record(db, record);

		set_sync_value(db, SYNC_KEYS.cursor, String(page.cursor));
	});

	save();
}

function is_missing_reference(error: unknown): boolean
{
	if (error instanceof MissingReferenceError)
		return true;

	return (error as { code?: string } | null)?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY';
}

export async function pull_changes(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	while (true)
	{
		const cursor = get_sync_value(db, SYNC_KEYS.cursor) ?? '0';
		const page = await pull_page(request, token, cursor);

		try
		{
			save_page(db, page);
		}
		catch (error)
		{
			if (!is_missing_reference(error))
				throw error;

			await refresh_reference(db, request, token);
			save_page(db, page);
		}

		if (!page.hayMas)
			return;
	}
}

export async function run_sync(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	await refresh_reference(db, request, token);
	await push_pending(db, request, token);
	await pull_changes(db, request, token);
	set_sync_value(db, SYNC_KEYS.last_sync, new Date().toISOString());
}


export async function resolve_conflict(db: LocalDatabase, request: RemoteRequest, token: string, entity: SyncEntity, client_id: string, choice: ConflictChoice): Promise<void>
{
	const response = await get_record(request, token, entity, client_id);
	const server_record = response.registro;

	const resolve = db.transaction(() =>
	{
		if (choice === 'local')
		{
			db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?`)
				.run(server_record.version, entity, client_id);
		}
		else if (entity === 'ministro')
			save_downloaded_minister(db, server_record as MinisterData, true);
		else if (entity === 'usuario')
			save_downloaded_user(db, server_record as UserData & { id: number }, true);
		else
			save_downloaded_record(db, server_record as RecordData, true);
	});

	resolve();
}

// For UI
export interface SyncItem
{
	entidad: SyncEntity;
	client_id: string;
	estado: 'conflicto' | 'rechazado';
	motivo: string | null;
	descripcion: string;
}

const TYPE_NAMES = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' };

function describe(db: LocalDatabase, row: QueueRow): string
{
	if (row.entidad === 'ministro')
	{
		const minister = db.prepare('SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?').get(row.client_id) as { nombre: string; apellido_paterno: string } | undefined;
		return `Ministro ${minister?.nombre ?? ''} ${minister?.apellido_paterno ?? ''}`.trim();
	}

	if (row.entidad === 'usuario')
	{
		const user = db
			.prepare('SELECT username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE client_id = ?')
			.get(row.client_id) as { username: string; nombre: string; apellido_paterno: string; apellido_materno: string } | undefined;
		if (!user)
			return 'Usuario';

		const full_name = [user.nombre, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ');
		if (lost_username(user.username))
			return `Cuenta de ${full_name} (necesita otro nombre de usuario)`;

		return `Usuario ${user.username} (${full_name})`;
	}

	const type_name = TYPE_NAMES[row.entidad];
	const record = db.prepare('SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?').get(row.client_id) as { libro: string; folio: string; numero: string } | undefined;
	if (!record)
		return type_name;

	return `${type_name}: libro ${record.libro}, folio ${record.folio}, registro ${record.numero}`;
}

export function read_queue_summary(db: LocalDatabase)
{
	const counts = db.prepare('SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado').all() as { estado: QueueRow['estado']; total: number }[];

	const count_of = (state: QueueRow['estado']): number =>
	{
		const row = counts.find((item) => item.estado === state);
		return row ? row.total : 0;
	};

	const problems = db.prepare(`SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id`).all() as QueueRow[];

	const items: SyncItem[] = problems.map((row) => ({
		entidad: row.entidad,
		client_id: row.client_id,
		estado: row.estado as SyncItem['estado'],
		motivo: row.motivo,
		descripcion: describe(db, row),
	}));

	return {
		pendientes: count_of('pendiente'),
		conflictos: count_of('conflicto'),
		rechazados: count_of('rechazado'),
		ultima_sync: get_sync_value(db, SYNC_KEYS.last_sync),
		aviso: get_sync_value(db, SYNC_KEYS.notice),
		items: items,
	};
}
