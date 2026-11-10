import { app, BrowserWindow, dialog } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Parish } from '../../../shared/models';
import type { MembershipData, MinisterData, RecordData, UserData } from '../../../shared/sync';
import { get_database } from '../db/app_database';
import type { LocalDatabase } from '../db/database';
import type { Session } from '../models/session';
import { get_sync_value, set_sync_value } from '../sync/queue';
import { read_local_record, save_downloaded_record } from '../sync/records';
import { save_reference_data } from '../sync/sync';
import { SYNC_KEYS } from '../utils/config';
import { ServiceError } from '../utils/errors';
import * as logger from '../utils/logger';
import type { PublicRoutes, Routes } from '../utils/middleware';

export const PACKAGE_FORMAT = 'prelatura-paquete-inicial';
export const PACKAGE_VERSION = 1;
export const PACKAGE_FILE = 'paquete-inicial.json';

export interface InitialPackage
{
	formato: typeof PACKAGE_FORMAT;
	version: number;
	generado_en: string;
	cursor: string | null;
	parroquias: Parish[];
	usuarios: (UserData & { id: number })[];
	usuario_parroquias?: MembershipData[];
	ministros: (MinisterData & { id: number })[];
	partidas: RecordData[];
}

export interface PackageSummary
{
	parroquias: number;
	usuarios: number;
	partidas: number;
}

export function needs_package(db: LocalDatabase): boolean
{
	return db.prepare('SELECT COUNT(*) FROM usuarios').pluck().get() === 0;
}

// ---------------------------------------------------------------------------
// Generar
// ---------------------------------------------------------------------------

export function build_package(db: LocalDatabase, session: Session): InitialPackage
{
	if (session.role !== 'admin_general')
		throw new ServiceError('Solo el administrador general puede generar el paquete inicial.', 403);

	const queued = db.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get() as number;
	if (queued > 0)
		throw new ServiceError('Hay cambios sin subir. Sincronice con internet antes de generar el paquete inicial.', 409);

	// Las cuentas con id provisional (creadas aquí y sin subir) no van: todavía no existen en el servidor.
	const users = db
		.prepare(
			`SELECT u.id, u.client_id, u.parroquia_id, u.username, u.rol, u.nombre, u.apellido_paterno, u.apellido_materno,
				u.activo, u.principal, u.version, u.updated_at, c.verificador AS password_hash
			 FROM usuarios u
			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
			 WHERE u.id > 0
			 ORDER BY u.id`,
		)
		.all() as (UserData & { id: number })[];

	const ministers = db
		.prepare('SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at FROM ministros ORDER BY id')
		.all() as (MinisterData & { id: number })[];

	const records = db.prepare('SELECT client_id, version, created_at, updated_at FROM sacramentos ORDER BY id').all() as { client_id: string; version: number; created_at: string; updated_at: string }[];

	return {
		formato: PACKAGE_FORMAT,
		version: PACKAGE_VERSION,
		generado_en: new Date().toISOString(),
		cursor: get_sync_value(db, SYNC_KEYS.cursor),
		parroquias: db.prepare('SELECT id, nombre, ubicacion, activa FROM parroquias ORDER BY id').all() as Parish[],
		usuarios: users,
		usuario_parroquias: db.prepare('SELECT usuario_id, parroquia_id, rol, principal FROM usuario_parroquias WHERE usuario_id > 0 ORDER BY usuario_id, parroquia_id').all() as MembershipData[],
		ministros: ministers,
		partidas: records.map((row) => ({ ...read_local_record(db, row.client_id), version: row.version, created_at: row.created_at, updated_at: row.updated_at })),
	};
}

// ---------------------------------------------------------------------------
// Cargar
// ---------------------------------------------------------------------------

function check_package(data: unknown): InitialPackage
{
	const candidate = data as Partial<InitialPackage> | null;
	if (!candidate || candidate.formato !== PACKAGE_FORMAT)
		throw new ServiceError('El archivo no es un paquete inicial de esta aplicación.', 400);

	if (candidate.version !== PACKAGE_VERSION)
		throw new ServiceError('El paquete inicial es de otra versión de la aplicación.', 400);

	if (!Array.isArray(candidate.parroquias) || !Array.isArray(candidate.usuarios) || !Array.isArray(candidate.ministros) || !Array.isArray(candidate.partidas))
		throw new ServiceError('El paquete inicial está incompleto.', 400);

	return candidate as InitialPackage;
}

export function load_package(db: LocalDatabase, data: unknown): PackageSummary
{
	const content = check_package(data);

	if (!needs_package(db))
		throw new ServiceError('Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.', 409);

	const load = db.transaction(() =>
	{
		save_reference_data(db, { parroquias: content.parroquias, ministros: content.ministros, usuarios: content.usuarios, usuario_parroquias: content.usuario_parroquias });

		for (const record of content.partidas)
			save_downloaded_record(db, record);

		if (content.cursor)
			set_sync_value(db, SYNC_KEYS.cursor, content.cursor);
	});

	load();

	return { parroquias: content.parroquias.length, usuarios: content.usuarios.length, partidas: content.partidas.length };
}

function read_package_file(file_path: string): unknown
{
	try
	{
		return JSON.parse(readFileSync(file_path, 'utf8'));
	}
	catch
	{
		throw new ServiceError('No se pudo leer el paquete inicial.', 400);
	}
}

export function bundled_package_path(): string
{
	if (app.isPackaged)
		return path.join(process.resourcesPath, 'instalador', PACKAGE_FILE);

	return path.join(app.getAppPath(), 'resources', 'instalador', PACKAGE_FILE);
}

export function load_bundled_package(): void
{
	if (process.env.PRELATURA_SIN_PAQUETE === '1')
		return;

	const file = process.env.PRELATURA_PAQUETE || bundled_package_path();
	let db: LocalDatabase;
	try
	{
		db = get_database();
	}
	catch
	{
		return;
	}

	if (!existsSync(file) || !needs_package(db))
		return;

	try
	{
		const summary = load_package(db, read_package_file(file));
		logger.info(`Paquete inicial cargado: ${summary.parroquias} parroquias, ${summary.usuarios} usuarios y ${summary.partidas} partidas.`);
	}
	catch (error)
	{
		logger.error('No se pudo cargar el paquete inicial del instalador:', error);
	}
}

export function parent_window(): BrowserWindow | undefined
{
	return BrowserWindow.getFocusedWindow() ?? undefined;
}

export const package_public_routes: PublicRoutes =
{
	'package.status': () =>
	{
		try
		{
			return { necesita_paquete: needs_package(get_database()) };
		}
		catch
		{
			return { necesita_paquete: false };
		}
	},
};

export const package_routes: Routes =
{
	'package.export': async (_payload, { db, session }) =>
	{
		const content = build_package(db, session);

		const options = { title: 'Guardar el paquete inicial', defaultPath: PACKAGE_FILE, filters: [{ name: 'Paquete inicial', extensions: ['json'] }] };
		const window = parent_window();
		const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
		if (choice.canceled || !choice.filePath)
			return { cancelado: true };

		writeFileSync(choice.filePath, JSON.stringify(content), 'utf8');
		return { cancelado: false, parroquias: content.parroquias.length, usuarios: content.usuarios.length, partidas: content.partidas.length };
	},
};
