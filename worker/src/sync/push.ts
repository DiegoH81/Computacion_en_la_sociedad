// POST /api/sync/push: guarda en la base online los cambios que hizo una PC.


import type { ChangeResult, PersonCorrection, PersonData, RecordData, SacramentType, SyncChange, UserData } from '../../../shared/sync';
import { PERSON_COLUMNS } from '../../../shared/record_fields';
import { is_sacrament_type } from '../models/sacrament';
import { cannot_create, cannot_disable, cannot_modify, NEW_PRINCIPAL_SQL, role_parish_error } from '../models/user';
import { read_actor } from '../controllers/users';
import type { TokenUser } from '../utils/crypto';
import { read_record } from './pull';
import { check_helper_edit, check_helper_new, save_new_history, save_requests, users_named } from './requests';
import { check_minister, check_record, check_user, RejectedChange } from './validation';

const CONFLICT_REASON = 'Otra PC modificó este registro antes de que se subiera este cambio.';

const NOW_SQL = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

interface SavedVersion
{
	version: number;
	ultimo_cola_id: string | null;
}

interface SavedMinister extends SavedVersion
{
	parroquia_id: number;
}

interface SavedRecord extends SavedVersion
{
	id: number;
	tipo: string;
	parroquia_id: number;
	estado: string;
}

interface SavedUser extends SavedVersion
{
	id: number;
	username: string;
	rol: string;
	parroquia_id: number | null;
	activo: number;
	principal: number;
}

type VersionedTable = 'sacramentos' | 'ministros' | 'usuarios';

function check_permission(user: TokenUser, parish_id: number, what: string): void
{
	if (user.rol === 'admin_general')
		throw new RejectedChange(`El administrador general solo consulta: no puede modificar ${what}.`);

	if (user.parroquiaId !== parish_id)
		throw new RejectedChange(`No tiene permiso para modificar ${what} de otra parroquia.`);
}


function find_conflict(change: SyncChange, saved: SavedVersion): ChangeResult | null
{
	if (saved.ultimo_cola_id === change.cola_id)
		return null;

	if (change.version_base === saved.version)
		return null;

	return { entidad: change.entidad, client_id: change.client_id, estado: 'conflicto', version: saved.version, motivo: CONFLICT_REASON };
}


function version_guard(db: D1Database, table: VersionedTable, client_id: string, version: number): D1PreparedStatement
{
	const sql = `SELECT CASE WHEN (SELECT version FROM ${table} WHERE client_id = ?) = ? THEN 1 ELSE json('version distinta') END`;
	return db.prepare(sql).bind(client_id, version);
}

function is_version_guard_error(error: unknown): boolean
{
	return error instanceof Error && /malformed JSON/i.test(error.message);
}

function table_of(entity: string): VersionedTable
{
	if (entity === 'ministro')
		return 'ministros';

	if (entity === 'usuario')
		return 'usuarios';

	return 'sacramentos';
}

// Ministers

async function apply_minister(db: D1Database, user: TokenUser, change: SyncChange): Promise<ChangeResult>
{
	const minister = check_minister(change.datos);
	if (minister.client_id !== change.client_id)
		throw new RejectedChange('El registro no coincide con el cambio.');

	check_permission(user, minister.parroquia_id, 'ministros');

	const saved = await db
		.prepare('SELECT parroquia_id, version, ultimo_cola_id FROM ministros WHERE client_id = ?')
		.bind(minister.client_id)
		.first<SavedMinister>();

	const writes: D1PreparedStatement[] = [];

	if (saved)
	{
		check_permission(user, saved.parroquia_id, 'ministros');
		if (saved.parroquia_id !== minister.parroquia_id)
			throw new RejectedChange('La parroquia de un ministro no se puede cambiar.');

		const is_resend = saved.ultimo_cola_id === change.cola_id;
		if (user.rol === 'usuario' && !is_resend)
			throw new RejectedChange('Solo el administrador de la parroquia puede modificar ministros.');

		const conflict = find_conflict(change, saved);
		if (conflict)
			return conflict;

		writes.push(version_guard(db, 'ministros', minister.client_id, saved.version));
		writes.push(
			db
				.prepare(
					`UPDATE ministros
					 SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, ultimo_cola_id = ?
					 WHERE client_id = ?`,
				)
				.bind(minister.titulo, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, change.cola_id, minister.client_id),
		);
	}
	else
	{
		writes.push(
			db
				.prepare(
					`INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, ultimo_cola_id, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${NOW_SQL})`,
				)
				.bind(minister.client_id, minister.parroquia_id, minister.titulo, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, change.cola_id),
		);
	}

	writes.push(db.prepare('SELECT version FROM ministros WHERE client_id = ?').bind(minister.client_id));

	const results = await db.batch<{ version: number }>(writes);
	const version = results[results.length - 1].results[0].version;

	return { entidad: 'ministro', client_id: minister.client_id, estado: 'aplicado', version: version };
}

