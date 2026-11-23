export type Role = 'admin_general' | 'admin_parroquia' | 'usuario';

export const ROLES: readonly Role[] = ['admin_general', 'admin_parroquia', 'usuario'];

/** El rol de una cuenta dentro de una parroquia (el admin_general no pertenece a ninguna). */
export type ParishRole = Exclude<Role, 'admin_general'>;

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
	'rehabilitada',
] as const;

export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export type StaffEntity = 'ministro' | 'usuario';

export const STAFF_EVENTS = [
	'creado',
	'editado',
	'contrasena',
	'deshabilitado',
	'habilitado',
	'principal',
	'parroquia_agregada',
	'parroquia_quitada',
] as const;

export type StaffEvent = (typeof STAFF_EVENTS)[number];

export const STAFF_EVENT_LABELS: Record<StaffEntity, Partial<Record<StaffEvent, string>>> =
{
	ministro: {
		creado: 'Registró al ministro',
		editado: 'Editó al ministro',
		deshabilitado: 'Deshabilitó al ministro',
		habilitado: 'Habilitó al ministro',
	},
	usuario: {
		creado: 'Creó la cuenta',
		editado: 'Editó la cuenta',
		contrasena: 'Cambió la contraseña',
		deshabilitado: 'Deshabilitó la cuenta',
		habilitado: 'Habilitó la cuenta',
		principal: 'Pasó la marca de principal',
		parroquia_agregada: 'Agregó la cuenta a la parroquia',
		parroquia_quitada: 'Quitó la cuenta de la parroquia',
	},
};

export interface StaffHistoryData
{
	client_id: string;
	parroquia_id: number | null;
	entidad: StaffEntity;
	entidad_client_id: string;
	usuario_client_id: string | null;
	evento: StaffEvent;
	detalle: string | null;
	fecha: string;
}

export const HISTORY_EVENT_LABELS: Record<HistoryEvent, string> =
{
	registrada: 'Registró la partida',
	importada: 'Importó la partida',
	editada: 'Editó la partida',
	correccion: 'Corrigió por nota marginal',
	cambio_pedido: 'Pidió un cambio',
	cambio_aprobado: 'Aprobó el cambio',
	cambio_rechazado: 'Rechazó el cambio',
	cambio_descartado: 'Descartó el cambio',
	anulada: 'Anuló la partida',
	rehabilitada: 'Rehabilitó la partida',
};

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
	fecha_emision: string | null;
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
	historial?: StaffHistoryData[];
}

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
	historial?: StaffHistoryData[];
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

export interface MembershipData
{
	usuario_id: number;
	parroquia_id: number;
	rol: ParishRole;
	principal: number;
}

export interface UserParish
{
	id: number;
	nombre: string;
	rol: ParishRole;
}

// POST /api/auth/login
// rol y parroquia_id
export interface LoginResponse
{
	token: string;
	usuario: {
		id: number;
		nombre_completo: string;
		rol: Role;
		parroquia_id: number | null;
		parroquia_nombre: string | null;
		parroquias: UserParish[];
	};
}
