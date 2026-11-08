import type { LocalDatabase } from '../db/database';
import { full_name } from '../utils/helpers';

const MINISTER = 'ministro_id';

export function stored_value(db: LocalDatabase, field: string, value: string | null): string | null
{
	if (field !== MINISTER || value === null)
		return value;

	const row = db.prepare('SELECT client_id FROM ministros WHERE id = ?').get(Number(value)) as { client_id: string } | undefined;
	return row?.client_id ?? null;
}

export function local_value(db: LocalDatabase, field: string, value: string | null): string | null
{
	if (field !== MINISTER || value === null)
		return value;

	const row = db.prepare('SELECT id FROM ministros WHERE client_id = ?').get(value) as { id: number } | undefined;
	return row ? String(row.id) : null;
}

export function display_text(db: LocalDatabase, field: string, value: string | null): string | null
{
	if (field !== MINISTER || value === null)
		return value;

	const row = db.prepare('SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?').get(value) as
		| { titulo: string | null; nombre: string; apellido_paterno: string; apellido_materno: string }
		| undefined;

	if (!row)
		return 'Celebrante desconocido';

	return [row.titulo, full_name(row.nombre, row.apellido_paterno, row.apellido_materno)].filter(Boolean).join(' ');
}
