import { sign_jwt, type Role } from './jwt';
import { verify_password } from './password';

interface UserRow
{
	id: number;
	password_hash: string;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	rol: Role;
	parroquia_id: number | null;
	activo: number;
}

export type LoginResult =
	| {
			success: true;
			token: string;
			usuario: { id: number; nombreCompleto: string; rol: Role; parroquiaId: number | null; parroquiaNombre: string | null };
	  }
	| { success: false; message: string };

// Si el usuario no existe o la contraseña está mal, se responde lo mismo.
// Así nadie puede averiguar qué nombres de usuario existen.
const WRONG_LOGIN: LoginResult = { success: false, message: 'Usuario o contraseña incorrectos.' };

export async function login(db: D1Database, jwt_secret: string, username: string, password: string): Promise<LoginResult>
{
	const user = await db
		.prepare(
			`SELECT id, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo
			 FROM usuarios
			 WHERE username = ?`,
		)
		.bind(username)
		.first<UserRow>();

	if (!user || user.activo !== 1)
		return WRONG_LOGIN;

	const is_valid = await verify_password(password, user.password_hash);
	if (!is_valid)
		return WRONG_LOGIN;

	// Los admin no tienen parroquia.
	let parish_name: string | null = null;
	if (user.parroquia_id !== null)
	{
		const parish = await db.prepare('SELECT nombre FROM parroquias WHERE id = ?').bind(user.parroquia_id).first<{ nombre: string }>();
		parish_name = parish ? parish.nombre : null;
	}

	const token = await sign_jwt({ usuarioId: user.id, rol: user.rol, parroquiaId: user.parroquia_id }, jwt_secret);

	// Si falta el apellido materno, no queda un espacio de más al final.
	const name_parts = [user.nombre, user.apellido_paterno, user.apellido_materno];
	const full_name = name_parts.filter((part) => part).join(' ');

	return {
		success: true,
		token: token,
		usuario: {
			id: user.id,
			nombreCompleto: full_name,
			rol: user.rol,
			parroquiaId: user.parroquia_id,
			parroquiaNombre: parish_name,
		},
	};
}
