import type { ChangeRequest } from '../../../shared/models';
import type { FieldChange, RecordPart } from '../../../shared/record_fields';
import type { ChangeRequestData, RequestState, RequestType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { full_name } from '../utils/helpers';
import { display_text, local_value, stored_value } from './field_values';

export interface NewRequest extends FieldChange
{
	tipo: RequestType;
}

export interface PendingRequest extends NewRequest
{
	id: number;
	usuario_id: number;
}

export function has_pending_request(db: LocalDatabase, sacrament_id: number): boolean
{
	return db.prepare(`SELECT 1 FROM solicitudes_cambio WHERE sacramento_id = ? AND estado = 'pendiente'`).get(sacrament_id) !== undefined;
}

export function pending_requests(db: LocalDatabase, sacrament_id: number): PendingRequest[]
{
	const rows = db
		.prepare(
			`SELECT id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo FROM solicitudes_cambio
			 WHERE sacramento_id = ? AND estado = 'pendiente' ORDER BY id`,
		)
		.all(sacrament_id) as PendingRequest[];

	return rows.map((row) => ({
		...row,
		valor_anterior: local_value(db, row.campo, row.valor_anterior),
		valor_nuevo: local_value(db, row.campo, row.valor_nuevo),
	}));
}

export function insert_requests(db: LocalDatabase, sacrament_id: number, user_id: number, requests: NewRequest[]): void
{
	const insert = db.prepare(
		`INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);
	const now = new Date().toISOString();

	for (const request of requests)
	{
		insert.run(
			crypto.randomUUID(),
			sacrament_id,
			user_id,
			request.parte,
			request.campo,
			request.tipo,
			stored_value(db, request.campo, request.valor_anterior),
			stored_value(db, request.campo, request.valor_nuevo),
			now,
		);
	}
}

export function close_requests(db: LocalDatabase, sacrament_id: number, state: Exclude<RequestState, 'pendiente'>, reviewer_id: number, reason: string | null = null): void
{
	db.prepare(
		`UPDATE solicitudes_cambio SET estado = ?, motivo = ?, revisado_por_usuario_id = ?, revisado_en = ?
		 WHERE sacramento_id = ? AND estado = 'pendiente'`,
	).run(state, reason, reviewer_id, new Date().toISOString(), sacrament_id);
}

type RequestRow = Omit<ChangeRequest, 'solicitado_por' | 'revisado_por' | 'texto_anterior' | 'texto_nuevo'> & {
	pide_nombre: string | null;
	pide_paterno: string | null;
	pide_materno: string | null;
	revisa_nombre: string | null;
	revisa_paterno: string | null;
	revisa_materno: string | null;
};

export function read_requests(db: LocalDatabase, sacrament_id: number): ChangeRequest[]
{
	const rows = db
		.prepare(
			`SELECT s.id, s.parte, s.campo, s.tipo, s.valor_anterior, s.valor_nuevo, s.estado, s.motivo, s.creado_en, s.revisado_en,
				p.nombre AS pide_nombre, p.apellido_paterno AS pide_paterno, p.apellido_materno AS pide_materno,
				r.nombre AS revisa_nombre, r.apellido_paterno AS revisa_paterno, r.apellido_materno AS revisa_materno
			 FROM solicitudes_cambio s
			 LEFT JOIN usuarios p ON p.id = s.usuario_id
			 LEFT JOIN usuarios r ON r.id = s.revisado_por_usuario_id
			 WHERE s.sacramento_id = ?
			 ORDER BY s.creado_en DESC, s.id`,
		)
		.all(sacrament_id) as RequestRow[];

	return rows.map((row) => ({
		id: row.id,
		parte: row.parte as RecordPart,
		campo: row.campo,
		tipo: row.tipo,
		valor_anterior: local_value(db, row.campo, row.valor_anterior),
		valor_nuevo: local_value(db, row.campo, row.valor_nuevo),
		texto_anterior: display_text(db, row.campo, row.valor_anterior),
		texto_nuevo: display_text(db, row.campo, row.valor_nuevo),
		estado: row.estado,
		motivo: row.motivo,
		solicitado_por: full_name(row.pide_nombre, row.pide_paterno, row.pide_materno) || 'Un usuario',
		creado_en: row.creado_en,
		revisado_por: row.revisa_nombre ? full_name(row.revisa_nombre, row.revisa_paterno, row.revisa_materno) : null,
		revisado_en: row.revisado_en,
	}));
}

export function read_request_data(db: LocalDatabase, sacrament_id: number): ChangeRequestData[]
{
	return db
		.prepare(
			`SELECT client_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
				revisado_por_usuario_id, revisado_en, creado_en
			 FROM solicitudes_cambio WHERE sacramento_id = ? ORDER BY id`,
		)
		.all(sacrament_id) as ChangeRequestData[];
}

export function save_downloaded_requests(db: LocalDatabase, sacrament_id: number, requests: ChangeRequestData[]): void
{
	const save = db.prepare(
		`INSERT INTO solicitudes_cambio
			(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
			 revisado_por_usuario_id, revisado_en, creado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO UPDATE SET
			estado = excluded.estado,
			motivo = excluded.motivo,
			revisado_por_usuario_id = excluded.revisado_por_usuario_id,
			revisado_en = excluded.revisado_en`,
	);

	for (const request of requests)
	{
		save.run(
			request.client_id,
			sacrament_id,
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
		);
	}
}

export function discard_unsent_requests(db: LocalDatabase, sacrament_id: number, kept: ChangeRequestData[]): void
{
	const kept_ids = JSON.stringify(kept.map((request) => request.client_id));
	db.prepare('DELETE FROM solicitudes_cambio WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))').run(sacrament_id, kept_ids);
}
