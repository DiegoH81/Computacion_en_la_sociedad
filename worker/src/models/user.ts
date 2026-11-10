import type { User } from '../../../shared/models';
import type { ParishRole } from '../../../shared/sync';
import type { Actor, TargetUser } from '../../../shared/users';
import type { TokenUser } from '../utils/crypto';

export {
	can_manage_users,
	cannot_change_parishes,
	cannot_create,
	cannot_disable,
	cannot_make_principal,
	cannot_modify,
	is_role,
	password_error,
	role_parish_error,
	USERNAME_PATTERN,
	type Actor,
	type TargetUser,
} from '../../../shared/users';

export const NEW_PRINCIPAL_SQL = `CASE WHEN ? = 'admin_parroquia' AND NOT EXISTS (SELECT 1 FROM membresias WHERE principal = 1 AND parroquia_id = ?) THEN 1 ELSE 0 END`;

export interface Membership
{
	parroquia_id: number;
	rol: ParishRole;
	principal: number;
	origen: number;
}

export async function read_memberships(db: D1Database, user_id: number): Promise<Membership[]>
{
	const rows = await db
		.prepare('SELECT parroquia_id, rol, principal, origen FROM membresias WHERE usuario_id = ? ORDER BY origen DESC, parroquia_id')
		.bind(user_id)
		.all<Membership>();

	return rows.results;
}

// Quien hace el pedido, visto desde una parroquia: su rol en ella si trabaja ahí. Si no, el de su token
// (su parroquia de origen), y entonces las reglas lo tratan como alguien de otra parroquia.
export async function user_in_parish(db: D1Database, user: TokenUser, parish_id: number | null): Promise<TokenUser>
{
	if (user.rol === 'admin_general' || parish_id === null)
		return user;

	const membership = (await read_memberships(db, user.usuarioId)).find((row) => row.parroquia_id === parish_id);
	if (!membership)
		return user;

	return { ...user, rol: membership.rol, parroquiaId: parish_id };
}

export async function actor_in_parish(db: D1Database, user: TokenUser, parish_id: number | null): Promise<Actor>
{
	if (user.rol === 'admin_general')
	{
		const row = await db.prepare('SELECT principal FROM usuarios WHERE id = ?').bind(user.usuarioId).first<{ principal: number }>();
		return { id: user.usuarioId, rol: user.rol, parroquia_id: null, principal: row?.principal === 1 };
	}

	const memberships = await read_memberships(db, user.usuarioId);
	const membership = memberships.find((row) => row.parroquia_id === parish_id) ?? memberships.find((row) => row.origen === 1);
	if (!membership)
		return { id: user.usuarioId, rol: user.rol, parroquia_id: user.parroquiaId, principal: false };

	return { id: user.usuarioId, rol: membership.rol, parroquia_id: membership.parroquia_id, principal: membership.principal === 1 };
}

export interface SavedTarget extends TargetUser
{
	id: number;
	activo: number;
	parroquias: Membership[];
}

// La cuenta que se quiere gestionar, vista desde una parroquia (la de quien la gestiona). Si no
// trabaja en ella, se ve desde su parroquia de origen. Sin parroquia (null): desde la de origen.
export async function read_target_in_parish(db: D1Database, user_id: number, parish_id: number | null): Promise<SavedTarget | null>
{
	const account = await db
		.prepare('SELECT id, rol, parroquia_id, principal, activo FROM usuarios WHERE id = ?')
		.bind(user_id)
		.first<{ id: number; rol: TargetUser['rol']; parroquia_id: number | null; principal: number; activo: number }>();

	if (!account)
		return null;

	const memberships = await read_memberships(db, user_id);
	if (account.rol === 'admin_general')
		return { id: account.id, rol: account.rol, parroquia_id: null, principal: account.principal === 1, activo: account.activo, parroquias: [] };

	const seen_from = memberships.find((row) => row.parroquia_id === parish_id) ?? memberships.find((row) => row.origen === 1);
	const others = memberships.filter((row) => row !== seen_from);

	return {
		id: account.id,
		rol: seen_from?.rol ?? account.rol,
		parroquia_id: seen_from?.parroquia_id ?? account.parroquia_id,
		principal: seen_from?.principal === 1,
		otras_parroquias: others.length > 0,
		principal_en_otra: others.some((row) => row.principal === 1),
		activo: account.activo,
		parroquias: memberships,
	};
}

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