async function apply_user(db: D1Database, user: TokenUser, change: SyncChange): Promise<ChangeResult>
{
	const account: UserData = check_user(change.datos);
	if (account.client_id !== change.client_id)
		throw new RejectedChange('El registro no coincide con el cambio.');

	const actor = await read_actor(db, user);

	const saved = await db
		.prepare('SELECT id, username, rol, parroquia_id, activo, principal, version, ultimo_cola_id FROM usuarios WHERE client_id = ?')
		.bind(account.client_id)
		.first<SavedUser>();

	const writes: D1PreparedStatement[] = [];

	if (saved)
	{
		if (saved.rol !== account.rol || saved.parroquia_id !== account.parroquia_id)
			throw new RejectedChange('El rol y la parroquia de una cuenta no se pueden cambiar.');

		if (saved.username !== account.username)
			throw new RejectedChange('El nombre de usuario no se puede cambiar.');

		const reason = cannot_modify(actor, { id: saved.id, rol: account.rol, parroquia_id: account.parroquia_id });
		if (reason)
			throw new RejectedChange(reason);

		const disable_reason = saved.activo === 1 && account.activo !== 1 ? cannot_disable({ ...account, principal: saved.principal === 1 }) : null;
		if (disable_reason)
			throw new RejectedChange(disable_reason);

		if (saved.id === actor.id && saved.activo !== account.activo)
			throw new RejectedChange('No puede deshabilitar su propia cuenta.');

		const conflict = find_conflict(change, saved);
		if (conflict)
			return conflict;

		writes.push(version_guard(db, 'usuarios', account.client_id, saved.version));
		writes.push(
			db
				.prepare(
					`UPDATE usuarios
					 SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?,
						password_hash = COALESCE(?, password_hash), ultimo_cola_id = ?
					 WHERE client_id = ?`,
				)
				.bind(account.nombre, account.apellido_paterno, account.apellido_materno, account.activo, account.password_hash ?? null, change.cola_id, account.client_id),
		);
	}
	else
	{
		const target = { rol: account.rol, parroquia_id: account.parroquia_id };
		const reason = role_parish_error(target) ?? cannot_create(actor, target);
		if (reason)
			throw new RejectedChange(reason);

		if (!account.password_hash)
			throw new RejectedChange('Falta la contraseña de la cuenta nueva.');

		const [parish, taken] = await db.batch([
			db.prepare('SELECT 1 FROM parroquias WHERE id = ? AND activa = 1').bind(account.parroquia_id),
			db.prepare('SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE').bind(account.username),
		]);

		if (account.parroquia_id !== null && parish.results.length === 0)
			throw new RejectedChange('La parroquia de la cuenta no existe en el servidor.');

		if (taken.results.length > 0)
			throw new RejectedChange('Ese nombre de usuario ya existe. Cámbielo en esta PC.');

		writes.push(
			db
				.prepare(
					`INSERT INTO usuarios
						(client_id, username, password_hash, rol, parroquia_id, nombre, apellido_paterno, apellido_materno, activo, ultimo_cola_id, updated_at, principal)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${NOW_SQL}, ${NEW_PRINCIPAL_SQL})`,
				)
				.bind(
					account.client_id,
					account.username,
					account.password_hash,
					account.rol,
					account.parroquia_id,
					account.nombre,
					account.apellido_paterno,
					account.apellido_materno,
					account.activo,
					change.cola_id,
					account.rol,
					account.parroquia_id,
				),
		);
	}

	writes.push(db.prepare('SELECT id, version FROM usuarios WHERE client_id = ?').bind(account.client_id));

	const results = await db.batch<{ id: number; version: number }>(writes);
	const row = results[results.length - 1].results[0];

	return { entidad: 'usuario', client_id: account.client_id, estado: 'aplicado', version: row.version, id: row.id };
}

