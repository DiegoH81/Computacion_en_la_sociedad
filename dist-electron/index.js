import { BrowserWindow as e, app as t, ipcMain as n, safeStorage as r } from "electron";
import i from "node:path";
import { fileURLToPath as a } from "node:url";
import o from "better-sqlite3-multiple-ciphers";
import { randomBytes as s } from "node:crypto";
import { existsSync as c, readFileSync as l, writeFileSync as u } from "node:fs";
//#region electron/main/localDb/schema.ts
var d = [
	"\n  CREATE TABLE parroquias (\n    id        INTEGER PRIMARY KEY,\n    nombre    TEXT    NOT NULL,\n    ubicacion TEXT,\n    activa    INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE usuarios (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER REFERENCES parroquias(id),\n    username         TEXT    NOT NULL UNIQUE,\n    rol              TEXT    NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE ministros (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE personas (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    dni              TEXT    CHECK (dni IS NULL OR dni <> ''),\n    nombres          TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL DEFAULT '',\n    fecha_nacimiento TEXT,\n    edad             INTEGER CHECK (edad IS NULL OR edad >= 0),\n    lugar_nacimiento TEXT,\n    padre            TEXT,\n    madre            TEXT,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;\n  CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);\n\n  CREATE TABLE sacramentos (\n    id                     INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id              TEXT    NOT NULL UNIQUE,\n    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),\n    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),\n    ministro_id            INTEGER REFERENCES ministros(id),\n    libro                  TEXT    NOT NULL,\n    folio                  TEXT    NOT NULL,\n    numero                 TEXT    NOT NULL,\n    fecha_emision          TEXT    NOT NULL,\n    fecha_evento           TEXT,\n    anotaciones            TEXT,\n    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),\n    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    anulado_en             TEXT,\n    motivo_anulacion       TEXT,\n    version                INTEGER NOT NULL DEFAULT 1,\n    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    -- Permite que cada subtipo enlace (id, tipo): un bautismo no puede colgar de un matrimonio.\n    UNIQUE (id, tipo),\n    CHECK (\n      estado = 'vigente'\n      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL\n          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')\n    )\n  );\n  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);\n\n  CREATE TABLE matrimonios (\n    sacramento_id                INTEGER PRIMARY KEY,\n    tipo                         TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),\n    conyuge_1_id                 INTEGER NOT NULL REFERENCES personas(id),\n    conyuge_2_id                 INTEGER NOT NULL REFERENCES personas(id),\n    lugar                        TEXT,\n    testigo_1                    TEXT,\n    testigo_2                    TEXT,\n    testigo_3                    TEXT,\n    testigo_4                    TEXT,\n    conyuge_1_bautismo_parroquia TEXT,\n    conyuge_1_bautismo_fecha     TEXT,\n    conyuge_2_bautismo_parroquia TEXT,\n    conyuge_2_bautismo_fecha     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),\n    CHECK (conyuge_1_id <> conyuge_2_id)\n  );\n  CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);\n  CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);\n\n  CREATE TABLE bautismos (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);\n\n  CREATE TABLE confirmaciones (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);\n\n  CREATE TABLE cambios_persona (\n    id             INTEGER PRIMARY KEY AUTOINCREMENT,\n    -- Evita duplicar la corrección si se reenvía tras un corte de internet.\n    client_id      TEXT    NOT NULL UNIQUE,\n    persona_id     INTEGER NOT NULL REFERENCES personas(id),\n    sacramento_id  INTEGER REFERENCES sacramentos(id),\n    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),\n    campo_cambio   TEXT    NOT NULL,\n    valor_anterior TEXT,\n    valor_nuevo    TEXT,\n    fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);\n\n  -- Cada UPDATE sube version, salvo que la sincronización ya la haya fijado.\n  CREATE TRIGGER trg_personas_touch\n  AFTER UPDATE ON personas\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE personas\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  CREATE TRIGGER trg_sacramentos_touch\n  AFTER UPDATE ON sacramentos\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE sacramentos\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  CREATE TABLE ministros_nueva (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO ministros_nueva (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo)\n  SELECT id, 'servidor-' || id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo\n  FROM ministros;\n\n  DROP TABLE ministros;\n  ALTER TABLE ministros_nueva RENAME TO ministros;\n\n  CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);\n\n  CREATE TRIGGER trg_ministros_touch\n  AFTER UPDATE ON ministros\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE ministros\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  -- Registros con cambios sin subir. Se envía su estado final, así que basta una fila por registro.\n  -- version_base: última versión que conoce el servidor; NULL si el registro aún no existe allí.\n  CREATE TABLE sync_cola (\n    id           INTEGER PRIMARY KEY AUTOINCREMENT,\n    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro')),\n    client_id    TEXT    NOT NULL,\n    version_base INTEGER,\n    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    UNIQUE (entidad, client_id)\n  );\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT tipo, client_id FROM sacramentos ORDER BY id;\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT 'ministro', client_id FROM ministros ORDER BY id;\n  "
], ee = /^[0-9a-f]{64}$/i;
function te(e, t) {
	let n = e.pragma("user_version", { simple: !0 });
	if (n > t.length) throw Error(`La base local está en la versión ${n} y esta app solo conoce hasta la ${t.length}.`);
	e.pragma("foreign_keys = OFF"), t.slice(n).forEach((t, r) => {
		e.transaction(() => {
			if (e.exec(t), e.pragma("foreign_key_check").length > 0) throw Error("La migración dejó claves foráneas rotas.");
			e.pragma(`user_version = ${n + r + 1}`);
		})();
	}), e.pragma("foreign_keys = ON");
}
function ne(e, t, n = d) {
	if (!ee.test(t)) throw Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	let r = new o(e);
	try {
		return r.pragma("cipher='chacha20'"), r.pragma(`hexkey='${t}'`), r.prepare("SELECT count(*) FROM sqlite_master").get(), r.pragma("foreign_keys = ON"), r.pragma("journal_mode = WAL"), r.pragma("synchronous = FULL"), te(r, n), r;
	} catch (e) {
		throw r.close(), e;
	}
}
//#endregion
//#region electron/main/localDb/key.ts
function re(e, t) {
	if (!r.isEncryptionAvailable()) throw Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
	if (c(e)) return r.decryptString(l(e));
	if (c(t)) throw Error("Existe una base local, pero falta el archivo con su clave.");
	let n = s(32).toString("hex");
	return u(e, r.encryptString(n), {
		flag: "wx",
		mode: 384
	}), n;
}
//#endregion
//#region electron/main/services/syncQueue.ts
function f(e, t, n, r) {
	e.prepare("INSERT INTO sync_cola (entidad, client_id, version_base) VALUES (?, ?, ?)\n     ON CONFLICT (entidad, client_id) DO NOTHING").run(t, n, r);
}
//#endregion
//#region electron/main/services/common.ts
var p = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ServiceError", this.status = t;
	}
};
function m(e) {
	if (typeof e != "string") return null;
	let t = e.trim();
	return t === "" ? null : t;
}
function h(e, t = "Partida") {
	if (!Number.isInteger(e) || e <= 0) throw new p(t === "Partida" ? "Partida no encontrada." : "Ministro no encontrado.", 404);
	return e;
}
function g(e, t) {
	return {
		offset: ((Number.isInteger(e.page) && e.page > 0 ? e.page : 1) - 1) * 20,
		totalPages: Math.max(1, Math.ceil(t / 20))
	};
}
function _(e) {
	return e.sortDirection === "desc" ? "DESC" : "ASC";
}
function v(e, t) {
	if (e.rol === "admin") {
		if (!Number.isInteger(t) || t <= 0) throw new p("Debe especificar la parroquia.", 400);
		return t;
	}
	if (!e.parroquiaId) throw new p("El usuario no tiene una parroquia asignada.", 400);
	return e.parroquiaId;
}
function y(e, t, n, r) {
	let i = e.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(n, r);
	if (!i) throw new p("Partida no encontrada.", 404);
	if (t.rol !== "admin" && i.parroquia_id !== t.parroquiaId) throw new p("No tiene permiso para modificar partidas de otra parroquia.", 403);
}
function b(e, t, n) {
	let r = m(e.fechaSacramento), i = m(e.numeroLibro), a = m(e.numeroFolio), o = m(e.numeroRegistro);
	if (!r || !i || !a || !o) throw new p("La fecha, el libro, el folio y el número de registro son requeridos.", 400);
	return {
		fechaEmision: r,
		libro: i,
		folio: a,
		numero: o,
		ministroId: e.celebranteId ?? null,
		fechaEvento: m(t),
		anotaciones: m(n)
	};
}
function x(e, t, n, r, i, a) {
	let o = b(r, i, a), s = crypto.randomUUID();
	return f(e, t, s, null), Number(e.prepare("INSERT INTO sacramentos\n           (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)\n         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(s, t, n, o.ministroId, o.libro, o.folio, o.numero, o.fechaEmision, o.fechaEvento, o.anotaciones).lastInsertRowid);
}
function ie(e, t) {
	let n = e.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(t);
	f(e, n.tipo, n.client_id, n.version);
}
function S(e, t, n, r, i) {
	let a = b(n, r, i);
	ie(e, t), e.prepare("UPDATE sacramentos\n     SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?\n     WHERE id = ?").run(a.ministroId, a.libro, a.folio, a.numero, a.fechaEmision, a.fechaEvento, a.anotaciones, t);
}
function C(e, t, n, r, i) {
	y(e, t, n, r);
	let a = m(i);
	if (!a) throw new p("El motivo de anulación es requerido.", 400);
	e.transaction(() => {
		ie(e, n), e.prepare("UPDATE sacramentos\n       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?\n       WHERE id = ?").run(t.usuarioId, (/* @__PURE__ */ new Date()).toISOString(), a, n);
	})();
}
var w = "\n  s.id, s.parroquia_id, par.nombre AS parroquia_nombre,\n  s.fecha_emision AS fecha_sacramento, s.libro AS numero_libro, s.folio AS numero_folio,\n  s.numero AS numero_registro, s.estado", T = "\n  min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS celebrante_nombre", E = null;
function ae() {
	let e = t.getPath("userData"), n = i.join(e, "prelatura-local.db");
	E = ne(n, re(i.join(e, "prelatura-local.key"), n));
}
function D() {
	if (!E) throw new p("La base local no está disponible.", 503);
	return E;
}
function oe() {
	E?.close(), E = null;
}
//#endregion
//#region electron/shared/index.ts
var se = "local:request", O = [
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
function ce(e) {
	if (e == null || e === "") return null;
	let t = Number(e);
	if (!Number.isInteger(t) || t < 0 || t > 150) throw new p("La edad debe ser un número entre 0 y 150.", 400);
	return t;
}
function k(e) {
	return {
		dni: m(e.dni),
		nombres: m(e.nombre) ?? "",
		apellido_paterno: m(e.apellidoPaterno) ?? "",
		apellido_materno: m(e.apellidoMaterno) ?? "",
		fecha_nacimiento: m(e.fechaNacimiento),
		edad: ce(e.edad),
		lugar_nacimiento: m(e.lugarNacimiento),
		padre: m(e.padreNombre),
		madre: m(e.madreNombre)
	};
}
function A(e, t, n) {
	let r = k(n);
	return Number(e.prepare(`INSERT INTO personas (client_id, parroquia_id, ${O.join(", ")})
         VALUES (?, ?, ${O.map(() => "?").join(", ")})`).run(crypto.randomUUID(), t, ...O.map((e) => r[e])).lastInsertRowid);
}
function j(e, t, n, r, i) {
	let a = k(i), o = e.prepare(`SELECT ${O.join(", ")} FROM personas WHERE id = ?`).get(n), s = O.filter((e) => o[e] !== a[e]);
	if (s.length === 0) return;
	let c = e.prepare("INSERT INTO cambios_persona\n       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)\n     VALUES (?, ?, ?, ?, ?, ?, ?)"), l = (e) => e === null ? null : String(e);
	for (let e of s) c.run(crypto.randomUUID(), n, r, t.usuarioId, e, l(o[e]), l(a[e]));
	e.prepare(`UPDATE personas SET ${s.map((e) => `${e} = ?`).join(", ")} WHERE id = ?`).run(...s.map((e) => a[e]), n);
}
function M(e, t) {
	return `(${e}.${t} LIKE ? OR EXISTS (
    SELECT 1 FROM cambios_persona cp
    WHERE cp.persona_id = ${e}.id AND cp.campo_cambio = '${t}' AND cp.valor_anterior LIKE ?
  ))`;
}
//#endregion
//#region electron/main/services/marriages.ts
var N = {
	nombre: "c1.nombres",
	apellido_paterno: "c1.apellido_paterno",
	apellido_materno: "c1.apellido_materno"
};
function P(e) {
	if (!m(e.esposo?.nombre) || !m(e.esposa?.nombre)) throw new p("Los nombres de ambos cónyuges son requeridos.", 400);
	return {
		esposo: e.esposo,
		esposa: e.esposa
	};
}
function F(e, t, n) {
	return [
		m(e.lugarMatrimonio),
		m(e.testigo1),
		m(e.testigo2),
		m(e.testigo3),
		m(e.testigo4),
		m(t.parroquiaBautismo),
		m(t.fechaBautismo),
		m(n.parroquiaBautismo),
		m(n.fechaBautismo)
	];
}
function I(e, t, n) {
	return `
    ${e}.dni AS ${t}_dni, ${e}.nombres AS ${t}_nombre,
    ${e}.apellido_paterno AS ${t}_apellido_paterno,
    ${e}.apellido_materno AS ${t}_apellido_materno,
    ${e}.fecha_nacimiento AS ${t}_fecha_nacimiento, ${e}.edad AS ${t}_edad,
    ${e}.lugar_nacimiento AS ${t}_lugar_nacimiento,
    ${e}.padre AS ${t}_padre_nombre, ${e}.madre AS ${t}_madre_nombre,
    m.conyuge_${n}_bautismo_parroquia AS ${t}_parroquia_bautismo,
    m.conyuge_${n}_bautismo_fecha AS ${t}_fecha_bautismo`;
}
var L = {
	search(e, t) {
		let n = [], r = [], i = (e, t) => {
			e && (n.push(`(${M("c1", t)} OR ${M("c2", t)})`), r.push(`%${e}%`, `%${e}%`, `%${e}%`, `%${e}%`));
		};
		i(t.nombre, "nombres"), i(t.apellidoPaterno, "apellido_paterno"), i(t.apellidoMaterno, "apellido_materno");
		let a = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", o = "FROM matrimonios m\n      JOIN sacramentos s ON s.id = m.sacramento_id\n      JOIN personas c1 ON c1.id = m.conyuge_1_id\n      JOIN personas c2 ON c2.id = m.conyuge_2_id\n      JOIN parroquias par ON par.id = s.parroquia_id", { total: s } = e.prepare(`SELECT COUNT(*) AS total ${o} ${a}`).get(...r), { offset: c, totalPages: l } = g(t, s), u = N[t.sortBy ?? ""] ?? N.nombre;
		return {
			rows: e.prepare(`SELECT ${w},
                c1.nombres AS esposo_nombre, c1.apellido_paterno AS esposo_apellido_paterno,
                c1.apellido_materno AS esposo_apellido_materno,
                c2.nombres AS esposa_nombre, c2.apellido_paterno AS esposa_apellido_paterno,
                c2.apellido_materno AS esposa_apellido_materno
         ${o} ${a}
         ORDER BY ${u} ${_(t)}, s.id
         LIMIT ? OFFSET ?`).all(...r, 20, c),
			totalPages: l
		};
	},
	getById(e, t) {
		let n = e.prepare(`SELECT ${w}, ${T},
                s.fecha_evento AS fecha_matrimonio, s.ministro_id AS celebrante_id,
                s.anotaciones AS notas_marginales,
                s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                m.lugar AS lugar_matrimonio, m.testigo_1, m.testigo_2, m.testigo_3, m.testigo_4,
                ${I("c1", "esposo", 1)},
                ${I("c2", "esposa", 2)}
         FROM matrimonios m
         JOIN sacramentos s ON s.id = m.sacramento_id
         JOIN personas c1 ON c1.id = m.conyuge_1_id
         JOIN personas c2 ON c2.id = m.conyuge_2_id
         JOIN parroquias par ON par.id = s.parroquia_id
         LEFT JOIN ministros min ON min.id = s.ministro_id
         WHERE s.id = ?`).get(t);
		if (!n) throw new p("Partida no encontrada.", 404);
		return n;
	},
	create(e, t, n, r) {
		let i = v(t, r), { esposo: a, esposa: o } = P(n);
		return e.transaction(() => {
			let t = A(e, i, a), r = A(e, i, o), s = x(e, "matrimonio", i, n, n.fechaMatrimonio, n.notasMarginales);
			return e.prepare("INSERT INTO matrimonios (\n           sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n           conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha,\n           conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha\n         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(s, t, r, ...F(n, a, o)), s;
		})();
	},
	update(e, t, n, r) {
		y(e, t, n, "matrimonio");
		let { esposo: i, esposa: a } = P(r);
		e.transaction(() => {
			let o = e.prepare("SELECT conyuge_1_id, conyuge_2_id FROM matrimonios WHERE sacramento_id = ?").get(n);
			j(e, t, o.conyuge_1_id, n, i), j(e, t, o.conyuge_2_id, n, a), S(e, n, r, r.fechaMatrimonio, r.notasMarginales), e.prepare("UPDATE matrimonios SET\n           lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,\n           conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,\n           conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?\n         WHERE sacramento_id = ?").run(...F(r, i, a), n);
		})();
	},
	annul(e, t, n, r) {
		C(e, t, n, "matrimonio", r);
	}
}, R = {
	nombre: "min.nombre",
	apellido_paterno: "min.apellido_paterno",
	apellido_materno: "min.apellido_materno"
};
function z(e) {
	let t = m(e.nombre), n = m(e.apellidoPaterno), r = m(e.apellidoMaterno);
	if (!t || !n || !r) throw new p("Nombre y apellidos son requeridos.", 400);
	return {
		titulo: m(e.titulo),
		nombre: t,
		apellidoPaterno: n,
		apellidoMaterno: r
	};
}
function B(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(n);
	if (!r) throw new p("Ministro no encontrado.", 404);
	if (t.rol !== "admin" && r.parroquia_id !== t.parroquiaId) throw new p("No tiene permiso para modificar ministros de otra parroquia.", 403);
}
function V(e, t) {
	let n = e.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(t);
	f(e, "ministro", n.client_id, n.version);
}
var H = {
	search(e, t) {
		let n = [], r = [], i = (e, t) => {
			e && (n.push(`min.${t} LIKE ?`), r.push(`%${e}%`));
		};
		i(t.nombre, "nombre"), i(t.apellidoPaterno, "apellido_paterno"), i(t.apellidoMaterno, "apellido_materno");
		let a = n.length > 0 ? `WHERE ${n.join(" AND ")}` : "", { total: o } = e.prepare(`SELECT COUNT(*) AS total FROM ministros min ${a}`).get(...r), { offset: s, totalPages: c } = g(t, o), l = R[t.sortBy ?? ""] ?? R.nombre;
		return {
			priests: e.prepare(`SELECT min.id, min.titulo, min.nombre, min.apellido_paterno, min.apellido_materno,
                min.parroquia_id, par.nombre AS parroquia_nombre, min.activo
         FROM ministros min
         JOIN parroquias par ON par.id = min.parroquia_id
         ${a}
         ORDER BY ${l} ${_(t)}, min.id
         LIMIT ? OFFSET ?`).all(...r, 20, s),
			totalPages: c
		};
	},
	create(e, t, n, r) {
		let i = v(t, r), a = z(n), o = crypto.randomUUID();
		return e.transaction(() => (f(e, "ministro", o, null), Number(e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno)\n             VALUES (?, ?, ?, ?, ?, ?)").run(o, i, a.titulo, a.nombre, a.apellidoPaterno, a.apellidoMaterno).lastInsertRowid)))();
	},
	update(e, t, n, r) {
		B(e, t, n);
		let i = z(r);
		e.transaction(() => {
			V(e, n), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.titulo, i.nombre, i.apellidoPaterno, i.apellidoMaterno, n);
		})();
	},
	toggleActive(e, t, n) {
		B(e, t, n), e.transaction(() => {
			V(e, n), e.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(n);
		})();
	}
};
//#endregion
//#region electron/main/services/reference.ts
function le(e) {
	return e.prepare("SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function ue(e, t) {
	let n = e.prepare("INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)\n     ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa"), r = e.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?"), i = e.prepare("INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno, activo)\n     VALUES (@client_id, @parroquia_id, @nombre, @apellido_paterno, @apellido_materno, @activo)\n     ON CONFLICT (client_id) DO NOTHING"), a = e.prepare("INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)\n     VALUES (@id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo)\n     ON CONFLICT (id) DO UPDATE SET\n       parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,\n       apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo");
	e.transaction(() => {
		t.parroquias.forEach((e) => n.run(e)), t.ministros.forEach((e) => {
			r.run(e.client_id, `servidor-${e.id}`), i.run(e);
		}), t.usuarios.forEach((e) => a.run(e));
	})();
}
//#endregion
//#region electron/main/services/sacramentIndex.ts
var U = {
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
}, W = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: !0
}).compare;
function G(e, t, n) {
	if (typeof t != "string" || !Object.hasOwn(U, t)) throw new p("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(n) || n <= 0) throw new p("Debe especificar la parroquia.", 400);
	if (e.rol !== "admin" && e.parroquiaId !== n) throw new p("No tiene permiso para imprimir el índice de otra parroquia.", 403);
}
function de(e, t, n, r) {
	return G(t, n, r), e.prepare("SELECT DISTINCT libro FROM sacramentos\n       WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'").pluck().all(n, r).sort(W);
}
function fe(e, t, n, r, i) {
	return G(t, n, r), U[n].flatMap(({ table: t, personColumn: n }) => e.prepare(`SELECT pe.nombres, pe.apellido_paterno AS apellidoPaterno, pe.apellido_materno AS apellidoMaterno,
                  s.libro, s.folio, s.numero AS registro
           FROM ${t} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.${n}
           WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(r, i, i)).sort((e, t) => W(e.apellidoPaterno, t.apellidoPaterno) || W(e.apellidoMaterno, t.apellidoMaterno) || W(e.nombres, t.nombres) || W(e.libro, t.libro) || W(e.folio, t.folio) || W(e.registro, t.registro));
}
//#endregion
//#region electron/main/services/singlePersonSacraments.ts
var K = {
	nombre: "pe.nombres",
	apellido_paterno: "pe.apellido_paterno",
	apellido_materno: "pe.apellido_materno"
}, pe = {
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
function q(e) {
	let { table: t, eventInput: n, eventColumn: r } = pe[e];
	function i(e) {
		if (!m(e.nombre) || !m(e.apellidoPaterno) || !m(e.apellidoMaterno)) throw new p("Nombre y apellidos son requeridos.", 400);
	}
	return {
		search(e, n) {
			let r = [], i = [], a = (e, t) => {
				e && (r.push(M("pe", t)), i.push(`%${e}%`, `%${e}%`));
			};
			a(n.nombre, "nombres"), a(n.apellidoPaterno, "apellido_paterno"), a(n.apellidoMaterno, "apellido_materno");
			let o = r.length > 0 ? `WHERE ${r.join(" AND ")}` : "", s = `FROM ${t} sub
        JOIN sacramentos s ON s.id = sub.sacramento_id
        JOIN personas pe ON pe.id = sub.persona_id
        JOIN parroquias par ON par.id = s.parroquia_id`, { total: c } = e.prepare(`SELECT COUNT(*) AS total ${s} ${o}`).get(...i), { offset: l, totalPages: u } = g(n, c), d = K[n.sortBy ?? ""] ?? K.nombre;
			return {
				rows: e.prepare(`SELECT ${w},
                  pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno
           ${s} ${o}
           ORDER BY ${d} ${_(n)}, s.id
           LIMIT ? OFFSET ?`).all(...i, 20, l),
				totalPages: u
			};
		},
		getById(e, n) {
			let i = e.prepare(`SELECT ${w}, ${T},
                  s.fecha_evento AS ${r}, s.ministro_id AS celebrante_id, s.anotaciones,
                  s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
                  pe.dni, pe.nombres AS nombre, pe.apellido_paterno, pe.apellido_materno,
                  pe.fecha_nacimiento, pe.edad, pe.lugar_nacimiento,
                  pe.padre AS padre_nombre, pe.madre AS madre_nombre,
                  sub.padrino_1 AS padrino, sub.padrino_2 AS madrina
           FROM ${t} sub
           JOIN sacramentos s ON s.id = sub.sacramento_id
           JOIN personas pe ON pe.id = sub.persona_id
           JOIN parroquias par ON par.id = s.parroquia_id
           LEFT JOIN ministros min ON min.id = s.ministro_id
           WHERE s.id = ?`).get(n);
			if (!i) throw new p("Partida no encontrada.", 404);
			return i;
		},
		create(r, a, o, s) {
			let c = v(a, s);
			return i(o), r.transaction(() => {
				let i = A(r, c, o), a = x(r, e, c, o, o[n], o.anotaciones);
				return r.prepare(`INSERT INTO ${t} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(a, i, m(o.padrino), m(o.madrina)), a;
			})();
		},
		update(r, a, o, s) {
			y(r, a, o, e), i(s), r.transaction(() => {
				let { persona_id: e } = r.prepare(`SELECT persona_id FROM ${t} WHERE sacramento_id = ?`).get(o);
				j(r, a, e, o, s), S(r, o, s, s[n], s.anotaciones), r.prepare(`UPDATE ${t} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(m(s.padrino), m(s.madrina), o);
			})();
		},
		annul(t, n, r, i) {
			C(t, n, r, e, i);
		}
	};
}
//#endregion
//#region electron/main/services/ipc.ts
var me = "http://localhost:8787", he = q("bautismo"), ge = q("confirmacion"), J = null;
function Y() {
	if (!J) throw new p("Sesión no válida.", 401);
	return J;
}
async function X(e, t = {}) {
	let n;
	try {
		n = await fetch(`${me}${e}`, t);
	} catch {
		throw new p("No se pudo conectar con el servidor. Verifique su conexión.", 0);
	}
	let r = await n.json().catch(() => null);
	if (!n.ok) throw new p(r?.message ? String(r.message) : "Ocurrió un error inesperado.", n.status);
	return r;
}
async function _e(e) {
	let t = await X("/api/reference", { headers: { Authorization: `Bearer ${e}` } });
	ue(D(), t);
}
async function ve(e) {
	D();
	let t = await X("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: e.username,
			password: e.password
		})
	});
	return await _e(t.token), J = {
		usuarioId: t.usuario.id,
		rol: t.usuario.rol,
		parroquiaId: t.usuario.parroquiaId,
		token: t.token
	}, t;
}
function Z(e, t, n) {
	return {
		[`${e}.search`]: (e) => {
			Y();
			let { rows: r, totalPages: i } = n.search(D(), e);
			return {
				[`${t}s`]: r,
				totalPages: i
			};
		},
		[`${e}.get`]: ({ id: e }) => (Y(), { [t]: n.getById(D(), h(e)) }),
		[`${e}.create`]: ({ values: e, parroquiaId: t }) => ({ id: n.create(D(), Y(), e, t) }),
		[`${e}.update`]: ({ id: e, values: t }) => (n.update(D(), Y(), h(e), t), { success: !0 }),
		[`${e}.annul`]: ({ id: e, motivo: t }) => (n.annul(D(), Y(), h(e), t), { success: !0 })
	};
}
var ye = {
	"auth.login": ve,
	"parishes.list": () => (Y(), { parishes: le(D()) }),
	"ministers.search": (e) => (Y(), H.search(D(), e)),
	"ministers.create": ({ values: e, parroquiaId: t }) => ({ id: H.create(D(), Y(), e, t) }),
	"ministers.update": ({ id: e, values: t }) => (H.update(D(), Y(), h(e, "Ministro"), t), { success: !0 }),
	"ministers.toggleActive": ({ id: e }) => (H.toggleActive(D(), Y(), h(e, "Ministro")), { success: !0 }),
	...Z("baptisms", "baptism", he),
	...Z("confirmations", "confirmation", ge),
	"marriages.search": (e) => {
		Y();
		let { rows: t, totalPages: n } = L.search(D(), e);
		return {
			marriages: t,
			totalPages: n
		};
	},
	"marriages.get": ({ id: e }) => (Y(), { marriage: L.getById(D(), h(e)) }),
	"marriages.create": ({ values: e, parroquiaId: t }) => ({ id: L.create(D(), Y(), e, t) }),
	"marriages.update": ({ id: e, values: t }) => (L.update(D(), Y(), h(e), t), { success: !0 }),
	"marriages.annul": ({ id: e, motivo: t }) => (L.annul(D(), Y(), h(e), t), { success: !0 }),
	"sacramentIndex.books": ({ tipo: e, parroquiaId: t }) => ({ libros: de(D(), Y(), e, t) }),
	"sacramentIndex.entries": ({ tipo: e, parroquiaId: t, libro: n }) => ({ entries: fe(D(), Y(), e, t, n) })
};
function be() {
	n.handle(se, async (e, t, n) => {
		try {
			if (!Object.hasOwn(ye, t)) throw new p("Operación no reconocida.", 404);
			return {
				ok: !0,
				data: await ye[t](n)
			};
		} catch (e) {
			return e instanceof p ? {
				ok: !1,
				message: e.message,
				status: e.status
			} : (console.error(`Error en ${t}:`, e), {
				ok: !1,
				message: "Ocurrió un error inesperado.",
				status: 500
			});
		}
	});
}
//#endregion
//#region electron/main/index.ts
var xe = i.dirname(a(import.meta.url)), Se = process.env.VITE_DEV_SERVER_URL, Q = null;
function $() {
	Q = new e({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: i.join(xe, "index.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), Q.maximize(), Se ? (Q.loadURL(Se), Q.webContents.openDevTools()) : Q.loadFile(i.join(xe, "../dist/index.html")), Q.on("closed", () => {
		Q = null;
	});
}
n.handle("app:get-version", () => t.getVersion()), t.whenReady().then(() => {
	be();
	try {
		ae();
	} catch (e) {
		console.error("No se pudo abrir la base local:", e);
	}
	$();
}), t.on("will-quit", oe), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && $();
});
//#endregion
export {};
