import { ServiceError } from '../utils/errors';
import type { Role } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { read_memberships } from './user';

export interface Session
{
	user_id: number;
	role: Role;
	parish_id: number | null;
	token: string;
}

let session: Session | null = null;
let saved_login: { username: string; password: string } | null = null;

export function require_session(): Session
{
	if (!session)
		throw new ServiceError('Sesión no válida.', 401);

	return session;
}

export function current_session(): Session | null
{
	return session;
}

export function saved_credentials(): { username: string; password: string } | null
{
	return saved_login;
}

export function start_session(new_session: Session, username: string, password: string): void
{
	session = new_session;
	saved_login = { username: username, password: password };
}

export function select_working_parish(db: LocalDatabase, parish_id: number): Session
{
	const current = require_session();
	if (current.role === 'admin_general')
		throw new ServiceError('El administrador general no trabaja en ninguna parroquia: solo consulta.', 400);

	const membership = read_memberships(db, current.user_id).find((row) => row.parroquia_id === parish_id);
	if (!membership)
		throw new ServiceError('Esta cuenta no trabaja en esa parroquia: solo puede consultarla.', 403);

	current.role = membership.rol;
	current.parish_id = parish_id;
	return current;
}

export function refresh_working_parish(db: LocalDatabase): void
{
	if (!session || session.role === 'admin_general')
		return;

	const memberships = read_memberships(db, session.user_id);
	const membership = memberships.find((row) => row.parroquia_id === session?.parish_id) ?? memberships.find((row) => row.origen === 1);
	if (!membership)
		return;

	session.role = membership.rol;
	session.parish_id = membership.parroquia_id;
}

export function end_session(): void
{
	session = null;
	saved_login = null;
}
