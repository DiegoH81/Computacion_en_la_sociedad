// POST /api/auth/login   { username, password }  ->  { token, usuario }

import { Hono } from 'hono';
import type { LoginResponse } from '../../../shared/sync';
import type { UserRecord } from '../models/user';
import { sign_jwt, verify_password } from '../utils/crypto';
import { require_json_body } from '../utils/helpers';
import { ServiceError, type AppEnv } from '../utils/middleware';

export async function login(db: D1Database, jwt_secret: string, username: string, password: string): Promise<LoginResponse>
{
	const user = await db
		.prepare(
			`SELECT u.id, u.password_hash, u.nombre, u.apellido_paterno, u.apellido_materno, u.rol, u.parroquia_id, u.activo,
				p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 WHERE u.username = ?`,
		)
		.bind(username)
		.first<UserRecord & { parroquia_nombre: string | null }>();

	if (!user || user.activo !== 1 || !(await verify_password(password, user.password_hash)))
		throw new ServiceError('Usuario o contraseña incorrectos.', 401);

	const token = await sign_jwt({ usuarioId: user.id, rol: user.rol, parroquiaId: user.parroquia_id }, jwt_secret);
	const full_name = [user.nombre, user.apellido_paterno, user.apellido_materno].filter((part) => part).join(' ');

	return {
		token: token,
		usuario: {
			id: user.id,
			nombre_completo: full_name,
			rol: user.rol,
			parroquia_id: user.parroquia_id,
			parroquia_nombre: user.parroquia_nombre,
		},
	};
}

export const login_router = new Hono<AppEnv>();

login_router.post('/login', async (c) =>
{
	const body = await require_json_body(c);

	if (!body.username || !body.password)
		throw new ServiceError('Usuario y contraseña son requeridos.', 400);

	return c.json(await login(c.env.prelatura_db, c.env.JWT_SECRET, body.username, body.password));
});
