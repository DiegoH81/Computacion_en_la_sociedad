import { app, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { get_sync_value, set_sync_value } from '../sync/queue';
import { DATA_VERSION, SYNC_KEYS } from '../utils/config';
import { ServiceError } from '../utils/errors';
import * as logger from '../utils/logger';
import { local_paths, open_or_detect, remove_with_extra_files, type KeyStore, type LocalDatabase, type LocalPaths, type OpenResult } from './database';

let database: LocalDatabase | null = null;
let database_key: string | null = null;
let needs_recovery = false;
let unavailable_message = 'La base local no está disponible.';


function check_secure_storage(): void
{
	if (!safeStorage.isEncryptionAvailable())
		throw new Error('El sistema operativo no ofrece almacenamiento seguro para la clave.');
}

function read_key_file(key_path: string): string | null
{
	check_secure_storage();
	if (!existsSync(key_path))
		return null;

	try
	{
		return safeStorage.decryptString(readFileSync(key_path));
	}
	catch
	{
		return null;
	}
}

function write_key_file(key_path: string, key: string): void
{
	check_secure_storage();
	writeFileSync(key_path, safeStorage.encryptString(key), { mode: 0o600 });
}

export const KEY_STORE: KeyStore = { read: read_key_file, write: write_key_file };

export function database_paths(): LocalPaths
{
	return local_paths(app.getPath('userData'));
}


// Open DB at startup


function is_old_data(db: LocalDatabase): boolean
{
	const saved = Number(get_sync_value(db, SYNC_KEYS.data_version) ?? 0);
	if (saved >= DATA_VERSION)
		return false;

	// A new empty DB has no number yet, but there is nothing to delete.
	const has_users = db.prepare('SELECT COUNT(*) FROM usuarios').pluck().get() as number;
	return has_users > 0;
}

// Delete a DB left by an older installer whose data no longer matches the server.
function open_current_data(paths: LocalPaths): OpenResult
{
	const result = open_or_detect(paths, KEY_STORE);
	if (result.status !== 'open' || !is_old_data(result.db))
		return result;

	logger.info('La base local es de una versión anterior de los datos: se borra y se carga el paquete inicial.');
	result.db.close();
	remove_with_extra_files(paths.database);

	return open_or_detect(paths, KEY_STORE);
}

export function open_at_startup(): void
{
	const result = open_current_data(database_paths());

	if (result.status === 'open')
	{
		set_sync_value(result.db, SYNC_KEYS.data_version, String(DATA_VERSION));
		database = result.db;
		database_key = result.key;
	}
	else if (result.status === 'needs-recovery')
	{
		needs_recovery = true;
		unavailable_message = 'La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.';
	}
	else
        unavailable_message = result.message;
}

export function get_database(): LocalDatabase
{
	if (!database)
		throw new ServiceError(unavailable_message, 503);

	return database;
}


export function current_key(): string | null
{
	return database_key;
}

export function database_needs_recovery(): boolean
{
	return needs_recovery;
}

export function use_database(db: LocalDatabase, key: string): void
{
	// It was rebuilt from the server, so its data is current.
	set_sync_value(db, SYNC_KEYS.data_version, String(DATA_VERSION));
	database = db;
	database_key = key;
	needs_recovery = false;
}

export function close_database(): void
{
	database?.close();
	database = null;
	database_key = null;
}
