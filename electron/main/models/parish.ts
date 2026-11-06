import type { Parish } from '../../../shared/models';
import type { LocalDatabase } from '../db/database';
import { ServiceError } from '../utils/errors';
import type { Session } from './session';

export function read_parish(db: LocalDatabase, parish_id: number): Parish
{
	return db.prepare('SELECT * FROM parroquias WHERE id = ?').get(parish_id) as Parish;
}

export function parish_for_new(session: Session, chosen_parish_id: unknown): number
{
	if (session.role === 'admin')
	{
		if (!Number.isInteger(chosen_parish_id) || (chosen_parish_id as number) <= 0)
			throw new ServiceError('Debe especificar la parroquia.', 400);

		return chosen_parish_id as number;
	}

	if (!session.parish_id)
		throw new ServiceError('El usuario no tiene una parroquia asignada.', 400);

	return session.parish_id;
}

export function check_parish_access(session: Session, parish_id: number, message: string): void
{
	if (session.role !== 'admin' && session.parish_id !== parish_id)
		throw new ServiceError(message, 403);
}