// Sacraments

function sacrament_table(type: SacramentType): string
{
	if (type === 'bautismo')
		return 'bautismos';

	if (type === 'confirmacion')
		return 'confirmaciones';

	return 'matrimonios';
}


async function read_saved_people(db: D1Database, type: SacramentType, record_id: number): Promise<string[] | null>
{
	if (type === 'matrimonio')
	{
		const row = await db
			.prepare(
				`SELECT (SELECT client_id FROM personas WHERE id = conyuge_1_id) AS spouse_1,
				        (SELECT client_id FROM personas WHERE id = conyuge_2_id) AS spouse_2
				 FROM matrimonios
				 WHERE sacramento_id = ?`,
			)
			.bind(record_id)
			.first<{ spouse_1: string; spouse_2: string }>();

		if (!row)
			return null;

		return [row.spouse_1, row.spouse_2];
	}

	const table = sacrament_table(type);
	const row = await db
		.prepare(`SELECT (SELECT client_id FROM personas WHERE id = persona_id) AS person FROM ${table} WHERE sacramento_id = ?`)
		.bind(record_id)
		.first<{ person: string }>();

	if (!row)
		return null;

	return [row.person];
}

// Person
function save_person(db: D1Database, parish_id: number, person: PersonData): D1PreparedStatement
{
	const columns = PERSON_COLUMNS.join(', ');
	const marks = PERSON_COLUMNS.map(() => '?').join(', ');
	const updates = PERSON_COLUMNS.map((field) => `${field} = excluded.${field}`).join(', ');
	const values = PERSON_COLUMNS.map((field) => person[field]);

	return db
		.prepare(
			`INSERT INTO personas (client_id, parroquia_id, ${columns})
			 VALUES (?, ?, ${marks})
			 ON CONFLICT (client_id) DO UPDATE SET ${updates}`,
		)
		.bind(person.client_id, parish_id, ...values);
}

// Sacraments
function save_sacrament(db: D1Database, record: RecordData, queue_id: string): D1PreparedStatement
{
	return db
		.prepare(
			`INSERT INTO sacramentos
				(client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
				 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, ultimo_cola_id)
			 VALUES (?, ?, ?, (SELECT id FROM ministros WHERE client_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (client_id) DO UPDATE SET
				ministro_id = excluded.ministro_id,
				libro = excluded.libro,
				folio = excluded.folio,
				numero = excluded.numero,
				fecha_emision = excluded.fecha_emision,
				fecha_evento = excluded.fecha_evento,
				anotaciones = excluded.anotaciones,
				estado = excluded.estado,
				anulado_por_usuario_id = excluded.anulado_por_usuario_id,
				anulado_en = excluded.anulado_en,
				motivo_anulacion = excluded.motivo_anulacion,
				ultimo_cola_id = excluded.ultimo_cola_id`,
		)
		.bind(
			record.client_id,
			record.tipo,
			record.parroquia_id,
			record.ministro_client_id,
			record.libro,
			record.folio,
			record.numero,
			record.fecha_emision,
			record.fecha_evento,
			record.anotaciones,
			record.estado,
			record.anulado_por_usuario_id,
			record.anulado_en,
			record.motivo_anulacion,
			queue_id,
		);
}

function save_godparents(db: D1Database, table: string, record: RecordData): D1PreparedStatement
{
	return db
		.prepare(
			`INSERT INTO ${table} (sacramento_id, persona_id, padrino_1, padrino_2)
			 VALUES ((SELECT id FROM sacramentos WHERE client_id = ?), (SELECT id FROM personas WHERE client_id = ?), ?, ?)
			 ON CONFLICT (sacramento_id) DO UPDATE SET
				padrino_1 = excluded.padrino_1,
				padrino_2 = excluded.padrino_2`,
		)
		.bind(record.client_id, record.personas[0].client_id, record.detalle.padrino_1, record.detalle.padrino_2);
}

