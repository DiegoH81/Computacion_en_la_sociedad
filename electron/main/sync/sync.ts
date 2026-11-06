// La sincronización entre esta PC y la base online.
//
// Una sincronización completa (run_sync) hace, en orden:
//   1. Bajar la referencia: parroquias, ministros y usuarios.
//   2. Subir la cola de cambios (de a PUSH_BATCH_SIZE).
//   3. Bajar las partidas que cambiaron desde el último cursor.
//
// Si el servidor dice "conflicto" (otra PC cambió el mismo registro), la fila queda en la cola
// marcada así hasta que el usuario elija con cuál versión quedarse (resolve_conflict).

import type { ChangeResult, MinisterData, PullPage, RecordData, SyncChange, SyncEntity } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { PUSH_BATCH_SIZE, SYNC_KEYS } from '../utils/config';
import { get_record, get_reference, pull_page, push_changes, type ReferenceData, type RemoteRequest } from './online';
import { get_sync_value, remove_from_queue, set_sync_value, type QueueRow } from './queue';
import { MissingReferenceError, read_local_minister, read_local_record, save_downloaded_minister, save_downloaded_record, set_server_version } from './records';

export type ConflictChoice = 'servidor' | 'local';

// ---------------------------------------------------------------------------
// Referencia
// ---------------------------------------------------------------------------

// Guarda parroquias, ministros y usuarios, todo en una transacción.
export function save_reference_data(db: LocalDatabase, data: ReferenceData): void
{
	const save_parish = db.prepare(
		`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)
		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa`,
	);

	// Las bases anteriores a la versión 2 tienen ministros con client_id "servidor-<id>".
	// Aquí se cambia por el client_id real que manda el servidor.
	const adopt_minister = db.prepare('UPDATE ministros SET client_id = ? WHERE client_id = ?');

	// Si un username pasó de una cuenta a otra, se le cambia a la vieja un momento
	// para que el índice UNIQUE no choque mientras se actualizan las dos.
	const free_username = db.prepare(`UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?`);

	const save_user = db.prepare(
		`INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
		 VALUES (@id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo)
		 ON CONFLICT (id) DO UPDATE SET
			parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo`,
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
		{
			free_username.run(user.username, user.id);
			save_user.run(user);
		}

		// Una cuenta deshabilitada deja de entrar sin internet en cuanto esta PC se entera.
		db.exec('DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)');
	});

	save_all();
}

export async function refresh_reference(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	const data = await get_reference(request, token);
	save_reference_data(db, data);
}

// ---------------------------------------------------------------------------
// Subir
// ---------------------------------------------------------------------------

function save_push_result(db: LocalDatabase, row: QueueRow, result: ChangeResult): void
{
	const save = db.transaction(() =>
	{
		if (result.estado === 'conflicto' || result.estado === 'rechazado')
		{
			db.prepare('UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?').run(result.estado, result.motivo, row.id);
			return;
		}

		// Si el usuario editó el registro mientras se subía, la revisión cambió: la fila se queda
		// en la cola para subir la edición nueva, pero ya partiendo de la versión del servidor.
		const current = db.prepare('SELECT revision FROM sync_cola WHERE id = ?').get(row.id) as { revision: number };

		if (current.revision === row.revision)
		{
			remove_from_queue(db, row.entidad, row.client_id);
			set_server_version(db, row.entidad, row.client_id, result.version);
		}
		else
		{
			db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
		}
	});

	save();
}

export async function push_pending(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void>
{
	// Primero los ministros, porque una partida puede nombrar a uno recién creado.
	const pending_ids = db
		.prepare(`SELECT id FROM sync_cola WHERE estado <> 'conflicto' ORDER BY entidad = 'ministro' DESC, id`)
		.pluck()
		.all() as number[];

	const read_row = db.prepare('SELECT * FROM sync_cola WHERE id = ?');

	for (let start = 0; start < pending_ids.length; start += PUSH_BATCH_SIZE)
	{
		// Se vuelve a leer cada fila: mientras se subía el lote anterior pudo cambiar o salir de la cola.
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
			const data = row.entidad === 'ministro' ? read_local_minister(db, row.client_id) : read_local_record(db, row.client_id);
			return { entidad: row.entidad, client_id: row.client_id, version_base: row.version_base, cola_id: row.cola_id, datos: data };
		});

		const response = await push_changes(request, token, changes);

		for (let i = 0; i < rows.length; i++)
		{
			if (response.resultados[i])
				save_push_result(db, rows[i], response.resultados[i]);
		}
	}
}

// ---------------------------------------------------------------------------
// Bajar
// ---------------------------------------------------------------------------

// Guarda una página entera y el cursor nuevo en una transacción: o se guarda todo o nada.
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

// La partida nombra algo (un ministro, una parroquia o un usuario) que esta PC todavía no tiene.
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

			// Se baja la referencia de nuevo y se reintenta una vez.
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

// ---------------------------------------------------------------------------
// Conflictos
// ---------------------------------------------------------------------------

// choice = 'local': se queda la versión de esta PC; se vuelve a subir partiendo de la del servidor.
// choice = 'servidor': se descarta la versión de esta PC y se guarda la del servidor.
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
		else
			save_downloaded_record(db, server_record as RecordData, true);
	});

	resolve();
}

// ---------------------------------------------------------------------------
// Resumen para la pantalla
// ---------------------------------------------------------------------------

export interface SyncItem
{
	entidad: SyncEntity;
	client_id: string;
	estado: 'conflicto' | 'rechazado';
	motivo: string | null;
	descripcion: string;
}

const TYPE_NAMES = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' };

// Un texto para que el usuario reconozca el registro, por ejemplo "Bautismo: libro 1, folio 2, registro 3".
function describe(db: LocalDatabase, row: QueueRow): string
{
	if (row.entidad === 'ministro')
	{
		const minister = db.prepare('SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?').get(row.client_id) as { nombre: string; apellido_paterno: string } | undefined;
		return `Ministro ${minister?.nombre ?? ''} ${minister?.apellido_paterno ?? ''}`.trim();
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
