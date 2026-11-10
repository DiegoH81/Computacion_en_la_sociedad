// Check everything before sending online

import { detail_columns, is_known_field } from '../../../shared/record_fields';
import { HISTORY_EVENTS } from '../../../shared/sync';
import type { ChangeRequestData, HistoryData, HistoryFieldData, MinisterData, PersonCorrection, PersonData, RecordData, RequestState, RequestType, SacramentType, UserData } from '../../../shared/sync';
import { people_count } from '../models/sacrament';
import { is_role, PASSWORD_HASH_PATTERN, USERNAME_PATTERN } from '../models/user';
import type { JsonObject } from '../utils/helpers';

export class RejectedChange extends Error {}

function is_integer(value: unknown): boolean
{
	return Number.isInteger(value);
}

function is_missing(value: unknown): boolean
{
	return value === null || value === undefined;
}

function required_text(value: unknown, field: string): string
{
	if (typeof value !== 'string' || value.trim() === '')
		throw new RejectedChange(`Falta el campo ${field}.`);

	return value;
}

function optional_text(value: unknown, field: string): string | null
{
	if (is_missing(value))
		return null;

	if (typeof value !== 'string')
		throw new RejectedChange(`El campo ${field} no es válido.`);

	return value;
}

function check_person(value: unknown): PersonData
{
	const person = (value ?? {}) as JsonObject;

	let dni = optional_text(person.dni, 'dni');
	if (dni === '')
		dni = null;

	return {
		client_id: required_text(person.client_id, 'client_id de la persona'),
		dni: dni,
		
		nombres: optional_text(person.nombres, 'nombres') ?? '',
		apellido_paterno: optional_text(person.apellido_paterno, 'apellido_paterno') ?? '',
		apellido_materno: optional_text(person.apellido_materno, 'apellido_materno') ?? '',
		fecha_nacimiento: optional_text(person.fecha_nacimiento, 'fecha_nacimiento'),
		fecha_aproximada: optional_text(person.fecha_aproximada, 'fecha_aproximada'),
		lugar_nacimiento: optional_text(person.lugar_nacimiento, 'lugar_nacimiento'),
		padre: optional_text(person.padre, 'padre'),
		madre: optional_text(person.madre, 'madre'),
	};
}

const CORRECTION_STATES = ['aprobado', 'rechazado'];

const OLD_APP = 'Esta PC tiene una versión anterior de la app: actualícela para sincronizar.';

function check_correction(value: unknown): PersonCorrection
{
	const correction = (value ?? {}) as JsonObject;

	if (!is_integer(correction.usuario_id))
		throw new RejectedChange('El usuario de la corrección no es válido.');

	const state = correction.estado ?? 'aprobado';
	if (state === 'pendiente')
		throw new RejectedChange(OLD_APP);

	if (!CORRECTION_STATES.includes(state))
		throw new RejectedChange('El estado de la corrección no es válido.');

	if (!is_missing(correction.revisado_por_usuario_id) && !is_integer(correction.revisado_por_usuario_id))
		throw new RejectedChange('El usuario que revisó la corrección no es válido.');

	return {
		client_id: required_text(correction.client_id, 'client_id de la corrección'),
		persona_client_id: required_text(correction.persona_client_id, 'persona de la corrección'),
		usuario_id: correction.usuario_id,
		campo_cambio: required_text(correction.campo_cambio, 'campo de la corrección'),
		valor_anterior: optional_text(correction.valor_anterior, 'valor_anterior'),
		valor_nuevo: optional_text(correction.valor_nuevo, 'valor_nuevo'),
		fecha_cambio: required_text(correction.fecha_cambio, 'fecha de la corrección'),
		estado: state,
		revisado_por_usuario_id: correction.revisado_por_usuario_id ?? null,
		revisado_en: optional_text(correction.revisado_en, 'revisado_en'),
	};
}

