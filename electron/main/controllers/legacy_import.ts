// Importar las partidas del Excel del sistema anterior (ver import/legacy_excel.ts).
//
//   legacyImport.preview   abre el selector de archivos, lee el Excel y dice cuántas partidas son nuevas,
//                          cuáles ya están en el sistema y qué filas no se pudieron leer. No guarda nada.
//   legacyImport.confirm   guarda las nuevas. Las que ya están no se tocan.
//
// Solo lo hace el párroco (admin_parroquia), y siempre en su parroquia. Una partida "ya está" si en
// la parroquia hay otra con el mismo tipo, libro, folio y número. Las importadas se anotan en la cola
// y se suben al sincronizar, como si se hubieran digitado.

import { BrowserWindow, dialog } from 'electron';
import readXlsxFile from 'read-excel-file/node';
import type { Person, Sacrament } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { FormatError, read_workbook, register_key, type ImportedMinister, type ImportedPerson, type ImportedRecord, type RowError } from '../import/legacy_excel';
import { add_history } from '../models/history';
import { insert_person } from '../models/person';
import { detail_table, insert_sacrament } from '../models/sacrament';
import type { Session } from '../models/session';
import { add_to_queue } from '../sync/queue';
import { ServiceError } from '../utils/errors';
import type { Routes } from '../utils/middleware';

const ONLY_ADMIN = 'Solo el administrador de la parroquia puede importar partidas.';

export interface ExistingRecord
{
	fila: number;
	tipo: SacramentType;
	libro: string;
	folio: string;
	numero: string;
	nombre: string;
}

export interface ImportPlan
{
	nuevas: ImportedRecord[];
	existentes: ExistingRecord[];
	errores: RowError[];
}

export interface ImportPreview
{
	archivo: string;
	codigos_parroquia: string[];
	total: number;
	nuevas: number;
	por_tipo: Record<SacramentType, number>;
	existentes: ExistingRecord[];
	errores: RowError[];
}

function import_parish(session: Session): number
{
	if (session.role !== 'admin_parroquia' || !session.parish_id)
		throw new ServiceError(ONLY_ADMIN, 403);

	return session.parish_id;
}

function full_name(person: ImportedPerson): string
{
	return [person.nombres, person.apellido_paterno, person.apellido_materno].filter((part) => part).join(' ');
}

// Separa las partidas nuevas de las que ya están en la parroquia.
export function plan_import(db: LocalDatabase, parish_id: number, parsed: { partidas: ImportedRecord[]; errores: RowError[] }): ImportPlan
{
	const saved = db.prepare('SELECT tipo, libro, folio, numero FROM sacramentos WHERE parroquia_id = ?').all(parish_id) as Pick<ImportedRecord, 'tipo' | 'libro' | 'folio' | 'numero'>[];
	const saved_keys = new Set(saved.map(register_key));

	const plan: ImportPlan = { nuevas: [], existentes: [], errores: parsed.errores };

	for (const record of parsed.partidas)
	{
		if (!saved_keys.has(register_key(record)))
		{
			plan.nuevas.push(record);
			continue;
		}

		plan.existentes.push({
			fila: record.fila,
			tipo: record.tipo,
			libro: record.libro,
			folio: record.folio,
			numero: record.numero,
			nombre: record.personas.map(full_name).join(' y '),
		});
	}

	return plan;
}

// ---------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------

