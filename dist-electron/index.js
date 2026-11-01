import { BrowserWindow, app, ipcMain, safeStorage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import Database from "better-sqlite3-multiple-ciphers";
//#region electron/main/localDb/key.ts
function assertSecureStorage() {
	if (!safeStorage.isEncryptionAvailable()) throw new Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
}
/** null si falta el archivo o Windows ya no puede descifrarlo, por ejemplo tras reinstalarlo. */
function readDatabaseKey(keyPath) {
	assertSecureStorage();
	if (!existsSync(keyPath)) return null;
	try {
		return safeStorage.decryptString(readFileSync(keyPath));
	} catch {
		return null;
	}
}
function writeDatabaseKey(keyPath, key) {
	assertSecureStorage();
	writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 384 });
}
//#endregion
//#region electron/main/services/syncQueue.ts
/** Debe llamarse en la misma transacción que guarda el cambio y antes de modificar el registro. */
function enqueueChange(db, entidad, clientId, versionBase) {
	db.prepare(`INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)
     ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1`).run(entidad, clientId, versionBase, crypto.randomUUID());
}
function isQueued(db, entidad, clientId) {
	return db.prepare("SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?").get(entidad, clientId) !== void 0;
}
function removeFromQueue(db, entidad, clientId) {
	db.prepare("DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?").run(entidad, clientId);
}
//#endregion
//#region electron/main/services/common.ts
var ServiceError = class extends Error {
	status;
	constructor(message, status) {
		super(message);
		this.name = "ServiceError";
		this.status = status;
	}
};
function text(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}
function positiveId(value, notFound = "Partida") {
	if (!Number.isInteger(value) || value <= 0) throw new ServiceError(notFound === "Partida" ? "Partida no encontrada." : "Ministro no encontrado.", 404);
	return value;
}
function pagination(filters, total) {
	return {
		offset: ((Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1) - 1) * 20,
		totalPages: Math.max(1, Math.ceil(total / 20))
	};
}
function sortDirection(filters) {
	return filters.sortDirection === "desc" ? "DESC" : "ASC";
}
function targetParish(session, requestedParishId) {
	if (session.rol === "admin") {
		if (!Number.isInteger(requestedParishId) || requestedParishId <= 0) throw new ServiceError("Debe especificar la parroquia.", 400);
		return requestedParishId;
	}
	if (!session.parroquiaId) throw new ServiceError("El usuario no tiene una parroquia asignada.", 400);
	return session.parroquiaId;
}
function assertCanManage$1(db, session, sacramentId, tipo) {
	const sacrament = db.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(sacramentId, tipo);
	if (!sacrament) throw new ServiceError("Partida no encontrada.", 404);
	if (session.rol !== "admin" && sacrament.parroquia_id !== session.parroquiaId) throw new ServiceError("No tiene permiso para modificar partidas de otra parroquia.", 403);
}
function headerColumns(header, fechaEvento, anotaciones) {
	const fechaEmision = text(header.fechaSacramento);
	const libro = text(header.numeroLibro);
	const folio = text(header.numeroFolio);
	const numero = text(header.numeroRegistro);
	if (!fechaEmision || !libro || !folio || !numero) throw new ServiceError("La fecha, el libro, el folio y el número de registro son requeridos.", 400);
	return {
		fechaEmision,
		libro,
		folio,
		numero,
		ministroId: header.celebranteId ?? null,
		fechaEvento: text(fechaEvento),
		anotaciones: text(anotaciones)
	};
}
function insertSacrament(db, tipo, parroquiaId, header, fechaEvento, anotaciones) {
	const columns = headerColumns(header, fechaEvento, anotaciones);
	const clientId = crypto.randomUUID();
	enqueueChange(db, tipo, clientId, null);
	return Number(db.prepare(`INSERT INTO sacramentos
           (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(clientId, tipo, parroquiaId, columns.ministroId, columns.libro, columns.folio, columns.numero, columns.fechaEmision, columns.fechaEvento, columns.anotaciones).lastInsertRowid);
}
function enqueueSacramentChange(db, sacramentId) {
	const current = db.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(sacramentId);
	enqueueChange(db, current.tipo, current.client_id, current.version);
}
function updateSacrament(db, sacramentId, header, fechaEvento, anotaciones) {
	const columns = headerColumns(header, fechaEvento, anotaciones);
	enqueueSacramentChange(db, sacramentId);
	db.prepare(`UPDATE sacramentos
     SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?
     WHERE id = ?`).run(columns.ministroId, columns.libro, columns.folio, columns.numero, columns.fechaEmision, columns.fechaEvento, columns.anotaciones, sacramentId);
}
function annulSacrament(db, session, sacramentId, tipo, motivo) {
	assertCanManage$1(db, session, sacramentId, tipo);
	const reason = text(motivo);
	if (!reason) throw new ServiceError("El motivo de anulación es requerido.", 400);
	db.transaction(() => {
		enqueueSacramentChange(db, sacramentId);
		db.prepare(`UPDATE sacramentos
       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
       WHERE id = ?`).run(session.usuarioId, (/* @__PURE__ */ new Date()).toISOString(), reason, sacramentId);
	})();
}
var HEADER_SELECT = `
  s.id, s.parroquia_id, par.nombre AS parroquia_nombre,
  s.fecha_emision AS fecha_sacramento, s.libro AS numero_libro, s.folio AS numero_folio,
  s.numero AS numero_registro, s.estado`;
var MINISTER_NAME_SELECT = `
  min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS celebrante_nombre`;
//#endregion
//#region electron/main/services/syncRecords.ts
var TIPOS = {
	bautismo: {
		tabla: "bautismos",
		personas: ["persona_id"],
		detalle: ["padrino_1", "padrino_2"]
	},
	confirmacion: {
		tabla: "confirmaciones",
		personas: ["persona_id"],
		detalle: ["padrino_1", "padrino_2"]
	},
	matrimonio: {
		tabla: "matrimonios",
		personas: ["conyuge_1_id", "conyuge_2_id"],
		detalle: [
			"lugar",
			"testigo_1",
			"testigo_2",
			"testigo_3",
			"testigo_4",
			"conyuge_1_bautismo_parroquia",
			"conyuge_1_bautismo_fecha",
			"conyuge_2_bautismo_parroquia",
			"conyuge_2_bautismo_fecha"
		]
	}
};
var CAMPOS_PERSONA = [
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
/** Los triggers suben version si no cambia: pasar por -1 permite fijar la que dicta el servidor. */
function prepareVersionWrite(db, tabla, id) {
	db.prepare(`UPDATE ${tabla} SET version = -1 WHERE id = ?`).run(id);
}
/** Fija la versión que asignó el servidor sin tocar los datos. */
function setServerVersion(db, entidad, clientId, version) {
	const tabla = entidad === "ministro" ? "ministros" : "sacramentos";
	db.prepare(`UPDATE ${tabla} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, clientId, version);
}
function readMinistro(db, clientId) {
	return db.prepare(`SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo
       FROM ministros WHERE client_id = ?`).get(clientId);
}
function readPartida(db, clientId) {
	const fila = db.prepare(`SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
              s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en,
              s.motivo_anulacion
       FROM sacramentos s LEFT JOIN ministros m ON m.id = s.ministro_id
       WHERE s.client_id = ?`).get(clientId);
	const config = TIPOS[fila.tipo];
	const subtipo = db.prepare(`SELECT * FROM ${config.tabla} WHERE sacramento_id = ?`).get(fila.id);
	const leerPersona = db.prepare(`SELECT client_id, ${CAMPOS_PERSONA.join(", ")} FROM personas WHERE id = ?`);
	const personas = config.personas.map((columna) => leerPersona.get(subtipo[columna]));
	const detalle = {};
	for (const columna of config.detalle) detalle[columna] = subtipo[columna];
	const cambios = db.prepare(`SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio,
              c.valor_anterior, c.valor_nuevo, c.fecha_cambio
       FROM cambios_persona c JOIN personas p ON p.id = c.persona_id
       WHERE c.sacramento_id = ? ORDER BY c.id`).all(fila.id);
	return {
		tipo: fila.tipo,
		client_id: fila.client_id,
		parroquia_id: fila.parroquia_id,
		ministro_client_id: fila.ministro_client_id,
		libro: fila.libro,
		folio: fila.folio,
		numero: fila.numero,
		fecha_emision: fila.fecha_emision,
		fecha_evento: fila.fecha_evento,
		anotaciones: fila.anotaciones,
		estado: fila.estado,
		anulado_por_usuario_id: fila.anulado_por_usuario_id,
		anulado_en: fila.anulado_en,
		motivo_anulacion: fila.motivo_anulacion,
		personas,
		detalle,
		cambios
	};
}
/** La partida cita algo que aún no está en esta base: se resuelve volviendo a descargar la referencia. */
var MissingReferenceError = class extends Error {};
function upsertPersona(db, parroquiaId, persona) {
	const valores = CAMPOS_PERSONA.map((campo) => persona[campo]);
	const actual = db.prepare("SELECT id FROM personas WHERE client_id = ?").get(persona.client_id);
	if (actual) {
		db.prepare(`UPDATE personas SET ${CAMPOS_PERSONA.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...valores, actual.id);
		return actual.id;
	}
	return Number(db.prepare(`INSERT INTO personas (client_id, parroquia_id, ${CAMPOS_PERSONA.join(", ")})
         VALUES (?, ?, ${CAMPOS_PERSONA.map(() => "?").join(", ")})`).run(persona.client_id, parroquiaId, ...valores).lastInsertRowid);
}
function localMinisterId(db, clientId) {
	if (!clientId) return null;
	const fila = db.prepare("SELECT id FROM ministros WHERE client_id = ?").get(clientId);
	if (!fila) throw new MissingReferenceError(`Ministro desconocido: ${clientId}`);
	return fila.id;
}
/**
* Guarda una partida descargada. Por defecto no toca la que tenga cambios sin subir: esos se
* resuelven en el servidor, y si otra PC la cambió quedará marcada como conflicto.
*/
function applyPartida(db, partida, options = {}) {
	const version = partida.version ?? 1;
	const local = db.prepare("SELECT id, version FROM sacramentos WHERE client_id = ?").get(partida.client_id);
	if (!options.force) {
		if (isQueued(db, partida.tipo, partida.client_id)) return;
		if (local?.version === version) return;
	}
	const config = TIPOS[partida.tipo];
	const ministroId = localMinisterId(db, partida.ministro_client_id);
	const personaIds = partida.personas.map((persona) => upsertPersona(db, partida.parroquia_id, persona));
	const cabecera = [
		ministroId,
		partida.libro,
		partida.folio,
		partida.numero,
		partida.fecha_emision,
		partida.fecha_evento,
		partida.anotaciones,
		partida.estado,
		partida.anulado_por_usuario_id,
		partida.anulado_en,
		partida.motivo_anulacion,
		version,
		partida.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
	];
	let sacramentoId;
	if (local) {
		sacramentoId = local.id;
		prepareVersionWrite(db, "sacramentos", local.id);
		db.prepare(`UPDATE sacramentos SET
         ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,
         estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?
       WHERE id = ?`).run(...cabecera, local.id);
	} else sacramentoId = Number(db.prepare(`INSERT INTO sacramentos
             (ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
              estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,
              client_id, tipo, parroquia_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...cabecera, partida.client_id, partida.tipo, partida.parroquia_id).lastInsertRowid);
	const columnas = [...config.personas, ...config.detalle];
	db.prepare(`INSERT INTO ${config.tabla} (sacramento_id, ${columnas.join(", ")})
     VALUES (?, ${columnas.map(() => "?").join(", ")})
     ON CONFLICT (sacramento_id) DO UPDATE SET ${columnas.map((c) => `${c} = excluded.${c}`).join(", ")}`).run(sacramentoId, ...personaIds, ...config.detalle.map((columna) => partida.detalle[columna] ?? null));
	const idPersona = new Map(partida.personas.map((persona, i) => [persona.client_id, personaIds[i]]));
	const insertarCambio = db.prepare(`INSERT INTO cambios_persona
       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (client_id) DO NOTHING`);
	for (const cambio of partida.cambios) insertarCambio.run(cambio.client_id, idPersona.get(cambio.persona_client_id), sacramentoId, cambio.usuario_id, cambio.campo_cambio, cambio.valor_anterior, cambio.valor_nuevo, cambio.fecha_cambio);
	if (options.force) {
		db.prepare(`DELETE FROM cambios_persona
       WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))`).run(sacramentoId, JSON.stringify(partida.cambios.map((cambio) => cambio.client_id)));
		removeFromQueue(db, partida.tipo, partida.client_id);
	}
}
var CAMPOS_MINISTRO = [
	"titulo",
	"nombre",
	"apellido_paterno",
	"apellido_materno",
	"activo"
];
function applyMinistro(db, ministro, options = {}) {
	const version = ministro.version ?? 1;
	const local = db.prepare(`SELECT id, version, ${CAMPOS_MINISTRO.join(", ")} FROM ministros WHERE client_id = ?`).get(ministro.client_id);
	if (!options.force && isQueued(db, "ministro", ministro.client_id)) {
		const iguales = local && CAMPOS_MINISTRO.every((campo) => (local[campo] ?? null) === (ministro[campo] ?? null));
		const fila = db.prepare("SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?").get("ministro", ministro.client_id);
		if (!iguales || fila.version_base !== null) return;
		removeFromQueue(db, "ministro", ministro.client_id);
		setServerVersion(db, "ministro", ministro.client_id, version);
		return;
	}
	if (!local) {
		db.prepare(`INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(ministro.client_id, ministro.parroquia_id, ministro.titulo ?? null, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno, ministro.activo, version, ministro.updated_at ?? (/* @__PURE__ */ new Date()).toISOString());
		return;
	}
	if (options.force || local.version !== version) {
		prepareVersionWrite(db, "ministros", local.id);
		db.prepare(`UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?
       WHERE id = ?`).run(ministro.titulo ?? null, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno, ministro.activo, version, ministro.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), local.id);
	}
	if (options.force) removeFromQueue(db, "ministro", ministro.client_id);
}
//#endregion
//#region electron/main/services/reference.ts
function listParishes(db) {
	return db.prepare("SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function applyReferenceData(db, data) {
	const parish = db.prepare(`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)
     ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa`);
	const adoptMinister = db.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?");
	const releaseUsername = db.prepare(`UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?`);
	const user = db.prepare(`INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
     VALUES (@id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo)
     ON CONFLICT (id) DO UPDATE SET
       parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
       apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo`);
	db.transaction(() => {
		data.parroquias.forEach((row) => parish.run(row));
		data.ministros.forEach((row) => {
			adoptMinister.run(row.client_id, `servidor-${row.id}`);
			applyMinistro(db, row);
		});
		data.usuarios.forEach((row) => {
			releaseUsername.run(row.username, row.id);
			user.run(row);
		});
		db.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)");
	})();
}
//#endregion
//#region electron/main/services/syncEngine.ts
/** Debe coincidir con MAX_CAMBIOS_POR_ENVIO en worker/src/services/syncService.ts. */
var PUSH_BATCH_SIZE = 20;
function getSyncValue(db, clave) {
	return db.prepare("SELECT valor FROM sync_estado WHERE clave = ?").get(clave)?.valor ?? null;
}
function setSyncValue(db, clave, valor) {
	db.prepare(`INSERT INTO sync_estado (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`).run(clave, valor);
}
async function refreshReference(db, request, token) {
	applyReferenceData(db, await request("/api/reference", { token }));
}
function applyResult(db, row, result) {
	db.transaction(() => {
		if (result.estado === "conflicto" || result.estado === "rechazado") {
			db.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(result.estado, result.motivo, row.id);
			return;
		}
		const { revision } = db.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(row.id);
		if (revision === row.revision) {
			removeFromQueue(db, row.entidad, row.client_id);
			setServerVersion(db, row.entidad, row.client_id, result.version);
		} else db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
	})();
}
/** Sube lo pendiente. Los conflictos esperan a una persona; los rechazados se reintentan. */
async function pushPending(db, request, token) {
	const pending = db.prepare(`SELECT id FROM sync_cola WHERE estado <> 'conflicto' ORDER BY entidad = 'ministro' DESC, id`).pluck().all();
	const selectRow = db.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let start = 0; start < pending.length; start += PUSH_BATCH_SIZE) {
		const rows = pending.slice(start, start + PUSH_BATCH_SIZE).map((id) => selectRow.get(id)).filter((row) => row !== void 0 && row.estado !== "conflicto");
		if (rows.length === 0) continue;
		const { resultados } = await request("/api/sync/push", {
			method: "POST",
			body: { cambios: rows.map((row) => ({
				entidad: row.entidad,
				client_id: row.client_id,
				version_base: row.version_base,
				cola_id: row.cola_id,
				datos: row.entidad === "ministro" ? readMinistro(db, row.client_id) : readPartida(db, row.client_id)
			})) },
			token
		});
		rows.forEach((row, index) => {
			if (resultados[index]) applyResult(db, row, resultados[index]);
		});
	}
}
function applyPage(db, page) {
	db.transaction(() => {
		page.partidas.forEach((partida) => applyPartida(db, partida));
		setSyncValue(db, "cursor", String(page.cursor));
	})();
}
var isMissingReference = (error) => error instanceof MissingReferenceError || error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
/** Cada página se guarda entera junto con su cursor: un corte solo obliga a repetir la siguiente. */
async function pullChanges(db, request, token) {
	for (;;) {
		const cursor = getSyncValue(db, "cursor") ?? "0";
		const page = await request(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`, { token });
		try {
			applyPage(db, page);
		} catch (error) {
			if (!isMissingReference(error)) throw error;
			await refreshReference(db, request, token);
			applyPage(db, page);
		}
		if (!page.hayMas) return;
	}
}
async function runSync(db, request, token) {
	await refreshReference(db, request, token);
	await pushPending(db, request, token);
	await pullChanges(db, request, token);
	setSyncValue(db, "ultima_sync", (/* @__PURE__ */ new Date()).toISOString());
}
/** "servidor" descarta lo local; "local" vuelve a subirlo partiendo de la versión actual del servidor. */
async function resolveConflict(db, request, token, entidad, clientId, choice) {
	const { registro } = await request(`/api/sync/record?${`entidad=${encodeURIComponent(entidad)}&client_id=${encodeURIComponent(clientId)}`}`, { token });
	db.transaction(() => {
		if (choice === "local") db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?`).run(registro.version, entidad, clientId);
		else if (entidad === "ministro") applyMinistro(db, registro, { force: true });
		else applyPartida(db, registro, { force: true });
	})();
}
function describe(db, row) {
	if (row.entidad === "ministro") {
		const ministro = db.prepare("SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?").get(row.client_id);
		return `Ministro ${ministro?.nombre ?? ""} ${ministro?.apellido_paterno ?? ""}`.trim();
	}
	const partida = db.prepare("SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?").get(row.client_id);
	const tipo = {
		bautismo: "Bautismo",
		confirmacion: "Confirmación",
		matrimonio: "Matrimonio"
	}[row.entidad];
	return partida ? `${tipo}: libro ${partida.libro}, folio ${partida.folio}, registro ${partida.numero}` : tipo;
}
function readQueueSummary(db) {
	const counts = db.prepare("SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado").all();
	const total = (estado) => counts.find((row) => row.estado === estado)?.total ?? 0;
	const problemas = db.prepare(`SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id`).all();
	return {
		pendientes: total("pendiente"),
		conflictos: total("conflicto"),
		rechazados: total("rechazado"),
		ultimaSync: getSyncValue(db, "ultima_sync"),
		aviso: getSyncValue(db, "aviso"),
		items: problemas.map((row) => ({
			entidad: row.entidad,
			client_id: row.client_id,
			estado: row.estado,
			motivo: row.motivo,
			descripcion: describe(db, row)
		}))
	};
}
//#endregion
//#region electron/main/localDb/schema.ts
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
//#region electron/main/localDb/database.ts
var HEX_KEY = /^[0-9a-f]{64}$/i;
var NewerDatabaseError = class extends Error {};
function migrate(db, migrations) {
	const current = db.pragma("user_version", { simple: true });
	if (current > migrations.length) throw new NewerDatabaseError(`La base local está en la versión ${current} y esta app solo conoce hasta la ${migrations.length}.`);
	db.pragma("foreign_keys = OFF");
	migrations.slice(current).forEach((sql, index) => {
		db.transaction(() => {
			db.exec(sql);
			if (db.pragma("foreign_key_check").length > 0) throw new Error("La migración dejó claves foráneas rotas.");
			db.pragma(`user_version = ${current + index + 1}`);
		})();
	});
	db.pragma("foreign_keys = ON");
}
function openLocalDatabase(filePath, hexKey, migrations = LOCAL_MIGRATIONS) {
	if (!HEX_KEY.test(hexKey)) throw new Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	const db = new Database(filePath);
	try {
		db.pragma(`cipher='chacha20'`);
		db.pragma(`hexkey='${hexKey}'`);
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
//#endregion
//#region electron/main/localDb/recovery.ts
var RETENCION_APARTADAS_MS = 2592e6;
var AVISO_RECONSTRUIDA = "La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.";
function localPaths(directory) {
	return {
		directory,
		database: path.join(directory, "prelatura-local.db"),
		key: path.join(directory, "prelatura-local.key"),
		device: path.join(directory, "prelatura-dispositivo.id"),
		tempDatabase: path.join(directory, "prelatura-reconstruccion.db"),
		tempKey: path.join(directory, "prelatura-reconstruccion.key"),
		setAside: path.join(directory, "bases-apartadas")
	};
}
var newKey = () => randomBytes(32).toString("hex");
/** Identifica a esta PC ante el servidor. No es secreto y debe sobrevivir a la pérdida de la base. */
function deviceId(paths) {
	if (existsSync(paths.device)) return readFileSync(paths.device, "utf8").trim();
	const id = randomUUID();
	writeFileSync(paths.device, id);
	return id;
}
function isUnreadable(error) {
	const code = error?.code ?? "";
	return code.startsWith("SQLITE_NOTADB") || code.startsWith("SQLITE_CORRUPT");
}
/** Abre la base al iniciar. Sin clave válida no se toca nada: la recuperación exige un login online. */
function openOrDetect(paths, keys) {
	pruneSetAside(paths);
	const key = keys.read(paths.key);
	if (!existsSync(paths.database)) {
		const created = key ?? newKey();
		const db = openLocalDatabase(paths.database, created);
		if (!key) keys.write(paths.key, created);
		return {
			status: "open",
			db,
			key: created
		};
	}
	if (!key) return { status: "needs-recovery" };
	try {
		const db = openLocalDatabase(paths.database, key);
		removeWithSidecars(paths.tempDatabase);
		rmSync(paths.tempKey, { force: true });
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
		if (isUnreadable(error)) return { status: "needs-recovery" };
		throw error;
	}
}
function moveWithSidecars(from, to) {
	for (const suffix of [
		"",
		"-wal",
		"-shm"
	]) if (existsSync(from + suffix)) renameSync(from + suffix, to + suffix);
}
function removeWithSidecars(file) {
	for (const suffix of [
		"",
		"-wal",
		"-shm"
	]) rmSync(file + suffix, { force: true });
}
/** Conserva solo la última base apartada, y como mucho 30 días: guarda datos personales. */
function pruneSetAside(paths) {
	if (!existsSync(paths.setAside)) return;
	readdirSync(paths.setAside).filter((name) => name.endsWith(".db")).sort().reverse().forEach((name, index) => {
		const file = path.join(paths.setAside, name);
		if (index > 0 || Date.now() - statSync(file).mtimeMs > RETENCION_APARTADAS_MS) removeWithSidecars(file);
	});
}
function setAside(paths) {
	if (!existsSync(paths.database)) return;
	mkdirSync(paths.setAside, { recursive: true });
	const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	moveWithSidecars(paths.database, path.join(paths.setAside, `prelatura-local-${stamp}.db`));
	pruneSetAside(paths);
}
async function fetchKeyCopy(paths, request, token) {
	try {
		const { clave } = await request(`/api/devices/${deviceId(paths)}/key`, { token });
		return clave;
	} catch (error) {
		if (error instanceof ServiceError && error.status === 404) return null;
		throw error;
	}
}
/** La base nueva se arma aparte y solo reemplaza a la anterior cuando la descarga termina. */
async function rebuild(paths, keys, request, token) {
	let key = keys.read(paths.tempKey);
	if (!key || !existsSync(paths.tempDatabase)) {
		removeWithSidecars(paths.tempDatabase);
		key = newKey();
		keys.write(paths.tempKey, key);
	}
	let temp;
	try {
		temp = openLocalDatabase(paths.tempDatabase, key);
	} catch (error) {
		if (!isUnreadable(error)) throw error;
		removeWithSidecars(paths.tempDatabase);
		temp = openLocalDatabase(paths.tempDatabase, key);
	}
	try {
		await refreshReference(temp, request, token);
		await pullChanges(temp, request, token);
		setSyncValue(temp, "ultima_sync", (/* @__PURE__ */ new Date()).toISOString());
		setSyncValue(temp, "aviso", AVISO_RECONSTRUIDA);
		setSyncValue(temp, "clave_registrada", null);
	} finally {
		temp.close();
	}
	setAside(paths);
	moveWithSidecars(paths.tempDatabase, paths.database);
	keys.write(paths.key, key);
	rmSync(paths.tempKey, { force: true });
	return {
		db: openLocalDatabase(paths.database, key),
		key
	};
}
/** Requiere un login online: es lo que autoriza al servidor a entregar la copia de la clave. */
async function recoverLocalDatabase(paths, keys, request, token) {
	if (existsSync(paths.database)) {
		const copy = await fetchKeyCopy(paths, request, token);
		if (copy) try {
			const db = openLocalDatabase(paths.database, copy);
			keys.write(paths.key, copy);
			return {
				db,
				key: copy
			};
		} catch (error) {
			if (!isUnreadable(error)) throw error;
		}
	}
	return rebuild(paths, keys, request, token);
}
/** Sube la copia si falta, o si la registró un administrador y ya la usa una parroquia. */
async function uploadKeyCopy(db, paths, key, request, token, parroquiaId) {
	const registrada = getSyncValue(db, "clave_registrada");
	if (registrada && !(registrada === "admin" && parroquiaId !== null)) return;
	setSyncValue(db, "clave_registrada", (await request(`/api/devices/${deviceId(paths)}/key`, {
		method: "PUT",
		body: { clave: key },
		token
	})).parroquiaId === null ? "admin" : "parroquia");
}
//#endregion
//#region electron/main/localDb/index.ts
var keyStore = {
	read: readDatabaseKey,
	write: writeDatabaseKey
};
var localDb = null;
var currentKey = null;
var needsRecovery = false;
var unavailableMessage = "La base local no está disponible.";
var paths = () => localPaths(app.getPath("userData"));
function initLocalDatabase() {
	const result = openOrDetect(paths(), keyStore);
	if (result.status === "open") {
		localDb = result.db;
		currentKey = result.key;
	} else if (result.status === "needs-recovery") {
		needsRecovery = true;
		unavailableMessage = "La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.";
	} else unavailableMessage = result.message;
}
function getLocalDb() {
	if (!localDb) throw new ServiceError(unavailableMessage, 503);
	return localDb;
}
function localDatabaseNeedsRecovery() {
	return needsRecovery;
}
async function recoverLocalDb(request, token) {
	const recovered = await recoverLocalDatabase(paths(), keyStore, request, token);
	localDb = recovered.db;
	currentKey = recovered.key;
	needsRecovery = false;
}
async function uploadCurrentKeyCopy(request, token, parroquiaId) {
	if (!localDb || !currentKey) return;
	await uploadKeyCopy(localDb, paths(), currentKey, request, token, parroquiaId);
}
function closeLocalDatabase() {
	localDb?.close();
	localDb = null;
	currentKey = null;
}
//#endregion
//#region electron/shared/index.ts
var LOCAL_REQUEST_CHANNEL = "local:request";
/** Marca una sesión iniciada sin internet: aún no hay token del servidor. */
var OFFLINE_TOKEN = "sin-conexion";
//#endregion
//#region electron/main/services/people.ts
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
function parseAge(value) {
	if (value === void 0 || value === null || value === "") return null;
	const age = Number(value);
	if (!Number.isInteger(age) || age < 0 || age > 150) throw new ServiceError("La edad debe ser un número entre 0 y 150.", 400);
	return age;
}
function toRow(input) {
	return {
		dni: text(input.dni),
		nombres: text(input.nombre) ?? "",
		apellido_paterno: text(input.apellidoPaterno) ?? "",
		apellido_materno: text(input.apellidoMaterno) ?? "",
		fecha_nacimiento: text(input.fechaNacimiento),
		edad: parseAge(input.edad),
		lugar_nacimiento: text(input.lugarNacimiento),
		padre: text(input.padreNombre),
		madre: text(input.madreNombre)
	};
}
function insertPerson(db, parroquiaId, input) {
	const row = toRow(input);
	return Number(db.prepare(`INSERT INTO personas (client_id, parroquia_id, ${PERSON_COLUMNS.join(", ")})
         VALUES (?, ?, ${PERSON_COLUMNS.map(() => "?").join(", ")})`).run(crypto.randomUUID(), parroquiaId, ...PERSON_COLUMNS.map((column) => row[column])).lastInsertRowid);
}
function updatePersonWithHistory(db, session, personaId, sacramentoId, input) {
	const next = toRow(input);
	const current = db.prepare(`SELECT ${PERSON_COLUMNS.join(", ")} FROM personas WHERE id = ?`).get(personaId);
	const changed = PERSON_COLUMNS.filter((column) => current[column] !== next[column]);
	if (changed.length === 0) return;
	const history = db.prepare(`INSERT INTO cambios_persona
       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`);
	const asText = (value) => value === null ? null : String(value);
	for (const column of changed) history.run(crypto.randomUUID(), personaId, sacramentoId, session.usuarioId, column, asText(current[column]), asText(next[column]));
	db.prepare(`UPDATE personas SET ${changed.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`).run(...changed.map((column) => next[column]), personaId);
}
function nameMatch(alias, column) {
	return `(${alias}.${column} LIKE ? OR EXISTS (
    SELECT 1 FROM cambios_persona cp
    WHERE cp.persona_id = ${alias}.id AND cp.campo_cambio = '${column}' AND cp.valor_anterior LIKE ?
  ))`;
}
//#endregion
//#region electron/main/services/marriages.ts
var SORT_COLUMNS$2 = {
	nombre: "c1.nombres",
	apellido_paterno: "c1.apellido_paterno",
	apellido_materno: "c1.apellido_materno"
};
function requireSpouses(input) {
	if (!text(input.esposo?.nombre) || !text(input.esposa?.nombre)) throw new ServiceError("Los nombres de ambos cónyuges son requeridos.", 400);
	return {
		esposo: input.esposo,
		esposa: input.esposa
	};
}
function detailValues(input, esposo, esposa) {
	return [
		text(input.lugarMatrimonio),
		text(input.testigo1),
		text(input.testigo2),
		text(input.testigo3),
		text(input.testigo4),
		text(esposo.parroquiaBautismo),
		text(esposo.fechaBautismo),
		text(esposa.parroquiaBautismo),
		text(esposa.fechaBautismo)
	];
}
function spouseSelect(alias, prefix, number) {
	return `
    ${alias}.dni AS ${prefix}_dni, ${alias}.nombres AS ${prefix}_nombre,
    ${alias}.apellido_paterno AS ${prefix}_apellido_paterno,
    ${alias}.apellido_materno AS ${prefix}_apellido_materno,
    ${alias}.fecha_nacimiento AS ${prefix}_fecha_nacimiento, ${alias}.edad AS ${prefix}_edad,
    ${alias}.lugar_nacimiento AS ${prefix}_lugar_nacimiento,
    ${alias}.padre AS ${prefix}_padre_nombre, ${alias}.madre AS ${prefix}_madre_nombre,
    m.conyuge_${number}_bautismo_parroquia AS ${prefix}_parroquia_bautismo,
    m.conyuge_${number}_bautismo_fecha AS ${prefix}_fecha_bautismo`;
}
var marriages = {
	search(db, filters) {
		const conditions = [];
		const params = [];
		const add = (value, column) => {
			if (!value) return;
			conditions.push(`(${nameMatch("c1", column)} OR ${nameMatch("c2", column)})`);
			params.push(`%${value}%`, `%${value}%`, `%${value}%`, `%${value}%`);
		};
		add(filters.nombre, "nombres");
		add(filters.apellidoPaterno, "apellido_paterno");
		add(filters.apellidoMaterno, "apellido_materno");
		const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const from = `FROM matrimonios m
      JOIN sacramentos s ON s.id = m.sacramento_id
      JOIN personas c1 ON c1.id = m.conyuge_1_id
      JOIN personas c2 ON c2.id = m.conyuge_2_id
      JOIN parroquias par ON par.id = s.parroquia_id`;
		const { total } = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...params);
		const { offset, totalPages } = pagination(filters, total);
		const sortColumn = SORT_COLUMNS$2[filters.sortBy ?? ""] ?? SORT_COLUMNS$2.nombre;
		return {
			rows: db.prepare(`SELECT ${HEADER_SELECT},
                c1.nombres AS esposo_nombre, c1.apellido_paterno AS esposo_apellido_paterno,
                c1.apellido_materno AS esposo_apellido_materno,
                c2.nombres AS esposa_nombre, c2.apellido_paterno AS esposa_apellido_paterno,
                c2.apellido_materno AS esposa_apellido_materno
         ${from} ${where}
         ORDER BY ${sortColumn} ${sortDirection(filters)}, s.id
         LIMIT ? OFFSET ?`).all(...params, 20, offset),
			totalPages
		};
	},
	getById(db, id) {
		const row = db.prepare(`SELECT ${HEADER_SELECT}, ${MINISTER_NAME_SELECT},
                s.fecha_evento AS fecha_matrimonio, s.ministro_id AS celebrante_id,
                s.anotaciones AS notas_marginales,
                s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                m.lugar AS lugar_matrimonio, m.testigo_1, m.testigo_2, m.testigo_3, m.testigo_4,
                ${spouseSelect("c1", "esposo", 1)},
                ${spouseSelect("c2", "esposa", 2)}
         FROM matrimonios m
         JOIN sacramentos s ON s.id = m.sacramento_id
         JOIN personas c1 ON c1.id = m.conyuge_1_id
         JOIN personas c2 ON c2.id = m.conyuge_2_id
         JOIN parroquias par ON par.id = s.parroquia_id
         LEFT JOIN ministros min ON min.id = s.ministro_id
         WHERE s.id = ?`).get(id);
		if (!row) throw new ServiceError("Partida no encontrada.", 404);
		return row;
	},
	create(db, session, input, requestedParishId) {
		const parroquiaId = targetParish(session, requestedParishId);
		const { esposo, esposa } = requireSpouses(input);
		return db.transaction(() => {
			const conyuge1 = insertPerson(db, parroquiaId, esposo);
			const conyuge2 = insertPerson(db, parroquiaId, esposa);
			const sacramentId = insertSacrament(db, "matrimonio", parroquiaId, input, input.fechaMatrimonio, input.notasMarginales);
			db.prepare(`INSERT INTO matrimonios (
           sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,
           conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha,
           conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sacramentId, conyuge1, conyuge2, ...detailValues(input, esposo, esposa));
			return sacramentId;
		})();
	},
	update(db, session, id, input) {
		assertCanManage$1(db, session, id, "matrimonio");
		const { esposo, esposa } = requireSpouses(input);
		db.transaction(() => {
			const current = db.prepare("SELECT conyuge_1_id, conyuge_2_id FROM matrimonios WHERE sacramento_id = ?").get(id);
			updatePersonWithHistory(db, session, current.conyuge_1_id, id, esposo);
			updatePersonWithHistory(db, session, current.conyuge_2_id, id, esposa);
			updateSacrament(db, id, input, input.fechaMatrimonio, input.notasMarginales);
			db.prepare(`UPDATE matrimonios SET
           lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,
           conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,
           conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?
         WHERE sacramento_id = ?`).run(...detailValues(input, esposo, esposa), id);
		})();
	},
	annul(db, session, id, motivo) {
		annulSacrament(db, session, id, "matrimonio", motivo);
	}
};
//#endregion
//#region electron/main/services/ministers.ts
var SORT_COLUMNS$1 = {
	nombre: "min.nombre",
	apellido_paterno: "min.apellido_paterno",
	apellido_materno: "min.apellido_materno"
};
function requiredNames(input) {
	const nombre = text(input.nombre);
	const apellidoPaterno = text(input.apellidoPaterno);
	const apellidoMaterno = text(input.apellidoMaterno);
	if (!nombre || !apellidoPaterno || !apellidoMaterno) throw new ServiceError("Nombre y apellidos son requeridos.", 400);
	return {
		titulo: text(input.titulo),
		nombre,
		apellidoPaterno,
		apellidoMaterno
	};
}
function assertCanManage(db, session, id) {
	const minister = db.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(id);
	if (!minister) throw new ServiceError("Ministro no encontrado.", 404);
	if (session.rol !== "admin" && minister.parroquia_id !== session.parroquiaId) throw new ServiceError("No tiene permiso para modificar ministros de otra parroquia.", 403);
}
function enqueueMinisterChange(db, id) {
	const current = db.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(id);
	enqueueChange(db, "ministro", current.client_id, current.version);
}
var ministers = {
	search(db, filters) {
		const conditions = [];
		const params = [];
		const add = (value, column) => {
			if (!value) return;
			conditions.push(`min.${column} LIKE ?`);
			params.push(`%${value}%`);
		};
		add(filters.nombre, "nombre");
		add(filters.apellidoPaterno, "apellido_paterno");
		add(filters.apellidoMaterno, "apellido_materno");
		const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ministros min ${where}`).get(...params);
		const { offset, totalPages } = pagination(filters, total);
		const sortColumn = SORT_COLUMNS$1[filters.sortBy ?? ""] ?? SORT_COLUMNS$1.nombre;
		return {
			priests: db.prepare(`SELECT min.id, min.titulo, min.nombre, min.apellido_paterno, min.apellido_materno,
                min.parroquia_id, par.nombre AS parroquia_nombre, min.activo
         FROM ministros min
         JOIN parroquias par ON par.id = min.parroquia_id
         ${where}
         ORDER BY ${sortColumn} ${sortDirection(filters)}, min.id
         LIMIT ? OFFSET ?`).all(...params, 20, offset),
			totalPages
		};
	},
	create(db, session, input, requestedParishId) {
		const parroquiaId = targetParish(session, requestedParishId);
		const values = requiredNames(input);
		const clientId = crypto.randomUUID();
		return db.transaction(() => {
			enqueueChange(db, "ministro", clientId, null);
			return Number(db.prepare(`INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno)
             VALUES (?, ?, ?, ?, ?, ?)`).run(clientId, parroquiaId, values.titulo, values.nombre, values.apellidoPaterno, values.apellidoMaterno).lastInsertRowid);
		})();
	},
	update(db, session, id, input) {
		assertCanManage(db, session, id);
		const values = requiredNames(input);
		db.transaction(() => {
			enqueueMinisterChange(db, id);
			db.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(values.titulo, values.nombre, values.apellidoPaterno, values.apellidoMaterno, id);
		})();
	},
	toggleActive(db, session, id) {
		assertCanManage(db, session, id);
		db.transaction(() => {
			enqueueMinisterChange(db, id);
			db.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(id);
		})();
	}
};
//#endregion
//#region electron/main/services/sacramentIndex.ts
var PEOPLE = {
	bautismo: [{
		table: "bautismos",
		personColumn: "persona_id"
	}],
	confirmacion: [{
		table: "confirmaciones",
		personColumn: "persona_id"
	}],
	matrimonio: [{
		table: "matrimonios",
		personColumn: "conyuge_1_id"
	}, {
		table: "matrimonios",
		personColumn: "conyuge_2_id"
	}]
};
var compareText = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: true
}).compare;
function assertValidRequest(session, tipo, parroquiaId) {
	if (typeof tipo !== "string" || !Object.hasOwn(PEOPLE, tipo)) throw new ServiceError("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(parroquiaId) || parroquiaId <= 0) throw new ServiceError("Debe especificar la parroquia.", 400);
	if (session.rol !== "admin" && session.parroquiaId !== parroquiaId) throw new ServiceError("No tiene permiso para imprimir el índice de otra parroquia.", 403);
}
function listIndexBooks(db, session, tipo, parroquiaId) {
	assertValidRequest(session, tipo, parroquiaId);
	return db.prepare(`SELECT DISTINCT libro FROM sacramentos
       WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'`).pluck().all(tipo, parroquiaId).sort(compareText);
}
function getIndexEntries(db, session, tipo, parroquiaId, libro) {
	assertValidRequest(session, tipo, parroquiaId);
	return PEOPLE[tipo].flatMap(({ table, personColumn }) => db.prepare(`SELECT pe.nombres, pe.apellido_paterno AS apellidoPaterno, pe.apellido_materno AS apellidoMaterno,
                  s.libro, s.folio, s.numero AS registro
           FROM ${table} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.${personColumn}
           WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(parroquiaId, libro, libro)).sort((a, b) => compareText(a.apellidoPaterno, b.apellidoPaterno) || compareText(a.apellidoMaterno, b.apellidoMaterno) || compareText(a.nombres, b.nombres) || compareText(a.libro, b.libro) || compareText(a.folio, b.folio) || compareText(a.registro, b.registro));
}
//#endregion
//#region electron/main/services/credentials.ts
var KEY_LENGTH = 32;
var COST = {
	N: 2 ** 15,
	r: 8,
	p: 1,
	maxmem: 67108864
};
function derive(password, salt, options, length) {
	return new Promise((resolve, reject) => {
		scrypt(password.normalize("NFKC"), salt, length, options, (error, key) => error ? reject(error) : resolve(key));
	});
}
async function createVerifier(password) {
	const salt = randomBytes(16);
	const hash = await derive(password, salt, COST, KEY_LENGTH);
	return `scrypt:${COST.N}:${COST.r}:${COST.p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}
async function matchesVerifier(password, verifier) {
	const [scheme, N, r, p, salt, hash] = verifier.split(":");
	if (scheme !== "scrypt" || !salt || !hash) return false;
	const expected = Buffer.from(hash, "base64");
	const actual = await derive(password, Buffer.from(salt, "base64"), {
		N: Number(N),
		r: Number(r),
		p: Number(p),
		maxmem: COST.maxmem
	}, expected.length);
	return timingSafeEqual(actual, expected);
}
async function saveCredential(db, usuarioId, password) {
	const verifier = await createVerifier(password);
	db.prepare(`INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)
     ON CONFLICT (usuario_id) DO UPDATE SET
       verificador = excluded.verificador,
       actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`).run(usuarioId, verifier);
}
/** Una cuenta desactivada se conoce al sincronizar: desde entonces tampoco entra sin internet. */
async function verifyOffline(db, username, password) {
	const row = db.prepare(`SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
              c.verificador, p.nombre AS parroquia_nombre
       FROM usuarios u
       LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
       LEFT JOIN parroquias p ON p.id = u.parroquia_id
       WHERE u.username = ?`).get(username);
	if (!row?.verificador) return {
		ok: false,
		reason: "sin-credencial"
	};
	if (row.activo !== 1 || !await matchesVerifier(password, row.verificador)) return {
		ok: false,
		reason: "incorrecta"
	};
	return {
		ok: true,
		usuario: {
			id: row.id,
			rol: row.rol,
			parroquiaId: row.parroquia_id,
			parroquiaNombre: row.parroquia_nombre,
			nombreCompleto: [
				row.nombre,
				row.apellido_paterno,
				row.apellido_materno
			].filter(Boolean).join(" ")
		}
	};
}
//#endregion
//#region electron/main/services/remote.ts
/** PRELATURA_API_URL permite apuntar a otro servidor sin recompilar, por ejemplo en las pruebas. */
var WORKER_BASE_URL = process.env.PRELATURA_API_URL ?? void 0 ?? "http://localhost:8787";
var DEFAULT_TIMEOUT_MS = 3e4;
var CONNECTION_ERROR = "No se pudo conectar con el servidor. Verifique su conexión.";
var remoteRequest = async (path, options = {}) => {
	const { method = "GET", body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
	let response;
	let data;
	try {
		response = await fetch(`${WORKER_BASE_URL}${path}`, {
			method,
			headers: {
				...body === void 0 ? {} : { "Content-Type": "application/json" },
				...token ? { Authorization: `Bearer ${token}` } : {}
			},
			body: body === void 0 ? void 0 : JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs)
		});
		data = await response.json().catch(() => null);
	} catch {
		throw new ServiceError(CONNECTION_ERROR, 0);
	}
	if (!response.ok) throw new ServiceError(data?.message ? String(data.message) : "Ocurrió un error inesperado.", response.status);
	if (data === null) throw new ServiceError(CONNECTION_ERROR, 0);
	return data;
};
/** Sin conexión o con el servidor caído se puede seguir trabajando; un rechazo (4xx) no se ignora. */
function isConnectivityError(error) {
	return error instanceof ServiceError && (error.status === 0 || error.status >= 500);
}
//#endregion
//#region electron/main/services/session.ts
var LOGIN_TIMEOUT_MS = 1e4;
var SYNC_INTERVAL_MS = 3e5;
var session = null;
var credentials = null;
var mode = "sin-conexion";
var lastError = null;
var running = null;
var timer = null;
function requireSession() {
	if (!session) throw new ServiceError("Sesión no válida.", 401);
	return session;
}
function requestLogin(username, password) {
	return remoteRequest("/api/auth/login", {
		method: "POST",
		body: {
			username,
			password
		},
		timeoutMs: LOGIN_TIMEOUT_MS
	});
}
function startSession(next, username, password) {
	session = next;
	credentials = {
		username,
		password
	};
	timer ??= setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
}
async function loginOnline(response, username, password) {
	const { token, usuario } = response;
	if (localDatabaseNeedsRecovery()) await recoverLocalDb(remoteRequest, token);
	const db = getLocalDb();
	try {
		await refreshReference(db, remoteRequest, token);
	} catch (error) {
		if (!db.prepare("SELECT 1 FROM usuarios WHERE id = ?").get(usuario.id)) throw error;
	}
	await saveCredential(db, usuario.id, password);
	startSession({
		usuarioId: usuario.id,
		rol: usuario.rol,
		parroquiaId: usuario.parroquiaId,
		token
	}, username, password);
	mode = "en-linea";
	await syncNow();
	return response;
}
async function loginOffline(username, password) {
	const result = await verifyOffline(getLocalDb(), username, password);
	if (!result.ok) throw new ServiceError(result.reason === "sin-credencial" ? "Sin conexión: este usuario debe iniciar sesión con internet la primera vez en esta PC." : "Usuario o contraseña incorrectos.", 401);
	const { usuario } = result;
	startSession({
		usuarioId: usuario.id,
		rol: usuario.rol,
		parroquiaId: usuario.parroquiaId,
		token: ""
	}, username, password);
	mode = "sin-conexion";
	return {
		token: OFFLINE_TOKEN,
		usuario
	};
}
/** Primero online. La verificación local solo se usa si no hay conexión: nunca tras un rechazo del servidor. */
async function login(payload) {
	const { username, password } = payload;
	let response;
	try {
		response = await requestLogin(username, password);
	} catch (error) {
		if (isConnectivityError(error)) return loginOffline(username, password);
		throw error;
	}
	return loginOnline(response, username, password);
}
/** Devuelve un token válido o null. Actualiza el estado de conexión. */
async function renewToken() {
	if (!session || !credentials) return null;
	try {
		const { token, usuario } = await requestLogin(credentials.username, credentials.password);
		session.token = token;
		session.rol = usuario.rol;
		session.parroquiaId = usuario.parroquiaId;
		return token;
	} catch (error) {
		session.token = "";
		if (isConnectivityError(error)) {
			mode = "sin-conexion";
			return null;
		}
		mode = "requiere-login";
		lastError = "La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.";
		return null;
	}
}
async function runWithToken(action) {
	const token = session?.token || await renewToken();
	if (!token) return;
	try {
		await action(token);
	} catch (error) {
		if (!(error instanceof ServiceError && error.status === 401)) throw error;
		const renewed = await renewToken();
		if (renewed) await action(renewed);
	}
}
async function performSync() {
	lastError = null;
	try {
		let completed = false;
		await runWithToken(async (token) => {
			await runSync(getLocalDb(), remoteRequest, token);
			completed = true;
			await uploadCurrentKeyCopy(remoteRequest, token, session?.parroquiaId ?? null).catch((error) => {
				console.error("No se pudo subir la copia de la clave:", error);
			});
		});
		if (completed) mode = "en-linea";
	} catch (error) {
		if (isConnectivityError(error)) mode = "sin-conexion";
		else {
			console.error("Falló la sincronización:", error);
			mode = "error";
			lastError = error instanceof ServiceError ? error.message : "Ocurrió un error al sincronizar.";
		}
	}
}
/** Nunca falla: lo que no se pudo subir sigue en la cola y el estado queda en getSyncStatus. */
function syncNow() {
	if (!session) return Promise.resolve();
	running ??= performSync().finally(() => {
		running = null;
	});
	return running;
}
function getSyncStatus() {
	requireSession();
	return {
		...readQueueSummary(getLocalDb()),
		modo: mode,
		enCurso: running !== null,
		mensaje: lastError,
		token: session?.token || "sin-conexion"
	};
}
async function resolveSyncConflict(entidad, clientId, choice) {
	requireSession();
	let done = false;
	await runWithToken(async (token) => {
		await resolveConflict(getLocalDb(), remoteRequest, token, entidad, clientId, choice);
		done = true;
	});
	if (!done) throw new ServiceError("Se necesita conexión para resolver el conflicto.", 0);
	await syncNow();
}
function dismissSyncNotice() {
	requireSession();
	setSyncValue(getLocalDb(), "aviso", null);
}
/** Al cerrar la app: intenta subir lo pendiente sin retener el cierre más de unos segundos. */
async function syncBeforeQuit(limitMs) {
	if (!session) return;
	const { pendientes } = readQueueSummary(getLocalDb());
	if (pendientes === 0) return;
	await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, limitMs))]);
}
function stopPeriodicSync() {
	if (timer) clearInterval(timer);
	timer = null;
}
//#endregion
//#region electron/main/services/singlePersonSacraments.ts
var SORT_COLUMNS = {
	nombre: "pe.nombres",
	apellido_paterno: "pe.apellido_paterno",
	apellido_materno: "pe.apellido_materno"
};
var CONFIG = {
	bautismo: {
		table: "bautismos",
		eventInput: "fechaBautizo",
		eventColumn: "fecha_bautizo"
	},
	confirmacion: {
		table: "confirmaciones",
		eventInput: "fechaConfirmacion",
		eventColumn: "fecha_confirmacion"
	}
};
function singlePersonSacrament(tipo) {
	const { table, eventInput, eventColumn } = CONFIG[tipo];
	function requireNames(input) {
		if (!text(input.nombre) || !text(input.apellidoPaterno) || !text(input.apellidoMaterno)) throw new ServiceError("Nombre y apellidos son requeridos.", 400);
	}
	return {
		search(db, filters) {
			const conditions = [];
			const params = [];
			const add = (value, column) => {
				if (!value) return;
				conditions.push(nameMatch("pe", column));
				params.push(`%${value}%`, `%${value}%`);
			};
			add(filters.nombre, "nombres");
			add(filters.apellidoPaterno, "apellido_paterno");
			add(filters.apellidoMaterno, "apellido_materno");
			const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
			const from = `FROM ${table} sub
        JOIN sacramentos s ON s.id = sub.sacramento_id
        JOIN personas pe ON pe.id = sub.persona_id
        JOIN parroquias par ON par.id = s.parroquia_id`;
			const { total } = db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).get(...params);
			const { offset, totalPages } = pagination(filters, total);
			const sortColumn = SORT_COLUMNS[filters.sortBy ?? ""] ?? SORT_COLUMNS.nombre;
			return {
				rows: db.prepare(`SELECT ${HEADER_SELECT},
                  pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno
           ${from} ${where}
           ORDER BY ${sortColumn} ${sortDirection(filters)}, s.id
           LIMIT ? OFFSET ?`).all(...params, 20, offset),
				totalPages
			};
		},
		getById(db, id) {
			const row = db.prepare(`SELECT ${HEADER_SELECT}, ${MINISTER_NAME_SELECT},
                  s.fecha_evento AS ${eventColumn}, s.ministro_id AS celebrante_id, s.anotaciones,
                  s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                  pe.dni, pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno,
                  pe.fecha_nacimiento, pe.edad, pe.lugar_nacimiento,
                  pe.padre AS padre_nombre, pe.madre AS madre_nombre,
                  sub.padrino_1 AS padrino, sub.padrino_2 AS madrina
           FROM ${table} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.persona_id
           JOIN parroquias par ON par.id = s.parroquia_id
           LEFT JOIN ministros min ON min.id = s.ministro_id
           WHERE s.id = ?`).get(id);
			if (!row) throw new ServiceError("Partida no encontrada.", 404);
			return row;
		},
		create(db, session, input, requestedParishId) {
			const parroquiaId = targetParish(session, requestedParishId);
			requireNames(input);
			return db.transaction(() => {
				const personaId = insertPerson(db, parroquiaId, input);
				const sacramentId = insertSacrament(db, tipo, parroquiaId, input, input[eventInput], input.anotaciones);
				db.prepare(`INSERT INTO ${table} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(sacramentId, personaId, text(input.padrino), text(input.madrina));
				return sacramentId;
			})();
		},
		update(db, session, id, input) {
			assertCanManage$1(db, session, id, tipo);
			requireNames(input);
			db.transaction(() => {
				const { persona_id: personaId } = db.prepare(`SELECT persona_id FROM ${table} WHERE sacramento_id = ?`).get(id);
				updatePersonWithHistory(db, session, personaId, id, input);
				updateSacrament(db, id, input, input[eventInput], input.anotaciones);
				db.prepare(`UPDATE ${table} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(text(input.padrino), text(input.madrina), id);
			})();
		},
		annul(db, session, id, motivo) {
			annulSacrament(db, session, id, tipo, motivo);
		}
	};
}
//#endregion
//#region electron/main/services/ipc.ts
var baptisms = singlePersonSacrament("bautismo");
var confirmations = singlePersonSacrament("confirmacion");
function sacramentHandlers(prefix, key, service) {
	return {
		[`${prefix}.search`]: (filters) => {
			requireSession();
			const { rows, totalPages } = service.search(getLocalDb(), filters);
			return {
				[`${key}s`]: rows,
				totalPages
			};
		},
		[`${prefix}.get`]: ({ id }) => {
			requireSession();
			return { [key]: service.getById(getLocalDb(), positiveId(id)) };
		},
		[`${prefix}.create`]: ({ values, parroquiaId }) => ({ id: service.create(getLocalDb(), requireSession(), values, parroquiaId) }),
		[`${prefix}.update`]: ({ id, values }) => {
			service.update(getLocalDb(), requireSession(), positiveId(id), values);
			return { success: true };
		},
		[`${prefix}.annul`]: ({ id, motivo }) => {
			service.annul(getLocalDb(), requireSession(), positiveId(id), motivo);
			return { success: true };
		}
	};
}
var handlers = {
	"auth.login": login,
	"sync.status": () => getSyncStatus(),
	"sync.run": async () => {
		requireSession();
		await syncNow();
		return getSyncStatus();
	},
	"sync.resolve": async ({ entidad, clientId, choice }) => {
		await resolveSyncConflict(entidad, clientId, choice);
		return getSyncStatus();
	},
	"sync.dismissNotice": () => {
		dismissSyncNotice();
		return { success: true };
	},
	"parishes.list": () => {
		requireSession();
		return { parishes: listParishes(getLocalDb()) };
	},
	"ministers.search": (filters) => {
		requireSession();
		return ministers.search(getLocalDb(), filters);
	},
	"ministers.create": ({ values, parroquiaId }) => ({ id: ministers.create(getLocalDb(), requireSession(), values, parroquiaId) }),
	"ministers.update": ({ id, values }) => {
		ministers.update(getLocalDb(), requireSession(), positiveId(id, "Ministro"), values);
		return { success: true };
	},
	"ministers.toggleActive": ({ id }) => {
		ministers.toggleActive(getLocalDb(), requireSession(), positiveId(id, "Ministro"));
		return { success: true };
	},
	...sacramentHandlers("baptisms", "baptism", baptisms),
	...sacramentHandlers("confirmations", "confirmation", confirmations),
	"marriages.search": (filters) => {
		requireSession();
		const { rows, totalPages } = marriages.search(getLocalDb(), filters);
		return {
			marriages: rows,
			totalPages
		};
	},
	"marriages.get": ({ id }) => {
		requireSession();
		return { marriage: marriages.getById(getLocalDb(), positiveId(id)) };
	},
	"marriages.create": ({ values, parroquiaId }) => ({ id: marriages.create(getLocalDb(), requireSession(), values, parroquiaId) }),
	"marriages.update": ({ id, values }) => {
		marriages.update(getLocalDb(), requireSession(), positiveId(id), values);
		return { success: true };
	},
	"marriages.annul": ({ id, motivo }) => {
		marriages.annul(getLocalDb(), requireSession(), positiveId(id), motivo);
		return { success: true };
	},
	"sacramentIndex.books": ({ tipo, parroquiaId }) => ({ libros: listIndexBooks(getLocalDb(), requireSession(), tipo, parroquiaId) }),
	"sacramentIndex.entries": ({ tipo, parroquiaId, libro }) => ({ entries: getIndexEntries(getLocalDb(), requireSession(), tipo, parroquiaId, libro) })
};
function registerLocalIpc() {
	ipcMain.handle(LOCAL_REQUEST_CHANNEL, async (_event, method, payload) => {
		try {
			if (!Object.hasOwn(handlers, method)) throw new ServiceError("Operación no reconocida.", 404);
			return {
				ok: true,
				data: await handlers[method](payload)
			};
		} catch (error) {
			if (error instanceof ServiceError) return {
				ok: false,
				message: error.message,
				status: error.status
			};
			console.error(`Error en ${method}:`, error);
			return {
				ok: false,
				message: "Ocurrió un error inesperado.",
				status: 500
			};
		}
	});
}
//#endregion
//#region electron/main/index.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
var QUIT_SYNC_LIMIT_MS = 5e3;
var mainWindow = null;
var quitSyncDone = false;
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "index.mjs"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	mainWindow.maximize();
	if (VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}
ipcMain.handle("app:get-version", () => {
	return app.getVersion();
});
app.whenReady().then(() => {
	registerLocalIpc();
	try {
		initLocalDatabase();
	} catch (error) {
		console.error("No se pudo abrir la base local:", error);
	}
	createWindow();
});
app.on("before-quit", (event) => {
	if (quitSyncDone) return;
	event.preventDefault();
	quitSyncDone = true;
	stopPeriodicSync();
	syncBeforeQuit(QUIT_SYNC_LIMIT_MS).catch((error) => console.error("No se pudo sincronizar al cerrar:", error)).finally(() => app.quit());
});
app.on("will-quit", closeLocalDatabase);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//#endregion
export {};
