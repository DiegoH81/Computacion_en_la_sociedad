import { dialog } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { close_database, database_paths, get_database, KEY_STORE, use_database } from '../db/app_database';
import { create_temp_database, install_temp_database, open_local_database, type KeyStore, type LocalDatabase, type LocalPaths } from '../db/database';
import { LOCAL_MIGRATIONS } from '../db/migrations';
import type { Session } from '../models/session';
import { wait_for_sync } from '../sync/auto_sync';
import { FILE_NAMES, SYNC_KEYS } from '../utils/config';
import { decrypt_with_password, encrypt_with_password, type PasswordEncrypted } from '../utils/crypto';
import { ServiceError } from '../utils/errors';
import { full_name } from '../utils/helpers';
import { build_xlsx } from '../utils/xlsx';
import { parish_workbook } from './excel_export';
import type { PublicRoutes, Routes } from '../utils/middleware';
import type { BackupLogEntry } from '../../../shared/models';
import { logout } from './login';
import { needs_package, parent_window } from './package';

export const BACKUP_FORMAT = 'prelatura-respaldo';
export const BACKUP_VERSION = 1;
export const BACKUP_PASSWORD_MIN_LENGTH = 8;

const BACKUP_EXTENSION = 'respaldo';
const LOGO_FILE = /^parroquia-\d+\.txt$/;
const WRONG_PASSWORD = 'La contraseña no es la del respaldo, o el archivo está dañado.';
const NOT_A_BACKUP = 'El archivo no es un respaldo de esta aplicación.';

export interface BackupContent
{
	version_base: number; // cuántas migraciones tenía la base (user_version)
	tablas: Record<string, { columnas: string[]; filas: unknown[][] }>;
	logos: Record<string, string>; // los logos de las parroquias: nombre del archivo y contenido
}

const LOG_MAX_ENTRIES = 200;

function table_names(db: LocalDatabase): string[]
{
	return db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).pluck().all() as string[];
}

function logos_folder(directory: string): string
{
	return path.join(directory, FILE_NAMES.logos_folder);
}

export function build_backup(db: LocalDatabase, directory: string): BackupContent
{
	const tables: BackupContent['tablas'] = {};
	for (const name of table_names(db))
	{
		const select = db.prepare(`SELECT * FROM "${name}"`).raw();
		tables[name] = { columnas: select.columns().map((column) => column.name), filas: select.all() as unknown[][] };
	}

	const logos: BackupContent['logos'] = {};
	const folder = logos_folder(directory);
	if (existsSync(folder))
	{
		for (const name of readdirSync(folder).filter((file) => LOGO_FILE.test(file)))
			logos[name] = readFileSync(path.join(folder, name), 'utf8');
	}

	return { version_base: db.pragma('user_version', { simple: true }) as number, tablas: tables, logos: logos };
}

export async function encode_backup(content: BackupContent, password: string): Promise<string>
{
	const encrypted = await encrypt_with_password(password, gzipSync(JSON.stringify(content)));
	return JSON.stringify({ formato: BACKUP_FORMAT, version: BACKUP_VERSION, creado_en: new Date().toISOString(), ...encrypted });
}

export async function decode_backup(text: string, password: string): Promise<BackupContent>
{
	let file: Partial<PasswordEncrypted> & { formato?: unknown; version?: unknown };
	try
	{
		file = JSON.parse(text);
	}
	catch
	{
		throw new ServiceError(NOT_A_BACKUP, 400);
	}

	if (file?.formato !== BACKUP_FORMAT || !file.sal || !file.iv || !file.etiqueta || !file.datos)
		throw new ServiceError(NOT_A_BACKUP, 400);

	if (file.version !== BACKUP_VERSION)
		throw new ServiceError('El respaldo es de otra versión de la aplicación.', 400);

	const data = await decrypt_with_password(password, file as PasswordEncrypted);
	if (!data)
		throw new ServiceError(WRONG_PASSWORD, 400);

	const content = JSON.parse(gunzipSync(data).toString('utf8')) as BackupContent;
	if (!Number.isInteger(content?.version_base) || content.version_base < 1 || typeof content.tablas !== 'object' || typeof content.logos !== 'object')
		throw new ServiceError(NOT_A_BACKUP, 400);

	return content;
}

