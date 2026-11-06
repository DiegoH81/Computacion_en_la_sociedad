import type { DuplicateMatch, DuplicateQuery } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { is_sacrament_type, people_of } from '../models/sacrament';
import { ServiceError } from '../utils/errors';
import { full_name } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

interface Candidate
{
	id: number;
	persona_id: number;
	libro: string;
	folio: string;
	numero: string;
	parroquia_nombre: string;
	dni: string | null;
	nombres: string;
	apellido_paterno: string;
	apellido_materno: string;
	fecha_nacimiento: string | null;
	padre: string | null;
	madre: string | null;
}

type Field = 'dni' | 'nombres' | 'apellido_paterno' | 'apellido_materno' | 'fecha_nacimiento' | 'padre' | 'madre';
type PersonValues = Record<Field, string>;

const MAX_MATCHES_PER_PERSON = 50;
const MIN_PERCENT = 75;
const SIMILAR = 0.75;

const FIELDS: Field[] = ['dni', 'nombres', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'padre', 'madre'];

const WEIGHTS: Record<Field, number> =
{
	dni: 40,
	nombres: 25,
	apellido_paterno: 20,
	apellido_materno: 15,
	fecha_nacimiento: 20,
	padre: 10,
	madre: 10,
};

const LABELS: Record<Field, string> =
{
	dni: 'DNI',
	nombres: 'Nombres',
	apellido_paterno: 'Apellido paterno',
	apellido_materno: 'Apellido materno',
	fecha_nacimiento: 'Fecha de nacimiento',
	padre: 'Padre',
	madre: 'Madre',
};

