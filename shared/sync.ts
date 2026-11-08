export type Role = 'admin_general' | 'admin_parroquia' | 'usuario';

export const ROLES: readonly Role[] = ['admin_general', 'admin_parroquia', 'usuario'];

export type SacramentType = 'bautismo' | 'confirmacion' | 'matrimonio';

export type SyncEntity = SacramentType | 'ministro' | 'usuario';

export type CorrectionState = 'pendiente' | 'aprobado' | 'rechazado';

export type RequestType = 'digitacion' | 'nota_marginal';

export type RequestState = 'pendiente' | 'aprobado' | 'rechazado' | 'descartado';

export const HISTORY_EVENTS = [
	'registrada',
	'importada',
	'editada',
	'correccion',
	'cambio_pedido',
	'cambio_aprobado',
	'cambio_rechazado',
	'cambio_descartado',
	'anulada',
] as const;

export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export interface PersonData
{
	client_id: string;
	dni: string | null;
	nombres: string;
	apellido_paterno: string;
	apellido_materno: string;
	fecha_nacimiento: string | null;
	fecha_aproximada: string | null;
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
	estado: CorrectionState;
	revisado_por_usuario_id: number | null;
	revisado_en: string | null;
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
	solicitudes: ChangeRequestData[];
	historial: HistoryData[];
}


export interface ChangeRequestData
{
	client_id: string;
	usuario_id: number;
	parte: string;
	campo: string;
	tipo: RequestType;
	valor_anterior: string | null;
	valor_nuevo: string | null;
	estado: RequestState;
	motivo: string | null;
	revisado_por_usuario_id: number | null;
	revisado_en: string | null;
	creado_en: string;
}

export interface HistoryFieldData
{
	parte: string;
	campo: string;
	valor_anterior: string | null;
	valor_nuevo: string | null;
}

export interface HistoryData
{
	client_id: string;
	usuario_id: number;
	evento: HistoryEvent;
	motivo: string | null;
	fecha: string;
	campos: HistoryFieldData[];
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
	datos: RecordData | MinisterData | UserData;
}

export interface UserData
{
	client_id: string;
	id?: number;
	parroquia_id: number | null;
	username: string;
	rol: Role;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo: number;
	principal?: number;
	password_hash?: string | null;
	version?: number;
	updated_at?: string;
}

export type ChangeResult =
	| { entidad: SyncEntity; client_id: string; estado: 'aplicado'; version: number; id?: number }
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