const REQUEST_TYPES: RequestType[] = ['digitacion', 'nota_marginal'];
const REQUEST_STATES: RequestState[] = ['pendiente', 'aprobado', 'rechazado', 'descartado'];
const NAME_FIELDS = ['nombres', 'apellido_paterno', 'apellido_materno'];

function check_request(type: SacramentType, value: unknown): ChangeRequestData
{
	const request = (value ?? {}) as JsonObject;

	if (!is_known_field(type, request.parte, request.campo))
		throw new RejectedChange('El dato de una solicitud de cambio no es válido.');

	if (!REQUEST_TYPES.includes(request.tipo))
		throw new RejectedChange('El tipo de una solicitud de cambio no es válido.');

	if (request.tipo === 'nota_marginal' && (!NAME_FIELDS.includes(request.campo) || request.parte === 'sacramento' || request.parte === 'detalle'))
		throw new RejectedChange('Una corrección por nota marginal solo cambia nombres y apellidos.');

	if (!REQUEST_STATES.includes(request.estado))
		throw new RejectedChange('El estado de una solicitud de cambio no es válido.');

	if (!is_integer(request.usuario_id))
		throw new RejectedChange('El usuario de una solicitud de cambio no es válido.');

	if (!is_missing(request.revisado_por_usuario_id) && !is_integer(request.revisado_por_usuario_id))
		throw new RejectedChange('El usuario que revisó una solicitud no es válido.');

	if (request.estado === 'pendiente' && !is_missing(request.revisado_por_usuario_id))
		throw new RejectedChange('Una solicitud pendiente todavía no tiene quién la revise.');

	return {
		client_id: required_text(request.client_id, 'client_id de la solicitud'),
		usuario_id: request.usuario_id,
		parte: request.parte,
		campo: request.campo,
		tipo: request.tipo,
		valor_anterior: optional_text(request.valor_anterior, 'valor_anterior'),
		valor_nuevo: optional_text(request.valor_nuevo, 'valor_nuevo'),
		estado: request.estado,
		motivo: optional_text(request.motivo, 'motivo'),
		revisado_por_usuario_id: request.revisado_por_usuario_id ?? null,
		revisado_en: optional_text(request.revisado_en, 'revisado_en'),
		creado_en: required_text(request.creado_en, 'fecha de la solicitud'),
	};
}

function check_history_field(type: SacramentType, value: unknown): HistoryFieldData
{
	const field = (value ?? {}) as JsonObject;

	if (!is_known_field(type, field.parte, field.campo))
		throw new RejectedChange('Un dato del historial no es válido.');

	return {
		parte: field.parte,
		campo: field.campo,
		valor_anterior: optional_text(field.valor_anterior, 'valor_anterior'),
		valor_nuevo: optional_text(field.valor_nuevo, 'valor_nuevo'),
	};
}

function check_history(type: SacramentType, value: unknown): HistoryData
{
	const entry = (value ?? {}) as JsonObject;

	if (!HISTORY_EVENTS.includes(entry.evento))
		throw new RejectedChange('Un evento del historial no es válido.');

	if (!is_integer(entry.usuario_id))
		throw new RejectedChange('El usuario de un evento del historial no es válido.');

	return {
		client_id: required_text(entry.client_id, 'client_id del historial'),
		usuario_id: entry.usuario_id,
		evento: entry.evento,
		motivo: optional_text(entry.motivo, 'motivo'),
		fecha: required_text(entry.fecha, 'fecha del historial'),
		campos: Array.isArray(entry.campos) ? entry.campos.map((field: unknown) => check_history_field(type, field)) : [],
	};
}

