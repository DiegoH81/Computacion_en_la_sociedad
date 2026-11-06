import { ServiceError } from '../utils/errors';
import type { Role } from '../../../shared/sync';

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

export function end_session(): void
{
	session = null;
	saved_login = null;
}
