import { verify_jwt, type TokenUser } from './jwt';

export type AuthenticationResult =
	| { authenticated: true; payload: TokenUser }
	| { authenticated: false; status: number; message: string };

// El mismo mensaje sirve para todos los rechazos: así no le damos pistas a un atacante
// sobre si falló la firma, si venció el token o si la cuenta está deshabilitada.
const INVALID_SESSION: AuthenticationResult =
{
	authenticated: false,
	status: 401,
	message: 'Sesión inválida o expirada.',
};

// Revisa el header "Authorization: Bearer <token>".
// Además del token, consulta la base: si un admin deshabilita una cuenta,
// esa sesión deja de funcionar enseguida y no recién cuando el token vence (8 horas).
export async function authenticate_request(request: Request, jwt_secret: string, db: D1Database): Promise<AuthenticationResult>
{
	const header = request.headers.get('Authorization');
	if (!header || !header.startsWith('Bearer '))
		return { authenticated: false, status: 401, message: 'Token no proporcionado.' };

	const token = header.slice('Bearer '.length);

	let user: TokenUser;
	try
	{
		user = await verify_jwt(token, jwt_secret);
	}
	catch
	{
		return INVALID_SESSION;
	}

	// Esta consulta queda fuera del try a propósito: si la base falla,
	// tiene que verse como un error del servidor y no como un token inválido.
	const account = await db.prepare('SELECT activo FROM usuarios WHERE id = ?').bind(user.usuarioId).first<{ activo: number }>();
	if (!account || account.activo !== 1)
		return INVALID_SESSION;

	return { authenticated: true, payload: user };
}
