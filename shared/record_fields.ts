import type { Baptism, Marriage, NameColumn, Person, Sacrament, SacramentRecord } from './models';
import type { SacramentType } from './sync';

export type RecordPart = 'sacramento' | 'persona' | 'conyuge_1' | 'conyuge_2' | 'detalle';

export interface FieldInfo
{
	campo: string;
	label: string;
}

export interface FieldChange
{
	parte: RecordPart;
	campo: string;
	valor_anterior: string | null;
	valor_nuevo: string | null;
}

export const NOTES_MAX_LENGTH = 350;

export const SACRAMENT_FIELDS: readonly FieldInfo[] =
[
	{ campo: 'libro', label: 'Libro' },
	{ campo: 'folio', label: 'Folio' },
	{ campo: 'numero', label: 'Número' },
	{ campo: 'fecha_emision', label: 'Fecha de registro' },
	{ campo: 'fecha_evento', label: 'Fecha del sacramento' },
	{ campo: 'ministro_id', label: 'Celebrante' },
	{ campo: 'anotaciones', label: 'Nota marginal' },
];

export const PERSON_FIELDS =
[
	{ campo: 'dni', label: 'DNI' },
	{ campo: 'nombres', label: 'Nombres' },
	{ campo: 'apellido_paterno', label: 'Apellido paterno' },
	{ campo: 'apellido_materno', label: 'Apellido materno' },
	{ campo: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
	{ campo: 'fecha_aproximada', label: 'Fecha de nacimiento aproximada' },
	{ campo: 'lugar_nacimiento', label: 'Lugar de nacimiento' },
	{ campo: 'padre', label: 'Padre' },
	{ campo: 'madre', label: 'Madre' },
] as const satisfies readonly FieldInfo[];

export type PersonColumn = (typeof PERSON_FIELDS)[number]['campo'];

// Bautismo y confirmación.
export const BAPTISM_FIELDS: readonly FieldInfo[] =
[
	{ campo: 'padrino_1', label: 'Padrino' },
	{ campo: 'padrino_2', label: 'Madrina' },
];

export const MARRIAGE_FIELDS: readonly FieldInfo[] =
[
	{ campo: 'lugar', label: 'Lugar del matrimonio' },
	{ campo: 'testigo_1', label: 'Testigo 1' },
	{ campo: 'testigo_2', label: 'Testigo 2' },
	{ campo: 'testigo_3', label: 'Testigo 3' },
	{ campo: 'testigo_4', label: 'Testigo 4' },
	{ campo: 'conyuge_1_bautismo_parroquia', label: 'Parroquia de bautismo del esposo' },
	{ campo: 'conyuge_1_bautismo_fecha', label: 'Fecha de bautismo del esposo' },
	{ campo: 'conyuge_2_bautismo_parroquia', label: 'Parroquia de bautismo de la esposa' },
	{ campo: 'conyuge_2_bautismo_fecha', label: 'Fecha de bautismo de la esposa' },
];

export const PERSON_COLUMNS: readonly PersonColumn[] = PERSON_FIELDS.map((field) => field.campo);

export function detail_fields(in_type: SacramentType): readonly FieldInfo[]
{
	if (in_type === 'matrimonio')
		return MARRIAGE_FIELDS;

	return BAPTISM_FIELDS;
}

export function detail_columns(in_type: SacramentType): string[]
{
	return detail_fields(in_type).map((field) => field.campo);
}

export function person_parts(in_type: SacramentType): RecordPart[]
{
	if (in_type === 'matrimonio')
		return ['conyuge_1', 'conyuge_2'];

	return ['persona'];
}

export function fields_of(in_part: RecordPart, in_type: SacramentType): readonly FieldInfo[]
{
	if (in_part === 'sacramento')
		return SACRAMENT_FIELDS;

	if (in_part === 'detalle')
		return detail_fields(in_type);

	return PERSON_FIELDS;
}

export function is_known_field(in_type: SacramentType, in_part: unknown, in_field: unknown): boolean
{
	const parts: RecordPart[] = ['sacramento', 'detalle', ...person_parts(in_type)];
	if (!parts.includes(in_part as RecordPart))
		return false;

	return fields_of(in_part as RecordPart, in_type).some((field) => field.campo === in_field);
}

export function field_label(in_part: RecordPart, in_field: string): string
{
	const all = [...SACRAMENT_FIELDS, ...PERSON_FIELDS, ...BAPTISM_FIELDS, ...MARRIAGE_FIELDS];
	const label = all.find((field) => field.campo === in_field)?.label ?? in_field;

	if (in_part === 'conyuge_1')
		return `${label} del esposo`;

	if (in_part === 'conyuge_2')
		return `${label} de la esposa`;

	return label;
}


type FieldValue = string | number | null | undefined;

function part_object(in_record: SacramentRecord, in_part: RecordPart): Record<string, FieldValue>
{
	if (in_part === 'sacramento')
		return in_record.sacramento as unknown as Record<string, FieldValue>;

	if (in_part === 'persona')
		return (in_record as Baptism).persona as unknown as Record<string, FieldValue>;

	if (in_part === 'conyuge_1' || in_part === 'conyuge_2')
		return (in_record as Marriage)[in_part] as unknown as Record<string, FieldValue>;

	return in_record as unknown as Record<string, FieldValue>;
}

export function person_at(in_record: SacramentRecord, in_part: RecordPart): Person
{
	return part_object(in_record, in_part) as unknown as Person;
}

export function field_text(in_value: FieldValue): string | null
{
	if (in_value === null || in_value === undefined)
		return null;

	const text = String(in_value).trim();
	return text === '' ? null : text;
}

export function get_field(in_record: SacramentRecord, in_part: RecordPart, in_field: string): string | null
{
	return field_text(part_object(in_record, in_part)?.[in_field]);
}

export function set_field(in_record: SacramentRecord, in_part: RecordPart, in_field: string, in_value: string | null): SacramentRecord
{
	const value: FieldValue = in_field === 'ministro_id' && in_value !== null ? Number(in_value) : in_value;

	if (in_part === 'detalle')
		return { ...in_record, [in_field]: value } as SacramentRecord;

	if (in_part === 'sacramento')
		return { ...in_record, sacramento: { ...in_record.sacramento, [in_field]: value } as Sacrament };

	const person = part_object(in_record, in_part) as unknown as Person;
	return { ...in_record, [in_part]: { ...person, [in_field]: value } } as SacramentRecord;
}

export function changed_fields(in_saved: SacramentRecord, in_new: SacramentRecord): FieldChange[]
{
	const out_changes: FieldChange[] = [];
	const type = in_saved.sacramento.tipo;
	const parts: RecordPart[] = ['sacramento', ...person_parts(type), 'detalle'];

	for (const part of parts)
	{
		for (const field of fields_of(part, type))
		{
			const old_value = get_field(in_saved, part, field.campo);
			const new_value = get_field(in_new, part, field.campo);
			if (old_value !== new_value)
				out_changes.push({ parte: part, campo: field.campo, valor_anterior: old_value, valor_nuevo: new_value });

		}
	}

	return out_changes;
}

export function corrected_value(in_person: Person, in_column: NameColumn): string
{
	const saved = (in_person.cambios ?? []).filter((change) => change.id !== undefined && change.campo_cambio === in_column && (change.estado === undefined || change.estado === 'aprobado'));
	if (saved.length === 0)
		return in_person[in_column];

	const latest = saved.reduce((last, change) => ((change.id as number) > (last.id as number) ? change : last));
	return latest.valor_nuevo ?? in_person[in_column];
}