function load_tables(db: LocalDatabase, content: BackupContent): void
{
	const known = table_names(db);
	for (const name of Object.keys(content.tablas))
	{
		if (!known.includes(name))
			throw new ServiceError(NOT_A_BACKUP, 400);
	}

	const load = db.transaction(() =>
	{
		for (const name of known)
			db.prepare(`DELETE FROM "${name}"`).run();

		for (const [name, table] of Object.entries(content.tablas))
		{
			const columns = (db.pragma(`table_info("${name}")`) as { name: string }[]).map((column) => column.name);
			if (!table.columnas.every((column) => columns.includes(column)))
				throw new ServiceError(NOT_A_BACKUP, 400);

			const names = table.columnas.map((column) => `"${column}"`).join(', ');
			const marks = table.columnas.map(() => '?').join(', ');
			const insert = db.prepare(`INSERT INTO "${name}" (${names}) VALUES (${marks})`);

			for (const row of table.filas)
				insert.run(row);
		}

		db.prepare('DELETE FROM sync_estado WHERE clave = ?').run(SYNC_KEYS.key_registered);

		if ((db.pragma('foreign_key_check') as unknown[]).length > 0)
			throw new ServiceError('El respaldo está incompleto: hay datos que apuntan a registros que no están.', 400);
	});

	db.pragma('foreign_keys = OFF');
	try
	{
		load();
	}
	finally
	{
		db.pragma('foreign_keys = ON');
	}
}

export function prepare_restore(paths: LocalPaths, keys: KeyStore, content: BackupContent): string
{
	if (content.version_base > LOCAL_MIGRATIONS.length)
		throw new ServiceError('El respaldo es de una versión más nueva de la aplicación. Actualícela antes de restaurarlo.', 400);

	const temp = create_temp_database(paths, keys, LOCAL_MIGRATIONS.slice(0, content.version_base));
	try
	{
		load_tables(temp.db, content);
	}
	finally
	{
		temp.db.close();
	}

	open_local_database(paths.temp_database, temp.key).close();
	return temp.key;
}

function write_logos(directory: string, logos: BackupContent['logos']): void
{
	const folder = logos_folder(directory);
	mkdirSync(folder, { recursive: true });

	for (const name of readdirSync(folder).filter((file) => LOGO_FILE.test(file)))
		rmSync(path.join(folder, name), { force: true });

	for (const [name, text] of Object.entries(logos))
	{
		if (LOGO_FILE.test(name) && typeof text === 'string')
			writeFileSync(path.join(folder, name), text, 'utf8');
	}
}

async function replace_database(content: BackupContent): Promise<void>
{
	const paths = database_paths();
	const key = prepare_restore(paths, KEY_STORE, content);

	logout();
	await wait_for_sync();

	close_database();
	use_database(install_temp_database(paths, KEY_STORE, key), key);
	write_logos(paths.directory, content.logos);
}

function log_path(directory: string): string
{
	return path.join(directory, FILE_NAMES.backup_log);
}

export function read_backup_log(directory: string): BackupLogEntry[]
{
	try
	{
		const log = JSON.parse(readFileSync(log_path(directory), 'utf8'));
		return Array.isArray(log) ? log : [];
	}
	catch
	{
		return [];
	}
}

export function add_backup_log(directory: string, entry: BackupLogEntry): void
{
	const log = [entry, ...read_backup_log(directory)].slice(0, LOG_MAX_ENTRIES);
	writeFileSync(log_path(directory), JSON.stringify(log, null, 2), 'utf8');
}

function user_name(db: LocalDatabase, session: Session): string
{
	const user = db.prepare('SELECT username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE id = ?').get(session.user_id) as
		{ username: string; nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null } | undefined;

	if (!user)
		return 'Usuario desconocido';

	const name = full_name(user.nombre, user.apellido_paterno, user.apellido_materno);
	return name ? `${name} (${user.username})` : user.username;
}

function check_admin(session: Session): void
{
	if (session.role !== 'admin_parroquia')
		throw new ServiceError('Solo el administrador de una parroquia puede hacer o restaurar respaldos.', 403);
}