// Marriage
function save_marriage(db: D1Database, record: RecordData): D1PreparedStatement
{
	const detail = record.detalle;

	return db
		.prepare(
			`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES ((SELECT id FROM sacramentos WHERE client_id = ?),
				(SELECT id FROM personas WHERE client_id = ?),
				(SELECT id FROM personas WHERE client_id = ?),
				?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (sacramento_id) DO UPDATE SET
				lugar = excluded.lugar,
				testigo_1 = excluded.testigo_1,
				testigo_2 = excluded.testigo_2,
				testigo_3 = excluded.testigo_3,
				testigo_4 = excluded.testigo_4,
				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,
				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,
				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,
				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha`,
		)
		.bind(
			record.client_id,
			record.personas[0].client_id,
			record.personas[1].client_id,
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
}

function save_detail(db: D1Database, record: RecordData): D1PreparedStatement
{
	if (record.tipo === 'matrimonio')
		return save_marriage(db, record);

	return save_godparents(db, sacrament_table(record.tipo), record);
}

// Una corrección no cambia de campo ni de valor; lo que sí cambia es su estado, cuando el
// administrador de la parroquia la aprueba o la rechaza.
function save_correction(db: D1Database, record: RecordData, correction: PersonCorrection): D1PreparedStatement
{
	return db
		.prepare(
			`INSERT INTO cambios_persona
				(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,
				 estado, revisado_por_usuario_id, revisado_en)
			 VALUES (?, (SELECT id FROM personas WHERE client_id = ?), (SELECT id FROM sacramentos WHERE client_id = ?), ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (client_id) DO UPDATE SET
				estado = excluded.estado,
				revisado_por_usuario_id = excluded.revisado_por_usuario_id,
				revisado_en = excluded.revisado_en`,
		)
		.bind(
			correction.client_id,
			correction.persona_client_id,
			record.client_id,
			correction.usuario_id,
			correction.campo_cambio,
			correction.valor_anterior,
			correction.valor_nuevo,
			correction.fecha_cambio,
			correction.estado,
			correction.revisado_por_usuario_id,
			correction.revisado_en,
		);
}

async function apply_record(db: D1Database, user: TokenUser, change: SyncChange, type: SacramentType): Promise<ChangeResult>
{
	const record = check_record(type, change.datos);
	if (record.client_id !== change.client_id)
		throw new RejectedChange('El registro no coincide con el cambio.');

	check_permission(user, record.parroquia_id, 'partidas');

	const people_ids = record.personas.map((person) => person.client_id);

	const user_ids = users_named(record);
	const history_ids = record.historial.map((entry) => entry.client_id);

	const reads = await db.batch([
		db.prepare('SELECT id, tipo, parroquia_id, version, estado, ultimo_cola_id FROM sacramentos WHERE client_id = ?').bind(record.client_id),
		db.prepare('SELECT client_id FROM personas WHERE client_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(people_ids)),
		db.prepare('SELECT id, rol, parroquia_id FROM usuarios WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(user_ids)),
		db.prepare('SELECT id FROM parroquias WHERE id = ?').bind(record.parroquia_id),
		db.prepare('SELECT id FROM ministros WHERE client_id = ?').bind(record.ministro_client_id),
		db.prepare('SELECT client_id FROM historial_partidas WHERE client_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(history_ids)),
	]);

	const saved = reads[0].results[0] as SavedRecord | undefined;
	const people_already_saved = reads[1].results.length > 0;
	const found_users = reads[2].results as { id: number; rol: string; parroquia_id: number | null }[];
	const parish_exists = reads[3].results.length > 0;
	const minister_exists = reads[4].results.length > 0;
	const known_history = new Set((reads[5].results as { client_id: string }[]).map((row) => row.client_id));

	if (!parish_exists)
		throw new RejectedChange('La parroquia no existe en el servidor.');

	if (record.ministro_client_id && !minister_exists)
		throw new RejectedChange('El ministro de esta partida todavía no está en el servidor.');

	for (const user_id of user_ids)
	{
		const found = found_users.find((row) => row.id === user_id);
		if (!found || (found.rol !== 'admin_general' && found.parroquia_id !== record.parroquia_id))
			throw new RejectedChange('La partida indica un usuario que no pertenece a su parroquia.');
	}

	for (const correction of record.cambios)
	{
		if (!people_ids.includes(correction.persona_client_id))
			throw new RejectedChange('Una corrección no corresponde a las personas de la partida.');
	}

	const writes: D1PreparedStatement[] = [];

	if (saved)
	{
		check_permission(user, saved.parroquia_id, 'partidas');

		if (saved.tipo !== type)
			throw new RejectedChange('El tipo de una partida no se puede cambiar.');

		if (saved.parroquia_id !== record.parroquia_id)
			throw new RejectedChange('La parroquia de una partida no se puede cambiar.');

		if (saved.estado === 'anulado' && record.estado !== 'anulado')
			throw new RejectedChange('Una partida anulada no se puede reactivar.');

		const conflict = find_conflict(change, saved);
		if (conflict)
			return conflict;

		const saved_people = await read_saved_people(db, type, saved.id);
		if (!saved_people || saved_people.some((client_id, i) => client_id !== people_ids[i]))
			throw new RejectedChange('Las personas no corresponden a esta partida.');

		const is_resend = saved.ultimo_cola_id === change.cola_id;
		if (user.rol === 'usuario' && !is_resend)
		{
			const stored = await read_record(db, type, record.client_id);
			check_helper_edit(stored as RecordData, record, user.usuarioId);
		}

		writes.push(version_guard(db, 'sacramentos', record.client_id, saved.version));
	}
	else
	{
		if (people_already_saved)
			throw new RejectedChange('Las personas ya pertenecen a otra partida.');

		if (user.rol === 'usuario')
			check_helper_new(record, user.usuarioId);

	}

	for (const person of record.personas)
		writes.push(save_person(db, record.parroquia_id, person));

	writes.push(save_sacrament(db, record, change.cola_id));
	writes.push(save_detail(db, record));

	for (const correction of record.cambios)
		writes.push(save_correction(db, record, correction));

	writes.push(...save_requests(db, record));
	writes.push(...save_new_history(db, record, known_history));

	writes.push(db.prepare('SELECT version FROM sacramentos WHERE client_id = ?').bind(record.client_id));

	const results = await db.batch<{ version: number }>(writes);
	const version = results[results.length - 1].results[0].version;

	return { entidad: type, client_id: record.client_id, estado: 'aplicado', version: version };
}


async function apply_change(db: D1Database, user: TokenUser, change: SyncChange): Promise<ChangeResult>
{
	const entity = change?.entidad;
	const client_id = change?.client_id;

	try
	{
		if (typeof client_id !== 'string' || client_id === '' || typeof change.cola_id !== 'string' || change.cola_id === '')
			throw new RejectedChange('El cambio no identifica su registro.');

		if (entity === 'ministro')
			return await apply_minister(db, user, change);

		if (entity === 'usuario')
			return await apply_user(db, user, change);

		if (is_sacrament_type(entity))
			return await apply_record(db, user, change, entity);

		throw new RejectedChange('Tipo de registro no reconocido.');
	}
	catch (error)
	{
		if (error instanceof RejectedChange)
			return { entidad: entity, client_id: client_id, estado: 'rechazado', motivo: error.message };

		if (is_version_guard_error(error))
		{
			const row = await db.prepare(`SELECT version FROM ${table_of(entity)} WHERE client_id = ?`).bind(client_id).first<{ version: number }>();
			const version = row ? row.version : 0;

			return { entidad: entity, client_id: client_id, estado: 'conflicto', version: version, motivo: CONFLICT_REASON };
		}

		if (error instanceof Error && /constraint failed/i.test(error.message))
		{
			console.error('Cambio rechazado por la base:', error.message);
			return { entidad: entity, client_id: client_id, estado: 'rechazado', motivo: 'El servidor rechazó los datos de este registro.' };
		}

		throw error;
	}
}

export async function apply_changes(db: D1Database, user: TokenUser, changes: SyncChange[]): Promise<ChangeResult[]>
{
	const results: ChangeResult[] = [];
	for (const change of changes)
		results.push(await apply_change(db, user, change));

	return results;
}
