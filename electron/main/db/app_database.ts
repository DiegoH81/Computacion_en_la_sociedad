// La base local que usa la app mientras está abierta. Hay una sola por PC.
//
// Al iniciar se llama a open_at_startup(). Después, el resto del código pide la base con
// get_database(). Si la base no se pudo abrir, get_database() lanza un error con el motivo,
// y el login se encarga de recuperarla (ver controllers/login.ts).
//
// Va separado de database.ts porque usa Electron (la carpeta de la app y el almacenamiento seguro).

import { app, safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ServiceError } from '../utils/errors';
import { local_paths, open_or_detect, type KeyStore, type LocalDatabase, type LocalPaths } from './database';

let database: LocalDatabase | null = null;
let database_key: string | null = null;
let needs_recovery = false;
let unavailable_message = 'La base local no está disponible.';

// ---------------------------------------------------------------------------
// Archivo de la clave
// ---------------------------------------------------------------------------
// Windows cifra el archivo con la cuenta del usuario (safeStorage), así que otra cuenta
// o otra PC no lo pueden leer.

function check_secure_storage(): void
{
	if (!safeStorage.isEncryptionAvailable())
		throw new Error('El sistema operativo no ofrece almacenamiento seguro para la clave.');
}

// null si falta el archivo o si Windows ya no lo puede descifrar (por ejemplo, tras reinstalarlo).
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

// ---------------------------------------------------------------------------
// La base
// ---------------------------------------------------------------------------

export function open_at_startup(): void
{
	const result = open_or_detect(database_paths(), KEY_STORE);

	if (result.status === 'open')
	{
		database = result.db;
		database_key = result.key;
	}
	else if (result.status === 'needs-recovery')
	{
		needs_recovery = true;
		unavailable_message = 'La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.';
	}
	else
	{
		unavailable_message = result.message;
	}
}

export function get_database(): LocalDatabase
{
	if (!database)
		throw new ServiceError(unavailable_message, 503);

	return database;
}

// La clave de la base abierta, o null si no hay base.
export function current_key(): string | null
{
	return database_key;
}

export function database_needs_recovery(): boolean
{
	return needs_recovery;
}

// Después de recuperar la base, esta pasa a ser la base de la app.
export function use_database(db: LocalDatabase, key: string): void
{
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
