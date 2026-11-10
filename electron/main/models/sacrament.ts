import type { Sacrament } from '../../../shared/models';
import type { SacramentType } from '../../../shared/sync';
import type { LocalDatabase } from '../db/database';
import { ServiceError } from '../utils/errors';
import { clean_text } from '../utils/helpers';
import { read_minister } from './minister';
import { check_parish_admin, read_parish } from './parish';
import type { Session } from './session';

export function is_sacrament_type(value: unknown): value is SacramentType
{
	return value === 'bautismo' || value === 'confirmacion' || value === 'matrimonio';
}

export function detail_table(type: SacramentType): 'bautismos' | 'confirmaciones' | 'matrimonios'
{
	if (type === 'bautismo')
		return 'bautismos';

	if (type === 'confirmacion')
		return 'confirmaciones';

	return 'matrimonios';
}

export function person_columns(type: SacramentType): string[]
{
	if (type === 'matrimonio')
		return ['conyuge_1_id', 'conyuge_2_id'];

	return ['persona_id'];
}

export function people_of(type: SacramentType): string
{
	if (type === 'bautismo')
		return 'SELECT sacramento_id, persona_id FROM bautismos';

	if (type === 'confirmacion')
		return 'SELECT sacramento_id, persona_id FROM confirmaciones';

	return `SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios
		UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios`;
}

export const PEOPLE_OF_ALL_SACRAMENTS = `SELECT sacramento_id, persona_id FROM bautismos
	UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones
	UNION ALL SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios
	UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios`;

export function read_sacrament(db: LocalDatabase, sacrament_id: number): Sacrament | null
{
	const sacrament = db.prepare('SELECT * FROM sacramentos WHERE id = ?').get(sacrament_id) as Sacrament | undefined;
	if (!sacrament)
		return null;

	let minister = null;
	if (sacrament.ministro_id !== null)
		minister = read_minister(db, sacrament.ministro_id);

	return { ...sacrament, parroquia: read_parish(db, sacrament.parroquia_id as number), ministro: minister };
}


type SacramentColumns = Pick<Sacrament, 'fecha_emision' | 'libro' | 'folio' | 'numero' | 'ministro_id' | 'fecha_evento' | 'anotaciones'>;

function clean_sacrament(sacrament: Sacrament): SacramentColumns
{
	const issue_date = clean_text(sacrament.fecha_emision);
	const book = clean_text(sacrament.libro);
	const page = clean_text(sacrament.folio);
	const number = clean_text(sacrament.numero);

	if (!book || !page || !number)
		throw new ServiceError('El libro, el folio y el número de registro son requeridos.', 400);

	return {
		fecha_emision: issue_date,
		libro: book,
		folio: page,
		numero: number,
		ministro_id: sacrament.ministro_id ?? null,
		fecha_evento: clean_text(sacrament.fecha_evento),
		anotaciones: clean_text(sacrament.anotaciones),
	};
}

export function sacrament_parish(db: LocalDatabase, sacrament_id: number, type: SacramentType): number
{
	const sacrament = db.prepare('SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?').get(sacrament_id, type) as { parroquia_id: number } | undefined;

	if (!sacrament)
		throw new ServiceError('Partida no encontrada.', 404);

	return sacrament.parroquia_id;
}

export const OTHER_PARISH_RECORD = 'No tiene permiso para modificar partidas de otra parroquia.';

export function check_can_manage(db: LocalDatabase, session: Session, sacrament_id: number, type: SacramentType): void
{
	const parish_id = sacrament_parish(db, sacrament_id, type);
	check_parish_admin(session, parish_id, OTHER_PARISH_RECORD, 'Solo el administrador de la parroquia puede modificar o anular una partida. Pida la corrección con una nota marginal.');
}

function check_minister_parish(db: LocalDatabase, minister_id: number | null, parish_id: number): void
{
	if (minister_id === null)
		return;

	const minister = db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').get(minister_id) as { parroquia_id: number } | undefined;
	if (minister && minister.parroquia_id !== parish_id)
		throw new ServiceError('El celebrante debe ser de la parroquia de la partida.', 400);
}


export function insert_sacrament(db: LocalDatabase, client_id: string, type: SacramentType, parish_id: number, sacrament: Sacrament): number
{
	const values = clean_sacrament(sacrament);
	check_minister_parish(db, values.ministro_id, parish_id);

	const result = db
		.prepare(
			`INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(client_id, type, parish_id, values.ministro_id, values.libro, values.folio, values.numero, values.fecha_emision, values.fecha_evento, values.anotaciones);

	return Number(result.lastInsertRowid);
}

export function update_sacrament(db: LocalDatabase, sacrament_id: number, sacrament: Sacrament): void
{
	const values = clean_sacrament(sacrament);
	const current = db.prepare('SELECT ministro_id, parroquia_id FROM sacramentos WHERE id = ?').get(sacrament_id) as { ministro_id: number | null; parroquia_id: number };

	if (values.ministro_id !== current.ministro_id)
		check_minister_parish(db, values.ministro_id, current.parroquia_id);

	db.prepare(
		`UPDATE sacramentos
		 SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?
		 WHERE id = ?`,
	).run(values.ministro_id, values.libro, values.folio, values.numero, values.fecha_emision, values.fecha_evento, values.anotaciones, sacrament_id);
}
