import type { Parish } from '../../../shared/models';
import type { LocalDatabase } from '../db/database';
import { ServiceError } from '../utils/errors';
import type { Session } from './session';

const GENERAL_ADMIN_READS_ONLY = 'El administrador general solo consulta: no puede registrar ni modificar datos de las parroquias.';

export function read_parish(db: LocalDatabase, parish_id: number): Parish
{
	return db.prepare('SELECT * FROM parroquias WHERE id = ?').get(parish_id) as Parish;
}

export function parish_for_new(session: Session): number
{
	if (session.role === 'admin_general')
		throw new ServiceError(GENERAL_ADMIN_READS_ONLY, 403);

	if (!session.parish_id)
		throw new ServiceError('El usuario no tiene una parroquia asignada.', 400);

	return session.parish_id;
}

export function check_parish_access(session: Session, parish_id: number, message: string): void
{
	if (session.role === 'admin_general')
		throw new ServiceError(GENERAL_ADMIN_READS_ONLY, 403);

	if (session.parish_id !== parish_id)
		throw new ServiceError(message, 403);
}

export function check_parish_read(session: Session, parish_id: number, message: string): void
{
	if (session.role !== 'admin_general' && session.parish_id !== parish_id)
		throw new ServiceError(message, 403);
}

export function check_parish_admin(session: Session, parish_id: number, other_parish: string, only_admin: string): void
{
	check_parish_access(session, parish_id, other_parish);

	if (session.role !== 'admin_parroquia')
		throw new ServiceError(only_admin, 403);
}