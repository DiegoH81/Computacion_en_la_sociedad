import type { User } from '../../../shared/models';

export {
	can_manage_users,
	cannot_create,
	cannot_disable,
	cannot_make_principal,
	cannot_modify,
	is_role,
	role_parish_error,
	USERNAME_PATTERN,
	type Actor,
	type TargetUser,
} from '../../../shared/users';

export const NEW_PRINCIPAL_SQL = `CASE WHEN ? = 'admin_parroquia' AND NOT EXISTS (SELECT 1 FROM usuarios WHERE principal = 1 AND parroquia_id = ?) THEN 1 ELSE 0 END`;

export interface UserRecord extends Omit<User, 'password' | 'parroquia_nueva' | 'parroquia_nombre'>
{
	id: number;
	client_id: string;
	password_hash: string;
	activo: number;
	version: number;
	created_at: string;
}

export const PASSWORD_HASH_PATTERN = /^\d{4,7}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/;