export function check_record(type: SacramentType, value: unknown): RecordData
{
	const record = (value ?? {}) as JsonObject;

	if (record.tipo !== type)
		throw new RejectedChange('El tipo de la partida no coincide.');

	if (!is_integer(record.parroquia_id))
		throw new RejectedChange('La parroquia no es válida.');

	if (record.estado !== 'vigente' && record.estado !== 'anulado')
		throw new RejectedChange('El estado no es válido.');

	if (!is_missing(record.anulado_por_usuario_id) && !is_integer(record.anulado_por_usuario_id))
		throw new RejectedChange('El usuario de la anulación no es válido.');

	let people: PersonData[] = [];
	if (Array.isArray(record.personas))
		people = record.personas.map(check_person);

	const different_ids = new Set(people.map((person) => person.client_id));
	if (people.length !== people_count(type) || different_ids.size !== people.length)
		throw new RejectedChange('Las personas de la partida no son válidas.');

	
	const incoming_detail = record.detalle ?? {};
	const detail: Record<string, string | null> = {};
	for (const column of detail_columns(type))
		detail[column] = optional_text(incoming_detail[column], column);

	const clean: RecordData =
	{
		tipo: type,
		client_id: required_text(record.client_id, 'client_id'),
		parroquia_id: record.parroquia_id,
		ministro_client_id: optional_text(record.ministro_client_id, 'ministro'),
		libro: required_text(record.libro, 'libro'),
		folio: required_text(record.folio, 'folio'),
		numero: required_text(record.numero, 'número'),
		fecha_emision: optional_text(record.fecha_emision, 'fecha'),
		fecha_evento: optional_text(record.fecha_evento, 'fecha_evento'),
		anotaciones: optional_text(record.anotaciones, 'anotaciones'),
		estado: record.estado,
		anulado_por_usuario_id: record.anulado_por_usuario_id ?? null,
		anulado_en: optional_text(record.anulado_en, 'anulado_en'),
		motivo_anulacion: optional_text(record.motivo_anulacion, 'motivo_anulacion'),
		personas: people,
		detalle: detail,
		cambios: [],
		solicitudes: [],
		historial: [],
	};

	if (Array.isArray(record.cambios))
		clean.cambios = record.cambios.map(check_correction);

	if (Array.isArray(record.solicitudes))
		clean.solicitudes = record.solicitudes.map((request: unknown) => check_request(type, request));

	if (Array.isArray(record.historial))
		clean.historial = record.historial.map((entry: unknown) => check_history(type, entry));

	return clean;
}

export function check_user(value: unknown): UserData
{
	const user = (value ?? {}) as JsonObject;

	if (!is_role(user.rol))
		throw new RejectedChange('El rol no es válido.');

	if (!is_missing(user.parroquia_id) && !is_integer(user.parroquia_id))
		throw new RejectedChange('La parroquia no es válida.');

	const username = required_text(user.username, 'username');
	if (!USERNAME_PATTERN.test(username))
		throw new RejectedChange('El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.');

	const password_hash = optional_text(user.password_hash, 'password_hash');
	if (password_hash !== null && !PASSWORD_HASH_PATTERN.test(password_hash))
		throw new RejectedChange('La contraseña no viene en un formato válido.');

	return {
		client_id: required_text(user.client_id, 'client_id'),
		parroquia_id: user.parroquia_id ?? null,
		username: username,
		rol: user.rol,
		nombre: required_text(user.nombre, 'nombre'),
		apellido_paterno: required_text(user.apellido_paterno, 'apellido_paterno'),
		apellido_materno: optional_text(user.apellido_materno, 'apellido_materno') ?? '',
		activo: user.activo === 0 ? 0 : 1,
		password_hash: password_hash,
	};
}

export function check_minister(value: unknown): MinisterData
{
	const minister = (value ?? {}) as JsonObject;

	if (!is_integer(minister.parroquia_id))
		throw new RejectedChange('La parroquia no es válida.');

	return {
		client_id: required_text(minister.client_id, 'client_id'),
		parroquia_id: minister.parroquia_id,
		titulo: optional_text(minister.titulo, 'titulo'),
		nombre: required_text(minister.nombre, 'nombre'),
		apellido_paterno: optional_text(minister.apellido_paterno, 'apellido_paterno') ?? '',
		apellido_materno: optional_text(minister.apellido_materno, 'apellido_materno') ?? '',
		activo: minister.activo === 0 ? 0 : 1,
	};
}
