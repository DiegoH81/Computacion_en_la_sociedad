import { BrowserWindow, app, ipcMain, safeStorage, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3-multiple-ciphers";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
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
//#region electron/main/utils/config.ts
var WORKER_URL = process.env.PRELATURA_API_URL ?? void 0 ?? "http://localhost:8787";
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
function full_name(first_name, father_last_name, mother_last_name) {
	return [
		first_name,
		father_last_name,
		mother_last_name
	].filter((part) => part).join(" ");
}
//#endregion
//#region electron/main/models/parish.ts
function read_parish(db, parish_id) {
	return db.prepare("SELECT * FROM parroquias WHERE id = ?").get(parish_id);
}
function parish_for_new(session, chosen_parish_id) {
	if (session.role === "admin") {
		if (!Number.isInteger(chosen_parish_id) || chosen_parish_id <= 0) throw new ServiceError("Debe especificar la parroquia.", 400);
		return chosen_parish_id;
	}
	if (!session.parish_id) throw new ServiceError("El usuario no tiene una parroquia asignada.", 400);
	return session.parish_id;
}
function check_parish_access(session, parish_id, message) {
	if (session.role !== "admin" && session.parish_id !== parish_id) throw new ServiceError(message, 403);
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
function check_can_manage(db, session, sacrament_id, type) {
	const sacrament = db.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(sacrament_id, type);
	if (!sacrament) throw new ServiceError("Partida no encontrada.", 404);
	check_parish_access(session, sacrament.parroquia_id, "No tiene permiso para modificar partidas de otra parroquia.");
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
function normalize(value) {
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
	const same_dni = dni_comparable && input.dni === normalize(candidate.dni);
	const name_similarity = (field, current) => {
		const options = [normalize(current), ...old_names.get(`${candidate.persona_id}:${field}`) ?? []];
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
		fecha_nacimiento: compare_dates(input.fecha_nacimiento, normalize(candidate.fecha_nacimiento)),
		padre: {
			comparable: Boolean(input.padre && candidate.padre),
			value: similarity(input.padre, normalize(candidate.padre))
		},
		madre: {
			comparable: Boolean(input.madre && candidate.madre),
			value: similarity(input.madre, normalize(candidate.madre))
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
		dni: normalize(person.dni),
		nombres: normalize(person.nombres),
		apellido_paterno: normalize(person.apellido_paterno),
		apellido_materno: normalize(person.apellido_materno),
		fecha_nacimiento: normalize(person.fecha_nacimiento),
		padre: normalize(person.padre),
		madre: normalize(person.madre)
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
			 WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_anterior IS NOT NULL`).all();
	for (const correction of corrections) {
		const key = `${correction.persona_id}:${correction.campo_cambio}`;
		const list = old_names.get(key) ?? [];
		list.push(normalize(correction.valor_anterior));
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
				nombre_completo: full_name(candidate.nombres, candidate.apellido_paterno, candidate.apellido_materno),
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
//#region electron/shared/index.ts
var LOCAL_REQUEST_CHANNEL = "local:request";
/** Marca una sesión iniciada sin internet: aún no hay token del servidor. */
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
async function matches_verifier(password, verifier) {
	const [scheme, n, r, p, salt, hash] = verifier.split(":");
	if (scheme !== "scrypt" || !salt || !hash) return false;
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
function error(...values) {
	console.error(...values);
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
		response = await fetch(`${WORKER_URL}${path}`, {
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
//#region electron/main/models/person.ts
var PERSON_COLUMNS = [
	"dni",
	"nombres",
	"apellido_paterno",
	"apellido_materno",
	"fecha_nacimiento",
	"edad",
	"lugar_nacimiento",
	"padre",
	"madre"
];
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
function read_age(value) {
	if (value === void 0 || value === null || value === "") return null;
	const age = Number(value);
	if (!Number.isInteger(age) || age < 0 || age > 150) throw new ServiceError("La edad debe ser un número entre 0 y 150.", 400);
	return age;
}
function clean_person(person) {
	return {
		dni: clean_text(person.dni),
		nombres: clean_text(person.nombres) ?? "",
		apellido_paterno: clean_text(person.apellido_paterno) ?? "",
		apellido_materno: clean_text(person.apellido_materno) ?? "",
		fecha_nacimiento: clean_text(person.fecha_nacimiento),
		edad: read_age(person.edad),
		lugar_nacimiento: clean_text(person.lugar_nacimiento),
		padre: clean_text(person.padre),
		madre: clean_text(person.madre)
	};
}
function read_person(db, person_id) {
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
				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, edad, lugar_nacimiento, padre, madre)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), parish_id, row.dni, row.nombres, row.apellido_paterno, row.apellido_materno, row.fecha_nacimiento, row.edad, row.lugar_nacimiento, row.padre, row.madre);
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
	const insert = db.prepare(`INSERT INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`);
	for (const correction of corrections) insert.run(crypto.randomUUID(), person_id, sacrament_id, session.user_id, correction.campo_cambio, correction.valor_anterior, correction.valor_nuevo);
}
function name_condition(table_alias, column) {
	return `(${table_alias}.${column} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${table_alias}.id AND cp.campo_cambio = '${column}' AND cp.valor_anterior LIKE ?
	))`;
}
//#endregion
//#region electron/main/sync/records.ts
var MissingReferenceError = class extends Error {};
var GODPARENT_COLUMNS = ["padrino_1", "padrino_2"];
var MARRIAGE_COLUMNS = [
	"lugar",
	"testigo_1",
	"testigo_2",
	"testigo_3",
	"testigo_4",
	"conyuge_1_bautismo_parroquia",
	"conyuge_1_bautismo_fecha",
	"conyuge_2_bautismo_parroquia",
	"conyuge_2_bautismo_fecha"
];
function detail_columns(type) {
	if (type === "matrimonio") return MARRIAGE_COLUMNS;
	return GODPARENT_COLUMNS;
}
function allow_version_write(db, table, id) {
	db.prepare(`UPDATE ${table} SET version = -1 WHERE id = ?`).run(id);
}
function set_server_version(db, entity, client_id, version) {
	const table = entity === "ministro" ? "ministros" : "sacramentos";
	db.prepare(`UPDATE ${table} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, client_id, version);
}
function read_local_minister(db, client_id) {
	return db.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(client_id);
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
	const corrections = db.prepare(`SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio, c.valor_anterior, c.valor_nuevo, c.fecha_cambio
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
		cambios: corrections
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
	if (force) {
		const kept_ids = JSON.stringify(record.cambios.map((correction) => correction.client_id));
		db.prepare("DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(sacrament_id, kept_ids);
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
	const insert = db.prepare(`INSERT INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (client_id) DO NOTHING`);
	for (const correction of record.cambios) insert.run(correction.client_id, local_person_ids.get(correction.persona_client_id), sacrament_id, correction.usuario_id, correction.campo_cambio, correction.valor_anterior, correction.valor_nuevo, correction.fecha_cambio);
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
	const free_username = db.prepare(`UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?`);
	const save_user = db.prepare(`INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
		 VALUES (@id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo)
		 ON CONFLICT (id) DO UPDATE SET
			parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo`);
	db.transaction(() => {
		for (const parish of data.parroquias) save_parish.run(parish);
		for (const minister of data.ministros) {
			adopt_minister.run(minister.client_id, `servidor-${minister.id}`);
			save_downloaded_minister(db, minister);
		}
		for (const user of data.usuarios) {
			free_username.run(user.username, user.id);
			save_user.run(user);
		}
		db.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)");
	})();
}
async function refresh_reference(db, request, token) {
	save_reference_data(db, await get_reference(request, token));
}
function save_push_result(db, row, result) {
	db.transaction(() => {
		if (result.estado === "conflicto" || result.estado === "rechazado") {
			db.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(result.estado, result.motivo, row.id);
			return;
		}
		if (db.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(row.id).revision === row.revision) {
			remove_from_queue(db, row.entidad, row.client_id);
			set_server_version(db, row.entidad, row.client_id, result.version);
		} else db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
	})();
}
async function push_pending(db, request, token) {
	const pending_ids = db.prepare(`SELECT id FROM sync_cola WHERE estado <> 'conflicto' ORDER BY entidad = 'ministro' DESC, id`).pluck().all();
	const read_row = db.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let start = 0; start < pending_ids.length; start += 15) {
		const rows = [];
		for (const id of pending_ids.slice(start, start + 15)) {
			const row = read_row.get(id);
			if (row && row.estado !== "conflicto") rows.push(row);
		}
		if (rows.length === 0) continue;
		const response = await push_changes(request, token, rows.map((row) => {
			const data = row.entidad === "ministro" ? read_local_minister(db, row.client_id) : read_local_record(db, row.client_id);
			return {
				entidad: row.entidad,
				client_id: row.client_id,
				version_base: row.version_base,
				cola_id: row.cola_id,
				datos: data
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
			if (key) await upload_key_copy(db, database_paths(), key, remote_request, token, current_session()?.parish_id ?? null).catch((error$4) => {
				error("No se pudo subir la copia de la clave:", error$4);
			});
		});
		if (completed) mode = "en-linea";
	} catch (error$5) {
		if (is_connection_error(error$5)) {
			mode = "sin-conexion";
			return;
		}
		error("Falló la sincronización:", error$5);
		mode = "error";
		last_error = error$5 instanceof ServiceError ? error$5.message : "Ocurrió un error al sincronizar.";
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
			nombre_completo: full_name(row.nombre, row.apellido_paterno, row.apellido_materno)
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
async function login_offline(username, password) {
	const result = await verify_offline(get_database(), username, password);
	if (!result.ok) {
		if (result.reason === "sin-credencial") throw new ServiceError("Sin conexión: este usuario debe iniciar sesión con internet la primera vez en esta PC.", 401);
		throw new ServiceError("Usuario o contraseña incorrectos.", 401);
	}
	const user = result.usuario;
	start_session({
		user_id: user.id,
		role: user.rol,
		parish_id: user.parroquia_id,
		token: ""
	}, username, password);
	start_auto_sync("sin-conexion");
	return {
		token: OFFLINE_TOKEN,
		usuario: user
	};
}
async function login(payload) {
	let response;
	try {
		response = await request_login(remote_request, payload.username, payload.password);
	} catch (error) {
		if (is_connection_error(error)) return login_offline(payload.username, payload.password);
		throw error;
	}
	return login_online(response, payload.username, payload.password);
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
var SORT_COLUMNS = {
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
	check_parish_access(session, minister.parroquia_id, "No tiene permiso para modificar ministros de otra parroquia.");
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
	const sort_column = SORT_COLUMNS[filters.orden ?? "nombres"] ?? SORT_COLUMNS.nombres;
	return {
		resultados: db.prepare(`SELECT id FROM ministros ${where}
			 ORDER BY ${sort_column} ${sort_direction(filters)}, id
			 LIMIT ? OFFSET ?`).pluck().all(...values, 20, page.offset).map((id) => read_minister(db, id)),
		total_paginas: page.total_pages
	};
}
function create_minister(db, session, minister) {
	const parish_id = parish_for_new(session, minister?.parroquia_id);
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
	check_parish_access(session, parish_id, "Solo puede cambiar el logo de su propia parroquia.");
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
//#region electron/main/controllers/sacrament_index.ts
var compare_text = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: true
}).compare;
function check_request(session, type, parish_id) {
	if (!is_sacrament_type(type)) throw new ServiceError("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(parish_id) || parish_id <= 0) throw new ServiceError("Debe especificar la parroquia.", 400);
	check_parish_access(session, parish_id, "No tiene permiso para imprimir el índice de otra parroquia.");
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
var NOT_FOUND = "Partida no encontrada.";
function check_type(value) {
	if (!is_sacrament_type(value)) throw new ServiceError("Tipo de sacramento inválido.", 400);
	return value;
}
function read_person_sacrament(db, type, sacrament_id) {
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== type) throw new ServiceError(NOT_FOUND, 404);
	const detail = db.prepare(`SELECT * FROM ${detail_table(type)} WHERE sacramento_id = ?`).get(sacrament_id);
	return {
		sacramento: sacrament,
		persona: read_person(db, detail.persona_id),
		padrino_1: detail.padrino_1,
		padrino_2: detail.padrino_2
	};
}
function read_marriage(db, sacrament_id) {
	const sacrament = read_sacrament(db, sacrament_id);
	if (!sacrament || sacrament.tipo !== "matrimonio") throw new ServiceError(NOT_FOUND, 404);
	const detail = db.prepare("SELECT * FROM matrimonios WHERE sacramento_id = ?").get(sacrament_id);
	return {
		sacramento: sacrament,
		conyuge_1: read_person(db, detail.conyuge_1_id),
		conyuge_2: read_person(db, detail.conyuge_2_id),
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
	if (!row) throw new ServiceError(NOT_FOUND, 404);
	if (row.tipo === "matrimonio") return read_marriage(db, sacrament_id);
	return read_person_sacrament(db, row.tipo, sacrament_id);
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
function queue_sacrament(db, sacrament_id) {
	const current = db.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(sacrament_id);
	add_to_queue(db, current.tipo, current.client_id, current.version);
}
function create_sacrament(db, type, parish_id, sacrament) {
	const client_id = crypto.randomUUID();
	add_to_queue(db, type, client_id, null);
	return insert_sacrament(db, client_id, type, parish_id, sacrament);
}
function annul_sacrament(db, session, sacrament_id, reason) {
	const row = db.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(sacrament_id);
	if (!row) throw new ServiceError(NOT_FOUND, 404);
	check_can_manage(db, session, sacrament_id, row.tipo);
	const clean_reason = clean_text(reason);
	if (!clean_reason) throw new ServiceError("El motivo de anulación es requerido.", 400);
	db.transaction(() => {
		queue_sacrament(db, sacrament_id);
		db.prepare(`UPDATE sacramentos
			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
			 WHERE id = ?`).run(session.user_id, (/* @__PURE__ */ new Date()).toISOString(), clean_reason, sacrament_id);
	})();
}
function check_names(person) {
	if (!clean_text(person?.nombres) || !clean_text(person?.apellido_paterno) || !clean_text(person?.apellido_materno)) throw new ServiceError("Nombre y apellidos son requeridos.", 400);
}
function create_person_sacrament(db, type, session, record) {
	const parish_id = parish_for_new(session, record.sacramento?.parroquia_id);
	check_names(record.persona);
	const corrected = apply_corrections(record.persona);
	return db.transaction(() => {
		const person_id = insert_person(db, parish_id, corrected.person);
		const sacrament_id = create_sacrament(db, type, parish_id, record.sacramento);
		db.prepare(`INSERT INTO ${detail_table(type)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(sacrament_id, person_id, clean_text(record.padrino_1), clean_text(record.padrino_2));
		save_corrections(db, session, person_id, sacrament_id, corrected.corrections);
		return sacrament_id;
	})();
}
function update_person_sacrament(db, type, session, record) {
	const id = positive_id(record.sacramento?.id);
	check_can_manage(db, session, id, type);
	check_names(record.persona);
	const corrected = apply_corrections(record.persona);
	const table = detail_table(type);
	db.transaction(() => {
		queue_sacrament(db, id);
		const row = db.prepare(`SELECT persona_id FROM ${table} WHERE sacramento_id = ?`).get(id);
		update_person(db, row.persona_id, corrected.person);
		save_corrections(db, session, row.persona_id, id, corrected.corrections);
		update_sacrament(db, id, record.sacramento);
		db.prepare(`UPDATE ${table} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(clean_text(record.padrino_1), clean_text(record.padrino_2), id);
	})();
}
function check_spouses(record) {
	if (!clean_text(record.conyuge_1?.nombres) || !clean_text(record.conyuge_2?.nombres)) throw new ServiceError("Los nombres de ambos cónyuges son requeridos.", 400);
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
function create_marriage(db, session, record) {
	const parish_id = parish_for_new(session, record.sacramento?.parroquia_id);
	check_spouses(record);
	const husband = apply_corrections(record.conyuge_1);
	const wife = apply_corrections(record.conyuge_2);
	return db.transaction(() => {
		const husband_id = insert_person(db, parish_id, husband.person);
		const wife_id = insert_person(db, parish_id, wife.person);
		const sacrament_id = create_sacrament(db, "matrimonio", parish_id, record.sacramento);
		db.prepare(`INSERT INTO matrimonios
				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sacrament_id, husband_id, wife_id, ...marriage_values(record));
		save_corrections(db, session, husband_id, sacrament_id, husband.corrections);
		save_corrections(db, session, wife_id, sacrament_id, wife.corrections);
		return sacrament_id;
	})();
}
function update_marriage(db, session, record) {
	const id = positive_id(record.sacramento?.id);
	check_can_manage(db, session, id, "matrimonio");
	check_spouses(record);
	const husband = apply_corrections(record.conyuge_1);
	const wife = apply_corrections(record.conyuge_2);
	db.transaction(() => {
		queue_sacrament(db, id);
		const spouses = db.prepare("SELECT conyuge_1_id, conyuge_2_id FROM matrimonios WHERE sacramento_id = ?").get(id);
		update_person(db, spouses.conyuge_1_id, husband.person);
		update_person(db, spouses.conyuge_2_id, wife.person);
		save_corrections(db, session, spouses.conyuge_1_id, id, husband.corrections);
		save_corrections(db, session, spouses.conyuge_2_id, id, wife.corrections);
		update_sacrament(db, id, record.sacramento);
		db.prepare(`UPDATE matrimonios SET
				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
			 WHERE sacramento_id = ?`).run(...marriage_values(record), id);
	})();
}
function create_record(db, session, record) {
	const type = check_type(record?.sacramento?.tipo);
	if (type === "matrimonio") return create_marriage(db, session, record);
	return create_person_sacrament(db, type, session, record);
}
function update_record(db, session, record) {
	const type = check_type(record?.sacramento?.tipo);
	if (type === "matrimonio") update_marriage(db, session, record);
	else update_person_sacrament(db, type, session, record);
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
	const people = db.prepare(`SELECT s.tipo, ${EVENT_DATE} AS fecha, pe.fecha_nacimiento, pe.edad
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
			const age = age_at(person.fecha_nacimiento, person.fecha) ?? person.edad;
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
				COALESCE(SUM(s.estado = 'vigente' AND s.ministro_id IS NULL), 0) AS sinCelebrante,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id)), 0) AS conCorrecciones
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
		...sync_routes
	}, login_routes);
}
function setup() {
	ipcMain.handle("app:get-version", () => app.getVersion());
	register_routes();
	try {
		open_at_startup();
	} catch (error$1) {
		error("No se pudo abrir la base local:", error$1);
	}
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
