import type { Minister } from '../../../shared/models';
import type { LocalDatabase } from '../db/database';
import { read_parish } from './parish';


export function read_minister(db: LocalDatabase, minister_id: number): Minister | null
{
	const minister = db.prepare('SELECT * FROM ministros WHERE id = ?').get(minister_id) as Minister | undefined;
	if (!minister)
		return null;

	return { ...minister, parroquia: read_parish(db, minister.parroquia_id as number) };
}
