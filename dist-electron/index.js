import { createRequire } from "node:module";
import { BrowserWindow, app, dialog, ipcMain, safeStorage, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import zlib from "zlib";
import { Duplex, PassThrough, Transform, pipeline } from "stream";
import fs, { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { Blob } from "node:buffer";
import Stream, { Readable, Transform as Transform$1 } from "node:stream";
import { createRequire as createRequire$1 } from "module";
import Database from "better-sqlite3-multiple-ciphers";
import { pbkdf2, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region shared/record_fields.ts
var SACRAMENT_FIELDS = [
	{
		campo: "libro",
		label: "Libro"
	},
	{
		campo: "folio",
		label: "Folio"
	},
	{
		campo: "numero",
		label: "Número"
	},
	{
		campo: "fecha_emision",
		label: "Fecha de registro"
	},
	{
		campo: "fecha_evento",
		label: "Fecha del sacramento"
	},
	{
		campo: "ministro_id",
		label: "Celebrante"
	},
	{
		campo: "anotaciones",
		label: "Nota marginal"
	}
];
var PERSON_FIELDS = [
	{
		campo: "dni",
		label: "DNI"
	},
	{
		campo: "nombres",
		label: "Nombres"
	},
	{
		campo: "apellido_paterno",
		label: "Apellido paterno"
	},
	{
		campo: "apellido_materno",
		label: "Apellido materno"
	},
	{
		campo: "fecha_nacimiento",
		label: "Fecha de nacimiento"
	},
	{
		campo: "fecha_aproximada",
		label: "Fecha de nacimiento aproximada"
	},
	{
		campo: "lugar_nacimiento",
		label: "Lugar de nacimiento"
	},
	{
		campo: "padre",
		label: "Padre"
	},
	{
		campo: "madre",
		label: "Madre"
	}
];
var BAPTISM_FIELDS = [{
	campo: "padrino_1",
	label: "Padrino"
}, {
	campo: "padrino_2",
	label: "Madrina"
}];
var MARRIAGE_FIELDS = [
	{
		campo: "lugar",
		label: "Lugar del matrimonio"
	},
	{
		campo: "testigo_1",
		label: "Testigo 1"
	},
	{
		campo: "testigo_2",
		label: "Testigo 2"
	},
	{
		campo: "testigo_3",
		label: "Testigo 3"
	},
	{
		campo: "testigo_4",
		label: "Testigo 4"
	},
	{
		campo: "conyuge_1_bautismo_parroquia",
		label: "Parroquia de bautismo del esposo"
	},
	{
		campo: "conyuge_1_bautismo_fecha",
		label: "Fecha de bautismo del esposo"
	},
	{
		campo: "conyuge_2_bautismo_parroquia",
		label: "Parroquia de bautismo de la esposa"
	},
	{
		campo: "conyuge_2_bautismo_fecha",
		label: "Fecha de bautismo de la esposa"
	}
];
var PERSON_COLUMNS = PERSON_FIELDS.map((field) => field.campo);
function detail_fields(in_type) {
	if (in_type === "matrimonio") return MARRIAGE_FIELDS;
	return BAPTISM_FIELDS;
}
function detail_columns(in_type) {
	return detail_fields(in_type).map((field) => field.campo);
}
function person_parts(in_type) {
	if (in_type === "matrimonio") return ["conyuge_1", "conyuge_2"];
	return ["persona"];
}
function fields_of(in_part, in_type) {
	if (in_part === "sacramento") return SACRAMENT_FIELDS;
	if (in_part === "detalle") return detail_fields(in_type);
	return PERSON_FIELDS;
}
function part_object(in_record, in_part) {
	if (in_part === "sacramento") return in_record.sacramento;
	if (in_part === "persona") return in_record.persona;
	if (in_part === "conyuge_1" || in_part === "conyuge_2") return in_record[in_part];
	return in_record;
}
function person_at(in_record, in_part) {
	return part_object(in_record, in_part);
}
function field_text(in_value) {
	if (in_value === null || in_value === void 0) return null;
	const text = String(in_value).trim();
	return text === "" ? null : text;
}
function get_field(in_record, in_part, in_field) {
	return field_text(part_object(in_record, in_part)?.[in_field]);
}
function set_field(in_record, in_part, in_field, in_value) {
	const value = in_field === "ministro_id" && in_value !== null ? Number(in_value) : in_value;
	if (in_part === "detalle") return {
		...in_record,
		[in_field]: value
	};
	if (in_part === "sacramento") return {
		...in_record,
		sacramento: {
			...in_record.sacramento,
			[in_field]: value
		}
	};
	const person = part_object(in_record, in_part);
	return {
		...in_record,
		[in_part]: {
			...person,
			[in_field]: value
		}
	};
}
function changed_fields(in_saved, in_new) {
	const out_changes = [];
	const type = in_saved.sacramento.tipo;
	const parts = [
		"sacramento",
		...person_parts(type),
		"detalle"
	];
	for (const part of parts) for (const field of fields_of(part, type)) {
		const old_value = get_field(in_saved, part, field.campo);
		const new_value = get_field(in_new, part, field.campo);
		if (old_value !== new_value) out_changes.push({
			parte: part,
			campo: field.campo,
			valor_anterior: old_value,
			valor_nuevo: new_value
		});
	}
	return out_changes;
}
var LOGIN_TIMEOUT_MS = 1e4;
var SYNC_INTERVAL_MS = 3e5;
var QUIT_SYNC_LIMIT_MS = 5e3;
var SYNC_KEYS = {
	cursor: "cursor",
	last_sync: "ultima_sync",
	notice: "aviso",
	key_registered: "clave_registrada"
};
var FILE_NAMES = {
	database: "prelatura-local.db",
	key: "prelatura-local.key",
	device: "prelatura-dispositivo.id",
	temp_database: "prelatura-reconstruccion.db",
	temp_key: "prelatura-reconstruccion.key",
	set_aside_folder: "bases-apartadas",
	logos_folder: "logos"
};
var SET_ASIDE_DAYS_MS = 2592e6;
//#endregion
//#region electron/main/utils/errors.ts
var ServiceError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.name = "ServiceError";
		this.status = status;
	}
};
//#endregion
//#region electron/main/utils/helpers.ts
function clean_text(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed === "") return null;
	return trimmed;
}
function positive_id(value, not_found_message = "Partida no encontrada.") {
	if (!Number.isInteger(value) || value <= 0) throw new ServiceError(not_found_message, 404);
	return value;
}
function page_of(filters, total_rows) {
	let page = 1;
	if (Number.isInteger(filters.pagina) && filters.pagina > 0) page = filters.pagina;
	return {
		offset: (page - 1) * 20,
		total_pages: Math.max(1, Math.ceil(total_rows / 20))
	};
}
function sort_direction(filters) {
	if (filters.direccion === "desc") return "DESC";
	return "ASC";
}
function full_name$1(first_name, father_last_name, mother_last_name) {
	return [
		first_name,
		father_last_name,
		mother_last_name
	].filter((part) => part).join(" ");
}
//#endregion
//#region electron/main/models/field_values.ts
var MINISTER = "ministro_id";
function stored_value(db, field, value) {
	if (field !== MINISTER || value === null) return value;
	return db.prepare("SELECT client_id FROM ministros WHERE id = ?").get(Number(value))?.client_id ?? null;
}
function local_value(db, field, value) {
	if (field !== MINISTER || value === null) return value;
	const row = db.prepare("SELECT id FROM ministros WHERE client_id = ?").get(value);
	return row ? String(row.id) : null;
}
function display_text(db, field, value) {
	if (field !== MINISTER || value === null) return value;
	const row = db.prepare("SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?").get(value);
	if (!row) return "Celebrante desconocido";
	return [row.titulo, full_name$1(row.nombre, row.apellido_paterno, row.apellido_materno)].filter(Boolean).join(" ");
}
//#endregion
//#region electron/main/models/change_request.ts
function has_pending_request(db, sacrament_id) {
	return db.prepare(`SELECT 1 FROM solicitudes_cambio WHERE sacramento_id = ? AND estado = 'pendiente'`).get(sacrament_id) !== void 0;
}
function pending_requests(db, sacrament_id) {
	return db.prepare(`SELECT id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo FROM solicitudes_cambio
			 WHERE sacramento_id = ? AND estado = 'pendiente' ORDER BY id`).all(sacrament_id).map((row) => ({
		...row,
		valor_anterior: local_value(db, row.campo, row.valor_anterior),
		valor_nuevo: local_value(db, row.campo, row.valor_nuevo)
	}));
}
function insert_requests(db, sacrament_id, user_id, requests) {
	const insert = db.prepare(`INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	for (const request of requests) insert.run(crypto.randomUUID(), sacrament_id, user_id, request.parte, request.campo, request.tipo, stored_value(db, request.campo, request.valor_anterior), stored_value(db, request.campo, request.valor_nuevo), now);
}
function close_requests(db, sacrament_id, state, reviewer_id, reason = null) {
	db.prepare(`UPDATE solicitudes_cambio SET estado = ?, motivo = ?, revisado_por_usuario_id = ?, revisado_en = ?
		 WHERE sacramento_id = ? AND estado = 'pendiente'`).run(state, reason, reviewer_id, (/* @__PURE__ */ new Date()).toISOString(), sacrament_id);
}
function read_requests(db, sacrament_id) {
	return db.prepare(`SELECT s.id, s.parte, s.campo, s.tipo, s.valor_anterior, s.valor_nuevo, s.estado, s.motivo, s.creado_en, s.revisado_en,
				p.nombre AS pide_nombre, p.apellido_paterno AS pide_paterno, p.apellido_materno AS pide_materno,
				r.nombre AS revisa_nombre, r.apellido_paterno AS revisa_paterno, r.apellido_materno AS revisa_materno
			 FROM solicitudes_cambio s
			 LEFT JOIN usuarios p ON p.id = s.usuario_id
			 LEFT JOIN usuarios r ON r.id = s.revisado_por_usuario_id
			 WHERE s.sacramento_id = ?
			 ORDER BY s.creado_en DESC, s.id`).all(sacrament_id).map((row) => ({
		id: row.id,
		parte: row.parte,
		campo: row.campo,
		tipo: row.tipo,
		valor_anterior: local_value(db, row.campo, row.valor_anterior),
		valor_nuevo: local_value(db, row.campo, row.valor_nuevo),
		texto_anterior: display_text(db, row.campo, row.valor_anterior),
		texto_nuevo: display_text(db, row.campo, row.valor_nuevo),
		estado: row.estado,
		motivo: row.motivo,
		solicitado_por: full_name$1(row.pide_nombre, row.pide_paterno, row.pide_materno) || "Un usuario",
		creado_en: row.creado_en,
		revisado_por: row.revisa_nombre ? full_name$1(row.revisa_nombre, row.revisa_paterno, row.revisa_materno) : null,
		revisado_en: row.revisado_en
	}));
}
function read_request_data(db, sacrament_id) {
	return db.prepare(`SELECT client_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
				revisado_por_usuario_id, revisado_en, creado_en
			 FROM solicitudes_cambio WHERE sacramento_id = ? ORDER BY id`).all(sacrament_id);
}
function save_downloaded_requests(db, sacrament_id, requests) {
	const save = db.prepare(`INSERT INTO solicitudes_cambio
			(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,
			 revisado_por_usuario_id, revisado_en, creado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO UPDATE SET
			estado = excluded.estado,
			motivo = excluded.motivo,
			revisado_por_usuario_id = excluded.revisado_por_usuario_id,
			revisado_en = excluded.revisado_en`);
	for (const request of requests) save.run(request.client_id, sacrament_id, request.usuario_id, request.parte, request.campo, request.tipo, request.valor_anterior, request.valor_nuevo, request.estado, request.motivo, request.revisado_por_usuario_id, request.revisado_en, request.creado_en);
}
function discard_unsent_requests(db, sacrament_id, kept) {
	const kept_ids = JSON.stringify(kept.map((request) => request.client_id));
	db.prepare("DELETE FROM solicitudes_cambio WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(sacrament_id, kept_ids);
}
//#endregion
//#region electron/main/models/history.ts
function add_history(db, sacrament_id, user_id, event, fields = [], reason = null) {
	const result = db.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), sacrament_id, user_id, event, reason, (/* @__PURE__ */ new Date()).toISOString());
	const history_id = Number(result.lastInsertRowid);
	const insert_field = db.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (const field of fields) insert_field.run(history_id, field.parte, field.campo, stored_value(db, field.campo, field.valor_anterior), stored_value(db, field.campo, field.valor_nuevo));
}
function read_fields(db, history_id) {
	return db.prepare("SELECT parte, campo, valor_anterior, valor_nuevo FROM historial_campos WHERE historial_id = ? ORDER BY id").all(history_id);
}
function read_history(db, sacrament_id) {
	return db.prepare(`SELECT h.id, h.evento, h.motivo, h.fecha, u.nombre, u.apellido_paterno, u.apellido_materno, u.username
			 FROM historial_partidas h
			 LEFT JOIN usuarios u ON u.id = h.usuario_id
			 WHERE h.sacramento_id = ?
			 ORDER BY h.fecha DESC, h.id DESC`).all(sacrament_id).map((row) => ({
		id: row.id,
		evento: row.evento,
		motivo: row.motivo,
		fecha: row.fecha,
		usuario: full_name$1(row.nombre, row.apellido_paterno, row.apellido_materno) || row.username || "Usuario desconocido",
		campos: read_fields(db, row.id).map((field) => ({
			parte: field.parte,
			campo: field.campo,
			texto_anterior: display_text(db, field.campo, field.valor_anterior),
			texto_nuevo: display_text(db, field.campo, field.valor_nuevo)
		}))
	}));
}
function read_history_data(db, sacrament_id) {
	return db.prepare("SELECT id, client_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id = ? ORDER BY id").all(sacrament_id).map(({ id, ...row }) => ({
		...row,
		campos: read_fields(db, id)
	}));
}
function save_downloaded_history(db, sacrament_id, entries) {
	const insert = db.prepare(`INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO NOTHING`);
	const insert_field = db.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (const entry of entries) {
		const result = insert.run(entry.client_id, sacrament_id, entry.usuario_id, entry.evento, entry.motivo, entry.fecha);
		if (result.changes === 0) continue;
		for (const field of entry.campos) insert_field.run(Number(result.lastInsertRowid), field.parte, field.campo, field.valor_anterior, field.valor_nuevo);
	}
}
function discard_unsent_history(db, sacrament_id, kept) {
	const kept_ids = JSON.stringify(kept.map((entry) => entry.client_id));
	db.prepare(`DELETE FROM historial_campos WHERE historial_id IN (SELECT id FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?)))`).run(sacrament_id, kept_ids);
	db.prepare("DELETE FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(sacrament_id, kept_ids);
}
//#endregion
//#region electron/main/models/parish.ts
var GENERAL_ADMIN_READS_ONLY = "El administrador general solo consulta: no puede registrar ni modificar datos de las parroquias.";
function read_parish(db, parish_id) {
	return db.prepare("SELECT * FROM parroquias WHERE id = ?").get(parish_id);
}
function parish_for_new(session) {
	if (session.role === "admin_general") throw new ServiceError(GENERAL_ADMIN_READS_ONLY, 403);
	if (!session.parish_id) throw new ServiceError("El usuario no tiene una parroquia asignada.", 400);
	return session.parish_id;
}
function check_parish_access(session, parish_id, message) {
	if (session.role === "admin_general") throw new ServiceError(GENERAL_ADMIN_READS_ONLY, 403);
	if (session.parish_id !== parish_id) throw new ServiceError(message, 403);
}
function check_parish_read(session, parish_id, message) {
	if (session.role !== "admin_general" && session.parish_id !== parish_id) throw new ServiceError(message, 403);
}
function check_parish_admin(session, parish_id, other_parish, only_admin) {
	check_parish_access(session, parish_id, other_parish);
	if (session.role !== "admin_parroquia") throw new ServiceError(only_admin, 403);
}
//#endregion
//#region electron/main/models/person.ts
var CORRECTABLE_FIELDS = [
	{
		column: "nombres",
		label: "Nombres"
	},
	{
		column: "apellido_paterno",
		label: "Apellido paterno"
	},
	{
		column: "apellido_materno",
		label: "Apellido materno"
	}
];
function clean_person(person) {
	return {
		dni: clean_text(person.dni),
		nombres: clean_text(person.nombres) ?? "",
		apellido_paterno: clean_text(person.apellido_paterno) ?? "",
		apellido_materno: clean_text(person.apellido_materno) ?? "",
		fecha_nacimiento: clean_text(person.fecha_nacimiento),
		fecha_aproximada: clean_text(person.fecha_aproximada),
		lugar_nacimiento: clean_text(person.lugar_nacimiento),
		padre: clean_text(person.padre),
		madre: clean_text(person.madre)
	};
}
function read_person$1(db, person_id) {
	const person = db.prepare("SELECT * FROM personas WHERE id = ?").get(person_id);
	const changes = db.prepare("SELECT * FROM cambios_persona WHERE persona_id = ? ORDER BY id").all(person_id);
	return {
		...person,
		cambios: changes
	};
}
function insert_person(db, parish_id, person) {
	const row = clean_person(person);
	const result = db.prepare(`INSERT INTO personas
				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), parish_id, row.dni, row.nombres, row.apellido_paterno, row.apellido_materno, row.fecha_nacimiento, row.fecha_aproximada, row.lugar_nacimiento, row.padre, row.madre);
	return Number(result.lastInsertRowid);
}
function update_person(db, person_id, person) {
	const new_row = clean_person(person);
	const old_row = db.prepare(`SELECT ${PERSON_COLUMNS.join(", ")} FROM personas WHERE id = ?`).get(person_id);
	const changed_columns = PERSON_COLUMNS.filter((column) => old_row[column] !== new_row[column]);
	if (changed_columns.length === 0) return;
	const assignments = changed_columns.map((column) => `${column} = ?`).join(", ");
	const values = changed_columns.map((column) => new_row[column]);
	db.prepare(`UPDATE personas SET ${assignments} WHERE id = ?`).run(...values, person_id);
}
function apply_corrections(person) {
	const changes = Array.isArray(person.cambios) ? person.cambios.filter((change) => change.id === void 0) : [];
	const corrected = { ...person };
	const result = [];
	for (const change of changes) {
		const field = CORRECTABLE_FIELDS.find((item) => item.column === change.campo_cambio);
		if (!field) throw new ServiceError("La nota marginal indica un campo que no se puede corregir.", 400);
		if (result.some((item) => item.campo_cambio === field.column)) throw new ServiceError(`La nota marginal repite el campo ${field.label}.`, 400);
		const old_value = clean_text(person[field.column]);
		const new_value = clean_text(change.valor_nuevo);
		if (!old_value) throw new ServiceError(`Complete ${field.label} antes de corregirlo en la nota marginal.`, 400);
		if (!new_value) throw new ServiceError(`Indique el valor nuevo de ${field.label} en la nota marginal.`, 400);
		if (new_value === old_value) throw new ServiceError(`El valor nuevo de ${field.label} es igual al anterior.`, 400);
		corrected[field.column] = new_value;
		result.push({
			campo_cambio: field.column,
			valor_anterior: old_value,
			valor_nuevo: new_value
		});
	}
	return {
		person: corrected,
		corrections: result
	};
}
function save_corrections(db, session, person_id, sacrament_id, corrections) {
	const insert = db.prepare(`INSERT INTO cambios_persona
			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?)`);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	for (const correction of corrections) insert.run(crypto.randomUUID(), person_id, sacrament_id, session.user_id, correction.campo_cambio, correction.valor_anterior, correction.valor_nuevo, session.user_id, now);
}
function name_condition(table_alias, column) {
	return `(${table_alias}.${column} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${table_alias}.id AND cp.campo_cambio = '${column}' AND cp.estado = 'aprobado' AND cp.valor_anterior LIKE ?
	))`;
}
//#endregion
//#region electron/main/sync/queue.ts
function add_to_queue(db, entity, client_id, version_base) {
	db.prepare(`INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)
		 ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1`).run(entity, client_id, version_base, crypto.randomUUID());
}
function is_in_queue(db, entity, client_id) {
	return db.prepare("SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?").get(entity, client_id) !== void 0;
}
function remove_from_queue(db, entity, client_id) {
	db.prepare("DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?").run(entity, client_id);
}
function get_sync_value(db, key) {
	const row = db.prepare("SELECT valor FROM sync_estado WHERE clave = ?").get(key);
	if (!row) return null;
	return row.valor;
}
function set_sync_value(db, key, value) {
	db.prepare(`INSERT INTO sync_estado (clave, valor) VALUES (?, ?)
		 ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`).run(key, value);
}
//#endregion
//#region electron/main/models/minister.ts
function read_minister(db, minister_id) {
	const minister = db.prepare("SELECT * FROM ministros WHERE id = ?").get(minister_id);
	if (!minister) return null;
	return {
		...minister,
		parroquia: read_parish(db, minister.parroquia_id)
	};
}
//#endregion
//#region electron/main/models/sacrament.ts
function is_sacrament_type(value) {
	return value === "bautismo" || value === "confirmacion" || value === "matrimonio";
}
function detail_table(type) {
	if (type === "bautismo") return "bautismos";
	if (type === "confirmacion") return "confirmaciones";
	return "matrimonios";
}
function person_columns(type) {
	if (type === "matrimonio") return ["conyuge_1_id", "conyuge_2_id"];
	return ["persona_id"];
}
function people_of(type) {
	if (type === "bautismo") return "SELECT sacramento_id, persona_id FROM bautismos";
	if (type === "confirmacion") return "SELECT sacramento_id, persona_id FROM confirmaciones";
	return `SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios
		UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios`;
}
var PEOPLE_OF_ALL_SACRAMENTS = `SELECT sacramento_id, persona_id FROM bautismos
	UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones
	UNION ALL SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios
	UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios`;