function normalize(text: string): string
{
	return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function minister_key(minister: Pick<ImportedMinister, 'nombre' | 'apellido_paterno' | 'apellido_materno'>): string
{
	return normalize([minister.nombre, minister.apellido_paterno, minister.apellido_materno].filter((part) => part).join(' '));
}

// El celebrante se busca por nombre entre los ministros de la parroquia; si no está, se crea.
function minister_finder(db: LocalDatabase, parish_id: number): (minister: ImportedMinister | null) => number | null
{
	const known = new Map<string, number>();
	const rows = db.prepare('SELECT id, nombre, apellido_paterno, apellido_materno FROM ministros WHERE parroquia_id = ?').all(parish_id) as (ImportedMinister & { id: number })[];
	for (const row of rows)
		known.set(minister_key(row), row.id);

	const insert = db.prepare(
		'INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)',
	);

	return (minister) =>
	{
		if (!minister)
			return null;

		const key = minister_key(minister);
		const found = known.get(key);
		if (found !== undefined)
			return found;

		const client_id = crypto.randomUUID();
		add_to_queue(db, 'ministro', client_id, null);
		const id = Number(insert.run(client_id, parish_id, minister.titulo, minister.nombre, minister.apellido_paterno, minister.apellido_materno).lastInsertRowid);

		known.set(key, id);
		return id;
	};
}

function as_person(person: ImportedPerson): Person
{
	return { ...person, cambios: [] };
}

function save_record(db: LocalDatabase, session: Session, parish_id: number, record: ImportedRecord, minister_id: number | null): void
{
	const people_ids = record.personas.map((person) => insert_person(db, parish_id, as_person(person)));

	const sacrament: Sacrament =
	{
		tipo: record.tipo,
		ministro_id: minister_id,
		libro: record.libro,
		folio: record.folio,
		numero: record.numero,
		fecha_emision: record.fecha_emision,
		fecha_evento: record.fecha_evento,
		anotaciones: record.anotaciones,
	};

	const client_id = crypto.randomUUID();
	add_to_queue(db, record.tipo, client_id, null);
	const sacrament_id = insert_sacrament(db, client_id, record.tipo, parish_id, sacrament);
	add_history(db, sacrament_id, session.user_id, 'importada', [], `Fila ${record.fila} del Excel del sistema anterior`);

	const detail = record.detalle;
	if (record.tipo === 'matrimonio')
	{
		db.prepare(
			`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			sacrament_id,
			people_ids[0],
			people_ids[1],
			detail.lugar,
			detail.testigo_1,
			detail.testigo_2,
			detail.testigo_3,
			detail.testigo_4,
			detail.conyuge_1_bautismo_parroquia,
			detail.conyuge_1_bautismo_fecha,
			detail.conyuge_2_bautismo_parroquia,
			detail.conyuge_2_bautismo_fecha,
		);
		return;
	}

	db.prepare(`INSERT INTO ${detail_table(record.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`)
		.run(sacrament_id, people_ids[0], detail.padrino_1, detail.padrino_2);
}

// Guarda las partidas nuevas, todas o ninguna. Vuelve a revisar las repetidas justo antes, por si
// alguien registró una mientras tanto. Devuelve cuántas se guardaron y cuántas se saltaron.
export function save_import(db: LocalDatabase, session: Session, records: ImportedRecord[]): { importadas: number; omitidas: number }
{
	const parish_id = import_parish(session);

	const save = db.transaction(() =>
	{
		const plan = plan_import(db, parish_id, { partidas: records, errores: [] });
		const find_minister = minister_finder(db, parish_id);

		for (const record of plan.nuevas)
			save_record(db, session, parish_id, record, find_minister(record.celebrante));

		return { importadas: plan.nuevas.length, omitidas: plan.existentes.length };
	});

	return save();
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

// Lo leído en la vista previa, hasta que se confirme. Solo hay una importación a la vez.
let pending: { token: string; parish_id: number; records: ImportedRecord[] } | null = null;

export function today(): string
{
	return new Date().toISOString().slice(0, 10);
}

export async function read_legacy_file(file_path: string): Promise<{ partidas: ImportedRecord[]; errores: RowError[] }>
{
	let sheets: { sheet: string; data: unknown[][] }[];
	try
	{
		sheets = await readXlsxFile(file_path);
	}
	catch
	{
		throw new ServiceError('No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) exportado del sistema anterior.', 400);
	}

	try
	{
		return read_workbook(sheets, today());
	}
	catch (error)
	{
		if (error instanceof FormatError)
			throw new ServiceError(error.message, 400);

		throw error;
	}
}

export function preview_of(file_name: string, plan: ImportPlan): ImportPreview
{
	const by_type: Record<SacramentType, number> = { bautismo: 0, confirmacion: 0, matrimonio: 0 };
	for (const record of plan.nuevas)
		by_type[record.tipo] += 1;

	const codes = new Set<string>();
	for (const record of [...plan.nuevas])
	{
		if (record.codigo_parroquia)
			codes.add(record.codigo_parroquia);
	}

	return {
		archivo: file_name,
		codigos_parroquia: [...codes],
		total: plan.nuevas.length + plan.existentes.length,
		nuevas: plan.nuevas.length,
		por_tipo: by_type,
		existentes: plan.existentes,
		errores: plan.errores,
	};
}

export const legacy_import_routes: Routes =
{
	'legacyImport.preview': async (_payload, { db, session }) =>
	{
		const parish_id = import_parish(session);

		const window = BrowserWindow.getFocusedWindow();
		const options = {
			title: 'Elegir el Excel del sistema anterior',
			properties: ['openFile' as const],
			filters: [{ name: 'Excel', extensions: ['xlsx'] }],
		};
		const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
		if (choice.canceled || choice.filePaths.length === 0)
			return { cancelado: true };

		const file_path = choice.filePaths[0];
		const plan = plan_import(db, parish_id, await read_legacy_file(file_path));

		pending = { token: crypto.randomUUID(), parish_id: parish_id, records: plan.nuevas };
		return { cancelado: false, token: pending.token, ...preview_of(file_path.split(/[\\/]/).pop() ?? file_path, plan) };
	},

	'legacyImport.confirm': (payload: { token: unknown }, { db, session }) =>
	{
		if (!pending || payload?.token !== pending.token || pending.parish_id !== session.parish_id)
			throw new ServiceError('Vuelva a elegir el archivo: la vista previa ya no es válida.', 409);

		const records = pending.records;
		pending = null;
		return save_import(db, session, records);
	},
};
