// Comparar las dos versiones de un registro en conflicto: la del servidor y la de esta PC.
//
// Muestra solo los datos que difieren, con su nombre en pantalla, y quién y cuándo cambió el registro
// en el servidor. Así quien resuelve sabe qué gana y qué se pierde con cada botón.

import type { ConflictDetail, ConflictDifference } from '../../../shared/models';
import { short_date } from '../../../shared/partial_date';
import { detail_fields, field_label, PERSON_FIELDS, person_parts } from '../../../shared/record_fields';
import type { MinisterData, RecordData, SyncEntity, UserData } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { full_name } from '../utils/helpers';
import { read_local_minister, read_local_record, read_local_user } from './records';

const EMPTY = '(vacío)';
const DATE_FIELDS = ['fecha_emision', 'fecha_evento', 'fecha_nacimiento', 'conyuge_1_bautismo_fecha', 'conyuge_2_bautismo_fecha'];

type Value = string | number | null | undefined;

function as_text(field: string, value: Value): string
{
	if (value === null || value === undefined || value === '')
		return EMPTY;

	if (DATE_FIELDS.includes(field))
		return short_date(String(value)) || String(value);

	return String(value);
}

/** Agrega la fila si el dato es distinto en las dos versiones. */
function compare(differences: ConflictDifference[], label: string, server: string, local: string): void
{
	if (server !== local)
		differences.push({ dato: label, servidor: server, local: local });
}

function minister_name(db: LocalDatabase, client_id: string | null): string
{
	if (!client_id)
		return EMPTY;

	const row = db.prepare('SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?').get(client_id) as
		{ titulo: string | null; nombre: string; apellido_paterno: string; apellido_materno: string } | undefined;
	if (!row)
		return '(un celebrante que no está en esta PC)';

	return [row.titulo, full_name(row.nombre, row.apellido_paterno, row.apellido_materno)].filter(Boolean).join(' ');
}

function user_name(db: LocalDatabase, user_id: number): string | null
{
	const row = db.prepare('SELECT nombre, apellido_paterno, apellido_materno, username FROM usuarios WHERE id = ?').get(user_id) as
		{ nombre: string; apellido_paterno: string; apellido_materno: string; username: string } | undefined;
	if (!row)
		return null;

	return `${full_name(row.nombre, row.apellido_paterno, row.apellido_materno)} (${row.username})`;
}

function record_differences(db: LocalDatabase, server: RecordData, local: RecordData): ConflictDifference[]
{
	const differences: ConflictDifference[] = [];

	for (const field of ['libro', 'folio', 'numero', 'fecha_emision', 'fecha_evento'] as const)
		compare(differences, field_label('sacramento', field), as_text(field, server[field]), as_text(field, local[field]));

	compare(differences, 'Celebrante', minister_name(db, server.ministro_client_id), minister_name(db, local.ministro_client_id));

	person_parts(server.tipo).forEach((part, index) =>
	{
		const server_person = (server.personas[index] ?? {}) as unknown as Record<string, Value>;
		const local_person = (local.personas[index] ?? {}) as unknown as Record<string, Value>;
		for (const field of PERSON_FIELDS)
			compare(differences, field_label(part, field.campo), as_text(field.campo, server_person[field.campo]), as_text(field.campo, local_person[field.campo]));
	});

	for (const field of detail_fields(server.tipo))
		compare(differences, field.label, as_text(field.campo, server.detalle[field.campo]), as_text(field.campo, local.detalle[field.campo]));

	compare(differences, 'Nota marginal', as_text('anotaciones', server.anotaciones), as_text('anotaciones', local.anotaciones));
	compare(differences, 'Estado', server.estado === 'anulado' ? 'Anulada' : 'Vigente', local.estado === 'anulado' ? 'Anulada' : 'Vigente');
	compare(differences, 'Motivo de anulación', as_text('motivo', server.motivo_anulacion), as_text('motivo', local.motivo_anulacion));

	return differences;
}

const PEOPLE_FIELDS = [
	{ campo: 'nombre', label: 'Nombre' },
	{ campo: 'apellido_paterno', label: 'Apellido paterno' },
	{ campo: 'apellido_materno', label: 'Apellido materno' },
] as const;

function staff_differences(server: MinisterData | UserData, local: MinisterData | UserData, entity: SyncEntity): ConflictDifference[]
{
	const differences: ConflictDifference[] = [];

	if (entity === 'ministro')
		compare(differences, 'Título', as_text('titulo', (server as MinisterData).titulo), as_text('titulo', (local as MinisterData).titulo));

	for (const field of PEOPLE_FIELDS)
		compare(differences, field.label, as_text(field.campo, server[field.campo]), as_text(field.campo, local[field.campo]));

	compare(differences, 'Estado', server.activo === 1 ? 'Habilitado' : 'Deshabilitado', local.activo === 1 ? 'Habilitado' : 'Deshabilitado');

	if (entity === 'usuario' && (local as UserData).password_hash)
		differences.push({ dato: 'Contraseña', servidor: 'La de antes', local: 'Cambiada en esta PC' });

	return differences;
}

/** Quién y cuándo: el evento más nuevo del servidor que esta PC no tiene (lo hizo otra PC). */
function last_server_change(db: LocalDatabase, server: RecordData, local: RecordData): { por: string | null; en: string | null }
{
	const known = new Set(local.historial.map((entry) => entry.client_id));
	const others = server.historial.filter((entry) => !known.has(entry.client_id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
	const last = others[others.length - 1];

	if (!last)
		return { por: null, en: server.updated_at ?? null };

	return { por: user_name(db, last.usuario_id), en: last.fecha };
}

export function compare_versions(db: LocalDatabase, entity: SyncEntity, client_id: string, server: RecordData | MinisterData | UserData): ConflictDetail
{
	if (entity === 'ministro' || entity === 'usuario')
	{
		const local = entity === 'ministro' ? read_local_minister(db, client_id) : read_local_user(db, client_id);
		return {
			diferencias: staff_differences(server as MinisterData | UserData, local, entity),
			cambiado_por: null,
			cambiado_en: (server as MinisterData).updated_at ?? null,
			sacramento_id: null,
		};
	}

	const local = read_local_record(db, client_id);
	const change = last_server_change(db, server as RecordData, local);
	const sacrament_id = db.prepare('SELECT id FROM sacramentos WHERE client_id = ?').pluck().get(client_id) as number | undefined;

	return {
		diferencias: record_differences(db, server as RecordData, local),
		cambiado_por: change.por,
		cambiado_en: change.en,
		sacramento_id: sacrament_id ?? null,
	};
}
