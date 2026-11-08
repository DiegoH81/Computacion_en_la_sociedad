import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { verify_jwt, type TokenUser } from './crypto';

export type AppEnv = { Bindings: Env; Variables: { user: TokenUser } };


export class ServiceError extends Error
{
	status: number;

	constructor(message: string, status: number)
	{
		super(message);
		this.name = 'ServiceError';
		this.status = status;
	}
}

// Cors, to allow any request from anywhere
const CORS_HEADERS =
{
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const cors: MiddlewareHandler = async (c, next) =>
{
	if (c.req.method === 'OPTIONS')
		return new Response(null, { headers: CORS_HEADERS });

	await next();

	for (const [name, value] of Object.entries(CORS_HEADERS))
		c.res.headers.set(name, value);
};

// Session
const INVALID_SESSION = 'Sesión inválida o expirada.';

export async function authenticate_request(request: Request, jwt_secret: string, db: D1Database): Promise<TokenUser>
{
	const header = request.headers.get('Authorization');
	if (!header || !header.startsWith('Bearer '))
		throw new ServiceError('Token no proporcionado.', 401);

	const token = header.slice('Bearer '.length);

	let user: TokenUser;
	try
	{
		user = await verify_jwt(token, jwt_secret);
	}
	catch
	{
		throw new ServiceError(INVALID_SESSION, 401);
	}

	const account = await db.prepare('SELECT activo FROM usuarios WHERE id = ?').bind(user.usuarioId).first<{ activo: number }>();
	if (!account || account.activo !== 1)
		throw new ServiceError(INVALID_SESSION, 401);

	return user;
}

export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) =>
{
	const user = await authenticate_request(c.req.raw, c.env.JWT_SECRET, c.env.prelatura_db);
	c.set('user', user);
	await next();
};


export const not_found: NotFoundHandler = (c) =>
{
	return c.json({ message: 'Not Found' }, 404);
};

export const error_handler: ErrorHandler = (error, c) =>
{
	if (error instanceof ServiceError)
		return c.json({ message: error.message }, error.status as ContentfulStatusCode);

	console.error('Error inesperado:', error);
	return c.json({ message: 'Ocurrió un error inesperado.' }, 500);
};
