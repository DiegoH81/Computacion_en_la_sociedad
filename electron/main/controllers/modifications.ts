import type { Modification, ModificationFilters, ModificationKind, ModificationPage } from '../../../shared/models';
import { HISTORY_EVENT_LABELS, STAFF_EVENT_LABELS, type HistoryEvent, type SacramentType, type StaffEntity, type StaffEvent } from '../../../shared/sync';
import { database_paths } from '../db/app_database';
import type { LocalDatabase } from '../db/database';
import type { Session } from '../models/session';
import { PAGE_SIZE } from '../utils/config';
import { ServiceError } from '../utils/errors';
import { full_name } from '../utils/helpers';
import type { Routes } from '../utils/middleware';
import { read_backup_log } from './backup';

const SACRAMENT_NAMES: Record<SacramentType, string> = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' };
const PC_ACTIONS = { exporto: 'Exportó un respaldo', restauro: 'Restauró un respaldo', exporto_excel: 'Exportó el Excel' } as const;
const UNKNOWN_USER = 'Usuario desconocido';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const IMPORT_GAP_MS = 2 * 60 * 1000;

function check_can_see(db: LocalDatabase, session: Session, requested_parish: unknown): number
{
	if (session.role === 'admin_general')
	{
		if (!Number.isInteger(requested_parish))
			throw new ServiceError('Elija una parroquia.', 400);
		return requested_parish as number;
	}

	const parish_id = session.parish_id;
	const is_principal = parish_id !== null && session.role === 'admin_parroquia' &&
		db.prepare('SELECT 1 FROM membresias WHERE usuario_id = ? AND parroquia_id = ? AND principal = 1').get(session.user_id, parish_id) !== undefined;

	if (!is_principal)
		throw new ServiceError('Solo el administrador principal de la parroquia ve las modificaciones.', 403);

	return parish_id as number;
}

function date_range(filters: ModificationFilters): { from: string; to: string }
{
	let from = '0000';
	let to = '9999';

	if (filters.desde && DAY_PATTERN.test(filters.desde))
		from = new Date(`${filters.desde}T00:00:00`).toISOString();

	if (filters.hasta && DAY_PATTERN.test(filters.hasta))
	{
		const next_day = new Date(`${filters.hasta}T00:00:00`);
		next_day.setDate(next_day.getDate() + 1);
		to = next_day.toISOString();
	}

	return { from: from, to: to };
}

interface UserNameRow
{
	nombre: string | null;
	apellido_paterno: string | null;
	apellido_materno: string | null;
	username: string | null;
}

function user_label(row: UserNameRow): string
{
	return full_name(row.nombre, row.apellido_paterno, row.apellido_materno) || row.username || UNKNOWN_USER;
}


interface RecordHistoryRow extends UserNameRow
{
	evento: HistoryEvent;
	motivo: string | null;
	fecha: string;
	usuario_id: number;
	sacramento_id: number;
	tipo: SacramentType;
	libro: string;
	folio: string;
	numero: string;
}

function import_row_number(reason: string | null): number | null
{
	const match = reason?.match(/^Fila (\d+)/);
	return match ? Number(match[1]) : null;
}

function record_modifications(db: LocalDatabase, parish_id: number, from: string, to: string): Modification[]
{
	const rows = db
		.prepare(
			`SELECT h.evento, h.motivo, h.fecha, h.usuario_id, s.id AS sacramento_id, s.tipo, s.libro, s.folio, s.numero,
				u.nombre, u.apellido_paterno, u.apellido_materno, u.username
			 FROM historial_partidas h
			 JOIN sacramentos s ON s.id = h.sacramento_id
			 LEFT JOIN usuarios u ON u.id = h.usuario_id
			 WHERE s.parroquia_id = ? AND h.fecha >= ? AND h.fecha < ?
			 ORDER BY h.fecha, h.id`,
		)
		.all(parish_id, from, to) as RecordHistoryRow[];

	const result: Modification[] = [];
	let batch: { first: RecordHistoryRow; last: RecordHistoryRow; count: number; rows: number[] } | null = null;

	function close_batch()
	{
		if (!batch)
			return;

		const rows_text = batch.rows.length > 0 ? `Filas ${Math.min(...batch.rows)} a ${Math.max(...batch.rows)} del Excel` : null;
		result.push({
			fecha: batch.last.fecha,
			usuario: user_label(batch.first),
			tipo: 'partidas',
			accion: 'Importó del sistema anterior',
			sobre: `${batch.count} ${batch.count === 1 ? 'partida' : 'partidas'}`,
			detalle: rows_text,
			sacramento_id: null,
		});
		batch = null;
	}

	for (const row of rows)
	{
		if (row.evento === 'importada')
		{
			const same_batch = batch !== null && batch.first.usuario_id === row.usuario_id &&
				Date.parse(row.fecha) - Date.parse(batch.last.fecha) <= IMPORT_GAP_MS;
			if (!same_batch)
			{
				close_batch();
				batch = { first: row, last: row, count: 0, rows: [] };
			}

			const current = batch as NonNullable<typeof batch>;
			current.last = row;
			current.count += 1;
			const number = import_row_number(row.motivo);
			if (number !== null)
				current.rows.push(number);
			continue;
		}

		close_batch();
		result.push({
			fecha: row.fecha,
			usuario: user_label(row),
			tipo: 'partidas',
			accion: HISTORY_EVENT_LABELS[row.evento] ?? row.evento,
			sobre: `${SACRAMENT_NAMES[row.tipo]}: libro ${row.libro}, folio ${row.folio}, registro ${row.numero}`,
			detalle: row.motivo,
			sacramento_id: row.sacramento_id,
		});
	}

	close_batch();
	return result;
}


