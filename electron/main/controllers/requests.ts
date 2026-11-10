import type { SacramentRecord } from '../../../shared/models';
import { changed_fields, get_field, person_at, person_parts, set_field, type FieldChange } from '../../../shared/record_fields';
import type { LocalDatabase } from '../db/database';
import { close_requests, has_pending_request, insert_requests, pending_requests, type NewRequest, type PendingRequest } from '../models/change_request';
import { add_history } from '../models/history';
import { check_parish_access, check_parish_admin } from '../models/parish';
import { apply_corrections } from '../models/person';
import { check_required, queue_sacrament, read_record, save_edit, with_correction } from '../models/record';
import { OTHER_PARISH_RECORD } from '../models/sacrament';
import type { Session } from '../models/session';
import { ServiceError } from '../utils/errors';
import { clean_text, full_name, positive_id } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

const ONLY_ADMIN = 'Solo un administrador de la parroquia puede aprobar o rechazar cambios.';

export const PENDING_REQUEST = 'La partida tiene un cambio pendiente de aprobación. Un administrador de la parroquia debe aprobarlo o rechazarlo primero.';

export const DISCARDED_ON_EDIT = 'Descartada al editar la partida';

export type ReviewDecision = 'aprobado' | 'rechazado';

export interface PendingChanges
{
	partida: SacramentRecord;
	solicitado_por: string;
}



function as_requests(changes: FieldChange[], type: NewRequest['tipo']): NewRequest[]
{
	return changes.map((change) => ({ ...change, tipo: type }));
}

function requested_corrections(saved: SacramentRecord, record: SacramentRecord): FieldChange[]
{
	const out_changes: FieldChange[] = [];

	for (const part of person_parts(saved.sacramento.tipo))
	{
		const incoming = person_at(record, part);
		const new_changes = Array.isArray(incoming?.cambios) ? incoming.cambios.filter((change) => change.id === undefined) : [];
		const saved_person = person_at(saved, part);
		const corrections = apply_corrections({ ...saved_person, cambios: [...saved_person.cambios, ...new_changes] }).corrections;

		for (const correction of corrections)
			out_changes.push({ parte: part, campo: correction.campo_cambio, valor_anterior: correction.valor_anterior ?? null, valor_nuevo: correction.valor_nuevo });

	}

	return out_changes;
}

export function request_changes(db: LocalDatabase, session: Session, record: SacramentRecord): void
{
	const sacrament_id = positive_id(record.sacramento?.id);
	const saved = read_record(db, sacrament_id);
	check_parish_access(session, saved.sacramento.parroquia_id as number, OTHER_PARISH_RECORD);

	if (saved.sacramento.estado === 'anulado')
		throw new ServiceError('Una partida anulada no admite cambios.', 409);

	if (has_pending_request(db, sacrament_id))
		throw new ServiceError(PENDING_REQUEST, 409);

	const new_note = clean_text(record.sacramento?.anotaciones);
	const writes_blank_note = clean_text(saved.sacramento.anotaciones) === null && new_note !== null;

	const typed = changed_fields(saved, record).filter((change) => !(writes_blank_note && change.campo === 'anotaciones'));
	const corrections = requested_corrections(saved, record);

	if (corrections.some((correction) => typed.some((change) => change.parte === correction.parte && change.campo === correction.campo)))
		throw new ServiceError('No cambie el mismo dato en el formulario y en la nota marginal a la vez.', 400);

	if (typed.length === 0 && corrections.length === 0 && !writes_blank_note)
		throw new ServiceError('No hay cambios para pedir.', 400);

	check_required(record, saved);

	const requests = [...as_requests(typed, 'digitacion'), ...as_requests(corrections, 'nota_marginal')];

	const save = db.transaction(() =>
	{
		queue_sacrament(db, sacrament_id);

		if (writes_blank_note)
		{
			db.prepare('UPDATE sacramentos SET anotaciones = ? WHERE id = ?').run(new_note, sacrament_id);
			add_history(db, sacrament_id, session.user_id, 'editada', [{ parte: 'sacramento', campo: 'anotaciones', valor_anterior: null, valor_nuevo: new_note }]);
		}

		if (requests.length > 0)
		{
			insert_requests(db, sacrament_id, session.user_id, requests);
			add_history(db, sacrament_id, session.user_id, 'cambio_pedido', requests);
		}
	});
	save();
}


