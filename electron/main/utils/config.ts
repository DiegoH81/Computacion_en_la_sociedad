export const REQUEST_TIMEOUT_MS = 30_000;
export const LOGIN_TIMEOUT_MS = 10_000;


export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const QUIT_SYNC_LIMIT_MS = 5_000;

export const PUSH_BATCH_SIZE = 15;

export const SYNC_KEYS =
{
	cursor: 'cursor',
	last_sync: 'ultima_sync',
	notice: 'aviso',
	key_registered: 'clave_registrada',
	staff_history_cursor: 'cursor_historial',
	data_version: 'version_datos',
} as const;

// Subirlo solo cuando un instalador trae datos incompatibles con los de antes (otro paquete
// inicial, otros ids de usuario). Al abrir, una base con un número menor se borra y se vuelve
// a cargar el paquete inicial. OJO: se pierden los cambios sin subir de esa PC.
export const DATA_VERSION = 1;



// UI VIEW
export const PAGE_SIZE = 20;
export const MAX_LOGO_LENGTH = 400_000;

export const FILE_NAMES =
{
	database: 'prelatura-local.db',
	key: 'prelatura-local.key',
	device: 'prelatura-dispositivo.id',
	temp_database: 'prelatura-reconstruccion.db',
	temp_key: 'prelatura-reconstruccion.key',
	set_aside_folder: 'bases-apartadas',
	logos_folder: 'logos',
	backup_log: 'registro-respaldos.json',
} as const;

export const SET_ASIDE_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 1 month
