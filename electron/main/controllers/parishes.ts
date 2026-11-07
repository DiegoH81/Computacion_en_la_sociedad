import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { LocalDatabase } from '../db/database';
import { check_parish_admin } from '../models/parish';
import type { Session } from '../models/session';
import { FILE_NAMES, MAX_LOGO_LENGTH } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { positive_id } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

const LOGO_FORMAT = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function list_parishes(db: LocalDatabase)
{
	return db.prepare('SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC').all();
}

function logo_path(user_data_folder: string, parish_id: number): string
{
	return path.join(user_data_folder, FILE_NAMES.logos_folder, `parroquia-${parish_id}.txt`);
}

export function read_parish_logo(user_data_folder: string, parish_id: number): string | null
{
	try
	{
		return readFileSync(logo_path(user_data_folder, parish_id), 'utf8');
	}
	catch
	{
		return null;
	}
}

export function save_parish_logo(user_data_folder: string, session: Session, parish_id: number, logo: unknown): void
{
	check_parish_admin(session, parish_id, 'Solo puede cambiar el logo de su propia parroquia.', 'Solo el administrador de la parroquia puede cambiar el logo.');

	const file = logo_path(user_data_folder, parish_id);

	if (logo === null)
	{
		rmSync(file, { force: true });
		return;
	}

	if (typeof logo !== 'string' || logo.length > MAX_LOGO_LENGTH || !LOGO_FORMAT.test(logo))
		throw new ServiceError('El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.', 400);

	mkdirSync(path.dirname(file), { recursive: true });

	const temporary_file = `${file}.tmp`;
	writeFileSync(temporary_file, logo, 'utf8');
	renameSync(temporary_file, file);
}

export const parish_routes: Routes =
{
	'parishes.list': (_payload, { db }) =>
	{
		return { parroquias: list_parishes(db) };
	},

	'parishes.logo': (payload: { parroquia_id: unknown }, { user_data_folder }) =>
	{
		return { logo: read_parish_logo(user_data_folder, positive_id(payload.parroquia_id)) };
	},

	'parishes.saveLogo': (payload: { parroquia_id: unknown; logo: unknown }, { session, user_data_folder }) =>
	{
		save_parish_logo(user_data_folder, session, positive_id(payload.parroquia_id), payload.logo);
		return { success: true };
	},
};
