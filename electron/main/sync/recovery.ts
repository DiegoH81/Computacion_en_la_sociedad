// Recuperar la base local cuando se pierde su clave, con ayuda del servidor.
//
// La base local está cifrada. Su clave se guarda en un archivo protegido por Windows y, además,
// una copia viaja al servidor (upload_key_copy).
//
// Si al iniciar no se puede abrir la base (por ejemplo, porque se reinstaló Windows y ya no se puede
// leer el archivo de la clave), la app pide un login con internet y entonces:
//   1. Pide al servidor la copia de la clave. Si abre la base, listo: no se pierde nada.
//   2. Si no hay copia o no sirve, arma una base nueva desde el servidor. La vieja se guarda
//      aparte por si acaso; lo que no se había subido hay que volver a digitarlo.
//
// El trabajo con archivos está en db/database.ts; aquí solo se decide qué hacer y se habla con el servidor.

import { existsSync } from 'node:fs';
import { device_id, install_temp_database, open_temp_database, open_with_key_copy, type KeyStore, type LocalDatabase, type LocalPaths } from '../db/database';
import { SYNC_KEYS } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { get_key_copy, put_key_copy, type RemoteRequest } from './online';
import { get_sync_value, set_sync_value } from './queue';
import { pull_changes, refresh_reference } from './sync';

export const REBUILT_NOTICE =
	'La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.';

// null si el servidor no tiene copia de la clave de esta PC.
async function download_key_copy(paths: LocalPaths, request: RemoteRequest, token: string): Promise<string | null>
{
	try
	{
		const response = await get_key_copy(request, token, device_id(paths));
		return response.clave;
	}
	catch (error)
	{
		if (error instanceof ServiceError && error.status === 404)
			return null;

		// Sin conexión o sin permiso no se sabe si la clave se perdió: no se aparta nada.
		throw error;
	}
}

// Arma la base nueva desde el servidor en un archivo temporal, y solo al final reemplaza a la vieja.
async function rebuild(paths: LocalPaths, keys: KeyStore, request: RemoteRequest, token: string): Promise<{ db: LocalDatabase; key: string }>
{
	const temp = open_temp_database(paths, keys);

	try
	{
		await refresh_reference(temp.db, request, token);
		await pull_changes(temp.db, request, token);
		set_sync_value(temp.db, SYNC_KEYS.last_sync, new Date().toISOString());
		set_sync_value(temp.db, SYNC_KEYS.notice, REBUILT_NOTICE);
		set_sync_value(temp.db, SYNC_KEYS.key_registered, null); // la clave es nueva: hay que subir su copia
	}
	finally
	{
		temp.db.close();
	}

	return { db: install_temp_database(paths, keys, temp.key), key: temp.key };
}

// Necesita un login con internet: es lo que autoriza al servidor a entregar la copia de la clave.
export async function recover_local_database(paths: LocalPaths, keys: KeyStore, request: RemoteRequest, token: string): Promise<{ db: LocalDatabase; key: string }>
{
	if (existsSync(paths.database))
	{
		const key_copy = await download_key_copy(paths, request, token);
		if (key_copy)
		{
			const db = open_with_key_copy(paths, keys, key_copy);
			if (db)
				return { db: db, key: key_copy };
		}
	}

	return rebuild(paths, keys, request, token);
}

// Sube la copia de la clave si todavía no está en el servidor.
// También la vuelve a subir si la subió un admin (sin parroquia) y ahora la PC la usa una parroquia,
// para que la copia quede a nombre de esa parroquia.
export async function upload_key_copy(db: LocalDatabase, paths: LocalPaths, key: string, request: RemoteRequest, token: string, parish_id: number | null): Promise<void>
{
	const registered = get_sync_value(db, SYNC_KEYS.key_registered);
	const needs_parish = registered === 'admin' && parish_id !== null;
	if (registered && !needs_parish)
		return;

	const response = await put_key_copy(request, token, device_id(paths), key);
	set_sync_value(db, SYNC_KEYS.key_registered, response.parroquiaId === null ? 'admin' : 'parroquia');
}
