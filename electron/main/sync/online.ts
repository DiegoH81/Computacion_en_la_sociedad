// Las llamadas de la PC al Worker (la base online). La forma del JSON que viaja está en
// shared/sync.ts, que también usa el Worker.
//
// Las funciones reciben "request" como parámetro en vez de usar fetch directo:
// así las pruebas pueden pasar un servidor falso. En la app se pasa remote_request.
//
// Este archivo no conoce la base local.

import type { Parish } from '../../../shared/models';
import type { ChangeResult, LoginResponse, MinisterData, PullPage, RecordData, SyncChange, SyncEntity } from '../../../shared/sync';
import type { User } from '../models/user';
import { LOGIN_TIMEOUT_MS, REQUEST_TIMEOUT_MS, WORKER_URL } from '../utils/config';
import { ServiceError } from '../utils/errors';

const CONNECTION_ERROR = 'No se pudo conectar con el servidor. Verifique su conexión.';

// GET /api/reference: parroquias, ministros y usuarios, lo que la PC baja pero no edita (salvo los ministros).
export interface ReferenceData
{
	parroquias: Parish[];
	ministros: (MinisterData & { id: number })[];
	usuarios: User[];
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export interface RemoteOptions
{
	method?: 'GET' | 'POST' | 'PUT';
	body?: unknown;
	token?: string;
	timeoutMs?: number;
}

export type RemoteRequest = <T>(path: string, options?: RemoteOptions) => Promise<T>;

// Devuelve el JSON de la respuesta.
// Si el servidor responde con error, lanza un ServiceError con su mensaje y su código.
// Si no hay conexión (o la respuesta no llega completa), el código es 0.
export const remote_request: RemoteRequest = async <T>(path: string, options: RemoteOptions = {}): Promise<T> =>
{
	const method = options.method ?? 'GET';
	const timeout_ms = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

	const headers: Record<string, string> = {};
	if (options.body !== undefined)
		headers['Content-Type'] = 'application/json';

	if (options.token)
		headers['Authorization'] = `Bearer ${options.token}`;

	let response: Response;
	let data: { message?: unknown } | null;
	try
	{
		response = await fetch(`${WORKER_URL}${path}`, {
			method: method,
			headers: headers,
			body: options.body === undefined ? undefined : JSON.stringify(options.body),
			signal: AbortSignal.timeout(timeout_ms),
		});
		data = await response.json().catch(() => null);
	}
	catch
	{
		throw new ServiceError(CONNECTION_ERROR, 0);
	}

	if (!response.ok)
	{
		const message = data?.message ? String(data.message) : 'Ocurrió un error inesperado.';
		throw new ServiceError(message, response.status);
	}

	if (data === null)
		throw new ServiceError(CONNECTION_ERROR, 0);

	return data as T;
};

// true si el error es por la conexión o porque el servidor falló, y no por algo que hizo el usuario.
export function is_connection_error(error: unknown): boolean
{
	return error instanceof ServiceError && (error.status === 0 || error.status >= 500);
}

// ---------------------------------------------------------------------------
// Rutas del Worker
// ---------------------------------------------------------------------------

export function request_login(request: RemoteRequest, username: string, password: string): Promise<LoginResponse>
{
	return request<LoginResponse>('/api/auth/login', { method: 'POST', body: { username: username, password: password }, timeoutMs: LOGIN_TIMEOUT_MS });
}

export function get_reference(request: RemoteRequest, token: string): Promise<ReferenceData>
{
	return request<ReferenceData>('/api/reference', { token: token });
}

export function push_changes(request: RemoteRequest, token: string, changes: SyncChange[]): Promise<{ resultados: ChangeResult[] }>
{
	return request<{ resultados: ChangeResult[] }>('/api/sync/push', { method: 'POST', body: { cambios: changes }, token: token });
}

// Las partidas que cambiaron después del cursor.
export function pull_page(request: RemoteRequest, token: string, cursor: string): Promise<PullPage>
{
	return request<PullPage>(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`, { token: token });
}

// La versión del servidor de una partida o un ministro, para resolver un conflicto.
export function get_record(request: RemoteRequest, token: string, entity: SyncEntity, client_id: string): Promise<{ registro: (RecordData | MinisterData) & { version: number } }>
{
	const query = `entidad=${encodeURIComponent(entity)}&client_id=${encodeURIComponent(client_id)}`;
	return request<{ registro: (RecordData | MinisterData) & { version: number } }>(`/api/sync/record?${query}`, { token: token });
}

// La copia de la clave de la base local de esta PC.
export function get_key_copy(request: RemoteRequest, token: string, device: string): Promise<{ clave: string }>
{
	return request<{ clave: string }>(`/api/devices/${device}/key`, { token: token });
}

export function put_key_copy(request: RemoteRequest, token: string, device: string, key: string): Promise<{ parroquiaId: number | null }>
{
	return request<{ parroquiaId: number | null }>(`/api/devices/${device}/key`, { method: 'PUT', body: { clave: key }, token: token });
}
