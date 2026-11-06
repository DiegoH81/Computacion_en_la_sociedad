// Punto de entrada del Worker. Cada petición pasa por fetch() y se manda a su ruta.
//
// Rutas:
//   POST   /api/auth/login                   iniciar sesión (no pide token)
//   GET    /api/parishes                     parroquias activas
//   GET    /api/reference                    parroquias, ministros y usuarios para la PC
//   POST   /api/sync/push                    subir cambios de una PC
//   GET    /api/sync/pull?cursor=N           bajar partidas que cambiaron
//   GET    /api/sync/record                  leer una partida o ministro
//   GET    /api/devices/:id/key              recuperar la clave de la base local de una PC
//   PUT    /api/devices/:id/key              guardar la clave de la base local de una PC
//   GET    /api/users                        buscar usuarios (solo admin)
//   POST   /api/users                        crear usuario (solo admin)
//   PUT    /api/users/:id                    editar usuario (solo admin)
//   PATCH  /api/users/:id/toggle-active      habilitar o deshabilitar (solo admin)
//
// Todas menos el login piden el header "Authorization: Bearer <token>".

import { authenticate_request } from './auth/authentication';
import type { TokenUser } from './auth/jwt';
import { login } from './auth/login';
import { handle_get_device_key, handle_save_device_key } from './devices/device_keys';
import { bad_body_response, CORS_HEADERS, error_response, json_response, not_found_response, read_json_body } from './http';
import { handle_sync_routes } from './sync/sync_routes';
import { handle_user_routes } from './users/user_routes';

const DEVICE_KEY_PATH = /^\/api\/devices\/([^/]+)\/key$/;

async function handle_login(request: Request, env: Env): Promise<Response>
{
	const body = await read_json_body(request);
	if (!body)
		return bad_body_response();

	if (!body.username || !body.password)
		return error_response('Usuario y contraseña son requeridos.', 400);

	const result = await login(env.prelatura_db, env.JWT_SECRET, body.username, body.password);
	if (!result.success)
		return error_response(result.message, 401);

	return json_response({ token: result.token, usuario: result.usuario });
}

async function handle_parishes(env: Env): Promise<Response>
{
	const parishes = await env.prelatura_db
		.prepare('SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC')
		.all<{ id: number; nombre: string }>();

	return json_response({ parishes: parishes.results });
}

async function handle_device_key(request: Request, env: Env, user: TokenUser, device_id: string): Promise<Response>
{
	if (!env.DEVICE_KEY_SECRET)
	{
		console.error('Falta configurar el secreto DEVICE_KEY_SECRET.');
		return error_response('El servidor no tiene configurada la copia de claves.', 503);
	}

	if (request.method === 'GET')
		return handle_get_device_key(env.prelatura_db, env.DEVICE_KEY_SECRET, user, device_id);

	if (request.method === 'PUT')
		return handle_save_device_key(env.prelatura_db, env.DEVICE_KEY_SECRET, user, device_id, request);

	return not_found_response();
}

async function handle_request(request: Request, env: Env): Promise<Response>
{
	const url = new URL(request.url);
	const path = url.pathname;

	// El navegador pregunta primero con OPTIONS si puede llamar desde otro origen.
	if (request.method === 'OPTIONS')
		return new Response(null, { headers: CORS_HEADERS });

	if (path === '/api/auth/login' && request.method === 'POST')
		return handle_login(request, env);

	// Desde aquí todas las rutas piden sesión. Si la ruta no es nuestra, ni siquiera se revisa el token.
	const device_match = DEVICE_KEY_PATH.exec(path);
	const is_parishes = path === '/api/parishes' && request.method === 'GET';
	const is_sync = path === '/api/reference' || path.startsWith('/api/sync/');
	const is_users = path.startsWith('/api/users');

	if (!is_parishes && !is_sync && !device_match && !is_users)
		return not_found_response();

	const auth = await authenticate_request(request, env.JWT_SECRET, env.prelatura_db);
	if (!auth.authenticated)
		return error_response(auth.message, auth.status);

	const user = auth.payload;

	if (is_parishes)
		return handle_parishes(env);

	if (device_match)
		return handle_device_key(request, env, user, device_match[1]);

	if (is_sync)
		return handle_sync_routes(request, url, env.prelatura_db, user);

	return handle_user_routes(request, url, env.prelatura_db, user);
}

export default
{
	fetch: handle_request,
};