function read_sacrament(db, sacrament_id) {
	const sacrament = db.prepare("SELECT * FROM sacramentos WHERE id = ?").get(sacrament_id);
	if (!sacrament) return null;
	let minister = null;
	if (sacrament.ministro_id !== null) minister = read_minister(db, sacrament.ministro_id);
	return {
		...sacrament,
		parroquia: read_parish(db, sacrament.parroquia_id),
		ministro: minister
	};
}
function clean_sacrament(sacrament) {
	const issue_date = clean_text(sacrament.fecha_emision);
	const book = clean_text(sacrament.libro);
	const page = clean_text(sacrament.folio);
	const number = clean_text(sacrament.numero);
	if (!issue_date || !book || !page || !number) throw new ServiceError("La fecha, el libro, el folio y el número de registro son requeridos.", 400);
	return {
		fecha_emision: issue_date,
		libro: book,
		folio: page,
		numero: number,
		ministro_id: sacrament.ministro_id ?? null,
		fecha_evento: clean_text(sacrament.fecha_evento),
		anotaciones: clean_text(sacrament.anotaciones)
	};
}
function sacrament_parish(db, sacrament_id, type) {
	const sacrament = db.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(sacrament_id, type);
	if (!sacrament) throw new ServiceError("Partida no encontrada.", 404);
	return sacrament.parroquia_id;
}
var OTHER_PARISH_RECORD = "No tiene permiso para modificar partidas de otra parroquia.";
function check_can_manage$1(db, session, sacrament_id, type) {
	check_parish_admin(session, sacrament_parish(db, sacrament_id, type), OTHER_PARISH_RECORD, "Solo el administrador de la parroquia puede modificar o anular una partida. Pida la corrección con una nota marginal.");
}
function check_minister_parish(db, minister_id, parish_id) {
	if (minister_id === null) return;
	const minister = db.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(minister_id);
	if (minister && minister.parroquia_id !== parish_id) throw new ServiceError("El celebrante debe ser de la parroquia de la partida.", 400);
}
function insert_sacrament(db, client_id, type, parish_id, sacrament) {
	const values = clean_sacrament(sacrament);
	check_minister_parish(db, values.ministro_id, parish_id);
	const result = db.prepare(`INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(client_id, type, parish_id, values.ministro_id, values.libro, values.folio, values.numero, values.fecha_emision, values.fecha_evento, values.anotaciones);
	return Number(result.lastInsertRowid);
}
function update_sacrament(db, sacrament_id, sacrament) {
	const values = clean_sacrament(sacrament);
	const current = db.prepare("SELECT ministro_id, parroquia_id FROM sacramentos WHERE id = ?").get(sacrament_id);
	if (values.ministro_id !== current.ministro_id) check_minister_parish(db, values.ministro_id, current.parroquia_id);
	db.prepare(`UPDATE sacramentos
		 SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?
		 WHERE id = ?`).run(values.ministro_id, values.libro, values.folio, values.numero, values.fecha_emision, values.fecha_evento, values.anotaciones, sacrament_id);
}
//#endregion
//#region electron/main/models/record.ts
var NOT_FOUND$2 = "Partida no encontrada.";
function read_full_sacrament(db, sacrament_id, type) {
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== type) throw new ServiceError(NOT_FOUND$2, 404);
	return {
		...sacrament,
		solicitudes: read_requests(db, sacrament_id)
	};
}
function read_person_sacrament(db, type, sacrament_id) {
	const sacrament = read_full_sacrament(db, sacrament_id, type);
	const detail = db.prepare(`SELECT * FROM ${detail_table(type)} WHERE sacramento_id = ?`).get(sacrament_id);
	return {
		sacramento: sacrament,
		persona: read_person$1(db, detail.persona_id),
		padrino_1: detail.padrino_1,
		padrino_2: detail.padrino_2
	};
}
function read_marriage(db, sacrament_id) {
	const sacrament = read_full_sacrament(db, sacrament_id, "matrimonio");
	const detail = db.prepare("SELECT * FROM matrimonios WHERE sacramento_id = ?").get(sacrament_id);
	return {
		sacramento: sacrament,
		conyuge_1: read_person$1(db, detail.conyuge_1_id),
		conyuge_2: read_person$1(db, detail.conyuge_2_id),
		lugar: detail.lugar,
		testigo_1: detail.testigo_1,
		testigo_2: detail.testigo_2,
		testigo_3: detail.testigo_3,
		testigo_4: detail.testigo_4,
		conyuge_1_bautismo_parroquia: detail.conyuge_1_bautismo_parroquia,
		conyuge_1_bautismo_fecha: detail.conyuge_1_bautismo_fecha,
		conyuge_2_bautismo_parroquia: detail.conyuge_2_bautismo_parroquia,
		conyuge_2_bautismo_fecha: detail.conyuge_2_bautismo_fecha
	};
}
function read_record(db, sacrament_id) {
	const row = db.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(sacrament_id);
	if (!row) throw new ServiceError(NOT_FOUND$2, 404);
	if (row.tipo === "matrimonio") return read_marriage(db, sacrament_id);
	return read_person_sacrament(db, row.tipo, sacrament_id);
}
var REQUIRED_NAMES = [
	{
		field: "nombres",
		label: "nombres"
	},
	{
		field: "apellido_paterno",
		label: "apellido paterno"
	},
	{
		field: "apellido_materno",
		label: "apellido materno"
	}
];
var REQUIRED_DETAILS = [
	{
		field: "lugar_nacimiento",
		label: "lugar de nacimiento"
	},
	{
		field: "padre",
		label: "padre"
	},
	{
		field: "madre",
		label: "madre"
	}
];
var WHO = {
	persona: "",
	conyuge_1: " del esposo",
	conyuge_2: " de la esposa",
	sacramento: "",
	detalle: ""
};
function has_birth(person) {
	return Boolean(clean_text(person?.fecha_nacimiento) || clean_text(person?.fecha_aproximada));
}
function check_person(person, previous, who) {
	const missing = [];
	for (const { field, label } of REQUIRED_NAMES) if (!clean_text(person?.[field])) missing.push(label);
	if ((previous === null || has_birth(previous)) && !has_birth(person)) missing.push("fecha de nacimiento (o fecha aproximada)");
	for (const { field, label } of REQUIRED_DETAILS) if ((previous === null || clean_text(previous[field]) !== null) && !clean_text(person?.[field])) missing.push(label);
	if (missing.length > 0) throw new ServiceError(`Faltan datos${who}: ${missing.join(", ")}.`, 400);
}
function check_required(record, saved) {
	for (const part of person_parts(record.sacramento.tipo)) check_person(person_at(record, part), saved ? person_at(saved, part) : null, WHO[part]);
	if ((saved === null || saved.sacramento.ministro_id !== null) && !record.sacramento?.ministro_id) throw new ServiceError("Seleccione el celebrante.", 400);
}
function queue_sacrament(db, sacrament_id) {
	const current = db.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(sacrament_id);
	add_to_queue(db, current.tipo, current.client_id, current.version);
}
function marriage_values(record) {
	return [
		clean_text(record.lugar),
		clean_text(record.testigo_1),
		clean_text(record.testigo_2),
		clean_text(record.testigo_3),
		clean_text(record.testigo_4),
		clean_text(record.conyuge_1_bautismo_parroquia),
		clean_text(record.conyuge_1_bautismo_fecha),
		clean_text(record.conyuge_2_bautismo_parroquia),
		clean_text(record.conyuge_2_bautismo_fecha)
	];
}
function as_corrections(part, corrections) {
	return corrections.map((correction) => ({
		parte: part,
		campo: correction.campo_cambio,
		valor_anterior: correction.valor_anterior ?? null,
		valor_nuevo: correction.valor_nuevo
	}));
}
function insert_people(db, parish_id, record, apply) {
	return person_parts(record.sacramento.tipo).map((part) => {
		const person = person_at(record, part);
		const corrected = apply_corrections(person);
		return {
			id: insert_person(db, parish_id, apply ? corrected.person : person),
			part,
			corrections: corrected.corrections
		};
	});
}
function corrections_of(people) {
	return people.flatMap((person) => as_corrections(person.part, person.corrections));
}
function insert_detail(db, sacrament_id, record, people_ids) {
	const type = record.sacramento.tipo;
	if (type === "matrimonio") {
		db.prepare(`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sacrament_id, people_ids[0], people_ids[1], ...marriage_values(record));
		return;
	}
	const baptism = record;
	db.prepare(`INSERT INTO ${detail_table(type)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(sacrament_id, people_ids[0], clean_text(baptism.padrino_1), clean_text(baptism.padrino_2));
}
function update_detail(db, sacrament_id, record) {
	const type = record.sacramento.tipo;
	if (type === "matrimonio") {
		db.prepare(`UPDATE matrimonios SET
				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
			 WHERE sacramento_id = ?`).run(...marriage_values(record), sacrament_id);
		return;
	}
	const baptism = record;
	db.prepare(`UPDATE ${detail_table(type)} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(clean_text(baptism.padrino_1), clean_text(baptism.padrino_2), sacrament_id);
}
function save_edit(db, session, saved, record) {
	check_required(record, saved);
	const sacrament_id = saved.sacramento.id;
	const corrections = [];
	for (const part of person_parts(saved.sacramento.tipo)) {
		const person_id = person_at(saved, part).id;
		const corrected = apply_corrections(person_at(record, part));
		update_person(db, person_id, corrected.person);
		save_corrections(db, session, person_id, sacrament_id, corrected.corrections);
		corrections.push(...as_corrections(part, corrected.corrections));
	}
	update_sacrament(db, sacrament_id, record.sacramento);
	update_detail(db, sacrament_id, record);
	return {
		fields: changed_fields(saved, record),
		corrections
	};
}
function with_correction(record, part, field, value) {
	const person = person_at(record, part);
	const change = {
		campo_cambio: field,
		valor_nuevo: value
	};
	return {
		...record,
		[part]: {
			...person,
			cambios: [...person.cambios ?? [], change]
		}
	};
}
//#endregion
//#region electron/main/controllers/requests.ts
var ONLY_ADMIN$1 = "Solo un administrador de la parroquia puede aprobar o rechazar cambios.";
var PENDING_REQUEST = "La partida tiene un cambio pendiente de aprobación. Un administrador de la parroquia debe aprobarlo o rechazarlo primero.";
var DISCARDED_ON_EDIT = "Descartada al editar la partida";
function as_requests(changes, type) {
	return changes.map((change) => ({
		...change,
		tipo: type
	}));
}
function requested_corrections(saved, record) {
	const out_changes = [];
	for (const part of person_parts(saved.sacramento.tipo)) {
		const incoming = person_at(record, part);
		const new_changes = Array.isArray(incoming?.cambios) ? incoming.cambios.filter((change) => change.id === void 0) : [];
		const corrections = apply_corrections({
			...person_at(saved, part),
			cambios: new_changes
		}).corrections;
		for (const correction of corrections) out_changes.push({
			parte: part,
			campo: correction.campo_cambio,
			valor_anterior: correction.valor_anterior ?? null,
			valor_nuevo: correction.valor_nuevo
		});
	}
	return out_changes;
}
function request_changes(db, session, record) {
	const sacrament_id = positive_id(record.sacramento?.id);
	const saved = read_record(db, sacrament_id);
	check_parish_access(session, saved.sacramento.parroquia_id, OTHER_PARISH_RECORD);
	if (saved.sacramento.estado === "anulado") throw new ServiceError("Una partida anulada no admite cambios.", 409);
	if (has_pending_request(db, sacrament_id)) throw new ServiceError(PENDING_REQUEST, 409);
	const new_note = clean_text(record.sacramento?.anotaciones);
	const writes_blank_note = clean_text(saved.sacramento.anotaciones) === null && new_note !== null;
	const typed = changed_fields(saved, record).filter((change) => !(writes_blank_note && change.campo === "anotaciones"));
	const corrections = requested_corrections(saved, record);
	if (corrections.some((correction) => typed.some((change) => change.parte === correction.parte && change.campo === correction.campo))) throw new ServiceError("No cambie el mismo dato en el formulario y en la nota marginal a la vez.", 400);
	if (typed.length === 0 && corrections.length === 0 && !writes_blank_note) throw new ServiceError("No hay cambios para pedir.", 400);
	check_required(record, saved);
	const requests = [...as_requests(typed, "digitacion"), ...as_requests(corrections, "nota_marginal")];
	db.transaction(() => {
		queue_sacrament(db, sacrament_id);
		if (writes_blank_note) {
			db.prepare("UPDATE sacramentos SET anotaciones = ? WHERE id = ?").run(new_note, sacrament_id);
			add_history(db, sacrament_id, session.user_id, "editada", [{
				parte: "sacramento",
				campo: "anotaciones",
				valor_anterior: null,
				valor_nuevo: new_note
			}]);
		}
		if (requests.length > 0) {
			insert_requests(db, sacrament_id, session.user_id, requests);
			add_history(db, sacrament_id, session.user_id, "cambio_pedido", requests);
		}
	})();
}
function with_requests(saved, requests) {
	let record = saved;
	for (const request of requests) if (request.tipo === "nota_marginal") record = with_correction(record, request.parte, request.campo, request.valor_nuevo);
	else record = set_field(record, request.parte, request.campo, request.valor_nuevo);
	return record;
}
function uses_requests(record, requests) {
	return requests.every((request) => {
		if (request.tipo === "digitacion") return get_field(record, request.parte, request.campo) === request.valor_nuevo;
		return (person_at(record, request.parte).cambios ?? []).some((change) => change.id === void 0 && change.campo_cambio === request.campo && clean_text(change.valor_nuevo) === request.valor_nuevo);
	});
}
function check_reviewer(session, saved) {
	check_parish_admin(session, saved.sacramento.parroquia_id, OTHER_PARISH_RECORD, ONLY_ADMIN$1);
}
function review_requests(db, session, sacrament_id, decision) {
	if (decision !== "aprobado" && decision !== "rechazado") throw new ServiceError("Indique si aprueba o rechaza el cambio.", 400);
	const saved = read_record(db, sacrament_id);
	check_reviewer(session, saved);
	const requests = pending_requests(db, sacrament_id);
	if (requests.length === 0) throw new ServiceError("La partida no tiene cambios pendientes.", 409);
	db.transaction(() => {
		queue_sacrament(db, sacrament_id);
		if (decision === "aprobado") {
			save_edit(db, session, saved, with_requests(saved, requests));
			add_history(db, sacrament_id, session.user_id, "cambio_aprobado", requests);
		} else add_history(db, sacrament_id, session.user_id, "cambio_rechazado", requests);
		close_requests(db, sacrament_id, decision, session.user_id);
		db.prepare("UPDATE sacramentos SET updated_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), sacrament_id);
	})();
}
function resolve_on_edit(db, session, sacrament_id, record) {
	const requests = pending_requests(db, sacrament_id);
	if (requests.length === 0) return;
	if (uses_requests(record, requests)) {
		close_requests(db, sacrament_id, "aprobado", session.user_id);
		add_history(db, sacrament_id, session.user_id, "cambio_aprobado", requests);
		return;
	}
	close_requests(db, sacrament_id, "descartado", session.user_id, DISCARDED_ON_EDIT);
	add_history(db, sacrament_id, session.user_id, "cambio_descartado", requests, DISCARDED_ON_EDIT);
}
function list_pending(db, session) {
	if (session.role !== "admin_parroquia" || !session.parish_id) throw new ServiceError(ONLY_ADMIN$1, 403);
	return db.prepare(`SELECT r.sacramento_id, MIN(r.id) AS primera, u.nombre, u.apellido_paterno, u.apellido_materno
			 FROM solicitudes_cambio r
			 JOIN sacramentos s ON s.id = r.sacramento_id
			 LEFT JOIN usuarios u ON u.id = r.usuario_id
			 WHERE r.estado = 'pendiente' AND s.parroquia_id = ?
			 GROUP BY r.sacramento_id
			 ORDER BY primera`).all(session.parish_id).map((row) => ({
		partida: read_record(db, row.sacramento_id),
		solicitado_por: full_name$1(row.nombre, row.apellido_paterno, row.apellido_materno)
	}));
}
var request_routes = {
	"requests.pending": (_payload, { db, session }) => {
		return { pendientes: list_pending(db, session) };
	},
	"requests.review": (payload, { db, session }) => {
		review_requests(db, session, positive_id(payload.sacramento_id), payload.decision);
		return { success: true };
	}
};
//#endregion
//#region electron/main/controllers/duplicates.ts
var MAX_MATCHES_PER_PERSON = 50;
var MIN_PERCENT = 75;
var SIMILAR = .75;
var FIELDS = [
	"dni",
	"nombres",
	"apellido_paterno",
	"apellido_materno",
	"fecha_nacimiento",
	"padre",
	"madre"
];
var WEIGHTS = {
	dni: 40,
	nombres: 25,
	apellido_paterno: 20,
	apellido_materno: 15,
	fecha_nacimiento: 20,
	padre: 10,
	madre: 10
};
var LABELS = {
	dni: "DNI",
	nombres: "Nombres",
	apellido_paterno: "Apellido paterno",
	apellido_materno: "Apellido materno",
	fecha_nacimiento: "Fecha de nacimiento",
	padre: "Padre",
	madre: "Madre"
};
function normalize$1(value) {
	return (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function edit_distance(a, b) {
	let previous_row = [];
	for (let j = 0; j <= b.length; j++) previous_row.push(j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			const change_cost = a[i - 1] === b[j - 1] ? 0 : 1;
			row[j] = Math.min(previous_row[j] + 1, row[j - 1] + 1, previous_row[j - 1] + change_cost);
		}
		previous_row = row;
	}
	return previous_row[b.length];
}
function similarity(a, b) {
	if (!a || !b) return 0;
	if (a === b) return 1;
	const words_a = a.split(" ");
	const words_b = b.split(" ");
	const shorter = words_a.length <= words_b.length ? words_a : words_b;
	const longer = words_a.length <= words_b.length ? words_b : words_a;
	if (shorter.every((word) => longer.includes(word))) return .85;
	const longest = Math.max(a.length, b.length);
	if (Math.abs(a.length - b.length) / longest > .25) return 0;
	const ratio = 1 - edit_distance(a, b) / longest;
	if (ratio >= SIMILAR) return ratio;
	return 0;
}
function compare_dates(a, b) {
	if (!a || !b) return {
		comparable: false,
		value: 0
	};
	if (a === b) return {
		comparable: true,
		value: 1
	};
	return {
		comparable: !(a.startsWith(b + "-") || b.startsWith(a + "-")),
		value: 0
	};
}
function compare(input, candidate, old_names) {
	const dni_comparable = Boolean(input.dni && candidate.dni);
	const same_dni = dni_comparable && input.dni === normalize$1(candidate.dni);
	const name_similarity = (field, current) => {
		const options = [normalize$1(current), ...old_names.get(`${candidate.persona_id}:${field}`) ?? []];
		return Math.max(...options.map((option) => similarity(input[field], option)));
	};
	const first_name_score = name_similarity("nombres", candidate.nombres);
	const father_name_score = name_similarity("apellido_paterno", candidate.apellido_paterno);
	if (!same_dni && (first_name_score === 0 || father_name_score === 0)) return null;
	const results = {
		dni: {
			comparable: dni_comparable,
			value: same_dni ? 1 : 0
		},
		nombres: {
			comparable: Boolean(input.nombres),
			value: first_name_score
		},
		apellido_paterno: {
			comparable: Boolean(input.apellido_paterno),
			value: father_name_score
		},
		apellido_materno: {
			comparable: Boolean(input.apellido_materno && candidate.apellido_materno),
			value: name_similarity("apellido_materno", candidate.apellido_materno)
		},
		fecha_nacimiento: compare_dates(input.fecha_nacimiento, normalize$1(candidate.fecha_nacimiento)),
		padre: {
			comparable: Boolean(input.padre && candidate.padre),
			value: similarity(input.padre, normalize$1(candidate.padre))
		},
		madre: {
			comparable: Boolean(input.madre && candidate.madre),
			value: similarity(input.madre, normalize$1(candidate.madre))
		}
	};
	let obtained_points = 0;
	let possible_points = 0;
	const matching_labels = [];
	for (const field of FIELDS) {
		const result = results[field];
		if (!result.comparable) continue;
		possible_points += WEIGHTS[field];
		obtained_points += WEIGHTS[field] * result.value;
		if (result.value >= SIMILAR) matching_labels.push(LABELS[field]);
	}
	const percent = Math.round(obtained_points / possible_points * 100);
	const names_match = first_name_score >= SIMILAR && father_name_score >= SIMILAR;
	const different_dni = dni_comparable && !same_dni;
	let has_independent_data = false;
	for (const field of [
		"fecha_nacimiento",
		"padre",
		"madre"
	]) if (results[field].comparable && results[field].value >= SIMILAR) has_independent_data = true;
	if (same_dni && (first_name_score > 0 || father_name_score > 0)) return {
		nivel: "alta",
		porcentaje: percent,
		coincide: matching_labels
	};
	if (names_match && has_independent_data && !different_dni) return {
		nivel: "alta",
		porcentaje: percent,
		coincide: matching_labels
	};
	if (same_dni || percent >= MIN_PERCENT) return {
		nivel: "posible",
		porcentaje: percent,
		coincide: matching_labels
	};
	return null;
}
function normalized_values(person) {
	return {
		dni: normalize$1(person.dni),
		nombres: normalize$1(person.nombres),
		apellido_paterno: normalize$1(person.apellido_paterno),
		apellido_materno: normalize$1(person.apellido_materno),
		fecha_nacimiento: normalize$1(person.fecha_nacimiento),
		padre: normalize$1(person.padre),
		madre: normalize$1(person.madre)
	};
}
function by_relevance(a, b) {
	const level_difference = Number(b.nivel === "alta") - Number(a.nivel === "alta");
	if (level_difference !== 0) return level_difference;
	return b.porcentaje - a.porcentaje;
}
function find_duplicates(db, type, exclude_sacrament_id, people) {
	if (!is_sacrament_type(type)) throw new ServiceError("Tipo de sacramento inválido.", 400);
	const searchable = people.map((person) => ({
		para: person.para ?? "",
		values: normalized_values(person)
	})).filter((person) => person.values.dni || person.values.nombres && person.values.apellido_paterno);
	if (searchable.length === 0) return {
		matches: [],
		total: 0
	};
	const excluded_id = Number.isInteger(exclude_sacrament_id) ? exclude_sacrament_id : 0;
	const candidates = db.prepare(`SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, par.nombre AS parroquia_nombre,
				pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
			 FROM (${people_of(type)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 JOIN parroquias par ON par.id = s.parroquia_id
			 WHERE s.estado = 'vigente' AND s.id <> ?`).all(excluded_id);
	const old_names = /* @__PURE__ */ new Map();
	const corrections = db.prepare(`SELECT persona_id, campo_cambio, valor_anterior FROM cambios_persona
			 WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_anterior IS NOT NULL
			   AND estado = 'aprobado'`).all();
	for (const correction of corrections) {
		const key = `${correction.persona_id}:${correction.campo_cambio}`;
		const list = old_names.get(key) ?? [];
		list.push(normalize$1(correction.valor_anterior));
		old_names.set(key, list);
	}
	let total = 0;
	const found = [];
	for (const person of searchable) {
		const matches = [];
		for (const candidate of candidates) {
			const result = compare(person.values, candidate, old_names);
			if (!result) continue;
			matches.push({
				sacramento_id: candidate.id,
				para: person.para,
				nivel: result.nivel,
				porcentaje: result.porcentaje,
				coincide: result.coincide,
				nombre_completo: full_name$1(candidate.nombres, candidate.apellido_paterno, candidate.apellido_materno),
				parroquia_nombre: candidate.parroquia_nombre,
				libro: candidate.libro,
				folio: candidate.folio,
				numero: candidate.numero
			});
		}
		total += matches.length;
		matches.sort(by_relevance);
		found.push(...matches.slice(0, MAX_MATCHES_PER_PERSON));
	}
	found.sort(by_relevance);
	return {
		matches: found,
		total
	};
}
var duplicate_routes = { "sacraments.findDuplicates": (payload, { db }) => {
	return find_duplicates(db, payload.tipo, payload.excluir_sacramento_id, payload.personas);
} };
//#endregion
//#region node_modules/worker-f/lib/stringifyFunctionReferences.js
var JAVASCRIPT_VARIABLE_NAME_REG_EXP = /^[$_\u0080-\uFFFFa-zA-Z][$_\u0080-\uFFFF\w]*$/;
/**
* In a given list of dependencies, it stringifies any functions to their javascript source code strings.
* It could've used simple `.toString()` if it wasn't for "minification" process which eventually renames
* all functions to random shortened names. Why do function names matter? Because the worker will have to
* call those functions by name rather than by reference, because a worker can't share any runtime code
* with the parent thread, hence the stringification to javascript source code.
*
* Alternatively, the code that is executed inside a worker could abstain from using global function references
* and instead reference any functions from some kind of a `context` object. In that case, minifiers
* won't touch the property names in that `context` object. The "pros" would be not having to use this "magic" function.
* The "cons" would be having to prepend the `context.` prefix to every function being called,
* and if any of those functions happen to call another functions, those would have to be called
* from the `context` too, which could quickly turn the code into a context-passing "spaghetti" mess.
* Not to mention having to define the `Context` type in case of TypeScript.
* But otherwise, both approaches would work and there's no other difference between them.
*
* @param {function} getDependencies — Returns an array of dependencies. This function must adhere to a strict form: it has to be a "closure" that returns an array of named variables. The restriction is because the exact variable names have to be known from the stringified form of this function.
* @returns {object} — An object of shape: `{ functions, values }` where `functions` contains the source code of any functions by their actual name, and `values` contains any "regular values" — strings, numbers, objects, arrays, etc — in their original (non-stringified) form.
*/
function stringifyFunctionReferences(getDependencies) {
	const functions = {};
	const variables = {};
	const references = getDependencies();
	const getReferencesSourceCode = getDependencies.toString();
	const referencedNames = getReferencesSourceCode.slice(getReferencesSourceCode.indexOf("[") + 1, getReferencesSourceCode.lastIndexOf("]")).split(",").map((_) => _.trim());
	for (const name of referencedNames) if (!JAVASCRIPT_VARIABLE_NAME_REG_EXP.test(name)) throw new Error(`Invalid dependency name: ${name}`);
	let i = 0;
	while (i < references.length) {
		let name = referencedNames[i];
		let value = references[i];
		if (typeof value === "function") functions[name] = getFunctionSourceCode(value, name);
		else variables[name] = value;
		i++;
	}
	return {
		functions,
		variables
	};
}
/**
* Returns the source code for a function or a class.
*
* For non-"native" classes, the end result will depend on the name of the class,
* which should be passed as a second argument for that reason. Specifically,
* the name of the class will be used when defining its `prototype` properties.
*
* "Native" functions or classes will be stringified to their "native" global name.
* For example, a reference to `ArrayBuffer` will be stringified as `"ArrayBuffer"`.
*
* @param {function} func
* @param {string} name
* @returns {string}
*/
function getFunctionSourceCode(func, name) {
	const funcSourceCode = func.toString();
	if (func.prototype) {
		if (funcSourceCode.indexOf("[native code]") >= 0) {
			const funcNameStartsAt = funcSourceCode.indexOf(" ", 8) + 1;
			const funcNameEndsBefore = funcSourceCode.indexOf("(", funcNameStartsAt);
			return funcSourceCode.slice(funcNameStartsAt, funcNameEndsBefore);
		} else {
			let code = funcSourceCode;
			for (const key in func.prototype) code += ";" + name + ".prototype." + key + "=" + func.prototype[key].toString();
			return code;
		}
	} else return funcSourceCode;
}
//#endregion
//#region node_modules/worker-f/lib/createWorker.js
/**
* Creates a worker.
*
* @example
* ```js
* // When running in a web browser.
* import createWorkerInBrowser from './createWorkerInBrowser.ts'
*
* // Create a worker.
* const workerFn = createWorkerFn(
* 	// Creates a worker in a given environment.
* 	createWorkerInBrowser,
*
* 	// (optional) Filters `transferList` argument.
* 	undefined,
*
* 	// Any "outside" dependencies that're referenced in the function (below).
* 	[() => [outsideVar1, outsideVar2, func1, func2]],
*
* 	// Returns a function in the worker that processes input data.
* 	(respond) => {
*  	return (data) => {
* 			// Process the data (perform some kind of calculation).
* 			const result = processData(data)
* 			// Post the result of the calculation back to the main thread.
* 			respond(result) // (optional) add `transferList` argument.
* 		}
*  },
*
* 	// A function in the main thread that will be called every time
* 	// when the worker has finished processing the data
* 	// (or threw an error while doing that).
* 	(error, result) => {
* 		if (error) {
* 			workerFn.stop()
* 			throw error
* 		}
* 		// If no more data will be passed to the worker, it should be terminated.
* 		workerFn.stop()
* 		console.log(result)
* 	}
* )
*
* workerFn.start()
*
* // Post a message with some data to the worker
* // so that it starts processing the data
* // and later posts a message back to the main thread
* // with the result of the calculation.
* workerFn.input(inputData) // (optional) add `transferList` argument.
* ```
*
* @param {function} createWorkerInEnvironment — Creates a worker in a given environment. The worker must call globally-available `onMessage(data)` function every time it receives a message, and it must define a `var postMessage = (data) => void` function that posts a message to the parent (main) thread.
* @param {function} createInputHandler — A "creator" that creates a function that will be called with message data every time a message is sent to this worker. The "creator" function receives a single argument — a function that posts data back to the main thread, with two arguments: `outputData` and (optional) `transferList`.
* @param {function} onError — This function will be called every time when there was an error while processing an incoming message. It would be logical to call `worker.terminate()` inside this function.
* @param {function} onOutput — This function will be called every time when done processing an incoming message.
* @param {function} getFromCache — Could be used to add caching. Has no arguments. Returns the cached value.
* @param {function} setInCache — Could be used to add caching. Receives the value to cache as an argument. Doesn't return anything.
* @returns {Worker} — An object with methods: `start(getDependenciesFunctionOrArrayOfGetDependenciesFunctions)`, `stop()`, `input(data, [transferList])`. Calling `stop()` requests termination of the worker. Calling `stop()` multiple times is safe and will not throw any errors.
*/
function createWorker(createWorkerInEnvironment, createInputHandler, onError, onOutput, getFromCache, setInCache) {
	let started = false;
	let worker;
	const stop = () => {
		worker.stop();
	};
	const ingest = (data, transferList) => {
		try {
			worker.ingest(data, transferList);
		} catch (error) {
			stop();
			throw error;
		}
	};
	const start = (arrayOfGetDependenciesFunctions, dependenciesTransferList) => {
		if (started) throw new Error("Was started");
		started = true;
		const cacheValue = getFromCache();
		const cachedCodeAndVars = cacheValue && cacheValue._;
		const codeAndVars = cachedCodeAndVars || getCodeAndVars(createInputHandler, arrayOfGetDependenciesFunctions);
		if (!cachedCodeAndVars) setInCache({ _: codeAndVars });
		const [code, vars] = codeAndVars;
		const getOtherFromCache = () => {
			const properties = getFromCache();
			if (properties) return properties.other;
		};
		const setOtherInCache = (value) => {
			setInCache(Object.assign(Object.assign({}, getFromCache()), { other: value }));
		};
		worker = createWorkerInEnvironment(code, getOtherFromCache, setOtherInCache, onError, onOutput);
		if (vars) ingest(vars, dependenciesTransferList);
	};
	return {
		start,
		stop,
		ingest
	};
}
var JAVASCRIPT_CODE_AFTER_CREATE_INPUT_HANDLER_FUNCTION = ")(postMessage)}";
function getCodeAndVars(createInputHandler, arrayOfGetDependenciesFunctions) {
	const [functionDefinitions, vars] = createFunctionsCodeAndVars(arrayOfGetDependenciesFunctions);
	return [functionDefinitions + ";var onMessage = function(data) {for (var key in data) {self[key] = data[key]}onMessage = (" + createInputHandler.toString() + JAVASCRIPT_CODE_AFTER_CREATE_INPUT_HANDLER_FUNCTION, vars];
}
function createFunctionsCodeAndVars(arrayOfGetDependenciesFunctions) {
	let funcs = {};
	let vars = {};
	for (const getDependencies of arrayOfGetDependenciesFunctions) {
		const { functions, variables } = stringifyFunctionReferences(getDependencies);
		funcs = Object.assign(Object.assign({}, funcs), functions);
		vars = Object.assign(Object.assign({}, vars), variables);
	}
	return [Object.keys(funcs).map((functionName) => {
		return functionName + "=" + funcs[functionName];
	}).join(";"), vars];
}
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunctionOrStream.js
function createWorkerFunctionOrStream(createWorkerInEnvironment, fnOrAlias, createMethods, createInputHandler, handleError, handleOutput) {
	let started = false;
	let stopped = false;
	let getDependenciesFunctions = [];
	const dependenciesTransferList = void 0;
	let inputTransferList = () => [];
	let outputTransferList = () => [];
	let alias = void 0;
	let cacheValue = void 0;
	const getFromCache = (cacheKey) => {
		return CACHE[cacheKey];
	};
	const setInCache = (cacheKey, value) => {
		CACHE[cacheKey] = value;
	};
	const mustHaveStarted = () => {
		if (!started) throw new Error("Not started");
	};
	const mustNotHaveStarted = () => {
		if (started) throw new Error("Was started");
	};
	const mustNotHaveStopped = () => {
		if (stopped) throw new Error("Was stopped");
	};
	const mustNotHaveAlias = () => {
		if (alias) throw new Error("Has alias");
	};
	const argumentMustBeFunction = (arg) => {
		if (typeof arg !== "function") throw new TypeError("Argument must be a function");
	};
	let fn;
	if (typeof fnOrAlias === "string") {
		alias = fnOrAlias;
		cacheValue = getFromCache(alias);
		if (!cacheValue || !cacheValue.$) throw new Error("Not found");
		fn = cacheValue.$[0];
		getDependenciesFunctions = cacheValue.$[1];
		inputTransferList = cacheValue.$[2];
		outputTransferList = cacheValue.$[3];
		cacheValue.$[4];
	} else fn = fnOrAlias;
	argumentMustBeFunction(fn);
	let worker;
	/**
	* Adds external dependencies.
	* These dependencies must not change after the function is started.
	*
	* @param {function} getDependencies — A "closure" function that returns an array of dependencies — global variables or functions — that will be used in this worker. If some dependencies get overlooked, the worker will throw "[name] is not defined".
	*/
	const addDependencies_ = (getDependencies) => {
		mustNotHaveStopped();
		mustNotHaveStarted();
		argumentMustBeFunction(getDependencies);
		getDependenciesFunctions.push(getDependencies);
	};
	const start = () => {
		mustNotHaveStopped();
		mustNotHaveStarted();
		const getInitialDependencies = () => [
			fn,
			outputTransferList,
			createInputHandler
		];
		addDependencies_(getInitialDependencies);
		started = true;
		worker.start(getDependenciesFunctions, dependenciesTransferList);
	};
	const stop = () => {
		stopped = true;
		worker.stop();
	};
	const sendToWorker = (inputArgs) => {
		worker.ingest([Date.now(), inputArgs], inputTransferList(...inputArgs));
	};
	let numberOrUndefined;
	const workerFn = Object.assign({
		inputLatency: numberOrUndefined,
		outputLatency: numberOrUndefined,
		/**
		* Adds external dependencies.
		* These dependencies must not change after the function is started.
		*
		* @param {function} getDependencies — A "closure" function that returns an array of dependencies — global variables or functions — that will be used in this worker. If some dependencies get overlooked, the worker will throw "[name] is not defined".
		*/
		addDependencies(getDependencies) {
			mustNotHaveAlias();
			addDependencies_(getDependencies);
		},
		inputTransferList: (fn) => {
			mustNotHaveStopped();
			mustNotHaveStarted();
			mustNotHaveAlias();
			argumentMustBeFunction(fn);
			inputTransferList = fn;
		},
		outputTransferList: (fn) => {
			mustNotHaveStopped();
			mustNotHaveStarted();
			mustNotHaveAlias();
			argumentMustBeFunction(fn);
			outputTransferList = fn;
		},
		alias(alias_) {
			mustNotHaveStopped();
			mustNotHaveStarted();
			mustNotHaveAlias();
			alias = alias_;
			setInCache(alias, { $: [
				fn,
				getDependenciesFunctions,
				inputTransferList,
				outputTransferList
			] });
		},
		start,
		stop
	}, createMethods(start, stop, started, stopped, sendToWorker, mustHaveStarted, mustNotHaveStarted, mustNotHaveStopped));
	const getOtherFromCache = () => {
		if (alias) {
			const properties = getFromCache(alias);
			if (properties) return properties.other;
		}
	};
	const setOtherInCache = (value) => {
		if (alias) setInCache(alias, Object.assign(Object.assign({}, getFromCache(alias)), { other: value }));
	};
	worker = createWorker(createWorkerInEnvironment, (sendOutput_) => {
		let inputSentTimestamp = -1;
		let inputReceivedTimestamp = -1;
		const sendOutput = (output) => {
			sendOutput_([
				inputSentTimestamp,
				inputReceivedTimestamp,
				Date.now(),
				output
			], outputTransferList(output));
		};
		const inputHandler = createInputHandler(fn, sendOutput);
		return ([inputSentAt, input]) => {
			inputSentTimestamp = inputSentAt;
			inputReceivedTimestamp = Date.now();
			return inputHandler(input);
		};
	}, (error) => {
		if (!stopped) handleError(error);
	}, ([inputSentTimestamp, inputReceivedTimestamp, outputTimestamp, output]) => {
		if (!stopped) {
			if (inputSentTimestamp !== -1) workerFn.inputLatency = inputReceivedTimestamp - inputSentTimestamp;
			workerFn.outputLatency = Date.now() - outputTimestamp;
			handleOutput(output);
		}
	}, getOtherFromCache, setOtherInCache);
	return workerFn;
}
var CACHE = {};
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunction.js
function createWorkerFunction(createWorkerInEnvironment, fnOrAlias) {
	let resolveCall = void 0;
	let rejectCall = void 0;
	const createMethods = (start, stop, started, stopped, sendToWorker, mustHaveStarted, mustNotHaveStarted, mustNotHaveStopped) => ({
		call(...args) {
			mustNotHaveStopped();
			mustHaveStarted();
			if (resolveCall || rejectCall) throw new Error("Previous call not finished");
			return new Promise((resolve, reject) => {
				resolveCall = resolve;
				rejectCall = reject;
				sendToWorker(args);
			});
		},
		callOnce(...args) {
			start();
			return this.call(...args).finally(stop);
		}
	});
	const createInputHandler = (fn, emit) => {
		const isPromise = (anything) => {
			return anything !== null && typeof anything === "object" && typeof anything.then === "function";
		};
		return (args) => {
			const result = fn(...args);
			if (isPromise(result)) result.then(emit);
			else emit(result);
		};
	};
	const handleError = (error) => {
		if (rejectCall) {
			rejectCall(error);
			resolveCall = void 0;
			rejectCall = void 0;
		} else throw new Error("`reject` callback not found");
	};
	const handleOutput = (output) => {
		if (resolveCall) {
			resolveCall(output);
			resolveCall = void 0;
			rejectCall = void 0;
		} else throw new Error("`resolve` callback not found");
	};
	return createWorkerFunctionOrStream(createWorkerInEnvironment, fnOrAlias, createMethods, createInputHandler, handleError, handleOutput);
}
//#endregion
//#region node_modules/worker-f/lib/environment/createWorkerInNode.js
/**
* Creates a worker in Node.js.
*
* Defines a `var postMessage = (data, [transferList]) => ...` function.
* Requires a `var onMessage = (data) => ...` function to be defined.
*
* @param {string} javascriptCode
* @param {function} getFromCache — Could be used to add caching. Has no arguments. Returns the cached value.
* @param {function} setInCache — Could be used to add caching. Receives the value to cache as an argument. Doesn't return anything.
* @param {function} onError — This function will be called every time when there was an error while processing an incoming message. It would be logical to call `worker.terminate()` inside this function.
* @param {function} onOutput — This function will be called every time when done processing an incoming message.
* @returns {Worker} — An object with methods: `ingest(data, transferList)`, `stop()`.
*/
function createWorkerInNode(javascriptCode, getFromCache, setInCache, onError, onOutput) {
	let requestedTermination = false;
	let processedError = false;
	let code = getFromCache();
	if (!code) {
		code = createWorkerCode(javascriptCode);
		setInCache(code);
	}
	const worker = new Worker(code, { eval: true }).on("error", (error) => {
		processedError = true;
		onError(error);
	}).on("message", (message) => {
		onOutput(message);
	}).on("exit", (exitCode) => {
		if (exitCode && !processedError && !requestedTermination) onError(/* @__PURE__ */ new Error("Exited with code " + exitCode));
	});
	const stop = () => {
		requestedTermination = true;
		Worker.prototype.terminate.call(worker);
	};
	return {
		stop,
		ingest: worker.postMessage.bind(worker)
	};
}
function createWorkerCode(javascriptCode) {
	return javascriptCode + ";" + JAVASCRIPT_CODE_ADDITIONAL;
}
var JAVASCRIPT_CODE_ADDITIONAL = "var workerThreads = require(\"worker_threads\");workerThreads.parentPort.on(\"message\", function(data) {onMessage(data)});var postMessage = function(data, transferList) {workerThreads.parentPort.postMessage(data, transferList)};self = global";
//#endregion
//#region node_modules/worker-f/lib/export/node/createWorkerFunctionInNode.js
function createWorkerFunctionInNode(fnOrAlias) {
	return createWorkerFunction(createWorkerInNode, fnOrAlias);
}
//#endregion
//#region node_modules/read-excel-file/modules/saxen/parser.js
function _typeof$8(o) {
	"@babel/helpers - typeof";
	return _typeof$8 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$8(o);
}
function Parser_(options) {
	var fromCharCode = String.fromCharCode;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var ENTITY_PATTERN = /&#(\d+);|&#x([0-9a-f]+);|&(\w+);/gi;
	var ENTITY_MAPPING = {
		"amp": "&",
		"apos": "'",
		"gt": ">",
		"lt": "<",
		"quot": "\""
	};
	Object.keys(ENTITY_MAPPING).forEach(function(k) {
		ENTITY_MAPPING[k.toUpperCase()] = ENTITY_MAPPING[k];
	});
	function replaceEntities(_, d, x, z) {
		if (z) {
			if (hasOwnProperty.call(ENTITY_MAPPING, z)) return ENTITY_MAPPING[z];
			else return "&" + z + ";";
		}
		if (d) return fromCharCode(d);
		return fromCharCode(parseInt(x, 16));
	}
	/**
	* A basic entity decoder that can decode a minimal
	* sub-set of reserved names (&amp;) as well as
	* hex (&#xaaf;) and decimal (&#1231;) encoded characters.
	*
	* @param {string} s
	*
	* @return {string} decoded string
	*/
	function decodeEntities(s) {
		if (s.length > 3 && s.indexOf("&") !== -1) return s.replace(ENTITY_PATTERN, replaceEntities);
		return s;
	}
	var NON_WHITESPACE_OUTSIDE_ROOT_NODE = "non-whitespace outside of root node";
	function error(msg) {
		return new Error(msg);
	}
	function missingNamespaceForPrefix(prefix) {
		return "missing namespace for prefix <" + prefix + ">";
	}
	function getter(getFn) {
		return {
			"get": getFn,
			"enumerable": true
		};
	}
	function cloneNsMatrix(nsMatrix) {
		var clone = {}, key;
		for (key in nsMatrix) clone[key] = nsMatrix[key];
		return clone;
	}
	var NAME_CACHE = Symbol("nameCache");
	function uriPrefix(prefix) {
		return prefix + "$uri";
	}
	function buildNsMatrix(nsUriToPrefix) {
		var nsMatrix = {}, uri, prefix;
		for (uri in nsUriToPrefix) {
			prefix = nsUriToPrefix[uri];
			nsMatrix[prefix] = prefix;
			nsMatrix[uriPrefix(prefix)] = uri;
		}
		return nsMatrix;
	}
	function noopGetContext() {
		return {
			line: 0,
			column: 0
		};
	}
	function throwFunc(err) {
		throw err;
	}
	/**
	* Creates a new parser with the given options.
	*
	* @constructor
	*
	* @param  {!Object<string, ?>=} options
	*/
	function Parser(options) {
		if (!this) return new Parser(options);
		var proxy = options && options["proxy"];
		var onText, onOpenTag, onCloseTag, onCDATA, onError = throwFunc, onWarning, onComment, onQuestion, onAttention;
		var getContext = noopGetContext;
		/**
		* Are we currently consuming a chunked stream of XML,
		* i.e. is a `write` call in progress that may be followed
		* by more chunks?
		*
		* @type {boolean}
		*/
		var streaming = false;
		/**
		* Did we already encounter the root tag?
		*
		* Persisted across `write` calls so we can detect a missing
		* start tag once the stream ends.
		*
		* @type {boolean}
		*/
		var rootTagFound = false;
		/**
		* Not yet parsed remainder of the previously written chunk,
		* i.e. an incomplete token that awaits more input.
		*
		* @type {string}
		*/
		var leftoverXml = "";
		/**
		* Do we need to parse the current elements attributes for namespaces?
		*
		* @type {boolean}
		*/
		var maybeNS = false;
		/**
		* Do we process namespaces at all?
		*
		* @type {boolean}
		*/
		var isNamespace = false;
		/**
		* The caught error returned on parse end
		*
		* @type {Error}
		*/
		var returnError = null;
		/**
		* Should we stop parsing?
		*
		* @type {boolean}
		*/
		var parseStop = false;
		/**
		* Namespace + node state shared across (streamed) parse runs.
		*/
		var nsMatrixStack, nsMatrix, nodeStack;
		/**
		* A map of { uri: prefix } used by the parser.
		*
		* This map will ensure we can normalize prefixes during processing;
		* for each uri, only one prefix will be exposed to the handlers.
		*
		* @type {!Object<string, string>}}
		*/
		var nsUriToPrefix;
		/**
		* Handle parse error.
		*
		* @param  {string|Error} err
		*/
		function handleError(err) {
			if (!(err instanceof Error)) err = error(err);
			returnError = err;
			onError(err, getContext);
		}
		/**
		* Handle parse error.
		*
		* @param  {string|Error} err
		*/
		function handleWarning(err) {
			if (!onWarning) return;
			if (!(err instanceof Error)) err = error(err);
			onWarning(err, getContext);
		}
		/**
		* Register parse listener.
		*
		* @param  {string}   name
		* @param  {Function} cb
		*
		* @return {Parser}
		*/
		this["on"] = function(name, cb) {
			if (typeof cb !== "function") throw error("required args <name, cb>");
			switch (name) {
				case "openTag":
					onOpenTag = cb;
					break;
				case "text":
					onText = cb;
					break;
				case "closeTag":
					onCloseTag = cb;
					break;
				case "error":
					onError = cb;
					break;
				case "warn":
					onWarning = cb;
					break;
				case "cdata":
					onCDATA = cb;
					break;
				case "attention":
					onAttention = cb;
					break;
				case "question":
					onQuestion = cb;
					break;
				case "comment":
					onComment = cb;
					break;
				default: throw error("unsupported event: " + name);
			}
			return this;
		};
		/**
		* Set the namespace to prefix mapping.
		*
		* @example
		*
		* parser.ns({
		*   'http://foo': 'foo',
		*   'http://bar': 'bar'
		* });
		*
		* @param  {!Object<string, string>} nsMap
		*
		* @return {Parser}
		*/
		this["ns"] = function(nsMap) {
			if (typeof nsMap === "undefined") nsMap = {};
			if (_typeof$8(nsMap) !== "object") throw error("required args <nsMap={}>");
			var _nsUriToPrefix = {}, k;
			for (k in nsMap) _nsUriToPrefix[k] = nsMap[k];
			isNamespace = true;
			nsUriToPrefix = _nsUriToPrefix;
			return this;
		};
		/**
		* Reset the parser state before a (streamed) parse run.
		*/
		function resetState() {
			nsMatrixStack = isNamespace ? [] : null;
			nsMatrix = isNamespace ? buildNsMatrix(nsUriToPrefix) : null;
			nodeStack = [];
			getContext = noopGetContext;
			parseStop = false;
			returnError = null;
			rootTagFound = false;
			leftoverXml = "";
		}
		/**
		* Parse a complete xml string.
		*
		* @param  {string} xml
		*
		* @return {Error} returnError, if not thrown
		*/
		this["parse"] = function(xml) {
			if (typeof xml !== "string") throw error("required args <xml=string>");
			if (streaming) throw error("parse during stream; call end() first");
			resetState();
			parse(xml);
			getContext = noopGetContext;
			parseStop = false;
			return returnError;
		};
		/**
		* Write the next chunk of a streamed xml string.
		*
		* Parse events are emitted for all complete tokens; an
		* incomplete trailing token is buffered until the next
		* `write` or, ultimately, reported as an error on `end`.
		*
		* @param  {string} xml
		*
		* @return {Parser} self
		*/
		this["write"] = function(xml) {
			if (typeof xml !== "string") throw error("required args <xml=string>");
			if (!streaming) {
				resetState();
				streaming = true;
			}
			if (!returnError) leftoverXml = parse(leftoverXml + xml, true) || "";
			return this;
		};
		/**
		* Finish parsing a streamed xml string, i.e. signal that
		* no more chunks will be written.
		*
		* @return {Error} returnError, if not thrown
		*/
		this["end"] = function() {
			if (!streaming) resetState();
			streaming = false;
			if (!returnError) parse(leftoverXml);
			leftoverXml = "";
			getContext = noopGetContext;
			parseStop = false;
			return returnError;
		};
		/**
		* Stop parsing.
		*/
		this["stop"] = function() {
			parseStop = true;
		};
		/**
		* Parse string, invoking configured listeners on element.
		*
		* Namespace and node stack state is shared across (streamed)
		* invocations via the enclosing parser scope.
		*
		* Internal note: while `streaming`, an incomplete trailing token
		* is not treated as an error but returned so `write` can buffer it
		* and prepend it to the next chunk. This buffered remainder is an
		* implementation detail of the streaming buffer, not a public API;
		* outside of that case the return value is `undefined`.
		*
		* @param {string} xml
		* @param {boolean} streaming
		*
		* @return {string|undefined} buffered remainder, streaming internal use only
		*/
		function parse(xml) {
			var streaming = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
			var elNameCache = null, elNameCacheMatrix = null;
			var _nsMatrix, anonymousNsCount = 0, tagStart = false, tagEnd = false, i = 0, j = 0, x, y, q, w, v, xmlns, elementName, _elementName, elementProxy;
			var attrsString = "", attrsStart = 0, cachedAttrs;
			/**
			* Normalize a namespaced attribute name against the current
			* namespace matrix.
			*
			* @param {string} name
			* @param {string|boolean} defaultAlias
			*
			* @return {string|null} normalized name, or `null` when the prefix
			*                       has no namespace (a warning is emitted)
			*/
			function normalizeAttrName(name, defaultAlias) {
				var w = name.indexOf(":");
				if (w === -1) return name;
				var nsName = nsMatrix[name.substring(0, w)];
				if (!nsName) {
					handleWarning(missingNamespaceForPrefix(name.substring(0, w)));
					return null;
				}
				return defaultAlias === nsName ? name.substr(w + 1) : nsName + name.substr(w);
			}
			/**
			* Parse attributes on demand and returns the parsed attributes.
			*
			* Return semantics: (1) `false` on attribute parse error,
			* (2) object hash on extracted attrs.
			*
			* @return {boolean|Object}
			*/
			function getAttrs() {
				if (cachedAttrs !== null) return cachedAttrs;
				var nsUri, nsUriPrefix, defaultAlias = isNamespace && nsMatrix["xmlns"], attrList = isNamespace && maybeNS ? [] : null, i = attrsStart, s = attrsString, l = s.length, hasNewMatrix, newalias, value, alias, name, attrs = {}, seenAttrs = /* @__PURE__ */ new Set(), skipAttr, w, j;
				parseAttr: for (; i < l; i++) {
					skipAttr = false;
					w = s.charCodeAt(i);
					if (w === 32 || w < 14 && w > 8) continue;
					if (w < 65 || w > 122 || w > 90 && w < 97) {
						if (w !== 95 && w !== 58) {
							handleWarning("illegal first char attribute name");
							skipAttr = true;
						}
					}
					for (j = i + 1; j < l; j++) {
						w = s.charCodeAt(j);
						if (w > 96 && w < 123 || w > 64 && w < 91 || w > 47 && w < 59 || w === 46 || w === 45 || w === 95) continue;
						if (w === 32 || w < 14 && w > 8) {
							handleWarning("missing attribute value");
							i = j;
							continue parseAttr;
						}
						if (w === 61) break;
						handleWarning("illegal attribute name char");
						skipAttr = true;
					}
					name = s.substring(i, j);
					if (name === "xmlns:xmlns") {
						handleWarning("illegal declaration of xmlns");
						skipAttr = true;
					}
					w = s.charCodeAt(j + 1);
					if (w === 34) {
						j = s.indexOf("\"", i = j + 2);
						if (j === -1) {
							j = s.indexOf("'", i);
							if (j !== -1) {
								handleWarning("attribute value quote missmatch");
								skipAttr = true;
							}
						}
					} else if (w === 39) {
						j = s.indexOf("'", i = j + 2);
						if (j === -1) {
							j = s.indexOf("\"", i);
							if (j !== -1) {
								handleWarning("attribute value quote missmatch");
								skipAttr = true;
							}
						}
					} else {
						handleWarning("missing attribute value quotes");
						skipAttr = true;
						for (j = j + 1; j < l; j++) {
							w = s.charCodeAt(j + 1);
							if (w === 32 || w < 14 && w > 8) break;
						}
					}
					if (j === -1) {
						handleWarning("missing closing quotes");
						j = l;
						skipAttr = true;
					}
					if (!skipAttr) value = s.substring(i, j);
					i = j;
					for (; j + 1 < l; j++) {
						w = s.charCodeAt(j + 1);
						if (w === 32 || w < 14 && w > 8) break;
						if (i === j) {
							handleWarning("illegal character after attribute end");
							skipAttr = true;
						}
					}
					i = j + 1;
					if (skipAttr) continue parseAttr;
					if (seenAttrs.has(name)) {
						handleWarning("attribute <" + name + "> already defined");
						continue;
					}
					seenAttrs.add(name);
					if (!isNamespace) {
						attrs[name] = value;
						continue;
					}
					if (maybeNS) {
						newalias = name === "xmlns" ? "xmlns" : name.charCodeAt(0) === 120 && name.substr(0, 6) === "xmlns:" ? name.substr(6) : null;
						if (newalias !== null) {
							nsUri = decodeEntities(value);
							nsUriPrefix = uriPrefix(newalias);
							alias = nsUriToPrefix[nsUri];
							if (!alias) {
								if (newalias === "xmlns" || nsUriPrefix in nsMatrix && nsMatrix[nsUriPrefix] !== nsUri) do
									alias = "ns" + anonymousNsCount++;
								while (typeof nsMatrix[alias] !== "undefined");
								else alias = newalias;
								nsUriToPrefix[nsUri] = alias;
							}
							if (nsMatrix[newalias] !== alias) {
								if (!hasNewMatrix) {
									nsMatrix = cloneNsMatrix(nsMatrix);
									hasNewMatrix = true;
								}
								nsMatrix[newalias] = alias;
								if (newalias === "xmlns") {
									nsMatrix[uriPrefix(alias)] = nsUri;
									defaultAlias = alias;
								}
								nsMatrix[nsUriPrefix] = nsUri;
							}
							attrs[name] = value;
							continue;
						}
						attrList.push(name, value);
						continue;
					}
					name = normalizeAttrName(name, defaultAlias);
					if (name === null) continue;
					attrs[name] = value;
				}
				if (maybeNS) for (i = 0, l = attrList.length; i < l; i++) {
					name = normalizeAttrName(attrList[i++], defaultAlias);
					value = attrList[i];
					if (name === null) continue;
					attrs[name] = value;
				}
				return cachedAttrs = attrs;
			}
			/**
			* Extract the parse context { line, column, part }
			* from the current parser position.
			*
			* @return {Object} parse context
			*/
			function getParseContext() {
				var splitsRe = /(\r\n|\r|\n)/g;
				var line = 0;
				var column = 0;
				var startOfLine = 0;
				var endOfLine = j;
				var match;
				var data;
				while (i >= startOfLine) {
					match = splitsRe.exec(xml);
					if (!match) break;
					endOfLine = match[0].length + match.index;
					if (endOfLine > i) break;
					line += 1;
					startOfLine = endOfLine;
				}
				if (i == -1) {
					column = endOfLine;
					data = xml.substring(j);
				} else if (j === 0) data = xml.substring(j, i);
				else {
					column = i - startOfLine;
					data = j == -1 ? xml.substring(i) : xml.substring(i, j + 1);
				}
				return {
					"data": data,
					"line": line,
					"column": column
				};
			}
			getContext = getParseContext;
			if (proxy) elementProxy = Object.create({}, {
				"name": getter(function() {
					return elementName;
				}),
				"originalName": getter(function() {
					return _elementName;
				}),
				"attrs": getter(getAttrs),
				"ns": getter(function() {
					return nsMatrix;
				})
			});
			while (j !== -1) {
				if (xml.charCodeAt(j) === 60) i = j;
				else i = xml.indexOf("<", j);
				if (i === -1) {
					if (streaming) return xml.substring(j);
					if (nodeStack.length) return handleError("unexpected end of file");
					if (!rootTagFound) return handleError("missing start tag");
					if (j < xml.length) {
						if (xml.substring(j).trim()) handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);
					}
					return;
				}
				if (!rootTagFound) rootTagFound = true;
				if (j !== i) {
					if (nodeStack.length) {
						if (onText) {
							onText(xml.substring(j, i), decodeEntities, getContext);
							if (parseStop) return;
						}
					} else if (xml.substring(j, i).trim()) {
						handleWarning(NON_WHITESPACE_OUTSIDE_ROOT_NODE);
						if (parseStop) return;
					}
				}
				w = xml.charCodeAt(i + 1);
				if (w === 33) {
					q = xml.charCodeAt(i + 2);
					if (q === 91 && xml.substr(i + 3, 6) === "CDATA[") {
						j = xml.indexOf("]]>", i);
						if (j === -1) {
							if (streaming) return xml.substring(i);
							return handleError("unclosed cdata");
						}
						if (onCDATA) {
							onCDATA(xml.substring(i + 9, j), getContext);
							if (parseStop) return;
						}
						j += 3;
						continue;
					}
					if (q === 45 && xml.charCodeAt(i + 3) === 45) {
						j = xml.indexOf("-->", i);
						if (j === -1) {
							if (streaming) return xml.substring(i);
							return handleError("unclosed comment");
						}
						if (onComment) {
							onComment(xml.substring(i + 4, j), decodeEntities, getContext);
							if (parseStop) return;
						}
						j += 3;
						continue;
					}
				}
				if (w === 63) {
					j = xml.indexOf("?>", i);
					if (j === -1) {
						if (streaming) return xml.substring(i);
						return handleError("unclosed question");
					}
					if (onQuestion) {
						onQuestion(xml.substring(i, j + 2), getContext);
						if (parseStop) return;
					}
					j += 2;
					continue;
				}
				for (x = i + 1;; x++) {
					v = xml.charCodeAt(x);
					if (isNaN(v)) {
						if (streaming) return xml.substring(i);
						j = -1;
						return handleError("unclosed tag");
					}
					if (v === 34) {
						q = xml.indexOf("\"", x + 1);
						x = q !== -1 ? q : x;
					} else if (v === 39) {
						q = xml.indexOf("'", x + 1);
						x = q !== -1 ? q : x;
					} else if (v === 62) {
						j = x;
						break;
					}
				}
				if (w === 33) {
					if (onAttention) {
						onAttention(xml.substring(i, j + 1), decodeEntities, getContext);
						if (parseStop) return;
					}
					j += 1;
					continue;
				}
				cachedAttrs = {};
				if (w === 47) {
					tagStart = false;
					tagEnd = true;
					if (!nodeStack.length) return handleError("missing open tag");
					x = elementName = nodeStack.pop();
					q = i + 2 + x.length;
					if (xml.substring(i + 2, q) !== x) return handleError("closing tag mismatch");
					for (; q < j; q++) {
						w = xml.charCodeAt(q);
						if (w === 32 || w > 8 && w < 14) continue;
						return handleError("close tag");
					}
				} else {
					if (xml.charCodeAt(j - 1) === 47) {
						x = elementName = xml.substring(i + 1, j - 1);
						tagStart = true;
						tagEnd = true;
					} else {
						x = elementName = xml.substring(i + 1, j);
						tagStart = true;
						tagEnd = false;
					}
					if (!(w > 96 && w < 123 || w > 64 && w < 91 || w === 95 || w === 58)) return handleError("illegal first char nodeName");
					for (q = 1, y = x.length; q < y; q++) {
						w = x.charCodeAt(q);
						if (w > 96 && w < 123 || w > 64 && w < 91 || w > 47 && w < 59 || w === 45 || w === 95 || w == 46) continue;
						if (w === 32 || w < 14 && w > 8) {
							elementName = x.substring(0, q);
							cachedAttrs = null;
							break;
						}
						return handleError("invalid nodeName");
					}
					if (!tagEnd) nodeStack.push(elementName);
				}
				if (isNamespace) {
					_nsMatrix = nsMatrix;
					if (tagStart) {
						if (!tagEnd) nsMatrixStack.push(_nsMatrix);
						if (cachedAttrs === null) {
							if (maybeNS = x.indexOf("xmlns", q) !== -1) {
								attrsStart = q;
								attrsString = x;
								getAttrs();
								maybeNS = false;
							}
						}
					}
					_elementName = elementName;
					if (elNameCacheMatrix !== nsMatrix) {
						elNameCache = nsMatrix[NAME_CACHE];
						if (elNameCache === void 0) elNameCache = nsMatrix[NAME_CACHE] = {};
						elNameCacheMatrix = nsMatrix;
					}
					var _cachedName = elNameCache[elementName];
					if (_cachedName !== void 0) elementName = _cachedName;
					else {
						w = elementName.indexOf(":");
						if (w !== -1) {
							xmlns = nsMatrix[elementName.substring(0, w)];
							if (!xmlns) return handleError("missing namespace on <" + _elementName + ">");
							elementName = elementName.substr(w + 1);
						} else xmlns = nsMatrix["xmlns"];
						if (xmlns) elementName = xmlns + ":" + elementName;
						elNameCache[_elementName] = elementName;
					}
				}
				if (tagStart) {
					attrsStart = q;
					attrsString = x;
					if (onOpenTag) {
						if (proxy) onOpenTag(elementProxy, decodeEntities, tagEnd, getContext);
						else onOpenTag(elementName, getAttrs, decodeEntities, tagEnd, getContext);
						if (parseStop) return;
					}
				}
				if (tagEnd) {
					if (onCloseTag) {
						onCloseTag(proxy ? elementProxy : elementName, decodeEntities, tagStart, getContext);
						if (parseStop) return;
					}
					if (isNamespace) {
						if (!tagStart) nsMatrix = nsMatrixStack.pop();
						else nsMatrix = _nsMatrix;
					}
				}
				j += 1;
			}
		}
	}
	return new Parser(options);
}
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXmlStream.saxen.js
/**
* Parses XML markup in a streaming fashion by calling the supplied callback functions as the XML markup is being input.
* @param {any} state — The initial `state`. This `state` will supposedly be modified by the callback functions as the XML is being parsed.
* @param {function} [onOpenTag]
* @param {function} [onCloseTag]
* @param {function} [onText]
* @returns {object} An object with properties: `promise`, `write(string)`, `end()`. The `promise` resolves with nothing.
*/
function parseXmlStream(state, onOpenTag, onCloseTag, onText) {
	var errored = false;
	var mustNotHaveErrored = function mustNotHaveErrored() {
		if (errored) throw new Error("Errored");
	};
	var resolvePromise;
	var parser = new Parser_();
	return {
		promise: new Promise(function(resolve, reject) {
			resolvePromise = resolve;
			var onerror = function onerror(error) {
				errored = true;
				throw error;
			};
			var ontext = function ontext(text, decodeEntities) {
				if (onText) onText(decodeEntities(text), state);
			};
			var onopentag = function onopentag(elementName, getAttributes, decodeEntities, selfClosing, getContext) {
				if (onOpenTag) {
					var attributes = getAttributes();
					for (var name in attributes) attributes[trimXmlnsPrefix(name, true)] = decodeEntities(attributes[name]);
					onOpenTag(trimXmlnsPrefix(elementName), attributes, state);
				}
			};
			var onclosetag = function onclosetag(elementName) {
				if (onCloseTag) onCloseTag(trimXmlnsPrefix(elementName), state);
			};
			parser.on("error", onerror);
			parser.on("text", ontext);
			parser.on("openTag", onopentag);
			parser.on("closeTag", onclosetag);
		}),
		write: function write(xml) {
			mustNotHaveErrored();
			parser.write(xml);
		},
		end: function end() {
			mustNotHaveErrored();
			parser.end();
			resolvePromise();
		}
	};
}
function trimXmlnsPrefix(string, isAttributeName) {
	var i = 0;
	while (i < string.length) {
		if (string[i] === ":") {
			if (isAttributeName && i === 5 && string.slice(0, 5) === "xmlns") {} else return string.slice(i + 1);
		}
		i++;
	}
	return string;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/InvalidSpreadsheetError.js
function _typeof$7(o) {
	"@babel/helpers - typeof";
	return _typeof$7 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$7(o);
}
function _defineProperties$4(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, _toPropertyKey$6(descriptor.key), descriptor);
	}
}
function _createClass$4(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$4(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$4(Constructor, staticProps);
	Object.defineProperty(Constructor, "prototype", { writable: false });
	return Constructor;
}
function _toPropertyKey$6(arg) {
	var key = _toPrimitive$6(arg, "string");
	return _typeof$7(key) === "symbol" ? key : String(key);
}
function _toPrimitive$6(input, hint) {
	if (_typeof$7(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$7(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _classCallCheck$4(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _inherits$4(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	Object.defineProperty(subClass, "prototype", { writable: false });
	if (superClass) _setPrototypeOf$4(subClass, superClass);
}
function _createSuper$4(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct$4();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf$4(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf$4(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn$4(this, result);
	};
}
function _possibleConstructorReturn$4(self, call) {
	if (call && (_typeof$7(call) === "object" || typeof call === "function")) return call;
	else if (call !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
	return _assertThisInitialized$4(self);
}
function _assertThisInitialized$4(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _wrapNativeSuper$3(Class) {
	var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
	_wrapNativeSuper$3 = function _wrapNativeSuper(Class) {
		if (Class === null || !_isNativeFunction$3(Class)) return Class;
		if (typeof Class !== "function") throw new TypeError("Super expression must either be null or a function");
		if (typeof _cache !== "undefined") {
			if (_cache.has(Class)) return _cache.get(Class);
			_cache.set(Class, Wrapper);
		}
		function Wrapper() {
			return _construct$3(Class, arguments, _getPrototypeOf$4(this).constructor);
		}
		Wrapper.prototype = Object.create(Class.prototype, { constructor: {
			value: Wrapper,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		return _setPrototypeOf$4(Wrapper, Class);
	};
	return _wrapNativeSuper$3(Class);
}
function _construct$3(Parent, args, Class) {
	if (_isNativeReflectConstruct$4()) _construct$3 = Reflect.construct.bind();
	else _construct$3 = function _construct(Parent, args, Class) {
		var a = [null];
		a.push.apply(a, args);
		var instance = new (Function.bind.apply(Parent, a))();
		if (Class) _setPrototypeOf$4(instance, Class.prototype);
		return instance;
	};
	return _construct$3.apply(null, arguments);
}
function _isNativeReflectConstruct$4() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _isNativeFunction$3(fn) {
	return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf$4(o, p) {
	_setPrototypeOf$4 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf$4(o, p);
}
function _getPrototypeOf$4(o) {
	_getPrototypeOf$4 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf$4(o);
}
var InvalidSpreadsheetError = /*#__PURE__*/ function(_Error) {
	_inherits$4(InvalidSpreadsheetError, _Error);
	var _super = _createSuper$4(InvalidSpreadsheetError);
	function InvalidSpreadsheetError(message) {
		var _this;
		_classCallCheck$4(this, InvalidSpreadsheetError);
		_this = _super.call(this, message);
		_this.name = "InvalidSpreadsheetError";
		return _this;
	}
	return _createClass$4(InvalidSpreadsheetError);
}(/*#__PURE__*/ _wrapNativeSuper$3(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXml.js
/**
* Parses XML markup by calling the supplied callback functions.
* @param {string} xml
* @param {any} state — The initial `state`. This `state` will supposedly be modified by the callback functions as the XML is being parsed.
* @param {function} [onOpenTag]
* @param {function} [onCloseTag]
* @param {function} [onText]
* @param {function} [onProgress] — If defined, will be called every time it finishes parsing yet another chunk of XML.
* @returns {Promise<void>} Returns a `Promise` that resolves to nothing. Inspect the passed `state` argument for changes.
*/
function parseXml(xml, state, onOpenTag, onCloseTag, onText, onProgress) {
	var parser = parseXmlStream(state, onOpenTag, onCloseTag, onText);
	if (onProgress) parseXmlInChunks(parser, xml, onProgress);
	else {
		parser.write(xml);
		parser.end();
	}
	return parser.promise.then(function(result) {
		return result;
	}, function(error) {
		var spreadsheetError = new InvalidSpreadsheetError(error.message);
		spreadsheetError.stack = error.stack;
		spreadsheetError.cause = error;
		throw spreadsheetError;
	});
	/**
	* Parses XML in chunks.
	* @param {object} parser — An object returned from `parseXmlStream()` function.
	* @param {string} xml
	* @param {function} [onProgress] — Will be called after yet another chunk of XML has been parsed.
	* @param {boolean} [nonBlocking] — If `true` is passed then it won't block the current thread while parsing. Otherwise, it will block the current thread until all the XML is parsed.
	*/
	function parseXmlInChunks(parser, xml, onProgress, nonBlocking) {
		var MAX_CHUNK_PROCESSING_TIME = 7;
		var INITIAL_CHUNK_SIZE = 65536;
		var chunksCount = 0;
		var chunkSize = INITIAL_CHUNK_SIZE;
		/**
		* Parses next chunk of XML.
		* @returns {boolean} Returns `true` if there're more chunks to write.
		*/
		var parseNextChunk = function parseNextChunk() {
			chunksCount++;
			var startedAt = Date.now();
			if (xml.length > chunkSize) {
				parser.write(xml.slice(0, chunkSize));
				if (onProgress) onProgress(false);
				xml = xml.slice(chunkSize);
				var chunkProcessingTime = Date.now() - startedAt;
				if (chunkProcessingTime < MAX_CHUNK_PROCESSING_TIME * .5) chunkSize *= 2;
				else if (chunkProcessingTime > MAX_CHUNK_PROCESSING_TIME) chunkSize /= 2;
				return true;
			} else {
				parser.write(xml);
				parser.end();
				if (onProgress) onProgress(true);
				return false;
			}
		};
		(function loop() {
			if (parseNextChunk()) {
				if (nonBlocking) {
					if (typeof setImmediate !== "undefined") setImmediate(loop);
					else setTimeout(loop, 0);
				} else loop();
			}
		})();
	}
}
//#endregion
//#region node_modules/unzipper-esm/lib/ZipFileError.js
var ZipFileError = class extends Error {
	constructor(code, message) {
		super(message || code);
		this.code = code;
	}
};
function createZipFileError(error) {
	const zipFileError = new ZipFileError(error.code, error.message);
	if (error.stack) zipFileError.stack = error.stack;
	Error.captureStackTrace(zipFileError, createZipFileError);
	zipFileError.cause = error;
	return zipFileError;
}
//#endregion
//#region node_modules/unzipper-esm/lib/PullStream.js
var FUNCTION_STRING = "function";
var PullStreamConstructor = function() {
	this.buffer = Buffer.from("");
	const self = this;
	self.on("finish", function() {
		self.finished = true;
		self.emit("chunk", false);
	});
};
var _write = function(chunk, e, cb) {
	this.buffer = Buffer.concat([this.buffer, chunk]);
	this.cb = cb;
	this.emit("chunk");
};
var stream = function(eof, includeEof) {
	const p = new PassThrough();
	let done;
	const self = this;
	function cb() {
		if (typeof self.cb === FUNCTION_STRING) {
			const callback = self.cb;
			self.cb = void 0;
			return callback();
		}
	}
	function pull() {
		let packet;
		if (self.buffer && self.buffer.length) {
			if (typeof eof === "number") {
				packet = self.buffer.slice(0, eof);
				self.buffer = self.buffer.slice(eof);
				eof -= packet.length;
				done = done || !eof;
			} else {
				let match = self.buffer.indexOf(eof);
				if (match !== -1) {
					self.match = match;
					if (includeEof) match = match + eof.length;
					packet = self.buffer.slice(0, match);
					self.buffer = self.buffer.slice(match);
					done = true;
				} else {
					const len = self.buffer.length - eof.length;
					if (len <= 0) cb();
					else {
						packet = self.buffer.slice(0, len);
						self.buffer = self.buffer.slice(len);
					}
				}
			}
			if (packet) p.write(packet, function() {
				if (self.buffer.length === 0 || eof.length && self.buffer.length <= eof.length) cb();
			});
		}
		if (!done) {
			if (self.finished) {
				self.removeListener("chunk", pull);
				self.emit("error", new ZipFileError("FILE_ENDED"));
				return;
			}
		} else {
			self.removeListener("chunk", pull);
			p.end();
		}
	}
	self.on("chunk", pull);
	pull();
	return p;
};
var pull = function(eof, includeEof) {
	if (eof === 0) return Promise.resolve("");
	if (!isNaN(eof) && this.buffer.length > eof) {
		const data = this.buffer.slice(0, eof);
		this.buffer = this.buffer.slice(eof);
		return Promise.resolve(data);
	}
	let buffer = Buffer.from("");
	const self = this;
	const concatStream = new Transform({ transform });
	function transform(d, e, cb) {
		buffer = Buffer.concat([buffer, d]);
		cb();
	}
	let rejectHandler;
	let pullStreamRejectHandler;
	return new Promise(function(resolve, reject) {
		rejectHandler = reject;
		pullStreamRejectHandler = function(e) {
			self.__emittedError = e;
			reject(e);
		};
		if (self.finished) return reject(new ZipFileError("FILE_ENDED"));
		self.once("error", pullStreamRejectHandler);
		self.stream(eof, includeEof).on("error", reject).pipe(concatStream).on("finish", function() {
			resolve(buffer);
		}).on("error", reject);
	}).finally(function() {
		self.removeListener("error", rejectHandler);
		self.removeListener("error", pullStreamRejectHandler);
	});
};
var PullStream = class extends Duplex {
	constructor() {
		super({
			decodeStrings: false,
			objectMode: true
		});
		PullStreamConstructor.call(this);
	}
	_write(chunk, e, cb) {
		return _write.call(this, chunk, e, cb);
	}
	stream(eof, includeEof) {
		return stream.call(this, eof, includeEof);
	}
	pull(eof, includeEof) {
		return pull.call(this, eof, includeEof);
	}
	_read() {}
};
//#endregion
//#region node_modules/unzipper-esm/lib/NoopStream.js
var NoopStream = class extends Transform {
	_transform(d, e, cb) {
		cb();
	}
};
//#endregion
//#region node_modules/unzipper-esm/lib/BufferStream.js
/**
* Reads an entry as a `Buffer`.
* @param {*} entry
* @returns {Promise<Buffer>}
*/
function readAsBuffer(entry) {
	return new Promise(function(resolve, reject) {
		const chunks = [];
		const bufferStream = new Transform({ transform }).on("finish", function() {
			resolve(Buffer.concat(chunks));
		}).on("error", reject);
		function transform(d, e, cb) {
			chunks.push(d);
			cb();
		}
		entry.on("error", reject).pipe(bufferStream);
	});
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseBuffer.js
function parseUIntLE(buffer, offset, size) {
	let result;
	switch (size) {
		case 1:
			result = buffer.readUInt8(offset);
			break;
		case 2:
			result = buffer.readUInt16LE(offset);
			break;
		case 4:
			result = buffer.readUInt32LE(offset);
			break;
		case 8:
			result = Number(buffer.readBigUInt64LE(offset));
			break;
		default: throw new Error("Unsupported UInt LE size!");
	}
	return result;
}
/**
* Parses sequential unsigned little endian numbers from the head of the passed buffer according to
* the specified format passed.  If the buffer is not large enough to satisfy the full format,
* null values will be assigned to the remaining keys.
* @param {*} buffer The buffer to sequentially extract numbers from.
* @param {*} format Expected format to follow when extrcting values from the buffer.  A list of list entries
* with the following structure:
* [
*   [
*     <key>,  // Name of the key to assign the extracted number to.
*     <size>  // The size in bytes of the number to extract. possible values are 1, 2, 4, 8.
*   ],
*   ...
* ]
* @returns An object with keys set to their associated extracted values.
*/
function parse(buffer, format) {
	const result = {};
	let offset = 0;
	for (const [key, size] of format) {
		if (buffer.length >= offset + size) result[key] = parseUIntLE(buffer, offset, size);
		else result[key] = null;
		offset += size;
	}
	return result;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseExtraField.js
function parseExtraField(extraField, vars) {
	let extra;
	while (!extra && extraField && extraField.length) {
		const candidateExtra = parse(extraField, [["signature", 2], ["partSize", 2]]);
		if (candidateExtra.signature === 1) {
			const fieldsToExpect = [];
			if (vars.uncompressedSize === 4294967295) fieldsToExpect.push(["uncompressedSize", 8]);
			if (vars.compressedSize === 4294967295) fieldsToExpect.push(["compressedSize", 8]);
			if (vars.offsetToLocalFileHeader === 4294967295) fieldsToExpect.push(["offsetToLocalFileHeader", 8]);
			extra = parse(extraField.slice(4), fieldsToExpect);
		} else extraField = extraField.slice(candidateExtra.partSize + 4);
	}
	extra = extra || {};
	if (vars.compressedSize === 4294967295) vars.compressedSize = extra.compressedSize;
	if (vars.uncompressedSize === 4294967295) vars.uncompressedSize = extra.uncompressedSize;
	if (vars.offsetToLocalFileHeader === 4294967295) vars.offsetToLocalFileHeader = extra.offsetToLocalFileHeader;
	return extra;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseDateTime.js
function parseDateTime(date, time) {
	const day = date & 31;
	const month = date >> 5 & 15;
	const year = (date >> 9 & 127) + 1980;
	const seconds = time ? (time & 31) * 2 : 0;
	const minutes = time ? time >> 5 & 63 : 0;
	const hours = time ? time >> 11 : 0;
	return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}
//#endregion
//#region node_modules/unzipper-esm/lib/parse.js
var endDirectorySignature = Buffer.alloc(4);
endDirectorySignature.writeUInt32LE(101010256, 0);
function Parse(opts) {
	return new Parser(opts);
}
var ParserConstructor = function(opts) {
	this._opts = opts;
	const self = this;
	self.on("finish", function() {
		self.emit("end");
		self.emit("close");
	});
	self._readRecord().catch(function(e) {
		if (!self.__emittedError || self.__emittedError !== e) self.emit("error", e);
	});
};
var _readRecord = function() {
	const self = this;
	return self.pull(4).then(function(data) {
		if (data.length === 0) return;
		const signature = data.readUInt32LE(0);
		if (signature === 875721283) return self._readCrxHeader();
		if (signature === 67324752) return self._readFile();
		else if (signature === 33639248) {
			self.reachedCD = true;
			return self._readCentralDirectoryFileHeader();
		} else if (signature === 101010256) return self._readEndOfCentralDirectoryRecord();
		else if (self.reachedCD) return self.pull(endDirectorySignature, true).then(function() {
			return self._readEndOfCentralDirectoryRecord();
		});
		else self.emit("error", new ZipFileError("INVALID_SIGNATURE", "invalid signature: 0x" + signature.toString(16)));
	}).then((function(loop) {
		if (loop) return self._readRecord();
	}));
};
var _readCrxHeader = function() {
	const self = this;
	return self.pull(12).then(function(data) {
		self.crxHeader = parse(data, [
			["version", 4],
			["pubKeyLength", 4],
			["signatureLength", 4]
		]);
		return self.pull(self.crxHeader.pubKeyLength + self.crxHeader.signatureLength);
	}).then(function(data) {
		self.crxHeader.publicKey = data.slice(0, self.crxHeader.pubKeyLength);
		self.crxHeader.signature = data.slice(self.crxHeader.pubKeyLength);
		self.emit("crx-header", self.crxHeader);
		return true;
	});
};
var _readFile = function() {
	const self = this;
	return self.pull(26).then(function(data) {
		const vars = parse(data, [
			["versionsNeededToExtract", 2],
			["flags", 2],
			["compressionMethod", 2],
			["lastModifiedTime", 2],
			["lastModifiedDate", 2],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4],
			["fileNameLength", 2],
			["extraFieldLength", 2]
		]);
		vars.lastModifiedDateTime = parseDateTime(vars.lastModifiedDate, vars.lastModifiedTime);
		if (self.crxHeader) vars.crxHeader = self.crxHeader;
		return self.pull(vars.fileNameLength).then(function(fileNameBuffer) {
			const fileName = fileNameBuffer.toString("utf8");
			const entry = new PassThrough();
			let __autodraining = false;
			entry.autodrain = function() {
				__autodraining = true;
				const draining = entry.pipe(new NoopStream());
				draining.promise = function() {
					return new Promise(function(resolve, reject) {
						draining.on("finish", resolve);
						draining.on("error", reject);
					});
				};
				return draining;
			};
			entry.buffer = function() {
				return readAsBuffer(entry);
			};
			entry.path = fileName;
			entry.props = {};
			entry.props.path = fileName;
			entry.props.pathBuffer = fileNameBuffer;
			entry.props.flags = { "isUnicode": (vars.flags & 2048) != 0 };
			entry.type = vars.uncompressedSize === 0 && /[/\\]$/.test(fileName) ? "Directory" : "File";
			if (self._opts.verbose) {
				if (entry.type === "Directory") console.log("   creating:", fileName);
				else if (entry.type === "File") {
					if (vars.compressionMethod === 0) console.log(" extracting:", fileName);
					else console.log("  inflating:", fileName);
				}
			}
			return self.pull(vars.extraFieldLength).then(function(extraField) {
				const extra = parseExtraField(extraField, vars);
				entry.vars = vars;
				entry.extra = extra;
				if (self._opts.forceStream) self.push(entry);
				else {
					self.emit("entry", entry);
					if (self._readableState.pipesCount || self._readableState.pipes && self._readableState.pipes.length) self.push(entry);
				}
				if (self._opts.verbose) console.log({
					filename: fileName,
					vars,
					extra
				});
				const fileSizeKnown = !(vars.flags & 8) || vars.compressedSize > 0;
				let eof;
				entry.__autodraining = __autodraining;
				const inflater = vars.compressionMethod && !__autodraining ? zlib.createInflateRaw() : PassThrough();
				if (fileSizeKnown) {
					entry.size = vars.uncompressedSize;
					eof = vars.compressedSize;
				} else {
					eof = Buffer.alloc(4);
					eof.writeUInt32LE(134695760, 0);
				}
				return new Promise(function(resolve, reject) {
					pipeline(self.stream(eof), inflater, entry, function(err) {
						if (err) {
							if (err.code === "Z_DATA_ERROR") err = createZipFileError(err);
							return reject(err);
						}
						return fileSizeKnown ? resolve(fileSizeKnown) : self._processDataDescriptor(entry).then(resolve).catch(reject);
					});
				});
			});
		});
	});
};
var _processDataDescriptor = function(entry) {
	return this.pull(16).then(function(data) {
		entry.size = parse(data, [
			["dataDescriptorSignature", 4],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4]
		]).uncompressedSize;
		return true;
	});
};
var _readCentralDirectoryFileHeader = function() {
	const self = this;
	return self.pull(42).then(function(data) {
		const vars = parse(data, [
			["versionMadeBy", 2],
			["versionsNeededToExtract", 2],
			["flags", 2],
			["compressionMethod", 2],
			["lastModifiedTime", 2],
			["lastModifiedDate", 2],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4],
			["fileNameLength", 2],
			["extraFieldLength", 2],
			["fileCommentLength", 2],
			["diskNumber", 2],
			["internalFileAttributes", 2],
			["externalFileAttributes", 4],
			["offsetToLocalFileHeader", 4]
		]);
		return self.pull(vars.fileNameLength).then(function(fileName) {
			vars.fileName = fileName.toString("utf8");
			return self.pull(vars.extraFieldLength);
		}).then(function() {
			return self.pull(vars.fileCommentLength);
		}).then(function() {
			return true;
		});
	});
};
var _readEndOfCentralDirectoryRecord = function() {
	const self = this;
	return self.pull(18).then(function(data) {
		const vars = parse(data, [
			["diskNumber", 2],
			["diskStart", 2],
			["numberOfRecordsOnDisk", 2],
			["numberOfRecords", 2],
			["sizeOfCentralDirectory", 4],
			["offsetToStartOfCentralDirectory", 4],
			["commentLength", 2]
		]);
		return self.pull(vars.commentLength).then(function() {
			self.end();
			self.push(null);
		});
	});
};
var promise = function() {
	const self = this;
	return new Promise(function(resolve, reject) {
		self.on("finish", resolve);
		self.on("error", reject);
	});
};
var Parser = class extends PullStream {
	constructor(opts = { verbose: false }) {
		super(opts);
		ParserConstructor.call(this, opts);
	}
	_readRecord() {
		return _readRecord.call(this);
	}
	_readCrxHeader() {
		return _readCrxHeader.call(this);
	}
	_readFile() {
		return _readFile.call(this);
	}
	_processDataDescriptor(entry) {
		return _processDataDescriptor.call(this, entry);
	}
	_readCentralDirectoryFileHeader() {
		return _readCentralDirectoryFileHeader.call(this);
	}
	_readEndOfCentralDirectoryRecord() {
		return _readEndOfCentralDirectoryRecord.call(this);
	}
	promise() {
		return promise.call(this);
	}
};
//#endregion
//#region node_modules/graceful-fs/polyfills.js
var require_polyfills = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var constants = __require("constants");
	var origCwd = process.cwd;
	var cwd = null;
	var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
	process.cwd = function() {
		if (!cwd) cwd = origCwd.call(process);
		return cwd;
	};
	try {
		process.cwd();
	} catch (er) {}
	if (typeof process.chdir === "function") {
		var chdir = process.chdir;
		process.chdir = function(d) {
			cwd = null;
			chdir.call(process, d);
		};
		if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
	}
	module.exports = patch;
	function patch(fs) {
		if (constants.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) patchLchmod(fs);
		if (!fs.lutimes) patchLutimes(fs);
		fs.chown = chownFix(fs.chown);
		fs.fchown = chownFix(fs.fchown);
		fs.lchown = chownFix(fs.lchown);
		fs.chmod = chmodFix(fs.chmod);
		fs.fchmod = chmodFix(fs.fchmod);
		fs.lchmod = chmodFix(fs.lchmod);
		fs.chownSync = chownFixSync(fs.chownSync);
		fs.fchownSync = chownFixSync(fs.fchownSync);
		fs.lchownSync = chownFixSync(fs.lchownSync);
		fs.chmodSync = chmodFixSync(fs.chmodSync);
		fs.fchmodSync = chmodFixSync(fs.fchmodSync);
		fs.lchmodSync = chmodFixSync(fs.lchmodSync);
		fs.stat = statFix(fs.stat);
		fs.fstat = statFix(fs.fstat);
		fs.lstat = statFix(fs.lstat);
		fs.statSync = statFixSync(fs.statSync);
		fs.fstatSync = statFixSync(fs.fstatSync);
		fs.lstatSync = statFixSync(fs.lstatSync);
		if (fs.chmod && !fs.lchmod) {
			fs.lchmod = function(path, mode, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchmodSync = function() {};
		}
		if (fs.chown && !fs.lchown) {
			fs.lchown = function(path, uid, gid, cb) {
				if (cb) process.nextTick(cb);
			};
			fs.lchownSync = function() {};
		}
		if (platform === "win32") fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
			function rename(from, to, cb) {
				var start = Date.now();
				var backoff = 0;
				fs$rename(from, to, function CB(er) {
					if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
						setTimeout(function() {
							fs.stat(to, function(stater, st) {
								if (stater && stater.code === "ENOENT") fs$rename(from, to, CB);
								else cb(er);
							});
						}, backoff);
						if (backoff < 100) backoff += 10;
						return;
					}
					if (cb) cb(er);
				});
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(rename, fs$rename);
			return rename;
		})(fs.rename);
		fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
			function read(fd, buffer, offset, length, position, callback_) {
				var callback;
				if (callback_ && typeof callback_ === "function") {
					var eagCounter = 0;
					callback = function(er, _, __) {
						if (er && er.code === "EAGAIN" && eagCounter < 10) {
							eagCounter++;
							return fs$read.call(fs, fd, buffer, offset, length, position, callback);
						}
						callback_.apply(this, arguments);
					};
				}
				return fs$read.call(fs, fd, buffer, offset, length, position, callback);
			}
			if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
			return read;
		})(fs.read);
		fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : (function(fs$readSync) {
			return function(fd, buffer, offset, length, position) {
				var eagCounter = 0;
				while (true) try {
					return fs$readSync.call(fs, fd, buffer, offset, length, position);
				} catch (er) {
					if (er.code === "EAGAIN" && eagCounter < 10) {
						eagCounter++;
						continue;
					}
					throw er;
				}
			};
		})(fs.readSync);
		function patchLchmod(fs) {
			fs.lchmod = function(path, mode, callback) {
				fs.open(path, constants.O_WRONLY | constants.O_SYMLINK, mode, function(err, fd) {
					if (err) {
						if (callback) callback(err);
						return;
					}
					fs.fchmod(fd, mode, function(err) {
						fs.close(fd, function(err2) {
							if (callback) callback(err || err2);
						});
					});
				});
			};
			fs.lchmodSync = function(path, mode) {
				var fd = fs.openSync(path, constants.O_WRONLY | constants.O_SYMLINK, mode);
				var threw = true;
				var ret;
				try {
					ret = fs.fchmodSync(fd, mode);
					threw = false;
				} finally {
					if (threw) try {
						fs.closeSync(fd);
					} catch (er) {}
					else fs.closeSync(fd);
				}
				return ret;
			};
		}
		function patchLutimes(fs) {
			if (constants.hasOwnProperty("O_SYMLINK") && fs.futimes) {
				fs.lutimes = function(path, at, mt, cb) {
					fs.open(path, constants.O_SYMLINK, function(er, fd) {
						if (er) {
							if (cb) cb(er);
							return;
						}
						fs.futimes(fd, at, mt, function(er) {
							fs.close(fd, function(er2) {
								if (cb) cb(er || er2);
							});
						});
					});
				};
				fs.lutimesSync = function(path, at, mt) {
					var fd = fs.openSync(path, constants.O_SYMLINK);
					var ret;
					var threw = true;
					try {
						ret = fs.futimesSync(fd, at, mt);
						threw = false;
					} finally {
						if (threw) try {
							fs.closeSync(fd);
						} catch (er) {}
						else fs.closeSync(fd);
					}
					return ret;
				};
			} else if (fs.futimes) {
				fs.lutimes = function(_a, _b, _c, cb) {
					if (cb) process.nextTick(cb);
				};
				fs.lutimesSync = function() {};
			}
		}
		function chmodFix(orig) {
			if (!orig) return orig;
			return function(target, mode, cb) {
				return orig.call(fs, target, mode, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chmodFixSync(orig) {
			if (!orig) return orig;
			return function(target, mode) {
				try {
					return orig.call(fs, target, mode);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function chownFix(orig) {
			if (!orig) return orig;
			return function(target, uid, gid, cb) {
				return orig.call(fs, target, uid, gid, function(er) {
					if (chownErOk(er)) er = null;
					if (cb) cb.apply(this, arguments);
				});
			};
		}
		function chownFixSync(orig) {
			if (!orig) return orig;
			return function(target, uid, gid) {
				try {
					return orig.call(fs, target, uid, gid);
				} catch (er) {
					if (!chownErOk(er)) throw er;
				}
			};
		}
		function statFix(orig) {
			if (!orig) return orig;
			return function(target, options, cb) {
				if (typeof options === "function") {
					cb = options;
					options = null;
				}
				function callback(er, stats) {
					if (stats) {
						if (stats.uid < 0) stats.uid += 4294967296;
						if (stats.gid < 0) stats.gid += 4294967296;
					}
					if (cb) cb.apply(this, arguments);
				}
				return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
			};
		}
		function statFixSync(orig) {
			if (!orig) return orig;
			return function(target, options) {
				var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
				if (stats) {
					if (stats.uid < 0) stats.uid += 4294967296;
					if (stats.gid < 0) stats.gid += 4294967296;
				}
				return stats;
			};
		}
		function chownErOk(er) {
			if (!er) return true;
			if (er.code === "ENOSYS") return true;
			if (!process.getuid || process.getuid() !== 0) {
				if (er.code === "EINVAL" || er.code === "EPERM") return true;
			}
			return false;
		}
	}
}));
//#endregion
//#region node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Stream$1 = __require("stream").Stream;
	module.exports = legacy;
	function legacy(fs) {
		return {
			ReadStream,
			WriteStream
		};
		function ReadStream(path, options) {
			if (!(this instanceof ReadStream)) return new ReadStream(path, options);
			Stream$1.call(this);
			var self = this;
			this.path = path;
			this.fd = null;
			this.readable = true;
			this.paused = false;
			this.flags = "r";
			this.mode = 438;
			this.bufferSize = 65536;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.encoding) this.setEncoding(this.encoding);
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.end === void 0) this.end = Infinity;
				else if ("number" !== typeof this.end) throw TypeError("end must be a Number");
				if (this.start > this.end) throw new Error("start must be <= end");
				this.pos = this.start;
			}
			if (this.fd !== null) {
				process.nextTick(function() {
					self._read();
				});
				return;
			}
			fs.open(this.path, this.flags, this.mode, function(err, fd) {
				if (err) {
					self.emit("error", err);
					self.readable = false;
					return;
				}
				self.fd = fd;
				self.emit("open", fd);
				self._read();
			});
		}
		function WriteStream(path, options) {
			if (!(this instanceof WriteStream)) return new WriteStream(path, options);
			Stream$1.call(this);
			this.path = path;
			this.fd = null;
			this.writable = true;
			this.flags = "w";
			this.encoding = "binary";
			this.mode = 438;
			this.bytesWritten = 0;
			options = options || {};
			var keys = Object.keys(options);
			for (var index = 0, length = keys.length; index < length; index++) {
				var key = keys[index];
				this[key] = options[key];
			}
			if (this.start !== void 0) {
				if ("number" !== typeof this.start) throw TypeError("start must be a Number");
				if (this.start < 0) throw new Error("start must be >= zero");
				this.pos = this.start;
			}
			this.busy = false;
			this._queue = [];
			if (this.fd === null) {
				this._open = fs.open;
				this._queue.push([
					this._open,
					this.path,
					this.flags,
					this.mode,
					void 0
				]);
				this.flush();
			}
		}
	}
}));
//#endregion
//#region node_modules/graceful-fs/clone.js
var require_clone = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = clone;
	var getPrototypeOf = Object.getPrototypeOf || function(obj) {
		return obj.__proto__;
	};
	function clone(obj) {
		if (obj === null || typeof obj !== "object") return obj;
		if (obj instanceof Object) var copy = { __proto__: getPrototypeOf(obj) };
		else var copy = Object.create(null);
		Object.getOwnPropertyNames(obj).forEach(function(key) {
			Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
		});
		return copy;
	}
}));
//#endregion
//#region node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fs$2 = __require("fs");
	var polyfills = require_polyfills();
	var legacy = require_legacy_streams();
	var clone = require_clone();
	var util = __require("util");
	/* istanbul ignore next - node 0.x polyfill */
	var gracefulQueue;
	var previousSymbol;
	/* istanbul ignore else - node 0.x polyfill */
	if (typeof Symbol === "function" && typeof Symbol.for === "function") {
		gracefulQueue = Symbol.for("graceful-fs.queue");
		previousSymbol = Symbol.for("graceful-fs.previous");
	} else {
		gracefulQueue = "___graceful-fs.queue";
		previousSymbol = "___graceful-fs.previous";
	}
	function noop() {}
	function publishQueue(context, queue) {
		Object.defineProperty(context, gracefulQueue, { get: function() {
			return queue;
		} });
	}
	var debug = noop;
	if (util.debuglog) debug = util.debuglog("gfs4");
	else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) debug = function() {
		var m = util.format.apply(util, arguments);
		m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
		console.error(m);
	};
	if (!fs$2[gracefulQueue]) {
		publishQueue(fs$2, global[gracefulQueue] || []);
		fs$2.close = (function(fs$close) {
			function close(fd, cb) {
				return fs$close.call(fs$2, fd, function(err) {
					if (!err) resetQueue();
					if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
			Object.defineProperty(close, previousSymbol, { value: fs$close });
			return close;
		})(fs$2.close);
		fs$2.closeSync = (function(fs$closeSync) {
			function closeSync(fd) {
				fs$closeSync.apply(fs$2, arguments);
				resetQueue();
			}
			Object.defineProperty(closeSync, previousSymbol, { value: fs$closeSync });
			return closeSync;
		})(fs$2.closeSync);
		if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) process.on("exit", function() {
			debug(fs$2[gracefulQueue]);
			__require("assert").equal(fs$2[gracefulQueue].length, 0);
		});
	}
	if (!global[gracefulQueue]) publishQueue(global, fs$2[gracefulQueue]);
	module.exports = patch(clone(fs$2));
	if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs$2.__patched) {
		module.exports = patch(fs$2);
		fs$2.__patched = true;
	}
	function patch(fs) {
		polyfills(fs);
		fs.gracefulify = patch;
		fs.createReadStream = createReadStream;
		fs.createWriteStream = createWriteStream;
		var fs$readFile = fs.readFile;
		fs.readFile = readFile;
		function readFile(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$readFile(path, options, cb);
			function go$readFile(path, options, cb, startTime) {
				return fs$readFile(path, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readFile,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$writeFile = fs.writeFile;
		fs.writeFile = writeFile;
		function writeFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$writeFile(path, data, options, cb);
			function go$writeFile(path, data, options, cb, startTime) {
				return fs$writeFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$writeFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$appendFile = fs.appendFile;
		if (fs$appendFile) fs.appendFile = appendFile;
		function appendFile(path, data, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			return go$appendFile(path, data, options, cb);
			function go$appendFile(path, data, options, cb, startTime) {
				return fs$appendFile(path, data, options, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$appendFile,
						[
							path,
							data,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$copyFile = fs.copyFile;
		if (fs$copyFile) fs.copyFile = copyFile;
		function copyFile(src, dest, flags, cb) {
			if (typeof flags === "function") {
				cb = flags;
				flags = 0;
			}
			return go$copyFile(src, dest, flags, cb);
			function go$copyFile(src, dest, flags, cb, startTime) {
				return fs$copyFile(src, dest, flags, function(err) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$copyFile,
						[
							src,
							dest,
							flags,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		var fs$readdir = fs.readdir;
		fs.readdir = readdir;
		var noReaddirOptionVersions = /^v[0-5]\./;
		function readdir(path, options, cb) {
			if (typeof options === "function") cb = options, options = null;
			var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, fs$readdirCallback(path, options, cb, startTime));
			} : function go$readdir(path, options, cb, startTime) {
				return fs$readdir(path, options, fs$readdirCallback(path, options, cb, startTime));
			};
			return go$readdir(path, options, cb);
			function fs$readdirCallback(path, options, cb, startTime) {
				return function(err, files) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$readdir,
						[
							path,
							options,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else {
						if (files && files.sort) files.sort();
						if (typeof cb === "function") cb.call(this, err, files);
					}
				};
			}
		}
		if (process.version.substr(0, 4) === "v0.8") {
			var legStreams = legacy(fs);
			ReadStream = legStreams.ReadStream;
			WriteStream = legStreams.WriteStream;
		}
		var fs$ReadStream = fs.ReadStream;
		if (fs$ReadStream) {
			ReadStream.prototype = Object.create(fs$ReadStream.prototype);
			ReadStream.prototype.open = ReadStream$open;
		}
		var fs$WriteStream = fs.WriteStream;
		if (fs$WriteStream) {
			WriteStream.prototype = Object.create(fs$WriteStream.prototype);
			WriteStream.prototype.open = WriteStream$open;
		}
		Object.defineProperty(fs, "ReadStream", {
			get: function() {
				return ReadStream;
			},
			set: function(val) {
				ReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		Object.defineProperty(fs, "WriteStream", {
			get: function() {
				return WriteStream;
			},
			set: function(val) {
				WriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileReadStream = ReadStream;
		Object.defineProperty(fs, "FileReadStream", {
			get: function() {
				return FileReadStream;
			},
			set: function(val) {
				FileReadStream = val;
			},
			enumerable: true,
			configurable: true
		});
		var FileWriteStream = WriteStream;
		Object.defineProperty(fs, "FileWriteStream", {
			get: function() {
				return FileWriteStream;
			},
			set: function(val) {
				FileWriteStream = val;
			},
			enumerable: true,
			configurable: true
		});
		function ReadStream(path, options) {
			if (this instanceof ReadStream) return fs$ReadStream.apply(this, arguments), this;
			else return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
		}
		function ReadStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					if (that.autoClose) that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
					that.read();
				}
			});
		}
		function WriteStream(path, options) {
			if (this instanceof WriteStream) return fs$WriteStream.apply(this, arguments), this;
			else return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
		}
		function WriteStream$open() {
			var that = this;
			open(that.path, that.flags, that.mode, function(err, fd) {
				if (err) {
					that.destroy();
					that.emit("error", err);
				} else {
					that.fd = fd;
					that.emit("open", fd);
				}
			});
		}
		function createReadStream(path, options) {
			return new fs.ReadStream(path, options);
		}
		function createWriteStream(path, options) {
			return new fs.WriteStream(path, options);
		}
		var fs$open = fs.open;
		fs.open = open;
		function open(path, flags, mode, cb) {
			if (typeof mode === "function") cb = mode, mode = null;
			return go$open(path, flags, mode, cb);
			function go$open(path, flags, mode, cb, startTime) {
				return fs$open(path, flags, mode, function(err, fd) {
					if (err && (err.code === "EMFILE" || err.code === "ENFILE")) enqueue([
						go$open,
						[
							path,
							flags,
							mode,
							cb
						],
						err,
						startTime || Date.now(),
						Date.now()
					]);
					else if (typeof cb === "function") cb.apply(this, arguments);
				});
			}
		}
		return fs;
	}
	function enqueue(elem) {
		debug("ENQUEUE", elem[0].name, elem[1]);
		fs$2[gracefulQueue].push(elem);
		retry();
	}
	var retryTimer;
	function resetQueue() {
		var now = Date.now();
		for (var i = 0; i < fs$2[gracefulQueue].length; ++i) if (fs$2[gracefulQueue][i].length > 2) {
			fs$2[gracefulQueue][i][3] = now;
			fs$2[gracefulQueue][i][4] = now;
		}
		retry();
	}
	function retry() {
		clearTimeout(retryTimer);
		retryTimer = void 0;
		if (fs$2[gracefulQueue].length === 0) return;
		var elem = fs$2[gracefulQueue].shift();
		var fn = elem[0];
		var args = elem[1];
		var err = elem[2];
		var startTime = elem[3];
		var lastTime = elem[4];
		if (startTime === void 0) {
			debug("RETRY", fn.name, args);
			fn.apply(null, args);
		} else if (Date.now() - startTime >= 6e4) {
			debug("TIMEOUT", fn.name, args);
			var cb = args.pop();
			if (typeof cb === "function") cb.call(null, err);
		} else {
			var sinceAttempt = Date.now() - lastTime;
			var sinceStart = Math.max(lastTime - startTime, 1);
			if (sinceAttempt >= Math.min(sinceStart * 1.2, 100)) {
				debug("RETRY", fn.name, args);
				fn.apply(null, args.concat([startTime]));
			} else fs$2[gracefulQueue].push(elem);
		}
		if (retryTimer === void 0) retryTimer = setTimeout(retry, 0);
	}
}));
(/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var VAL32 = 4294967296;
	var _HEX = [];
	for (var i = 0; i < 256; i++) _HEX[i] = (i > 15 ? "" : "0") + i.toString(16);
	/**
	* Constructor accepts any of the following argument types:
	*
	* new Int64(buffer[, offset=0]) - Existing Buffer with byte offset
	* new Int64(Uint8Array[, offset=0]) - Existing Uint8Array with a byte offset
	* new Int64(string)             - Hex string (throws if n is outside int64 range)
	* new Int64(number)             - Number (throws if n is outside int64 range)
	* new Int64(hi, lo)             - Raw bits as two 32-bit values
	*/
	var Int64 = module.exports = function(a1, a2) {
		if (a1 instanceof Buffer) {
			this.buffer = a1;
			this.offset = a2 || 0;
		} else if (Object.prototype.toString.call(a1) == "[object Uint8Array]") {
			this.buffer = new Buffer(a1);
			this.offset = a2 || 0;
		} else {
			this.buffer = this.buffer || new Buffer(8);
			this.offset = 0;
			this.setValue.apply(this, arguments);
		}
	};
	Int64.MAX_INT = Math.pow(2, 53);
	Int64.MIN_INT = -Math.pow(2, 53);
	Int64.prototype = {
		constructor: Int64,
		/**
		* Do in-place 2's compliment.  See
		* http://en.wikipedia.org/wiki/Two's_complement
		*/
		_2scomp: function() {
			var b = this.buffer, o = this.offset, carry = 1;
			for (var i = o + 7; i >= o; i--) {
				var v = (b[i] ^ 255) + carry;
				b[i] = v & 255;
				carry = v >> 8;
			}
		},
		/**
		* Set the value. Takes any of the following arguments:
		*
		* setValue(string) - A hexidecimal string
		* setValue(number) - Number (throws if n is outside int64 range)
		* setValue(hi, lo) - Raw bits as two 32-bit values
		*/
		setValue: function(hi, lo) {
			var negate = false;
			if (arguments.length == 1) {
				if (typeof hi == "number") {
					negate = hi < 0;
					hi = Math.abs(hi);
					lo = hi % VAL32;
					hi = hi / VAL32;
					if (hi > VAL32) throw new RangeError(hi + " is outside Int64 range");
					hi = hi | 0;
				} else if (typeof hi == "string") {
					hi = (hi + "").replace(/^0x/, "");
					lo = hi.substr(-8);
					hi = hi.length > 8 ? hi.substr(0, hi.length - 8) : "";
					hi = parseInt(hi, 16);
					lo = parseInt(lo, 16);
				} else throw new Error(hi + " must be a Number or String");
			}
			var b = this.buffer, o = this.offset;
			for (var i = 7; i >= 0; i--) {
				b[o + i] = lo & 255;
				lo = i == 4 ? hi : lo >>> 8;
			}
			if (negate) this._2scomp();
		},
		/**
		* Convert to a native JS number.
		*
		* WARNING: Do not expect this value to be accurate to integer precision for
		* large (positive or negative) numbers!
		*
		* @param allowImprecise If true, no check is performed to verify the
		* returned value is accurate to integer precision.  If false, imprecise
		* numbers (very large positive or negative numbers) will be forced to +/-
		* Infinity.
		*/
		toNumber: function(allowImprecise) {
			var b = this.buffer, o = this.offset;
			var negate = b[o] & 128, x = 0, carry = 1;
			for (var i = 7, m = 1; i >= 0; i--, m *= 256) {
				var v = b[o + i];
				if (negate) {
					v = (v ^ 255) + carry;
					carry = v >> 8;
					v = v & 255;
				}
				x += v * m;
			}
			if (!allowImprecise && x >= Int64.MAX_INT) return negate ? -Infinity : Infinity;
			return negate ? -x : x;
		},
		/**
		* Convert to a JS Number. Returns +/-Infinity for values that can't be
		* represented to integer precision.
		*/
		valueOf: function() {
			return this.toNumber(false);
		},
		/**
		* Return string value
		*
		* @param radix Just like Number#toString()'s radix
		*/
		toString: function(radix) {
			return this.valueOf().toString(radix || 10);
		},
		/**
		* Return a string showing the buffer octets, with MSB on the left.
		*
		* @param sep separator string. default is '' (empty string)
		*/
		toOctetString: function(sep) {
			var out = new Array(8);
			var b = this.buffer, o = this.offset;
			for (var i = 0; i < 8; i++) out[i] = _HEX[b[o + i]];
			return out.join(sep || "");
		},
		/**
		* Returns the int64's 8 bytes in a buffer.
		*
		* @param {bool} [rawBuffer=false]  If no offset and this is true, return the internal buffer.  Should only be used if
		*                                  you're discarding the Int64 afterwards, as it breaks encapsulation.
		*/
		toBuffer: function(rawBuffer) {
			if (rawBuffer && this.offset === 0) return this.buffer;
			var out = new Buffer(8);
			this.buffer.copy(out, 0, this.offset, this.offset + 8);
			return out;
		},
		/**
		* Copy 8 bytes of int64 into target buffer at target offset.
		*
		* @param {Buffer} targetBuffer       Buffer to copy into.
		* @param {number} [targetOffset=0]   Offset into target buffer.
		*/
		copy: function(targetBuffer, targetOffset) {
			this.buffer.copy(targetBuffer, targetOffset || 0, this.offset, this.offset + 8);
		},
		/**
		* Returns a number indicating whether this comes before or after or is the
		* same as the other in sort order.
		*
		* @param {Int64} other  Other Int64 to compare.
		*/
		compare: function(other) {
			if ((this.buffer[this.offset] & 128) != (other.buffer[other.offset] & 128)) return other.buffer[other.offset] - this.buffer[this.offset];
			for (var i = 0; i < 8; i++) if (this.buffer[this.offset + i] !== other.buffer[other.offset + i]) return this.buffer[this.offset + i] - other.buffer[other.offset + i];
			return 0;
		},
		/**
		* Returns a boolean indicating if this integer is equal to other.
		*
		* @param {Int64} other  Other Int64 to compare.
		*/
		equals: function(other) {
			return this.compare(other) === 0;
		},
		/**
		* Pretty output in console.log
		*/
		inspect: function() {
			return "[Int64 value:" + this + " octets:" + this.toOctetString(" ") + "]";
		}
	};
})))();
Buffer.alloc(4).writeUInt32LE(101010256, 0);
require_graceful_fs();
//#endregion
//#region node_modules/read-excel-file/modules/zip/UnzipError.js
function _typeof$6(o) {
	"@babel/helpers - typeof";
	return _typeof$6 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$6(o);
}
function _defineProperties$3(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, _toPropertyKey$5(descriptor.key), descriptor);
	}
}
function _createClass$3(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$3(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$3(Constructor, staticProps);
	Object.defineProperty(Constructor, "prototype", { writable: false });
	return Constructor;
}
function _toPropertyKey$5(arg) {
	var key = _toPrimitive$5(arg, "string");
	return _typeof$6(key) === "symbol" ? key : String(key);
}
function _toPrimitive$5(input, hint) {
	if (_typeof$6(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$6(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _classCallCheck$3(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _inherits$3(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	Object.defineProperty(subClass, "prototype", { writable: false });
	if (superClass) _setPrototypeOf$3(subClass, superClass);
}
function _createSuper$3(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct$3();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf$3(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf$3(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn$3(this, result);
	};
}
function _possibleConstructorReturn$3(self, call) {
	if (call && (_typeof$6(call) === "object" || typeof call === "function")) return call;
	else if (call !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
	return _assertThisInitialized$3(self);
}
function _assertThisInitialized$3(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _wrapNativeSuper$2(Class) {
	var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
	_wrapNativeSuper$2 = function _wrapNativeSuper(Class) {
		if (Class === null || !_isNativeFunction$2(Class)) return Class;
		if (typeof Class !== "function") throw new TypeError("Super expression must either be null or a function");
		if (typeof _cache !== "undefined") {
			if (_cache.has(Class)) return _cache.get(Class);
			_cache.set(Class, Wrapper);
		}
		function Wrapper() {
			return _construct$2(Class, arguments, _getPrototypeOf$3(this).constructor);
		}
		Wrapper.prototype = Object.create(Class.prototype, { constructor: {
			value: Wrapper,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		return _setPrototypeOf$3(Wrapper, Class);
	};
	return _wrapNativeSuper$2(Class);
}
function _construct$2(Parent, args, Class) {
	if (_isNativeReflectConstruct$3()) _construct$2 = Reflect.construct.bind();
	else _construct$2 = function _construct(Parent, args, Class) {
		var a = [null];
		a.push.apply(a, args);
		var instance = new (Function.bind.apply(Parent, a))();
		if (Class) _setPrototypeOf$3(instance, Class.prototype);
		return instance;
	};
	return _construct$2.apply(null, arguments);
}
function _isNativeReflectConstruct$3() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _isNativeFunction$2(fn) {
	return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf$3(o, p) {
	_setPrototypeOf$3 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf$3(o, p);
}
function _getPrototypeOf$3(o) {
	_getPrototypeOf$3 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf$3(o);
}
var UnzipError = /*#__PURE__*/ function(_Error) {
	_inherits$3(UnzipError, _Error);
	var _super = _createSuper$3(UnzipError);
	function UnzipError() {
		_classCallCheck$3(this, UnzipError);
		return _super.apply(this, arguments);
	}
	return _createClass$3(UnzipError);
}(/*#__PURE__*/ _wrapNativeSuper$2(Error));
function createUnzipError(error) {
	var unzipError = new UnzipError(error.message);
	if (error.stack) unzipError.stack = error.stack;
	if (Error.captureStackTrace) Error.captureStackTrace(unzipError, createUnzipError);
	unzipError.cause = error;
	return unzipError;
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.unzipper.js
var PROMISE_RESOLVE_VALUE = void 0;
/**
* Reads `*.zip` file contents.
* @param  {Stream} stream
* @param  {function} onFile
* @param  {function} onFileData
* @param  {function} onFileDataEnd
* @return {Promise<void>}
*/
function unzipFromStream_(stream, onFile, onFileData, onFileDataEnd) {
	return new Promise(function(resolve, reject) {
		var promises = [];
		var errored = false;
		var onError = function onError(error) {
			if (error instanceof ZipFileError) error = createUnzipError(error);
			if (!errored) {
				errored = true;
				reject(error);
			}
		};
		stream.on("error", onError).pipe(Parse()).on("error", onError).on("finish", function() {
			if (!errored) Promise.all(promises).then(function() {
				resolve(PROMISE_RESOLVE_VALUE);
			}, onError);
		}).on("entry", function(entry) {
			var ignore = false;
			if (entry.type === "Directory") ignore = true;
			if (errored) ignore = true;
			var uncompressedFileSize = !(entry.vars.flags & 8) || entry.vars.compressedSize > 0 ? entry.vars.uncompressedSize : void 0;
			if (onFile(entry.path, uncompressedFileSize) === false) ignore = true;
			if (ignore) {
				entry.autodrain().on("error", onError);
				return;
			}
			promises.push(new Promise(function(resolve) {
				entry.on("data", function(data) {
					onFileData(entry.path, data);
				}).on("error", function(error) {
					onError(error);
				}).on("finish", function() {
					onFileDataEnd(entry.path);
					resolve();
				});
			}));
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.js
function _createForOfIteratorHelperLoose$3(o, allowArrayLike) {
	var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
	if (it) return (it = it.call(o)).next.bind(it);
	if (Array.isArray(o) || (it = _unsupportedIterableToArray$4(o)) || allowArrayLike && o && typeof o.length === "number") {
		if (it) o = it;
		var i = 0;
		return function() {
			if (i >= o.length) return { done: true };
			return {
				done: false,
				value: o[i++]
			};
		};
	}
	throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray$4(o, minLen) {
	if (!o) return;
	if (typeof o === "string") return _arrayLikeToArray$4(o, minLen);
	var n = Object.prototype.toString.call(o).slice(8, -1);
	if (n === "Object" && o.constructor) n = o.constructor.name;
	if (n === "Map" || n === "Set") return Array.from(o);
	if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$4(o, minLen);
}
function _arrayLikeToArray$4(arr, len) {
	if (len == null || len > arr.length) len = arr.length;
	for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	return arr2;
}
/**
* Reads `*.zip` file contents.
* @param  {Stream} stream
* @return {Promise<Record<string,Buffer>>} Resolves to an object holding `*.zip` file entries. P.S. `Buffer` is a `Uint8Array`.
*/
function unzipFromStream(stream) {
	var filter = (arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}).filter;
	var files = {};
	var filesData = {};
	return unzipFromStream_(stream, function onFile(filePath, fileSize) {
		if (filter && !filter({ path: filePath })) return false;
		filesData[filePath] = {
			size: fileSize,
			chunks: [],
			buffer: fileSize === void 0 ? void 0 : Buffer.alloc(fileSize),
			position: 0
		};
	}, function onFileData(filePath, chunk) {
		if (filesData[filePath].size === void 0) filesData[filePath].chunks.push(chunk);
		else filesData[filePath].position += chunk.copy(filesData[filePath].buffer, filesData[filePath].position);
	}, function onFileDataEnd(filePath) {
		if (filesData[filePath].size === void 0) files[filePath] = concatChunksToNonPooledBuffer(filesData[filePath].chunks);
		else files[filePath] = filesData[filePath].buffer;
		delete filesData[filePath];
	}).then(function() {
		return files;
	});
}
function concatChunksToNonPooledBuffer(chunks) {
	var totalLength = chunks.reduce(function(sum, chunk) {
		return sum + chunk.length;
	}, 0);
	var buffer = Buffer.allocUnsafeSlow(totalLength);
	var offset = 0;
	for (var _iterator = _createForOfIteratorHelperLoose$3(chunks), _step; !(_step = _iterator()).done;) {
		var chunk = _step.value;
		chunk.copy(buffer, offset);
		offset += chunk.length;
	}
	return buffer;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InvalidInputError.js
function _typeof$5(o) {
	"@babel/helpers - typeof";
	return _typeof$5 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$5(o);
}
function _defineProperties$2(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, _toPropertyKey$4(descriptor.key), descriptor);
	}
}
function _createClass$2(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$2(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$2(Constructor, staticProps);
	Object.defineProperty(Constructor, "prototype", { writable: false });
	return Constructor;
}
function _toPropertyKey$4(arg) {
	var key = _toPrimitive$4(arg, "string");
	return _typeof$5(key) === "symbol" ? key : String(key);
}
function _toPrimitive$4(input, hint) {
	if (_typeof$5(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$5(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _classCallCheck$2(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _inherits$2(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	Object.defineProperty(subClass, "prototype", { writable: false });
	if (superClass) _setPrototypeOf$2(subClass, superClass);
}
function _createSuper$2(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct$2();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf$2(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf$2(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn$2(this, result);
	};
}
function _possibleConstructorReturn$2(self, call) {
	if (call && (_typeof$5(call) === "object" || typeof call === "function")) return call;
	else if (call !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
	return _assertThisInitialized$2(self);
}
function _assertThisInitialized$2(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _wrapNativeSuper$1(Class) {
	var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
	_wrapNativeSuper$1 = function _wrapNativeSuper(Class) {
		if (Class === null || !_isNativeFunction$1(Class)) return Class;
		if (typeof Class !== "function") throw new TypeError("Super expression must either be null or a function");
		if (typeof _cache !== "undefined") {
			if (_cache.has(Class)) return _cache.get(Class);
			_cache.set(Class, Wrapper);
		}
		function Wrapper() {
			return _construct$1(Class, arguments, _getPrototypeOf$2(this).constructor);
		}
		Wrapper.prototype = Object.create(Class.prototype, { constructor: {
			value: Wrapper,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		return _setPrototypeOf$2(Wrapper, Class);
	};
	return _wrapNativeSuper$1(Class);
}
function _construct$1(Parent, args, Class) {
	if (_isNativeReflectConstruct$2()) _construct$1 = Reflect.construct.bind();
	else _construct$1 = function _construct(Parent, args, Class) {
		var a = [null];
		a.push.apply(a, args);
		var instance = new (Function.bind.apply(Parent, a))();
		if (Class) _setPrototypeOf$2(instance, Class.prototype);
		return instance;
	};
	return _construct$1.apply(null, arguments);
}
function _isNativeReflectConstruct$2() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _isNativeFunction$1(fn) {
	return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf$2(o, p) {
	_setPrototypeOf$2 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf$2(o, p);
}
function _getPrototypeOf$2(o) {
	_getPrototypeOf$2 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf$2(o);
}
var MESSAGES = {
	XLS_FILE_NOT_SUPPORTED: "You passed a legacy `.xls` file. Only `.xlsx` files are supported",
	FILE_NOT_SUPPORTED: "Doesn't look like an `.xlsx` file",
	INVALID_ZIP: "Couldn't unzip `.xlsx` file contents",
	NO_DATA: "No data"
};
var InvalidInputError = /*#__PURE__*/ function(_Error) {
	_inherits$2(InvalidInputError, _Error);
	var _super = _createSuper$2(InvalidInputError);
	/**
	* Creates an `InvalidInputError` instance.
	* @param {string} code
	* @param {any} [cause]
	*/
	function InvalidInputError(code, cause) {
		var _this;
		_classCallCheck$2(this, InvalidInputError);
		_this = _super.call(this, MESSAGES[code] || code);
		_this.code = code;
		_this.name = "InvalidInputError";
		_this.cause = cause;
		return _this;
	}
	return _createClass$2(InvalidInputError);
}(/*#__PURE__*/ _wrapNativeSuper$1(Error));
//#endregion
//#region node_modules/read-excel-file/modules/export/convertInputToNodeStream.js
/**
* Converts Node.js input argument to a stream.
* @param  {(string|Stream|Buffer|Blob)} input - A Node.js readable stream or a `Buffer` or a `Blob` or a path to a file.
* @returns {Stream}
*/
function convertInputToNodeStream(input) {
	return input instanceof Stream ? input : input instanceof Buffer ? createReadableStreamFromBuffer(input) : input instanceof Blob ? createReadableStreamFromBlob(input) : fs.createReadStream(input);
}
function createReadableStreamFromBuffer(buffer) {
	return Readable.from(buffer);
}
function createReadableStreamFromBlob(blob) {
	return Readable.fromWeb(blob.stream());
}
//#endregion
//#region node_modules/read-excel-file/modules/export/filterZipArchiveEntry.js
function filterZipArchiveEntry(_ref) {
	var path = _ref.path;
	return path.endsWith(".xml") || path.endsWith(".xml.rels");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/createFileTypeDetector.js
var ZIP_FILE_SIGNATURE = [80, 75];
var XLS_FILE_SIGNATURE = [
	208,
	207,
	17,
	224
];
var FILE_TYPE_SIGNATURES = [ZIP_FILE_SIGNATURE, XLS_FILE_SIGNATURE];
FILE_TYPE_SIGNATURES.indexOf(ZIP_FILE_SIGNATURE);
var XLS_FILE_TYPE = FILE_TYPE_SIGNATURES.indexOf(XLS_FILE_SIGNATURE);
/**
* Creates a function get determines a file type based on the leading bytes.
* @return {function} A function that receives a `byte` (an element of a `Uint8Array`) and returns a `type: number?` — an index in the file types "enum", or `-1` if it doesn't match any file type, or `undefined` if it's still deciding on the file type.
* @throws {InvalidInputError}
*/
function createFileTypeDetector() {
	var type;
	var possibleTypes = indexesOf(FILE_TYPE_SIGNATURES);
	var i = 0;
	return function(_byte) {
		if (isNaN(type)) {
			var t;
			possibleTypes = possibleTypes.filter(function(typeIndex) {
				if (_byte === FILE_TYPE_SIGNATURES[typeIndex][i]) {
					if (FILE_TYPE_SIGNATURES[typeIndex].length === i + 1) t = typeIndex;
					return true;
				}
			});
			if (possibleTypes.length === 1) type = t;
			else if (possibleTypes.length === 0) type = -1;
		}
		i++;
		return type;
	};
}
function indexesOf(array) {
	var indexes = [];
	var i = 0;
	while (i < array.length) {
		indexes.push(i);
		i++;
	}
	return indexes;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/validateLeadingBytes.js
function validateByte(_byte2, fileTypeDetector) {
	var fileType = fileTypeDetector(_byte2);
	if (fileType !== void 0) {
		if (fileType === XLS_FILE_TYPE) throw new InvalidInputError("XLS_FILE_NOT_SUPPORTED");
		if (fileType < 0) throw new InvalidInputError("FILE_NOT_SUPPORTED");
		return true;
	}
}
function noFileTypeCouldBeDetermined(byteCount) {
	throw new InvalidInputError(byteCount === 0 ? "NO_DATA" : "FILE_NOT_SUPPORTED");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InputValidationStream.js
function _typeof$4(o) {
	"@babel/helpers - typeof";
	return _typeof$4 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$4(o);
}
function _createForOfIteratorHelperLoose$2(o, allowArrayLike) {
	var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
	if (it) return (it = it.call(o)).next.bind(it);
	if (Array.isArray(o) || (it = _unsupportedIterableToArray$3(o)) || allowArrayLike && o && typeof o.length === "number") {
		if (it) o = it;
		var i = 0;
		return function() {
			if (i >= o.length) return { done: true };
			return {
				done: false,
				value: o[i++]
			};
		};
	}
	throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray$3(o, minLen) {
	if (!o) return;
	if (typeof o === "string") return _arrayLikeToArray$3(o, minLen);
	var n = Object.prototype.toString.call(o).slice(8, -1);
	if (n === "Object" && o.constructor) n = o.constructor.name;
	if (n === "Map" || n === "Set") return Array.from(o);
	if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$3(o, minLen);
}
function _arrayLikeToArray$3(arr, len) {
	if (len == null || len > arr.length) len = arr.length;
	for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	return arr2;
}
function _classCallCheck$1(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties$1(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, _toPropertyKey$3(descriptor.key), descriptor);
	}
}
function _createClass$1(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties$1(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties$1(Constructor, staticProps);
	Object.defineProperty(Constructor, "prototype", { writable: false });
	return Constructor;
}
function _toPropertyKey$3(arg) {
	var key = _toPrimitive$3(arg, "string");
	return _typeof$4(key) === "symbol" ? key : String(key);
}
function _toPrimitive$3(input, hint) {
	if (_typeof$4(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$4(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _inherits$1(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	Object.defineProperty(subClass, "prototype", { writable: false });
	if (superClass) _setPrototypeOf$1(subClass, superClass);
}
function _setPrototypeOf$1(o, p) {
	_setPrototypeOf$1 = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf$1(o, p);
}
function _createSuper$1(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct$1();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf$1(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf$1(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn$1(this, result);
	};
}
function _possibleConstructorReturn$1(self, call) {
	if (call && (_typeof$4(call) === "object" || typeof call === "function")) return call;
	else if (call !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
	return _assertThisInitialized$1(self);
}
function _assertThisInitialized$1(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _isNativeReflectConstruct$1() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _getPrototypeOf$1(o) {
	_getPrototypeOf$1 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf$1(o);
}
/**
* Verifies that an input stream represents a valid `.xlsx` file.
*
* Throws an `InvalidInputError` when the input isn't an `.xlsx` file.
*/
var InputValidationStream = /*#__PURE__*/ function(_Transform) {
	_inherits$1(InputValidationStream, _Transform);
	var _super = _createSuper$1(InputValidationStream);
	function InputValidationStream() {
		var _this;
		_classCallCheck$1(this, InputValidationStream);
		_this = _super.call(this);
		_this.d = createFileTypeDetector();
		_this.i = 0;
		_this.chunks = [];
		return _this;
	}
	_createClass$1(InputValidationStream, [{
		key: "_transform",
		value: function _transform(chunk, encoding, callback) {
			if (this.d) {
				this.chunks.push(chunk);
				for (var _iterator = _createForOfIteratorHelperLoose$2(chunk), _step; !(_step = _iterator()).done;) {
					var _byte = _step.value;
					try {
						if (validateByte(_byte, this.d)) {
							this.d = void 0;
							chunk = Buffer.concat(this.chunks);
							this.chunks = void 0;
							break;
						}
					} catch (error) {
						return callback(error);
					}
					this.i++;
				}
				if (this.d) return callback();
			}
			this.push(chunk);
			callback();
		}
	}, {
		key: "_flush",
		value: function _flush(callback) {
			if (this.d) try {
				noFileTypeCouldBeDetermined(this.i);
			} catch (error) {
				return callback(error);
			}
			callback();
		}
	}]);
	return InputValidationStream;
}(Transform$1);
//#endregion
//#region node_modules/read-excel-file/modules/utility/checkpoint.js
var latestCheckpointTimestamp;
function checkpoint(name) {
	var now = Date.now();
	if (typeof global !== "undefined" ? Boolean(global.READ_EXCEL_FILE_CHECKPOINTS) : typeof window !== "undefined" ? Boolean(window.READ_EXCEL_FILE_CHECKPOINTS) : false) {
		if (latestCheckpointTimestamp) console.log("  -", now - latestCheckpointTimestamp, "ms");
		console.log("*", name);
	}
	latestCheckpointTimestamp = now;
}
function resetCheckpoint() {
	latestCheckpointTimestamp = void 0;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/unpackXlsxFileNode.js
/**
* Unpacks `*.xlsx` file contents.
* An `.xlsx` file is really just a `.zip` archive with `.xml` files inside.
* @param  {(string|Stream|Buffer|Blob)} input
* @return {Promise<Record<string,Uint8Array>} Resolves to an object holding `*.xlsx` file entries.
*/
function unpackXlsxFile(input) {
	resetCheckpoint();
	checkpoint("unpack files");
	var stream = convertInputToNodeStream(input);
	return new Promise(function(resolve, reject) {
		unzipFromStream(stream.on("error", reject).pipe(new InputValidationStream()), { filter: filterZipArchiveEntry }).then(resolve, function(error) {
			if (error instanceof UnzipError) reject(new InvalidInputError("INVALID_ZIP", error.cause));
			else reject(error);
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetInfo.js
/**
* Parses spreadsheet info.
* @param {string} content
* @param  {function} parseXml — SAX XML parser.
* @returns {object} An object of shape `{ epoch1904: boolean, sheets: Sheet[] }`.
*/
function parseSpreadsheetInfo(content, parseXml) {
	var state = createInitialState();
	return parseXml(content, state, onOpenTag, null, null).then(function() {
		return getResultFromState(state);
	});
	function createInitialState() {
		return {
			workbookPr: void 0,
			sheets: []
		};
	}
	function getResultFromState(state) {
		return {
			epoch1904: state.workbookPr ? state.workbookPr.epoch1904 : false,
			sheets: state.sheets
		};
	}
	function onOpenTag(tagName, attributes, state) {
		if (tagName === "workbookPr") {
			if (!state.workbookPr) state.workbookPr = { epoch1904: attributes.date1904 === "1" };
		} else if (tagName === "sheet") {
			if (attributes.name) state.sheets.push({
				id: Number(attributes.sheetId),
				name: attributes.name,
				relationId: attributes.id
			});
		}
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseFilePaths.js
/**
* Returns sheet file paths.
* Seems that the correct place to look for the `sheetId` -> `filename` mapping
* is `xl/_rels/workbook.xml.rels` file.
* https://github.com/tidyverse/readxl/issues/104
* @param  {string} content — `xl/_rels/workbook.xml.rels` file contents.
* @param  {function} parseXml — SAX XML parser.
* @return {object} — An object of shape `{ sheets: Record<string, string>, sharedStrings: string?, styles: string? }`
*/
function parseFilePaths(content, parseXml) {
	var RELATIONSHIPS_BASE_URL_TRANSITIONAL_STANDARD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
	var RELATIONSHIPS_BASE_URL_STRICT_STANDARD = "http://purl.oclc.org/ooxml/officeDocument/relationships/";
	var state = createInitialState();
	return parseXml(content, state, onOpenTag, null, null).then(function() {
		return getResultFromState(state);
	});
	function createInitialState() {
		return {
			sheets: {},
			sharedStrings: void 0,
			styles: void 0
		};
	}
	function getResultFromState(state) {
		return state;
	}
	function onOpenTag(tagName, attributes, state) {
		if (tagName === "Relationship") addFilePathForRelation(state, attributes.Id, attributes.Type, attributes.Target);
	}
	function addFilePathForRelation(state, id, type, target) {
		switch (type) {
			case RELATIONSHIPS_BASE_URL_TRANSITIONAL_STANDARD + "styles":
			case RELATIONSHIPS_BASE_URL_STRICT_STANDARD + "styles":
				state.styles = getFilePathFromRelationTarget(target);
				break;
			case RELATIONSHIPS_BASE_URL_TRANSITIONAL_STANDARD + "sharedStrings":
			case RELATIONSHIPS_BASE_URL_STRICT_STANDARD + "sharedStrings":
				state.sharedStrings = getFilePathFromRelationTarget(target);
				break;
			case RELATIONSHIPS_BASE_URL_TRANSITIONAL_STANDARD + "worksheet":
			case RELATIONSHIPS_BASE_URL_STRICT_STANDARD + "worksheet": state.sheets[id] = getFilePathFromRelationTarget(target);
		}
	}
	function getFilePathFromRelationTarget(path) {
		if (path[0] === "/") return path.slice(1);
		return "xl/" + path;
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseStyles.js
function _typeof$3(o) {
	"@babel/helpers - typeof";
	return _typeof$3 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$3(o);
}
var _excluded = ["xfId"];
function ownKeys$1(e, r) {
	var t = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r) {
			return Object.getOwnPropertyDescriptor(e, r).enumerable;
		})), t.push.apply(t, o);
	}
	return t;
}
function _objectSpread$1(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys$1(Object(t), !0).forEach(function(r) {
			_defineProperty$1(e, r, t[r]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys$1(Object(t)).forEach(function(r) {
			Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
		});
	}
	return e;
}
function _defineProperty$1(obj, key, value) {
	key = _toPropertyKey$2(key);
	if (key in obj) Object.defineProperty(obj, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
	else obj[key] = value;
	return obj;
}
function _toPropertyKey$2(arg) {
	var key = _toPrimitive$2(arg, "string");
	return _typeof$3(key) === "symbol" ? key : String(key);
}
function _toPrimitive$2(input, hint) {
	if (_typeof$3(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$3(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _objectWithoutProperties(source, excluded) {
	if (source == null) return {};
	var target = _objectWithoutPropertiesLoose(source, excluded);
	var key, i;
	if (Object.getOwnPropertySymbols) {
		var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
		for (i = 0; i < sourceSymbolKeys.length; i++) {
			key = sourceSymbolKeys[i];
			if (excluded.indexOf(key) >= 0) continue;
			if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
			target[key] = source[key];
		}
	}
	return target;
}
function _objectWithoutPropertiesLoose(source, excluded) {
	if (source == null) return {};
	var target = {};
	var sourceKeys = Object.keys(source);
	var key, i = 0;
	for (; i < sourceKeys.length; i++) {
		key = sourceKeys[i];
		if (excluded.indexOf(key) >= 0) continue;
		target[key] = source[key];
	}
	return target;
}
/**
* Parses `.xlsx` file styles.
* http://officeopenxml.com/SSstyles.php
* Returns an array of cell styles.
* A cell style index is the cell style ID.
* @param {string} content
* @param  {function} parseXml — SAX XML parser.
* @returns {object} styles
*/
function parseStyles(content, parseXml) {
	var state = createInitialState();
	return parseXml(content, state, onOpenTag, onCloseTag, null).then(function() {
		return getResultFromState(state);
	});
	function createInitialState() {
		return {
			numberFormats: [],
			baseStyles: [],
			styles: [],
			cellStyleXfs: false,
			cellXfs: false
		};
	}
	function getResultFromState(state) {
		return state.styles.map(function(style) {
			if (style.xfId) {
				var xfId = style.xfId, styleProperties = _objectWithoutProperties(style, _excluded);
				return _objectSpread$1(_objectSpread$1({}, state.baseStyles[xfId]), styleProperties);
			} else return style;
		});
	}
	function onOpenTag(tagName, attributes, state) {
		if (tagName === "numFmt") {
			var numFmtId = Number(attributes.numFmtId);
			var numberFormat = { id: numFmtId };
			if (numFmtId >= 100) numberFormat.template = attributes.formatCode;
			state.numberFormats[numFmtId] = numberFormat;
		} else if (tagName === "cellStyleXfs") state.cellStyleXfs = true;
		else if (tagName === "cellXfs") state.cellXfs = true;
		else if (tagName === "xf") {
			if (state.cellStyleXfs) state.baseStyles.push(parseCellStyle(attributes));
			else if (state.cellXfs) {
				var style = parseCellStyle(attributes, state.numberFormats);
				if (attributes.xfId) style.xfId = Number(attributes.xfId);
				state.styles.push(style);
			}
		}
	}
	function onCloseTag(tagName, state) {
		if (tagName === "cellStyleXfs") state.cellStyleXfs = false;
		else if (tagName === "cellXfs") state.cellXfs = false;
	}
	function parseCellStyle(attributes, numberFormats) {
		var style = {};
		if (attributes.numFmtId) {
			var numFmtId = Number(attributes.numFmtId);
			if (numberFormats && numberFormats[numFmtId]) style.numberFormat = numberFormats[numFmtId];
			else style.numberFormat = { id: numFmtId };
		}
		return style;
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSharedStrings.js
/**
* Parses `sharedStrings.xml` file.
* @param {string} content
* @param {function} parseXml — SAX XML parser.
* @returns {Promise<string[]>}
*/
function parseSharedStrings(content, parseXml) {
	var state = createInitialState();
	return parseXml(content, state, onOpenTag, onCloseTag, onText).then(function() {
		return getResultFromState(state);
	});
	function createInitialState() {
		return {
			si: void 0,
			strings: []
		};
	}
	function getResultFromState(state) {
		return state.strings;
	}
	function onOpenTag(tagName, attributes, state) {
		if (tagName === "si") state.si = createInitialStateInSharedString();
		else if (state.si) onOpenTagInSharedString(tagName, attributes, state.si);
	}
	function onCloseTag(tagName, state) {
		if (tagName === "si") {
			state.strings.push(state.si.string);
			state.si = void 0;
		} else if (state.si) onCloseTagInSharedString(tagName, state.si);
	}
	function onText(text, state) {
		if (state.si) onTextInSharedString(text, state.si);
	}
	function createInitialStateInSharedString() {
		return {
			t: false,
			r: false,
			rPh: false,
			string: ""
		};
	}
	function onOpenTagInSharedString(tagName, attributes, state) {
		if (tagName === "t") state.t = true;
		else if (tagName === "r") state.r = true;
		else if (tagName === "rPh") state.rPh = true;
	}
	function onCloseTagInSharedString(tagName, state) {
		if (tagName === "t") state.t = false;
		else if (tagName === "r") state.r = false;
		else if (tagName === "rPh") state.rPh = false;
	}
	function onTextInSharedString(text, state) {
		if (state.rPh) {} else if (state.t) {
			if (state.r) state.string += text;
			else state.string = text;
		}
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseExcelTimestamp.js
function parseExcelTimestamp(excelSerialDate, epoch1904) {
	var NUMBER_OF_LEAP_YEARS_BETWEEN_1900_AND_1970 = 17;
	var JANUARY_0TH_1900_DAY = 1;
	var ERRONEOUS_FEBRUARY_29_1990_DAY = 1;
	var DAY = 864e5;
	var DAYS_IN_YEAR = 365;
	if (epoch1904) excelSerialDate += 4 * DAYS_IN_YEAR + JANUARY_0TH_1900_DAY + ERRONEOUS_FEBRUARY_29_1990_DAY;
	var daysBeforeUnixEpoch = JANUARY_0TH_1900_DAY + ERRONEOUS_FEBRUARY_29_1990_DAY + 70 * DAYS_IN_YEAR + NUMBER_OF_LEAP_YEARS_BETWEEN_1900_AND_1970;
	return Math.floor((excelSerialDate - daysBeforeUnixEpoch) * DAY);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormat.js
var DATE_FORMAT_POSTFIX_THAT_ALLOWS_ANY_ARBITRARY_TEXT_INPUT = /;@$/;
var DATE_FORMAT_TOKEN_SPLITTER_REG_EXP = /[^a-z0#\?%]+/;
/**
* XLSX standard does have "d" type for dates, but it's not commonly used.
* Instead, `.xlsx` files use "n" type for storing both numbers and dates (as timestamps).
* So how does one tell if a cell value should be interpreted as a number or as a date?
* The answer is in the "format" that is used to "format" the cell value: if it's
* date-specific then it's a date, otherwise it's a number.
* This function tells if a given number format template represents a date rather than a number.
* @param {number} formatId
* @param {string} template
* @param {boolean?[]} dateFormatDetectionCache
* @returns {boolean}
*/
function isDateFormat(formatId, template, dateFormatDetectionCache) {
	var cachedResult = dateFormatDetectionCache[formatId];
	if (cachedResult === void 0) return dateFormatDetectionCache[formatId] = isDateFormatTemplate(template);
	return cachedResult;
}
/**
* XLSX standard does have "d" type for dates, but it's not commonly used.
* Instead, `.xlsx` files use "n" type for storing both numbers and dates (as timestamps).
* So how does one tell if a cell value should be interpreted as a number or as a date?
* The answer is in the "format" that is used to "format" the cell value: if it's
* date-specific then it's a date, otherwise it's a number.
* This function tells if a given number format template represents a date rather than a number.
* @param {string} numberFormat
* @returns {boolean}
*/
function isDateFormatTemplate(template) {
	template = template.toLowerCase();
	template = template.replace(DATE_FORMAT_POSTFIX_THAT_ALLOWS_ANY_ARBITRARY_TEXT_INPUT, "");
	template = template.replace(/\\./g, " ");
	return template.split(";").some(isDateFormatSubTemplate);
	/**
	* Tells if a given format template formats a date.
	* @param {string} template
	* @returns {boolean}
	*/
	function isDateFormatSubTemplate(template) {
		template = template.replace(/"[^"]*"/g, " ");
		template = template.replace(/(\[?[smhd]{1,2}\]?)[\.\,]00?0?/g, "$1");
		template = template.replace(/\[([smhd]{1,2})\]/g, "$1");
		template = template.replace(/\[[^\]]*\]/g, "");
		var tokens = template.split(DATE_FORMAT_TOKEN_SPLITTER_REG_EXP).filter(function(_) {
			return _;
		});
		return tokens.length === 0 ? false : tokens.every(function(token) {
			return DATE_FORMAT_TEMPLATE_TOKENS.indexOf(token) >= 0;
		});
	}
}
var DATE_FORMAT_TEMPLATE_TOKENS = [
	"s",
	"ss",
	"m",
	"mm",
	"h",
	"hh",
	"am",
	"pm",
	"a",
	"p",
	"d",
	"dd",
	"ddd",
	"dddd",
	"aaa",
	"aaaa",
	"aaaaa",
	"m",
	"mm",
	"mmm",
	"mmmm",
	"mmmmm",
	"y",
	"yy",
	"yyyy",
	"e",
	"ee",
	"eeee"
];
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormatStyle.js
function isDateFormatStyle(style, defaultDateFormat, shouldGuessDateFormatFromNumberFormatTemplate, dateFormatDetectionCache) {
	if (!style.numberFormat) return false;
	if (BUILT_IN_DATE_FORMAT_IDS.indexOf(style.numberFormat.id) >= 0 || defaultDateFormat && style.numberFormat.template === defaultDateFormat || shouldGuessDateFormatFromNumberFormatTemplate && style.numberFormat.template && isDateFormat(style.numberFormat.id, style.numberFormat.template, dateFormatDetectionCache)) return true;
	return false;
}
var LOCALE_INDEPENDENT_BUILT_IN_DATE_FORMAT_IDS = [
	14,
	15,
	16,
	17,
	18,
	19,
	20,
	21,
	22,
	45,
	46,
	47
];
var MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS = [
	27,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	50,
	51,
	52,
	53,
	54,
	55,
	56,
	57,
	58
];
var JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS = [
	27,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	50,
	51,
	52,
	53,
	54,
	55,
	56,
	57,
	58
];
var BUILT_IN_DATE_FORMAT_IDS = LOCALE_INDEPENDENT_BUILT_IN_DATE_FORMAT_IDS.concat(MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS).concat(JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS.filter(function(numberFormatId) {
	return MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
})).concat([
	71,
	72,
	73,
	74,
	75,
	76,
	77,
	78,
	79,
	80,
	81
].filter(function(numberFormatId) {
	return MAINLAND_CHINESE_OR_TAIWANESE_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
}).filter(function(numberFormatId) {
	return JAPANESE_OR_KOREAN_LOCALE_BUILT_IN_DATE_FORMAT_IDS.indexOf(numberFormatId) < 0;
}));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCell.js
function _slicedToArray$1(arr, i) {
	return _arrayWithHoles$1(arr) || _iterableToArrayLimit$1(arr, i) || _unsupportedIterableToArray$2(arr, i) || _nonIterableRest$1();
}
function _nonIterableRest$1() {
	throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray$2(o, minLen) {
	if (!o) return;
	if (typeof o === "string") return _arrayLikeToArray$2(o, minLen);
	var n = Object.prototype.toString.call(o).slice(8, -1);
	if (n === "Object" && o.constructor) n = o.constructor.name;
	if (n === "Map" || n === "Set") return Array.from(o);
	if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$2(o, minLen);
}
function _arrayLikeToArray$2(arr, len) {
	if (len == null || len > arr.length) len = arr.length;
	for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	return arr2;
}
function _iterableToArrayLimit$1(r, l) {
	var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	if (null != t) {
		var e, n, i, u, a = [], f = !0, o = !1;
		try {
			if (i = (t = t.call(r)).next, 0 === l) {
				if (Object(t) !== t) return;
				f = !1;
			} else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
		} catch (r) {
			o = !0, n = r;
		} finally {
			try {
				if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return;
			} finally {
				if (o) throw n;
			}
		}
		return a;
	}
}
function _arrayWithHoles$1(arr) {
	if (Array.isArray(arr)) return arr;
}
var EMPTY_CELL = [null, null];
/**
* Parses a cell from the info extracted from XML.
* @param {string} [t] — `<c t/>` attribute value (cell type). One of: b (Boolean), e (Error), n (Number), d (Date), s (String).
* @param {string} [s] — `<c s/>` attribute value (formatting style ID). When present, should be a stringified zero-based index of the formatting style for a numberic cell.
* @param {string} [v] — `<v/>` element text content (value). Will be `undefined` if the `<v/>` element absent. Will be an empty string `""` if the `<v/>` element is present but is empty.
* @param {string} [inlineString] — Inline string value.
* @param {any[]} parameters
* @returns {[string|null,string|number|boolean|null] | string} Either `[type, value]` or `error`, where `value` is the cell value, `type` depends on the type of `value` and could be one of: 's' (string), 'b' (boolean), 'n' (number string), 'd' (date timestamp), 'e' (formula cell error), `null` (null); `error` is an error message: `VALUE_MISSING`, `VALUE_INVALID`, `FORMAT_INVALID`, `TYPE_INVALID`.
*/
function parseCell(t, s, v, inlineString, _ref) {
	var _ref2 = _slicedToArray$1(_ref, 7), sharedStrings = _ref2[0], styles = _ref2[1], epoch1904 = _ref2[2], dateFormatDetectionCache = _ref2[3], defaultDateFormat = _ref2[4], dateTemplateParser = _ref2[5], parseNumberCustom = _ref2[6];
	switch (t || "n") {
		case "str":
			if (v === void 0) return "VALUE_MISSING";
			if (!v) return EMPTY_CELL;
			return ["s", v];
		case "inlineStr":
			if (inlineString === void 0) return "VALUE_MISSING";
			return ["s", inlineString];
		case "s":
			if (!v) return "VALUE_MISSING";
			var sharedStringIndex = Number(v);
			if (isNaN(sharedStringIndex) || sharedStrings[sharedStringIndex] === void 0) return "VALUE_INVALID";
			return ["s", sharedStrings[sharedStringIndex]];
		case "b":
			if (!v) return "VALUE_MISSING";
			if (v === "1") return ["b", true];
			if (v === "0") return ["b", false];
			return "VALUE_INVALID";
		case "e":
			if (!v) return "VALUE_MISSING";
			return ["e", v];
		case "d":
			if (!v) return EMPTY_CELL;
			var parsedDate = new Date(v);
			if (isNaN(parsedDate.valueOf())) return "VALUE_INVALID";
			return ["d", parsedDate.getTime()];
		case "n":
			if (!v) return EMPTY_CELL;
			if (s) {
				var styleId = Number(s);
				if (isNaN(styleId) || styles[styleId] === void 0) return "FORMAT_INVALID";
				if (isDateFormatStyle(styles[styleId], defaultDateFormat, dateTemplateParser, dateFormatDetectionCache)) {
					var timestamp = Number(v);
					if (isNaN(timestamp)) return "VALUE_INVALID";
					return ["d", parseExcelTimestamp(timestamp, epoch1904)];
				}
			}
			if (parseNumberCustom) return ["n", v];
			var number = Number(v);
			if (isNaN(number)) return "VALUE_INVALID";
			return ["n", number];
		default: return "TYPE_INVALID";
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCellAddress.js
/**
* Parses cell address into a row number and a column number.
* Examples: "A1" → [1,1], "B2" → [2,2], "AA2091" → [2091, 27], "R988" → [988, 18].
* @param {string} cellAddress
* @returns {number[]} Returns `[rowNumber, columnNumber]`
*/
function parseCellAddress(cellAddress) {
	var columnNumber = 0;
	var i = 0;
	while (i < cellAddress.length) {
		var charCode = cellAddress.charCodeAt(i);
		if (charCode >= 48 && charCode <= 57) {
			var rowNumber = Number(cellAddress.slice(i));
			if (isNaN(rowNumber)) invalidCellAddress(cellAddress);
			return [rowNumber, columnNumber];
		}
		columnNumber *= 26;
		columnNumber += cellAddress.charCodeAt(i) - 64;
		i++;
	}
	invalidCellAddress(cellAddress);
}
function invalidCellAddress(cellAddress) {
	throw new Error("<c r=\"".concat(cellAddress, "\">"));
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSheet.js
function _slicedToArray(arr, i) {
	return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray$1(arr, i) || _nonIterableRest();
}
function _nonIterableRest() {
	throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _iterableToArrayLimit(r, l) {
	var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	if (null != t) {
		var e, n, i, u, a = [], f = !0, o = !1;
		try {
			if (i = (t = t.call(r)).next, 0 === l) {
				if (Object(t) !== t) return;
				f = !1;
			} else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
		} catch (r) {
			o = !0, n = r;
		} finally {
			try {
				if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return;
			} finally {
				if (o) throw n;
			}
		}
		return a;
	}
}
function _arrayWithHoles(arr) {
	if (Array.isArray(arr)) return arr;
}
function _createForOfIteratorHelperLoose$1(o, allowArrayLike) {
	var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
	if (it) return (it = it.call(o)).next.bind(it);
	if (Array.isArray(o) || (it = _unsupportedIterableToArray$1(o)) || allowArrayLike && o && typeof o.length === "number") {
		if (it) o = it;
		var i = 0;
		return function() {
			if (i >= o.length) return { done: true };
			return {
				done: false,
				value: o[i++]
			};
		};
	}
	throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray$1(o, minLen) {
	if (!o) return;
	if (typeof o === "string") return _arrayLikeToArray$1(o, minLen);
	var n = Object.prototype.toString.call(o).slice(8, -1);
	if (n === "Object" && o.constructor) n = o.constructor.name;
	if (n === "Map" || n === "Set") return Array.from(o);
	if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen);
}
function _arrayLikeToArray$1(arr, len) {
	if (len == null || len > arr.length) len = arr.length;
	for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	return arr2;
}
var EMPTY_CELL_VALUE = null;
/**
* Parses a `sheet.xml` file.
* @param {string} content
* @param {function} parseXml — SAX XML parser.
* @param {object} options
* @returns {Promise<SheetData>}
*/
function parseSheet(content, parseXml, _ref) {
	var sharedStrings = _ref.sharedStrings, styles = _ref.styles, epoch1904 = _ref.epoch1904, dateFormatDetectionCache = _ref.dateFormatDetectionCache, options = _ref.options;
	var parseCellParameters = [
		sharedStrings,
		styles,
		epoch1904,
		dateFormatDetectionCache,
		options.dateFormat,
		options.smartDateParser !== false,
		options.parseNumber
	];
	var rows = [];
	var errors = [];
	var state = createInitialState();
	return parseXml(content, state, onOpenTag, onCloseTag, onText, onProgress).then(function() {
		var _state$sheetData = state.sheetData, rowCount = _state$sheetData.rowCount, columnCount = _state$sheetData.columnCount, dataRowCount = _state$sheetData.dataRowCount, dataColumnCount = _state$sheetData.dataColumnCount;
		if (dataRowCount < rowCount) rows = rows.slice(0, dataRowCount);
		if (dataColumnCount < columnCount) {
			var i = 0;
			while (i < rows.length) {
				if (rows[i].length > dataColumnCount) rows[i] = rows[i].slice(0, dataColumnCount);
				i++;
			}
		}
		for (var _iterator = _createForOfIteratorHelperLoose$1(rows), _step; !(_step = _iterator()).done;) {
			var row = _step.value;
			while (row.length < dataColumnCount) row.push(EMPTY_CELL_VALUE);
		}
		return rows;
	});
	function createInitialState() {
		return {
			dimension: void 0,
			sheetData: void 0
		};
	}
	function getRowsFromState(state) {
		return state.sheetData.rows;
	}
	function setRowsInState(state, rows) {
		state.sheetData.rowIndexShift += state.sheetData.rows.length - rows.length;
		state.sheetData.rows = rows;
	}
	function getErrorsFromState(state) {
		return state.sheetData.errors;
	}
	function setErrorsInState(state, errors) {
		state.sheetData.errors = errors;
	}
	function throwInvalidCellError(_ref2) {
		var row = _ref2.row, column = _ref2.column, error = _ref2.error;
		throw new InvalidSpreadsheetError("<c/> at row ".concat(row, ", col ").concat(column, ": ").concat(error));
	}
	function onProgress(end) {
		if (!state.sheetData) return;
		var rowsRead = getRowsFromState(state);
		var errorsEncountered = getErrorsFromState(state);
		if (end) {
			rows = rows.concat(rowsRead);
			errors = errors.concat(errorsEncountered);
			if (errors.length > 0) throwInvalidCellError(errors[0]);
		} else if (rowsRead.length > 1) {
			var finalizedRows = rowsRead.slice(0, -1);
			rows = rows.concat(finalizedRows);
			errors = errors.concat(errorsEncountered);
			setRowsInState(state, rowsRead.slice(-1));
			setErrorsInState(state, []);
		}
	}
	function onOpenTag(tagName, attributes, state) {
		if (tagName === "dimension") state.dimension = parseSheetDimensionRef(attributes.ref);
		else if (tagName === "sheetData") state.sheetData = createInitialStateInSheetData();
		else if (state.sheetData) onOpenTagInSheetData(tagName, attributes, state.sheetData);
	}
	function onCloseTag(tagName, state) {
		if (state.sheetData) onCloseTagInSheetData(tagName, state.sheetData);
	}
	function onText(text, state) {
		if (state.sheetData) onTextInSheetData(text, state.sheetData);
	}
	/**
	* Sheet "dimension" defines the spreadsheet area containing all non-empty cells.
	* Any cells outside the "dimension" are considered empty and should be ignored.
	* https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.sheetdimension?view=openxml-2.8.1
	* @param {string} `ref` — The value of `<dimension ref/>` attribute.
	* @returns {[[number,number],[number,number]]} `undefined` or `[{ row, column }, { row, column }]` — "From row number and column number to row number and column number".
	*/
	function parseSheetDimensionRef(ref) {
		var dimensions = ref.split(":").map(parseCellAddress);
		if (dimensions.length === 1) dimensions = [dimensions[0], dimensions[0]];
		return dimensions;
	}
	function createInitialStateInSheetData() {
		return {
			c: void 0,
			rows: [],
			row: void 0,
			rowNumber: void 0,
			rowIndexShift: 0,
			cursor: [0, 0],
			rowCount: 0,
			columnCount: 0,
			dataRowCount: 0,
			dataColumnCount: 0,
			errors: []
		};
	}
	function onOpenTagInSheetData(tagName, attributes, state) {
		if (tagName === "row") {
			if (attributes.r) state.rowNumber = Number(attributes.r);
			state.row = [];
		} else if (tagName === "c") {
			state.c = createInitialStateInCell();
			state.c.attributes = attributes;
		} else if (state.c) onOpenTagInCell(tagName, attributes, state.c);
	}
	function onCloseTagInSheetData(tagName, state) {
		if (tagName === "row") {
			if (state.rowNumber) {
				var previousRowNumber = state.rowIndexShift + state.rows.length;
				if (state.rowNumber <= previousRowNumber) throw new InvalidSpreadsheetError("Out-of-place <row/> number ".concat(state.rowNumber, " follows <row/> number ").concat(previousRowNumber));
				while (state.rowNumber > state.rowIndexShift + state.rows.length + 1) state.rows.push([]);
			}
			state.rows.push(state.row);
			if (state.row.length > 0) state.dataRowCount = state.rowNumber;
			if (state.rowNumber > state.rowCount) state.rowCount = state.rowNumber;
			state.row = void 0;
			state.rowNumber = void 0;
		} else if (tagName === "c") {
			var cell = parseCellFromXmlData(state.c);
			if (cell.row < state.cursor[0] || cell.row === state.cursor[0] && cell.column <= state.cursor[1]) throw new InvalidSpreadsheetError("Out-of-place <c/> at row ".concat(cell.row, " col ").concat(cell.column, " follows <c/> at row ").concat(state.cursor[0], " col ").concat(state.cursor[1]));
			state.cursor[0] = cell.row;
			state.cursor[1] = cell.column;
			if (!state.rowNumber) state.rowNumber = cell.row;
			if (cell.error) {
				if (THROW_ON_FIRST_CELL_ERROR) throwInvalidCellError(cell);
				state.errors.push(cell);
			} else if (cell.value !== EMPTY_CELL_VALUE) {
				while (cell.column > state.row.length + 1) state.row.push(EMPTY_CELL_VALUE);
				state.row.push(cell.value);
				if (cell.column > state.dataColumnCount) state.dataColumnCount = cell.column;
			}
			if (cell.column > state.columnCount) state.columnCount = cell.column;
			state.c = void 0;
		} else if (state.c) onCloseTagInCell(tagName, state.c);
	}
	function onTextInSheetData(text, state) {
		if (state.c) onTextInCell(text, state.c);
	}
	/**
	* Parses the XML values of a `<c/>` element into an object representing a cell value.
	* @param {object} — `{ attributes: Record<string,string>, inlineString?: string, vText?: string }`. If `<v/>` element is present but is empty, `vText` will be an empty string. If `<v/>` element is absent, `vText` will be `undefined`.
	* @returns {object} Either `{ row: number, column: number, error: string }` or `{ row: number, column: number, value: string|number|boolean|null }`
	*/
	function parseCellFromXmlData(_ref3) {
		var attributes = _ref3.attributes, inlineString = _ref3.inlineString, vText = _ref3.vText;
		var _parseCellAddress2 = _slicedToArray(parseCellAddress(attributes.r), 2), row = _parseCellAddress2[0], column = _parseCellAddress2[1];
		var errorOrTypeAndValue = parseCellAndTrimValue(attributes.t, attributes.s, vText, inlineString, parseCellParameters, options.trim !== false);
		if (typeof errorOrTypeAndValue === "string") return {
			row,
			column,
			error: errorOrTypeAndValue
		};
		return {
			row,
			column,
			value: parseCellValue(errorOrTypeAndValue[1], errorOrTypeAndValue[0])
		};
	}
	/**
	* Parses a cell from the info extracted from the cell XML.
	* If the cell is of type string, it trims the value (by default).
	*
	* Receives same arguments as `parseCell()` function, with an additional argument
	* `trimStrings: boolean` which tells if it should trim any string values.
	*
	* Produces same result as `parseCell()` function, except for cells of type "e".
	*/
	function parseCellAndTrimValue(t, s, v, inlineString, parameters, trimStrings) {
		var errorOrTypeAndValue = parseCellWithRepairAbility(t, s, v, inlineString, parameters);
		if (Array.isArray(errorOrTypeAndValue) && errorOrTypeAndValue[0] === "s") {
			if (trimStrings) errorOrTypeAndValue[1] = errorOrTypeAndValue[1].trim();
			if (errorOrTypeAndValue[1] === "") return EMPTY_CELL;
		}
		return errorOrTypeAndValue;
	}
	/**
	* Parses cell value and optionally repairs any repairable errors.
	* Receives same arguments as `parseCell()` function.
	* Produces same result as `parseCell()` function, except for cells of type "e".
	*/
	function parseCellWithRepairAbility(t, s, v, inlineString, parameters) {
		var errorOrTypeAndValue = parseCell(t, s, v, inlineString, parameters);
		if (errorOrTypeAndValue === "VALUE_MISSING") switch (t || "n") {
			case "str":
			case "inlineStr":
			case "s":
			case "b": return EMPTY_CELL;
		}
		if (t === "e") return EMPTY_CELL;
		return errorOrTypeAndValue;
	}
	/**
	* For certain types of cell, it transforms the value.
	* Specifically, for cells of type "n" or "d", it transforms the value to `Number` or `Date` respectively.
	*
	* The reason it is done separately is because before this function is called,
	* the cells are easily "serializable". And after this function is called,
	* some of the cells' `value` properties become instances of `Date` class or any other class,
	* such as `BigInt`, serializing which would require additional manual steps to be performed.
	* Serializing cells could be utilized in case of "transferring" data between workers
	* with a `transferList`, argument which could hypothetically result in better performance
	* and less time being blocked by the "synchronous" JSON serialization.
	*
	* @param {string|number|boolean|null} value
	* @param {string} type — One of: "s", "n", "d", "b", "-"
	* @return {string|ParsedNumber|Date|boolean|null}
	*/
	function parseCellValue(value, type) {
		if (type === "n") {
			if (options.parseNumber) return options.parseNumber(value);
			return value;
		} else if (type === "d") return new Date(value);
		else return value;
	}
	function createInitialStateInCell() {
		return {
			v: false,
			is: false,
			t: false,
			r: false,
			rPh: false,
			vText: void 0,
			inlineString: void 0,
			attributes: void 0
		};
	}
	function onOpenTagInCell(tagName, attributes, state) {
		if (tagName === "v") state.v = true;
		else if (tagName === "is") {
			state.is = true;
			state.inlineString = "";
		} else if (tagName === "t") state.t = true;
		else if (tagName === "r") state.r = true;
		else if (tagName === "rPh") state.rPh = true;
	}
	function onCloseTagInCell(tagName, state) {
		if (tagName === "v") {
			state.v = false;
			state.vText || (state.vText = "");
		} else if (tagName === "is") state.is = false;
		else if (tagName === "t") state.t = false;
		else if (tagName === "r") state.r = false;
		else if (tagName === "rPh") state.rPh = false;
	}
	function onTextInCell(text, state) {
		if (state.v) state.vText = text;
		else if (state.is) {
			if (state.rPh) {} else if (state.t) {
				if (state.r) state.inlineString += text;
				else state.inlineString = text;
			}
		}
	}
	var THROW_ON_FIRST_CELL_ERROR;
}
//#endregion
//#region node_modules/fflate/esm/index.mjs
var require$1 = createRequire$1("/");
var _a;
try {
	_a = require$1("worker_threads"), _a.Worker, _a.isMarkedAsUntransferable;
} catch (e) {}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	2,
	2,
	2,
	2,
	3,
	3,
	3,
	3,
	4,
	4,
	4,
	4,
	5,
	5,
	5,
	5,
	0,
	0,
	0,
	0
]);
var fdeb = new u8([
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13,
	0,
	0
]);
new u8([
	16,
	17,
	18,
	0,
	8,
	7,
	9,
	6,
	10,
	5,
	11,
	4,
	12,
	3,
	13,
	2,
	14,
	1,
	15
]);
var freb = function(eb, start) {
	var b = new u16(31);
	for (var i = 0; i < 31; ++i) b[i] = start += 1 << eb[i - 1];
	var r = new i32(b[30]);
	for (var i = 1; i < 30; ++i) for (var j = b[i]; j < b[i + 1]; ++j) r[j] = j - b[i] << 5 | i;
	return {
		b,
		r
	};
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
_b.b;
_b.r;
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
	var x = (i & 43690) >> 1 | (i & 21845) << 1;
	x = (x & 52428) >> 2 | (x & 13107) << 2;
	x = (x & 61680) >> 4 | (x & 3855) << 4;
	rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var flt = new u8(288);
for (var i = 0; i < 144; ++i) flt[i] = 8;
for (var i = 144; i < 256; ++i) flt[i] = 9;
for (var i = 256; i < 280; ++i) flt[i] = 7;
for (var i = 280; i < 288; ++i) flt[i] = 8;
var fdt = new u8(32);
for (var i = 0; i < 32; ++i) fdt[i] = 5;
var slc = function(v, s, e) {
	if (s == null || s < 0) s = 0;
	if (e == null || e > v.length) e = v.length;
	return new u8(v.subarray(s, e));
};
var ec = [
	"unexpected EOF",
	"invalid block type",
	"invalid length/literal",
	"invalid distance",
	"stream finished",
	"no stream handler",
	,
	"no callback",
	"invalid UTF-8 data",
	"extra field too long",
	"date not in range 1980-2099",
	"filename too long",
	"stream finishing",
	"invalid zip data"
];
var err = function(ind, msg, nt) {
	var e = new Error(msg || ec[ind]);
	e.code = ind;
	if (Error.captureStackTrace) Error.captureStackTrace(e, err);
	if (!nt) throw e;
	return e;
};
var et = /*#__PURE__*/ new u8(0);
var td = typeof TextDecoder != "undefined" && /*#__PURE__*/ new TextDecoder();
try {
	td.decode(et, { stream: true });
} catch (e) {}
var dutf8 = function(d) {
	for (var r = "", i = 0;;) {
		var c = d[i++];
		var eb = (c > 127) + (c > 223) + (c > 239);
		if (i + eb > d.length) return {
			s: r,
			r: slc(d, i - 1)
		};
		if (!eb) r += String.fromCharCode(c);
		else if (eb == 3) c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
		else if (eb & 1) r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
		else r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
	}
};
/**
* Converts a Uint8Array to a string
* @param dat The data to decode to string
* @param latin1 Whether or not to interpret the data as Latin-1. This should
*               not need to be true unless encoding to binary string.
* @returns The original UTF-8/Latin-1 string
*/
function strFromU8$1(dat, latin1) {
	if (latin1) {
		var r = "";
		for (var i = 0; i < dat.length; i += 16384) r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
		return r;
	} else if (td) return td.decode(dat);
	else {
		var _a = dutf8(dat), s = _a.s, r = _a.r;
		if (r.length) err(8);
		return s;
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/convertValuesFromUint8ArraysToStrings.js
/**
* @param {Record<string,Uint8Array} entries
* @returns {Record<string,string>}
*/
function convertValuesFromUint8ArraysToStrings(entries) {
	checkpoint("convert files to strings");
	var convertedEntries = {};
	for (var _i = 0, _Object$keys = Object.keys(entries); _i < _Object$keys.length; _i++) {
		var key = _Object$keys[_i];
		convertedEntries[key] = strFromU8(entries[key]);
	}
	return convertedEntries;
}
/**
* Converts a Uint8Array to a string
* @param data The data to decode to string
* @param latin1 Whether or not to interpret the data as Latin-1. This should
*               not need to be true unless encoding to binary string.
* @returns The original UTF-8/Latin-1 string
*/
function strFromU8(data) {
	if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(data);
	else return strFromU8$1(data);
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/isPromise.js
function _typeof$2(o) {
	"@babel/helpers - typeof";
	return _typeof$2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$2(o);
}
function isPromise(anything) {
	return _typeof$2(anything) === "object" && typeof anything.then === "function";
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/SheetNotFoundError.js
function _typeof$1(o) {
	"@babel/helpers - typeof";
	return _typeof$1 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof$1(o);
}
function _defineProperties(target, props) {
	for (var i = 0; i < props.length; i++) {
		var descriptor = props[i];
		descriptor.enumerable = descriptor.enumerable || false;
		descriptor.configurable = true;
		if ("value" in descriptor) descriptor.writable = true;
		Object.defineProperty(target, _toPropertyKey$1(descriptor.key), descriptor);
	}
}
function _createClass(Constructor, protoProps, staticProps) {
	if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	if (staticProps) _defineProperties(Constructor, staticProps);
	Object.defineProperty(Constructor, "prototype", { writable: false });
	return Constructor;
}
function _toPropertyKey$1(arg) {
	var key = _toPrimitive$1(arg, "string");
	return _typeof$1(key) === "symbol" ? key : String(key);
}
function _toPrimitive$1(input, hint) {
	if (_typeof$1(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof$1(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
function _classCallCheck(instance, Constructor) {
	if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _inherits(subClass, superClass) {
	if (typeof superClass !== "function" && superClass !== null) throw new TypeError("Super expression must either be null or a function");
	subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: {
		value: subClass,
		writable: true,
		configurable: true
	} });
	Object.defineProperty(subClass, "prototype", { writable: false });
	if (superClass) _setPrototypeOf(subClass, superClass);
}
function _createSuper(Derived) {
	var hasNativeReflectConstruct = _isNativeReflectConstruct();
	return function _createSuperInternal() {
		var Super = _getPrototypeOf(Derived), result;
		if (hasNativeReflectConstruct) {
			var NewTarget = _getPrototypeOf(this).constructor;
			result = Reflect.construct(Super, arguments, NewTarget);
		} else result = Super.apply(this, arguments);
		return _possibleConstructorReturn(this, result);
	};
}
function _possibleConstructorReturn(self, call) {
	if (call && (_typeof$1(call) === "object" || typeof call === "function")) return call;
	else if (call !== void 0) throw new TypeError("Derived constructors may only return object or undefined");
	return _assertThisInitialized(self);
}
function _assertThisInitialized(self) {
	if (self === void 0) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	return self;
}
function _wrapNativeSuper(Class) {
	var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
	_wrapNativeSuper = function _wrapNativeSuper(Class) {
		if (Class === null || !_isNativeFunction(Class)) return Class;
		if (typeof Class !== "function") throw new TypeError("Super expression must either be null or a function");
		if (typeof _cache !== "undefined") {
			if (_cache.has(Class)) return _cache.get(Class);
			_cache.set(Class, Wrapper);
		}
		function Wrapper() {
			return _construct(Class, arguments, _getPrototypeOf(this).constructor);
		}
		Wrapper.prototype = Object.create(Class.prototype, { constructor: {
			value: Wrapper,
			enumerable: false,
			writable: true,
			configurable: true
		} });
		return _setPrototypeOf(Wrapper, Class);
	};
	return _wrapNativeSuper(Class);
}
function _construct(Parent, args, Class) {
	if (_isNativeReflectConstruct()) _construct = Reflect.construct.bind();
	else _construct = function _construct(Parent, args, Class) {
		var a = [null];
		a.push.apply(a, args);
		var instance = new (Function.bind.apply(Parent, a))();
		if (Class) _setPrototypeOf(instance, Class.prototype);
		return instance;
	};
	return _construct.apply(null, arguments);
}
function _isNativeReflectConstruct() {
	if (typeof Reflect === "undefined" || !Reflect.construct) return false;
	if (Reflect.construct.sham) return false;
	if (typeof Proxy === "function") return true;
	try {
		Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
		return true;
	} catch (e) {
		return false;
	}
}
function _isNativeFunction(fn) {
	return Function.toString.call(fn).indexOf("[native code]") !== -1;
}
function _setPrototypeOf(o, p) {
	_setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) {
		o.__proto__ = p;
		return o;
	};
	return _setPrototypeOf(o, p);
}
function _getPrototypeOf(o) {
	_getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) {
		return o.__proto__ || Object.getPrototypeOf(o);
	};
	return _getPrototypeOf(o);
}
var SheetNotFoundError = /*#__PURE__*/ function(_Error) {
	_inherits(SheetNotFoundError, _Error);
	var _super = _createSuper(SheetNotFoundError);
	function SheetNotFoundError(sheet, sheets) {
		var _this;
		_classCallCheck(this, SheetNotFoundError);
		_this = _super.call(this, "Sheet not found: ".concat(typeof sheet === "number" ? sheet + ". Sheet count: " + sheets.length : sheet + ". Available sheets: " + sheets.join(", ")));
		_this.name = "SheetNotFoundError";
		_this.sheet = sheet;
		_this.sheets = sheets;
		return _this;
	}
	return _createClass(SheetNotFoundError);
}(/*#__PURE__*/ _wrapNativeSuper(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetContents.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
function _createForOfIteratorHelperLoose(o, allowArrayLike) {
	var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
	if (it) return (it = it.call(o)).next.bind(it);
	if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
		if (it) o = it;
		var i = 0;
		return function() {
			if (i >= o.length) return { done: true };
			return {
				done: false,
				value: o[i++]
			};
		};
	}
	throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _unsupportedIterableToArray(o, minLen) {
	if (!o) return;
	if (typeof o === "string") return _arrayLikeToArray(o, minLen);
	var n = Object.prototype.toString.call(o).slice(8, -1);
	if (n === "Object" && o.constructor) n = o.constructor.name;
	if (n === "Map" || n === "Set") return Array.from(o);
	if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function _arrayLikeToArray(arr, len) {
	if (len == null || len > arr.length) len = arr.length;
	for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
	return arr2;
}
function ownKeys(e, r) {
	var t = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r) {
			return Object.getOwnPropertyDescriptor(e, r).enumerable;
		})), t.push.apply(t, o);
	}
	return t;
}
function _objectSpread(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
			_defineProperty(e, r, t[r]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
			Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
		});
	}
	return e;
}
function _defineProperty(obj, key, value) {
	key = _toPropertyKey(key);
	if (key in obj) Object.defineProperty(obj, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
	else obj[key] = value;
	return obj;
}
function _toPropertyKey(arg) {
	var key = _toPrimitive(arg, "string");
	return _typeof(key) === "symbol" ? key : String(key);
}
function _toPrimitive(input, hint) {
	if (_typeof(input) !== "object" || input === null) return input;
	var prim = input[Symbol.toPrimitive];
	if (prim !== void 0) {
		var res = prim.call(input, hint || "default");
		if (_typeof(res) !== "object") return res;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return (hint === "string" ? String : Number)(input);
}
/**
* Reads data from an `.xlsx` file.
* @param  {function} parseXml — SAX XML parser.
* @param  {Record<string,Uint8Array>} contents - A map of `.xml` files inside the `.xlsx` file (which itself is just a zipped directory).
* @param  {object} [options]
* @return {Promise<Sheet[]>}
*/
function parseSpreadsheetContents(parseXml, contents_) {
	var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
	var contents = convertValuesFromUint8ArraysToStrings(contents_);
	checkpoint("parse spreadsheet info and file paths");
	return readFiles(getXmlFilesAtFixedPaths(), contents, parseXml).then(function(_ref) {
		var spreadsheetInfo = _ref.spreadsheetInfo, filePaths = _ref.filePaths;
		checkpoint("parse \"shared strings\" and \"styles\"");
		return readFiles(getXmlFilesAtNonFixedPaths(filePaths), contents, parseXml).then(function(_ref2) {
			var sharedStrings = _ref2.sharedStrings, styles = _ref2.styles;
			var sheetRelationIdsToRead = options.sheets ? options.sheets.map(function(sheet) {
				return getSheetRelationId(sheet, spreadsheetInfo.sheets);
			}) : spreadsheetInfo.sheets.map(function(_) {
				return _.relationId;
			});
			checkpoint("parse sheet".concat(sheetRelationIdsToRead.length === 1 ? "" : "s", " data"));
			return readFiles(getSheetDataXmlFiles(filePaths, sheetRelationIdsToRead, {
				sharedStrings,
				styles,
				epoch1904: spreadsheetInfo.epoch1904,
				dateFormatDetectionCache: [],
				options
			}), contents, parseXml).then(function(sheetsData) {
				checkpoint("end");
				return sheetRelationIdsToRead.map(function(sheetRelationId) {
					return {
						sheet: getSheetNameByRelationId(sheetRelationId, spreadsheetInfo.sheets),
						data: sheetsData[sheetRelationId]
					};
				});
			});
		});
	});
}
/**
* Reads data from an `.xlsx` file in a worker.
* @param  {function} [createWorkerFunction] — Creates a worker function. Not used.
* @param  {function} parseXml — SAX XML parser.
* @param  {Record<string,Uint8Array>} contents - A map of `.xml` files inside the `.xlsx` file (which itself is just a zipped directory).
* @param  {object} [options]
* @return {Promise<Sheet[]>}
*/
function parseSpreadsheetContentsInWorker(createWorkerFunction, parseXml, contents, options) {
	if (!(options && options.parseNumber)) options = _objectSpread(_objectSpread({}, options), {}, { parseNumber: null });
	return parseSpreadsheetContents(parseXml, contents, options);
}
function getSheetRelationId(sheet, sheets) {
	if (typeof sheet === "string") for (var _iterator = _createForOfIteratorHelperLoose(sheets), _step; !(_step = _iterator()).done;) {
		var _sheet = _step.value;
		if (_sheet.name === sheet) return _sheet.relationId;
	}
	else if (sheet <= sheets.length) return sheets[sheet - 1].relationId;
	throw new SheetNotFoundError(sheet, sheets.map(function(_) {
		return _.name;
	}));
}
function getSheetNameByRelationId(sheetRelationId, sheets) {
	for (var _iterator2 = _createForOfIteratorHelperLoose(sheets), _step2; !(_step2 = _iterator2()).done;) {
		var sheet = _step2.value;
		if (sheet.relationId === sheetRelationId) return sheet.name;
	}
	throw new Error("Sheet relation ID not found: ".concat(sheetRelationId));
}
function getXmlFilesAtFixedPaths() {
	return {
		"xl/_rels/workbook.xml.rels": {
			name: "filePaths",
			parse: parseFilePaths
		},
		"xl/workbook.xml": {
			name: "spreadsheetInfo",
			parse: parseSpreadsheetInfo
		}
	};
}
function getXmlFilesAtNonFixedPaths(filePaths) {
	var _ref3 = {};
	return _defineProperty(_ref3, filePaths.sharedStrings || "xl/sharedStrings.xml", {
		name: "sharedStrings",
		parse: parseSharedStrings,
		fallback: Promise.resolve([])
	}), _defineProperty(_ref3, filePaths.styles || "xl/styles.xml", {
		name: "styles",
		parse: parseStyles,
		fallback: {}
	}), _ref3;
}
function getSheetDataXmlFiles(filePaths, sheetRelationIdsToRead, sheetDataParserParameters) {
	return Object.keys(filePaths.sheets).filter(function(sheetRelationId) {
		return sheetRelationIdsToRead.includes(sheetRelationId);
	}).reduce(function(filesInfo, sheetRelationId) {
		return _objectSpread(_objectSpread({}, filesInfo), {}, _defineProperty({}, filePaths.sheets[sheetRelationId], {
			name: sheetRelationId,
			parse: function parse(content, parseXml) {
				return parseSheet(content, parseXml, sheetDataParserParameters);
			}
		}));
	}, {});
}
function readFiles(filesInfo, contents, parseXml) {
	var results = {};
	var _loop = function _loop() {
		var filePath = _Object$keys[_i];
		var fileInfo = filesInfo[filePath];
		results[fileInfo.name] = contents[filePath] === void 0 ? fileInfo.fallback === void 0 ? function() {
			throw new InvalidSpreadsheetError("\"".concat(filePath, "\" file not found inside the `.xlsx` file"));
		}() : fileInfo.fallback : fileInfo.parse(contents[filePath], parseXml);
	};
	for (var _i = 0, _Object$keys = Object.keys(filesInfo); _i < _Object$keys.length; _i++) _loop();
	var promises = [];
	var _loop2 = function _loop2() {
		var name = _Object$keys2[_i2];
		if (isPromise(results[name])) promises.push(results[name].then(function(result) {
			results[name] = result;
		}));
	};
	for (var _i2 = 0, _Object$keys2 = Object.keys(results); _i2 < _Object$keys2.length; _i2++) _loop2();
	if (promises.length > 0) return Promise.all(promises).then(function() {
		return results;
	});
	return results;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/readXlsxFileNode.js
/**
* Reads an `.xlsx` file.
* @param  {(string|Stream|Buffer|Blob)} input
* @param  {object} [options]
* @return {Promise<Sheet[]>}
*/
function readXlsxFile(input, options) {
	return unpackXlsxFile(input).then(function(contents) {
		return parseSpreadsheetContentsInWorker(createWorkerFunctionInNode, parseXml, contents, options);
	});
}
//#endregion
//#region electron/main/import/legacy_excel.ts
var COLUMNS = {
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	folio: 3,
	numero_registro: 4,
	nombres: 6,
	apellido_paterno: 7,
	apellido_materno: 8,
	fecha_nacimiento: 9,
	fecha_nacimiento_aprox: 10,
	lugar_nacimiento: 11,
	fecha_sacramento: 12,
	fecha_sacramento_aprox: 13,
	lugar_matrimonio: 14,
	dni: 15,
	padre: 16,
	madre: 17,
	fecha_bautizo_novio: 20,
	fecha_bautizo_novio_aprox: 21,
	parroquia_bautizo_novio: 22,
	celebrante: 23,
	anotacion_marginal: 24,
	padrino: 25,
	madrina: 26,
	novia_nombres: 27,
	novia_apellido_paterno: 28,
	novia_apellido_materno: 29,
	novia_fecha_nacimiento: 30,
	novia_fecha_nacimiento_aprox: 31,
	novia_lugar_nacimiento: 32,
	novia_padre: 33,
	novia_madre: 34,
	novia_dni: 35,
	fecha_bautizo_novia: 36,
	fecha_bautizo_novia_aprox: 37,
	parroquia_bautizo_novia: 38,
	testigo_3: 39,
	testigo_4: 40,
	fecha_ingreso: 42
};
var RECORDS_SHEET = "feligres";
var BOOKS_SHEET = "parroquialibros";
var RECORDS_HEADER = [
	"COD PARROQUIA",
	"TIPO LIBRO",
	"NUM LIBRO",
	"FOLIO",
	"NUMERO REGISTRO",
	null,
	"NOMBRES",
	"APELLIDO PATERNO",
	"APELLIDO MATERNO",
	"FECHA NACIMIENTO",
	"FECHA NAC APROX",
	"LUGAR NACIMIENTO",
	"FECHA DE SACRAMENTO",
	"FECHA SACRAMENTO APROX",
	"LUGAR DE MATRIMONIO",
	"DNI",
	"PADRE",
	"MADRE",
	null,
	null,
	"FECHA DE BAUTIZO NOVIO",
	"FECHA DE BAUTIZO NOVIO APROX",
	"PARROQUIA DE BAUTIZO",
	"CELEBRANTE",
	"ANOTACION MARGINAL",
	"PADRINO (TESTIGO 1)",
	"MADRINA (TESTIGO 2)",
	"NOMBRES DE LA NOVIA",
	"APELLIDO PATERNO NOVIA",
	"APELLIDO MATERNO NOVIA",
	"FECHA NACIMIENTO NOVIA",
	"FECHA NACIMIENTO NOVIA APROX",
	"LUGAR DE NACIMIENTO NOVIA",
	"PAPA DE LA NOVIA",
	"MAMA DE LA NOVIA",
	"DNI NOVIA",
	"FECHA BAUTIZO NOVIA",
	"FECHA BAUTIZO NOVIA APROX",
	"PARROQUIA DE BAUTIZO NOVIA",
	"TESTIGO 3",
	"TESTIGO 4",
	null,
	"FECHA INGRESO DATOS",
	"ULTIMA MODIFICACION",
	"ULTIMA IMPRESION"
];
var BOOKS_HEADER = [
	"COD PARROQUIA",
	"TIPO DE LIBRO",
	"NUM LIBRO",
	"NOMBRE DE LIBRO",
	"RANGO DE AÑOS DEL LIBRO"
];
var BOOK_COLUMNS = {
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	nombre_libro: 3
};
var FormatError = class extends Error {};
var TYPES = {
	B: "bautismo",
	C: "confirmacion",
	M: "matrimonio"
};
function book_key(type_letter, number) {
	return `${type_letter.trim().toUpperCase()}|${number.trim()}`;
}
function clean_cell(value) {
	if (value === null || value === void 0) return null;
	const text = String(value).trim();
	if (text === "" || /^-+$/.test(text)) return null;
	return text;
}
function pad(number) {
	return String(number).padStart(2, "0");
}
function date_cell(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
	const text = clean_cell(value);
	if (!text) return null;
	const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
	const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
	if (local) return `${local[3]}-${pad(Number(local[2]))}-${pad(Number(local[1]))}`;
	return null;
}
function date_or_text(value) {
	const date = date_cell(value);
	if (date) return {
		date,
		text: null
	};
	return {
		date: null,
		text: clean_cell(value)
	};
}
var TITLES_WITHOUT_DOT = [
	"PBRO",
	"P",
	"RP",
	"MONS",
	"FR",
	"FRAY",
	"HNO",
	"HNA",
	"PADRE",
	"DIAC",
	"OBISPO"
];
function is_title(word) {
	if (/\.$/.test(word)) return true;
	return TITLES_WITHOUT_DOT.includes(word.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
}
function split_minister(value) {
	const text = clean_cell(value);
	if (!text) return null;
	const words = text.split(/\s+/);
	let title = null;
	if (words.length > 1 && is_title(words[0])) title = words.shift();
	if (words.length === 1) return {
		titulo: title,
		nombre: words[0],
		apellido_paterno: "",
		apellido_materno: ""
	};
	if (words.length === 2) return {
		titulo: title,
		nombre: words[0],
		apellido_paterno: words[1],
		apellido_materno: ""
	};
	return {
		titulo: title,
		nombre: words.slice(0, -2).join(" "),
		apellido_paterno: words[words.length - 2],
		apellido_materno: words[words.length - 1]
	};
}
function is_header(row) {
	const code = row[COLUMNS.codigo_parroquia];
	return typeof code === "string" && !/^\d+$/.test(code.trim());
}
function header_text(value) {
	return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function data_rows(rows, sheet, header) {
	if (rows.length === 0) throw new FormatError(`La hoja "${sheet}" está vacía.`);
	const result = [];
	rows.forEach((row, index) => {
		if (row.length !== header.length) throw new FormatError(`La hoja "${sheet}" debe tener ${header.length} columnas y tiene ${row.length}. El archivo no es el exportado por el sistema anterior.`);
		if (index === 0 && is_header(row)) {
			header.forEach((name, column) => {
				if (header_text(row[column]) !== header_text(name)) throw new FormatError(`El encabezado de la hoja "${sheet}" no es el del sistema anterior: la columna ${column + 1} dice "${row[column] ?? ""}" y debería decir "${name ?? ""}".`);
			});
			return;
		}
		if (row.every((cell) => clean_cell(cell) === null)) return;
		result.push({
			row,
			fila: index + 1
		});
	});
	return result;
}
function check_parish_code(row, column, sheet, file_row, expected) {
	const code = clean_cell(row[column]);
	if (!code || !/^\d+$/.test(code)) throw new FormatError(`La fila ${file_row} de la hoja "${sheet}" no tiene un código de parroquia válido.`);
	if (expected !== null && code !== expected) throw new FormatError(`El archivo trae partidas de más de una parroquia (códigos ${expected} y ${code}). Debe ser el de una sola parroquia.`);
	return code;
}
function check_type_letter(row, column, sheet, file_row) {
	const letter = String(row[column] ?? "").trim().toUpperCase();
	if (!TYPES[letter]) throw new FormatError(`En la fila ${file_row} de la hoja "${sheet}" el tipo de libro no es B, C ni M: las columnas no son las del sistema anterior.`);
	return letter;
}
function read_books(rows) {
	const books = /* @__PURE__ */ new Map();
	let code = null;
	for (const { row, fila } of data_rows(rows, BOOKS_SHEET, BOOKS_HEADER)) {
		code = check_parish_code(row, BOOK_COLUMNS.codigo_parroquia, BOOKS_SHEET, fila, code);
		const letter = check_type_letter(row, BOOK_COLUMNS.tipo_libro, BOOKS_SHEET, fila);
		const number = clean_cell(row[BOOK_COLUMNS.num_libro]);
		if (!number) throw new FormatError(`La fila ${fila} de la hoja "${BOOKS_SHEET}" no tiene el número del libro.`);
		books.set(book_key(letter, number), clean_cell(row[BOOK_COLUMNS.nombre_libro]) ?? number);
	}
	return {
		codigo_parroquia: code,
		libros: books
	};
}
function read_person(row, columns) {
	const birth = date_or_text(row[columns.fecha_nacimiento]);
	const approximate = clean_cell(row[columns.fecha_aproximada]);
	return {
		dni: clean_cell(row[columns.dni]),
		nombres: clean_cell(row[columns.nombres]) ?? "",
		apellido_paterno: clean_cell(row[columns.apellido_paterno]) ?? "",
		apellido_materno: clean_cell(row[columns.apellido_materno]) ?? "",
		fecha_nacimiento: birth.date,
		fecha_aproximada: approximate ?? birth.text,
		lugar_nacimiento: clean_cell(row[columns.lugar_nacimiento]),
		padre: clean_cell(row[columns.padre]),
		madre: clean_cell(row[columns.madre])
	};
}
var GROOM = {
	dni: COLUMNS.dni,
	nombres: COLUMNS.nombres,
	apellido_paterno: COLUMNS.apellido_paterno,
	apellido_materno: COLUMNS.apellido_materno,
	fecha_nacimiento: COLUMNS.fecha_nacimiento,
	fecha_aproximada: COLUMNS.fecha_nacimiento_aprox,
	lugar_nacimiento: COLUMNS.lugar_nacimiento,
	padre: COLUMNS.padre,
	madre: COLUMNS.madre
};
var BRIDE = {
	dni: COLUMNS.novia_dni,
	nombres: COLUMNS.novia_nombres,
	apellido_paterno: COLUMNS.novia_apellido_paterno,
	apellido_materno: COLUMNS.novia_apellido_materno,
	fecha_nacimiento: COLUMNS.novia_fecha_nacimiento,
	fecha_aproximada: COLUMNS.novia_fecha_nacimiento_aprox,
	lugar_nacimiento: COLUMNS.novia_lugar_nacimiento,
	padre: COLUMNS.novia_padre,
	madre: COLUMNS.novia_madre
};
function notes_of(row, extra) {
	const notes = [];
	const marginal = clean_cell(row[COLUMNS.anotacion_marginal]);
	if (marginal && marginal.toUpperCase() !== "NINGUNA") notes.push(marginal);
	notes.push(...extra);
	if (notes.length === 0) return null;
	return notes.join("\n");
}
function read_row(row, file_row, books, today) {
	const type_letter = String(row[COLUMNS.tipo_libro] ?? "").trim().toUpperCase();
	const type = TYPES[type_letter];
	if (!type) return {
		fila: file_row,
		motivo: "El tipo de libro no es B, C ni M."
	};
	const book = clean_cell(row[COLUMNS.num_libro]);
	const page = clean_cell(row[COLUMNS.folio]);
	const number = clean_cell(row[COLUMNS.numero_registro]);
	if (!book || !page || !number) return {
		fila: file_row,
		motivo: "Falta el libro, el folio o el número de registro."
	};
	const book_name = books.get(book_key(type_letter, book));
	if (!book_name) return {
		fila: file_row,
		motivo: `El libro ${type_letter} ${book} no está en la hoja "${BOOKS_SHEET}".`
	};
	const groom = read_person(row, GROOM);
	if (!groom.nombres) return {
		fila: file_row,
		motivo: "Falta el nombre."
	};
	const extra = [];
	const event = date_or_text(row[COLUMNS.fecha_sacramento]);
	const event_approximate = clean_cell(row[COLUMNS.fecha_sacramento_aprox]) ?? event.text;
	if (!event.date && event_approximate) extra.push(`Fecha aproximada del sacramento: ${event_approximate}`);
	const people = [groom];
	let detail = {
		padrino_1: clean_cell(row[COLUMNS.padrino]),
		padrino_2: clean_cell(row[COLUMNS.madrina])
	};
	if (type === "matrimonio") {
		const bride = read_person(row, BRIDE);
		if (!bride.nombres) return {
			fila: file_row,
			motivo: "Falta el nombre de la novia."
		};
		people.push(bride);
		const groom_baptism = date_or_text(row[COLUMNS.fecha_bautizo_novio]);
		const bride_baptism = date_or_text(row[COLUMNS.fecha_bautizo_novia]);
		const groom_approximate = clean_cell(row[COLUMNS.fecha_bautizo_novio_aprox]) ?? groom_baptism.text;
		const bride_approximate = clean_cell(row[COLUMNS.fecha_bautizo_novia_aprox]) ?? bride_baptism.text;
		if (!groom_baptism.date && groom_approximate) extra.push(`Fecha aproximada del bautizo del esposo: ${groom_approximate}`);
		if (!bride_baptism.date && bride_approximate) extra.push(`Fecha aproximada del bautizo de la esposa: ${bride_approximate}`);
		detail = {
			lugar: clean_cell(row[COLUMNS.lugar_matrimonio]),
			testigo_1: clean_cell(row[COLUMNS.padrino]),
			testigo_2: clean_cell(row[COLUMNS.madrina]),
			testigo_3: clean_cell(row[COLUMNS.testigo_3]),
			testigo_4: clean_cell(row[COLUMNS.testigo_4]),
			conyuge_1_bautismo_parroquia: clean_cell(row[COLUMNS.parroquia_bautizo_novio]),
			conyuge_1_bautismo_fecha: groom_baptism.date,
			conyuge_2_bautismo_parroquia: clean_cell(row[COLUMNS.parroquia_bautizo_novia]),
			conyuge_2_bautismo_fecha: bride_baptism.date
		};
	}
	return {
		fila: file_row,
		codigo_parroquia: clean_cell(row[COLUMNS.codigo_parroquia]),
		tipo: type,
		libro: book_name,
		folio: page,
		numero: number,
		fecha_emision: date_cell(row[COLUMNS.fecha_ingreso]) ?? event.date ?? today,
		fecha_evento: event.date,
		anotaciones: notes_of(row, extra),
		celebrante: split_minister(row[COLUMNS.celebrante]),
		personas: people,
		detalle: detail
	};
}
function register_key(record) {
	return [
		record.tipo,
		record.libro,
		record.folio,
		record.numero
	].map((part) => part.trim().toUpperCase()).join("|");
}
function read_rows(rows, books, today) {
	const records = [];
	const errors = [];
	const seen = /* @__PURE__ */ new Map();
	const rows_with_data = data_rows(rows, RECORDS_SHEET, RECORDS_HEADER);
	let code = books.codigo_parroquia;
	for (const { row, fila } of rows_with_data) {
		code = check_parish_code(row, COLUMNS.codigo_parroquia, RECORDS_SHEET, fila, code);
		check_type_letter(row, COLUMNS.tipo_libro, RECORDS_SHEET, fila);
	}
	for (const { row, fila } of rows_with_data) {
		const result = read_row(row, fila, books.libros, today);
		if ("motivo" in result) {
			errors.push(result);
			continue;
		}
		const key = register_key(result);
		const first = seen.get(key);
		if (first !== void 0) {
			errors.push({
				fila,
				motivo: `Repite la partida de la fila ${first}.`
			});
			continue;
		}
		seen.set(key, fila);
		records.push(result);
	}
	return {
		partidas: records,
		errores: errors
	};
}
function find_sheet(sheets, name) {
	const found = sheets.find((item) => item.sheet.trim().toLowerCase() === name);
	if (!found) throw new FormatError(`El archivo no tiene la hoja "${name}". Debe ser el Excel exportado por el sistema anterior, sin cambios.`);
	return found.data;
}
function read_workbook(sheets, today) {
	const books = read_books(find_sheet(sheets, BOOKS_SHEET));
	return read_rows(find_sheet(sheets, RECORDS_SHEET), books, today);
}
//#endregion
//#region electron/main/controllers/legacy_import.ts
var ONLY_ADMIN = "Solo el administrador de la parroquia puede importar partidas.";
function import_parish(session) {
	if (session.role !== "admin_parroquia" || !session.parish_id) throw new ServiceError(ONLY_ADMIN, 403);
	return session.parish_id;
}
function full_name(person) {
	return [
		person.nombres,
		person.apellido_paterno,
		person.apellido_materno
	].filter((part) => part).join(" ");
}
function plan_import(db, parish_id, parsed) {
	const saved = db.prepare("SELECT tipo, libro, folio, numero FROM sacramentos WHERE parroquia_id = ?").all(parish_id);
	const saved_keys = new Set(saved.map(register_key));
	const plan = {
		nuevas: [],
		existentes: [],
		errores: parsed.errores
	};
	for (const record of parsed.partidas) {
		if (!saved_keys.has(register_key(record))) {
			plan.nuevas.push(record);
			continue;
		}
		plan.existentes.push({
			fila: record.fila,
			tipo: record.tipo,
			libro: record.libro,
			folio: record.folio,
			numero: record.numero,
			nombre: record.personas.map(full_name).join(" y ")
		});
	}
	return plan;
}
function normalize(text) {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function minister_key(minister) {
	return normalize([
		minister.nombre,
		minister.apellido_paterno,
		minister.apellido_materno
	].filter((part) => part).join(" "));
}
function minister_finder(db, parish_id) {
	const known = /* @__PURE__ */ new Map();
	const rows = db.prepare("SELECT id, nombre, apellido_paterno, apellido_materno FROM ministros WHERE parroquia_id = ?").all(parish_id);
	for (const row of rows) known.set(minister_key(row), row.id);
	const insert = db.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)");
	return (minister) => {
		if (!minister) return null;
		const key = minister_key(minister);
		const found = known.get(key);
		if (found !== void 0) return found;
		const client_id = crypto.randomUUID();
		add_to_queue(db, "ministro", client_id, null);
		const id = Number(insert.run(client_id, parish_id, minister.titulo, minister.nombre, minister.apellido_paterno, minister.apellido_materno).lastInsertRowid);
		known.set(key, id);
		return id;
	};
}
function as_person(person) {
	return {
		...person,
		cambios: []
	};
}
function save_record(db, session, parish_id, record, minister_id) {
	const people_ids = record.personas.map((person) => insert_person(db, parish_id, as_person(person)));
	const sacrament = {
		tipo: record.tipo,
		ministro_id: minister_id,
		libro: record.libro,
		folio: record.folio,
		numero: record.numero,
		fecha_emision: record.fecha_emision,
		fecha_evento: record.fecha_evento,
		anotaciones: record.anotaciones
	};
	const client_id = crypto.randomUUID();
	add_to_queue(db, record.tipo, client_id, null);
	const sacrament_id = insert_sacrament(db, client_id, record.tipo, parish_id, sacrament);
	add_history(db, sacrament_id, session.user_id, "importada", [], `Fila ${record.fila} del Excel del sistema anterior`);
	const detail = record.detalle;
	if (record.tipo === "matrimonio") {
		db.prepare(`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sacrament_id, people_ids[0], people_ids[1], detail.lugar, detail.testigo_1, detail.testigo_2, detail.testigo_3, detail.testigo_4, detail.conyuge_1_bautismo_parroquia, detail.conyuge_1_bautismo_fecha, detail.conyuge_2_bautismo_parroquia, detail.conyuge_2_bautismo_fecha);
		return;
	}
	db.prepare(`INSERT INTO ${detail_table(record.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(sacrament_id, people_ids[0], detail.padrino_1, detail.padrino_2);
}
function save_import(db, session, records) {
	const parish_id = import_parish(session);
	return db.transaction(() => {
		const plan = plan_import(db, parish_id, {
			partidas: records,
			errores: []
		});
		const find_minister = minister_finder(db, parish_id);
		for (const record of plan.nuevas) save_record(db, session, parish_id, record, find_minister(record.celebrante));
		return {
			importadas: plan.nuevas.length,
			omitidas: plan.existentes.length
		};
	})();
}
var pending = null;
function today() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function read_legacy_file(file_path) {
	let sheets;
	try {
		sheets = await readXlsxFile(file_path);
	} catch {
		throw new ServiceError("No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) exportado del sistema anterior.", 400);
	}
	try {
		return read_workbook(sheets, today());
	} catch (error) {
		if (error instanceof FormatError) throw new ServiceError(error.message, 400);
		throw error;
	}
}
function preview_of(file_name, plan) {
	const by_type = {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
	for (const record of plan.nuevas) by_type[record.tipo] += 1;
	const codes = /* @__PURE__ */ new Set();
	for (const record of [...plan.nuevas]) if (record.codigo_parroquia) codes.add(record.codigo_parroquia);
	return {
		archivo: file_name,
		codigos_parroquia: [...codes],
		total: plan.nuevas.length + plan.existentes.length,
		nuevas: plan.nuevas.length,
		por_tipo: by_type,
		existentes: plan.existentes,
		errores: plan.errores
	};
}
var legacy_import_routes = {
	"legacyImport.preview": async (_payload, { db, session }) => {
		const parish_id = import_parish(session);
		const window = BrowserWindow.getFocusedWindow();
		const options = {
			title: "Elegir el Excel del sistema anterior",
			properties: ["openFile"],
			filters: [{
				name: "Excel",
				extensions: ["xlsx"]
			}]
		};
		const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
		if (choice.canceled || choice.filePaths.length === 0) return { cancelado: true };
		const file_path = choice.filePaths[0];
		const plan = plan_import(db, parish_id, await read_legacy_file(file_path));
		pending = {
			token: crypto.randomUUID(),
			parish_id,
			records: plan.nuevas
		};
		return {
			cancelado: false,
			token: pending.token,
			...preview_of(file_path.split(/[\\/]/).pop() ?? file_path, plan)
		};
	},
	"legacyImport.confirm": (payload, { db, session }) => {
		if (!pending || payload?.token !== pending.token || pending.parish_id !== session.parish_id) throw new ServiceError("Vuelva a elegir el archivo: la vista previa ya no es válida.", 409);
		const records = pending.records;
		pending = null;
		return save_import(db, session, records);
	}
};
//#endregion
//#region electron/shared/index.ts
var LOCAL_REQUEST_CHANNEL = "local:request";
var OFFLINE_TOKEN = "sin-conexion";
//#endregion
//#region electron/main/utils/crypto.ts
var KEY_LENGTH = 32;
var HASH_LENGTH = 32;
var SALT_LENGTH = 16;
var COST = {
	N: 2 ** 15,
	r: 8,
	p: 1,
	maxmem: 67108864
};
function new_key() {
	return randomBytes(KEY_LENGTH).toString("hex");
}
function compute_hash(password, salt, options, length) {
	return new Promise((resolve, reject) => {
		scrypt(password.normalize("NFKC"), salt, length, options, (error, hash) => {
			if (error) reject(error);
			else resolve(hash);
		});
	});
}
async function create_verifier(password) {
	const salt = randomBytes(SALT_LENGTH);
	const hash = await compute_hash(password, salt, COST, HASH_LENGTH);
	return `scrypt:${COST.N}:${COST.r}:${COST.p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}
var SERVER_ITERATIONS = 1e5;
var SERVER_HASH_BITS = 256;
function compute_server_hash(password, salt, iterations) {
	return new Promise((resolve, reject) => {
		pbkdf2(password, salt, iterations, SERVER_HASH_BITS / 8, "sha256", (error, hash) => {
			if (error) reject(error);
			else resolve(hash);
		});
	});
}
async function create_server_hash(password) {
	const salt = randomBytes(SALT_LENGTH);
	const hash = await compute_server_hash(password, salt, SERVER_ITERATIONS);
	return `${SERVER_ITERATIONS}:${salt.toString("base64")}:${hash.toString("base64")}`;
}
async function matches_server_hash(password, stored) {
	const [iterations, salt, hash] = stored.split(":");
	if (!/^\d+$/.test(iterations ?? "") || !salt || !hash) return false;
	const expected = Buffer.from(hash, "base64");
	const actual = await compute_server_hash(password, Buffer.from(salt, "base64"), Number(iterations));
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function matches_verifier(password, verifier) {
	if (!verifier.startsWith("scrypt:")) return matches_server_hash(password, verifier);
	const [, n, r, p, salt, hash] = verifier.split(":");
	if (!salt || !hash) return false;
	const expected = Buffer.from(hash, "base64");
	const options = {
		N: Number(n),
		r: Number(r),
		p: Number(p),
		maxmem: COST.maxmem
	};
	const actual = await compute_hash(password, Buffer.from(salt, "base64"), options, expected.length);
	return timingSafeEqual(actual, expected);
}
//#endregion
//#region electron/main/db/migrations.ts
var LOCAL_MIGRATIONS = [
	`
  CREATE TABLE parroquias (
    id        INTEGER PRIMARY KEY,
    nombre    TEXT    NOT NULL,
    ubicacion TEXT,
    activa    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE usuarios (
    id               INTEGER PRIMARY KEY,
    parroquia_id     INTEGER REFERENCES parroquias(id),
    username         TEXT    NOT NULL UNIQUE,
    rol              TEXT    NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE ministros (
    id               INTEGER PRIMARY KEY,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    titulo           TEXT,
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE personas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id        TEXT    NOT NULL UNIQUE,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    dni              TEXT    CHECK (dni IS NULL OR dni <> ''),
    nombres          TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL DEFAULT '',
    fecha_nacimiento TEXT,
    edad             INTEGER CHECK (edad IS NULL OR edad >= 0),
    lugar_nacimiento TEXT,
    padre            TEXT,
    madre            TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;
  CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);

  CREATE TABLE sacramentos (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id              TEXT    NOT NULL UNIQUE,
    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),
    ministro_id            INTEGER REFERENCES ministros(id),
    libro                  TEXT    NOT NULL,
    folio                  TEXT    NOT NULL,
    numero                 TEXT    NOT NULL,
    fecha_emision          TEXT    NOT NULL,
    fecha_evento           TEXT,
    anotaciones            TEXT,
    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
    anulado_en             TEXT,
    motivo_anulacion       TEXT,
    version                INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- Permite que cada subtipo enlace (id, tipo): un bautismo no puede colgar de un matrimonio.
    UNIQUE (id, tipo),
    CHECK (
      estado = 'vigente'
      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL
          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')
    )
  );
  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);

  CREATE TABLE matrimonios (
    sacramento_id                INTEGER PRIMARY KEY,
    tipo                         TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),
    conyuge_1_id                 INTEGER NOT NULL REFERENCES personas(id),
    conyuge_2_id                 INTEGER NOT NULL REFERENCES personas(id),
    lugar                        TEXT,
    testigo_1                    TEXT,
    testigo_2                    TEXT,
    testigo_3                    TEXT,
    testigo_4                    TEXT,
    conyuge_1_bautismo_parroquia TEXT,
    conyuge_1_bautismo_fecha     TEXT,
    conyuge_2_bautismo_parroquia TEXT,
    conyuge_2_bautismo_fecha     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),
    CHECK (conyuge_1_id <> conyuge_2_id)
  );
  CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);
  CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);

  CREATE TABLE bautismos (
    sacramento_id INTEGER PRIMARY KEY,
    tipo          TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),
    persona_id    INTEGER NOT NULL REFERENCES personas(id),
    padrino_1     TEXT,
    padrino_2     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
  );
  CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);

  CREATE TABLE confirmaciones (
    sacramento_id INTEGER PRIMARY KEY,
    tipo          TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),
    persona_id    INTEGER NOT NULL REFERENCES personas(id),
    padrino_1     TEXT,
    padrino_2     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
  );
  CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);

  CREATE TABLE cambios_persona (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Evita duplicar la corrección si se reenvía tras un corte de internet.
    client_id      TEXT    NOT NULL UNIQUE,
    persona_id     INTEGER NOT NULL REFERENCES personas(id),
    sacramento_id  INTEGER REFERENCES sacramentos(id),
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
    campo_cambio   TEXT    NOT NULL,
    valor_anterior TEXT,
    valor_nuevo    TEXT,
    fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);

  -- Cada UPDATE sube version, salvo que la sincronización ya la haya fijado.
  CREATE TRIGGER trg_personas_touch
  AFTER UPDATE ON personas
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE personas
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;

  CREATE TRIGGER trg_sacramentos_touch
  AFTER UPDATE ON sacramentos
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE sacramentos
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;
  `,
	`
  CREATE TABLE ministros_nueva (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id        TEXT    NOT NULL UNIQUE,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    titulo           TEXT,
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  INSERT INTO ministros_nueva (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo)
  SELECT id, 'servidor-' || id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo
  FROM ministros;

  DROP TABLE ministros;
  ALTER TABLE ministros_nueva RENAME TO ministros;

  CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);

  CREATE TRIGGER trg_ministros_touch
  AFTER UPDATE ON ministros
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE ministros
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;
  `,
	`
  -- Registros con cambios sin subir. Se envía su estado final, así que basta una fila por registro.
  -- version_base: última versión que conoce el servidor; NULL si el registro aún no existe allí.
  CREATE TABLE sync_cola (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro')),
    client_id    TEXT    NOT NULL,
    version_base INTEGER,
    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (entidad, client_id)
  );

  INSERT INTO sync_cola (entidad, client_id)
  SELECT tipo, client_id FROM sacramentos ORDER BY id;

  INSERT INTO sync_cola (entidad, client_id)
  SELECT 'ministro', client_id FROM ministros ORDER BY id;
  `,
	`
  -- cola_id: identifica la fila mientras siga pendiente, para reconocer un reenvío tras un corte.
  -- revision: sube con cada edición; si cambió durante el envío, la fila no se quita al confirmarse.
  ALTER TABLE sync_cola ADD COLUMN cola_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE sync_cola ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE sync_cola ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'conflicto', 'rechazado'));
  ALTER TABLE sync_cola ADD COLUMN motivo TEXT;
  UPDATE sync_cola SET cola_id = lower(hex(randomblob(16)));

  CREATE TABLE sync_estado (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  -- Verificación para entrar sin internet. Solo existe para quien ya entró con conexión en esta PC.
  CREATE TABLE credenciales_locales (
    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),
    verificador    TEXT NOT NULL,
    actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,
	`
  -- La edad pasa a ser una fecha aproximada en texto libre: los libros traen cosas como
  -- "22 AG 1978" o "(27 AÑOS AL DIA DE BODA)". Las edades que ya había se conservan como "N años".
  ALTER TABLE personas ADD COLUMN fecha_aproximada TEXT;
  UPDATE personas SET fecha_aproximada = edad || ' años' WHERE edad IS NOT NULL;
  ALTER TABLE personas DROP COLUMN edad;
  `,
	`
  -- Tres roles (ver worker/src/db/migrations/0015_roles_y_correcciones.sql):
  --   admin_general, admin_parroquia (el párroco) y usuario (un ayudante).
  -- Un admin sin parroquia pasa a admin_general; las demás cuentas, a admin_parroquia.
  --
  -- Los usuarios ahora se pueden crear y editar en esta PC sin internet y subirse después:
  --   client_id      los identifica ante el servidor (el mismo 'servidor-<id>' que puso su migración).
  --   id negativo    una cuenta creada aquí que el servidor todavía no conoce; al subirla se cambia por el suyo.
  --   password_hash_pendiente   la contraseña cambiada aquí que falta subir (PBKDF2, el formato del
  --                             servidor). Se borra en cuanto el servidor la recibe.
  CREATE TABLE usuarios_nueva (
    id               INTEGER PRIMARY KEY,
    client_id        TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    parroquia_id     INTEGER REFERENCES parroquias(id),
    username         TEXT    NOT NULL UNIQUE,
    rol              TEXT    NOT NULL CHECK (rol IN ('admin_general', 'admin_parroquia', 'usuario')),
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1,
    principal        INTEGER NOT NULL DEFAULT 0,
    password_hash_pendiente TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  INSERT INTO usuarios_nueva (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
  SELECT id, 'servidor-' || id, parroquia_id, username,
         CASE WHEN rol = 'admin' AND parroquia_id IS NULL THEN 'admin_general' ELSE 'admin_parroquia' END,
         nombre, apellido_paterno, apellido_materno, activo
  FROM usuarios;

  DROP TABLE usuarios;
  ALTER TABLE usuarios_nueva RENAME TO usuarios;

  CREATE TRIGGER trg_usuarios_touch
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE usuarios
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;

  -- Una corrección pedida por un usuario queda 'pendiente' hasta que el admin_parroquia la revise.
  ALTER TABLE cambios_persona ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
  ALTER TABLE cambios_persona ADD COLUMN revisado_por_usuario_id INTEGER REFERENCES usuarios(id);
  ALTER TABLE cambios_persona ADD COLUMN revisado_en TEXT;

  -- La cola también lleva usuarios.
  CREATE TABLE sync_cola_nueva (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro', 'usuario')),
    client_id    TEXT    NOT NULL,
    version_base INTEGER,
    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    cola_id      TEXT    NOT NULL DEFAULT '',
    revision     INTEGER NOT NULL DEFAULT 1,
    estado       TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'conflicto', 'rechazado')),
    motivo       TEXT,
    UNIQUE (entidad, client_id)
  );

  INSERT INTO sync_cola_nueva (id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo)
  SELECT id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo FROM sync_cola;

  DROP TABLE sync_cola;
  ALTER TABLE sync_cola_nueva RENAME TO sync_cola;
  `,
	`
  ALTER TABLE sacramentos ADD COLUMN anotaciones_propuestas TEXT;
  `,
	`
  CREATE TABLE solicitudes_cambio (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id               TEXT    NOT NULL UNIQUE,
    sacramento_id           INTEGER NOT NULL REFERENCES sacramentos(id),
    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
    parte                   TEXT    NOT NULL CHECK (parte IN ('sacramento', 'persona', 'conyuge_1', 'conyuge_2', 'detalle')),
    campo                   TEXT    NOT NULL,
    tipo                    TEXT    NOT NULL CHECK (tipo IN ('digitacion', 'nota_marginal')),
    valor_anterior          TEXT,
    valor_nuevo             TEXT,
    estado                  TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'descartado')),
    motivo                  TEXT,
    revisado_por_usuario_id INTEGER REFERENCES usuarios(id),
    revisado_en             TEXT,
    creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX idx_solicitudes_sacramento ON solicitudes_cambio (sacramento_id);

  CREATE TABLE historial_partidas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     TEXT    NOT NULL UNIQUE,
    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',
                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada')),
    motivo        TEXT,
    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);

  CREATE TABLE historial_campos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    historial_id   INTEGER NOT NULL REFERENCES historial_partidas(id),
    parte          TEXT    NOT NULL,
    campo          TEXT    NOT NULL,
    valor_anterior TEXT,
    valor_nuevo    TEXT
  );

  CREATE INDEX idx_historial_campos ON historial_campos (historial_id);

  -- Las correcciones de nombres pendientes: la misma client_id que tenían.
  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
  SELECT
    c.client_id,
    c.sacramento_id,
    c.usuario_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_1_id = c.persona_id) THEN 'conyuge_1'
      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_2_id = c.persona_id) THEN 'conyuge_2'
      ELSE 'persona'
    END,
    c.campo_cambio,
    'nota_marginal',
    c.valor_anterior,
    c.valor_nuevo,
    c.fecha_cambio
  FROM cambios_persona c
  WHERE c.estado = 'pendiente' AND c.sacramento_id IS NOT NULL;

  -- La nota propuesta: la pidió quien pidió la corrección que iba con ella.
  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
  SELECT
    s.client_id || '-nota',
    s.id,
    c.usuario_id,
    'sacramento',
    'anotaciones',
    'digitacion',
    s.anotaciones,
    s.anotaciones_propuestas,
    c.fecha_cambio
  FROM sacramentos s
  JOIN cambios_persona c ON c.id = (SELECT MIN(id) FROM cambios_persona WHERE sacramento_id = s.id AND estado = 'pendiente')
  WHERE s.anotaciones_propuestas IS NOT NULL;

  DELETE FROM cambios_persona WHERE estado = 'pendiente';

  ALTER TABLE sacramentos DROP COLUMN anotaciones_propuestas;
  `,
	`
  UPDATE usuarios SET principal = 1
  WHERE id IN (
    SELECT MIN(a.id) FROM usuarios a
    WHERE a.rol = 'admin_parroquia' AND a.activo = 1 AND a.id > 0
      AND NOT EXISTS (SELECT 1 FROM usuarios p WHERE p.principal = 1 AND p.parroquia_id = a.parroquia_id)
    GROUP BY a.parroquia_id
  );
  `
];
//#endregion
//#region electron/main/db/database.ts
var HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;
var NewerDatabaseError = class extends Error {};
function migrate(db, migrations) {
	const current_version = db.pragma("user_version", { simple: true });
	if (current_version > migrations.length) throw new NewerDatabaseError(`La base local está en la versión ${current_version} y esta app solo conoce hasta la ${migrations.length}.`);
	db.pragma("foreign_keys = OFF");
	for (let i = current_version; i < migrations.length; i++) db.transaction(() => {
		db.exec(migrations[i]);
		if (db.pragma("foreign_key_check").length > 0) throw new Error("La migración dejó claves foráneas rotas.");
		db.pragma(`user_version = ${i + 1}`);
	})();
	db.pragma("foreign_keys = ON");
}
function open_local_database(file_path, hex_key, migrations = LOCAL_MIGRATIONS) {
	if (!HEX_KEY_PATTERN.test(hex_key)) throw new Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	const db = new Database(file_path);
	try {
		db.pragma(`cipher='chacha20'`);
		db.pragma(`hexkey='${hex_key}'`);
		db.prepare("SELECT count(*) FROM sqlite_master").get();
		db.pragma("foreign_keys = ON");
		db.pragma("journal_mode = WAL");
		db.pragma("synchronous = FULL");
		migrate(db, migrations);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}
function is_unreadable(error) {
	const code = error?.code ?? "";
	return code.startsWith("SQLITE_NOTADB") || code.startsWith("SQLITE_CORRUPT");
}
function local_paths(directory) {
	return {
		directory,
		database: path.join(directory, FILE_NAMES.database),
		key: path.join(directory, FILE_NAMES.key),
		device: path.join(directory, FILE_NAMES.device),
		temp_database: path.join(directory, FILE_NAMES.temp_database),
		temp_key: path.join(directory, FILE_NAMES.temp_key),
		set_aside_folder: path.join(directory, FILE_NAMES.set_aside_folder)
	};
}
function device_id(paths) {
	if (existsSync(paths.device)) return readFileSync(paths.device, "utf8").trim();
	const id = randomUUID();
	writeFileSync(paths.device, id);
	return id;
}
function move_with_extra_files(from, to) {
	for (const suffix of [
		"",
		"-wal",
		"-shm"
	]) if (existsSync(from + suffix)) renameSync(from + suffix, to + suffix);
}
function remove_with_extra_files(file) {
	for (const suffix of [
		"",
		"-wal",
		"-shm"
	]) rmSync(file + suffix, { force: true });
}
function clean_set_aside(paths) {
	if (!existsSync(paths.set_aside_folder)) return;
	readdirSync(paths.set_aside_folder).filter((name) => name.endsWith(".db")).sort().reverse().forEach((name, index) => {
		const file = path.join(paths.set_aside_folder, name);
		const too_old = Date.now() - statSync(file).mtimeMs > SET_ASIDE_DAYS_MS;
		if (index > 0 || too_old) remove_with_extra_files(file);
	});
}
function set_aside(paths) {
	if (!existsSync(paths.database)) return;
	mkdirSync(paths.set_aside_folder, { recursive: true });
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	move_with_extra_files(paths.database, path.join(paths.set_aside_folder, `prelatura-local-${stamp}.db`));
	clean_set_aside(paths);
}
function open_or_detect(paths, keys) {
	clean_set_aside(paths);
	const key = keys.read(paths.key);
	if (!existsSync(paths.database)) {
		const created_key = key ?? new_key();
		const db = open_local_database(paths.database, created_key);
		if (!key) keys.write(paths.key, created_key);
		return {
			status: "open",
			db,
			key: created_key
		};
	}
	if (!key) return { status: "needs-recovery" };
	try {
		const db = open_local_database(paths.database, key);
		remove_with_extra_files(paths.temp_database);
		rmSync(paths.temp_key, { force: true });
		return {
			status: "open",
			db,
			key
		};
	} catch (error) {
		if (error instanceof NewerDatabaseError) return {
			status: "failed",
			message: "La base local es de una versión más nueva. Actualice la aplicación."
		};
		if (is_unreadable(error)) return { status: "needs-recovery" };
		throw error;
	}
}
function open_with_key_copy(paths, keys, key) {
	try {
		const db = open_local_database(paths.database, key);
		keys.write(paths.key, key);
		return db;
	} catch (error) {
		if (!is_unreadable(error)) throw error;
		return null;
	}
}
function open_temp_database(paths, keys) {
	let key = keys.read(paths.temp_key);
	if (!key || !existsSync(paths.temp_database)) {
		remove_with_extra_files(paths.temp_database);
		key = new_key();
		keys.write(paths.temp_key, key);
	}
	try {
		return {
			db: open_local_database(paths.temp_database, key),
			key
		};
	} catch (error) {
		if (!is_unreadable(error)) throw error;
		remove_with_extra_files(paths.temp_database);
		return {
			db: open_local_database(paths.temp_database, key),
			key
		};
	}
}
function install_temp_database(paths, keys, key) {
	set_aside(paths);
	move_with_extra_files(paths.temp_database, paths.database);
	keys.write(paths.key, key);
	rmSync(paths.temp_key, { force: true });
	return open_local_database(paths.database, key);
}
//#endregion
//#region electron/main/db/app_database.ts
var database = null;
var database_key = null;
var needs_recovery = false;
var unavailable_message = "La base local no está disponible.";
function check_secure_storage() {
	if (!safeStorage.isEncryptionAvailable()) throw new Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
}
function read_key_file(key_path) {
	check_secure_storage();
	if (!existsSync(key_path)) return null;
	try {
		return safeStorage.decryptString(readFileSync(key_path));
	} catch {
		return null;
	}
}
function write_key_file(key_path, key) {
	check_secure_storage();
	writeFileSync(key_path, safeStorage.encryptString(key), { mode: 384 });
}
var KEY_STORE = {
	read: read_key_file,
	write: write_key_file
};
function database_paths() {
	return local_paths(app.getPath("userData"));
}
function open_at_startup() {
	const result = open_or_detect(database_paths(), KEY_STORE);
	if (result.status === "open") {
		database = result.db;
		database_key = result.key;
	} else if (result.status === "needs-recovery") {
		needs_recovery = true;
		unavailable_message = "La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.";
	} else unavailable_message = result.message;
}
function get_database() {
	if (!database) throw new ServiceError(unavailable_message, 503);
	return database;
}
function current_key() {
	return database_key;
}
function database_needs_recovery() {
	return needs_recovery;
}
function use_database(db, key) {
	database = db;
	database_key = key;
	needs_recovery = false;
}
function close_database() {
	database?.close();
	database = null;
	database_key = null;
}
//#endregion
//#region electron/main/models/session.ts
var session = null;
var saved_login = null;
function require_session() {
	if (!session) throw new ServiceError("Sesión no válida.", 401);
	return session;
}
function current_session() {
	return session;
}
function saved_credentials() {
	return saved_login;
}
function start_session(new_session, username, password) {
	session = new_session;
	saved_login = {
		username,
		password
	};
}
function end_session() {
	session = null;
	saved_login = null;
}
//#endregion
//#region electron/main/utils/logger.ts
function info(...values) {
	console.log(...values);
}
function error(...values) {
	console.error(...values);
}
var DEVELOPMENT_SERVER = "http://localhost:8787";
var cached = null;
function read_config_file(file) {
	if (!existsSync(file)) return null;
	try {
		const content = JSON.parse(readFileSync(file, "utf8"));
		if (typeof content.servidor === "string" && /^https?:\/\/\S+$/.test(content.servidor.trim())) return content.servidor.trim().replace(/\/+$/, "");
		error(`${file}: "servidor" debe ser una dirección que empiece con http:// o https://.`);
	} catch (error$7) {
		error(`No se pudo leer ${file}:`, error$7);
	}
	return null;
}
function installer_folder() {
	if (app.isPackaged) return path.join(process.resourcesPath, "instalador");
	return path.join(app.getAppPath(), "resources", "instalador");
}
function server_url() {
	if (cached) return cached;
	const url = process.env.PRELATURA_API_URL ?? read_config_file(path.join(app.getPath("userData"), "configuracion.json")) ?? read_config_file(path.join(installer_folder(), "configuracion.json")) ?? void 0 ?? DEVELOPMENT_SERVER;
	info(`Servidor: ${url}`);
	cached = url;
	return url;
}
//#endregion
//#region electron/main/sync/online.ts
var CONNECTION_ERROR = "No se pudo conectar con el servidor. Verifique su conexión.";
var remote_request = async (path, options = {}) => {
	const method = options.method ?? "GET";
	const timeout_ms = options.timeoutMs ?? 3e4;
	const headers = {};
	if (options.body !== void 0) headers["Content-Type"] = "application/json";
	if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
	let response;
	let data;
	try {
		response = await fetch(`${server_url()}${path}`, {
			method,
			headers,
			body: options.body === void 0 ? void 0 : JSON.stringify(options.body),
			signal: AbortSignal.timeout(timeout_ms)
		});
		data = await response.json().catch(() => null);
	} catch {
		throw new ServiceError(CONNECTION_ERROR, 0);
	}
	if (!response.ok) throw new ServiceError(data?.message ? String(data.message) : "Ocurrió un error inesperado.", response.status);
	if (data === null) throw new ServiceError(CONNECTION_ERROR, 0);
	return data;
};
function is_connection_error(error) {
	return error instanceof ServiceError && (error.status === 0 || error.status >= 500);
}
function request_login(request, username, password) {
	return request("/api/auth/login", {
		method: "POST",
		body: {
			username,
			password
		},
		timeoutMs: LOGIN_TIMEOUT_MS
	});
}
function get_reference(request, token) {
	return request("/api/reference", { token });
}
function push_changes(request, token, changes) {
	return request("/api/sync/push", {
		method: "POST",
		body: { cambios: changes },
		token
	});
}
function pull_page(request, token, cursor) {
	return request(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`, { token });
}
function get_record(request, token, entity, client_id) {
	return request(`/api/sync/record?${`entidad=${encodeURIComponent(entity)}&client_id=${encodeURIComponent(client_id)}`}`, { token });
}
function get_key_copy(request, token, device) {
	return request(`/api/devices/${device}/key`, { token });
}
function put_key_copy(request, token, device, key) {
	return request(`/api/devices/${device}/key`, {
		method: "PUT",
		body: { clave: key },
		token
	});
}
//#endregion
//#region electron/main/sync/records.ts
var MissingReferenceError = class extends Error {};
function allow_version_write(db, table, id) {
	db.prepare(`UPDATE ${table} SET version = -1 WHERE id = ?`).run(id);
}
function table_of(entity) {
	if (entity === "ministro") return "ministros";
	if (entity === "usuario") return "usuarios";
	return "sacramentos";
}
function set_server_version(db, entity, client_id, version) {
	db.prepare(`UPDATE ${table_of(entity)} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, client_id, version);
}
function read_local_minister(db, client_id) {
	return db.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(client_id);
}
function read_local_user(db, client_id) {
	return db.prepare(`SELECT client_id, id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo,
				password_hash_pendiente AS password_hash
			 FROM usuarios WHERE client_id = ?`).get(client_id);
}
function read_local_record(db, client_id) {
	const sacrament = db.prepare(`SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
				s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion
			 FROM sacramentos s
			 LEFT JOIN ministros m ON m.id = s.ministro_id
			 WHERE s.client_id = ?`).get(client_id);
	const type = sacrament.tipo;
	const detail_row = db.prepare(`SELECT * FROM ${detail_table(type)} WHERE sacramento_id = ?`).get(sacrament.id);
	const read_person = db.prepare(`SELECT client_id, ${PERSON_COLUMNS.join(", ")} FROM personas WHERE id = ?`);
	const people = [];
	for (const column of person_columns(type)) people.push(read_person.get(detail_row[column]));
	const detail = {};
	for (const column of detail_columns(type)) detail[column] = detail_row[column];
	const corrections = db.prepare(`SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio, c.valor_anterior, c.valor_nuevo, c.fecha_cambio,
				c.estado, c.revisado_por_usuario_id, c.revisado_en
			 FROM cambios_persona c
			 JOIN personas p ON p.id = c.persona_id
			 WHERE c.sacramento_id = ?
			 ORDER BY c.id`).all(sacrament.id);
	return {
		tipo: type,
		client_id: sacrament.client_id,
		parroquia_id: sacrament.parroquia_id,
		ministro_client_id: sacrament.ministro_client_id,
		libro: sacrament.libro,
		folio: sacrament.folio,
		numero: sacrament.numero,
		fecha_emision: sacrament.fecha_emision,
		fecha_evento: sacrament.fecha_evento,
		anotaciones: sacrament.anotaciones,
		estado: sacrament.estado,
		anulado_por_usuario_id: sacrament.anulado_por_usuario_id,
		anulado_en: sacrament.anulado_en,
		motivo_anulacion: sacrament.motivo_anulacion,
		personas: people,
		detalle: detail,
		cambios: corrections,
		solicitudes: read_request_data(db, sacrament.id),
		historial: read_history_data(db, sacrament.id)
	};
}
function save_downloaded_person(db, parish_id, person) {
	const values = PERSON_COLUMNS.map((column) => person[column]);
	const existing = db.prepare("SELECT id FROM personas WHERE client_id = ?").get(person.client_id);
	if (existing) {
		const assignments = PERSON_COLUMNS.map((column) => `${column} = ?`).join(", ");
		db.prepare(`UPDATE personas SET ${assignments} WHERE id = ?`).run(...values, existing.id);
		return existing.id;
	}
	const marks = PERSON_COLUMNS.map(() => "?").join(", ");
	const result = db.prepare(`INSERT INTO personas (client_id, parroquia_id, ${PERSON_COLUMNS.join(", ")}) VALUES (?, ?, ${marks})`).run(person.client_id, parish_id, ...values);
	return Number(result.lastInsertRowid);
}
function local_minister_id(db, client_id) {
	if (!client_id) return null;
	const row = db.prepare("SELECT id FROM ministros WHERE client_id = ?").get(client_id);
	if (!row) throw new MissingReferenceError(`Ministro desconocido: ${client_id}`);
	return row.id;
}
function save_downloaded_record(db, record, force = false) {
	const version = record.version ?? 1;
	const local = db.prepare("SELECT id, version FROM sacramentos WHERE client_id = ?").get(record.client_id);
	if (!force) {
		if (is_in_queue(db, record.tipo, record.client_id)) return;
		if (local && local.version === version) return;
	}
	const minister_id = local_minister_id(db, record.ministro_client_id);
	const people_ids = record.personas.map((person) => save_downloaded_person(db, record.parroquia_id, person));
	const updated_at = record.updated_at ?? (/* @__PURE__ */ new Date()).toISOString();
	const values = [
		minister_id,
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
		version,
		updated_at
	];
	let sacrament_id;
	if (local) {
		sacrament_id = local.id;
		allow_version_write(db, "sacramentos", local.id);
		db.prepare(`UPDATE sacramentos SET
				ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,
				estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?
			 WHERE id = ?`).run(...values, local.id);
	} else {
		const result = db.prepare(`INSERT INTO sacramentos
					(ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
					 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,
					 client_id, tipo, parroquia_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, record.client_id, record.tipo, record.parroquia_id);
		sacrament_id = Number(result.lastInsertRowid);
	}
	save_downloaded_detail(db, record, sacrament_id, people_ids);
	save_downloaded_corrections(db, record, sacrament_id, people_ids);
	save_downloaded_requests(db, sacrament_id, record.solicitudes ?? []);
	save_downloaded_history(db, sacrament_id, record.historial ?? []);
	if (force) {
		const kept_ids = JSON.stringify(record.cambios.map((correction) => correction.client_id));
		db.prepare("DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(sacrament_id, kept_ids);
		discard_unsent_requests(db, sacrament_id, record.solicitudes ?? []);
		discard_unsent_history(db, sacrament_id, record.historial ?? []);
		remove_from_queue(db, record.tipo, record.client_id);
	}
}
function save_downloaded_detail(db, record, sacrament_id, people_ids) {
	const detail = record.detalle;
	if (record.tipo === "matrimonio") {
		db.prepare(`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (sacramento_id) DO UPDATE SET
				conyuge_1_id = excluded.conyuge_1_id,
				conyuge_2_id = excluded.conyuge_2_id,
				lugar = excluded.lugar,
				testigo_1 = excluded.testigo_1,
				testigo_2 = excluded.testigo_2,
				testigo_3 = excluded.testigo_3,
				testigo_4 = excluded.testigo_4,
				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,
				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,
				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,
				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha`).run(sacrament_id, people_ids[0], people_ids[1], detail.lugar ?? null, detail.testigo_1 ?? null, detail.testigo_2 ?? null, detail.testigo_3 ?? null, detail.testigo_4 ?? null, detail.conyuge_1_bautismo_parroquia ?? null, detail.conyuge_1_bautismo_fecha ?? null, detail.conyuge_2_bautismo_parroquia ?? null, detail.conyuge_2_bautismo_fecha ?? null);
		return;
	}
	db.prepare(`INSERT INTO ${detail_table(record.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (sacramento_id) DO UPDATE SET
			persona_id = excluded.persona_id,
			padrino_1 = excluded.padrino_1,
			padrino_2 = excluded.padrino_2`).run(sacrament_id, people_ids[0], detail.padrino_1 ?? null, detail.padrino_2 ?? null);
}
function save_downloaded_corrections(db, record, sacrament_id, people_ids) {
	const local_person_ids = /* @__PURE__ */ new Map();
	record.personas.forEach((person, i) => local_person_ids.set(person.client_id, people_ids[i]));
	const insert = db.prepare(`INSERT INTO cambios_persona
			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,
			 estado, revisado_por_usuario_id, revisado_en)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO UPDATE SET
			estado = excluded.estado,
			revisado_por_usuario_id = excluded.revisado_por_usuario_id,
			revisado_en = excluded.revisado_en`);
	for (const correction of record.cambios) insert.run(correction.client_id, local_person_ids.get(correction.persona_client_id), sacrament_id, correction.usuario_id, correction.campo_cambio, correction.valor_anterior, correction.valor_nuevo, correction.fecha_cambio, correction.estado ?? "aprobado", correction.revisado_por_usuario_id ?? null, correction.revisado_en ?? null);
}
function save_downloaded_user(db, user, force = false) {
	user = {
		...user,
		client_id: user.client_id ?? `servidor-${user.id}`
	};
	if (!force && is_in_queue(db, "usuario", user.client_id)) return;
	db.prepare(`UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?`).run(user.username, user.id);
	db.prepare(`UPDATE usuarios SET client_id = '~' || id WHERE client_id = ? AND id <> ?`).run(user.client_id, user.id);
	db.prepare(`INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, updated_at)
		 VALUES (@id, @client_id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo, @principal, @updated_at)
		 ON CONFLICT (id) DO UPDATE SET
			client_id = @client_id, parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo,
			principal = @principal, updated_at = @updated_at, password_hash_pendiente = NULL`).run({
		id: user.id,
		client_id: user.client_id,
		parroquia_id: user.parroquia_id,
		username: user.username,
		rol: user.rol,
		nombre: user.nombre,
		apellido_paterno: user.apellido_paterno,
		apellido_materno: user.apellido_materno ?? "",
		activo: user.activo,
		principal: user.principal ?? 0,
		updated_at: user.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
	});
	allow_version_write(db, "usuarios", user.id);
	db.prepare("UPDATE usuarios SET version = ? WHERE id = ?").run(user.version ?? 1, user.id);
	if (user.password_hash) db.prepare(`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
			 ON CONFLICT (usuario_id) DO UPDATE SET
				verificador = excluded.verificador,
				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(user.id, user.password_hash);
	if (force) remove_from_queue(db, "usuario", user.client_id);
}
function adopt_server_user_id(db, client_id, server_id) {
	const row = db.prepare("SELECT id FROM usuarios WHERE client_id = ?").get(client_id);
	if (!row || row.id === server_id) return null;
	const old_id = row.id;
	db.pragma("defer_foreign_keys = ON");
	db.prepare("UPDATE usuarios SET id = ? WHERE id = ?").run(server_id, old_id);
	db.prepare("UPDATE cambios_persona SET usuario_id = ? WHERE usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE cambios_persona SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE sacramentos SET anulado_por_usuario_id = ? WHERE anulado_por_usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE solicitudes_cambio SET usuario_id = ? WHERE usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE solicitudes_cambio SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE historial_partidas SET usuario_id = ? WHERE usuario_id = ?").run(server_id, old_id);
	db.prepare("UPDATE credenciales_locales SET usuario_id = ? WHERE usuario_id = ?").run(server_id, old_id);
	return old_id;
}
var MINISTER_FIELDS = [
	"titulo",
	"nombre",
	"apellido_paterno",
	"apellido_materno",
	"activo"
];
function save_downloaded_minister(db, minister, force = false) {
	const version = minister.version ?? 1;
	const updated_at = minister.updated_at ?? (/* @__PURE__ */ new Date()).toISOString();
	const local = db.prepare("SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(minister.client_id);
	if (!force && is_in_queue(db, "ministro", minister.client_id)) {
		const same_data = local !== void 0 && MINISTER_FIELDS.every((field) => (local[field] ?? null) === (minister[field] ?? null));
		const queued = db.prepare("SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?").get("ministro", minister.client_id);
		if (!same_data || queued.version_base !== null) return;
		remove_from_queue(db, "ministro", minister.client_id);
		set_server_version(db, "ministro", minister.client_id, version);
		return;
	}
	if (!local) {
		db.prepare(`INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(minister.client_id, minister.parroquia_id, minister.titulo ?? null, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, version, updated_at);
		return;
	}
	if (force || local.version !== version) {
		allow_version_write(db, "ministros", local.id);
		db.prepare(`UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?
			 WHERE id = ?`).run(minister.titulo ?? null, minister.nombre, minister.apellido_paterno, minister.apellido_materno, minister.activo, version, updated_at, local.id);
	}
	if (force) remove_from_queue(db, "ministro", minister.client_id);
}
//#endregion
//#region electron/main/sync/sync.ts
function save_reference_data(db, data) {
	const save_parish = db.prepare(`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)
		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa`);
	const adopt_minister = db.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?");
	db.transaction(() => {
		for (const parish of data.parroquias) save_parish.run(parish);
		for (const minister of data.ministros) {
			adopt_minister.run(minister.client_id, `servidor-${minister.id}`);
			save_downloaded_minister(db, minister);
		}
		for (const user of data.usuarios) save_downloaded_user(db, user);
		db.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)");
	})();
}
async function refresh_reference(db, request, token) {
	save_reference_data(db, await get_reference(request, token));
}
function read_local_data(db, row) {
	if (row.entidad === "ministro") return read_local_minister(db, row.client_id);
	if (row.entidad === "usuario") return read_local_user(db, row.client_id);
	return read_local_record(db, row.client_id);
}
function adopt_user_id(db, client_id, server_id) {
	if (!server_id) return;
	const old_id = adopt_server_user_id(db, client_id, server_id);
	const session = current_session();
	if (old_id !== null && session && session.user_id === old_id) session.user_id = server_id;
}
function save_push_result(db, row, result) {
	db.transaction(() => {
		if (result.estado === "conflicto" || result.estado === "rechazado") {
			db.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(result.estado, result.motivo, row.id);
			return;
		}
		if (row.entidad === "usuario") adopt_user_id(db, row.client_id, result.id);
		if (db.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(row.id).revision === row.revision) {
			remove_from_queue(db, row.entidad, row.client_id);
			set_server_version(db, row.entidad, row.client_id, result.version);
			if (row.entidad === "usuario") db.prepare("UPDATE usuarios SET password_hash_pendiente = NULL WHERE client_id = ?").run(row.client_id);
		} else db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
	})();
}
async function push_pending(db, request, token) {
	const pending_ids = db.prepare(`SELECT id FROM sync_cola WHERE estado <> 'conflicto' ORDER BY entidad = 'usuario' DESC, entidad = 'ministro' DESC, id`).pluck().all();
	const read_row = db.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let start = 0; start < pending_ids.length; start += 15) {
		const rows = [];
		for (const id of pending_ids.slice(start, start + 15)) {
			const row = read_row.get(id);
			if (row && row.estado !== "conflicto") rows.push(row);
		}
		if (rows.length === 0) continue;
		const response = await push_changes(request, token, rows.map((row) => {
			return {
				entidad: row.entidad,
				client_id: row.client_id,
				version_base: row.version_base,
				cola_id: row.cola_id,
				datos: read_local_data(db, row)
			};
		}));
		for (let i = 0; i < rows.length; i++) if (response.resultados[i]) save_push_result(db, rows[i], response.resultados[i]);
	}
}
function save_page(db, page) {
	db.transaction(() => {
		for (const record of page.partidas) save_downloaded_record(db, record);
		set_sync_value(db, SYNC_KEYS.cursor, String(page.cursor));
	})();
}
function is_missing_reference(error) {
	if (error instanceof MissingReferenceError) return true;
	return error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
async function pull_changes(db, request, token) {
	while (true) {
		const page = await pull_page(request, token, get_sync_value(db, SYNC_KEYS.cursor) ?? "0");
		try {
			save_page(db, page);
		} catch (error) {
			if (!is_missing_reference(error)) throw error;
			await refresh_reference(db, request, token);
			save_page(db, page);
		}
		if (!page.hayMas) return;
	}
}
async function run_sync(db, request, token) {
	await refresh_reference(db, request, token);
	await push_pending(db, request, token);
	await pull_changes(db, request, token);
	set_sync_value(db, SYNC_KEYS.last_sync, (/* @__PURE__ */ new Date()).toISOString());
}
async function resolve_conflict(db, request, token, entity, client_id, choice) {
	const server_record = (await get_record(request, token, entity, client_id)).registro;
	db.transaction(() => {
		if (choice === "local") db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?`).run(server_record.version, entity, client_id);
		else if (entity === "ministro") save_downloaded_minister(db, server_record, true);
		else if (entity === "usuario") save_downloaded_user(db, server_record, true);
		else save_downloaded_record(db, server_record, true);
	})();
}
var TYPE_NAMES = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function describe(db, row) {
	if (row.entidad === "ministro") {
		const minister = db.prepare("SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?").get(row.client_id);
		return `Ministro ${minister?.nombre ?? ""} ${minister?.apellido_paterno ?? ""}`.trim();
	}
	if (row.entidad === "usuario") return `Usuario ${db.prepare("SELECT username FROM usuarios WHERE client_id = ?").get(row.client_id)?.username ?? ""}`.trim();
	const type_name = TYPE_NAMES[row.entidad];
	const record = db.prepare("SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?").get(row.client_id);
	if (!record) return type_name;
	return `${type_name}: libro ${record.libro}, folio ${record.folio}, registro ${record.numero}`;
}
function read_queue_summary(db) {
	const counts = db.prepare("SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado").all();
	const count_of = (state) => {
		const row = counts.find((item) => item.estado === state);
		return row ? row.total : 0;
	};
	const items = db.prepare(`SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id`).all().map((row) => ({
		entidad: row.entidad,
		client_id: row.client_id,
		estado: row.estado,
		motivo: row.motivo,
		descripcion: describe(db, row)
	}));
	return {
		pendientes: count_of("pendiente"),
		conflictos: count_of("conflicto"),
		rechazados: count_of("rechazado"),
		ultima_sync: get_sync_value(db, SYNC_KEYS.last_sync),
		aviso: get_sync_value(db, SYNC_KEYS.notice),
		items
	};
}
//#endregion
//#region electron/main/sync/recovery.ts
var REBUILT_NOTICE = "La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.";
async function download_key_copy(paths, request, token) {
	try {
		return (await get_key_copy(request, token, device_id(paths))).clave;
	} catch (error) {
		if (error instanceof ServiceError && error.status === 404) return null;
		throw error;
	}
}
async function rebuild(paths, keys, request, token) {
	const temp = open_temp_database(paths, keys);
	try {
		await refresh_reference(temp.db, request, token);
		await pull_changes(temp.db, request, token);
		set_sync_value(temp.db, SYNC_KEYS.last_sync, (/* @__PURE__ */ new Date()).toISOString());
		set_sync_value(temp.db, SYNC_KEYS.notice, REBUILT_NOTICE);
		set_sync_value(temp.db, SYNC_KEYS.key_registered, null);
	} finally {
		temp.db.close();
	}
	return {
		db: install_temp_database(paths, keys, temp.key),
		key: temp.key
	};
}
async function recover_local_database(paths, keys, request, token) {
	if (existsSync(paths.database)) {
		const key_copy = await download_key_copy(paths, request, token);
		if (key_copy) {
			const db = open_with_key_copy(paths, keys, key_copy);
			if (db) return {
				db,
				key: key_copy
			};
		}
	}
	return rebuild(paths, keys, request, token);
}
async function upload_key_copy(db, paths, key, request, token, parish_id) {
	const registered = get_sync_value(db, SYNC_KEYS.key_registered);
	if (registered && !(registered === "admin" && parish_id !== null)) return;
	const response = await put_key_copy(request, token, device_id(paths), key);
	set_sync_value(db, SYNC_KEYS.key_registered, response.parroquiaId === null ? "admin" : "parroquia");
}
//#endregion
//#region electron/main/sync/auto_sync.ts
var mode = "sin-conexion";
var last_error = null;
var running_sync = null;
var sync_timer = null;
function start_auto_sync(initial_mode) {
	if (!sync_timer) sync_timer = setInterval(() => void sync_now(), SYNC_INTERVAL_MS);
	mode = initial_mode;
}
function stop_auto_sync() {
	if (sync_timer) clearInterval(sync_timer);
	sync_timer = null;
}
function reset_sync_status() {
	mode = "sin-conexion";
	last_error = null;
}
var ACCOUNT_NOT_UPLOADED = "Esta cuenta todavía no está en el servidor. Se subirá la próxima vez que el administrador de la parroquia sincronice con internet; hasta entonces puede trabajar sin conexión.";
function is_waiting_upload(user_id) {
	if (user_id < 0) return true;
	try {
		const row = get_database().prepare("SELECT password_hash_pendiente FROM usuarios WHERE id = ?").get(user_id);
		return Boolean(row?.password_hash_pendiente);
	} catch {
		return false;
	}
}
async function renew_token() {
	const session = current_session();
	const login = saved_credentials();
	if (!session || !login) return null;
	try {
		const response = await request_login(remote_request, login.username, login.password);
		session.token = response.token;
		session.role = response.usuario.rol;
		session.parish_id = response.usuario.parroquia_id;
		return response.token;
	} catch (error) {
		session.token = "";
		if (is_connection_error(error)) {
			mode = "sin-conexion";
			return null;
		}
		if (is_waiting_upload(session.user_id)) {
			mode = "error";
			last_error = ACCOUNT_NOT_UPLOADED;
			return null;
		}
		mode = "requiere-login";
		last_error = "La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.";
		return null;
	}
}
async function with_token(action) {
	const token = current_session()?.token || await renew_token();
	if (!token) return;
	try {
		await action(token);
	} catch (error) {
		if (!(error instanceof ServiceError && error.status === 401)) throw error;
		const new_token = await renew_token();
		if (new_token) await action(new_token);
	}
}
async function perform_sync() {
	last_error = null;
	try {
		let completed = false;
		await with_token(async (token) => {
			const db = get_database();
			await run_sync(db, remote_request, token);
			completed = true;
			const key = current_key();
			if (key) await upload_key_copy(db, database_paths(), key, remote_request, token, current_session()?.parish_id ?? null).catch((error$5) => {
				error("No se pudo subir la copia de la clave:", error$5);
			});
		});
		if (completed) mode = "en-linea";
	} catch (error$6) {
		if (is_connection_error(error$6)) {
			mode = "sin-conexion";
			return;
		}
		error("Falló la sincronización:", error$6);
		mode = "error";
		last_error = error$6 instanceof ServiceError ? error$6.message : "Ocurrió un error al sincronizar.";
	}
}
function sync_now() {
	if (!current_session()) return Promise.resolve();
	if (!running_sync) running_sync = perform_sync().finally(() => {
		running_sync = null;
	});
	return running_sync;
}
function get_sync_status() {
	require_session();
	return {
		...read_queue_summary(get_database()),
		modo: mode,
		en_curso: running_sync !== null,
		mensaje: last_error,
		token: current_session()?.token || "sin-conexion"
	};
}
async function resolve_sync_conflict(entity, client_id, choice) {
	require_session();
	let done = false;
	await with_token(async (token) => {
		await resolve_conflict(get_database(), remote_request, token, entity, client_id, choice);
		done = true;
	});
	if (!done) throw new ServiceError("Se necesita conexión para resolver el conflicto.", 0);
	await sync_now();
}
function dismiss_sync_notice() {
	require_session();
	set_sync_value(get_database(), SYNC_KEYS.notice, null);
}
async function sync_before_quit(limit_ms) {
	if (!current_session()) return;
	if (read_queue_summary(get_database()).pendientes === 0) return;
	const time_limit = new Promise((resolve) => setTimeout(resolve, limit_ms));
	await Promise.race([sync_now(), time_limit]);
}
//#endregion
//#region electron/main/controllers/login.ts
async function save_credential(db, user_id, password) {
	const verifier = await create_verifier(password);
	db.prepare(`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
		 ON CONFLICT (usuario_id) DO UPDATE SET
			verificador = excluded.verificador,
			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(user_id, verifier);
}
async function verify_offline(db, username, password) {
	const row = db.prepare(`SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
				c.verificador, p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 WHERE u.username = ?`).get(username);
	if (!row || !row.verificador) return {
		ok: false,
		reason: "sin-credencial"
	};
	if (row.activo !== 1) return {
		ok: false,
		reason: "incorrecta"
	};
	if (!await matches_verifier(password, row.verificador)) return {
		ok: false,
		reason: "incorrecta"
	};
	return {
		ok: true,
		usuario: {
			id: row.id,
			rol: row.rol,
			parroquia_id: row.parroquia_id,
			parroquia_nombre: row.parroquia_nombre,
			nombre_completo: full_name$1(row.nombre, row.apellido_paterno, row.apellido_materno)
		}
	};
}
async function login_online(response, username, password) {
	const token = response.token;
	const user = response.usuario;
	if (database_needs_recovery()) {
		const recovered = await recover_local_database(database_paths(), KEY_STORE, remote_request, token);
		use_database(recovered.db, recovered.key);
	}
	const db = get_database();
	try {
		await refresh_reference(db, remote_request, token);
	} catch (error) {
		if (!db.prepare("SELECT 1 FROM usuarios WHERE id = ?").get(user.id)) throw error;
	}
	await save_credential(db, user.id, password);
	start_session({
		user_id: user.id,
		role: user.rol,
		parish_id: user.parroquia_id,
		token
	}, username, password);
	start_auto_sync("en-linea");
	await sync_now();
	return response;
}
function start_local_session(user, username, password) {
	start_session({
		user_id: user.id,
		role: user.rol,
		parish_id: user.parroquia_id,
		token: ""
	}, username, password);
	start_auto_sync("sin-conexion");
	sync_now();
	return {
		token: OFFLINE_TOKEN,
		usuario: user
	};
}
var NOT_IN_THIS_PC = "Este usuario todavía no está en esta PC. Cargue el paquete inicial o conéctese a internet para entrar por primera vez.";
async function login(payload) {
	const username = typeof payload?.username === "string" ? payload.username.trim() : "";
	const password = typeof payload?.password === "string" ? payload.password : "";
	let local = {
		ok: false,
		reason: "sin-credencial"
	};
	if (!database_needs_recovery()) {
		local = await verify_offline(get_database(), username, password);
		if (local.ok) return start_local_session(local.usuario, username, password);
	}
	let response;
	try {
		response = await request_login(remote_request, username, password);
	} catch (error) {
		if (!is_connection_error(error)) throw error;
		if (database_needs_recovery()) throw new ServiceError("La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.", 503);
		if (local.reason === "sin-credencial") throw new ServiceError(NOT_IN_THIS_PC, 401);
		throw new ServiceError("Usuario o contraseña incorrectos.", 401);
	}
	return login_online(response, username, password);
}
function logout() {
	stop_auto_sync();
	end_session();
	reset_sync_status();
}
var login_routes = {
	"auth.login": login,
	"auth.logout": () => {
		logout();
		return { success: true };
	}
};
//#endregion
//#region electron/main/controllers/ministers.ts
var NOT_FOUND$1 = "Ministro no encontrado.";
var SORT_COLUMNS$1 = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function clean_minister(minister) {
	const first_name = clean_text(minister?.nombre);
	const father_last_name = clean_text(minister?.apellido_paterno);
	const mother_last_name = clean_text(minister?.apellido_materno);
	if (!first_name || !father_last_name || !mother_last_name) throw new ServiceError("Nombre y apellidos son requeridos.", 400);
	return {
		titulo: clean_text(minister.titulo),
		nombre: first_name,
		apellido_paterno: father_last_name,
		apellido_materno: mother_last_name
	};
}
function check_can_manage_minister(db, session, id) {
	const minister = db.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(id);
	if (!minister) throw new ServiceError(NOT_FOUND$1, 404);
	check_parish_admin(session, minister.parroquia_id, "No tiene permiso para modificar ministros de otra parroquia.", "Solo el administrador de la parroquia puede modificar ministros.");
}
function queue_minister(db, id) {
	const current = db.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(id);
	add_to_queue(db, "ministro", current.client_id, current.version);
}
function search_ministers(db, filters) {
	const conditions = [];
	const values = [];
	if (filters.nombres) {
		conditions.push("nombre LIKE ?");
		values.push(`%${filters.nombres}%`);
	}
	if (filters.apellido_paterno) {
		conditions.push("apellido_paterno LIKE ?");
		values.push(`%${filters.apellido_paterno}%`);
	}
	if (filters.apellido_materno) {
		conditions.push("apellido_materno LIKE ?");
		values.push(`%${filters.apellido_materno}%`);
	}
	if (Number.isInteger(filters.parroquia_id)) {
		conditions.push("parroquia_id = ?");
		values.push(filters.parroquia_id);
	}
	let where = "";
	if (conditions.length > 0) where = "WHERE " + conditions.join(" AND ");
	const page = page_of(filters, db.prepare(`SELECT COUNT(*) AS total FROM ministros ${where}`).get(...values).total);
	const sort_column = SORT_COLUMNS$1[filters.orden ?? "nombres"] ?? SORT_COLUMNS$1.nombres;
	return {
		resultados: db.prepare(`SELECT id FROM ministros ${where}
			 ORDER BY ${sort_column} ${sort_direction(filters)}, id
			 LIMIT ? OFFSET ?`).pluck().all(...values, 20, page.offset).map((id) => read_minister(db, id)),
		total_paginas: page.total_pages
	};
}
function create_minister(db, session, minister) {
	const parish_id = parish_for_new(session);
	const values = clean_minister(minister);
	const client_id = crypto.randomUUID();
	return db.transaction(() => {
		add_to_queue(db, "ministro", client_id, null);
		const result = db.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)").run(client_id, parish_id, values.titulo, values.nombre, values.apellido_paterno, values.apellido_materno);
		return Number(result.lastInsertRowid);
	})();
}
function update_minister(db, session, minister) {
	const id = positive_id(minister?.id, NOT_FOUND$1);
	check_can_manage_minister(db, session, id);
	const values = clean_minister(minister);
	db.transaction(() => {
		queue_minister(db, id);
		db.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(values.titulo, values.nombre, values.apellido_paterno, values.apellido_materno, id);
	})();
}
function toggle_minister_active(db, session, id) {
	check_can_manage_minister(db, session, id);
	db.transaction(() => {
		queue_minister(db, id);
		db.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(id);
	})();
}
var minister_routes = {
	"ministers.search": (filters, { db }) => {
		return search_ministers(db, filters);
	},
	"ministers.create": (minister, { db, session }) => {
		return { id: create_minister(db, session, minister) };
	},
	"ministers.update": (minister, { db, session }) => {
		update_minister(db, session, minister);
		return { success: true };
	},
	"ministers.toggleActive": (payload, { db, session }) => {
		toggle_minister_active(db, session, positive_id(payload.id, NOT_FOUND$1));
		return { success: true };
	}
};
//#endregion
//#region electron/main/controllers/package.ts
var PACKAGE_FORMAT = "prelatura-paquete-inicial";
var PACKAGE_FILE = "paquete-inicial.json";
function needs_package(db) {
	return db.prepare("SELECT COUNT(*) FROM usuarios").pluck().get() === 0;
}
function build_package(db, session) {
	if (session.role !== "admin_general") throw new ServiceError("Solo el administrador general puede generar el paquete inicial.", 403);
	if (db.prepare("SELECT COUNT(*) FROM sync_cola").pluck().get() > 0) throw new ServiceError("Hay cambios sin subir. Sincronice con internet antes de generar el paquete inicial.", 409);
	const users = db.prepare(`SELECT u.id, u.client_id, u.parroquia_id, u.username, u.rol, u.nombre, u.apellido_paterno, u.apellido_materno,
				u.activo, u.principal, u.version, u.updated_at, c.verificador AS password_hash
			 FROM usuarios u
			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
			 WHERE u.id > 0
			 ORDER BY u.id`).all();
	const ministers = db.prepare("SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at FROM ministros ORDER BY id").all();
	const records = db.prepare("SELECT client_id, version, created_at, updated_at FROM sacramentos ORDER BY id").all();
	return {
		formato: PACKAGE_FORMAT,
		version: 1,
		generado_en: (/* @__PURE__ */ new Date()).toISOString(),
		cursor: get_sync_value(db, SYNC_KEYS.cursor),
		parroquias: db.prepare("SELECT id, nombre, ubicacion, activa FROM parroquias ORDER BY id").all(),
		usuarios: users,
		ministros: ministers,
		partidas: records.map((row) => ({
			...read_local_record(db, row.client_id),
			version: row.version,
			created_at: row.created_at,
			updated_at: row.updated_at
		}))
	};
}
function check_package(data) {
	const candidate = data;
	if (!candidate || candidate.formato !== "prelatura-paquete-inicial") throw new ServiceError("El archivo no es un paquete inicial de esta aplicación.", 400);
	if (candidate.version !== 1) throw new ServiceError("El paquete inicial es de otra versión de la aplicación.", 400);
	if (!Array.isArray(candidate.parroquias) || !Array.isArray(candidate.usuarios) || !Array.isArray(candidate.ministros) || !Array.isArray(candidate.partidas)) throw new ServiceError("El paquete inicial está incompleto.", 400);
	return candidate;
}
function load_package(db, data) {
	const content = check_package(data);
	if (!needs_package(db)) throw new ServiceError("Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.", 409);
	db.transaction(() => {
		save_reference_data(db, {
			parroquias: content.parroquias,
			ministros: content.ministros,
			usuarios: content.usuarios
		});
		for (const record of content.partidas) save_downloaded_record(db, record);
		if (content.cursor) set_sync_value(db, SYNC_KEYS.cursor, content.cursor);
	})();
	return {
		parroquias: content.parroquias.length,
		usuarios: content.usuarios.length,
		partidas: content.partidas.length
	};
}
function read_package_file(file_path) {
	try {
		return JSON.parse(readFileSync(file_path, "utf8"));
	} catch {
		throw new ServiceError("No se pudo leer el paquete inicial.", 400);
	}
}
function bundled_package_path() {
	if (app.isPackaged) return path.join(process.resourcesPath, "instalador", PACKAGE_FILE);
	return path.join(app.getAppPath(), "resources", "instalador", PACKAGE_FILE);
}
function load_bundled_package() {
	if (process.env.PRELATURA_SIN_PAQUETE === "1") return;
	const file = bundled_package_path();
	let db;
	try {
		db = get_database();
	} catch {
		return;
	}
	if (!existsSync(file) || !needs_package(db)) return;
	try {
		const summary = load_package(db, read_package_file(file));
		info(`Paquete inicial cargado: ${summary.parroquias} parroquias, ${summary.usuarios} usuarios y ${summary.partidas} partidas.`);
	} catch (error$4) {
		error("No se pudo cargar el paquete inicial del instalador:", error$4);
	}
}
function parent_window() {
	return BrowserWindow.getFocusedWindow() ?? void 0;
}
var package_public_routes = {
	"package.status": () => {
		try {
			return { necesita_paquete: needs_package(get_database()) };
		} catch {
			return { necesita_paquete: false };
		}
	},
	"package.import": async () => {
		const db = get_database();
		if (!needs_package(db)) throw new ServiceError("Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.", 409);
		const options = {
			title: "Elegir el paquete inicial",
			properties: ["openFile"],
			filters: [{
				name: "Paquete inicial",
				extensions: ["json"]
			}]
		};
		const window = parent_window();
		const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
		if (choice.canceled || choice.filePaths.length === 0) return { cancelado: true };
		return {
			cancelado: false,
			...load_package(db, read_package_file(choice.filePaths[0]))
		};
	}
};
var package_routes = { "package.export": async (_payload, { db, session }) => {
	const content = build_package(db, session);
	const options = {
		title: "Guardar el paquete inicial",
		defaultPath: PACKAGE_FILE,
		filters: [{
			name: "Paquete inicial",
			extensions: ["json"]
		}]
	};
	const window = parent_window();
	const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
	if (choice.canceled || !choice.filePath) return { cancelado: true };
	writeFileSync(choice.filePath, JSON.stringify(content), "utf8");
	return {
		cancelado: false,
		parroquias: content.parroquias.length,
		usuarios: content.usuarios.length,
		partidas: content.partidas.length
	};
} };
//#endregion
//#region electron/main/controllers/parishes.ts
var LOGO_FORMAT = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function list_parishes(db) {
	return db.prepare("SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function logo_path(user_data_folder, parish_id) {
	return path.join(user_data_folder, FILE_NAMES.logos_folder, `parroquia-${parish_id}.txt`);
}
function read_parish_logo(user_data_folder, parish_id) {
	try {
		return readFileSync(logo_path(user_data_folder, parish_id), "utf8");
	} catch {
		return null;
	}
}
function save_parish_logo(user_data_folder, session, parish_id, logo) {
	check_parish_admin(session, parish_id, "Solo puede cambiar el logo de su propia parroquia.", "Solo el administrador de la parroquia puede cambiar el logo.");
	const file = logo_path(user_data_folder, parish_id);
	if (logo === null) {
		rmSync(file, { force: true });
		return;
	}
	if (typeof logo !== "string" || logo.length > 4e5 || !LOGO_FORMAT.test(logo)) throw new ServiceError("El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.", 400);
	mkdirSync(path.dirname(file), { recursive: true });
	const temporary_file = `${file}.tmp`;
	writeFileSync(temporary_file, logo, "utf8");
	renameSync(temporary_file, file);
}
var parish_routes = {
	"parishes.list": (_payload, { db }) => {
		return { parroquias: list_parishes(db) };
	},
	"parishes.logo": (payload, { user_data_folder }) => {
		return { logo: read_parish_logo(user_data_folder, positive_id(payload.parroquia_id)) };
	},
	"parishes.saveLogo": (payload, { session, user_data_folder }) => {
		save_parish_logo(user_data_folder, session, positive_id(payload.parroquia_id), payload.logo);
		return { success: true };
	}
};
//#endregion
//#region electron/main/controllers/server.ts
var server_routes = { "app.server": () => {
	return { servidor: server_url() };
} };
//#endregion
//#region electron/main/controllers/sacrament_index.ts
var compare_text = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: true
}).compare;
function check_request(session, type, parish_id) {
	if (!is_sacrament_type(type)) throw new ServiceError("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(parish_id) || parish_id <= 0) throw new ServiceError("Debe especificar la parroquia.", 400);
	check_parish_read(session, parish_id, "No tiene permiso para imprimir el índice de otra parroquia.");
}
function list_index_books(db, session, type, parish_id) {
	check_request(session, type, parish_id);
	return db.prepare(`SELECT DISTINCT libro FROM sacramentos WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'`).pluck().all(type, parish_id).sort(compare_text);
}
function get_index_entries(db, session, type, parish_id, book) {
	check_request(session, type, parish_id);
	return db.prepare(`SELECT pe.nombres, pe.apellido_paterno, pe.apellido_materno, s.libro, s.folio, s.numero
			 FROM (${people_of(type)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(parish_id, book, book).sort((a, b) => compare_text(a.apellido_paterno, b.apellido_paterno) || compare_text(a.apellido_materno, b.apellido_materno) || compare_text(a.nombres, b.nombres) || compare_text(a.libro, b.libro) || compare_text(a.folio, b.folio) || compare_text(a.numero, b.numero));
}
var sacrament_index_routes = {
	"sacramentIndex.books": (payload, { db, session }) => {
		return { libros: list_index_books(db, session, payload.tipo, payload.parroquia_id) };
	},
	"sacramentIndex.entries": (payload, { db, session }) => {
		return { entradas: get_index_entries(db, session, payload.tipo, payload.parroquia_id, payload.libro) };
	}
};
//#endregion
//#region electron/main/controllers/sacraments.ts
var NAME_COLUMNS = [
	"nombres",
	"apellido_paterno",
	"apellido_materno"
];
function check_type(value) {
	if (!is_sacrament_type(value)) throw new ServiceError("Tipo de sacramento inválido.", 400);
	return value;
}
function name_filters(filters, aliases) {
	const conditions = [];
	const values = [];
	if (Number.isInteger(filters.parroquia_id)) {
		conditions.push("s.parroquia_id = ?");
		values.push(filters.parroquia_id);
	}
	for (const column of NAME_COLUMNS) {
		const text = filters[column];
		if (!text) continue;
		conditions.push(`(${aliases.map((alias) => name_condition(alias, column)).join(" OR ")})`);
		for (let i = 0; i < aliases.length; i++) values.push(`%${text}%`, `%${text}%`);
	}
	let where = "";
	if (conditions.length > 0) where = "WHERE " + conditions.join(" AND ");
	return {
		where,
		values
	};
}
function search_sacraments(db, type, filters) {
	let from = `FROM ${detail_table(type)} sub
		JOIN sacramentos s ON s.id = sub.sacramento_id
		JOIN personas pe ON pe.id = sub.persona_id`;
	let aliases = ["pe"];
	if (type === "matrimonio") {
		from = `FROM matrimonios m
			JOIN sacramentos s ON s.id = m.sacramento_id
			JOIN personas c1 ON c1.id = m.conyuge_1_id
			JOIN personas c2 ON c2.id = m.conyuge_2_id`;
		aliases = ["c1", "c2"];
	}
	const { where, values } = name_filters(filters, aliases);
	const page = page_of(filters, db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...values).total);
	let sort_column = "nombres";
	if (filters.orden && NAME_COLUMNS.includes(filters.orden)) sort_column = filters.orden;
	return {
		resultados: db.prepare(`SELECT s.id ${from} ${where}
			 ORDER BY ${aliases[0]}.${sort_column} ${sort_direction(filters)}, s.id
			 LIMIT ? OFFSET ?`).pluck().all(...values, 20, page.offset).map((id) => read_record(db, id)),
		total_paginas: page.total_pages
	};
}
function create_record(db, session, record) {
	const type = check_type(record?.sacramento?.tipo);
	const parish_id = parish_for_new(session);
	check_required(record, null);
	const is_helper = session.role === "usuario";
	return db.transaction(() => {
		const people = insert_people(db, parish_id, record, !is_helper);
		const client_id = crypto.randomUUID();
		add_to_queue(db, type, client_id, null);
		const sacrament_id = insert_sacrament(db, client_id, type, parish_id, record.sacramento);
		insert_detail(db, sacrament_id, record, people.map((person) => person.id));
		add_history(db, sacrament_id, session.user_id, "registrada");
		const corrections = corrections_of(people);
		if (corrections.length === 0) return sacrament_id;
		if (is_helper) {
			const requests = corrections.map((correction) => ({
				...correction,
				tipo: "nota_marginal"
			}));
			insert_requests(db, sacrament_id, session.user_id, requests);
			add_history(db, sacrament_id, session.user_id, "cambio_pedido", requests);
			return sacrament_id;
		}
		for (const person of people) save_corrections(db, session, person.id, sacrament_id, person.corrections);
		add_history(db, sacrament_id, session.user_id, "correccion", corrections);
		return sacrament_id;
	})();
}
function update_as_admin(db, session, record) {
	const sacrament_id = positive_id(record.sacramento?.id);
	check_can_manage$1(db, session, sacrament_id, record.sacramento.tipo);
	const saved = read_record(db, sacrament_id);
	db.transaction(() => {
		queue_sacrament(db, sacrament_id);
		const result = save_edit(db, session, saved, record);
		if (result.fields.length > 0) add_history(db, sacrament_id, session.user_id, "editada", result.fields);
		if (result.corrections.length > 0) add_history(db, sacrament_id, session.user_id, "correccion", result.corrections);
		resolve_on_edit(db, session, sacrament_id, record);
	})();
}
function update_record(db, session, record) {
	check_type(record?.sacramento?.tipo);
	if (session.role === "usuario") request_changes(db, session, record);
	else update_as_admin(db, session, record);
}
function annul_sacrament(db, session, sacrament_id, reason) {
	const row = db.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(sacrament_id);
	if (!row) throw new ServiceError(NOT_FOUND$2, 404);
	check_can_manage$1(db, session, sacrament_id, row.tipo);
	const clean_reason = clean_text(reason);
	if (!clean_reason) throw new ServiceError("El motivo de anulación es requerido.", 400);
	db.transaction(() => {
		queue_sacrament(db, sacrament_id);
		db.prepare(`UPDATE sacramentos
			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
			 WHERE id = ?`).run(session.user_id, (/* @__PURE__ */ new Date()).toISOString(), clean_reason, sacrament_id);
		add_history(db, sacrament_id, session.user_id, "anulada", [], clean_reason);
	})();
}
function sacrament_history(db, session, sacrament_id) {
	if (session.role === "usuario") throw new ServiceError("Solo un administrador puede ver el historial de una partida.", 403);
	check_parish_read(session, read_record(db, sacrament_id).sacramento.parroquia_id, "Solo puede ver el historial de las partidas de su parroquia.");
	return read_history(db, sacrament_id);
}
var sacrament_routes = {
	"sacraments.search": (payload, { db }) => {
		return search_sacraments(db, check_type(payload.tipo), payload);
	},
	"sacraments.get": (payload, { db }) => {
		return read_record(db, positive_id(payload.id));
	},
	"sacraments.create": (record, { db, session }) => {
		return { id: create_record(db, session, record) };
	},
	"sacraments.update": (record, { db, session }) => {
		update_record(db, session, record);
		return { success: true };
	},
	"sacraments.annul": (payload, { db, session }) => {
		annul_sacrament(db, session, positive_id(payload.id), payload.motivo_anulacion);
		return { success: true };
	},
	"sacraments.history": (payload, { db, session }) => {
		return { historial: sacrament_history(db, session, positive_id(payload.id)) };
	}
};
//#endregion
//#region electron/main/controllers/statistics.ts
var SACRAMENTS = [
	"bautismo",
	"confirmacion",
	"matrimonio"
];
var TREND_YEARS = 10;
var TOP_MINISTERS = 8;
var EVENT_DATE = "COALESCE(s.fecha_evento, s.fecha_emision)";
var HAS_YEAR = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]*'`;
var HAS_MONTH = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'`;
var HAS_FULL_DATE = `${EVENT_DATE} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`;
var AGE_BANDS = [
	{
		label: "Menos de 1 año",
		to: 0
	},
	{
		label: "1 a 6 años",
		to: 6
	},
	{
		label: "7 a 12 años",
		to: 12
	},
	{
		label: "13 a 17 años",
		to: 17
	},
	{
		label: "18 a 29 años",
		to: 29
	},
	{
		label: "30 a 49 años",
		to: 49
	},
	{
		label: "50 años o más",
		to: Infinity
	}
];
function zero_counts() {
	return {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
}
function two_digits(value) {
	return String(value).padStart(2, "0");
}
var PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/;
function had_birthday_by(birth, event) {
	const [, , birth_month, birth_day] = birth;
	const [, , event_month, event_day] = event;
	if (!birth_month || !event_month) return null;
	if (event_month !== birth_month) return event_month > birth_month;
	if (!birth_day || !event_day) return null;
	return event_day >= birth_day;
}
function age_at(birth_date, event_date) {
	const birth = PARTIAL_DATE.exec(birth_date ?? "");
	const event = PARTIAL_DATE.exec(event_date);
	if (!birth || !event || birth[0] !== birth_date) return null;
	const had_birthday = had_birthday_by(birth, event);
	if (had_birthday === null) return null;
	let age = Number(event[1]) - Number(birth[1]);
	if (!had_birthday) age -= 1;
	if (age < 0 || age > 130) return null;
	return age;
}
function get_statistics(db, parish_id, requested_year, now = /* @__PURE__ */ new Date()) {
	const current_year = now.getFullYear();
	const current_month = two_digits(now.getMonth() + 1);
	const today = `${current_month}-${two_digits(now.getDate())}`;
	const years_with_records = db.prepare(`SELECT DISTINCT CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS year
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR}`).pluck().all(parish_id);
	const years = [.../* @__PURE__ */ new Set([...years_with_records, current_year])].sort((a, b) => b - a);
	let year = current_year;
	if (years.includes(requested_year)) year = requested_year;
	const is_current_year = year === current_year;
	const count_where = (condition, ...values) => {
		const counts = zero_counts();
		const rows = db.prepare(`SELECT s.tipo, COUNT(*) AS total
				 FROM sacramentos s
				 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${condition}
				 GROUP BY s.tipo`).all(parish_id, ...values);
		for (const row of rows) counts[row.tipo] = row.total;
		return counts;
	};
	const in_year = `${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`;
	const previous_year = is_current_year ? count_where(`${HAS_FULL_DATE} AND substr(${EVENT_DATE}, 1, 10) BETWEEN ? AND ?`, `${year - 1}-01-01`, `${year - 1}-${today}`) : count_where(in_year, String(year - 1));
	const selected_year = count_where(in_year, String(year));
	const this_month = count_where(`substr(${EVENT_DATE}, 1, 7) = ?`, `${current_year}-${current_month}`);
	const all_time = count_where(HAS_YEAR);
	const totals = {};
	for (const type of SACRAMENTS) totals[type] = {
		anio: selected_year[type],
		anterior: previous_year[type],
		mes: this_month[type],
		historico: all_time[type]
	};
	const monthly = [];
	for (let month = 1; month <= 12; month++) monthly.push({
		mes: month,
		...zero_counts()
	});
	const month_rows = db.prepare(`SELECT s.tipo, CAST(substr(${EVENT_DATE}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_MONTH} AND substr(${EVENT_DATE}, 1, 4) = ?
			 GROUP BY s.tipo, mes`).all(parish_id, String(year));
	for (const row of month_rows) if (monthly[row.mes - 1]) monthly[row.mes - 1][row.tipo] = row.total;
	const first_year = Math.max(Math.min(...years), year - TREND_YEARS + 1);
	const trend = [];
	for (let trend_year = first_year; trend_year <= year; trend_year++) trend.push({
		anio: trend_year,
		...zero_counts()
	});
	const trend_rows = db.prepare(`SELECT s.tipo, CAST(substr(${EVENT_DATE}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR}
			 GROUP BY s.tipo, anio`).all(parish_id);
	for (const row of trend_rows) {
		const point = trend.find((item) => item.anio === row.anio);
		if (point) point[row.tipo] = row.total;
	}
	const people = db.prepare(`SELECT s.tipo, ${EVENT_DATE} AS fecha, pe.fecha_nacimiento
			 FROM (${PEOPLE_OF_ALL_SACRAMENTS}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`).all(parish_id, String(year));
	const ages = {};
	for (const type of SACRAMENTS) {
		const bands = AGE_BANDS.map(() => 0);
		let age_sum = 0;
		let with_age = 0;
		let without_age = 0;
		for (const person of people) {
			if (person.tipo !== type) continue;
			const age = age_at(person.fecha_nacimiento, person.fecha);
			if (age === null) {
				without_age += 1;
				continue;
			}
			const band = AGE_BANDS.findIndex((item) => age <= item.to);
			bands[band] += 1;
			age_sum += age;
			with_age += 1;
		}
		let average = null;
		if (with_age > 0) average = Math.round(age_sum / with_age * 10) / 10;
		ages[type] = {
			bandas: bands,
			sinDato: without_age,
			promedio: average
		};
	}
	const ministers = db.prepare(`SELECT min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS nombre, COUNT(*) AS total
			 FROM sacramentos s
			 JOIN ministros min ON min.id = s.ministro_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?
			 GROUP BY min.id
			 ORDER BY total DESC, nombre
			 LIMIT ?`).all(parish_id, String(year), TOP_MINISTERS);
	const register = db.prepare(`SELECT
				COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND c.estado = 'aprobado')), 0) AS conCorrecciones
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND ${HAS_YEAR} AND substr(${EVENT_DATE}, 1, 4) = ?`).get(parish_id, String(year));
	return {
		anios: years,
		anio: year,
		esAnioActual: is_current_year,
		totales: totals,
		mensual: monthly,
		tendencia: trend,
		bandasEdad: AGE_BANDS.map((band) => band.label),
		edades: ages,
		ministros: ministers,
		registro: register
	};
}
var statistics_routes = { "statistics.get": (payload, { db }) => {
	return get_statistics(db, positive_id(payload.parroquia_id), payload.anio);
} };
//#endregion
//#region electron/main/controllers/sync.ts
var sync_routes = {
	"sync.status": () => {
		return get_sync_status();
	},
	"sync.run": async () => {
		await sync_now();
		return get_sync_status();
	},
	"sync.resolve": async (payload) => {
		await resolve_sync_conflict(payload.entidad, payload.client_id, payload.eleccion);
		return get_sync_status();
	},
	"sync.dismissNotice": () => {
		dismiss_sync_notice();
		return { success: true };
	}
};
//#endregion
//#region shared/sync.ts
var ROLES = [
	"admin_general",
	"admin_parroquia",
	"usuario"
];
//#endregion
//#region shared/users.ts
var USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
function is_role(value) {
	return ROLES.includes(value);
}
function role_parish_error(target) {
	if (target.rol === "admin_general" && target.parroquia_id !== null) return "Un administrador general no pertenece a ninguna parroquia.";
	if (target.rol !== "admin_general" && target.parroquia_id === null) return "Debe seleccionar una parroquia.";
	return null;
}
function parish_admin_reason(actor, target, action) {
	if (target.parroquia_id !== actor.parroquia_id) return `Solo puede ${action} cuentas de su propia parroquia.`;
	if (target.rol === "usuario") return null;
	if (target.rol === "admin_parroquia" && actor.principal) return null;
	if (target.rol === "admin_parroquia") return `Solo el administrador principal de la parroquia puede ${action} a otros administradores.`;
	return "El administrador de una parroquia no gestiona administradores generales.";
}
function cannot_create(actor, target) {
	if (actor.rol === "admin_general") {
		if (target.rol === "admin_general" && !actor.principal) return "Solo el administrador principal puede crear administradores generales.";
		return null;
	}
	if (actor.rol === "admin_parroquia") return parish_admin_reason(actor, target, "crear");
	return "No tiene permiso para gestionar usuarios.";
}
function cannot_modify(actor, target) {
	if (target.id === actor.id) return null;
	if (actor.rol === "admin_general") {
		if (target.rol === "admin_general" && !actor.principal) return "Solo el administrador principal puede modificar a otros administradores generales.";
		return null;
	}
	if (actor.rol === "admin_parroquia") return parish_admin_reason(actor, target, "modificar");
	return "No tiene permiso para gestionar usuarios.";
}
function cannot_disable(target) {
	if (target.principal) return "No se puede deshabilitar al administrador principal: primero pase la marca de principal a otro administrador.";
	return null;
}
function can_manage_users(role) {
	return role === "admin_general" || role === "admin_parroquia";
}
var NOT_FOUND = "Usuario no encontrado.";
var SORT_COLUMNS = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function check_can_manage(session) {
	if (!can_manage_users(session.role)) throw new ServiceError("Solo un administrador puede gestionar usuarios.", 403);
}
function is_principal(db, session) {
	return db.prepare("SELECT principal FROM usuarios WHERE id = ?").get(session.user_id)?.principal === 1;
}
function actor_of(db, session) {
	return {
		id: session.user_id,
		rol: session.role,
		parroquia_id: session.parish_id,
		principal: is_principal(db, session)
	};
}
function read_target(db, user_id) {
	const row = db.prepare("SELECT id, client_id, rol, parroquia_id, version, activo, principal FROM usuarios WHERE id = ?").get(user_id);
	if (!row) throw new ServiceError(NOT_FOUND, 404);
	return {
		...row,
		principal: row.principal === 1
	};
}
function becomes_principal(db, role, parish_id) {
	if (role !== "admin_parroquia") return 0;
	return db.prepare("SELECT 1 FROM usuarios WHERE principal = 1 AND parroquia_id = ?").get(parish_id) !== void 0 ? 0 : 1;
}
function check_password(password, required) {
	if (!password && !required) return;
	if (password.length < 8) throw new ServiceError(`La contraseña debe tener al menos 8 caracteres.`, 400);
}
function clean_names(user) {
	const nombre = clean_text(user?.nombre);
	const apellido_paterno = clean_text(user?.apellido_paterno);
	if (!nombre || !apellido_paterno) throw new ServiceError("Nombre y apellido paterno son requeridos.", 400);
	return {
		nombre,
		apellido_paterno,
		apellido_materno: clean_text(user.apellido_materno) ?? ""
	};
}
function save_password(db, user_id, hash) {
	db.prepare("UPDATE usuarios SET password_hash_pendiente = ? WHERE id = ?").run(hash, user_id);
	db.prepare(`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
		 ON CONFLICT (usuario_id) DO UPDATE SET
			verificador = excluded.verificador,
			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(user_id, hash);
}
function search_users(db, session, filters) {
	check_can_manage(session);
	const conditions = [];
	const values = [];
	let parish_filter = filters.parroquia_id;
	if (session.role === "admin_parroquia") parish_filter = session.parish_id ?? -1;
	if (Number.isInteger(parish_filter)) {
		conditions.push("u.parroquia_id = ?");
		values.push(parish_filter);
	}
	for (const column of [
		"nombres",
		"apellido_paterno",
		"apellido_materno"
	]) {
		const text = filters[column];
		if (!text) continue;
		conditions.push(`u.${SORT_COLUMNS[column]} LIKE ?`);
		values.push(`%${text}%`);
	}
	let where = "";
	if (conditions.length > 0) where = "WHERE " + conditions.join(" AND ");
	const page = page_of(filters, db.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${where}`).get(...values).total);
	const sort_column = SORT_COLUMNS[filters.orden ?? "nombres"] ?? SORT_COLUMNS.nombres;
	return {
		resultados: db.prepare(`SELECT u.id, u.username, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, u.principal,
				p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 ${where}
			 ORDER BY u.${sort_column} ${sort_direction(filters)}, u.id
			 LIMIT ? OFFSET ?`).all(...values, 20, page.offset),
		total_paginas: page.total_pages
	};
}
async function create_user(db, session, user) {
	check_can_manage(session);
	const names = clean_names(user);
	const username = clean_text(user?.username) ?? "";
	const password = typeof user?.password === "string" ? user.password : "";
	const role = user?.rol ?? "usuario";
	if (!USERNAME_PATTERN.test(username)) throw new ServiceError("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	check_password(password, true);
	if (!is_role(role)) throw new ServiceError("El rol no es válido.", 400);
	let parish_id = null;
	if (role !== "admin_general") parish_id = session.role === "admin_parroquia" ? session.parish_id : Number.isInteger(user.parroquia_id) ? user.parroquia_id : null;
	const target = {
		rol: role,
		parroquia_id: parish_id
	};
	const parish_error = role_parish_error(target);
	if (parish_error) throw new ServiceError(parish_error, 400);
	const reason = cannot_create(actor_of(db, session), target);
	if (reason) throw new ServiceError(reason, 403);
	if (parish_id !== null && !db.prepare("SELECT 1 FROM parroquias WHERE id = ? AND activa = 1").get(parish_id)) throw new ServiceError("La parroquia seleccionada no existe.", 400);
	if (db.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE").get(username)) throw new ServiceError("Ese nombre de usuario ya existe.", 409);
	const hash = await create_server_hash(password);
	const client_id = crypto.randomUUID();
	return db.transaction(() => {
		const lowest = db.prepare("SELECT MIN(id) FROM usuarios").pluck().get();
		const provisional_id = Math.min(lowest ?? 0, 0) - 1;
		add_to_queue(db, "usuario", client_id, null);
		db.prepare(`INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(provisional_id, client_id, parish_id, username, role, names.nombre, names.apellido_paterno, names.apellido_materno, becomes_principal(db, role, parish_id));
		save_password(db, provisional_id, hash);
		return provisional_id;
	})();
}
async function update_user(db, session, user) {
	const id = positive_or_provisional_id(user?.id);
	if (id !== session.user_id) check_can_manage(session);
	const names = clean_names(user);
	const password = typeof user.password === "string" ? user.password : "";
	check_password(password, false);
	const target = read_target(db, id);
	const reason = cannot_modify(actor_of(db, session), target);
	if (reason) throw new ServiceError(reason, 403);
	const hash = password ? await create_server_hash(password) : null;
	db.transaction(() => {
		add_to_queue(db, "usuario", target.client_id, target.version);
		db.prepare("UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(names.nombre, names.apellido_paterno, names.apellido_materno, id);
		if (hash) save_password(db, id, hash);
	})();
}
function toggle_user_active(db, session, user_id) {
	check_can_manage(session);
	if (user_id === session.user_id) throw new ServiceError("No puede deshabilitar su propia cuenta.", 400);
	const target = read_target(db, user_id);
	const reason = cannot_modify(actor_of(db, session), target);
	if (reason) throw new ServiceError(reason, 403);
	const disable_reason = target.activo === 1 ? cannot_disable(target) : null;
	if (disable_reason) throw new ServiceError(disable_reason, 400);
	db.transaction(() => {
		add_to_queue(db, "usuario", target.client_id, target.version);
		db.prepare("UPDATE usuarios SET activo = NOT activo WHERE id = ?").run(user_id);
		if (target.activo === 1) db.prepare("DELETE FROM credenciales_locales WHERE usuario_id = ?").run(user_id);
	})();
}
async function make_principal(db, session, username) {
	check_can_manage(session);
	if (typeof username !== "string" || !db.prepare("SELECT 1 FROM usuarios WHERE username = ?").get(username)) throw new ServiceError(NOT_FOUND, 404);
	await sync_now();
	const server_id = db.prepare("SELECT id FROM usuarios WHERE username = ?").pluck().get(username);
	const token = current_session()?.token;
	if (!token || server_id < 0) throw new ServiceError("Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.", 503);
	await remote_request(`/api/users/${server_id}/make-principal`, {
		method: "PATCH",
		token
	});
	await sync_now();
}
function positive_or_provisional_id(value) {
	if (!Number.isInteger(value) || value === 0) throw new ServiceError(NOT_FOUND, 404);
	return value;
}
var user_routes = {
	"users.search": (filters, { db, session }) => {
		return search_users(db, session, filters ?? {});
	},
	"users.create": async (user, { db, session }) => {
		const id = await create_user(db, session, user);
		sync_now();
		return { id };
	},
	"users.update": async (user, { db, session }) => {
		await update_user(db, session, user);
		sync_now();
		return { success: true };
	},
	"users.toggleActive": (payload, { db, session }) => {
		toggle_user_active(db, session, positive_or_provisional_id(payload?.id));
		sync_now();
		return { success: true };
	},
	"users.makePrincipal": async (payload, { db, session }) => {
		await make_principal(db, session, payload?.username);
		return { success: true };
	},
	"users.me": (_payload, { db, session }) => {
		return { principal: can_manage_users(session.role) && is_principal(db, session) };
	}
};
//#endregion
//#region electron/main/utils/middleware.ts
async function run(routes, public_routes, method, payload) {
	if (Object.hasOwn(public_routes, method)) return public_routes[method](payload);
	if (!Object.hasOwn(routes, method)) throw new ServiceError("Operación no reconocida.", 404);
	const context = {
		session: require_session(),
		db: get_database(),
		user_data_folder: app.getPath("userData")
	};
	return routes[method](payload, context);
}
function listen(routes, public_routes) {
	ipcMain.handle(LOCAL_REQUEST_CHANNEL, async (_event, method, payload) => {
		try {
			return {
				ok: true,
				data: await run(routes, public_routes, method, payload)
			};
		} catch (error$3) {
			if (error$3 instanceof ServiceError) return {
				ok: false,
				message: error$3.message,
				status: error$3.status
			};
			error(`Error en ${method}:`, error$3);
			return {
				ok: false,
				message: "Ocurrió un error inesperado.",
				status: 500
			};
		}
	});
}
//#endregion
//#region electron/main/app.ts
function register_routes() {
	listen({
		...parish_routes,
		...minister_routes,
		...sacrament_routes,
		...duplicate_routes,
		...statistics_routes,
		...sacrament_index_routes,
		...sync_routes,
		...user_routes,
		...request_routes,
		...legacy_import_routes,
		...package_routes
	}, {
		...login_routes,
		...package_public_routes,
		...server_routes
	});
}
function setup() {
	ipcMain.handle("app:get-version", () => app.getVersion());
	register_routes();
	try {
		open_at_startup();
	} catch (error$1) {
		error("No se pudo abrir la base local:", error$1);
	}
	load_bundled_package();
}
async function finish_pending_sync() {
	stop_auto_sync();
	try {
		await sync_before_quit(QUIT_SYNC_LIMIT_MS);
	} catch (error$2) {
		error("No se pudo sincronizar al cerrar:", error$2);
	}
}
function shutdown() {
	close_database();
}
//#endregion
//#region electron/main/index.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var main_window = null;
var quit_sync_done = false;
function create_window() {
	main_window = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "index.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.PRELATURA_SECOND_SCREEN === "1") {
		const other_screen = screen.getAllDisplays().find((display) => display.id !== screen.getPrimaryDisplay().id);
		if (other_screen) main_window.setBounds(other_screen.workArea);
	}
	main_window.maximize();
	if (VITE_DEV_SERVER_URL) {
		main_window.loadURL(VITE_DEV_SERVER_URL);
		main_window.webContents.openDevTools();
	} else main_window.loadFile(path.join(__dirname, "../dist/index.html"));
	main_window.on("closed", () => {
		main_window = null;
	});
}
app.whenReady().then(() => {
	setup();
	create_window();
});
app.on("before-quit", (event) => {
	if (quit_sync_done) return;
	event.preventDefault();
	quit_sync_done = true;
	finish_pending_sync().finally(() => app.quit());
});
app.on("will-quit", shutdown);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) create_window();
});
//#endregion
export {};
