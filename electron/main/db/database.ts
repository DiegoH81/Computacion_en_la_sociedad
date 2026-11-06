//   open_local_database   abre el archivo y aplica las migraciones que faltan
//   open_or_detect        al iniciar la app: abre la base, la crea si es la primera vez, o avisa
//                         que hay que recuperarla (eso necesita internet: ver sync/recovery.ts)

import Database from 'better-sqlite3-multiple-ciphers';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FILE_NAMES, SET_ASIDE_DAYS_MS } from '../utils/config';
import { new_key } from '../utils/crypto';
import { LOCAL_MIGRATIONS } from './migrations';

export type LocalDatabase = Database.Database;

const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

export class NewerDatabaseError extends Error {}

// Migration to a new DB, if some changes are made to the DB use THIS
function migrate(db: LocalDatabase, migrations: readonly string[]): void
{
	const current_version = db.pragma('user_version', { simple: true }) as number;
	if (current_version > migrations.length)
		throw new NewerDatabaseError(`La base local está en la versión ${current_version} y esta app solo conoce hasta la ${migrations.length}.`);


	db.pragma('foreign_keys = OFF');

	for (let i = current_version; i < migrations.length; i++)
	{
		const apply = db.transaction(() =>
		{
			db.exec(migrations[i]);

			const broken_keys = db.pragma('foreign_key_check') as unknown[];
			if (broken_keys.length > 0)
				throw new Error('La migración dejó claves foráneas rotas.');

			db.pragma(`user_version = ${i + 1}`);
		});
		apply();
	}

	db.pragma('foreign_keys = ON');
}

export function open_local_database(file_path: string, hex_key: string, migrations: readonly string[] = LOCAL_MIGRATIONS): LocalDatabase
{
	if (!HEX_KEY_PATTERN.test(hex_key))
		throw new Error('La clave de la base local debe tener 32 bytes en hexadecimal.');

	const db = new Database(file_path);
	try
	{
		db.pragma(`cipher='chacha20'`);
		db.pragma(`hexkey='${hex_key}'`);

		db.prepare('SELECT count(*) FROM sqlite_master').get(); // Check key via 1st query

		db.pragma('foreign_keys = ON');
		db.pragma('journal_mode = WAL');
		db.pragma('synchronous = FULL');

		migrate(db, migrations);
		return db;
	}
	catch (error)
	{
		db.close();
		throw error;
	}
}

export function is_unreadable(error: unknown): boolean
{
	const code = (error as { code?: string } | null)?.code ?? '';
	return code.startsWith('SQLITE_NOTADB') || code.startsWith('SQLITE_CORRUPT');
}

// Files

export interface KeyStore
{
	read(key_path: string): string | null;
	write(key_path: string, key: string): void;
}

export interface LocalPaths
{
	directory: string;
	database: string;
	key: string;
	device: string;
	temp_database: string;
	temp_key: string;
	set_aside_folder: string;
}

export function local_paths(directory: string): LocalPaths
{
	return {
		directory: directory,
		database: path.join(directory, FILE_NAMES.database),
		key: path.join(directory, FILE_NAMES.key),
		device: path.join(directory, FILE_NAMES.device),
		temp_database: path.join(directory, FILE_NAMES.temp_database),
		temp_key: path.join(directory, FILE_NAMES.temp_key),
		set_aside_folder: path.join(directory, FILE_NAMES.set_aside_folder),
	};
}


export function device_id(paths: LocalPaths): string
{
	if (existsSync(paths.device))
		return readFileSync(paths.device, 'utf8').trim();

	const id = randomUUID();
	writeFileSync(paths.device, id);
	return id;
}

function move_with_extra_files(from: string, to: string): void
{
	for (const suffix of ['', '-wal', '-shm'])
	{
		if (existsSync(from + suffix))
			renameSync(from + suffix, to + suffix);
	}
}

function remove_with_extra_files(file: string): void
{
	for (const suffix of ['', '-wal', '-shm'])
		rmSync(file + suffix, { force: true });
}

function clean_set_aside(paths: LocalPaths): void
{
	if (!existsSync(paths.set_aside_folder))
		return;

	const files = readdirSync(paths.set_aside_folder)
		.filter((name) => name.endsWith('.db'))
		.sort()
		.reverse();

	files.forEach((name, index) =>
	{
		const file = path.join(paths.set_aside_folder, name);

		const too_old = (Date.now() - statSync(file).mtimeMs) > SET_ASIDE_DAYS_MS;

		if (index > 0 || too_old)
			remove_with_extra_files(file);
	});
}

function set_aside(paths: LocalPaths): void
{
	if (!existsSync(paths.database))
		return;

	mkdirSync(paths.set_aside_folder, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	move_with_extra_files(paths.database, path.join(paths.set_aside_folder, `prelatura-local-${stamp}.db`));
	clean_set_aside(paths);
}



// App start
export type OpenResult =
	| { status: 'open'; db: LocalDatabase; key: string }
	| { status: 'needs-recovery' }
	| { status: 'failed'; message: string };


export function open_or_detect(paths: LocalPaths, keys: KeyStore): OpenResult
{
	clean_set_aside(paths);
	const key = keys.read(paths.key);

	if (!existsSync(paths.database)) // No DB initialized
	{
		const created_key = key ?? new_key();
		const db = open_local_database(paths.database, created_key);
		if (!key)
			keys.write(paths.key, created_key);

		return { status: 'open', db: db, key: created_key };
	}

	if (!key) // There is BD but key is wrong
		return { status: 'needs-recovery' };

	try // Bd was able to start
	{
		const db = open_local_database(paths.database, key);

		remove_with_extra_files(paths.temp_database);
		rmSync(paths.temp_key, { force: true });

		return { status: 'open', db: db, key: key };
	}
	catch (error) // Error, either Newer DB or Unreadable BD
	{
		if (error instanceof NewerDatabaseError)
			return { status: 'failed', message: 'La base local es de una versión más nueva. Actualice la aplicación.' };

		if (is_unreadable(error))
			return { status: 'needs-recovery' };

		throw error;
	}
}

// Recover from a corrupted database
export function open_with_key_copy(paths: LocalPaths, keys: KeyStore, key: string): LocalDatabase | null
{
	try
	{
		const db = open_local_database(paths.database, key);
		keys.write(paths.key, key);
		return db;
	}
	catch (error)
	{
		if (!is_unreadable(error))
			throw error;

		return null;
	}
}


export function open_temp_database(paths: LocalPaths, keys: KeyStore): { db: LocalDatabase; key: string }
{
	let key = keys.read(paths.temp_key);

	if (!key || !existsSync(paths.temp_database))
	{
		remove_with_extra_files(paths.temp_database);
		key = new_key();
		keys.write(paths.temp_key, key);
	}

	try
	{
		return { db: open_local_database(paths.temp_database, key), key: key };
	}
	catch (error)
	{
		if (!is_unreadable(error))
			throw error;

		remove_with_extra_files(paths.temp_database);
		return { db: open_local_database(paths.temp_database, key), key: key };
	}
}

export function install_temp_database(paths: LocalPaths, keys: KeyStore, key: string): LocalDatabase
{
	set_aside(paths);
	move_with_extra_files(paths.temp_database, paths.database);
	keys.write(paths.key, key);
	rmSync(paths.temp_key, { force: true });

	return open_local_database(paths.database, key);
}