async function export_excel(db: LocalDatabase, session: Session)
{
	const parish_id = session.parish_id as number;
	const day = new Date().toISOString().slice(0, 10);
	const options = { title: 'Guardar el Excel', defaultPath: `partidas-${day}.xlsx`, filters: [{ name: 'Excel', extensions: ['xlsx'] }] };
	const window = parent_window();
	const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
	if (choice.canceled || !choice.filePath)
		return { cancelado: true as const };

	try
	{
		writeFileSync(choice.filePath, build_xlsx(parish_workbook(db, parish_id)));
	}
	catch
	{
		throw new ServiceError(`No se pudo guardar el Excel: puede que "${path.basename(choice.filePath)}" esté abierto. Ciérrelo y vuelva a exportar.`, 409);
	}

	add_backup_log(database_paths().directory, { fecha: new Date().toISOString(), usuario: user_name(db, session), accion: 'exporto_excel', archivo: path.basename(choice.filePath) });
	const records = db.prepare('SELECT COUNT(*) FROM sacramentos WHERE parroquia_id = ?').pluck().get(parish_id) as number;
	return { cancelado: false as const, partidas: records, archivo: path.basename(choice.filePath) };
}

function read_password(value: unknown, is_new: boolean): string
{
	const password = typeof value === 'string' ? value : '';

	if (is_new && password.length < BACKUP_PASSWORD_MIN_LENGTH)
		throw new ServiceError(`La contraseña del respaldo debe tener al menos ${BACKUP_PASSWORD_MIN_LENGTH} caracteres.`, 400);

	if (!password)
		throw new ServiceError('Escriba la contraseña del respaldo.', 400);

	return password;
}

function count_rows(content: BackupContent, table: string): number
{
	return content.tablas[table]?.filas.length ?? 0;
}

function summary_of(content: BackupContent)
{
	return { cancelado: false as const, partidas: count_rows(content, 'sacramentos'), pendientes: count_rows(content, 'sync_cola') };
}

async function restore_from_file(password_value: unknown, user: string)
{
	const password = read_password(password_value, false);

	const options = { title: 'Elegir el respaldo', properties: ['openFile' as const], filters: [{ name: 'Respaldo', extensions: [BACKUP_EXTENSION] }] };
	const window = parent_window();
	const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
	if (choice.canceled || choice.filePaths.length === 0)
		return { cancelado: true as const };

	let text: string;
	try
	{
		text = readFileSync(choice.filePaths[0], 'utf8');
	}
	catch
	{
		throw new ServiceError('No se pudo leer el respaldo.', 400);
	}

	const content = await decode_backup(text, password);
	await replace_database(content);
	add_backup_log(database_paths().directory, { fecha: new Date().toISOString(), usuario: user, accion: 'restauro', archivo: path.basename(choice.filePaths[0]) });
	return summary_of(content);
}

function is_empty_pc(): boolean
{
	try
	{
		return needs_package(get_database());
	}
	catch
	{
		return false;
	}
}

export const backup_routes: Routes =
{
	'backup.export': async (payload: { password: unknown }, { db, session }) =>
	{
		check_admin(session);
		const password = read_password(payload?.password, true);

		const day = new Date().toISOString().slice(0, 10);
		const options = { title: 'Guardar el respaldo', defaultPath: `respaldo-${day}.${BACKUP_EXTENSION}`, filters: [{ name: 'Respaldo', extensions: [BACKUP_EXTENSION] }] };
		const window = parent_window();
		const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
		if (choice.canceled || !choice.filePath)
			return { cancelado: true };

		const directory = database_paths().directory;
		const content = build_backup(db, directory);
		writeFileSync(choice.filePath, await encode_backup(content, password), 'utf8');
		add_backup_log(directory, { fecha: new Date().toISOString(), usuario: user_name(db, session), accion: 'exporto', archivo: path.basename(choice.filePath) });

		return { ...summary_of(content), archivo: path.basename(choice.filePath) };
	},

	'backup.exportExcel': (_payload, { db, session }) =>
	{
		check_admin(session);
		return export_excel(db, session);
	},

	'backup.restore': (payload: { password: unknown }, { db, session }) =>
	{
		check_admin(session);
		return restore_from_file(payload?.password, user_name(db, session));
	},

	'backup.log': (_payload, { session }) =>
	{
		check_admin(session);
		return { registros: read_backup_log(database_paths().directory) };
	},
};

export const backup_public_routes: PublicRoutes =
{
	'backup.restoreEmpty': (payload: { password: unknown }) =>
	{
		if (!is_empty_pc())
			throw new ServiceError('Esta PC ya tiene usuarios: entre como administrador y restaure el respaldo desde Configuración.', 409);

		return restore_from_file(payload?.password, 'Sin sesión (PC nueva)');
	},
};
