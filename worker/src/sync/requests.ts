import { PERSON_COLUMNS, detail_columns } from '../../../shared/record_fields';
import type { ChangeRequestData, HistoryData, RecordData } from '../../../shared/sync';
import { RejectedChange } from './validation';

const NO_EDITS = 'Un usuario no puede modificar una partida guardada: debe pedir el cambio.';

const LOCKED_FIELDS = [
	'ministro_client_id',
	'libro',
	'folio',
	'numero',
	'fecha_emision',
	'fecha_evento',
	'estado',
	'anulado_por_usuario_id',
	'anulado_en',
	'motivo_anulacion',
] as const;

const CORRECTION_FIELDS = ['persona_client_id', 'usuario_id', 'campo_cambio', 'valor_anterior', 'valor_nuevo', 'estado', 'revisado_por_usuario_id', 'revisado_en'] as const;

const REQUEST_FIELDS = ['usuario_id', 'parte', 'campo', 'tipo', 'valor_anterior', 'valor_nuevo', 'estado', 'motivo', 'revisado_por_usuario_id', 'revisado_en'] as const;

function same(a: unknown, b: unknown): boolean
{
	return (a ?? null) === (b ?? null);
}

export function users_named(record: RecordData): number[]
{
	const ids = new Set<number>();

	for (const correction of record.cambios)
	{
		ids.add(correction.usuario_id);
		if (correction.revisado_por_usuario_id)
			ids.add(correction.revisado_por_usuario_id);

	}

	for (const request of record.solicitudes)
	{
		ids.add(request.usuario_id);
		if (request.revisado_por_usuario_id)
			ids.add(request.revisado_por_usuario_id);

	}

	for (const entry of record.historial)
		ids.add(entry.usuario_id);

	if (record.anulado_por_usuario_id)
		ids.add(record.anulado_por_usuario_id);

	return [...ids];
}

function check_new_requests(stored: ChangeRequestData[], incoming: ChangeRequestData[], user_id: number): void
{
	const stored_by_id = new Map(stored.map((request) => [request.client_id, request]));
	const new_requests = incoming.filter((request) => !stored_by_id.has(request.client_id));

	for (const request of incoming)
	{
		const saved = stored_by_id.get(request.client_id);
		if (saved && REQUEST_FIELDS.some((field) => !same(saved[field], request[field])))
			throw new RejectedChange('Solo un administrador de la parroquia puede aprobar o rechazar un cambio.');

	}

	for (const request of new_requests)
	{
		if (request.estado !== 'pendiente' || request.usuario_id !== user_id)
			throw new RejectedChange('El cambio que pide un usuario debe quedar pendiente y a su nombre.');

	}

	if (new_requests.length > 0 && stored.some((request) => request.estado === 'pendiente'))
		throw new RejectedChange('La partida ya tiene un cambio pendiente de aprobación.');
}

function check_own_history(stored: HistoryData[], incoming: HistoryData[], user_id: number): void
{
	const stored_ids = new Set(stored.map((entry) => entry.client_id));

	for (const entry of incoming)
	{
		if (!stored_ids.has(entry.client_id) && entry.usuario_id !== user_id)
			throw new RejectedChange('Un usuario solo anota en el historial lo que hizo él.');

	}
}

export function check_helper_edit(stored: RecordData, incoming: RecordData, user_id: number): void
{
	for (const field of LOCKED_FIELDS)
	{
		if (!same(stored[field], incoming[field]))
			throw new RejectedChange(NO_EDITS);

	}

	if (!same(stored.anotaciones, incoming.anotaciones) && stored.anotaciones !== null)
		throw new RejectedChange('La nota marginal ya tiene texto: el usuario debe pedir el cambio.');

	for (let i = 0; i < stored.personas.length; i++)
	{
		for (const field of PERSON_COLUMNS)
		{
			if (!same(stored.personas[i][field], incoming.personas[i][field]))
				throw new RejectedChange(NO_EDITS);

		}
	}

	for (const column of detail_columns(stored.tipo))
	{
		if (!same(stored.detalle[column], incoming.detalle[column]))
			throw new RejectedChange(NO_EDITS);

	}

	const stored_corrections = new Map(stored.cambios.map((correction) => [correction.client_id, correction]));
	for (const correction of incoming.cambios)
	{
		const saved = stored_corrections.get(correction.client_id);
		if (!saved || CORRECTION_FIELDS.some((field) => !same(saved[field], correction[field])))
			throw new RejectedChange('Un usuario no aplica correcciones: debe pedirlas.');

	}

	check_new_requests(stored.solicitudes, incoming.solicitudes, user_id);
	check_own_history(stored.historial, incoming.historial, user_id);
}

export function check_helper_new(record: RecordData, user_id: number): void
{
	if (record.estado !== 'vigente')
		throw new RejectedChange('Solo un administrador de la parroquia puede anular partidas.');

	if (record.cambios.length > 0)
		throw new RejectedChange('Un usuario no aplica correcciones: debe pedirlas.');

	check_new_requests([], record.solicitudes, user_id);
	check_own_history([], record.historial, user_id);
}

export function save_requests(db: D1Database, record: RecordData): D1PreparedStatement[]
{
	return record.solicitudes.map((request) =>
		db
			.prepare(
				`INSERT INTO solicitudes_cambio
					(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
					 revisado_por_usuario_id, revisado_en, creado_en)
				 VALUES (?, (SELECT id FROM sacramentos WHERE client_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT (client_id) DO UPDATE SET
					estado = excluded.estado,
					motivo = excluded.motivo,
					revisado_por_usuario_id = excluded.revisado_por_usuario_id,
					revisado_en = excluded.revisado_en
				 WHERE solicitudes_cambio.sacramento_id = excluded.sacramento_id`,
			)
			.bind(
				request.client_id,
				record.client_id,
				request.usuario_id,
				request.parte,
				request.campo,
				request.tipo,
				request.valor_anterior,
				request.valor_nuevo,
				request.estado,
				request.motivo,
				request.revisado_por_usuario_id,
				request.revisado_en,
				request.creado_en,
			),
	);
}

export function save_new_history(db: D1Database, record: RecordData, known_ids: Set<string>): D1PreparedStatement[]
{
	const writes: D1PreparedStatement[] = [];

	for (const entry of record.historial)
	{
		if (known_ids.has(entry.client_id))
			continue;

		writes.push(
			db
				.prepare(
					`INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)
					 VALUES (?, (SELECT id FROM sacramentos WHERE client_id = ?), ?, ?, ?, ?)`,
				)
				.bind(entry.client_id, record.client_id, entry.usuario_id, entry.evento, entry.motivo, entry.fecha),
		);

		for (const field of entry.campos)
		{
			writes.push(
				db
					.prepare(
						`INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo)
						 VALUES ((SELECT id FROM historial_partidas WHERE client_id = ?), ?, ?, ?, ?)`,
					)
					.bind(entry.client_id, field.parte, field.campo, field.valor_anterior, field.valor_nuevo),
			);
		}
	}

	return writes;
}
