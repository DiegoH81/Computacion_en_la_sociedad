export type Role = 'admin' | 'usuario_parroquia';

export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';

export type SyncEntity = SacramentType | 'ministro';

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

// Changes using POST
export interface SyncChange
{
	entidad: SyncEntity;
	client_id: string;
	version_base: number | null;
	cola_id: string;
	datos: RecordData | MinisterData;
}

export type ChangeResult =
	| { entidad: SyncEntity; client_id: string; estado: 'aplicado'; version: number }
	| { entidad: SyncEntity; client_id: string; estado: 'conflicto'; version: number; motivo: string }
	| { entidad: SyncEntity; client_id: string; estado: 'rechazado'; motivo: string };


// GET /api/sync/pull?cursor=N
export interface PullPage
{
	partidas: RecordData[];
	cursor: number;
	hayMas: boolean;
}

// POST /api/auth/login
export interface LoginResponse
{
	token: string;
	usuario: { id: number; nombre_completo: string; rol: Role; parroquia_id: number | null; parroquia_nombre: string | null };
}
