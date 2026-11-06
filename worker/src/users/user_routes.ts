// Rutas de /api/users. Aquí solo se lee la petición y se arma la respuesta;
// las reglas (por ejemplo "solo un admin") están en users.ts.

import type { TokenUser } from '../auth/jwt';
import { bad_body_response, error_response, json_response, not_found_response, read_json_body } from '../http';
import { create_user, search_users, toggle_user_active, update_user, type EditUserBody, type NewUserBody, type SortField } from './users';

const EDIT_PATH = /^\/api\/users\/(\d+)$/;
const TOGGLE_PATH = /^\/api\/users\/(\d+)\/toggle-active$/;

// Convierte el texto a entero y lo deja entre min y max. Si no es un número, usa el valor por defecto.
function read_int(text: string | null, default_value: number, min: number, max: number): number
{
	const value = Number.parseInt(text ?? '', 10);
	if (Number.isNaN(value))
		return default_value;

	return Math.min(max, Math.max(min, value));
}

// GET /api/users
async function handle_search(db: D1Database, user: TokenUser, url: URL): Promise<Response>
{
	const params = url.searchParams;
	const search =
	{
		first_name: params.get('nombre') ?? undefined,
		father_last_name: params.get('apellidoPaterno') ?? undefined,
		mother_last_name: params.get('apellidoMaterno') ?? undefined,
		sort_by: (params.get('sortBy') ?? 'nombre') as SortField,
		sort_direction: (params.get('sortDirection') ?? 'asc') as 'asc' | 'desc',
		page: read_int(params.get('page'), 1, 1, 100_000),
		page_size: read_int(params.get('pageSize'), 20, 1, 100),
	};

	const result = await search_users(db, user, search);
	if (!result.success)
		return error_response(result.message, result.status);

	return json_response({ users: result.users, totalPages: result.totalPages });
}

// POST /api/users
async function handle_create(db: D1Database, user: TokenUser, request: Request): Promise<Response>
{
	const body = await read_json_body(request);
	if (!body)
		return bad_body_response();

	const result = await create_user(db, user, body as NewUserBody); // users.ts revisa cada campo
	if (!result.success)
		return error_response(result.message, result.status);

	return json_response({ id: result.id }, 201);
}

// PUT /api/users/:id
async function handle_update(db: D1Database, user: TokenUser, request: Request, user_id: number): Promise<Response>
{
	const body = await read_json_body(request);
	if (!body)
		return bad_body_response();

	const result = await update_user(db, user, user_id, body as EditUserBody); // users.ts revisa cada campo
	if (!result.success)
		return error_response(result.message, result.status);

	return json_response({ success: true });
}

// PATCH /api/users/:id/toggle-active
async function handle_toggle(db: D1Database, user: TokenUser, user_id: number): Promise<Response>
{
	const result = await toggle_user_active(db, user, user_id);
	if (!result.success)
		return error_response(result.message, result.status);

	return json_response({ success: true });
}

// Para cuando ya se sabe que la ruta empieza con /api/users y que el usuario inició sesión.
export async function handle_user_routes(request: Request, url: URL, db: D1Database, user: TokenUser): Promise<Response>
{
	const method = request.method;

	if (url.pathname === '/api/users' && method === 'GET')
		return handle_search(db, user, url);

	if (url.pathname === '/api/users' && method === 'POST')
		return handle_create(db, user, request);

	const edit_match = EDIT_PATH.exec(url.pathname);
	if (edit_match && method === 'PUT')
		return handle_update(db, user, request, Number(edit_match[1]));

	const toggle_match = TOGGLE_PATH.exec(url.pathname);
	if (toggle_match && method === 'PATCH')
		return handle_toggle(db, user, Number(toggle_match[1]));

	return not_found_response();
}
