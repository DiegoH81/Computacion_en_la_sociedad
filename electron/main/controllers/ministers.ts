import type { Minister, NameColumn, SearchFilters, SearchPage } from '../../../shared/models';
import type { LocalDatabase } from '../db/database';
import { read_minister } from '../models/minister';
import { check_parish_admin, parish_for_new } from '../models/parish';
import type { Session } from '../models/session';
import { add_to_queue } from '../sync/queue';
import { PAGE_SIZE } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { clean_text, page_of, positive_id, sort_direction } from '../utils/helpers';
import type { Routes } from '../utils/middleware';

const NOT_FOUND = 'Ministro no encontrado.';

const SORT_COLUMNS: Record<NameColumn, string> =
{
	nombres: 'nombre',
	apellido_paterno: 'apellido_paterno',
	apellido_materno: 'apellido_materno',
};

type MinisterColumns = Pick<Minister, 'titulo' | 'nombre' | 'apellido_paterno' | 'apellido_materno'>;

function clean_minister(minister: Minister): MinisterColumns
{
	const first_name = clean_text(minister?.nombre);
	if (!first_name)
		throw new ServiceError('El nombre del ministro es requerido.', 400);

	return {
		titulo: clean_text(minister.titulo),
		nombre: first_name,
		apellido_paterno: clean_text(minister.apellido_paterno) ?? '',
		apellido_materno: clean_text(minister.apellido_materno) ?? '',
	};
}

function check_can_manage_minister(db: LocalDatabase, session: Session, id: number): void
{
	const minister = db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').get(id) as { parroquia_id: number } | undefined;

	if (!minister)
		throw new ServiceError(NOT_FOUND, 404);

	check_parish_admin(session, minister.parroquia_id, 'No tiene permiso para modificar ministros de otra parroquia.', 'Solo el administrador de la parroquia puede modificar ministros.');
}

function queue_minister(db: LocalDatabase, id: number): void
{
	const current = db.prepare('SELECT client_id, version FROM ministros WHERE id = ?').get(id) as { client_id: string; version: number };
	add_to_queue(db, 'ministro', current.client_id, current.version);
}

export function search_ministers(db: LocalDatabase, filters: SearchFilters): SearchPage<Minister>
{
	const conditions: string[] = [];
	const values: (string | number)[] = [];

	if (filters.nombres)
	{
		conditions.push('nombre LIKE ?');
		values.push(`%${filters.nombres}%`);
	}
	if (filters.apellido_paterno)
	{
		conditions.push('apellido_paterno LIKE ?');
		values.push(`%${filters.apellido_paterno}%`);
	}
	if (filters.apellido_materno)
	{
		conditions.push('apellido_materno LIKE ?');
		values.push(`%${filters.apellido_materno}%`);
	}

	const words = (clean_text(filters.texto) ?? '').split(/\s+/).filter(Boolean);
	for (const word of words)
	{
		conditions.push(`(COALESCE(titulo, '') || ' ' || nombre || ' ' || apellido_paterno || ' ' || apellido_materno) LIKE ?`);
		values.push(`%${word}%`);
	}
	if (Number.isInteger(filters.parroquia_id))
	{
		conditions.push('parroquia_id = ?');
		values.push(filters.parroquia_id as number);
	}

	let where = '';
	if (conditions.length > 0)
		where = 'WHERE ' + conditions.join(' AND ');

	const count = db.prepare(`SELECT COUNT(*) AS total FROM ministros ${where}`).get(...values) as { total: number };
	const page = page_of(filters, count.total);
	const sort_column = SORT_COLUMNS[filters.orden ?? 'nombres'] ?? SORT_COLUMNS.nombres;

	const ids = db
		.prepare(
			`SELECT id FROM ministros ${where}
			 ORDER BY ${sort_column} ${sort_direction(filters)}, id
			 LIMIT ? OFFSET ?`,
		)
		.pluck()
		.all(...values, PAGE_SIZE, page.offset) as number[];

	return { resultados: ids.map((id) => read_minister(db, id) as Minister), total_paginas: page.total_pages };
}

export function create_minister(db: LocalDatabase, session: Session, minister: Minister): number
{
	const parish_id = parish_for_new(session);
	const values = clean_minister(minister);
	const client_id = crypto.randomUUID();

	const create = db.transaction(() =>
	{
		add_to_queue(db, 'ministro', client_id, null);

		const result = db
			.prepare('INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)')
			.run(client_id, parish_id, values.titulo, values.nombre, values.apellido_paterno, values.apellido_materno);

		return Number(result.lastInsertRowid);
	});

	return create();
}

export function update_minister(db: LocalDatabase, session: Session, minister: Minister): void
{
	const id = positive_id(minister?.id, NOT_FOUND);
	check_can_manage_minister(db, session, id);
	const values = clean_minister(minister);

	const update = db.transaction(() =>
	{
		queue_minister(db, id);
		db.prepare('UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?')
			.run(values.titulo, values.nombre, values.apellido_paterno, values.apellido_materno, id);
	});

	update();
}

export function toggle_minister_active(db: LocalDatabase, session: Session, id: number): void
{
	check_can_manage_minister(db, session, id);

	const toggle = db.transaction(() =>
	{
		queue_minister(db, id);
		db.prepare('UPDATE ministros SET activo = NOT activo WHERE id = ?').run(id);
	});

	toggle();
}

export const minister_routes: Routes =
{
	'ministers.search': (filters: SearchFilters, { db }) =>
	{
		return search_ministers(db, filters);
	},

	'ministers.create': (minister: Minister, { db, session }) =>
	{
		return { id: create_minister(db, session, minister) };
	},

	'ministers.update': (minister: Minister, { db, session }) =>
	{
		update_minister(db, session, minister);
		return { success: true };
	},

	'ministers.toggleActive': (payload: { id: unknown }, { db, session }) =>
	{
		toggle_minister_active(db, session, positive_id(payload.id, NOT_FOUND));
		return { success: true };
	},
};
