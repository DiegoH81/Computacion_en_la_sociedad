import type { ParishRole, Role, UserParish } from '../../../shared/sync';
import type { Actor, TargetUser } from '../../../shared/users';
import type { LocalDatabase } from '../db/database';

export interface User
{
	id: number;
	parroquia_id: number | null;
	username: string;
	rol: Role;
	nombre: string;
	apellido_paterno: string;
	apellido_materno: string;
	activo: number;
}

export interface Membership
{
	parroquia_id: number;
	rol: ParishRole;
	principal: number;
	origen: number;
}

export function read_memberships(db: LocalDatabase, user_id: number): Membership[]
{
	return db
		.prepare('SELECT parroquia_id, rol, principal, origen FROM membresias WHERE usuario_id = ? ORDER BY origen DESC, parroquia_id')
		.all(user_id) as Membership[];
}

export function read_user_parishes(db: LocalDatabase, user_id: number): UserParish[]
{
	return db
		.prepare(
			`SELECT m.parroquia_id AS id, p.nombre, m.rol
			 FROM membresias m
			 JOIN parroquias p ON p.id = m.parroquia_id
			 WHERE m.usuario_id = ?
			 ORDER BY m.origen DESC, p.nombre`,
		)
		.all(user_id) as UserParish[];
}

export function actor_in_parish(db: LocalDatabase, user_id: number, role: Role, parish_id: number | null): Actor
{
	if (role === 'admin_general')
	{
		const row = db.prepare('SELECT principal FROM usuarios WHERE id = ?').get(user_id) as { principal: number } | undefined;
		return { id: user_id, rol: role, parroquia_id: null, principal: row?.principal === 1 };
	}

	const membership = read_memberships(db, user_id).find((row) => row.parroquia_id === parish_id);
	return { id: user_id, rol: role, parroquia_id: parish_id, principal: membership?.principal === 1 };
}

export interface LocalTarget extends TargetUser
{
	id: number;
	client_id: string;
	version: number;
	activo: number;
}

export function read_target_in_parish(db: LocalDatabase, user_id: number, parish_id: number | null): LocalTarget | null
{
	const account = db.prepare('SELECT id, client_id, rol, parroquia_id, principal, version, activo FROM usuarios WHERE id = ?').get(user_id) as
		| { id: number; client_id: string; rol: Role; parroquia_id: number | null; principal: number; version: number; activo: number }
		| undefined;

	if (!account)
		return null;

	const base = { id: account.id, client_id: account.client_id, version: account.version, activo: account.activo };
	if (account.rol === 'admin_general')
		return { ...base, rol: account.rol, parroquia_id: null, principal: account.principal === 1 };

	const memberships = read_memberships(db, user_id);
	const seen_from = memberships.find((row) => row.parroquia_id === parish_id) ?? memberships.find((row) => row.origen === 1);
	const others = memberships.filter((row) => row !== seen_from);

	return {
		...base,
		rol: seen_from?.rol ?? account.rol,
		parroquia_id: seen_from?.parroquia_id ?? account.parroquia_id,
		principal: seen_from?.principal === 1,
		otras_parroquias: others.length > 0,
		principal_en_otra: others.some((row) => row.principal === 1),
	};
}