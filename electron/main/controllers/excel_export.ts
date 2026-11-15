import type { Baptism, Marriage, Minister, Person, SacramentRecord } from '../../../shared/models';
import { short_date } from '../../../shared/partial_date';
import { field_label } from '../../../shared/record_fields';
import { HISTORY_EVENT_LABELS, type SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { read_history } from '../models/history';
import { read_record } from '../models/record';
import { full_name } from '../utils/helpers';
import type { Cell, Sheet } from '../utils/xlsx';

const SACRAMENT_NAMES: Record<SacramentType, string> = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' };

function local_date(in_iso: string | null | undefined): string
{
	return in_iso ? new Date(in_iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}

function local_date_time(in_iso: string): string
{
	return new Date(in_iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function minister_name(in_minister: Minister | null | undefined): string
{
	if (!in_minister)
		return '';

	return [in_minister.titulo, in_minister.nombre, in_minister.apellido_paterno, in_minister.apellido_materno].filter(Boolean).join(' ');
}

function person_name(in_person: Person): string
{
	return full_name(in_person.nombres, in_person.apellido_paterno, in_person.apellido_materno);
}

function birth(in_person: Person): string
{
	return short_date(in_person.fecha_nacimiento) || (in_person.fecha_aproximada ?? '');
}

function person_cells(in_person: Person): Cell[]
{
	return [in_person.dni, in_person.nombres, in_person.apellido_paterno, in_person.apellido_materno, birth(in_person), in_person.lugar_nacimiento, in_person.padre, in_person.madre];
}

function person_titles(in_who: string): string[]
{
	return ['DNI', 'Nombres', 'Apellido paterno', 'Apellido materno', 'Fecha de nacimiento', 'Lugar de nacimiento', 'Padre', 'Madre'].map((title) => `${title}${in_who}`);
}

const START_TITLES = ['Libro', 'Folio', 'Número'];
const END_TITLES = ['Celebrante', 'Anotación marginal', 'Estado', 'Fecha de registro'];

function start_cells(in_record: SacramentRecord): Cell[]
{
	const sacrament = in_record.sacramento;
	return [sacrament.libro, sacrament.folio, sacrament.numero];
}

function end_cells(in_record: SacramentRecord): Cell[]
{
	const sacrament = in_record.sacramento;
	return [minister_name(sacrament.ministro), sacrament.anotaciones, sacrament.estado === 'anulado' ? 'Anulada' : 'Vigente', local_date(sacrament.created_at)];
}

function baptism_sheet(in_type: 'bautismo' | 'confirmacion', in_records: Baptism[]): Sheet
{
	const date_title = `Fecha de ${SACRAMENT_NAMES[in_type].toLowerCase()}`;
	const titles = [...START_TITLES, ...person_titles(''), date_title, 'Padrino', 'Madrina', ...END_TITLES];

	const rows = in_records.map((record) => [
		...start_cells(record),
		...person_cells(record.persona),
		short_date(record.sacramento.fecha_evento),
		record.padrino_1,
		record.padrino_2,
		...end_cells(record),
	]);

	return { name: in_type === 'bautismo' ? 'Bautismos' : 'Confirmaciones', rows: [titles, ...rows] };
}

function marriage_sheet(in_records: Marriage[]): Sheet
{
	const titles = [
		...START_TITLES,
		...person_titles(' del esposo'),
		'Parroquia de bautismo del esposo',
		'Fecha de bautismo del esposo',
		...person_titles(' de la esposa'),
		'Parroquia de bautismo de la esposa',
		'Fecha de bautismo de la esposa',
		'Fecha de matrimonio',
		'Lugar del matrimonio',
		'Testigo 1',
		'Testigo 2',
		'Testigo 3',
		'Testigo 4',
		...END_TITLES,
	];

	const rows = in_records.map((record) => [
		...start_cells(record),
		...person_cells(record.conyuge_1),
		record.conyuge_1_bautismo_parroquia,
		short_date(record.conyuge_1_bautismo_fecha),
		...person_cells(record.conyuge_2),
		record.conyuge_2_bautismo_parroquia,
		short_date(record.conyuge_2_bautismo_fecha),
		short_date(record.sacramento.fecha_evento),
		record.lugar,
		record.testigo_1,
		record.testigo_2,
		record.testigo_3,
		record.testigo_4,
		...end_cells(record),
	]);

	return { name: 'Matrimonios', rows: [titles, ...rows] };
}

function record_name(in_record: SacramentRecord): string
{
	if (in_record.sacramento.tipo === 'matrimonio')
	{
		const marriage = in_record as Marriage;
		return `${person_name(marriage.conyuge_1)} y ${person_name(marriage.conyuge_2)}`;
	}

	return person_name((in_record as Baptism).persona);
}

function history_sheet(in_db: LocalDatabase, in_records: SacramentRecord[]): Sheet
{
	const titles = ['Fecha', 'Sacramento', 'Libro', 'Folio', 'Número', 'Partida de', 'Qué se hizo', 'Usuario', 'Motivo', 'Datos cambiados'];
	const rows: { fecha: string; cells: Cell[] }[] = [];

	for (const record of in_records)
	{
		for (const entry of read_history(in_db, record.sacramento.id as number))
		{
			const changes = entry.campos.map((field) => `${field_label(field.parte, field.campo)}: ${field.texto_anterior ?? '(vacío)'} → ${field.texto_nuevo ?? '(vacío)'}`);
			rows.push({
				fecha: entry.fecha,
				cells: [
					local_date_time(entry.fecha),
					SACRAMENT_NAMES[record.sacramento.tipo],
					...start_cells(record),
					record_name(record),
					HISTORY_EVENT_LABELS[entry.evento],
					entry.usuario,
					entry.motivo,
					changes.join('\n'),
				],
			});
		}
	}

	// Lo más reciente primero, como en la ventana de historial.
	rows.sort((first, second) => second.fecha.localeCompare(first.fecha));
	return { name: 'Historial', rows: [titles, ...rows.map((row) => row.cells)] };
}

function parish_records(in_db: LocalDatabase, in_parish_id: number, in_type: SacramentType): SacramentRecord[]
{
	// Ordenadas como en el libro: por número de libro, folio y registro (los que no son números, al final).
	const ids = in_db
		.prepare(
			`SELECT id FROM sacramentos
			 WHERE parroquia_id = ? AND tipo = ?
			 ORDER BY CAST(libro AS INTEGER), libro, CAST(folio AS INTEGER), folio, CAST(numero AS INTEGER), numero`,
		)
		.pluck()
		.all(in_parish_id, in_type) as number[];

	return ids.map((id) => read_record(in_db, id));
}

export function parish_workbook(in_db: LocalDatabase, in_parish_id: number): Sheet[]
{
	const baptisms = parish_records(in_db, in_parish_id, 'bautismo') as Baptism[];
	const confirmations = parish_records(in_db, in_parish_id, 'confirmacion') as Baptism[];
	const marriages = parish_records(in_db, in_parish_id, 'matrimonio') as Marriage[];

	return [
		baptism_sheet('bautismo', baptisms),
		baptism_sheet('confirmacion', confirmations),
		marriage_sheet(marriages),
		history_sheet(in_db, [...baptisms, ...confirmations, ...marriages]),
	];
}