function normalize(value: string | null | undefined): string
{
	return (value ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}


function edit_distance(a: string, b: string): number
{
	let previous_row: number[] = [];
	for (let j = 0; j <= b.length; j++)
		previous_row.push(j);

	for (let i = 1; i <= a.length; i++)
	{
		const row = [i];
		for (let j = 1; j <= b.length; j++)
		{
			const change_cost = a[i - 1] === b[j - 1] ? 0 : 1;
			row[j] = Math.min(previous_row[j] + 1, row[j - 1] + 1, previous_row[j - 1] + change_cost);
		}
		previous_row = row;
	}

	return previous_row[b.length];
}

export function similarity(a: string, b: string): number
{
	if (!a || !b)
		return 0;

	if (a === b)
		return 1;

	const words_a = a.split(' ');
	const words_b = b.split(' ');
	const shorter = words_a.length <= words_b.length ? words_a : words_b;
	const longer = words_a.length <= words_b.length ? words_b : words_a;
	if (shorter.every((word) => longer.includes(word)))
		return 0.85;

	const longest = Math.max(a.length, b.length);
	if (Math.abs(a.length - b.length) / longest > 1 - SIMILAR)
		return 0;

	const ratio = 1 - edit_distance(a, b) / longest;
	if (ratio >= SIMILAR)
		return ratio;

	return 0;
}

function compare_dates(a: string, b: string): { comparable: boolean; value: number }
{
	if (!a || !b)
		return { comparable: false, value: 0 };

	if (a === b)
		return { comparable: true, value: 1 };

	const is_prefix = a.startsWith(b + '-') || b.startsWith(a + '-');
	return { comparable: !is_prefix, value: 0 };
}

function compare(input: PersonValues, candidate: Candidate, old_names: Map<string, string[]>): { nivel: 'alta' | 'posible'; porcentaje: number; coincide: string[] } | null
{
	const dni_comparable = Boolean(input.dni && candidate.dni);
	const same_dni = dni_comparable && (input.dni === normalize(candidate.dni));

	const name_similarity = (field: Field, current: string | null): number =>
	{
		const options = [normalize(current), ...(old_names.get(`${candidate.persona_id}:${field}`) ?? [])];
		return Math.max(...options.map((option) => similarity(input[field], option)));
	};

	const first_name_score = name_similarity('nombres', candidate.nombres);
	const father_name_score = name_similarity('apellido_paterno', candidate.apellido_paterno);

	// Without DNI, name and surname have to match
	if (!same_dni && (first_name_score === 0 || father_name_score === 0))
		return null;

	
	const results: Record<Field, { comparable: boolean; value: number }> =
	{
		dni: { comparable: dni_comparable, value: same_dni ? 1 : 0 },
		nombres: { comparable: Boolean(input.nombres), value: first_name_score },
		apellido_paterno: { comparable: Boolean(input.apellido_paterno), value: father_name_score },
		apellido_materno:
		{
			comparable: Boolean(input.apellido_materno && candidate.apellido_materno),
			value: name_similarity('apellido_materno', candidate.apellido_materno),
		},
		fecha_nacimiento: compare_dates(input.fecha_nacimiento, normalize(candidate.fecha_nacimiento)),
		padre: { comparable: Boolean(input.padre && candidate.padre), value: similarity(input.padre, normalize(candidate.padre)) },
		madre: { comparable: Boolean(input.madre && candidate.madre), value: similarity(input.madre, normalize(candidate.madre)) },
	};

	let obtained_points = 0;
	let possible_points = 0;
	const matching_labels: string[] = [];

	for (const field of FIELDS)
	{
		const result = results[field];
		if (!result.comparable)
			continue;

		possible_points += WEIGHTS[field];
		obtained_points += WEIGHTS[field] * result.value;

		if (result.value >= SIMILAR)
			matching_labels.push(LABELS[field]);
	}

	const percent = Math.round((obtained_points / possible_points) * 100);

	const names_match = (first_name_score >= SIMILAR) && (father_name_score >= SIMILAR);
	const different_dni = dni_comparable && !same_dni;

	let has_independent_data = false;

	for (const field of ['fecha_nacimiento', 'padre', 'madre'] as Field[])
	{
		if (results[field].comparable && results[field].value >= SIMILAR)
			has_independent_data = true;
	}

	if (same_dni && (first_name_score > 0 || father_name_score > 0))
		return { nivel: 'alta', porcentaje: percent, coincide: matching_labels };

	if (names_match && has_independent_data && !different_dni)
		return { nivel: 'alta', porcentaje: percent, coincide: matching_labels };

	if (same_dni || percent >= MIN_PERCENT)
		return { nivel: 'posible', porcentaje: percent, coincide: matching_labels };

	return null;
}

function normalized_values(person: DuplicateQuery): PersonValues
{
	return {
		dni: normalize(person.dni),
		nombres: normalize(person.nombres),
		apellido_paterno: normalize(person.apellido_paterno),
		apellido_materno: normalize(person.apellido_materno),
		fecha_nacimiento: normalize(person.fecha_nacimiento),
		padre: normalize(person.padre),
		madre: normalize(person.madre),
	};
}

function by_relevance(a: DuplicateMatch, b: DuplicateMatch): number
{
	const level_difference = Number(b.nivel === 'alta') - Number(a.nivel === 'alta');
	if (level_difference !== 0)
		return level_difference;

	return b.porcentaje - a.porcentaje;
}

export function find_duplicates(db: LocalDatabase, type: SacramentType, exclude_sacrament_id: unknown, people: DuplicateQuery[]): { matches: DuplicateMatch[]; total: number }
{
	if (!is_sacrament_type(type))
		throw new ServiceError('Tipo de sacramento inválido.', 400);

	const searchable = people
		.map((person) => ({ para: person.para ?? '', values: normalized_values(person) }))
		.filter((person) => person.values.dni || (person.values.nombres && person.values.apellido_paterno));

	if (searchable.length === 0)
		return { matches: [], total: 0 };

	const excluded_id = Number.isInteger(exclude_sacrament_id) ? exclude_sacrament_id : 0;
	const candidates = db
		.prepare(
			`SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, par.nombre AS parroquia_nombre,
				pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
			 FROM (${people_of(type)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 JOIN parroquias par ON par.id = s.parroquia_id
			 WHERE s.estado = 'vigente' AND s.id <> ?`,
		)
		.all(excluded_id) as Candidate[];

	const old_names = new Map<string, string[]>();
	const corrections = db
		.prepare(
			`SELECT persona_id, campo_cambio, valor_anterior FROM cambios_persona
			 WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_anterior IS NOT NULL`,
		)
		.all() as { persona_id: number; campo_cambio: string; valor_anterior: string }[];

	for (const correction of corrections)
	{
		const key = `${correction.persona_id}:${correction.campo_cambio}`;
		const list = old_names.get(key) ?? [];
		list.push(normalize(correction.valor_anterior));
		old_names.set(key, list);
	}

	let total = 0;
	const found: DuplicateMatch[] = [];

	for (const person of searchable)
	{
		const matches: DuplicateMatch[] = [];

		for (const candidate of candidates)
		{
			const result = compare(person.values, candidate, old_names);
			if (!result)
				continue;

			matches.push({
				sacramento_id: candidate.id,
				para: person.para,
				nivel: result.nivel,
				porcentaje: result.porcentaje,
				coincide: result.coincide,
				nombre_completo: full_name(candidate.nombres, candidate.apellido_paterno, candidate.apellido_materno),
				parroquia_nombre: candidate.parroquia_nombre,
				libro: candidate.libro,
				folio: candidate.folio,
				numero: candidate.numero,
			});
		}

		total += matches.length;
		matches.sort(by_relevance);
		found.push(...matches.slice(0, MAX_MATCHES_PER_PERSON));
	}

	found.sort(by_relevance);
	return { matches: found, total: total };
}

export const duplicate_routes: Routes =
{
	'sacraments.findDuplicates': (payload: { tipo: SacramentType; excluir_sacramento_id?: number; personas: DuplicateQuery[] }, { db }) =>
	{
		return find_duplicates(db, payload.tipo, payload.excluir_sacramento_id, payload.personas);
	},
};
