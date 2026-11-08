import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as logger from './logger';

export const CONFIG_FILE = 'configuracion.json';

const DEVELOPMENT_SERVER = 'http://localhost:8787';

let cached: string | null = null;

export function read_config_file(file: string): string | null
{
	if (!existsSync(file))
		return null;

	try
	{
		const content = JSON.parse(readFileSync(file, 'utf8')) as { servidor?: unknown };
		if (typeof content.servidor === 'string' && /^https?:\/\/\S+$/.test(content.servidor.trim()))
			return content.servidor.trim().replace(/\/+$/, '');

		logger.error(`${file}: "servidor" debe ser una dirección que empiece con http:// o https://.`);
	}
	catch (error)
	{
		logger.error(`No se pudo leer ${file}:`, error);
	}

	return null;
}

function installer_folder(): string
{
	if (app.isPackaged)
		return path.join(process.resourcesPath, 'instalador');

	return path.join(app.getAppPath(), 'resources', 'instalador');
}

export function server_url(): string
{
	if (cached)
		return cached;

	const url =
		process.env.PRELATURA_API_URL ??
		read_config_file(path.join(app.getPath('userData'), CONFIG_FILE)) ??
		read_config_file(path.join(installer_folder(), CONFIG_FILE)) ??
		import.meta.env.VITE_WORKER_URL ??
		DEVELOPMENT_SERVER;

	logger.info(`Servidor: ${url}`);
	cached = url;
	return url;
}
