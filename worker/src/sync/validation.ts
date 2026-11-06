// Revisa los datos que manda una PC antes de guardarlos.
//
// Los datos llegan de la red, así que no confiamos en nada: cada función revisa campo por campo
// y devuelve un objeto limpio. Si algo está mal, lanza un RejectedChange con el motivo,
// y ese motivo es el que ve el usuario en la PC.

import type { JsonObject } from '../http';
import { detail_columns, people_count, type MinisterData, type PersonCorrection, type PersonData, type RecordData, type SacramentType } from './sync_types';

export class RejectedChange extends Error {}

export function is_sacrament_type(value: unknown): value is SacramentType
{
	return value === 'bautismo' || value === 'confirmacion' || value === 'matrimonio';
}

function is_integer(value: unknown): boolean
{
	return Number.isInteger(value);
}

function is_missing(value: unknown): boolean
{
	return value === null || value === undefined;
}

// Texto obligatorio: no puede faltar ni estar vacío.
function required_text(value: unknown, field: string): string
{
	if (typeof value !== 'string' || value.trim() === '')
		throw new RejectedChange(`Falta el campo ${field}.`);

	return value;
}

// Texto opcional: puede faltar (queda null), pero si viene tiene que ser texto.
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

	if (!is_missing(person.edad) && !(is_integer(person.edad) && person.edad >= 0))
		throw new RejectedChange('La edad no es válida.');

	let dni = optional_text(person.dni, 'dni');
	if (dni === '')
		dni = null;

	return {
		client_id: required_text(person.client_id, 'client_id de la persona'),
		dni: dni,
		// Los nombres pueden quedar vacíos, igual que en el formulario: es lo que dice la partida.
		nombres: optional_text(person.nombres, 'nombres') ?? '',
		apellido_paterno: optional_text(person.apellido_paterno, 'apellido_paterno') ?? '',
		apellido_materno: optional_text(person.apellido_materno, 'apellido_materno') ?? '',
		fecha_nacimiento: optional_text(person.fecha_nacimiento, 'fecha_nacimiento'),
		edad: person.edad ?? null,
		lugar_nacimiento: optional_text(person.lugar_nacimiento, 'lugar_nacimiento'),
		padre: optional_text(person.padre, 'padre'),
		madre: optional_text(person.madre, 'madre'),
	};
}

function check_correction(value: unknown): PersonCorrection
{
	const correction = (value ?? {}) as JsonObject;

	if (!is_integer(correction.usuario_id))
		throw new RejectedChange('El usuario de la corrección no es válido.');

	return {
		client_id: required_text(correction.client_id, 'client_id de la corrección'),
		persona_client_id: required_text(correction.persona_client_id, 'persona de la corrección'),
		usuario_id: correction.usuario_id,
		campo_cambio: required_text(correction.campo_cambio, 'campo de la corrección'),
		valor_anterior: optional_text(correction.valor_anterior, 'valor_anterior'),
		valor_nuevo: optional_text(correction.valor_nuevo, 'valor_nuevo'),
		fecha_cambio: required_text(correction.fecha_cambio, 'fecha de la corrección'),
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

	// Personas: la cantidad justa para el tipo y sin repetir la misma persona.
	let people: PersonData[] = [];
	if (Array.isArray(record.personas))
		people = record.personas.map(check_person);

	const different_ids = new Set(people.map((person) => person.client_id));
	if (people.length !== people_count(type) || different_ids.size !== people.length)
		throw new RejectedChange('Las personas de la partida no son válidas.');

	// Detalle: solo se copian las columnas que tiene este tipo; lo demás se ignora.
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
		fecha_emision: required_text(record.fecha_emision, 'fecha'),
		fecha_evento: optional_text(record.fecha_evento, 'fecha_evento'),
		anotaciones: optional_text(record.anotaciones, 'anotaciones'),
		estado: record.estado,
		anulado_por_usuario_id: record.anulado_por_usuario_id ?? null,
		anulado_en: optional_text(record.anulado_en, 'anulado_en'),
		motivo_anulacion: optional_text(record.motivo_anulacion, 'motivo_anulacion'),
		personas: people,
		detalle: detail,
		cambios: [],
	};

	if (Array.isArray(record.cambios))
		clean.cambios = record.cambios.map(check_correction);

	return clean;
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
		apellido_paterno: required_text(minister.apellido_paterno, 'apellido_paterno'),
		apellido_materno: required_text(minister.apellido_materno, 'apellido_materno'),
		activo: minister.activo === 0 ? 0 : 1,
	};
}
