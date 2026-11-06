// Rutas de sincronización. index.ts ya revisó que el usuario inició sesión.

import type { TokenUser } from '../auth/jwt';
import { bad_body_response, error_response, json_response, not_found_response, read_json_body } from '../http';
import { apply_changes, MAX_CHANGES_PER_PUSH } from './push';
import { MAX_RECORDS_PER_PAGE, read_page, read_record, read_reference } from './pull';

// POST /api/sync/push   { cambios: [...] }  ->  { resultados: [...] }
async function handle_push(db: D1Database, user: TokenUser, request: Request): Promise<Response>
{
	const body = await read_json_body(request);
	if (!body || !Array.isArray(body.cambios))
		return bad_body_response();

	if (body.cambios.length > MAX_CHANGES_PER_PUSH)
		return error_response(`Se aceptan hasta ${MAX_CHANGES_PER_PUSH} cambios por envío.`, 400);

	const results = await apply_changes(db, user, body.cambios);
	return json_response({ resultados: results });
}

// GET /api/sync/pull?cursor=N  ->  { partidas, cursor, hayMas }
async function handle_pull(db: D1Database, url: URL): Promise<Response>
{
	const cursor = Number.parseInt(url.searchParams.get('cursor') ?? '0', 10);
	if (!Number.isInteger(cursor) || cursor < 0)
		return error_response('Cursor inválido.', 400);

	const page = await read_page(db, cursor, MAX_RECORDS_PER_PAGE);
	return json_response(page);
}

// GET /api/sync/record?entidad=...&client_id=...  ->  { registro }
async function handle_record(db: D1Database, url: URL): Promise<Response>
{
	const entity = url.searchParams.get('entidad') ?? '';
	const client_id = url.searchParams.get('client_id') ?? '';

	const record = await read_record(db, entity, client_id);
	if (!record)
		return error_response('Registro no encontrado.', 404);

	return json_response({ registro: record });
}

export async function handle_sync_routes(request: Request, url: URL, db: D1Database, user: TokenUser): Promise<Response>
{
	const method = request.method;

	if (url.pathname === '/api/reference' && method === 'GET')
		return json_response(await read_reference(db));

	if (url.pathname === '/api/sync/push' && method === 'POST')
		return handle_push(db, user, request);

	if (url.pathname === '/api/sync/pull' && method === 'GET')
		return handle_pull(db, url);

	if (url.pathname === '/api/sync/record' && method === 'GET')
		return handle_record(db, url);

	return not_found_response();
}
