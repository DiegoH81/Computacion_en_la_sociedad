// Formas de los datos que viajan entre las PCs y el Worker.
// Los campos se llaman igual que las columnas de la base (en español) porque la app ya los usa.

export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';
export type EntityType = SacramentType | 'ministro';

// Una persona tal como aparece en una partida (bautizado, confirmado o cónyuge).
export interface PersonData
{
	client_id: string;
	dni: string | null;
	nombres: string;
	apellido_paterno: string;
	apellido_materno: string;
	fecha_nacimiento: string | null;
	edad: number | null;
	lugar_nacimiento: string | null;
	padre: string | null;
	madre: string | null;
}

// Una corrección hecha a los datos de una persona. Queda en la tabla cambios_persona.
export interface PersonCorrection
{
	client_id: string;
	persona_client_id: string;
	usuario_id: number;
	campo_cambio: string;
	valor_anterior: string | null;
	valor_nuevo: string | null;
	fecha_cambio: string;
}

// Una partida completa: la fila de "sacramentos", sus personas, los datos propios
// de su tipo (padrinos, testigos...) y sus correcciones.
export interface RecordData
{
	tipo: SacramentType;
	client_id: string;
	parroquia_id: number;
	ministro_client_id: string | null;
	libro: string;
	folio: string;
	numero: string;
	fecha_emision: string;
	fecha_evento: string | null;
	anotaciones: string | null;
	estado: 'vigente' | 'anulado';
	anulado_por_usuario_id: number | null;
	anulado_en: string | null;
	motivo_anulacion: string | null;
	version?: number;
	created_at?: string;
	updated_at?: string;
	personas: PersonData[];
	detalle: Record<string, string | null>;
	cambios: PersonCorrection[];
}

export interface MinisterData
{
	client_id: string;
	parroquia_id: number;
	titulo: string | null;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo: number;
	version?: number;
	updated_at?: string;
}

// Un cambio que una PC sube con POST /api/sync/push.
//   version_base: la versión que la PC tenía cuando hizo el cambio (null si el registro es nuevo).
//   cola_id: id de la fila en la cola de la PC; sirve para reconocer un reenvío.
export interface IncomingChange
{
	entidad: EntityType;
	client_id: string;
	version_base: number | null;
	cola_id: string;
	datos: RecordData | MinisterData;
}

// Lo que responde el Worker por cada cambio.
export type ChangeResult =
	| { entidad: EntityType; client_id: string; estado: 'aplicado'; version: number }
	| { entidad: EntityType; client_id: string; estado: 'conflicto'; version: number; motivo: string }
	| { entidad: EntityType; client_id: string; estado: 'rechazado'; motivo: string };

// Cómo se guarda cada partida en la base:
//
//   sacramentos      una fila por partida, con lo común (libro, folio, número, fechas, estado...)
//   bautismos        sacramento_id, persona_id, padrino_1, padrino_2
//   confirmaciones   sacramento_id, persona_id, padrino_1, padrino_2
//   matrimonios      sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigos y datos de bautismo
//   personas         una fila por cada persona de cada partida
//
// En el JSON, "detalle" lleva las columnas propias del tipo (todas son texto).

export const PERSON_FIELDS = ['dni', 'nombres', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'edad', 'lugar_nacimiento', 'padre', 'madre'] as const;

export const GODPARENT_COLUMNS = ['padrino_1', 'padrino_2'];

export const MARRIAGE_COLUMNS =
[
	'lugar',
	'testigo_1',
	'testigo_2',
	'testigo_3',
	'testigo_4',
	'conyuge_1_bautismo_parroquia',
	'conyuge_1_bautismo_fecha',
	'conyuge_2_bautismo_parroquia',
	'conyuge_2_bautismo_fecha',
];

export function detail_columns(type: SacramentType): string[]
{
	if (type === 'matrimonio')
		return MARRIAGE_COLUMNS;

	return GODPARENT_COLUMNS;
}

// Un matrimonio tiene dos personas; el bautismo y la confirmación, una.
export function people_count(type: SacramentType): number
{
	if (type === 'matrimonio')
		return 2;

	return 1;
}
