import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { PEOPLE_OF_ALL_SACRAMENTS } from '../models/sacrament';
import { positive_id } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

const SACRAMENTS: SacramentType[] = ['bautismo', 'confirmacion', 'matrimonio'];
const TREND_YEARS = 10;
const TOP_MINISTERS = 8;

const EVENT_DATE = 'COALESCE(s.fecha_evento, s.fecha_emision)';

const HAS_YEAR = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]*'`;
const HAS_MONTH = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'`;
const HAS_FULL_DATE = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`;

export const AGE_BANDS =
[
	{ label: 'Menos de 1 año', to: 0 },
	{ label: '1 a 6 años', to: 6 },
	{ label: '7 a 12 años', to: 12 },
	{ label: '13 a 17 años', to: 17 },
	{ label: '18 a 29 años', to: 29 },
	{ label: '30 a 49 años', to: 49 },
	{ label: '50 años o más', to: Infinity },
];

type BySacrament = Record<SacramentType, number>;

function zero_counts(): BySacrament
{
	return { bautismo: 0, confirmacion: 0, matrimonio: 0 };
}

function two_digits(value: number): string
{
	return String(value).padStart(2, '0');
}

const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/;

function had_birthday_by(birth: RegExpExecArray, event: RegExpExecArray): boolean | null
{
	const [, , birth_month, birth_day] = birth;
	const [, , event_month, event_day] = event;

	if (!birth_month || !event_month)
		return null;

	if (event_month !== birth_month)
		return event_month > birth_month;

	if (!birth_day || !event_day)
		return null;

	return event_day >= birth_day;
}

export function age_at(birth_date: string | null, event_date: string): number | null
{
	const birth = PARTIAL_DATE.exec(birth_date ?? '');
	const event = PARTIAL_DATE.exec(event_date);
	if (!birth || !event || birth[0] !== birth_date)
		return null;

	const had_birthday = had_birthday_by(birth, event);
	if (had_birthday === null)
		return null;

	let age = Number(event[1]) - Number(birth[1]);
	if (!had_birthday)
		age -= 1;

	if (age < 0 || age > 130)
		return null;

	return age;
}

export function get_statistics(db: LocalDatabase, parish_id: number, requested_year: unknown, now: Date = new Date())
{
	const current_year = now.getFullYear();
	const current_month = two_digits(now.getMonth() + 1);
	const today = `${current_month}-${two_digits(now.getDate())}`;

	const years_with_records = db
		.prepare(
			`SELECT DISTINCT CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS year
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR}`,
		)
		.pluck()
		.all(parish_id) as number[];

	const years = [...new Set([...years_with_records, current_year])].sort((a, b) => b - a);

	let year = current_year;
	if (years.includes(requested_year as number))
		year = requested_year as number;

	const is_current_year = year === current_year;

	const count_where = (condition: string, ...values: string[]): BySacrament =>
	{
		const counts = zero_counts();
		const rows = db
			.prepare(
				`SELECT s.tipo, COUNT(*) AS total
				 FROM sacramentos s
				 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${condition}
				 GROUP BY s.tipo`,
			)
			.all(parish_id, ...values) as { tipo: SacramentType; total: number }[];

		for (const row of rows)
			counts[row.tipo] = row.total;

		return counts;
	};

	const in_year = `${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`;

	const previous_year = is_current_year
		? count_where(`${HAS_FULL_DATE} AND substr(${EVENT_DATE}, 1, 10) BETWEEN ? AND ?`, `${year - 1}-01-01`, `${year - 1}-${today}`)
		: count_where(in_year, String(year - 1));

	const selected_year = count_where(in_year, String(year));
	const this_month = count_where(`substr(${EVENT_DATE}, 1, 7) = ?`, `${current_year}-${current_month}`);
	const all_time = count_where(HAS_YEAR);

	const totals = {} as Record<SacramentType, { anio: number; anterior: number; mes: number; historico: number }>;
	for (const type of SACRAMENTS)
		totals[type] = { anio: selected_year[type], anterior: previous_year[type], mes: this_month[type], historico: all_time[type] };

	const monthly: ({ mes: number } & BySacrament)[] = [];
	for (let month = 1; month <= 12; month++)
		monthly.push({ mes: month, ...zero_counts() });

	const month_rows = db
		.prepare(
			`SELECT s.tipo, CAST(substr(${EVENT_DATE}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_MONTH} AND substr(${EVENT_DATE}, 1, 4) = ?
			 GROUP BY s.tipo, mes`,
		)
		.all(parish_id, String(year)) as { tipo: SacramentType; mes: number; total: number }[];

	for (const row of month_rows)
	{
		if (monthly[row.mes - 1])
			monthly[row.mes - 1][row.tipo] = row.total;
	}

	const first_year = Math.max(Math.min(...years), year - TREND_YEARS + 1);
	const trend: ({ anio: number } & BySacrament)[] = [];
	for (let trend_year = first_year; trend_year <= year; trend_year++)
		trend.push({ anio: trend_year, ...zero_counts() });

	const trend_rows = db
		.prepare(
			`SELECT s.tipo, CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR}
			 GROUP BY s.tipo, anio`,
		)
		.all(parish_id) as { tipo: SacramentType; anio: number; total: number }[];

	for (const row of trend_rows)
	{
		const point = trend.find((item) => item.anio === row.anio);
		if (point)
			point[row.tipo] = row.total;
	}

	const people = db
		.prepare(
			`SELECT s.tipo, ${EVENT_DATE} AS fecha, pe.fecha_nacimiento, pe.edad
			 FROM (${PEOPLE_OF_ALL_SACRAMENTS}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`,
		)
		.all(parish_id, String(year)) as { tipo: SacramentType; fecha: string; fecha_nacimiento: string | null; edad: number | null }[];

	const ages = {} as Record<SacramentType, { bandas: number[]; sinDato: number; promedio: number | null }>;

	for (const type of SACRAMENTS)
	{
		const bands = AGE_BANDS.map(() => 0);
		let age_sum = 0;
		let with_age = 0;
		let without_age = 0;

		for (const person of people)
		{
			if (person.tipo !== type)
				continue;

			const age = age_at(person.fecha_nacimiento, person.fecha) ?? person.edad;
			if (age === null)
			{
				without_age += 1;
				continue;
			}

			const band = AGE_BANDS.findIndex((item) => age <= item.to);
			bands[band] += 1;
			age_sum += age;
			with_age += 1;
		}

		let average: number | null = null;
		if (with_age > 0)
			average = Math.round((age_sum / with_age) * 10) / 10; // con un decimal

		ages[type] = { bandas: bands, sinDato: without_age, promedio: average };
	}

	const ministers = db
		.prepare(
			`SELECT min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS nombre, COUNT(*) AS total
			 FROM sacramentos s
			 JOIN ministros min ON min.id = s.ministro_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?
			 GROUP BY min.id
			 ORDER BY total DESC, nombre
			 LIMIT ?`,
		)
		.all(parish_id, String(year), TOP_MINISTERS) as { nombre: string; total: number }[];

	const register = db
		.prepare(
			`SELECT
				COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
				COALESCE(SUM(s.estado = 'vigente' AND s.ministro_id IS NULL), 0) AS sinCelebrante,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id)), 0) AS conCorrecciones
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`,
		)
		.get(parish_id, String(year)) as { anuladas: number; sinCelebrante: number; conCorrecciones: number };

	return {
		anios: years,
		anio: year,
		esAnioActual: is_current_year,
		totales: totals,
		mensual: monthly,
		tendencia: trend,
		bandasEdad: AGE_BANDS.map((band) => band.label),
		edades: ages,
		ministros: ministers,
		registro: register,
	};
}

export const statistics_routes: Routes =
{
	'statistics.get': (payload: { parroquia_id: unknown; anio: unknown }, { db }) =>
	{
		return get_statistics(db, positive_id(payload.parroquia_id), payload.anio);
	},
};