interface StaffHistoryRow extends UserNameRow
{
	entidad: StaffEntity;
	evento: StaffEvent;
	detalle: string | null;
	fecha: string;
	ministro_titulo: string | null;
	ministro_nombre: string | null;
	ministro_paterno: string | null;
	ministro_materno: string | null;
	cuenta_nombre: string | null;
	cuenta_paterno: string | null;
	cuenta_materno: string | null;
	cuenta_username: string | null;
}

function staff_subject(row: StaffHistoryRow): string
{
	if (row.entidad === 'ministro')
	{
		const name = full_name(row.ministro_nombre, row.ministro_paterno, row.ministro_materno);
		return name ? [row.ministro_titulo, name].filter(Boolean).join(' ') : '(ministro que no está en esta PC)';
	}

	const name = full_name(row.cuenta_nombre, row.cuenta_paterno, row.cuenta_materno);
	if (!row.cuenta_username)
		return '(cuenta que no está en esta PC)';
	return name ? `${name} (${row.cuenta_username})` : row.cuenta_username;
}

function staff_modifications(db: LocalDatabase, parish_id: number, from: string, to: string): Modification[]
{
	const rows = db
		.prepare(
			`SELECT h.entidad, h.evento, h.detalle, h.fecha,
				u.nombre, u.apellido_paterno, u.apellido_materno, u.username,
				m.titulo AS ministro_titulo, m.nombre AS ministro_nombre, m.apellido_paterno AS ministro_paterno, m.apellido_materno AS ministro_materno,
				c.nombre AS cuenta_nombre, c.apellido_paterno AS cuenta_paterno, c.apellido_materno AS cuenta_materno, c.username AS cuenta_username
			 FROM historial_ministros_cuentas h
			 LEFT JOIN usuarios u ON u.client_id = h.usuario_client_id
			 LEFT JOIN ministros m ON h.entidad = 'ministro' AND m.client_id = h.entidad_client_id
			 LEFT JOIN usuarios c ON h.entidad = 'usuario' AND c.client_id = h.entidad_client_id
			 WHERE h.parroquia_id = ? AND h.fecha >= ? AND h.fecha < ?`,
		)
		.all(parish_id, from, to) as StaffHistoryRow[];

	return rows.map((row) => ({
		fecha: row.fecha,
		usuario: user_label(row),
		tipo: row.entidad === 'ministro' ? 'ministros' : 'cuentas',
		accion: STAFF_EVENT_LABELS[row.entidad][row.evento] ?? row.evento,
		sobre: staff_subject(row),
		detalle: row.detalle,
		sacramento_id: null,
	}));
}


function pc_modifications(from: string, to: string): Modification[]
{
	return read_backup_log(database_paths().directory)
		.filter((entry) => entry.fecha >= from && entry.fecha < to)
		.map((entry) => ({
			fecha: entry.fecha,
			usuario: entry.usuario,
			tipo: 'pc' as ModificationKind,
			accion: PC_ACTIONS[entry.accion] ?? entry.accion,
			sobre: entry.archivo,
			detalle: 'En esta PC',
			sacramento_id: null,
		}));
}

export function list_modifications(db: LocalDatabase, session: Session, filters: ModificationFilters): ModificationPage
{
	const parish_id = check_can_see(db, session, filters?.parroquia_id);
	const { from, to } = date_range(filters ?? {});

	const all = [
		...record_modifications(db, parish_id, from, to),
		...staff_modifications(db, parish_id, from, to),
		...pc_modifications(from, to),
	];

	const users = [...new Set(all.map((item) => item.usuario))].sort((a, b) => a.localeCompare(b, 'es'));

	const shown = all
		.filter((item) => !filters?.tipo || item.tipo === filters.tipo)
		.filter((item) => !filters?.usuario || item.usuario === filters.usuario)
		.sort((a, b) => b.fecha.localeCompare(a.fecha));

	const page = Number.isInteger(filters?.pagina) && (filters.pagina as number) > 0 ? (filters.pagina as number) : 1;
	const offset = (page - 1) * PAGE_SIZE;

	return {
		resultados: shown.slice(offset, offset + PAGE_SIZE),
		total_paginas: Math.max(1, Math.ceil(shown.length / PAGE_SIZE)),
		usuarios: users,
	};
}

export const modification_routes: Routes =
{
	'modifications.list': (filters: ModificationFilters, { db, session }) =>
	{
		return list_modifications(db, session, filters ?? {});
	},
};