function with_requests(saved: SacramentRecord, requests: PendingRequest[]): SacramentRecord
{
	let record = saved;
	for (const request of requests)
	{
		if (request.tipo === 'nota_marginal')
			record = with_correction(record, request.parte, request.campo, request.valor_nuevo);
		else
			record = set_field(record, request.parte, request.campo, request.valor_nuevo);

	}
	return record;
}

function uses_requests(record: SacramentRecord, requests: PendingRequest[]): boolean
{
	return requests.every((request) =>
	{
		if (request.tipo === 'digitacion')
			return get_field(record, request.parte, request.campo) === request.valor_nuevo;

		const changes = person_at(record, request.parte).cambios ?? [];
		return changes.some((change) => change.id === undefined && change.campo_cambio === request.campo && clean_text(change.valor_nuevo) === request.valor_nuevo);
	});
}

function check_reviewer(session: Session, saved: SacramentRecord): void
{
	check_parish_admin(session, saved.sacramento.parroquia_id as number, OTHER_PARISH_RECORD, ONLY_ADMIN);
}

export function review_requests(db: LocalDatabase, session: Session, sacrament_id: number, decision: unknown): void
{
	if (decision !== 'aprobado' && decision !== 'rechazado')
		throw new ServiceError('Indique si aprueba o rechaza el cambio.', 400);

	const saved = read_record(db, sacrament_id);
	check_reviewer(session, saved);

	const requests = pending_requests(db, sacrament_id);
	if (requests.length === 0)
		throw new ServiceError('La partida no tiene cambios pendientes.', 409);

	const review = db.transaction(() =>
	{
		queue_sacrament(db, sacrament_id);

		if (decision === 'aprobado')
		{
			save_edit(db, session, saved, with_requests(saved, requests));
			add_history(db, sacrament_id, session.user_id, 'cambio_aprobado', requests);
		}
		else
		{
			add_history(db, sacrament_id, session.user_id, 'cambio_rechazado', requests);
		}

		close_requests(db, sacrament_id, decision, session.user_id);
		db.prepare('UPDATE sacramentos SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), sacrament_id);
	});
	review();
}

export function resolve_on_edit(db: LocalDatabase, session: Session, sacrament_id: number, record: SacramentRecord): void
{
	const requests = pending_requests(db, sacrament_id);
	if (requests.length === 0)
		return;

	if (uses_requests(record, requests))
	{
		close_requests(db, sacrament_id, 'aprobado', session.user_id);
		add_history(db, sacrament_id, session.user_id, 'cambio_aprobado', requests);
		return;
	}

	close_requests(db, sacrament_id, 'descartado', session.user_id, DISCARDED_ON_EDIT);
	add_history(db, sacrament_id, session.user_id, 'cambio_descartado', requests, DISCARDED_ON_EDIT);
}

export function list_pending(db: LocalDatabase, session: Session): PendingChanges[]
{
	if (session.role !== 'admin_parroquia' || !session.parish_id)
		throw new ServiceError(ONLY_ADMIN, 403);

	const rows = db
		.prepare(
			`SELECT r.sacramento_id, MIN(r.id) AS primera, u.nombre, u.apellido_paterno, u.apellido_materno
			 FROM solicitudes_cambio r
			 JOIN sacramentos s ON s.id = r.sacramento_id
			 LEFT JOIN usuarios u ON u.id = r.usuario_id
			 WHERE r.estado = 'pendiente' AND s.parroquia_id = ?
			 GROUP BY r.sacramento_id
			 ORDER BY primera`,
		)
		.all(session.parish_id) as { sacramento_id: number; nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null }[];

	return rows.map((row) => ({
		partida: read_record(db, row.sacramento_id),
		solicitado_por: full_name(row.nombre, row.apellido_paterno, row.apellido_materno),
	}));
}

export const request_routes: Routes =
{
	'requests.pending': (_payload, { db, session }) =>
	{
		return { pendientes: list_pending(db, session) };
	},

	'requests.review': (payload: { sacramento_id: unknown; decision: unknown }, { db, session }) =>
	{
		review_requests(db, session, positive_id(payload.sacramento_id), payload.decision);
		return { success: true };
	},
};
