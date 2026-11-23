import { createRequire as e } from "node:module";
import { BrowserWindow as t, app as n, dialog as r, ipcMain as i, safeStorage as a, screen as o } from "electron";
import s from "node:path";
import { fileURLToPath as c } from "node:url";
import l, { existsSync as u, mkdirSync as d, readFileSync as f, readdirSync as p, renameSync as m, rmSync as h, statSync as g, writeFileSync as _ } from "node:fs";
import { deflateRawSync as v, gunzipSync as y, gzipSync as b } from "node:zlib";
import x from "better-sqlite3-multiple-ciphers";
import { createCipheriv as ee, createDecipheriv as S, pbkdf2 as C, randomBytes as w, randomUUID as T, scrypt as E, timingSafeEqual as D } from "node:crypto";
import { Worker as O } from "node:worker_threads";
import k from "zlib";
import { Duplex as te, PassThrough as A, Transform as ne, pipeline as re } from "stream";
import { Blob as j } from "node:buffer";
import M, { Readable as ie, Transform as N } from "node:stream";
import { createRequire as P } from "module";
//#region \0rolldown/runtime.js
var F = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), I = /* @__PURE__ */ e(import.meta.url), L = [
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
], ae = [
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
], oe = [{
	campo: "padrino_1",
	label: "Padrino"
}, {
	campo: "padrino_2",
	label: "Madrina"
}], se = [
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
], ce = ae.map((e) => e.campo);
function le(e) {
	return e === "matrimonio" ? se : oe;
}
function ue(e) {
	return le(e).map((e) => e.campo);
}
function de(e) {
	return e === "matrimonio" ? ["conyuge_1", "conyuge_2"] : ["persona"];
}
function fe(e, t) {
	return e === "sacramento" ? L : e === "detalle" ? le(t) : ae;
}
function pe(e, t) {
	let n = [
		...L,
		...ae,
		...oe,
		...se
	].find((e) => e.campo === t)?.label ?? t;
	return e === "conyuge_1" ? `${n} del esposo` : e === "conyuge_2" ? `${n} de la esposa` : n;
}
function me(e, t) {
	return t === "sacramento" ? e.sacramento : t === "persona" ? e.persona : t === "conyuge_1" || t === "conyuge_2" ? e[t] : e;
}
function he(e, t) {
	return me(e, t);
}
function ge(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" ? null : t;
}
function _e(e, t, n) {
	return ge(me(e, t)?.[n]);
}
function ve(e, t, n, r) {
	let i = n === "ministro_id" && r !== null ? Number(r) : r;
	if (t === "detalle") return {
		...e,
		[n]: i
	};
	if (t === "sacramento") return {
		...e,
		sacramento: {
			...e.sacramento,
			[n]: i
		}
	};
	let a = me(e, t);
	return {
		...e,
		[t]: {
			...a,
			[n]: i
		}
	};
}
function ye(e, t) {
	let n = [], r = e.sacramento.tipo, i = [
		"sacramento",
		...de(r),
		"detalle"
	];
	for (let a of i) for (let i of fe(a, r)) {
		let r = _e(e, a, i.campo), o = _e(t, a, i.campo);
		r !== o && n.push({
			parte: a,
			campo: i.campo,
			valor_anterior: r,
			valor_nuevo: o
		});
	}
	return n;
}
function be(e, t) {
	let n = (e.cambios ?? []).filter((e) => e.id !== void 0 && e.campo_cambio === t && (e.estado === void 0 || e.estado === "aprobado"));
	return n.length === 0 ? e[t] : n.reduce((e, t) => t.id > e.id ? t : e).valor_nuevo ?? e[t];
}
var xe = 1e4, Se = 3e5, Ce = 5e3, R = {
	cursor: "cursor",
	last_sync: "ultima_sync",
	notice: "aviso",
	key_registered: "clave_registrada",
	staff_history_cursor: "cursor_historial"
}, we = {
	database: "prelatura-local.db",
	key: "prelatura-local.key",
	device: "prelatura-dispositivo.id",
	temp_database: "prelatura-reconstruccion.db",
	temp_key: "prelatura-reconstruccion.key",
	set_aside_folder: "bases-apartadas",
	logos_folder: "logos",
	backup_log: "registro-respaldos.json"
}, Te = 2592e6, z = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ServiceError", this.status = t;
	}
};
//#endregion
//#region electron/main/utils/helpers.ts
function B(e) {
	if (typeof e != "string") return null;
	let t = e.trim();
	return t === "" ? null : t;
}
function V(e, t = "Partida no encontrada.") {
	if (!Number.isInteger(e) || e <= 0) throw new z(t, 404);
	return e;
}
function Ee(e, t) {
	let n = 1;
	return Number.isInteger(e.pagina) && e.pagina > 0 && (n = e.pagina), {
		offset: (n - 1) * 20,
		total_pages: Math.max(1, Math.ceil(t / 20))
	};
}
function De(e) {
	return e.direccion === "desc" ? "DESC" : "ASC";
}
function H(e, t, n) {
	return [
		e,
		t,
		n
	].filter((e) => e).join(" ");
}
//#endregion
//#region electron/main/models/field_values.ts
var Oe = "ministro_id";
function ke(e, t, n) {
	return t !== Oe || n === null ? n : e.prepare("SELECT client_id FROM ministros WHERE id = ?").get(Number(n))?.client_id ?? null;
}
function Ae(e, t, n) {
	if (t !== Oe || n === null) return n;
	let r = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(n);
	return r ? String(r.id) : null;
}
function je(e, t, n) {
	if (t !== Oe || n === null) return n;
	let r = e.prepare("SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?").get(n);
	return r ? [r.titulo, H(r.nombre, r.apellido_paterno, r.apellido_materno)].filter(Boolean).join(" ") : "Celebrante desconocido";
}
//#endregion
//#region electron/main/models/change_request.ts
function Me(e, t) {
	return e.prepare("SELECT 1 FROM solicitudes_cambio WHERE sacramento_id = ? AND estado = 'pendiente'").get(t) !== void 0;
}
function Ne(e, t) {
	return e.prepare("SELECT id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo FROM solicitudes_cambio\n			 WHERE sacramento_id = ? AND estado = 'pendiente' ORDER BY id").all(t).map((t) => ({
		...t,
		valor_anterior: Ae(e, t.campo, t.valor_anterior),
		valor_nuevo: Ae(e, t.campo, t.valor_nuevo)
	}));
}
function Pe(e, t, n, r) {
	let i = e.prepare("INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"), a = (/* @__PURE__ */ new Date()).toISOString();
	for (let o of r) i.run(crypto.randomUUID(), t, n, o.parte, o.campo, o.tipo, ke(e, o.campo, o.valor_anterior), ke(e, o.campo, o.valor_nuevo), a);
}
function Fe(e, t, n, r, i = null) {
	e.prepare("UPDATE solicitudes_cambio SET estado = ?, motivo = ?, revisado_por_usuario_id = ?, revisado_en = ?\n		 WHERE sacramento_id = ? AND estado = 'pendiente'").run(n, i, r, (/* @__PURE__ */ new Date()).toISOString(), t);
}
function Ie(e, t) {
	return e.prepare("SELECT s.id, s.parte, s.campo, s.tipo, s.valor_anterior, s.valor_nuevo, s.estado, s.motivo, s.creado_en, s.revisado_en,\n				p.nombre AS pide_nombre, p.apellido_paterno AS pide_paterno, p.apellido_materno AS pide_materno,\n				r.nombre AS revisa_nombre, r.apellido_paterno AS revisa_paterno, r.apellido_materno AS revisa_materno\n			 FROM solicitudes_cambio s\n			 LEFT JOIN usuarios p ON p.id = s.usuario_id\n			 LEFT JOIN usuarios r ON r.id = s.revisado_por_usuario_id\n			 WHERE s.sacramento_id = ?\n			 ORDER BY s.creado_en DESC, s.id").all(t).map((t) => ({
		id: t.id,
		parte: t.parte,
		campo: t.campo,
		tipo: t.tipo,
		valor_anterior: Ae(e, t.campo, t.valor_anterior),
		valor_nuevo: Ae(e, t.campo, t.valor_nuevo),
		texto_anterior: je(e, t.campo, t.valor_anterior),
		texto_nuevo: je(e, t.campo, t.valor_nuevo),
		estado: t.estado,
		motivo: t.motivo,
		solicitado_por: H(t.pide_nombre, t.pide_paterno, t.pide_materno) || "Un usuario",
		creado_en: t.creado_en,
		revisado_por: t.revisa_nombre ? H(t.revisa_nombre, t.revisa_paterno, t.revisa_materno) : null,
		revisado_en: t.revisado_en
	}));
}
function Le(e, t) {
	return e.prepare("SELECT client_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n				revisado_por_usuario_id, revisado_en, creado_en\n			 FROM solicitudes_cambio WHERE sacramento_id = ? ORDER BY id").all(t);
}
function Re(e, t, n) {
	let r = e.prepare("INSERT INTO solicitudes_cambio\n			(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n			 revisado_por_usuario_id, revisado_en, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			motivo = excluded.motivo,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of n) r.run(e.client_id, t, e.usuario_id, e.parte, e.campo, e.tipo, e.valor_anterior, e.valor_nuevo, e.estado, e.motivo, e.revisado_por_usuario_id, e.revisado_en, e.creado_en);
}
function ze(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM solicitudes_cambio WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/history.ts
function U(e, t, n, r, i = [], a = null) {
	let o = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, n, r, a, (/* @__PURE__ */ new Date()).toISOString()), s = Number(o.lastInsertRowid), c = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let t of i) c.run(s, t.parte, t.campo, ke(e, t.campo, t.valor_anterior), ke(e, t.campo, t.valor_nuevo));
}
function Be(e, t) {
	return e.prepare("SELECT parte, campo, valor_anterior, valor_nuevo FROM historial_campos WHERE historial_id = ? ORDER BY id").all(t);
}
function Ve(e, t) {
	return e.prepare("SELECT h.id, h.evento, h.motivo, h.fecha, u.nombre, u.apellido_paterno, u.apellido_materno, u.username\n			 FROM historial_partidas h\n			 LEFT JOIN usuarios u ON u.id = h.usuario_id\n			 WHERE h.sacramento_id = ?\n			 ORDER BY h.fecha DESC, h.id DESC").all(t).map((t) => ({
		id: t.id,
		evento: t.evento,
		motivo: t.motivo,
		fecha: t.fecha,
		usuario: H(t.nombre, t.apellido_paterno, t.apellido_materno) || t.username || "Usuario desconocido",
		campos: Be(e, t.id).map((t) => ({
			parte: t.parte,
			campo: t.campo,
			texto_anterior: je(e, t.campo, t.valor_anterior),
			texto_nuevo: je(e, t.campo, t.valor_nuevo)
		}))
	}));
}
function He(e, t) {
	return e.prepare("SELECT id, client_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id = ? ORDER BY id").all(t).map(({ id: t, ...n }) => ({
		...n,
		campos: Be(e, t)
	}));
}
function Ue(e, t, n) {
	let r = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)\n		 VALUES (?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO NOTHING"), i = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let e of n) {
		let n = r.run(e.client_id, t, e.usuario_id, e.evento, e.motivo, e.fecha);
		if (n.changes !== 0) for (let t of e.campos) i.run(Number(n.lastInsertRowid), t.parte, t.campo, t.valor_anterior, t.valor_nuevo);
	}
}
function We(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM historial_campos WHERE historial_id IN (SELECT id FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?)))").run(t, r), e.prepare("DELETE FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/parish.ts
var Ge = "El administrador general solo consulta: no puede registrar ni modificar datos de las parroquias.";
function Ke(e, t) {
	return e.prepare("SELECT * FROM parroquias WHERE id = ?").get(t);
}
function qe(e) {
	if (e.role === "admin_general") throw new z(Ge, 403);
	if (!e.parish_id) throw new z("El usuario no tiene una parroquia asignada.", 400);
	return e.parish_id;
}
function Je(e, t, n) {
	if (e.role === "admin_general") throw new z(Ge, 403);
	if (e.parish_id !== t) throw new z(n, 403);
}
function Ye(e, t, n) {
	if (e.role !== "admin_general" && e.parish_id !== t) throw new z(n, 403);
}
function Xe(e, t, n, r) {
	if (Je(e, t, n), e.role !== "admin_parroquia") throw new z(r, 403);
}
//#endregion
//#region electron/main/models/person.ts
var Ze = [
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
function Qe(e) {
	return {
		dni: B(e.dni),
		nombres: B(e.nombres) ?? "",
		apellido_paterno: B(e.apellido_paterno) ?? "",
		apellido_materno: B(e.apellido_materno) ?? "",
		fecha_nacimiento: B(e.fecha_nacimiento),
		fecha_aproximada: B(e.fecha_aproximada),
		lugar_nacimiento: B(e.lugar_nacimiento),
		padre: B(e.padre),
		madre: B(e.madre)
	};
}
function $e(e, t) {
	let n = e.prepare("SELECT * FROM personas WHERE id = ?").get(t), r = e.prepare("SELECT * FROM cambios_persona WHERE persona_id = ? ORDER BY id").all(t);
	return {
		...n,
		cambios: r
	};
}
function et(e, t, n) {
	let r = Qe(n), i = e.prepare("INSERT INTO personas\n				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, r.dni, r.nombres, r.apellido_paterno, r.apellido_materno, r.fecha_nacimiento, r.fecha_aproximada, r.lugar_nacimiento, r.padre, r.madre);
	return Number(i.lastInsertRowid);
}
function tt(e, t, n) {
	let r = Qe(n), i = e.prepare(`SELECT ${ce.join(", ")} FROM personas WHERE id = ?`).get(t), a = ce.filter((e) => i[e] !== r[e]);
	if (a.length === 0) return;
	let o = a.map((e) => `${e} = ?`).join(", "), s = a.map((e) => r[e]);
	e.prepare(`UPDATE personas SET ${o} WHERE id = ?`).run(...s, t);
}
function nt(e) {
	let t = Array.isArray(e.cambios) ? e.cambios.filter((e) => e.id === void 0) : [], n = [];
	for (let r of t) {
		let t = Ze.find((e) => e.column === r.campo_cambio);
		if (!t) throw new z("La nota marginal indica un campo que no se puede corregir.", 400);
		if (n.some((e) => e.campo_cambio === t.column)) throw new z(`La nota marginal repite el campo ${t.label}.`, 400);
		let i = B(be(e, t.column)), a = B(r.valor_nuevo);
		if (!i) throw new z(`Complete ${t.label} antes de corregirlo en la nota marginal.`, 400);
		if (!a) throw new z(`Indique el valor nuevo de ${t.label} en la nota marginal.`, 400);
		if (a === i) throw new z(`El valor nuevo de ${t.label} es igual al anterior.`, 400);
		n.push({
			campo_cambio: t.column,
			valor_anterior: i,
			valor_nuevo: a
		});
	}
	return {
		person: e,
		corrections: n
	};
}
function rt(e, t, n, r, i) {
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?)"), o = (/* @__PURE__ */ new Date()).toISOString();
	for (let e of i) a.run(crypto.randomUUID(), n, r, t.user_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, t.user_id, o);
}
function it(e, t) {
	return `(${e}.${t} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${e}.id AND cp.campo_cambio = '${t}' AND cp.estado = 'aprobado' AND cp.valor_nuevo LIKE ?
	))`;
}
//#endregion
//#region shared/partial_date.ts
var at = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/, ot = "?";
function st(e, t) {
	let n = t ? Number(t) : 2e3;
	return new Date(n, Number(e), 0).getDate();
}
function ct(e) {
	let [t = "", n = "", r = ""] = (e ?? "").split("-").map((e) => e === ot ? "" : e);
	return {
		year: t,
		month: n,
		day: r
	};
}
function lt(e) {
	if (!e) return "";
	let t = at.exec(e);
	if (!t) return e;
	let [, n, r, i] = t;
	return [
		i,
		r,
		n
	].filter(Boolean).join("/");
}
function ut(e) {
	if (!e) return null;
	let { year: t, month: n, day: r } = ct(e);
	return t ? r && !n ? "falta el mes" : at.test(e) && r && Number(r) > st(n, t) ? "ese día no existe en ese mes" : null : "falta el año";
}
//#endregion
//#region electron/main/sync/queue.ts
function dt(e, t, n, r) {
	e.prepare("INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)\n		 ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1").run(t, n, r, crypto.randomUUID());
}
function ft(e, t, n) {
	return e.prepare("SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?").get(t, n) !== void 0;
}
function pt(e, t, n) {
	e.prepare("DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?").run(t, n);
}
function mt(e, t) {
	let n = e.prepare("SELECT valor FROM sync_estado WHERE clave = ?").get(t);
	return n ? n.valor : null;
}
function ht(e, t, n) {
	e.prepare("INSERT INTO sync_estado (clave, valor) VALUES (?, ?)\n		 ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").run(t, n);
}
//#endregion
//#region electron/main/models/minister.ts
function gt(e, t) {
	let n = e.prepare("SELECT * FROM ministros WHERE id = ?").get(t);
	return n ? {
		...n,
		parroquia: Ke(e, n.parroquia_id)
	} : null;
}
//#endregion
//#region electron/main/models/sacrament.ts
function _t(e) {
	return e === "bautismo" || e === "confirmacion" || e === "matrimonio";
}
function vt(e) {
	return e === "bautismo" ? "bautismos" : e === "confirmacion" ? "confirmaciones" : "matrimonios";
}
function yt(e) {
	return e === "matrimonio" ? ["conyuge_1_id", "conyuge_2_id"] : ["persona_id"];
}
function bt(e) {
	return e === "bautismo" ? "SELECT sacramento_id, persona_id FROM bautismos" : e === "confirmacion" ? "SELECT sacramento_id, persona_id FROM confirmaciones" : "SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n		UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
}
var xt = "SELECT sacramento_id, persona_id FROM bautismos\n	UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones\n	UNION ALL SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n	UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
function St(e, t) {
	let n = e.prepare("SELECT * FROM sacramentos WHERE id = ?").get(t);
	if (!n) return null;
	let r = null;
	return n.ministro_id !== null && (r = gt(e, n.ministro_id)), {
		...n,
		parroquia: Ke(e, n.parroquia_id),
		ministro: r
	};
}
function Ct(e) {
	let t = B(e.fecha_emision), n = B(e.libro), r = B(e.folio), i = B(e.numero);
	if (!n || !r || !i) throw new z("El libro, el folio y el número de registro son requeridos.", 400);
	return {
		fecha_emision: t,
		libro: n,
		folio: r,
		numero: i,
		ministro_id: e.ministro_id ?? null,
		fecha_evento: B(e.fecha_evento),
		anotaciones: B(e.anotaciones)
	};
}
function wt(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(t, n);
	if (!r) throw new z("Partida no encontrada.", 404);
	return r.parroquia_id;
}
var Tt = "No tiene permiso para modificar partidas de otra parroquia.";
function Et(e, t, n, r) {
	Xe(t, wt(e, n, r), Tt, "Solo el administrador de la parroquia puede modificar o anular una partida. Pida la corrección con una nota marginal.");
}
function Dt(e, t, n) {
	if (t === null) return;
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(t);
	if (r && r.parroquia_id !== n) throw new z("El celebrante debe ser de la parroquia de la partida.", 400);
}
function Ot(e, t, n, r, i) {
	let a = Ct(i);
	Dt(e, a.ministro_id, r);
	let o = e.prepare("INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, n, r, a.ministro_id, a.libro, a.folio, a.numero, a.fecha_emision, a.fecha_evento, a.anotaciones);
	return Number(o.lastInsertRowid);
}
function kt(e, t, n) {
	let r = Ct(n), i = e.prepare("SELECT ministro_id, parroquia_id FROM sacramentos WHERE id = ?").get(t);
	r.ministro_id !== i.ministro_id && Dt(e, r.ministro_id, i.parroquia_id), e.prepare("UPDATE sacramentos\n		 SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?\n		 WHERE id = ?").run(r.ministro_id, r.libro, r.folio, r.numero, r.fecha_emision, r.fecha_evento, r.anotaciones, t);
}
//#endregion
//#region electron/main/models/record.ts
var At = "Partida no encontrada.";
function jt(e, t, n) {
	let r = St(e, t);
	if (!r || r.tipo !== n) throw new z(At, 404);
	return {
		...r,
		solicitudes: Ie(e, t)
	};
}
function Mt(e, t, n) {
	let r = jt(e, n, t), i = e.prepare(`SELECT * FROM ${vt(t)} WHERE sacramento_id = ?`).get(n);
	return {
		sacramento: r,
		persona: $e(e, i.persona_id),
		padrino_1: i.padrino_1,
		padrino_2: i.padrino_2
	};
}
function Nt(e, t) {
	let n = jt(e, t, "matrimonio"), r = e.prepare("SELECT * FROM matrimonios WHERE sacramento_id = ?").get(t);
	return {
		sacramento: n,
		conyuge_1: $e(e, r.conyuge_1_id),
		conyuge_2: $e(e, r.conyuge_2_id),
		lugar: r.lugar,
		testigo_1: r.testigo_1,
		testigo_2: r.testigo_2,
		testigo_3: r.testigo_3,
		testigo_4: r.testigo_4,
		conyuge_1_bautismo_parroquia: r.conyuge_1_bautismo_parroquia,
		conyuge_1_bautismo_fecha: r.conyuge_1_bautismo_fecha,
		conyuge_2_bautismo_parroquia: r.conyuge_2_bautismo_parroquia,
		conyuge_2_bautismo_fecha: r.conyuge_2_bautismo_fecha
	};
}
function Pt(e, t) {
	let n = e.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(t);
	if (!n) throw new z(At, 404);
	return n.tipo === "matrimonio" ? Nt(e, t) : Mt(e, n.tipo, t);
}
var Ft = {
	persona: "",
	conyuge_1: " del esposo",
	conyuge_2: " de la esposa",
	sacramento: "",
	detalle: ""
};
function It(e, t) {
	let n = ut(e);
	if (n) throw new z(`La ${t} está incompleta: ${n}.`, 400);
}
function Lt(e) {
	It(e.sacramento?.fecha_evento, "fecha del sacramento");
	for (let t of de(e.sacramento.tipo)) It(he(e, t)?.fecha_nacimiento, `fecha de nacimiento${Ft[t]}`);
	if (e.sacramento.tipo === "matrimonio") {
		let t = e;
		It(t.conyuge_1_bautismo_fecha, "fecha de bautismo del esposo"), It(t.conyuge_2_bautismo_fecha, "fecha de bautismo de la esposa");
	}
}
function Rt(e, t) {
	let n = e.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(t);
	dt(e, n.tipo, n.client_id, n.version);
}
function zt(e) {
	return [
		B(e.lugar),
		B(e.testigo_1),
		B(e.testigo_2),
		B(e.testigo_3),
		B(e.testigo_4),
		B(e.conyuge_1_bautismo_parroquia),
		B(e.conyuge_1_bautismo_fecha),
		B(e.conyuge_2_bautismo_parroquia),
		B(e.conyuge_2_bautismo_fecha)
	];
}
function Bt(e, t) {
	return t.map((t) => ({
		parte: e,
		campo: t.campo_cambio,
		valor_anterior: t.valor_anterior ?? null,
		valor_nuevo: t.valor_nuevo
	}));
}
function Vt(e, t, n, r) {
	return de(n.sacramento.tipo).map((i) => {
		let a = he(n, i), o = nt(a);
		return {
			id: et(e, t, r ? o.person : a),
			part: i,
			corrections: o.corrections
		};
	});
}
function Ht(e) {
	return e.flatMap((e) => Bt(e.part, e.corrections));
}
function Ut(e, t, n, r) {
	let i = n.sacramento.tipo;
	if (i === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, r[0], r[1], ...zt(n));
		return;
	}
	let a = n;
	e.prepare(`INSERT INTO ${vt(i)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(t, r[0], B(a.padrino_1), B(a.padrino_2));
}
function Wt(e, t, n) {
	let r = n.sacramento.tipo;
	if (r === "matrimonio") {
		e.prepare("UPDATE matrimonios SET\n				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,\n				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,\n				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?\n			 WHERE sacramento_id = ?").run(...zt(n), t);
		return;
	}
	let i = n;
	e.prepare(`UPDATE ${vt(r)} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(B(i.padrino_1), B(i.padrino_2), t);
}
function Gt(e, t, n, r) {
	Lt(r);
	let i = n.sacramento.id, a = [];
	for (let o of de(n.sacramento.tipo)) {
		let s = he(n, o), c = s.id, l = he(r, o), u = (l.cambios ?? []).filter((e) => e.id === void 0), d = nt({
			...l,
			cambios: [...s.cambios, ...u]
		});
		tt(e, c, d.person), rt(e, t, c, i, d.corrections), a.push(...Bt(o, d.corrections));
	}
	return kt(e, i, r.sacramento), Wt(e, i, r), {
		fields: ye(n, r),
		corrections: a
	};
}
function Kt(e, t, n, r) {
	let i = he(e, t), a = {
		campo_cambio: n,
		valor_nuevo: r
	};
	return {
		...e,
		[t]: {
			...i,
			cambios: [...i.cambios ?? [], a]
		}
	};
}
//#endregion
//#region electron/main/controllers/requests.ts
var qt = "Solo un administrador de la parroquia puede aprobar o rechazar cambios.", Jt = "La partida tiene un cambio pendiente de aprobación. Un administrador de la parroquia debe aprobarlo o rechazarlo primero.", Yt = "Descartada al editar la partida";
function Xt(e, t) {
	return e.map((e) => ({
		...e,
		tipo: t
	}));
}
function Zt(e, t) {
	let n = [];
	for (let r of de(e.sacramento.tipo)) {
		let i = he(t, r), a = Array.isArray(i?.cambios) ? i.cambios.filter((e) => e.id === void 0) : [], o = he(e, r), s = nt({
			...o,
			cambios: [...o.cambios, ...a]
		}).corrections;
		for (let e of s) n.push({
			parte: r,
			campo: e.campo_cambio,
			valor_anterior: e.valor_anterior ?? null,
			valor_nuevo: e.valor_nuevo
		});
	}
	return n;
}
function Qt(e, t, n) {
	let r = V(n.sacramento?.id), i = Pt(e, r);
	if (Je(t, i.sacramento.parroquia_id, Tt), i.sacramento.estado === "anulado") throw new z("Una partida anulada no admite cambios.", 409);
	if (Me(e, r)) throw new z(Jt, 409);
	let a = B(n.sacramento?.anotaciones), o = B(i.sacramento.anotaciones) === null && a !== null, s = ye(i, n).filter((e) => !(o && e.campo === "anotaciones")), c = Zt(i, n);
	if (c.some((e) => s.some((t) => t.parte === e.parte && t.campo === e.campo))) throw new z("No cambie el mismo dato en el formulario y en la nota marginal a la vez.", 400);
	if (s.length === 0 && c.length === 0 && !o) throw new z("No hay cambios para pedir.", 400);
	Lt(n);
	let l = [...Xt(s, "digitacion"), ...Xt(c, "nota_marginal")];
	e.transaction(() => {
		Rt(e, r), o && (e.prepare("UPDATE sacramentos SET anotaciones = ? WHERE id = ?").run(a, r), U(e, r, t.user_id, "editada", [{
			parte: "sacramento",
			campo: "anotaciones",
			valor_anterior: null,
			valor_nuevo: a
		}])), l.length > 0 && (Pe(e, r, t.user_id, l), U(e, r, t.user_id, "cambio_pedido", l));
	})();
}
function $t(e, t) {
	let n = e;
	for (let e of t) n = e.tipo === "nota_marginal" ? Kt(n, e.parte, e.campo, e.valor_nuevo) : ve(n, e.parte, e.campo, e.valor_nuevo);
	return n;
}
function en(e, t) {
	return t.every((t) => t.tipo === "digitacion" ? _e(e, t.parte, t.campo) === t.valor_nuevo : (he(e, t.parte).cambios ?? []).some((e) => e.id === void 0 && e.campo_cambio === t.campo && B(e.valor_nuevo) === t.valor_nuevo));
}
function tn(e, t) {
	Xe(e, t.sacramento.parroquia_id, Tt, qt);
}
function nn(e, t, n, r) {
	if (r !== "aprobado" && r !== "rechazado") throw new z("Indique si aprueba o rechaza el cambio.", 400);
	let i = Pt(e, n);
	tn(t, i);
	let a = Ne(e, n);
	if (a.length === 0) throw new z("La partida no tiene cambios pendientes.", 409);
	e.transaction(() => {
		Rt(e, n), r === "aprobado" ? (Gt(e, t, i, $t(i, a)), U(e, n, t.user_id, "cambio_aprobado", a)) : U(e, n, t.user_id, "cambio_rechazado", a), Fe(e, n, r, t.user_id), e.prepare("UPDATE sacramentos SET updated_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), n);
	})();
}
function rn(e, t, n, r) {
	let i = Ne(e, n);
	if (i.length !== 0) {
		if (en(r, i)) {
			Fe(e, n, "aprobado", t.user_id), U(e, n, t.user_id, "cambio_aprobado", i);
			return;
		}
		Fe(e, n, "descartado", t.user_id, Yt), U(e, n, t.user_id, "cambio_descartado", i, Yt);
	}
}
function an(e, t) {
	if (t.role !== "admin_parroquia" || !t.parish_id) throw new z(qt, 403);
	return e.prepare("SELECT r.sacramento_id, MIN(r.id) AS primera, u.nombre, u.apellido_paterno, u.apellido_materno\n			 FROM solicitudes_cambio r\n			 JOIN sacramentos s ON s.id = r.sacramento_id\n			 LEFT JOIN usuarios u ON u.id = r.usuario_id\n			 WHERE r.estado = 'pendiente' AND s.parroquia_id = ?\n			 GROUP BY r.sacramento_id\n			 ORDER BY primera").all(t.parish_id).map((t) => ({
		partida: Pt(e, t.sacramento_id),
		solicitado_por: H(t.nombre, t.apellido_paterno, t.apellido_materno)
	}));
}
var on = {
	"requests.pending": (e, { db: t, session: n }) => ({ pendientes: an(t, n) }),
	"requests.review": (e, { db: t, session: n }) => (nn(t, n, V(e.sacramento_id), e.decision), { success: !0 })
}, sn = 32, cn = 32, ln = 16, un = {
	N: 2 ** 15,
	r: 8,
	p: 1,
	maxmem: 67108864
};
function dn() {
	return w(sn).toString("hex");
}
function fn(e, t, n, r) {
	return new Promise((i, a) => {
		E(e.normalize("NFKC"), t, r, n, (e, t) => {
			e ? a(e) : i(t);
		});
	});
}
async function pn(e) {
	let t = w(ln), n = await fn(e, t, un, cn);
	return `scrypt:${un.N}:${un.r}:${un.p}:${t.toString("base64")}:${n.toString("base64")}`;
}
var mn = 1e5, hn = 256;
function gn(e, t, n) {
	return new Promise((r, i) => {
		C(e, t, n, hn / 8, "sha256", (e, t) => {
			e ? i(e) : r(t);
		});
	});
}
async function _n(e) {
	let t = w(ln), n = await gn(e, t, mn);
	return `${mn}:${t.toString("base64")}:${n.toString("base64")}`;
}
async function vn(e, t) {
	let [n, r, i] = t.split(":");
	if (!/^\d+$/.test(n ?? "") || !r || !i) return !1;
	let a = Buffer.from(i, "base64"), o = await gn(e, Buffer.from(r, "base64"), Number(n));
	return o.length === a.length && D(o, a);
}
async function yn(e, t) {
	if (!t.startsWith("scrypt:")) return vn(e, t);
	let [, n, r, i, a, o] = t.split(":");
	if (!a || !o) return !1;
	let s = Buffer.from(o, "base64"), c = {
		N: Number(n),
		r: Number(r),
		p: Number(i),
		maxmem: un.maxmem
	}, l = await fn(e, Buffer.from(a, "base64"), c, s.length);
	return D(l, s);
}
var bn = 12;
async function xn(e, t) {
	let n = w(ln), r = w(bn), i = await fn(e, n, un, sn), a = ee("aes-256-gcm", i, r), o = Buffer.concat([a.update(t), a.final()]);
	return {
		sal: n.toString("base64"),
		iv: r.toString("base64"),
		etiqueta: a.getAuthTag().toString("base64"),
		datos: o.toString("base64")
	};
}
async function Sn(e, t) {
	let n = await fn(e, Buffer.from(t.sal, "base64"), un, sn);
	try {
		let e = S("aes-256-gcm", n, Buffer.from(t.iv, "base64"));
		return e.setAuthTag(Buffer.from(t.etiqueta, "base64")), Buffer.concat([e.update(Buffer.from(t.datos, "base64")), e.final()]);
	} catch {
		return null;
	}
}
//#endregion
//#region electron/main/db/migrations.ts
var Cn = [
	"\n  CREATE TABLE parroquias (\n    id        INTEGER PRIMARY KEY,\n    nombre    TEXT    NOT NULL,\n    ubicacion TEXT,\n    activa    INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE usuarios (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER REFERENCES parroquias(id),\n    username         TEXT    NOT NULL UNIQUE,\n    rol              TEXT    NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE ministros (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE personas (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    dni              TEXT    CHECK (dni IS NULL OR dni <> ''),\n    nombres          TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL DEFAULT '',\n    fecha_nacimiento TEXT,\n    edad             INTEGER CHECK (edad IS NULL OR edad >= 0),\n    lugar_nacimiento TEXT,\n    padre            TEXT,\n    madre            TEXT,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;\n  CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);\n\n  CREATE TABLE sacramentos (\n    id                     INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id              TEXT    NOT NULL UNIQUE,\n    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),\n    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),\n    ministro_id            INTEGER REFERENCES ministros(id),\n    libro                  TEXT    NOT NULL,\n    folio                  TEXT    NOT NULL,\n    numero                 TEXT    NOT NULL,\n    fecha_emision          TEXT    NOT NULL,\n    fecha_evento           TEXT,\n    anotaciones            TEXT,\n    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),\n    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    anulado_en             TEXT,\n    motivo_anulacion       TEXT,\n    version                INTEGER NOT NULL DEFAULT 1,\n    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    -- Permite que cada subtipo enlace (id, tipo): un bautismo no puede colgar de un matrimonio.\n    UNIQUE (id, tipo),\n    CHECK (\n      estado = 'vigente'\n      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL\n          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')\n    )\n  );\n  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);\n\n  CREATE TABLE matrimonios (\n    sacramento_id                INTEGER PRIMARY KEY,\n    tipo                         TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),\n    conyuge_1_id                 INTEGER NOT NULL REFERENCES personas(id),\n    conyuge_2_id                 INTEGER NOT NULL REFERENCES personas(id),\n    lugar                        TEXT,\n    testigo_1                    TEXT,\n    testigo_2                    TEXT,\n    testigo_3                    TEXT,\n    testigo_4                    TEXT,\n    conyuge_1_bautismo_parroquia TEXT,\n    conyuge_1_bautismo_fecha     TEXT,\n    conyuge_2_bautismo_parroquia TEXT,\n    conyuge_2_bautismo_fecha     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),\n    CHECK (conyuge_1_id <> conyuge_2_id)\n  );\n  CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);\n  CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);\n\n  CREATE TABLE bautismos (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);\n\n  CREATE TABLE confirmaciones (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);\n\n  CREATE TABLE cambios_persona (\n    id             INTEGER PRIMARY KEY AUTOINCREMENT,\n    -- Evita duplicar la corrección si se reenvía tras un corte de internet.\n    client_id      TEXT    NOT NULL UNIQUE,\n    persona_id     INTEGER NOT NULL REFERENCES personas(id),\n    sacramento_id  INTEGER REFERENCES sacramentos(id),\n    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),\n    campo_cambio   TEXT    NOT NULL,\n    valor_anterior TEXT,\n    valor_nuevo    TEXT,\n    fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);\n\n  -- Cada UPDATE sube version, salvo que la sincronización ya la haya fijado.\n  CREATE TRIGGER trg_personas_touch\n  AFTER UPDATE ON personas\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE personas\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  CREATE TRIGGER trg_sacramentos_touch\n  AFTER UPDATE ON sacramentos\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE sacramentos\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  CREATE TABLE ministros_nueva (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO ministros_nueva (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo)\n  SELECT id, 'servidor-' || id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo\n  FROM ministros;\n\n  DROP TABLE ministros;\n  ALTER TABLE ministros_nueva RENAME TO ministros;\n\n  CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);\n\n  CREATE TRIGGER trg_ministros_touch\n  AFTER UPDATE ON ministros\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE ministros\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  -- Registros con cambios sin subir. Se envía su estado final, así que basta una fila por registro.\n  -- version_base: última versión que conoce el servidor; NULL si el registro aún no existe allí.\n  CREATE TABLE sync_cola (\n    id           INTEGER PRIMARY KEY AUTOINCREMENT,\n    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro')),\n    client_id    TEXT    NOT NULL,\n    version_base INTEGER,\n    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    UNIQUE (entidad, client_id)\n  );\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT tipo, client_id FROM sacramentos ORDER BY id;\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT 'ministro', client_id FROM ministros ORDER BY id;\n  ",
	"\n  -- cola_id: identifica la fila mientras siga pendiente, para reconocer un reenvío tras un corte.\n  -- revision: sube con cada edición; si cambió durante el envío, la fila no se quita al confirmarse.\n  ALTER TABLE sync_cola ADD COLUMN cola_id TEXT NOT NULL DEFAULT '';\n  ALTER TABLE sync_cola ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;\n  ALTER TABLE sync_cola ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'\n    CHECK (estado IN ('pendiente', 'conflicto', 'rechazado'));\n  ALTER TABLE sync_cola ADD COLUMN motivo TEXT;\n  UPDATE sync_cola SET cola_id = lower(hex(randomblob(16)));\n\n  CREATE TABLE sync_estado (\n    clave TEXT PRIMARY KEY,\n    valor TEXT\n  );\n\n  -- Verificación para entrar sin internet. Solo existe para quien ya entró con conexión en esta PC.\n  CREATE TABLE credenciales_locales (\n    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),\n    verificador    TEXT NOT NULL,\n    actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  ",
	"\n  -- La edad pasa a ser una fecha aproximada en texto libre: los libros traen cosas como\n  -- \"22 AG 1978\" o \"(27 AÑOS AL DIA DE BODA)\". Las edades que ya había se conservan como \"N años\".\n  ALTER TABLE personas ADD COLUMN fecha_aproximada TEXT;\n  UPDATE personas SET fecha_aproximada = edad || ' años' WHERE edad IS NOT NULL;\n  ALTER TABLE personas DROP COLUMN edad;\n  ",
	"\n  -- Tres roles (ver worker/src/db/migrations/0015_roles_y_correcciones.sql):\n  --   admin_general, admin_parroquia (el párroco) y usuario (un ayudante).\n  -- Un admin sin parroquia pasa a admin_general; las demás cuentas, a admin_parroquia.\n  --\n  -- Los usuarios ahora se pueden crear y editar en esta PC sin internet y subirse después:\n  --   client_id      los identifica ante el servidor (el mismo 'servidor-<id>' que puso su migración).\n  --   id negativo    una cuenta creada aquí que el servidor todavía no conoce; al subirla se cambia por el suyo.\n  --   password_hash_pendiente   la contraseña cambiada aquí que falta subir (PBKDF2, el formato del\n  --                             servidor). Se borra en cuanto el servidor la recibe.\n  CREATE TABLE usuarios_nueva (\n    id               INTEGER PRIMARY KEY,\n    client_id        TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),\n    parroquia_id     INTEGER REFERENCES parroquias(id),\n    username         TEXT    NOT NULL UNIQUE,\n    rol              TEXT    NOT NULL CHECK (rol IN ('admin_general', 'admin_parroquia', 'usuario')),\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1,\n    principal        INTEGER NOT NULL DEFAULT 0,\n    password_hash_pendiente TEXT,\n    version          INTEGER NOT NULL DEFAULT 1,\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO usuarios_nueva (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)\n  SELECT id, 'servidor-' || id, parroquia_id, username,\n         CASE WHEN rol = 'admin' AND parroquia_id IS NULL THEN 'admin_general' ELSE 'admin_parroquia' END,\n         nombre, apellido_paterno, apellido_materno, activo\n  FROM usuarios;\n\n  DROP TABLE usuarios;\n  ALTER TABLE usuarios_nueva RENAME TO usuarios;\n\n  CREATE TRIGGER trg_usuarios_touch\n  AFTER UPDATE ON usuarios\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE usuarios\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  -- Una corrección pedida por un usuario queda 'pendiente' hasta que el admin_parroquia la revise.\n  ALTER TABLE cambios_persona ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'\n    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));\n  ALTER TABLE cambios_persona ADD COLUMN revisado_por_usuario_id INTEGER REFERENCES usuarios(id);\n  ALTER TABLE cambios_persona ADD COLUMN revisado_en TEXT;\n\n  -- La cola también lleva usuarios.\n  CREATE TABLE sync_cola_nueva (\n    id           INTEGER PRIMARY KEY AUTOINCREMENT,\n    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro', 'usuario')),\n    client_id    TEXT    NOT NULL,\n    version_base INTEGER,\n    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    cola_id      TEXT    NOT NULL DEFAULT '',\n    revision     INTEGER NOT NULL DEFAULT 1,\n    estado       TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'conflicto', 'rechazado')),\n    motivo       TEXT,\n    UNIQUE (entidad, client_id)\n  );\n\n  INSERT INTO sync_cola_nueva (id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo)\n  SELECT id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo FROM sync_cola;\n\n  DROP TABLE sync_cola;\n  ALTER TABLE sync_cola_nueva RENAME TO sync_cola;\n  ",
	"\n  ALTER TABLE sacramentos ADD COLUMN anotaciones_propuestas TEXT;\n  ",
	"\n  CREATE TABLE solicitudes_cambio (\n    id                      INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id               TEXT    NOT NULL UNIQUE,\n    sacramento_id           INTEGER NOT NULL REFERENCES sacramentos(id),\n    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),\n    parte                   TEXT    NOT NULL CHECK (parte IN ('sacramento', 'persona', 'conyuge_1', 'conyuge_2', 'detalle')),\n    campo                   TEXT    NOT NULL,\n    tipo                    TEXT    NOT NULL CHECK (tipo IN ('digitacion', 'nota_marginal')),\n    valor_anterior          TEXT,\n    valor_nuevo             TEXT,\n    estado                  TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'descartado')),\n    motivo                  TEXT,\n    revisado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    revisado_en             TEXT,\n    creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  CREATE INDEX idx_solicitudes_sacramento ON solicitudes_cambio (sacramento_id);\n\n  CREATE TABLE historial_partidas (\n    id            INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id     TEXT    NOT NULL UNIQUE,\n    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),\n    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),\n    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',\n                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada')),\n    motivo        TEXT,\n    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);\n\n  CREATE TABLE historial_campos (\n    id             INTEGER PRIMARY KEY AUTOINCREMENT,\n    historial_id   INTEGER NOT NULL REFERENCES historial_partidas(id),\n    parte          TEXT    NOT NULL,\n    campo          TEXT    NOT NULL,\n    valor_anterior TEXT,\n    valor_nuevo    TEXT\n  );\n\n  CREATE INDEX idx_historial_campos ON historial_campos (historial_id);\n\n  -- Las correcciones de nombres pendientes: la misma client_id que tenían.\n  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n  SELECT\n    c.client_id,\n    c.sacramento_id,\n    c.usuario_id,\n    CASE\n      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_1_id = c.persona_id) THEN 'conyuge_1'\n      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_2_id = c.persona_id) THEN 'conyuge_2'\n      ELSE 'persona'\n    END,\n    c.campo_cambio,\n    'nota_marginal',\n    c.valor_anterior,\n    c.valor_nuevo,\n    c.fecha_cambio\n  FROM cambios_persona c\n  WHERE c.estado = 'pendiente' AND c.sacramento_id IS NOT NULL;\n\n  -- La nota propuesta: la pidió quien pidió la corrección que iba con ella.\n  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n  SELECT\n    s.client_id || '-nota',\n    s.id,\n    c.usuario_id,\n    'sacramento',\n    'anotaciones',\n    'digitacion',\n    s.anotaciones,\n    s.anotaciones_propuestas,\n    c.fecha_cambio\n  FROM sacramentos s\n  JOIN cambios_persona c ON c.id = (SELECT MIN(id) FROM cambios_persona WHERE sacramento_id = s.id AND estado = 'pendiente')\n  WHERE s.anotaciones_propuestas IS NOT NULL;\n\n  DELETE FROM cambios_persona WHERE estado = 'pendiente';\n\n  ALTER TABLE sacramentos DROP COLUMN anotaciones_propuestas;\n  ",
	"\n  UPDATE usuarios SET principal = 1\n  WHERE id IN (\n    SELECT MIN(a.id) FROM usuarios a\n    WHERE a.rol = 'admin_parroquia' AND a.activo = 1 AND a.id > 0\n      AND NOT EXISTS (SELECT 1 FROM usuarios p WHERE p.principal = 1 AND p.parroquia_id = a.parroquia_id)\n    GROUP BY a.parroquia_id\n  );\n  ",
	"\n  CREATE TABLE usuario_parroquias (\n    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),\n    parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),\n    rol          TEXT    NOT NULL CHECK (rol IN ('admin_parroquia', 'usuario')),\n    principal    INTEGER NOT NULL DEFAULT 0,\n    PRIMARY KEY (usuario_id, parroquia_id)\n  );\n\n  CREATE VIEW membresias AS\n    SELECT id AS usuario_id, parroquia_id, rol, principal, 1 AS origen\n    FROM usuarios\n    WHERE parroquia_id IS NOT NULL\n    UNION ALL\n    SELECT usuario_id, parroquia_id, rol, principal, 0 AS origen\n    FROM usuario_parroquias;\n  ",
	"\n  CREATE TABLE historial_partidas_respaldo AS SELECT * FROM historial_partidas;\n\n  DROP TABLE historial_partidas;\n\n  CREATE TABLE historial_partidas (\n    id            INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id     TEXT    NOT NULL UNIQUE,\n    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),\n    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),\n    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',\n                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada',\n                                                     'rehabilitada')),\n    motivo        TEXT,\n    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO historial_partidas (id, client_id, sacramento_id, usuario_id, evento, motivo, fecha)\n  SELECT id, client_id, sacramento_id, usuario_id, evento, motivo, fecha FROM historial_partidas_respaldo;\n\n  DROP TABLE historial_partidas_respaldo;\n\n  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);\n  ",
	"\n  UPDATE personas\n  SET nombres = (\n    SELECT c.valor_anterior FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n    ORDER BY c.fecha_cambio, c.id LIMIT 1\n  )\n  WHERE EXISTS (\n    SELECT 1 FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n  );\n\n  UPDATE personas\n  SET apellido_paterno = (\n    SELECT c.valor_anterior FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n    ORDER BY c.fecha_cambio, c.id LIMIT 1\n  )\n  WHERE EXISTS (\n    SELECT 1 FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n  );\n\n  UPDATE personas\n  SET apellido_materno = (\n    SELECT c.valor_anterior FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n    ORDER BY c.fecha_cambio, c.id LIMIT 1\n  )\n  WHERE EXISTS (\n    SELECT 1 FROM cambios_persona c\n    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL\n  );\n  ",
	"\n  UPDATE sync_cola SET version_base = version_base + 1\n  WHERE version_base IS NOT NULL AND client_id IN (\n    SELECT client_id FROM sacramentos\n    WHERE fecha_evento IS NOT NULL AND fecha_emision <> fecha_evento\n    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada')\n  );\n\n  UPDATE sacramentos\n  SET fecha_emision = fecha_evento, version = version + 1\n  WHERE fecha_evento IS NOT NULL AND fecha_emision <> fecha_evento\n    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');\n  ",
	"\n  CREATE TABLE sacramentos_respaldo AS SELECT * FROM sacramentos;\n\n  DROP TABLE sacramentos;\n\n  CREATE TABLE sacramentos (\n    id                     INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id              TEXT    NOT NULL UNIQUE,\n    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),\n    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),\n    ministro_id            INTEGER REFERENCES ministros(id),\n    libro                  TEXT    NOT NULL,\n    folio                  TEXT    NOT NULL,\n    numero                 TEXT    NOT NULL,\n    fecha_emision          TEXT,\n    fecha_evento           TEXT,\n    anotaciones            TEXT,\n    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),\n    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    anulado_en             TEXT,\n    motivo_anulacion       TEXT,\n    version                INTEGER NOT NULL DEFAULT 1,\n    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    UNIQUE (id, tipo),\n    CHECK (\n      estado = 'vigente'\n      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL\n          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')\n    )\n  );\n\n  INSERT INTO sacramentos\n    (id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n     estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at)\n  SELECT\n    id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n    estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at\n  FROM sacramentos_respaldo;\n\n  DROP TABLE sacramentos_respaldo;\n\n  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);\n\n  CREATE TRIGGER trg_sacramentos_touch\n  AFTER UPDATE ON sacramentos\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE sacramentos\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  UPDATE sync_cola SET version_base = version_base + 1\n  WHERE version_base IS NOT NULL AND client_id IN (\n    SELECT client_id FROM sacramentos\n    WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL\n      AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada')\n  );\n\n  UPDATE sacramentos\n  SET fecha_emision = NULL, version = version + 1\n  WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL\n    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');\n  ",
	"\n  -- Historial de ministros y cuentas: igual que en el servidor (worker/src/db/migrations/0024).\n  CREATE TABLE historial_ministros_cuentas (\n    id                 INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id          TEXT    NOT NULL UNIQUE,\n    parroquia_id       INTEGER REFERENCES parroquias(id),\n    entidad            TEXT    NOT NULL CHECK (entidad IN ('ministro', 'usuario')),\n    entidad_client_id  TEXT    NOT NULL,\n    usuario_client_id  TEXT,\n    evento             TEXT    NOT NULL CHECK (evento IN ('creado', 'editado', 'contrasena', 'deshabilitado', 'habilitado',\n                                                           'principal', 'parroquia_agregada', 'parroquia_quitada')),\n    detalle            TEXT,\n    fecha              TEXT    NOT NULL\n  );\n\n  CREATE INDEX idx_historial_ministros_cuentas_parroquia ON historial_ministros_cuentas (parroquia_id, fecha);\n  CREATE INDEX idx_historial_ministros_cuentas_entidad ON historial_ministros_cuentas (entidad, entidad_client_id);\n  "
], wn = /^[0-9a-f]{64}$/i, Tn = class extends Error {};
function En(e, t) {
	let n = e.pragma("user_version", { simple: !0 });
	if (n > t.length) throw new Tn(`La base local está en la versión ${n} y esta app solo conoce hasta la ${t.length}.`);
	e.pragma("foreign_keys = OFF");
	for (let r = n; r < t.length; r++) e.transaction(() => {
		if (e.exec(t[r]), e.pragma("foreign_key_check").length > 0) throw Error("La migración dejó claves foráneas rotas.");
		e.pragma(`user_version = ${r + 1}`);
	})();
	e.pragma("foreign_keys = ON");
}
function Dn(e, t, n = Cn) {
	if (!wn.test(t)) throw Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	let r = new x(e);
	try {
		return r.pragma("cipher='chacha20'"), r.pragma(`hexkey='${t}'`), r.prepare("SELECT count(*) FROM sqlite_master").get(), r.pragma("foreign_keys = ON"), r.pragma("journal_mode = WAL"), r.pragma("synchronous = FULL"), En(r, n), r;
	} catch (e) {
		throw r.close(), e;
	}
}
function On(e) {
	let t = e?.code ?? "";
	return t.startsWith("SQLITE_NOTADB") || t.startsWith("SQLITE_CORRUPT");
}
function kn(e) {
	return {
		directory: e,
		database: s.join(e, we.database),
		key: s.join(e, we.key),
		device: s.join(e, we.device),
		temp_database: s.join(e, we.temp_database),
		temp_key: s.join(e, we.temp_key),
		set_aside_folder: s.join(e, we.set_aside_folder)
	};
}
function An(e) {
	if (u(e.device)) return f(e.device, "utf8").trim();
	let t = T();
	return _(e.device, t), t;
}
function jn(e, t) {
	for (let n of [
		"",
		"-wal",
		"-shm"
	]) u(e + n) && m(e + n, t + n);
}
function Mn(e) {
	for (let t of [
		"",
		"-wal",
		"-shm"
	]) h(e + t, { force: !0 });
}
function Nn(e) {
	u(e.set_aside_folder) && p(e.set_aside_folder).filter((e) => e.endsWith(".db")).sort().reverse().forEach((t, n) => {
		let r = s.join(e.set_aside_folder, t), i = Date.now() - g(r).mtimeMs > Te;
		(n > 0 || i) && Mn(r);
	});
}
function Pn(e) {
	if (!u(e.database)) return;
	d(e.set_aside_folder, { recursive: !0 });
	let t = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	jn(e.database, s.join(e.set_aside_folder, `prelatura-local-${t}.db`)), Nn(e);
}
function Fn(e, t) {
	Nn(e);
	let n = t.read(e.key);
	if (!u(e.database)) {
		let r = n ?? dn(), i = Dn(e.database, r);
		return n || t.write(e.key, r), {
			status: "open",
			db: i,
			key: r
		};
	}
	if (!n) return { status: "needs-recovery" };
	try {
		let t = Dn(e.database, n);
		return Mn(e.temp_database), h(e.temp_key, { force: !0 }), {
			status: "open",
			db: t,
			key: n
		};
	} catch (e) {
		if (e instanceof Tn) return {
			status: "failed",
			message: "La base local es de una versión más nueva. Actualice la aplicación."
		};
		if (On(e)) return { status: "needs-recovery" };
		throw e;
	}
}
function In(e, t, n) {
	try {
		let r = Dn(e.database, n);
		return t.write(e.key, n), r;
	} catch (e) {
		if (!On(e)) throw e;
		return null;
	}
}
function Ln(e, t) {
	let n = t.read(e.temp_key);
	(!n || !u(e.temp_database)) && (Mn(e.temp_database), n = dn(), t.write(e.temp_key, n));
	try {
		return {
			db: Dn(e.temp_database, n),
			key: n
		};
	} catch (t) {
		if (!On(t)) throw t;
		return Mn(e.temp_database), {
			db: Dn(e.temp_database, n),
			key: n
		};
	}
}
function Rn(e, t, n) {
	Mn(e.temp_database);
	let r = dn();
	return t.write(e.temp_key, r), {
		db: Dn(e.temp_database, r, n),
		key: r
	};
}
function zn(e, t, n) {
	return Pn(e), jn(e.temp_database, e.database), t.write(e.key, n), h(e.temp_key, { force: !0 }), Dn(e.database, n);
}
//#endregion
//#region electron/main/db/app_database.ts
var Bn = null, Vn = null, Hn = !1, Un = "La base local no está disponible.";
function Wn() {
	if (!a.isEncryptionAvailable()) throw Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
}
function Gn(e) {
	if (Wn(), !u(e)) return null;
	try {
		return a.decryptString(f(e));
	} catch {
		return null;
	}
}
function Kn(e, t) {
	Wn(), _(e, a.encryptString(t), { mode: 384 });
}
var qn = {
	read: Gn,
	write: Kn
};
function Jn() {
	return kn(n.getPath("userData"));
}
function Yn() {
	let e = Fn(Jn(), qn);
	e.status === "open" ? (Bn = e.db, Vn = e.key) : e.status === "needs-recovery" ? (Hn = !0, Un = "La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.") : Un = e.message;
}
function W() {
	if (!Bn) throw new z(Un, 503);
	return Bn;
}
function Xn() {
	return Vn;
}
function Zn() {
	return Hn;
}
function Qn(e, t) {
	Bn = e, Vn = t, Hn = !1;
}
function $n() {
	Bn?.close(), Bn = null, Vn = null;
}
//#endregion
//#region electron/main/models/staff_history.ts
function er(e) {
	let t = e.filter((e) => (e.before ?? "") !== (e.after ?? "")).map((e) => `${e.label}: ${e.before || "(vacío)"} → ${e.after || "(vacío)"}`);
	return t.length > 0 ? t.join("; ") : null;
}
function tr(e, t, n, r, i, a, o = null) {
	let s = e.prepare("SELECT client_id FROM usuarios WHERE id = ?").pluck().get(t.user_id);
	e.prepare("INSERT INTO historial_ministros_cuentas\n			(client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), i, n, r, s ?? null, a, o, (/* @__PURE__ */ new Date()).toISOString());
}
function nr(e, t, n) {
	return e.prepare("SELECT client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha\n			 FROM historial_ministros_cuentas WHERE entidad = ? AND entidad_client_id = ? ORDER BY id").all(t, n);
}
function rr(e, t) {
	let n = e.prepare("INSERT INTO historial_ministros_cuentas\n			(client_id, parroquia_id, entidad, entidad_client_id, usuario_client_id, evento, detalle, fecha)\n		 VALUES (@client_id, @parroquia_id, @entidad, @entidad_client_id, @usuario_client_id, @evento, @detalle, @fecha)\n		 ON CONFLICT (client_id) DO NOTHING");
	for (let e of t) n.run(e);
}
//#endregion
//#region electron/main/sync/records.ts
var ir = class extends Error {};
function ar(e, t, n) {
	e.prepare(`UPDATE ${t} SET version = -1 WHERE id = ?`).run(n);
}
function or(e) {
	return e === "ministro" ? "ministros" : e === "usuario" ? "usuarios" : "sacramentos";
}
function sr(e, t, n, r) {
	e.prepare(`UPDATE ${or(t)} SET version = ? WHERE client_id = ? AND version <> ?`).run(r, n, r);
}
function cr(e, t) {
	return {
		...e.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t),
		historial: nr(e, "ministro", t)
	};
}
function lr(e, t) {
	return {
		...e.prepare("SELECT client_id, id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo,\n				password_hash_pendiente AS password_hash\n			 FROM usuarios WHERE client_id = ?").get(t),
		historial: nr(e, "usuario", t)
	};
}
function ur(e, t) {
	let n = e.prepare("SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,\n				s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion\n			 FROM sacramentos s\n			 LEFT JOIN ministros m ON m.id = s.ministro_id\n			 WHERE s.client_id = ?").get(t), r = n.tipo, i = e.prepare(`SELECT * FROM ${vt(r)} WHERE sacramento_id = ?`).get(n.id), a = e.prepare(`SELECT client_id, ${ce.join(", ")} FROM personas WHERE id = ?`), o = [];
	for (let e of yt(r)) o.push(a.get(i[e]));
	let s = {};
	for (let e of ue(r)) s[e] = i[e];
	let c = e.prepare("SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio, c.valor_anterior, c.valor_nuevo, c.fecha_cambio,\n				c.estado, c.revisado_por_usuario_id, c.revisado_en\n			 FROM cambios_persona c\n			 JOIN personas p ON p.id = c.persona_id\n			 WHERE c.sacramento_id = ?\n			 ORDER BY c.id").all(n.id);
	return {
		tipo: r,
		client_id: n.client_id,
		parroquia_id: n.parroquia_id,
		ministro_client_id: n.ministro_client_id,
		libro: n.libro,
		folio: n.folio,
		numero: n.numero,
		fecha_emision: n.fecha_emision,
		fecha_evento: n.fecha_evento,
		anotaciones: n.anotaciones,
		estado: n.estado,
		anulado_por_usuario_id: n.anulado_por_usuario_id,
		anulado_en: n.anulado_en,
		motivo_anulacion: n.motivo_anulacion,
		personas: o,
		detalle: s,
		cambios: c,
		solicitudes: Le(e, n.id),
		historial: He(e, n.id)
	};
}
function dr(e, t, n) {
	let r = ce.map((e) => n[e]), i = e.prepare("SELECT id FROM personas WHERE client_id = ?").get(n.client_id);
	if (i) {
		let t = ce.map((e) => `${e} = ?`).join(", ");
		return e.prepare(`UPDATE personas SET ${t} WHERE id = ?`).run(...r, i.id), i.id;
	}
	let a = ce.map(() => "?").join(", "), o = e.prepare(`INSERT INTO personas (client_id, parroquia_id, ${ce.join(", ")}) VALUES (?, ?, ${a})`).run(n.client_id, t, ...r);
	return Number(o.lastInsertRowid);
}
function fr(e, t) {
	if (!t) return null;
	let n = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(t);
	if (!n) throw new ir(`Ministro desconocido: ${t}`);
	return n.id;
}
function pr(e, t, n = !1) {
	let r = t.version ?? 1, i = e.prepare("SELECT id, version FROM sacramentos WHERE client_id = ?").get(t.client_id);
	if (!n && (ft(e, t.tipo, t.client_id) || i && i.version === r)) return;
	let a = fr(e, t.ministro_client_id), o = t.personas.map((n) => dr(e, t.parroquia_id, n)), s = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), c = [
		a,
		t.libro,
		t.folio,
		t.numero,
		t.fecha_emision,
		t.fecha_evento,
		t.anotaciones,
		t.estado,
		t.anulado_por_usuario_id,
		t.anulado_en,
		t.motivo_anulacion,
		r,
		s
	], l;
	if (i) l = i.id, ar(e, "sacramentos", i.id), e.prepare("UPDATE sacramentos SET\n				ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,\n				estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(...c, i.id);
	else {
		let n = e.prepare("INSERT INTO sacramentos\n					(ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n					 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,\n					 client_id, tipo, parroquia_id)\n				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...c, t.client_id, t.tipo, t.parroquia_id);
		l = Number(n.lastInsertRowid);
	}
	if (mr(e, t, l, o), hr(e, t, l, o), Re(e, l, t.solicitudes ?? []), Ue(e, l, t.historial ?? []), n) {
		let n = JSON.stringify(t.cambios.map((e) => e.client_id));
		e.prepare("DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(l, n), ze(e, l, t.solicitudes ?? []), We(e, l, t.historial ?? []), pt(e, t.tipo, t.client_id);
	}
}
function mr(e, t, n, r) {
	let i = t.detalle;
	if (t.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n			 ON CONFLICT (sacramento_id) DO UPDATE SET\n				conyuge_1_id = excluded.conyuge_1_id,\n				conyuge_2_id = excluded.conyuge_2_id,\n				lugar = excluded.lugar,\n				testigo_1 = excluded.testigo_1,\n				testigo_2 = excluded.testigo_2,\n				testigo_3 = excluded.testigo_3,\n				testigo_4 = excluded.testigo_4,\n				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,\n				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,\n				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,\n				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha").run(n, r[0], r[1], i.lugar ?? null, i.testigo_1 ?? null, i.testigo_2 ?? null, i.testigo_3 ?? null, i.testigo_4 ?? null, i.conyuge_1_bautismo_parroquia ?? null, i.conyuge_1_bautismo_fecha ?? null, i.conyuge_2_bautismo_parroquia ?? null, i.conyuge_2_bautismo_fecha ?? null);
		return;
	}
	e.prepare(`INSERT INTO ${vt(t.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (sacramento_id) DO UPDATE SET
			persona_id = excluded.persona_id,
			padrino_1 = excluded.padrino_1,
			padrino_2 = excluded.padrino_2`).run(n, r[0], i.padrino_1 ?? null, i.padrino_2 ?? null);
}
function hr(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	t.personas.forEach((e, t) => i.set(e.client_id, r[t]));
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,\n			 estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of t.cambios) a.run(e.client_id, i.get(e.persona_client_id), n, e.usuario_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, e.fecha_cambio, e.estado ?? "aprobado", e.revisado_por_usuario_id ?? null, e.revisado_en ?? null);
}
function gr(e) {
	return `El nombre de usuario "${e}" ya lo tiene otra cuenta (creada en otra PC). Póngale otro nombre de usuario a esta cuenta en Configuración > Agregar usuario > Editar: después se sube sola.`;
}
function _r(e) {
	return e.startsWith("~");
}
function vr(e, t, n = !1) {
	if (t = {
		...t,
		client_id: t.client_id ?? `servidor-${t.id}`
	}, !n && ft(e, "usuario", t.client_id)) return;
	let r = e.prepare("SELECT id, client_id FROM usuarios WHERE username = ? AND id <> ? AND id < 0").get(t.username, t.id);
	r && ft(e, "usuario", r.client_id) && e.prepare("UPDATE sync_cola SET estado = 'rechazado', motivo = ? WHERE entidad = 'usuario' AND client_id = ?").run(gr(t.username), r.client_id), e.prepare("UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?").run(t.username, t.id), e.prepare("UPDATE usuarios SET client_id = '~' || id WHERE client_id = ? AND id <> ?").run(t.client_id, t.id), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, updated_at)\n		 VALUES (@id, @client_id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo, @principal, @updated_at)\n		 ON CONFLICT (id) DO UPDATE SET\n			client_id = @client_id, parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,\n			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo,\n			principal = @principal, updated_at = @updated_at, password_hash_pendiente = NULL").run({
		id: t.id,
		client_id: t.client_id,
		parroquia_id: t.parroquia_id,
		username: t.username,
		rol: t.rol,
		nombre: t.nombre,
		apellido_paterno: t.apellido_paterno,
		apellido_materno: t.apellido_materno ?? "",
		activo: t.activo,
		principal: t.principal ?? 0,
		updated_at: t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString()
	}), ar(e, "usuarios", t.id), e.prepare("UPDATE usuarios SET version = ? WHERE id = ?").run(t.version ?? 1, t.id), t.password_hash && e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n			 ON CONFLICT (usuario_id) DO UPDATE SET\n				verificador = excluded.verificador,\n				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t.id, t.password_hash), n && pt(e, "usuario", t.client_id);
}
function yr(e, t, n) {
	let r = e.prepare("SELECT id FROM usuarios WHERE client_id = ?").get(t);
	if (!r || r.id === n) return null;
	let i = r.id;
	return e.pragma("defer_foreign_keys = ON"), e.prepare("UPDATE usuarios SET id = ? WHERE id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE sacramentos SET anulado_por_usuario_id = ? WHERE anulado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE historial_partidas SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE credenciales_locales SET usuario_id = ? WHERE usuario_id = ?").run(n, i), i;
}
var br = [
	"titulo",
	"nombre",
	"apellido_paterno",
	"apellido_materno",
	"activo"
];
function xr(e, t, n = !1) {
	let r = t.version ?? 1, i = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), a = e.prepare("SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t.client_id);
	if (!n && ft(e, "ministro", t.client_id)) {
		let n = a !== void 0 && br.every((e) => (a[e] ?? null) === (t[e] ?? null)), i = e.prepare("SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?").get("ministro", t.client_id);
		if (!n || i.version_base !== null) return;
		pt(e, "ministro", t.client_id), sr(e, "ministro", t.client_id, r);
		return;
	}
	if (!a) {
		e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t.client_id, t.parroquia_id, t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i);
		return;
	}
	(n || a.version !== r) && (ar(e, "ministros", a.id), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i, a.id)), n && pt(e, "ministro", t.client_id);
}
//#endregion
//#region electron/main/sync/conflicts.ts
var Sr = "(vacío)", Cr = [
	"fecha_emision",
	"fecha_evento",
	"fecha_nacimiento",
	"conyuge_1_bautismo_fecha",
	"conyuge_2_bautismo_fecha"
];
function G(e, t) {
	return t == null || t === "" ? Sr : Cr.includes(e) && lt(String(t)) || String(t);
}
function wr(e, t, n, r) {
	n !== r && e.push({
		dato: t,
		servidor: n,
		local: r
	});
}
function Tr(e, t) {
	if (!t) return Sr;
	let n = e.prepare("SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?").get(t);
	return n ? [n.titulo, H(n.nombre, n.apellido_paterno, n.apellido_materno)].filter(Boolean).join(" ") : "(un celebrante que no está en esta PC)";
}
function Er(e, t) {
	let n = e.prepare("SELECT nombre, apellido_paterno, apellido_materno, username FROM usuarios WHERE id = ?").get(t);
	return n ? `${H(n.nombre, n.apellido_paterno, n.apellido_materno)} (${n.username})` : null;
}
function Dr(e, t, n) {
	let r = [];
	for (let e of [
		"libro",
		"folio",
		"numero",
		"fecha_emision",
		"fecha_evento"
	]) wr(r, pe("sacramento", e), G(e, t[e]), G(e, n[e]));
	wr(r, "Celebrante", Tr(e, t.ministro_client_id), Tr(e, n.ministro_client_id)), de(t.tipo).forEach((e, i) => {
		let a = t.personas[i] ?? {}, o = n.personas[i] ?? {};
		for (let t of ae) wr(r, pe(e, t.campo), G(t.campo, a[t.campo]), G(t.campo, o[t.campo]));
	});
	for (let e of le(t.tipo)) wr(r, e.label, G(e.campo, t.detalle[e.campo]), G(e.campo, n.detalle[e.campo]));
	return wr(r, "Nota marginal", G("anotaciones", t.anotaciones), G("anotaciones", n.anotaciones)), wr(r, "Estado", t.estado === "anulado" ? "Anulada" : "Vigente", n.estado === "anulado" ? "Anulada" : "Vigente"), wr(r, "Motivo de anulación", G("motivo", t.motivo_anulacion), G("motivo", n.motivo_anulacion)), r;
}
var Or = [
	{
		campo: "nombre",
		label: "Nombre"
	},
	{
		campo: "apellido_paterno",
		label: "Apellido paterno"
	},
	{
		campo: "apellido_materno",
		label: "Apellido materno"
	}
];
function kr(e, t, n) {
	let r = [];
	n === "ministro" && wr(r, "Título", G("titulo", e.titulo), G("titulo", t.titulo));
	for (let n of Or) wr(r, n.label, G(n.campo, e[n.campo]), G(n.campo, t[n.campo]));
	return wr(r, "Estado", e.activo === 1 ? "Habilitado" : "Deshabilitado", t.activo === 1 ? "Habilitado" : "Deshabilitado"), n === "usuario" && t.password_hash && r.push({
		dato: "Contraseña",
		servidor: "La de antes",
		local: "Cambiada en esta PC"
	}), r;
}
function Ar(e, t, n) {
	let r = new Set(n.historial.map((e) => e.client_id)), i = t.historial.filter((e) => !r.has(e.client_id)).sort((e, t) => e.fecha.localeCompare(t.fecha)), a = i[i.length - 1];
	return a ? {
		por: Er(e, a.usuario_id),
		en: a.fecha
	} : {
		por: null,
		en: t.updated_at ?? null
	};
}
function jr(e, t, n, r) {
	if (t === "ministro" || t === "usuario") return {
		diferencias: kr(r, t === "ministro" ? cr(e, n) : lr(e, n), t),
		cambiado_por: null,
		cambiado_en: r.updated_at ?? null,
		sacramento_id: null
	};
	let i = ur(e, n), a = Ar(e, r, i), o = e.prepare("SELECT id FROM sacramentos WHERE client_id = ?").pluck().get(n);
	return {
		diferencias: Dr(e, r, i),
		cambiado_por: a.por,
		cambiado_en: a.en,
		sacramento_id: o ?? null
	};
}
//#endregion
//#region electron/shared/index.ts
var Mr = "local:request", Nr = "sin-conexion";
//#endregion
//#region shared/parish_label.ts
function Pr(e) {
	return `CASE WHEN TRIM(IFNULL(${e}.ubicacion, '')) = '' THEN ${e}.nombre ELSE ${e}.nombre || ' (' || TRIM(${e}.ubicacion) || ')' END`;
}
//#endregion
//#region electron/main/models/user.ts
function Fr(e, t) {
	return e.prepare("SELECT parroquia_id, rol, principal, origen FROM membresias WHERE usuario_id = ? ORDER BY origen DESC, parroquia_id").all(t);
}
function Ir(e, t) {
	return e.prepare(`SELECT m.parroquia_id AS id, ${Pr("p")} AS nombre, m.rol
			 FROM membresias m
			 JOIN parroquias p ON p.id = m.parroquia_id
			 WHERE m.usuario_id = ?
			 ORDER BY m.origen DESC, p.nombre`).all(t);
}
function Lr(e, t, n, r) {
	return n === "admin_general" ? {
		id: t,
		rol: n,
		parroquia_id: null,
		principal: e.prepare("SELECT principal FROM usuarios WHERE id = ?").get(t)?.principal === 1
	} : {
		id: t,
		rol: n,
		parroquia_id: r,
		principal: Fr(e, t).find((e) => e.parroquia_id === r)?.principal === 1
	};
}
function Rr(e, t, n) {
	let r = e.prepare("SELECT id, client_id, rol, parroquia_id, principal, version, activo FROM usuarios WHERE id = ?").get(t);
	if (!r) return null;
	let i = {
		id: r.id,
		client_id: r.client_id,
		version: r.version,
		activo: r.activo
	};
	if (r.rol === "admin_general") return {
		...i,
		rol: r.rol,
		parroquia_id: null,
		principal: r.principal === 1
	};
	let a = Fr(e, t), o = a.find((e) => e.parroquia_id === n) ?? a.find((e) => e.origen === 1), s = a.filter((e) => e !== o);
	return {
		...i,
		rol: o?.rol ?? r.rol,
		parroquia_id: o?.parroquia_id ?? r.parroquia_id,
		principal: o?.principal === 1,
		otras_parroquias: s.length > 0,
		principal_en_otra: s.some((e) => e.principal === 1)
	};
}
//#endregion
//#region electron/main/models/session.ts
var K = null, zr = null;
function Br() {
	if (!K) throw new z("Sesión no válida.", 401);
	return K;
}
function Vr() {
	return K;
}
function Hr() {
	return zr;
}
function Ur(e, t, n) {
	K = e, zr = {
		username: t,
		password: n
	};
}
function Wr(e, t) {
	let n = Br();
	if (n.role === "admin_general") throw new z("El administrador general no trabaja en ninguna parroquia: solo consulta.", 400);
	let r = Fr(e, n.user_id).find((e) => e.parroquia_id === t);
	if (!r) throw new z("Esta cuenta no trabaja en esa parroquia: solo puede consultarla.", 403);
	return n.role = r.rol, n.parish_id = t, n;
}
function Gr(e) {
	if (!K || K.role === "admin_general") return;
	let t = Fr(e, K.user_id), n = t.find((e) => e.parroquia_id === K?.parish_id) ?? t.find((e) => e.origen === 1);
	n && (K.role = n.rol, K.parish_id = n.parroquia_id);
}
function Kr() {
	K = null, zr = null;
}
//#endregion
//#region electron/main/utils/logger.ts
function qr(...e) {
	console.log(...e);
}
function Jr(...e) {
	console.error(...e);
}
var Yr = "http://localhost:8787", Xr = null;
function Zr(e) {
	if (!u(e)) return null;
	try {
		let t = JSON.parse(f(e, "utf8"));
		if (typeof t.servidor == "string" && /^https?:\/\/\S+$/.test(t.servidor.trim())) return t.servidor.trim().replace(/\/+$/, "");
		Jr(`${e}: "servidor" debe ser una dirección que empiece con http:// o https://.`);
	} catch (t) {
		Jr(`No se pudo leer ${e}:`, t);
	}
	return null;
}
function Qr() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador") : s.join(n.getAppPath(), "resources", "instalador");
}
function $r() {
	if (Xr) return Xr;
	let e = process.env.PRELATURA_API_URL ?? Zr(s.join(n.getPath("userData"), "configuracion.json")) ?? Zr(s.join(Qr(), "configuracion.json")) ?? "https://registro-sacramental-pruebas.registro-sacramental-prelatura.workers.dev" ?? Yr;
	return qr(`Servidor: ${e}`), Xr = e, e;
}
//#endregion
//#region electron/main/sync/online.ts
var ei = "No se pudo conectar con el servidor. Verifique su conexión.", q = async (e, t = {}) => {
	let n = t.method ?? "GET", r = t.timeoutMs ?? 3e4, i = {};
	t.body !== void 0 && (i["Content-Type"] = "application/json"), t.token && (i.Authorization = `Bearer ${t.token}`);
	let a, o;
	try {
		a = await fetch(`${$r()}${e}`, {
			method: n,
			headers: i,
			body: t.body === void 0 ? void 0 : JSON.stringify(t.body),
			signal: AbortSignal.timeout(r)
		}), o = await a.json().catch(() => null);
	} catch {
		throw new z(ei, 0);
	}
	if (!a.ok) throw new z(o?.message ? String(o.message) : "Ocurrió un error inesperado.", a.status);
	if (o === null) throw new z(ei, 0);
	return o;
};
function ti(e) {
	return e instanceof z && (e.status === 0 || e.status >= 500);
}
function ni(e, t, n) {
	return e("/api/auth/login", {
		method: "POST",
		body: {
			username: t,
			password: n
		},
		timeoutMs: xe
	});
}
function ri(e, t, n = 0) {
	return e(n > 0 ? `/api/reference?historial_desde=${n}` : "/api/reference", { token: t });
}
function ii(e, t, n) {
	return e("/api/sync/push", {
		method: "POST",
		body: { cambios: n },
		token: t
	});
}
function ai(e, t, n) {
	return e(`/api/sync/pull?cursor=${encodeURIComponent(n)}`, { token: t });
}
function oi(e, t, n, r) {
	return e(`/api/sync/record?${`entidad=${encodeURIComponent(n)}&client_id=${encodeURIComponent(r)}`}`, { token: t });
}
function si(e, t, n) {
	return e(`/api/devices/${n}/key`, { token: t });
}
function ci(e, t, n, r) {
	return e(`/api/devices/${n}/key`, {
		method: "PUT",
		body: { clave: r },
		token: t
	});
}
//#endregion
//#region electron/main/sync/sync.ts
function li(e, t) {
	let n = e.prepare("INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)\n		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa"), r = e.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?"), i = e.prepare("INSERT INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)\n		 SELECT @usuario_id, @parroquia_id, @rol, @principal\n		 WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = @usuario_id)\n			AND EXISTS (SELECT 1 FROM parroquias WHERE id = @parroquia_id)");
	e.transaction(() => {
		for (let e of t.parroquias) n.run(e);
		for (let n of t.ministros) r.run(n.client_id, `servidor-${n.id}`), xr(e, n);
		for (let n of t.usuarios) vr(e, n);
		e.prepare("DELETE FROM usuario_parroquias").run();
		for (let e of t.usuario_parroquias ?? []) i.run(e);
		e.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)"), rr(e, t.historial_ministros_cuentas ?? []), t.historial_cursor !== void 0 && ht(e, R.staff_history_cursor, String(t.historial_cursor));
	})();
}
async function ui(e, t, n) {
	li(e, await ri(t, n, Number(mt(e, R.staff_history_cursor) ?? 0))), Gr(e);
}
function di(e, t) {
	return t.entidad === "ministro" ? cr(e, t.client_id) : t.entidad === "usuario" ? lr(e, t.client_id) : ur(e, t.client_id);
}
function fi(e, t, n) {
	if (!n) return;
	let r = yr(e, t, n), i = Vr();
	r !== null && i && i.user_id === r && (i.user_id = n);
}
function pi(e, t, n) {
	e.transaction(() => {
		if (n.estado === "conflicto" || n.estado === "rechazado") {
			e.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(n.estado, n.motivo, t.id);
			return;
		}
		t.entidad === "usuario" && fi(e, t.client_id, n.id), e.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(t.id).revision === t.revision ? (pt(e, t.entidad, t.client_id), sr(e, t.entidad, t.client_id, n.version), t.entidad === "usuario" && e.prepare("UPDATE usuarios SET password_hash_pendiente = NULL WHERE client_id = ?").run(t.client_id)) : e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?").run(n.version, t.id);
	})();
}
var mi = ["El administrador general solo consulta", "No tiene permiso para modificar"];
function hi(e, t) {
	if (t.entidad === "usuario") {
		let n = e.prepare("SELECT username FROM usuarios WHERE client_id = ?").pluck().get(t.client_id);
		return n === void 0 || !_r(n);
	}
	let n = Vr();
	if (!n) return !0;
	if (n.role === "admin_general") return !1;
	let r = t.entidad === "ministro" ? "ministros" : "sacramentos", i = e.prepare(`SELECT parroquia_id FROM ${r} WHERE client_id = ?`).pluck().get(t.client_id);
	return i === void 0 || e.prepare("SELECT 1 FROM membresias WHERE usuario_id = ? AND parroquia_id = ?").get(n.user_id, i) !== void 0;
}
function gi(e, t) {
	return t.entidad === "usuario" || t.entidad === "ministro" ? !1 : e.prepare("SELECT 1 FROM sacramentos s\n			 WHERE s.client_id = ?\n			   AND (s.anulado_por_usuario_id < 0\n				OR EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = s.id AND h.usuario_id < 0)\n				OR EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND (c.usuario_id < 0 OR c.revisado_por_usuario_id < 0))\n				OR EXISTS (SELECT 1 FROM solicitudes_cambio r WHERE r.sacramento_id = s.id AND (r.usuario_id < 0 OR r.revisado_por_usuario_id < 0)))").get(t.client_id) !== void 0;
}
function _i(e, t) {
	let n = e.prepare("SELECT estado, motivo FROM sync_cola WHERE id = ?").get(t);
	n.estado === "rechazado" && mi.some((e) => n.motivo?.startsWith(e)) && e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ?").run(t);
}
async function vi(e, t, n) {
	let r = e.prepare("SELECT id, entidad, client_id FROM sync_cola WHERE estado <> 'conflicto' AND (entidad = 'usuario') = ? ORDER BY entidad = 'ministro' DESC, id");
	for (let i of [1, 0]) {
		let a = [];
		for (let t of r.all(i)) gi(e, t) ? e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ? AND estado = 'rechazado'").run(t.id) : hi(e, t) ? a.push(t.id) : _i(e, t.id);
		await yi(e, t, n, a);
	}
}
async function yi(e, t, n, r) {
	let i = e.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let a = 0; a < r.length; a += 15) {
		let o = [];
		for (let e of r.slice(a, a + 15)) {
			let t = i.get(e);
			t && t.estado !== "conflicto" && o.push(t);
		}
		if (o.length === 0) continue;
		let s = await ii(t, n, o.map((t) => ({
			entidad: t.entidad,
			client_id: t.client_id,
			version_base: t.version_base,
			cola_id: t.cola_id,
			datos: di(e, t)
		})));
		for (let t = 0; t < o.length; t++) s.resultados[t] && pi(e, o[t], s.resultados[t]);
	}
}
function bi(e, t) {
	e.transaction(() => {
		for (let n of t.partidas) pr(e, n);
		ht(e, R.cursor, String(t.cursor));
	})();
}
function xi(e) {
	return e instanceof ir || e?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
async function Si(e, t, n) {
	for (;;) {
		let r = await ai(t, n, mt(e, R.cursor) ?? "0");
		try {
			bi(e, r);
		} catch (i) {
			if (!xi(i)) throw i;
			await ui(e, t, n), bi(e, r);
		}
		if (!r.hayMas) return;
	}
}
async function Ci(e, t, n) {
	await ui(e, t, n), await vi(e, t, n), await Si(e, t, n), ht(e, R.last_sync, (/* @__PURE__ */ new Date()).toISOString());
}
async function wi(e, t, n, r, i, a) {
	let o = (await oi(t, n, r, i)).registro;
	e.transaction(() => {
		a === "local" ? e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?").run(o.version, r, i) : r === "ministro" ? xr(e, o, !0) : r === "usuario" ? vr(e, o, !0) : pr(e, o, !0);
	})();
}
var Ti = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function Ei(e, t) {
	if (t.entidad === "ministro") {
		let n = e.prepare("SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?").get(t.client_id);
		return `Ministro ${n?.nombre ?? ""} ${n?.apellido_paterno ?? ""}`.trim();
	}
	if (t.entidad === "usuario") {
		let n = e.prepare("SELECT username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE client_id = ?").get(t.client_id);
		if (!n) return "Usuario";
		let r = [
			n.nombre,
			n.apellido_paterno,
			n.apellido_materno
		].filter(Boolean).join(" ");
		return _r(n.username) ? `Cuenta de ${r} (necesita otro nombre de usuario)` : `Usuario ${n.username} (${r})`;
	}
	let n = Ti[t.entidad], r = e.prepare("SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?").get(t.client_id);
	return r ? `${n}: libro ${r.libro}, folio ${r.folio}, registro ${r.numero}` : n;
}
function Di(e) {
	let t = e.prepare("SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado").all(), n = (e) => {
		let n = t.find((t) => t.estado === e);
		return n ? n.total : 0;
	}, r = e.prepare("SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id").all().map((t) => ({
		entidad: t.entidad,
		client_id: t.client_id,
		estado: t.estado,
		motivo: t.motivo,
		descripcion: Ei(e, t)
	}));
	return {
		pendientes: n("pendiente"),
		conflictos: n("conflicto"),
		rechazados: n("rechazado"),
		ultima_sync: mt(e, R.last_sync),
		aviso: mt(e, R.notice),
		items: r
	};
}
//#endregion
//#region electron/main/sync/recovery.ts
var Oi = "La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.";
async function ki(e, t, n) {
	try {
		return (await si(t, n, An(e))).clave;
	} catch (e) {
		if (e instanceof z && e.status === 404) return null;
		throw e;
	}
}
async function Ai(e, t, n, r) {
	let i = Ln(e, t);
	try {
		await ui(i.db, n, r), await Si(i.db, n, r), ht(i.db, R.last_sync, (/* @__PURE__ */ new Date()).toISOString()), ht(i.db, R.notice, Oi), ht(i.db, R.key_registered, null);
	} finally {
		i.db.close();
	}
	return {
		db: zn(e, t, i.key),
		key: i.key
	};
}
async function ji(e, t, n, r) {
	if (u(e.database)) {
		let i = await ki(e, n, r);
		if (i) {
			let n = In(e, t, i);
			if (n) return {
				db: n,
				key: i
			};
		}
	}
	return Ai(e, t, n, r);
}
async function Mi(e, t, n, r, i, a) {
	let o = mt(e, R.key_registered);
	if (o && (o !== "admin" || a === null)) return;
	let s = await ci(r, i, An(t), n);
	ht(e, R.key_registered, s.parroquiaId === null ? "admin" : "parroquia");
}
//#endregion
//#region electron/main/sync/auto_sync.ts
var Ni = "sin-conexion", Pi = null, Fi = null, Ii = null;
function Li(e) {
	Ii ||= setInterval(() => void J(), Se), Ni = e;
}
function Ri() {
	Ii && clearInterval(Ii), Ii = null;
}
function zi() {
	Ni = "sin-conexion", Pi = null;
}
var Bi = "Esta cuenta todavía no está en el servidor. Se subirá la próxima vez que el administrador de la parroquia sincronice con internet; hasta entonces puede trabajar sin conexión.";
function Vi(e) {
	if (e < 0) return !0;
	try {
		return !!W().prepare("SELECT password_hash_pendiente FROM usuarios WHERE id = ?").get(e)?.password_hash_pendiente;
	} catch {
		return !1;
	}
}
async function Hi() {
	let e = Vr(), t = Hr();
	if (!e || !t) return null;
	try {
		let n = await ni(q, t.username, t.password);
		return e.token = n.token, n.token;
	} catch (t) {
		return e.token = "", ti(t) ? (Ni = "sin-conexion", null) : Vi(e.user_id) ? (Ni = "error", Pi = Bi, null) : (Ni = "requiere-login", Pi = "La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.", null);
	}
}
async function Ui(e) {
	let t = Vr()?.token || await Hi();
	if (t) try {
		await e(t);
	} catch (t) {
		if (!(t instanceof z && t.status === 401)) throw t;
		let n = await Hi();
		n && await e(n);
	}
}
async function Wi() {
	Pi = null;
	try {
		let e = !1;
		await Ui(async (t) => {
			let n = W();
			await Ci(n, q, t), e = !0;
			let r = Xn();
			r && await Mi(n, Jn(), r, q, t, Vr()?.parish_id ?? null).catch((e) => {
				Jr("No se pudo subir la copia de la clave:", e);
			});
		}), e && (Ni = "en-linea");
	} catch (e) {
		if (ti(e)) {
			Ni = "sin-conexion";
			return;
		}
		Jr("Falló la sincronización:", e), Ni = "error", Pi = e instanceof z ? e.message : "Ocurrió un error al sincronizar.";
	}
}
function J() {
	return Vr() ? (Fi ||= Wi().finally(() => {
		Fi = null;
	}), Fi) : Promise.resolve();
}
function Gi() {
	return Fi ?? Promise.resolve();
}
function Ki() {
	return Br(), {
		...Di(W()),
		modo: Ni,
		en_curso: Fi !== null,
		mensaje: Pi,
		token: Vr()?.token || "sin-conexion"
	};
}
var qi = "Solo un administrador de la parroquia resuelve los conflictos. Pídale que entre en esta PC.";
function Ji() {
	let e = Br();
	if (e.role !== "admin_parroquia" && e.role !== "admin_general") throw new z(qi, 403);
}
async function Yi(e, t) {
	Ji();
	let n = null;
	if (await Ui(async (r) => {
		let i = await oi(q, r, e, t);
		n = jr(W(), e, t, i.registro);
	}), !n) throw new z("Se necesita conexión para ver las diferencias.", 0);
	return n;
}
async function Xi(e, t, n) {
	Ji();
	let r = !1;
	if (await Ui(async (i) => {
		await wi(W(), q, i, e, t, n), r = !0;
	}), !r) throw new z("Se necesita conexión para resolver el conflicto.", 0);
	await J();
}
function Zi() {
	Br(), ht(W(), R.notice, null);
}
async function Qi(e) {
	if (!Vr() || Di(W()).pendientes === 0) return;
	let t = new Promise((t) => setTimeout(t, e));
	await Promise.race([J(), t]);
}
//#endregion
//#region electron/main/utils/xlsx.ts
var $i = 22;
function ea(e) {
	return e.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ta(e) {
	let t = "", n = e + 1;
	for (; n > 0;) {
		let e = (n - 1) % 26;
		t = String.fromCharCode(65 + e) + t, n = Math.floor((n - 1) / 26);
	}
	return t;
}
function na(e, t, n) {
	if (e == null || e === "") return "";
	let r = n ? " s=\"1\"" : "";
	return typeof e == "number" ? `<c r="${t}"${r}><v>${e}</v></c>` : `<c r="${t}" t="inlineStr"${r}><is><t xml:space="preserve">${ea(e)}</t></is></c>`;
}
function ra(e) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${`<cols><col min="1" max="${Math.max(1, ...e.rows.map((e) => e.length))}" width="${$i}" customWidth="1"/></cols>`}<sheetData>${e.rows.map((e, t) => {
		let n = e.map((e, n) => na(e, `${ta(n)}${t + 1}`, t === 0)).join("");
		return `<row r="${t + 1}">${n}</row>`;
	}).join("")}</sheetData></worksheet>`;
}
function ia(e) {
	let t = {}, n = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>";
	return t["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${e.map((e, t) => `<Override PartName="/xl/worksheets/sheet${t + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`, t["_rels/.rels"] = n + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" + "</Relationships>", t["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${e.map((e, t) => `<sheet name="${ea(e.name.slice(0, 31))}" sheetId="${t + 1}" r:id="rId${t + 1}"/>`).join("")}</sheets></workbook>`, t["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${e.map((e, t) => `<Relationship Id="rId${t + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${t + 1}.xml"/>`).join("")}${`<Relationship Id="rId${e.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`}</Relationships>`, t["xl/styles.xml"] = n + "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" + "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>" + "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills>" + "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" + "<cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs>" + "</styleSheet>", e.forEach((e, n) => {
		t[`xl/worksheets/sheet${n + 1}.xml`] = ra(e);
	}), t;
}
var aa = Array.from({ length: 256 }, (e, t) => {
	let n = t;
	for (let e = 0; e < 8; e++) n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
	return n >>> 0;
});
function oa(e) {
	let t = 4294967295;
	for (let n of e) t = aa[(t ^ n) & 255] ^ t >>> 8;
	return (t ^ 4294967295) >>> 0;
}
function sa(e) {
	let t = [], n = [], r = 0;
	for (let [i, a] of Object.entries(e)) {
		let e = Buffer.from(i, "utf8"), o = Buffer.from(a, "utf8"), s = v(o), c = oa(o), l = Buffer.alloc(30);
		l.writeUInt32LE(67324752, 0), l.writeUInt16LE(20, 4), l.writeUInt16LE(2048, 6), l.writeUInt16LE(8, 8), l.writeUInt32LE(0, 10), l.writeUInt32LE(c, 14), l.writeUInt32LE(s.length, 18), l.writeUInt32LE(o.length, 22), l.writeUInt16LE(e.length, 26), l.writeUInt16LE(0, 28);
		let u = Buffer.alloc(46);
		u.writeUInt32LE(33639248, 0), u.writeUInt16LE(20, 4), u.writeUInt16LE(20, 6), u.writeUInt16LE(2048, 8), u.writeUInt16LE(8, 10), u.writeUInt32LE(0, 12), u.writeUInt32LE(c, 16), u.writeUInt32LE(s.length, 20), u.writeUInt32LE(o.length, 24), u.writeUInt16LE(e.length, 28), u.writeUInt32LE(r, 42), t.push(l, e, s), n.push(u, e), r += l.length + e.length + s.length;
	}
	let i = n.reduce((e, t) => e + t.length, 0), a = Object.keys(e).length, o = Buffer.alloc(22);
	return o.writeUInt32LE(101010256, 0), o.writeUInt16LE(a, 8), o.writeUInt16LE(a, 10), o.writeUInt32LE(i, 12), o.writeUInt32LE(r, 16), Buffer.concat([
		...t,
		...n,
		o
	]);
}
function ca(e) {
	return sa(ia(e));
}
//#endregion
//#region shared/sync.ts
var la = [
	"admin_general",
	"admin_parroquia",
	"usuario"
], ua = {
	ministro: {
		creado: "Registró al ministro",
		editado: "Editó al ministro",
		deshabilitado: "Deshabilitó al ministro",
		habilitado: "Habilitó al ministro"
	},
	usuario: {
		creado: "Creó la cuenta",
		editado: "Editó la cuenta",
		contrasena: "Cambió la contraseña",
		deshabilitado: "Deshabilitó la cuenta",
		habilitado: "Habilitó la cuenta",
		principal: "Pasó la marca de principal",
		parroquia_agregada: "Agregó la cuenta a la parroquia",
		parroquia_quitada: "Quitó la cuenta de la parroquia"
	}
}, da = {
	registrada: "Registró la partida",
	importada: "Importó la partida",
	editada: "Editó la partida",
	correccion: "Corrigió por nota marginal",
	cambio_pedido: "Pidió un cambio",
	cambio_aprobado: "Aprobó el cambio",
	cambio_rechazado: "Rechazó el cambio",
	cambio_descartado: "Descartó el cambio",
	anulada: "Anuló la partida",
	rehabilitada: "Rehabilitó la partida"
}, fa = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function pa(e) {
	return e ? new Date(e).toLocaleDateString("es-PE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}) : "";
}
function ma(e) {
	return new Date(e).toLocaleString("es-PE", {
		dateStyle: "short",
		timeStyle: "short"
	});
}
function ha(e) {
	return e ? [
		e.titulo,
		e.nombre,
		e.apellido_paterno,
		e.apellido_materno
	].filter(Boolean).join(" ") : "";
}
function ga(e) {
	return H(e.nombres, e.apellido_paterno, e.apellido_materno);
}
function _a(e) {
	return lt(e.fecha_nacimiento) || (e.fecha_aproximada ?? "");
}
function va(e) {
	return [
		e.dni,
		e.nombres,
		e.apellido_paterno,
		e.apellido_materno,
		_a(e),
		e.lugar_nacimiento,
		e.padre,
		e.madre
	];
}
function ya(e) {
	return [
		"DNI",
		"Nombres",
		"Apellido paterno",
		"Apellido materno",
		"Fecha de nacimiento",
		"Lugar de nacimiento",
		"Padre",
		"Madre"
	].map((t) => `${t}${e}`);
}
var ba = [
	"Libro",
	"Folio",
	"Número"
], xa = [
	"Celebrante",
	"Anotación marginal",
	"Estado",
	"Fecha de registro"
];
function Sa(e) {
	let t = e.sacramento;
	return [
		t.libro,
		t.folio,
		t.numero
	];
}
function Ca(e) {
	let t = e.sacramento;
	return [
		ha(t.ministro),
		t.anotaciones,
		t.estado === "anulado" ? "Anulada" : "Vigente",
		pa(t.created_at)
	];
}
function wa(e, t) {
	let n = `Fecha de ${fa[e].toLowerCase()}`, r = [
		...ba,
		...ya(""),
		n,
		"Padrino",
		"Madrina",
		...xa
	], i = t.map((e) => [
		...Sa(e),
		...va(e.persona),
		lt(e.sacramento.fecha_evento),
		e.padrino_1,
		e.padrino_2,
		...Ca(e)
	]);
	return {
		name: e === "bautismo" ? "Bautismos" : "Confirmaciones",
		rows: [r, ...i]
	};
}
function Ta(e) {
	return {
		name: "Matrimonios",
		rows: [[
			...ba,
			...ya(" del esposo"),
			"Parroquia de bautismo del esposo",
			"Fecha de bautismo del esposo",
			...ya(" de la esposa"),
			"Parroquia de bautismo de la esposa",
			"Fecha de bautismo de la esposa",
			"Fecha de matrimonio",
			"Lugar del matrimonio",
			"Testigo 1",
			"Testigo 2",
			"Testigo 3",
			"Testigo 4",
			...xa
		], ...e.map((e) => [
			...Sa(e),
			...va(e.conyuge_1),
			e.conyuge_1_bautismo_parroquia,
			lt(e.conyuge_1_bautismo_fecha),
			...va(e.conyuge_2),
			e.conyuge_2_bautismo_parroquia,
			lt(e.conyuge_2_bautismo_fecha),
			lt(e.sacramento.fecha_evento),
			e.lugar,
			e.testigo_1,
			e.testigo_2,
			e.testigo_3,
			e.testigo_4,
			...Ca(e)
		])]
	};
}
function Ea(e) {
	if (e.sacramento.tipo === "matrimonio") {
		let t = e;
		return `${ga(t.conyuge_1)} y ${ga(t.conyuge_2)}`;
	}
	return ga(e.persona);
}
function Da(e, t) {
	let n = [
		"Fecha",
		"Sacramento",
		"Libro",
		"Folio",
		"Número",
		"Partida de",
		"Qué se hizo",
		"Usuario",
		"Motivo",
		"Datos cambiados"
	], r = [];
	for (let n of t) for (let t of Ve(e, n.sacramento.id)) {
		let e = t.campos.map((e) => `${pe(e.parte, e.campo)}: ${e.texto_anterior ?? "(vacío)"} → ${e.texto_nuevo ?? "(vacío)"}`);
		r.push({
			fecha: t.fecha,
			cells: [
				ma(t.fecha),
				fa[n.sacramento.tipo],
				...Sa(n),
				Ea(n),
				da[t.evento],
				t.usuario,
				t.motivo,
				e.join("\n")
			]
		});
	}
	return r.sort((e, t) => t.fecha.localeCompare(e.fecha)), {
		name: "Historial",
		rows: [n, ...r.map((e) => e.cells)]
	};
}
function Oa(e, t, n) {
	return e.prepare("SELECT id FROM sacramentos\n			 WHERE parroquia_id = ? AND tipo = ?\n			 ORDER BY CAST(libro AS INTEGER), libro, CAST(folio AS INTEGER), folio, CAST(numero AS INTEGER), numero").pluck().all(t, n).map((t) => Pt(e, t));
}
function ka(e, t) {
	let n = Oa(e, t, "bautismo"), r = Oa(e, t, "confirmacion"), i = Oa(e, t, "matrimonio");
	return [
		wa("bautismo", n),
		wa("confirmacion", r),
		Ta(i),
		Da(e, [
			...n,
			...r,
			...i
		])
	];
}
//#endregion
//#region electron/main/controllers/login.ts
async function Aa(e, t, n) {
	let r = await pn(n);
	e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, r);
}
async function ja(e, t, n) {
	let r = e.prepare(`SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,
				c.verificador, ${Pr("p")} AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 WHERE u.username = ?`).get(t);
	return !r || !r.verificador ? {
		ok: !1,
		reason: "sin-credencial"
	} : r.activo !== 1 || !await yn(n, r.verificador) ? {
		ok: !1,
		reason: "incorrecta"
	} : {
		ok: !0,
		usuario: {
			id: r.id,
			rol: r.rol,
			parroquia_id: r.parroquia_id,
			parroquia_nombre: r.parroquia_nombre,
			nombre_completo: H(r.nombre, r.apellido_paterno, r.apellido_materno),
			parroquias: Ir(e, r.id)
		}
	};
}
async function Ma(e, t, n) {
	let r = e.token, i = e.usuario;
	if (Zn()) {
		let e = await ji(Jn(), qn, q, r);
		Qn(e.db, e.key);
	}
	let a = W();
	try {
		await ui(a, q, r);
	} catch (e) {
		if (!a.prepare("SELECT 1 FROM usuarios WHERE id = ?").get(i.id)) throw e;
	}
	return await Aa(a, i.id, n), Ur({
		user_id: i.id,
		role: i.rol,
		parish_id: i.parroquia_id,
		token: r
	}, t, n), Li("en-linea"), await J(), {
		...e,
		usuario: {
			...i,
			parroquias: Ir(a, i.id)
		}
	};
}
function Na(e, t, n) {
	return Ur({
		user_id: e.id,
		role: e.rol,
		parish_id: e.parroquia_id,
		token: ""
	}, t, n), Li("sin-conexion"), J(), {
		token: Nr,
		usuario: e
	};
}
var Pa = "Este usuario todavía no está en esta PC. Conéctese a internet para entrar por primera vez, o restaure un respaldo.";
async function Fa(e) {
	let t = typeof e?.username == "string" ? e.username.trim() : "", n = typeof e?.password == "string" ? e.password : "", r = {
		ok: !1,
		reason: "sin-credencial"
	};
	if (!Zn() && (r = await ja(W(), t, n), r.ok)) return Na(r.usuario, t, n);
	let i;
	try {
		i = await ni(q, t, n);
	} catch (e) {
		throw ti(e) ? Zn() ? new z("La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.", 503) : r.reason === "sin-credencial" ? new z(Pa, 401) : new z("Usuario o contraseña incorrectos.", 401) : e;
	}
	return Ma(i, t, n);
}
function Ia() {
	Ri(), Kr(), zi();
}
function La(e, t) {
	if (!Number.isInteger(t)) throw new z("Parroquia no válida.", 400);
	let n = Wr(e, t);
	return {
		rol: n.role,
		parroquia_id: n.parish_id
	};
}
var Ra = { "auth.selectParish": (e, { db: t }) => La(t, e?.parroquia_id) }, za = {
	"auth.login": Fa,
	"auth.logout": () => (Ia(), { success: !0 })
}, Ba = "prelatura-paquete-inicial", Va = "paquete-inicial.json";
function Ha(e) {
	return e.prepare("SELECT COUNT(*) FROM usuarios").pluck().get() === 0;
}
function Ua(e, t) {
	if (t.role !== "admin_general") throw new z("Solo el administrador general puede generar el paquete inicial.", 403);
	if (e.prepare("SELECT COUNT(*) FROM sync_cola").pluck().get() > 0) throw new z("Hay cambios sin subir. Sincronice con internet antes de generar el paquete inicial.", 409);
	let n = e.prepare("SELECT u.id, u.client_id, u.parroquia_id, u.username, u.rol, u.nombre, u.apellido_paterno, u.apellido_materno,\n				u.activo, u.principal, u.version, u.updated_at, c.verificador AS password_hash\n			 FROM usuarios u\n			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id\n			 WHERE u.id > 0\n			 ORDER BY u.id").all(), r = e.prepare("SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at FROM ministros ORDER BY id").all(), i = e.prepare("SELECT client_id, version, created_at, updated_at FROM sacramentos ORDER BY id").all();
	return {
		formato: Ba,
		version: 1,
		generado_en: (/* @__PURE__ */ new Date()).toISOString(),
		cursor: mt(e, R.cursor),
		parroquias: e.prepare("SELECT id, nombre, ubicacion, activa FROM parroquias ORDER BY id").all(),
		usuarios: n,
		usuario_parroquias: e.prepare("SELECT usuario_id, parroquia_id, rol, principal FROM usuario_parroquias WHERE usuario_id > 0 ORDER BY usuario_id, parroquia_id").all(),
		ministros: r,
		partidas: i.map((t) => ({
			...ur(e, t.client_id),
			version: t.version,
			created_at: t.created_at,
			updated_at: t.updated_at
		}))
	};
}
function Wa(e) {
	let t = e;
	if (!t || t.formato !== "prelatura-paquete-inicial") throw new z("El archivo no es un paquete inicial de esta aplicación.", 400);
	if (t.version !== 1) throw new z("El paquete inicial es de otra versión de la aplicación.", 400);
	if (!Array.isArray(t.parroquias) || !Array.isArray(t.usuarios) || !Array.isArray(t.ministros) || !Array.isArray(t.partidas)) throw new z("El paquete inicial está incompleto.", 400);
	return t;
}
function Ga(e, t) {
	let n = Wa(t);
	if (!Ha(e)) throw new z("Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.", 409);
	return e.transaction(() => {
		li(e, {
			parroquias: n.parroquias,
			ministros: n.ministros,
			usuarios: n.usuarios,
			usuario_parroquias: n.usuario_parroquias
		});
		for (let t of n.partidas) pr(e, t);
		n.cursor && ht(e, R.cursor, n.cursor);
	})(), {
		parroquias: n.parroquias.length,
		usuarios: n.usuarios.length,
		partidas: n.partidas.length
	};
}
function Ka(e) {
	try {
		return JSON.parse(f(e, "utf8"));
	} catch {
		throw new z("No se pudo leer el paquete inicial.", 400);
	}
}
function qa() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador", Va) : s.join(n.getAppPath(), "resources", "instalador", Va);
}
function Ja() {
	if (process.env.PRELATURA_SIN_PAQUETE === "1") return;
	let e = process.env.PRELATURA_PAQUETE || qa(), t;
	try {
		t = W();
	} catch {
		return;
	}
	if (u(e) && Ha(t)) try {
		let n = Ga(t, Ka(e));
		qr(`Paquete inicial cargado: ${n.parroquias} parroquias, ${n.usuarios} usuarios y ${n.partidas} partidas.`);
	} catch (e) {
		Jr("No se pudo cargar el paquete inicial del instalador:", e);
	}
}
function Ya() {
	return t.getFocusedWindow() ?? void 0;
}
var Xa = { "package.status": () => {
	try {
		return { necesita_paquete: Ha(W()) };
	} catch {
		return { necesita_paquete: !1 };
	}
} }, Za = { "package.export": async (e, { db: t, session: n }) => {
	let i = Ua(t, n), a = {
		title: "Guardar el paquete inicial",
		defaultPath: Va,
		filters: [{
			name: "Paquete inicial",
			extensions: ["json"]
		}]
	}, o = Ya(), s = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
	return s.canceled || !s.filePath ? { cancelado: !0 } : (_(s.filePath, JSON.stringify(i), "utf8"), {
		cancelado: !1,
		parroquias: i.parroquias.length,
		usuarios: i.usuarios.length,
		partidas: i.partidas.length
	});
} }, Qa = "prelatura-respaldo", $a = "respaldo", eo = /^parroquia-\d+\.txt$/, to = "La contraseña no es la del respaldo, o el archivo está dañado.", no = "El archivo no es un respaldo de esta aplicación.", ro = 200;
function io(e) {
	return e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all();
}
function ao(e) {
	return s.join(e, we.logos_folder);
}
function oo(e, t) {
	let n = {};
	for (let t of io(e)) {
		let r = e.prepare(`SELECT * FROM "${t}"`).raw();
		n[t] = {
			columnas: r.columns().map((e) => e.name),
			filas: r.all()
		};
	}
	let r = {}, i = ao(t);
	if (u(i)) for (let e of p(i).filter((e) => eo.test(e))) r[e] = f(s.join(i, e), "utf8");
	return {
		version_base: e.pragma("user_version", { simple: !0 }),
		tablas: n,
		logos: r
	};
}
async function so(e, t) {
	let n = await xn(t, b(JSON.stringify(e)));
	return JSON.stringify({
		formato: Qa,
		version: 1,
		creado_en: (/* @__PURE__ */ new Date()).toISOString(),
		...n
	});
}
async function co(e, t) {
	let n;
	try {
		n = JSON.parse(e);
	} catch {
		throw new z(no, 400);
	}
	if (n?.formato !== "prelatura-respaldo" || !n.sal || !n.iv || !n.etiqueta || !n.datos) throw new z(no, 400);
	if (n.version !== 1) throw new z("El respaldo es de otra versión de la aplicación.", 400);
	let r = await Sn(t, n);
	if (!r) throw new z(to, 400);
	let i = JSON.parse(y(r).toString("utf8"));
	if (!Number.isInteger(i?.version_base) || i.version_base < 1 || typeof i.tablas != "object" || typeof i.logos != "object") throw new z(no, 400);
	return i;
}
function lo(e, t) {
	let n = io(e);
	for (let e of Object.keys(t.tablas)) if (!n.includes(e)) throw new z(no, 400);
	let r = e.transaction(() => {
		for (let t of n) e.prepare(`DELETE FROM "${t}"`).run();
		for (let [n, r] of Object.entries(t.tablas)) {
			let t = e.pragma(`table_info("${n}")`).map((e) => e.name);
			if (!r.columnas.every((e) => t.includes(e))) throw new z(no, 400);
			let i = r.columnas.map((e) => `"${e}"`).join(", "), a = r.columnas.map(() => "?").join(", "), o = e.prepare(`INSERT INTO "${n}" (${i}) VALUES (${a})`);
			for (let e of r.filas) o.run(e);
		}
		if (e.prepare("DELETE FROM sync_estado WHERE clave = ?").run(R.key_registered), e.pragma("foreign_key_check").length > 0) throw new z("El respaldo está incompleto: hay datos que apuntan a registros que no están.", 400);
	});
	e.pragma("foreign_keys = OFF");
	try {
		r();
	} finally {
		e.pragma("foreign_keys = ON");
	}
}
function uo(e, t, n) {
	if (n.version_base > Cn.length) throw new z("El respaldo es de una versión más nueva de la aplicación. Actualícela antes de restaurarlo.", 400);
	let r = Rn(e, t, Cn.slice(0, n.version_base));
	try {
		lo(r.db, n);
	} finally {
		r.db.close();
	}
	return Dn(e.temp_database, r.key).close(), r.key;
}
function fo(e, t) {
	let n = ao(e);
	d(n, { recursive: !0 });
	for (let e of p(n).filter((e) => eo.test(e))) h(s.join(n, e), { force: !0 });
	for (let [e, r] of Object.entries(t)) eo.test(e) && typeof r == "string" && _(s.join(n, e), r, "utf8");
}
async function po(e) {
	let t = Jn(), n = uo(t, qn, e);
	Ia(), await Gi(), $n(), Qn(zn(t, qn, n), n), fo(t.directory, e.logos);
}
function mo(e) {
	return s.join(e, we.backup_log);
}
function ho(e) {
	try {
		let t = JSON.parse(f(mo(e), "utf8"));
		return Array.isArray(t) ? t : [];
	} catch {
		return [];
	}
}
function go(e, t) {
	let n = [t, ...ho(e)].slice(0, ro);
	_(mo(e), JSON.stringify(n, null, 2), "utf8");
}
function _o(e, t) {
	let n = e.prepare("SELECT username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE id = ?").get(t.user_id);
	if (!n) return "Usuario desconocido";
	let r = H(n.nombre, n.apellido_paterno, n.apellido_materno);
	return r ? `${r} (${n.username})` : n.username;
}
function vo(e) {
	if (e.role !== "admin_parroquia") throw new z("Solo el administrador de una parroquia puede hacer o restaurar respaldos.", 403);
}
async function yo(e, t) {
	let n = t.parish_id, i = {
		title: "Guardar el Excel",
		defaultPath: `partidas-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx`,
		filters: [{
			name: "Excel",
			extensions: ["xlsx"]
		}]
	}, a = Ya(), o = a ? await r.showSaveDialog(a, i) : await r.showSaveDialog(i);
	if (o.canceled || !o.filePath) return { cancelado: !0 };
	try {
		_(o.filePath, ca(ka(e, n)));
	} catch {
		throw new z(`No se pudo guardar el Excel: puede que "${s.basename(o.filePath)}" esté abierto. Ciérrelo y vuelva a exportar.`, 409);
	}
	return go(Jn().directory, {
		fecha: (/* @__PURE__ */ new Date()).toISOString(),
		usuario: _o(e, t),
		accion: "exporto_excel",
		archivo: s.basename(o.filePath)
	}), {
		cancelado: !1,
		partidas: e.prepare("SELECT COUNT(*) FROM sacramentos WHERE parroquia_id = ?").pluck().get(n),
		archivo: s.basename(o.filePath)
	};
}
function bo(e, t) {
	let n = typeof e == "string" ? e : "";
	if (t && n.length < 8) throw new z("La contraseña del respaldo debe tener al menos 8 caracteres.", 400);
	if (!n) throw new z("Escriba la contraseña del respaldo.", 400);
	return n;
}
function xo(e, t) {
	return e.tablas[t]?.filas.length ?? 0;
}
function So(e) {
	return {
		cancelado: !1,
		partidas: xo(e, "sacramentos"),
		pendientes: xo(e, "sync_cola")
	};
}
async function Co(e, t) {
	let n = bo(e, !1), i = {
		title: "Elegir el respaldo",
		properties: ["openFile"],
		filters: [{
			name: "Respaldo",
			extensions: [$a]
		}]
	}, a = Ya(), o = a ? await r.showOpenDialog(a, i) : await r.showOpenDialog(i);
	if (o.canceled || o.filePaths.length === 0) return { cancelado: !0 };
	let c;
	try {
		c = f(o.filePaths[0], "utf8");
	} catch {
		throw new z("No se pudo leer el respaldo.", 400);
	}
	let l = await co(c, n);
	return await po(l), go(Jn().directory, {
		fecha: (/* @__PURE__ */ new Date()).toISOString(),
		usuario: t,
		accion: "restauro",
		archivo: s.basename(o.filePaths[0])
	}), So(l);
}
function wo() {
	try {
		return Ha(W());
	} catch {
		return !1;
	}
}
var To = {
	"backup.export": async (e, { db: t, session: n }) => {
		vo(n);
		let i = bo(e?.password, !0), a = {
			title: "Guardar el respaldo",
			defaultPath: `respaldo-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${$a}`,
			filters: [{
				name: "Respaldo",
				extensions: [$a]
			}]
		}, o = Ya(), c = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
		if (c.canceled || !c.filePath) return { cancelado: !0 };
		let l = Jn().directory, u = oo(t, l);
		return _(c.filePath, await so(u, i), "utf8"), go(l, {
			fecha: (/* @__PURE__ */ new Date()).toISOString(),
			usuario: _o(t, n),
			accion: "exporto",
			archivo: s.basename(c.filePath)
		}), {
			...So(u),
			archivo: s.basename(c.filePath)
		};
	},
	"backup.exportExcel": (e, { db: t, session: n }) => (vo(n), yo(t, n)),
	"backup.restore": (e, { db: t, session: n }) => (vo(n), Co(e?.password, _o(t, n))),
	"backup.log": (e, { session: t }) => (vo(t), { registros: ho(Jn().directory) })
}, Eo = { "backup.restoreEmpty": (e) => {
	if (!wo()) throw new z("Esta PC ya tiene usuarios: entre como administrador y restaure el respaldo desde Configuración.", 409);
	return Co(e?.password, "Sin sesión (PC nueva)");
} }, Do = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
}, Oo = {
	exporto: "Exportó un respaldo",
	restauro: "Restauró un respaldo",
	exporto_excel: "Exportó el Excel"
}, ko = "Usuario desconocido", Ao = /^\d{4}-\d{2}-\d{2}$/, jo = 12e4;
function Mo(e, t, n) {
	if (t.role === "admin_general") {
		if (!Number.isInteger(n)) throw new z("Elija una parroquia.", 400);
		return n;
	}
	let r = t.parish_id;
	if (r === null || t.role !== "admin_parroquia" || e.prepare("SELECT 1 FROM membresias WHERE usuario_id = ? AND parroquia_id = ? AND principal = 1").get(t.user_id, r) === void 0) throw new z("Solo el administrador principal de la parroquia ve las modificaciones.", 403);
	return r;
}
function No(e) {
	let t = "0000", n = "9999";
	if (e.desde && Ao.test(e.desde) && (t = (/* @__PURE__ */ new Date(`${e.desde}T00:00:00`)).toISOString()), e.hasta && Ao.test(e.hasta)) {
		let t = /* @__PURE__ */ new Date(`${e.hasta}T00:00:00`);
		t.setDate(t.getDate() + 1), n = t.toISOString();
	}
	return {
		from: t,
		to: n
	};
}
function Po(e) {
	return H(e.nombre, e.apellido_paterno, e.apellido_materno) || e.username || ko;
}
function Fo(e) {
	let t = e?.match(/^Fila (\d+)/);
	return t ? Number(t[1]) : null;
}
function Io(e, t, n, r) {
	let i = e.prepare("SELECT h.evento, h.motivo, h.fecha, h.usuario_id, s.id AS sacramento_id, s.tipo, s.libro, s.folio, s.numero,\n				u.nombre, u.apellido_paterno, u.apellido_materno, u.username\n			 FROM historial_partidas h\n			 JOIN sacramentos s ON s.id = h.sacramento_id\n			 LEFT JOIN usuarios u ON u.id = h.usuario_id\n			 WHERE s.parroquia_id = ? AND h.fecha >= ? AND h.fecha < ?\n			 ORDER BY h.fecha, h.id").all(t, n, r), a = [], o = null;
	function s() {
		if (!o) return;
		let e = o.rows.length > 0 ? `Filas ${Math.min(...o.rows)} a ${Math.max(...o.rows)} del Excel` : null;
		a.push({
			fecha: o.last.fecha,
			usuario: Po(o.first),
			tipo: "partidas",
			accion: "Importó del sistema anterior",
			sobre: `${o.count} ${o.count === 1 ? "partida" : "partidas"}`,
			detalle: e,
			sacramento_id: null
		}), o = null;
	}
	for (let e of i) {
		if (e.evento === "importada") {
			o !== null && o.first.usuario_id === e.usuario_id && Date.parse(e.fecha) - Date.parse(o.last.fecha) <= jo || (s(), o = {
				first: e,
				last: e,
				count: 0,
				rows: []
			});
			let t = o;
			t.last = e, t.count += 1;
			let n = Fo(e.motivo);
			n !== null && t.rows.push(n);
			continue;
		}
		s(), a.push({
			fecha: e.fecha,
			usuario: Po(e),
			tipo: "partidas",
			accion: da[e.evento] ?? e.evento,
			sobre: `${Do[e.tipo]}: libro ${e.libro}, folio ${e.folio}, registro ${e.numero}`,
			detalle: e.motivo,
			sacramento_id: e.sacramento_id
		});
	}
	return s(), a;
}
function Lo(e) {
	if (e.entidad === "ministro") {
		let t = H(e.ministro_nombre, e.ministro_paterno, e.ministro_materno);
		return t ? [e.ministro_titulo, t].filter(Boolean).join(" ") : "(ministro que no está en esta PC)";
	}
	let t = H(e.cuenta_nombre, e.cuenta_paterno, e.cuenta_materno);
	return e.cuenta_username ? t ? `${t} (${e.cuenta_username})` : e.cuenta_username : "(cuenta que no está en esta PC)";
}
function Ro(e, t, n, r) {
	return e.prepare("SELECT h.entidad, h.evento, h.detalle, h.fecha,\n				u.nombre, u.apellido_paterno, u.apellido_materno, u.username,\n				m.titulo AS ministro_titulo, m.nombre AS ministro_nombre, m.apellido_paterno AS ministro_paterno, m.apellido_materno AS ministro_materno,\n				c.nombre AS cuenta_nombre, c.apellido_paterno AS cuenta_paterno, c.apellido_materno AS cuenta_materno, c.username AS cuenta_username\n			 FROM historial_ministros_cuentas h\n			 LEFT JOIN usuarios u ON u.client_id = h.usuario_client_id\n			 LEFT JOIN ministros m ON h.entidad = 'ministro' AND m.client_id = h.entidad_client_id\n			 LEFT JOIN usuarios c ON h.entidad = 'usuario' AND c.client_id = h.entidad_client_id\n			 WHERE h.parroquia_id = ? AND h.fecha >= ? AND h.fecha < ?").all(t, n, r).map((e) => ({
		fecha: e.fecha,
		usuario: Po(e),
		tipo: e.entidad === "ministro" ? "ministros" : "cuentas",
		accion: ua[e.entidad][e.evento] ?? e.evento,
		sobre: Lo(e),
		detalle: e.detalle,
		sacramento_id: null
	}));
}
function zo(e, t) {
	return ho(Jn().directory).filter((n) => n.fecha >= e && n.fecha < t).map((e) => ({
		fecha: e.fecha,
		usuario: e.usuario,
		tipo: "pc",
		accion: Oo[e.accion] ?? e.accion,
		sobre: e.archivo,
		detalle: "En esta PC",
		sacramento_id: null
	}));
}
function Bo(e, t, n) {
	let r = Mo(e, t, n?.parroquia_id), { from: i, to: a } = No(n ?? {}), o = [
		...Io(e, r, i, a),
		...Ro(e, r, i, a),
		...zo(i, a)
	], s = [...new Set(o.map((e) => e.usuario))].sort((e, t) => e.localeCompare(t, "es")), c = o.filter((e) => !n?.tipo || e.tipo === n.tipo).filter((e) => !n?.usuario || e.usuario === n.usuario).sort((e, t) => t.fecha.localeCompare(e.fecha)), l = ((Number.isInteger(n?.pagina) && n.pagina > 0 ? n.pagina : 1) - 1) * 20;
	return {
		resultados: c.slice(l, l + 20),
		total_paginas: Math.max(1, Math.ceil(c.length / 20)),
		usuarios: s
	};
}
var Vo = { "modifications.list": (e, { db: t, session: n }) => Bo(t, n, e ?? {}) }, Ho = 50, Uo = 75, Wo = .75, Go = [
	"dni",
	"nombres",
	"apellido_paterno",
	"apellido_materno",
	"fecha_nacimiento",
	"padre",
	"madre"
], Ko = {
	dni: 40,
	nombres: 25,
	apellido_paterno: 20,
	apellido_materno: 15,
	fecha_nacimiento: 20,
	padre: 10,
	madre: 10
}, qo = {
	dni: "DNI",
	nombres: "Nombres",
	apellido_paterno: "Apellido paterno",
	apellido_materno: "Apellido materno",
	fecha_nacimiento: "Fecha de nacimiento",
	padre: "Padre",
	madre: "Madre"
};
function Y(e) {
	return (e ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function Jo(e, t) {
	let n = [];
	for (let e = 0; e <= t.length; e++) n.push(e);
	for (let r = 1; r <= e.length; r++) {
		let i = [r];
		for (let a = 1; a <= t.length; a++) {
			let o = e[r - 1] === t[a - 1] ? 0 : 1;
			i[a] = Math.min(n[a] + 1, i[a - 1] + 1, n[a - 1] + o);
		}
		n = i;
	}
	return n[t.length];
}
function Yo(e, t) {
	if (!e || !t) return 0;
	if (e === t) return 1;
	let n = e.split(" "), r = t.split(" "), i = n.length <= r.length ? n : r, a = n.length <= r.length ? r : n;
	if (i.every((e) => a.includes(e))) return .85;
	let o = Math.max(e.length, t.length);
	if (Math.abs(e.length - t.length) / o > .25) return 0;
	let s = 1 - Jo(e, t) / o;
	return s >= Wo ? s : 0;
}
function Xo(e, t) {
	return !e || !t ? {
		comparable: !1,
		value: 0
	} : e === t ? {
		comparable: !0,
		value: 1
	} : {
		comparable: !(e.startsWith(t + "-") || t.startsWith(e + "-")),
		value: 0
	};
}
function Zo(e, t, n) {
	let r = !!(e.dni && t.dni), i = r && e.dni === Y(t.dni), a = (r, i) => {
		let a = [Y(i), ...n.get(`${t.persona_id}:${r}`) ?? []];
		return Math.max(...a.map((t) => Yo(e[r], t)));
	}, o = a("nombres", t.nombres), s = a("apellido_paterno", t.apellido_paterno);
	if (!i && (o === 0 || s === 0)) return null;
	let c = {
		dni: {
			comparable: r,
			value: +!!i
		},
		nombres: {
			comparable: !!e.nombres,
			value: o
		},
		apellido_paterno: {
			comparable: !!e.apellido_paterno,
			value: s
		},
		apellido_materno: {
			comparable: !!(e.apellido_materno && t.apellido_materno),
			value: a("apellido_materno", t.apellido_materno)
		},
		fecha_nacimiento: Xo(e.fecha_nacimiento, Y(t.fecha_nacimiento)),
		padre: {
			comparable: !!(e.padre && t.padre),
			value: Yo(e.padre, Y(t.padre))
		},
		madre: {
			comparable: !!(e.madre && t.madre),
			value: Yo(e.madre, Y(t.madre))
		}
	}, l = 0, u = 0, d = [];
	for (let e of Go) {
		let t = c[e];
		t.comparable && (u += Ko[e], l += Ko[e] * t.value, t.value >= Wo && d.push(qo[e]));
	}
	let f = Math.round(l / u * 100), p = o >= Wo && s >= Wo, m = r && !i, h = !1;
	for (let e of [
		"fecha_nacimiento",
		"padre",
		"madre"
	]) c[e].comparable && c[e].value >= Wo && (h = !0);
	return i && (o > 0 || s > 0) || p && h && !m ? {
		nivel: "alta",
		porcentaje: f,
		coincide: d
	} : i || f >= Uo ? {
		nivel: "posible",
		porcentaje: f,
		coincide: d
	} : null;
}
function Qo(e) {
	return {
		dni: Y(e.dni),
		nombres: Y(e.nombres),
		apellido_paterno: Y(e.apellido_paterno),
		apellido_materno: Y(e.apellido_materno),
		fecha_nacimiento: Y(e.fecha_nacimiento),
		padre: Y(e.padre),
		madre: Y(e.madre)
	};
}
function $o(e, t) {
	let n = Number(t.nivel === "alta") - Number(e.nivel === "alta");
	return n === 0 ? t.porcentaje - e.porcentaje : n;
}
function es(e, t, n, r) {
	if (!_t(t)) throw new z("Tipo de sacramento inválido.", 400);
	let i = r.map((e) => ({
		para: e.para ?? "",
		values: Qo(e)
	})).filter((e) => e.values.dni || e.values.nombres && e.values.apellido_paterno);
	if (i.length === 0) return {
		matches: [],
		total: 0
	};
	let a = Number.isInteger(n) ? n : 0, o = e.prepare(`SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, ${Pr("par")} AS parroquia_nombre,
				pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
			 FROM (${bt(t)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 JOIN parroquias par ON par.id = s.parroquia_id
			 WHERE s.estado = 'vigente' AND s.id <> ?`).all(a), s = /* @__PURE__ */ new Map(), c = e.prepare("SELECT persona_id, campo_cambio, valor_nuevo FROM cambios_persona\n			 WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_nuevo IS NOT NULL\n			   AND estado = 'aprobado'").all();
	for (let e of c) {
		let t = `${e.persona_id}:${e.campo_cambio}`, n = s.get(t) ?? [];
		n.push(Y(e.valor_nuevo)), s.set(t, n);
	}
	let l = 0, u = [];
	for (let e of i) {
		let t = [];
		for (let n of o) {
			let r = Zo(e.values, n, s);
			r && t.push({
				sacramento_id: n.id,
				para: e.para,
				nivel: r.nivel,
				porcentaje: r.porcentaje,
				coincide: r.coincide,
				nombre_completo: H(n.nombres, n.apellido_paterno, n.apellido_materno),
				parroquia_nombre: n.parroquia_nombre,
				libro: n.libro,
				folio: n.folio,
				numero: n.numero
			});
		}
		l += t.length, t.sort($o), u.push(...t.slice(0, Ho));
	}
	return u.sort($o), {
		matches: u,
		total: l
	};
}
var ts = { "sacraments.findDuplicates": (e, { db: t }) => es(t, e.tipo, e.excluir_sacramento_id, e.personas) }, ns = /^[$_\u0080-\uFFFFa-zA-Z][$_\u0080-\uFFFF\w]*$/;
function rs(e) {
	let t = {}, n = {}, r = e(), i = e.toString(), a = i.slice(i.indexOf("[") + 1, i.lastIndexOf("]")).split(",").map((e) => e.trim());
	for (let e of a) if (!ns.test(e)) throw Error(`Invalid dependency name: ${e}`);
	let o = 0;
	for (; o < r.length;) {
		let e = a[o], i = r[o];
		typeof i == "function" ? t[e] = is(i, e) : n[e] = i, o++;
	}
	return {
		functions: t,
		variables: n
	};
}
function is(e, t) {
	let n = e.toString();
	if (e.prototype) {
		if (n.indexOf("[native code]") >= 0) {
			let e = n.indexOf(" ", 8) + 1, t = n.indexOf("(", e);
			return n.slice(e, t);
		}
		{
			let r = n;
			for (let n in e.prototype) r += ";" + t + ".prototype." + n + "=" + e.prototype[n].toString();
			return r;
		}
	}
	return n;
}
//#endregion
//#region node_modules/worker-f/lib/createWorker.js
function as(e, t, n, r, i, a) {
	let o = !1, s, c = () => {
		s.stop();
	}, l = (e, t) => {
		try {
			s.ingest(e, t);
		} catch (e) {
			throw c(), e;
		}
	};
	return {
		start: (c, u) => {
			if (o) throw Error("Was started");
			o = !0;
			let d = i(), f = d && d._, p = f || ss(t, c);
			f || a({ _: p });
			let [m, h] = p;
			s = e(m, () => {
				let e = i();
				if (e) return e.other;
			}, (e) => {
				a(Object.assign(Object.assign({}, i()), { other: e }));
			}, n, r), h && l(h, u);
		},
		stop: c,
		ingest: l
	};
}
var os = ")(postMessage)}";
function ss(e, t) {
	let [n, r] = cs(t);
	return [n + ";var onMessage = function(data) {for (var key in data) {self[key] = data[key]}onMessage = (" + e.toString() + os, r];
}
function cs(e) {
	let t = {}, n = {};
	for (let r of e) {
		let { functions: e, variables: i } = rs(r);
		t = Object.assign(Object.assign({}, t), e), n = Object.assign(Object.assign({}, n), i);
	}
	return [Object.keys(t).map((e) => e + "=" + t[e]).join(";"), n];
}
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunctionOrStream.js
function ls(e, t, n, r, i, a) {
	let o = !1, s = !1, c = [], l = () => [], u = () => [], d, f, p = (e) => us[e], m = (e, t) => {
		us[e] = t;
	}, h = () => {
		if (!o) throw Error("Not started");
	}, g = () => {
		if (o) throw Error("Was started");
	}, _ = () => {
		if (s) throw Error("Was stopped");
	}, v = () => {
		if (d) throw Error("Has alias");
	}, y = (e) => {
		if (typeof e != "function") throw TypeError("Argument must be a function");
	}, b;
	if (typeof t == "string") {
		if (d = t, f = p(d), !f || !f.$) throw Error("Not found");
		b = f.$[0], c = f.$[1], l = f.$[2], u = f.$[3], f.$[4];
	} else b = t;
	y(b);
	let x, ee = (e) => {
		_(), g(), y(e), c.push(e);
	}, S = () => {
		_(), g(), ee(() => [
			b,
			u,
			r
		]), o = !0, x.start(c, void 0);
	}, C = () => {
		s = !0, x.stop();
	}, w = (e) => {
		x.ingest([Date.now(), e], l(...e));
	}, T, E = Object.assign({
		inputLatency: T,
		outputLatency: T,
		addDependencies(e) {
			v(), ee(e);
		},
		inputTransferList: (e) => {
			_(), g(), v(), y(e), l = e;
		},
		outputTransferList: (e) => {
			_(), g(), v(), y(e), u = e;
		},
		alias(e) {
			_(), g(), v(), d = e, m(d, { $: [
				b,
				c,
				l,
				u
			] });
		},
		start: S,
		stop: C
	}, n(S, C, o, s, w, h, g, _));
	return x = as(e, (e) => {
		let t = -1, n = -1, i = r(b, (r) => {
			e([
				t,
				n,
				Date.now(),
				r
			], u(r));
		});
		return ([e, r]) => (t = e, n = Date.now(), i(r));
	}, (e) => {
		s || i(e);
	}, ([e, t, n, r]) => {
		s || (e !== -1 && (E.inputLatency = t - e), E.outputLatency = Date.now() - n, a(r));
	}, () => {
		if (d) {
			let e = p(d);
			if (e) return e.other;
		}
	}, (e) => {
		d && m(d, Object.assign(Object.assign({}, p(d)), { other: e }));
	}), E;
}
var us = {};
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunction.js
function ds(e, t) {
	let n, r;
	return ls(e, t, (e, t, i, a, o, s, c, l) => ({
		call(...e) {
			if (l(), s(), n || r) throw Error("Previous call not finished");
			return new Promise((t, i) => {
				n = t, r = i, o(e);
			});
		},
		callOnce(...n) {
			return e(), this.call(...n).finally(t);
		}
	}), (e, t) => {
		let n = (e) => typeof e == "object" && !!e && typeof e.then == "function";
		return (r) => {
			let i = e(...r);
			n(i) ? i.then(t) : t(i);
		};
	}, (e) => {
		if (r) r(e), n = void 0, r = void 0;
		else throw Error("`reject` callback not found");
	}, (e) => {
		if (n) n(e), n = void 0, r = void 0;
		else throw Error("`resolve` callback not found");
	});
}
//#endregion
//#region node_modules/worker-f/lib/environment/createWorkerInNode.js
function fs(e, t, n, r, i) {
	let a = !1, o = !1, s = t();
	s || (s = ps(e), n(s));
	let c = new O(s, { eval: !0 }).on("error", (e) => {
		o = !0, r(e);
	}).on("message", (e) => {
		i(e);
	}).on("exit", (e) => {
		e && !o && !a && r(/* @__PURE__ */ Error("Exited with code " + e));
	});
	return {
		stop: () => {
			a = !0, O.prototype.terminate.call(c);
		},
		ingest: c.postMessage.bind(c)
	};
}
function ps(e) {
	return e + ";" + ms;
}
var ms = "var workerThreads = require(\"worker_threads\");workerThreads.parentPort.on(\"message\", function(data) {onMessage(data)});var postMessage = function(data, transferList) {workerThreads.parentPort.postMessage(data, transferList)};self = global";
//#endregion
//#region node_modules/worker-f/lib/export/node/createWorkerFunctionInNode.js
function hs(e) {
	return ds(fs, e);
}
//#endregion
//#region node_modules/read-excel-file/modules/saxen/parser.js
function gs(e) {
	"@babel/helpers - typeof";
	return gs = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, gs(e);
}
function _s(e) {
	var t = String.fromCharCode, n = Object.prototype.hasOwnProperty, r = /&#(\d+);|&#x([0-9a-f]+);|&(\w+);/gi, i = {
		amp: "&",
		apos: "'",
		gt: ">",
		lt: "<",
		quot: "\""
	};
	Object.keys(i).forEach(function(e) {
		i[e.toUpperCase()] = i[e];
	});
	function a(e, r, a, o) {
		return o ? n.call(i, o) ? i[o] : "&" + o + ";" : t(r || parseInt(a, 16));
	}
	function o(e) {
		return e.length > 3 && e.indexOf("&") !== -1 ? e.replace(r, a) : e;
	}
	var s = "non-whitespace outside of root node";
	function c(e) {
		return Error(e);
	}
	function l(e) {
		return "missing namespace for prefix <" + e + ">";
	}
	function u(e) {
		return {
			get: e,
			enumerable: !0
		};
	}
	function d(e) {
		var t = {}, n;
		for (n in e) t[n] = e[n];
		return t;
	}
	var f = Symbol("nameCache");
	function p(e) {
		return e + "$uri";
	}
	function m(e) {
		var t = {}, n, r;
		for (n in e) r = e[n], t[r] = r, t[p(r)] = n;
		return t;
	}
	function h() {
		return {
			line: 0,
			column: 0
		};
	}
	function g(e) {
		throw e;
	}
	function _(e) {
		if (!this) return new _(e);
		var t = e && e.proxy, n, r, i, a, v = g, y, b, x, ee, S = h, C = !1, w = !1, T = "", E = !1, D = !1, O = null, k = !1, te, A, ne, re;
		function j(e) {
			e instanceof Error || (e = c(e)), O = e, v(e, S);
		}
		function M(e) {
			y && (e instanceof Error || (e = c(e)), y(e, S));
		}
		this.on = function(e, t) {
			if (typeof t != "function") throw c("required args <name, cb>");
			switch (e) {
				case "openTag":
					r = t;
					break;
				case "text":
					n = t;
					break;
				case "closeTag":
					i = t;
					break;
				case "error":
					v = t;
					break;
				case "warn":
					y = t;
					break;
				case "cdata":
					a = t;
					break;
				case "attention":
					ee = t;
					break;
				case "question":
					x = t;
					break;
				case "comment":
					b = t;
					break;
				default: throw c("unsupported event: " + e);
			}
			return this;
		}, this.ns = function(e) {
			if (e === void 0 && (e = {}), gs(e) !== "object") throw c("required args <nsMap={}>");
			var t = {}, n;
			for (n in e) t[n] = e[n];
			return D = !0, re = t, this;
		};
		function ie() {
			te = D ? [] : null, A = D ? m(re) : null, ne = [], S = h, k = !1, O = null, w = !1, T = "";
		}
		this.parse = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			if (C) throw c("parse during stream; call end() first");
			return ie(), N(e), S = h, k = !1, O;
		}, this.write = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			return C ||= (ie(), !0), O || (T = N(T + e, !0) || ""), this;
		}, this.end = function() {
			return C || ie(), C = !1, O || N(T), T = "", S = h, k = !1, O;
		}, this.stop = function() {
			k = !0;
		};
		function N(e) {
			var c = arguments.length > 1 && arguments[1] !== void 0 && arguments[1], m = null, h = null, g, _ = 0, v = !1, y = !1, C = 0, T = 0, O, ie, N, P, F, I, L, ae, oe, se = "", ce = 0, le;
			function ue(e, t) {
				var n = e.indexOf(":");
				if (n === -1) return e;
				var r = A[e.substring(0, n)];
				return r ? t === r ? e.substr(n + 1) : r + e.substr(n) : (M(l(e.substring(0, n))), null);
			}
			function de() {
				if (le !== null) return le;
				var e, t, n = D && A.xmlns, r = D && E ? [] : null, i = ce, a = se, s = a.length, c, l, u, f, m, h = {}, g = /* @__PURE__ */ new Set(), v, y, b;
				parseAttr: for (; i < s; i++) if (v = !1, y = a.charCodeAt(i), !(y === 32 || y < 14 && y > 8)) {
					for ((y < 65 || y > 122 || y > 90 && y < 97) && y !== 95 && y !== 58 && (M("illegal first char attribute name"), v = !0), b = i + 1; b < s; b++) if (y = a.charCodeAt(b), !(y > 96 && y < 123 || y > 64 && y < 91 || y > 47 && y < 59 || y === 46 || y === 45 || y === 95)) {
						if (y === 32 || y < 14 && y > 8) {
							M("missing attribute value"), i = b;
							continue parseAttr;
						}
						if (y === 61) break;
						M("illegal attribute name char"), v = !0;
					}
					if (m = a.substring(i, b), m === "xmlns:xmlns" && (M("illegal declaration of xmlns"), v = !0), y = a.charCodeAt(b + 1), y === 34) b = a.indexOf("\"", i = b + 2), b === -1 && (b = a.indexOf("'", i), b !== -1 && (M("attribute value quote missmatch"), v = !0));
					else if (y === 39) b = a.indexOf("'", i = b + 2), b === -1 && (b = a.indexOf("\"", i), b !== -1 && (M("attribute value quote missmatch"), v = !0));
					else for (M("missing attribute value quotes"), v = !0, b += 1; b < s && (y = a.charCodeAt(b + 1), !(y === 32 || y < 14 && y > 8)); b++);
					for (b === -1 && (M("missing closing quotes"), b = s, v = !0), v || (u = a.substring(i, b)), i = b; b + 1 < s && (y = a.charCodeAt(b + 1), !(y === 32 || y < 14 && y > 8)); b++) i === b && (M("illegal character after attribute end"), v = !0);
					if (i = b + 1, v) continue parseAttr;
					if (g.has(m)) {
						M("attribute <" + m + "> already defined");
						continue;
					}
					if (g.add(m), !D) {
						h[m] = u;
						continue;
					}
					if (E) {
						if (l = m === "xmlns" ? "xmlns" : m.charCodeAt(0) === 120 && m.substr(0, 6) === "xmlns:" ? m.substr(6) : null, l !== null) {
							if (e = o(u), t = p(l), f = re[e], !f) {
								if (l === "xmlns" || t in A && A[t] !== e) do
									f = "ns" + _++;
								while (A[f] !== void 0);
								else f = l;
								re[e] = f;
							}
							A[l] !== f && (c ||= (A = d(A), !0), A[l] = f, l === "xmlns" && (A[p(f)] = e, n = f), A[t] = e), h[m] = u;
							continue;
						}
						r.push(m, u);
						continue;
					}
					m = ue(m, n), m !== null && (h[m] = u);
				}
				if (E) for (i = 0, s = r.length; i < s; i++) m = ue(r[i++], n), u = r[i], m !== null && (h[m] = u);
				return le = h;
			}
			function fe() {
				for (var t = /(\r\n|\r|\n)/g, n = 0, r = 0, i = 0, a = T, o, s; C >= i && (o = t.exec(e), !(!o || (a = o[0].length + o.index, a > C)));) n += 1, i = a;
				return C == -1 ? (r = a, s = e.substring(T)) : T === 0 ? s = e.substring(T, C) : (r = C - i, s = T == -1 ? e.substring(C) : e.substring(C, T + 1)), {
					data: s,
					line: n,
					column: r
				};
			}
			for (S = fe, t && (oe = Object.create({}, {
				name: u(function() {
					return L;
				}),
				originalName: u(function() {
					return ae;
				}),
				attrs: u(de),
				ns: u(function() {
					return A;
				})
			})); T !== -1;) {
				if (C = e.charCodeAt(T) === 60 ? T : e.indexOf("<", T), C === -1) {
					if (c) return e.substring(T);
					if (ne.length) return j("unexpected end of file");
					if (!w) return j("missing start tag");
					T < e.length && e.substring(T).trim() && M(s);
					return;
				}
				if (w ||= !0, T !== C) {
					if (ne.length) {
						if (n && (n(e.substring(T, C), o, S), k)) return;
					} else if (e.substring(T, C).trim() && (M(s), k)) return;
				}
				if (P = e.charCodeAt(C + 1), P === 33) {
					if (N = e.charCodeAt(C + 2), N === 91 && e.substr(C + 3, 6) === "CDATA[") {
						if (T = e.indexOf("]]>", C), T === -1) return c ? e.substring(C) : j("unclosed cdata");
						if (a && (a(e.substring(C + 9, T), S), k)) return;
						T += 3;
						continue;
					}
					if (N === 45 && e.charCodeAt(C + 3) === 45) {
						if (T = e.indexOf("-->", C), T === -1) return c ? e.substring(C) : j("unclosed comment");
						if (b && (b(e.substring(C + 4, T), o, S), k)) return;
						T += 3;
						continue;
					}
				}
				if (P === 63) {
					if (T = e.indexOf("?>", C), T === -1) return c ? e.substring(C) : j("unclosed question");
					if (x && (x(e.substring(C, T + 2), S), k)) return;
					T += 2;
					continue;
				}
				for (O = C + 1;; O++) {
					if (F = e.charCodeAt(O), isNaN(F)) return c ? e.substring(C) : (T = -1, j("unclosed tag"));
					if (F === 34) N = e.indexOf("\"", O + 1), O = N === -1 ? O : N;
					else if (F === 39) N = e.indexOf("'", O + 1), O = N === -1 ? O : N;
					else if (F === 62) {
						T = O;
						break;
					}
				}
				if (P === 33) {
					if (ee && (ee(e.substring(C, T + 1), o, S), k)) return;
					T += 1;
					continue;
				}
				if (le = {}, P === 47) {
					if (v = !1, y = !0, !ne.length) return j("missing open tag");
					if (O = L = ne.pop(), N = C + 2 + O.length, e.substring(C + 2, N) !== O) return j("closing tag mismatch");
					for (; N < T; N++) if (P = e.charCodeAt(N), !(P === 32 || P > 8 && P < 14)) return j("close tag");
				} else {
					if (e.charCodeAt(T - 1) === 47 ? (O = L = e.substring(C + 1, T - 1), v = !0, y = !0) : (O = L = e.substring(C + 1, T), v = !0, y = !1), !(P > 96 && P < 123 || P > 64 && P < 91 || P === 95 || P === 58)) return j("illegal first char nodeName");
					for (N = 1, ie = O.length; N < ie; N++) if (P = O.charCodeAt(N), !(P > 96 && P < 123 || P > 64 && P < 91 || P > 47 && P < 59 || P === 45 || P === 95 || P == 46)) {
						if (P === 32 || P < 14 && P > 8) {
							L = O.substring(0, N), le = null;
							break;
						}
						return j("invalid nodeName");
					}
					y || ne.push(L);
				}
				if (D) {
					g = A, v && (y || te.push(g), le === null && (E = O.indexOf("xmlns", N) !== -1) && (ce = N, se = O, de(), E = !1)), ae = L, h !== A && (m = A[f], m === void 0 && (m = A[f] = {}), h = A);
					var pe = m[L];
					if (pe !== void 0) L = pe;
					else {
						if (P = L.indexOf(":"), P !== -1) {
							if (I = A[L.substring(0, P)], !I) return j("missing namespace on <" + ae + ">");
							L = L.substr(P + 1);
						} else I = A.xmlns;
						I && (L = I + ":" + L), m[ae] = L;
					}
				}
				if (v && (ce = N, se = O, r && (t ? r(oe, o, y, S) : r(L, de, o, y, S), k))) return;
				if (y) {
					if (i && (i(t ? oe : L, o, v, S), k)) return;
					D && (A = v ? g : te.pop());
				}
				T += 1;
			}
		}
	}
	return new _(e);
}
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXmlStream.saxen.js
function vs(e, t, n, r) {
	var i = !1, a = function() {
		if (i) throw Error("Errored");
	}, o, s = new _s();
	return {
		promise: new Promise(function(a, c) {
			o = a, s.on("error", function(e) {
				throw i = !0, e;
			}), s.on("text", function(t, n) {
				r && r(n(t), e);
			}), s.on("openTag", function(n, r, i, a, o) {
				if (t) {
					var s = r();
					for (var c in s) s[ys(c, !0)] = i(s[c]);
					t(ys(n), s, e);
				}
			}), s.on("closeTag", function(t) {
				n && n(ys(t), e);
			});
		}),
		write: function(e) {
			a(), s.write(e);
		},
		end: function() {
			a(), s.end(), o();
		}
	};
}
function ys(e, t) {
	for (var n = 0; n < e.length;) {
		if (e[n] === ":" && !(t && n === 5 && e.slice(0, 5) === "xmlns")) return e.slice(n + 1);
		n++;
	}
	return e;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/InvalidSpreadsheetError.js
function bs(e) {
	"@babel/helpers - typeof";
	return bs = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, bs(e);
}
function xs(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Cs(r.key), r);
	}
}
function Ss(e, t, n) {
	return t && xs(e.prototype, t), n && xs(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Cs(e) {
	var t = ws(e, "string");
	return bs(t) === "symbol" ? t : String(t);
}
function ws(e, t) {
	if (bs(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (bs(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ts(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Es(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Ps(e, t);
}
function Ds(e) {
	var t = Ms();
	return function() {
		var n = Fs(e), r;
		if (t) {
			var i = Fs(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Os(this, r);
	};
}
function Os(e, t) {
	if (t && (bs(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return ks(e);
}
function ks(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function As(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return As = function(e) {
		if (e === null || !Ns(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return js(e, arguments, Fs(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Ps(n, e);
	}, As(e);
}
function js(e, t, n) {
	return js = Ms() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Ps(i, n.prototype), i;
	}, js.apply(null, arguments);
}
function Ms() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Ns(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Ps(e, t) {
	return Ps = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Ps(e, t);
}
function Fs(e) {
	return Fs = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Fs(e);
}
var Is = /*#__PURE__*/ function(e) {
	Es(n, e);
	var t = Ds(n);
	function n(e) {
		var r;
		return Ts(this, n), r = t.call(this, e), r.name = "InvalidSpreadsheetError", r;
	}
	return Ss(n);
}(/*#__PURE__*/ As(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXml.js
function Ls(e, t, n, r, i, a) {
	var o = vs(t, n, r, i);
	return a ? s(o, e, a) : (o.write(e), o.end()), o.promise.then(function(e) {
		return e;
	}, function(e) {
		var t = new Is(e.message);
		throw t.stack = e.stack, t.cause = e, t;
	});
	function s(e, t, n, r) {
		var i = 65536, a = 0, o = i, s = function() {
			a++;
			var r = Date.now();
			if (t.length > o) {
				e.write(t.slice(0, o)), n && n(!1), t = t.slice(o);
				var i = Date.now() - r;
				return i < 3.5 ? o *= 2 : i > 7 && (o /= 2), !0;
			}
			return e.write(t), e.end(), n && n(!0), !1;
		};
		(function e() {
			s() && (r ? typeof setImmediate < "u" ? setImmediate(e) : setTimeout(e, 0) : e());
		})();
	}
}
//#endregion
//#region node_modules/unzipper-esm/lib/ZipFileError.js
var Rs = class extends Error {
	constructor(e, t) {
		super(t || e), this.code = e;
	}
};
function zs(e) {
	let t = new Rs(e.code, e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace(t, zs), t.cause = e, t;
}
//#endregion
//#region node_modules/unzipper-esm/lib/PullStream.js
var Bs = "function", Vs = function() {
	this.buffer = Buffer.from("");
	let e = this;
	e.on("finish", function() {
		e.finished = !0, e.emit("chunk", !1);
	});
}, Hs = function(e, t, n) {
	this.buffer = Buffer.concat([this.buffer, e]), this.cb = n, this.emit("chunk");
}, Us = function(e, t) {
	let n = new A(), r, i = this;
	function a() {
		if (typeof i.cb === Bs) {
			let e = i.cb;
			return i.cb = void 0, e();
		}
	}
	function o() {
		let s;
		if (i.buffer && i.buffer.length) {
			if (typeof e == "number") s = i.buffer.slice(0, e), i.buffer = i.buffer.slice(e), e -= s.length, r ||= !e;
			else {
				let n = i.buffer.indexOf(e);
				if (n !== -1) i.match = n, t && (n += e.length), s = i.buffer.slice(0, n), i.buffer = i.buffer.slice(n), r = !0;
				else {
					let t = i.buffer.length - e.length;
					t <= 0 ? a() : (s = i.buffer.slice(0, t), i.buffer = i.buffer.slice(t));
				}
			}
			s && n.write(s, function() {
				(i.buffer.length === 0 || e.length && i.buffer.length <= e.length) && a();
			});
		}
		if (r) i.removeListener("chunk", o), n.end();
		else if (i.finished) {
			i.removeListener("chunk", o), i.emit("error", new Rs("FILE_ENDED"));
			return;
		}
	}
	return i.on("chunk", o), o(), n;
}, Ws = function(e, t) {
	if (e === 0) return Promise.resolve("");
	if (!isNaN(e) && this.buffer.length > e) {
		let t = this.buffer.slice(0, e);
		return this.buffer = this.buffer.slice(e), Promise.resolve(t);
	}
	let n = Buffer.from(""), r = this, i = new ne({ transform: a });
	function a(e, t, r) {
		n = Buffer.concat([n, e]), r();
	}
	let o, s;
	return new Promise(function(a, c) {
		if (o = c, s = function(e) {
			r.__emittedError = e, c(e);
		}, r.finished) return c(new Rs("FILE_ENDED"));
		r.once("error", s), r.stream(e, t).on("error", c).pipe(i).on("finish", function() {
			a(n);
		}).on("error", c);
	}).finally(function() {
		r.removeListener("error", o), r.removeListener("error", s);
	});
}, Gs = class extends te {
	constructor() {
		super({
			decodeStrings: !1,
			objectMode: !0
		}), Vs.call(this);
	}
	_write(e, t, n) {
		return Hs.call(this, e, t, n);
	}
	stream(e, t) {
		return Us.call(this, e, t);
	}
	pull(e, t) {
		return Ws.call(this, e, t);
	}
	_read() {}
}, Ks = class extends ne {
	_transform(e, t, n) {
		n();
	}
};
//#endregion
//#region node_modules/unzipper-esm/lib/BufferStream.js
function qs(e) {
	return new Promise(function(t, n) {
		let r = [], i = new ne({ transform: a }).on("finish", function() {
			t(Buffer.concat(r));
		}).on("error", n);
		function a(e, t, n) {
			r.push(e), n();
		}
		e.on("error", n).pipe(i);
	});
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseBuffer.js
function Js(e, t, n) {
	let r;
	switch (n) {
		case 1:
			r = e.readUInt8(t);
			break;
		case 2:
			r = e.readUInt16LE(t);
			break;
		case 4:
			r = e.readUInt32LE(t);
			break;
		case 8:
			r = Number(e.readBigUInt64LE(t));
			break;
		default: throw Error("Unsupported UInt LE size!");
	}
	return r;
}
function Ys(e, t) {
	let n = {}, r = 0;
	for (let [i, a] of t) n[i] = e.length >= r + a ? Js(e, r, a) : null, r += a;
	return n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseExtraField.js
function Xs(e, t) {
	let n;
	for (; !n && e && e.length;) {
		let r = Ys(e, [["signature", 2], ["partSize", 2]]);
		if (r.signature === 1) {
			let r = [];
			t.uncompressedSize === 4294967295 && r.push(["uncompressedSize", 8]), t.compressedSize === 4294967295 && r.push(["compressedSize", 8]), t.offsetToLocalFileHeader === 4294967295 && r.push(["offsetToLocalFileHeader", 8]), n = Ys(e.slice(4), r);
		} else e = e.slice(r.partSize + 4);
	}
	return n ||= {}, t.compressedSize === 4294967295 && (t.compressedSize = n.compressedSize), t.uncompressedSize === 4294967295 && (t.uncompressedSize = n.uncompressedSize), t.offsetToLocalFileHeader === 4294967295 && (t.offsetToLocalFileHeader = n.offsetToLocalFileHeader), n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseDateTime.js
function Zs(e, t) {
	let n = e & 31, r = e >> 5 & 15, i = (e >> 9 & 127) + 1980, a = t ? (t & 31) * 2 : 0, o = t ? t >> 5 & 63 : 0, s = t ? t >> 11 : 0;
	return new Date(Date.UTC(i, r - 1, n, s, o, a));
}
//#endregion
//#region node_modules/unzipper-esm/lib/parse.js
var Qs = Buffer.alloc(4);
Qs.writeUInt32LE(101010256, 0);
function $s(e) {
	return new cc(e);
}
var ec = function(e) {
	this._opts = e;
	let t = this;
	t.on("finish", function() {
		t.emit("end"), t.emit("close");
	}), t._readRecord().catch(function(e) {
		(!t.__emittedError || t.__emittedError !== e) && t.emit("error", e);
	});
}, tc = function() {
	let e = this;
	return e.pull(4).then(function(t) {
		if (t.length === 0) return;
		let n = t.readUInt32LE(0);
		if (n === 875721283) return e._readCrxHeader();
		if (n === 67324752) return e._readFile();
		if (n === 33639248) return e.reachedCD = !0, e._readCentralDirectoryFileHeader();
		if (n === 101010256) return e._readEndOfCentralDirectoryRecord();
		if (e.reachedCD) return e.pull(Qs, !0).then(function() {
			return e._readEndOfCentralDirectoryRecord();
		});
		e.emit("error", new Rs("INVALID_SIGNATURE", "invalid signature: 0x" + n.toString(16)));
	}).then((function(t) {
		if (t) return e._readRecord();
	}));
}, nc = function() {
	let e = this;
	return e.pull(12).then(function(t) {
		return e.crxHeader = Ys(t, [
			["version", 4],
			["pubKeyLength", 4],
			["signatureLength", 4]
		]), e.pull(e.crxHeader.pubKeyLength + e.crxHeader.signatureLength);
	}).then(function(t) {
		return e.crxHeader.publicKey = t.slice(0, e.crxHeader.pubKeyLength), e.crxHeader.signature = t.slice(e.crxHeader.pubKeyLength), e.emit("crx-header", e.crxHeader), !0;
	});
}, rc = function() {
	let e = this;
	return e.pull(26).then(function(t) {
		let n = Ys(t, [
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
		return n.lastModifiedDateTime = Zs(n.lastModifiedDate, n.lastModifiedTime), e.crxHeader && (n.crxHeader = e.crxHeader), e.pull(n.fileNameLength).then(function(t) {
			let r = t.toString("utf8"), i = new A(), a = !1;
			return i.autodrain = function() {
				a = !0;
				let e = i.pipe(new Ks());
				return e.promise = function() {
					return new Promise(function(t, n) {
						e.on("finish", t), e.on("error", n);
					});
				}, e;
			}, i.buffer = function() {
				return qs(i);
			}, i.path = r, i.props = {}, i.props.path = r, i.props.pathBuffer = t, i.props.flags = { isUnicode: !!(n.flags & 2048) }, i.type = n.uncompressedSize === 0 && /[/\\]$/.test(r) ? "Directory" : "File", e._opts.verbose && (i.type === "Directory" ? console.log("   creating:", r) : i.type === "File" && (n.compressionMethod === 0 ? console.log(" extracting:", r) : console.log("  inflating:", r))), e.pull(n.extraFieldLength).then(function(t) {
				let o = Xs(t, n);
				i.vars = n, i.extra = o, e._opts.forceStream ? e.push(i) : (e.emit("entry", i), (e._readableState.pipesCount || e._readableState.pipes && e._readableState.pipes.length) && e.push(i)), e._opts.verbose && console.log({
					filename: r,
					vars: n,
					extra: o
				});
				let s = !(n.flags & 8) || n.compressedSize > 0, c;
				i.__autodraining = a;
				let l = n.compressionMethod && !a ? k.createInflateRaw() : A();
				return s ? (i.size = n.uncompressedSize, c = n.compressedSize) : (c = Buffer.alloc(4), c.writeUInt32LE(134695760, 0)), new Promise(function(t, n) {
					re(e.stream(c), l, i, function(r) {
						return r ? (r.code === "Z_DATA_ERROR" && (r = zs(r)), n(r)) : s ? t(s) : e._processDataDescriptor(i).then(t).catch(n);
					});
				});
			});
		});
	});
}, ic = function(e) {
	return this.pull(16).then(function(t) {
		return e.size = Ys(t, [
			["dataDescriptorSignature", 4],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4]
		]).uncompressedSize, !0;
	});
}, ac = function() {
	let e = this;
	return e.pull(42).then(function(t) {
		let n = Ys(t, [
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
		return e.pull(n.fileNameLength).then(function(t) {
			return n.fileName = t.toString("utf8"), e.pull(n.extraFieldLength);
		}).then(function() {
			return e.pull(n.fileCommentLength);
		}).then(function() {
			return !0;
		});
	});
}, oc = function() {
	let e = this;
	return e.pull(18).then(function(t) {
		let n = Ys(t, [
			["diskNumber", 2],
			["diskStart", 2],
			["numberOfRecordsOnDisk", 2],
			["numberOfRecords", 2],
			["sizeOfCentralDirectory", 4],
			["offsetToStartOfCentralDirectory", 4],
			["commentLength", 2]
		]);
		return e.pull(n.commentLength).then(function() {
			e.end(), e.push(null);
		});
	});
}, sc = function() {
	let e = this;
	return new Promise(function(t, n) {
		e.on("finish", t), e.on("error", n);
	});
}, cc = class extends Gs {
	constructor(e = { verbose: !1 }) {
		super(e), ec.call(this, e);
	}
	_readRecord() {
		return tc.call(this);
	}
	_readCrxHeader() {
		return nc.call(this);
	}
	_readFile() {
		return rc.call(this);
	}
	_processDataDescriptor(e) {
		return ic.call(this, e);
	}
	_readCentralDirectoryFileHeader() {
		return ac.call(this);
	}
	_readEndOfCentralDirectoryRecord() {
		return oc.call(this);
	}
	promise() {
		return sc.call(this);
	}
}, lc = /* @__PURE__ */ F(((e, t) => {
	var n = I("constants"), r = process.cwd, i = null, a = process.env.GRACEFUL_FS_PLATFORM || process.platform;
	process.cwd = function() {
		return i ||= r.call(process), i;
	};
	try {
		process.cwd();
	} catch {}
	if (typeof process.chdir == "function") {
		var o = process.chdir;
		process.chdir = function(e) {
			i = null, o.call(process, e);
		}, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, o);
	}
	t.exports = s;
	function s(e) {
		n.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && t(e), e.lutimes || r(e), e.chown = s(e.chown), e.fchown = s(e.fchown), e.lchown = s(e.lchown), e.chmod = i(e.chmod), e.fchmod = i(e.fchmod), e.lchmod = i(e.lchmod), e.chownSync = c(e.chownSync), e.fchownSync = c(e.fchownSync), e.lchownSync = c(e.lchownSync), e.chmodSync = o(e.chmodSync), e.fchmodSync = o(e.fchmodSync), e.lchmodSync = o(e.lchmodSync), e.stat = l(e.stat), e.fstat = l(e.fstat), e.lstat = l(e.lstat), e.statSync = u(e.statSync), e.fstatSync = u(e.fstatSync), e.lstatSync = u(e.lstatSync), e.chmod && !e.lchmod && (e.lchmod = function(e, t, n) {
			n && process.nextTick(n);
		}, e.lchmodSync = function() {}), e.chown && !e.lchown && (e.lchown = function(e, t, n, r) {
			r && process.nextTick(r);
		}, e.lchownSync = function() {}), a === "win32" && (e.rename = typeof e.rename == "function" ? (function(t) {
			function n(n, r, i) {
				var a = Date.now(), o = 0;
				t(n, r, function s(c) {
					if (c && (c.code === "EACCES" || c.code === "EPERM" || c.code === "EBUSY") && Date.now() - a < 6e4) {
						setTimeout(function() {
							e.stat(r, function(e, a) {
								e && e.code === "ENOENT" ? t(n, r, s) : i(c);
							});
						}, o), o < 100 && (o += 10);
						return;
					}
					i && i(c);
				});
			}
			return Object.setPrototypeOf && Object.setPrototypeOf(n, t), n;
		})(e.rename) : e.rename), e.read = typeof e.read == "function" ? (function(t) {
			function n(n, r, i, a, o, s) {
				var c;
				if (s && typeof s == "function") {
					var l = 0;
					c = function(u, d, f) {
						if (u && u.code === "EAGAIN" && l < 10) return l++, t.call(e, n, r, i, a, o, c);
						s.apply(this, arguments);
					};
				}
				return t.call(e, n, r, i, a, o, c);
			}
			return Object.setPrototypeOf && Object.setPrototypeOf(n, t), n;
		})(e.read) : e.read, e.readSync = typeof e.readSync == "function" ? (function(t) {
			return function(n, r, i, a, o) {
				for (var s = 0;;) try {
					return t.call(e, n, r, i, a, o);
				} catch (e) {
					if (e.code === "EAGAIN" && s < 10) {
						s++;
						continue;
					}
					throw e;
				}
			};
		})(e.readSync) : e.readSync;
		function t(e) {
			e.lchmod = function(t, r, i) {
				e.open(t, n.O_WRONLY | n.O_SYMLINK, r, function(t, n) {
					if (t) {
						i && i(t);
						return;
					}
					e.fchmod(n, r, function(t) {
						e.close(n, function(e) {
							i && i(t || e);
						});
					});
				});
			}, e.lchmodSync = function(t, r) {
				var i = e.openSync(t, n.O_WRONLY | n.O_SYMLINK, r), a = !0, o;
				try {
					o = e.fchmodSync(i, r), a = !1;
				} finally {
					if (a) try {
						e.closeSync(i);
					} catch {}
					else e.closeSync(i);
				}
				return o;
			};
		}
		function r(e) {
			n.hasOwnProperty("O_SYMLINK") && e.futimes ? (e.lutimes = function(t, r, i, a) {
				e.open(t, n.O_SYMLINK, function(t, n) {
					if (t) {
						a && a(t);
						return;
					}
					e.futimes(n, r, i, function(t) {
						e.close(n, function(e) {
							a && a(t || e);
						});
					});
				});
			}, e.lutimesSync = function(t, r, i) {
				var a = e.openSync(t, n.O_SYMLINK), o, s = !0;
				try {
					o = e.futimesSync(a, r, i), s = !1;
				} finally {
					if (s) try {
						e.closeSync(a);
					} catch {}
					else e.closeSync(a);
				}
				return o;
			}) : e.futimes && (e.lutimes = function(e, t, n, r) {
				r && process.nextTick(r);
			}, e.lutimesSync = function() {});
		}
		function i(t) {
			return t && function(n, r, i) {
				return t.call(e, n, r, function(e) {
					d(e) && (e = null), i && i.apply(this, arguments);
				});
			};
		}
		function o(t) {
			return t && function(n, r) {
				try {
					return t.call(e, n, r);
				} catch (e) {
					if (!d(e)) throw e;
				}
			};
		}
		function s(t) {
			return t && function(n, r, i, a) {
				return t.call(e, n, r, i, function(e) {
					d(e) && (e = null), a && a.apply(this, arguments);
				});
			};
		}
		function c(t) {
			return t && function(n, r, i) {
				try {
					return t.call(e, n, r, i);
				} catch (e) {
					if (!d(e)) throw e;
				}
			};
		}
		function l(t) {
			return t && function(n, r, i) {
				typeof r == "function" && (i = r, r = null);
				function a(e, t) {
					t && (t.uid < 0 && (t.uid += 4294967296), t.gid < 0 && (t.gid += 4294967296)), i && i.apply(this, arguments);
				}
				return r ? t.call(e, n, r, a) : t.call(e, n, a);
			};
		}
		function u(t) {
			return t && function(n, r) {
				var i = r ? t.call(e, n, r) : t.call(e, n);
				return i && (i.uid < 0 && (i.uid += 4294967296), i.gid < 0 && (i.gid += 4294967296)), i;
			};
		}
		function d(e) {
			return !(e && e.code !== "ENOSYS" && (process.getuid && process.getuid() === 0 || e.code !== "EINVAL" && e.code !== "EPERM"));
		}
	}
})), uc = /* @__PURE__ */ F(((e, t) => {
	var n = I("stream").Stream;
	t.exports = r;
	function r(e) {
		return {
			ReadStream: t,
			WriteStream: r
		};
		function t(r, i) {
			if (!(this instanceof t)) return new t(r, i);
			n.call(this);
			var a = this;
			this.path = r, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 65536, i ||= {};
			for (var o = Object.keys(i), s = 0, c = o.length; s < c; s++) {
				var l = o[s];
				this[l] = i[l];
			}
			if (this.encoding && this.setEncoding(this.encoding), this.start !== void 0) {
				if (typeof this.start != "number") throw TypeError("start must be a Number");
				if (this.end === void 0) this.end = Infinity;
				else if (typeof this.end != "number") throw TypeError("end must be a Number");
				if (this.start > this.end) throw Error("start must be <= end");
				this.pos = this.start;
			}
			if (this.fd !== null) {
				process.nextTick(function() {
					a._read();
				});
				return;
			}
			e.open(this.path, this.flags, this.mode, function(e, t) {
				if (e) {
					a.emit("error", e), a.readable = !1;
					return;
				}
				a.fd = t, a.emit("open", t), a._read();
			});
		}
		function r(t, i) {
			if (!(this instanceof r)) return new r(t, i);
			n.call(this), this.path = t, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, i ||= {};
			for (var a = Object.keys(i), o = 0, s = a.length; o < s; o++) {
				var c = a[o];
				this[c] = i[c];
			}
			if (this.start !== void 0) {
				if (typeof this.start != "number") throw TypeError("start must be a Number");
				if (this.start < 0) throw Error("start must be >= zero");
				this.pos = this.start;
			}
			this.busy = !1, this._queue = [], this.fd === null && (this._open = e.open, this._queue.push([
				this._open,
				this.path,
				this.flags,
				this.mode,
				void 0
			]), this.flush());
		}
	}
})), dc = /* @__PURE__ */ F(((e, t) => {
	t.exports = r;
	var n = Object.getPrototypeOf || function(e) {
		return e.__proto__;
	};
	function r(e) {
		if (typeof e != "object" || !e) return e;
		if (e instanceof Object) var t = { __proto__: n(e) };
		else var t = Object.create(null);
		return Object.getOwnPropertyNames(e).forEach(function(n) {
			Object.defineProperty(t, n, Object.getOwnPropertyDescriptor(e, n));
		}), t;
	}
})), fc = /* @__PURE__ */ F(((e, t) => {
	var n = I("fs"), r = lc(), i = uc(), a = dc(), o = I("util"), s, c;
	/* istanbul ignore else - node 0.x polyfill */
	typeof Symbol == "function" && typeof Symbol.for == "function" ? (s = Symbol.for("graceful-fs.queue"), c = Symbol.for("graceful-fs.previous")) : (s = "___graceful-fs.queue", c = "___graceful-fs.previous");
	function l() {}
	function u(e, t) {
		Object.defineProperty(e, s, { get: function() {
			return t;
		} });
	}
	var d = l;
	o.debuglog ? d = o.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (d = function() {
		var e = o.format.apply(o, arguments);
		e = "GFS4: " + e.split(/\n/).join("\nGFS4: "), console.error(e);
	}), n[s] || (u(n, global[s] || []), n.close = (function(e) {
		function t(t, r) {
			return e.call(n, t, function(e) {
				e || h(), typeof r == "function" && r.apply(this, arguments);
			});
		}
		return Object.defineProperty(t, c, { value: e }), t;
	})(n.close), n.closeSync = (function(e) {
		function t(t) {
			e.apply(n, arguments), h();
		}
		return Object.defineProperty(t, c, { value: e }), t;
	})(n.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
		d(n[s]), I("assert").equal(n[s].length, 0);
	})), global[s] || u(global, n[s]), t.exports = f(a(n)), process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !n.__patched && (t.exports = f(n), n.__patched = !0);
	function f(e) {
		r(e), e.gracefulify = f, e.createReadStream = w, e.createWriteStream = T;
		var t = e.readFile;
		e.readFile = n;
		function n(e, n, r) {
			return typeof n == "function" && (r = n, n = null), i(e, n, r);
			function i(e, n, r, a) {
				return t(e, n, function(t) {
					t && (t.code === "EMFILE" || t.code === "ENFILE") ? p([
						i,
						[
							e,
							n,
							r
						],
						t,
						a || Date.now(),
						Date.now()
					]) : typeof r == "function" && r.apply(this, arguments);
				});
			}
		}
		var a = e.writeFile;
		e.writeFile = o;
		function o(e, t, n, r) {
			return typeof n == "function" && (r = n, n = null), i(e, t, n, r);
			function i(e, t, n, r, o) {
				return a(e, t, n, function(a) {
					a && (a.code === "EMFILE" || a.code === "ENFILE") ? p([
						i,
						[
							e,
							t,
							n,
							r
						],
						a,
						o || Date.now(),
						Date.now()
					]) : typeof r == "function" && r.apply(this, arguments);
				});
			}
		}
		var s = e.appendFile;
		s && (e.appendFile = c);
		function c(e, t, n, r) {
			return typeof n == "function" && (r = n, n = null), i(e, t, n, r);
			function i(e, t, n, r, a) {
				return s(e, t, n, function(o) {
					o && (o.code === "EMFILE" || o.code === "ENFILE") ? p([
						i,
						[
							e,
							t,
							n,
							r
						],
						o,
						a || Date.now(),
						Date.now()
					]) : typeof r == "function" && r.apply(this, arguments);
				});
			}
		}
		var l = e.copyFile;
		l && (e.copyFile = u);
		function u(e, t, n, r) {
			return typeof n == "function" && (r = n, n = 0), i(e, t, n, r);
			function i(e, t, n, r, a) {
				return l(e, t, n, function(o) {
					o && (o.code === "EMFILE" || o.code === "ENFILE") ? p([
						i,
						[
							e,
							t,
							n,
							r
						],
						o,
						a || Date.now(),
						Date.now()
					]) : typeof r == "function" && r.apply(this, arguments);
				});
			}
		}
		var d = e.readdir;
		e.readdir = h;
		var m = /^v[0-5]\./;
		function h(e, t, n) {
			typeof t == "function" && (n = t, t = null);
			var r = m.test(process.version) ? function(e, t, n, r) {
				return d(e, i(e, t, n, r));
			} : function(e, t, n, r) {
				return d(e, t, i(e, t, n, r));
			};
			return r(e, t, n);
			function i(e, t, n, i) {
				return function(a, o) {
					a && (a.code === "EMFILE" || a.code === "ENFILE") ? p([
						r,
						[
							e,
							t,
							n
						],
						a,
						i || Date.now(),
						Date.now()
					]) : (o && o.sort && o.sort(), typeof n == "function" && n.call(this, a, o));
				};
			}
		}
		if (process.version.substr(0, 4) === "v0.8") {
			var g = i(e);
			x = g.ReadStream, S = g.WriteStream;
		}
		var _ = e.ReadStream;
		_ && (x.prototype = Object.create(_.prototype), x.prototype.open = ee);
		var v = e.WriteStream;
		v && (S.prototype = Object.create(v.prototype), S.prototype.open = C), Object.defineProperty(e, "ReadStream", {
			get: function() {
				return x;
			},
			set: function(e) {
				x = e;
			},
			enumerable: !0,
			configurable: !0
		}), Object.defineProperty(e, "WriteStream", {
			get: function() {
				return S;
			},
			set: function(e) {
				S = e;
			},
			enumerable: !0,
			configurable: !0
		});
		var y = x;
		Object.defineProperty(e, "FileReadStream", {
			get: function() {
				return y;
			},
			set: function(e) {
				y = e;
			},
			enumerable: !0,
			configurable: !0
		});
		var b = S;
		Object.defineProperty(e, "FileWriteStream", {
			get: function() {
				return b;
			},
			set: function(e) {
				b = e;
			},
			enumerable: !0,
			configurable: !0
		});
		function x(e, t) {
			return this instanceof x ? (_.apply(this, arguments), this) : x.apply(Object.create(x.prototype), arguments);
		}
		function ee() {
			var e = this;
			D(e.path, e.flags, e.mode, function(t, n) {
				t ? (e.autoClose && e.destroy(), e.emit("error", t)) : (e.fd = n, e.emit("open", n), e.read());
			});
		}
		function S(e, t) {
			return this instanceof S ? (v.apply(this, arguments), this) : S.apply(Object.create(S.prototype), arguments);
		}
		function C() {
			var e = this;
			D(e.path, e.flags, e.mode, function(t, n) {
				t ? (e.destroy(), e.emit("error", t)) : (e.fd = n, e.emit("open", n));
			});
		}
		function w(t, n) {
			return new e.ReadStream(t, n);
		}
		function T(t, n) {
			return new e.WriteStream(t, n);
		}
		var E = e.open;
		e.open = D;
		function D(e, t, n, r) {
			return typeof n == "function" && (r = n, n = null), i(e, t, n, r);
			function i(e, t, n, r, a) {
				return E(e, t, n, function(o, s) {
					o && (o.code === "EMFILE" || o.code === "ENFILE") ? p([
						i,
						[
							e,
							t,
							n,
							r
						],
						o,
						a || Date.now(),
						Date.now()
					]) : typeof r == "function" && r.apply(this, arguments);
				});
			}
		}
		return e;
	}
	function p(e) {
		d("ENQUEUE", e[0].name, e[1]), n[s].push(e), g();
	}
	var m;
	function h() {
		for (var e = Date.now(), t = 0; t < n[s].length; ++t) n[s][t].length > 2 && (n[s][t][3] = e, n[s][t][4] = e);
		g();
	}
	function g() {
		if (clearTimeout(m), m = void 0, n[s].length !== 0) {
			var e = n[s].shift(), t = e[0], r = e[1], i = e[2], a = e[3], o = e[4];
			if (a === void 0) d("RETRY", t.name, r), t.apply(null, r);
			else if (Date.now() - a >= 6e4) {
				d("TIMEOUT", t.name, r);
				var c = r.pop();
				typeof c == "function" && c.call(null, i);
			} else {
				var l = Date.now() - o, u = Math.max(o - a, 1);
				l >= Math.min(u * 1.2, 100) ? (d("RETRY", t.name, r), t.apply(null, r.concat([a]))) : n[s].push(e);
			}
			m === void 0 && (m = setTimeout(g, 0));
		}
	}
}));
(/* @__PURE__ */ F(((e, t) => {
	for (var n = 4294967296, r = [], i = 0; i < 256; i++) r[i] = (i > 15 ? "" : "0") + i.toString(16);
	var a = t.exports = function(e, t) {
		e instanceof Buffer ? (this.buffer = e, this.offset = t || 0) : Object.prototype.toString.call(e) == "[object Uint8Array]" ? (this.buffer = new Buffer(e), this.offset = t || 0) : (this.buffer = this.buffer || new Buffer(8), this.offset = 0, this.setValue.apply(this, arguments));
	};
	a.MAX_INT = 2 ** 53, a.MIN_INT = -(2 ** 53), a.prototype = {
		constructor: a,
		_2scomp: function() {
			for (var e = this.buffer, t = this.offset, n = 1, r = t + 7; r >= t; r--) {
				var i = (e[r] ^ 255) + n;
				e[r] = i & 255, n = i >> 8;
			}
		},
		setValue: function(e, t) {
			var r = !1;
			if (arguments.length == 1) {
				if (typeof e == "number") {
					if (r = e < 0, e = Math.abs(e), t = e % n, e /= n, e > n) throw RangeError(e + " is outside Int64 range");
					e |= 0;
				} else if (typeof e == "string") e = (e + "").replace(/^0x/, ""), t = e.substr(-8), e = e.length > 8 ? e.substr(0, e.length - 8) : "", e = parseInt(e, 16), t = parseInt(t, 16);
				else throw Error(e + " must be a Number or String");
			}
			for (var i = this.buffer, a = this.offset, o = 7; o >= 0; o--) i[a + o] = t & 255, t = o == 4 ? e : t >>> 8;
			r && this._2scomp();
		},
		toNumber: function(e) {
			for (var t = this.buffer, n = this.offset, r = t[n] & 128, i = 0, o = 1, s = 7, c = 1; s >= 0; s--, c *= 256) {
				var l = t[n + s];
				r && (l = (l ^ 255) + o, o = l >> 8, l &= 255), i += l * c;
			}
			return !e && i >= a.MAX_INT ? r ? -Infinity : Infinity : r ? -i : i;
		},
		valueOf: function() {
			return this.toNumber(!1);
		},
		toString: function(e) {
			return this.valueOf().toString(e || 10);
		},
		toOctetString: function(e) {
			for (var t = Array(8), n = this.buffer, i = this.offset, a = 0; a < 8; a++) t[a] = r[n[i + a]];
			return t.join(e || "");
		},
		toBuffer: function(e) {
			if (e && this.offset === 0) return this.buffer;
			var t = new Buffer(8);
			return this.buffer.copy(t, 0, this.offset, this.offset + 8), t;
		},
		copy: function(e, t) {
			this.buffer.copy(e, t || 0, this.offset, this.offset + 8);
		},
		compare: function(e) {
			if ((this.buffer[this.offset] & 128) != (e.buffer[e.offset] & 128)) return e.buffer[e.offset] - this.buffer[this.offset];
			for (var t = 0; t < 8; t++) if (this.buffer[this.offset + t] !== e.buffer[e.offset + t]) return this.buffer[this.offset + t] - e.buffer[e.offset + t];
			return 0;
		},
		equals: function(e) {
			return this.compare(e) === 0;
		},
		inspect: function() {
			return "[Int64 value:" + this + " octets:" + this.toOctetString(" ") + "]";
		}
	};
})))(), Buffer.alloc(4).writeUInt32LE(101010256, 0), fc();
//#endregion
//#region node_modules/read-excel-file/modules/zip/UnzipError.js
function pc(e) {
	"@babel/helpers - typeof";
	return pc = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, pc(e);
}
function mc(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, gc(r.key), r);
	}
}
function hc(e, t, n) {
	return t && mc(e.prototype, t), n && mc(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function gc(e) {
	var t = _c(e, "string");
	return pc(t) === "symbol" ? t : String(t);
}
function _c(e, t) {
	if (pc(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (pc(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function vc(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function yc(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Dc(e, t);
}
function bc(e) {
	var t = Tc();
	return function() {
		var n = Oc(e), r;
		if (t) {
			var i = Oc(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return xc(this, r);
	};
}
function xc(e, t) {
	if (t && (pc(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Sc(e);
}
function Sc(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Cc(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Cc = function(e) {
		if (e === null || !Ec(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return wc(e, arguments, Oc(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Dc(n, e);
	}, Cc(e);
}
function wc(e, t, n) {
	return wc = Tc() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Dc(i, n.prototype), i;
	}, wc.apply(null, arguments);
}
function Tc() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Ec(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Dc(e, t) {
	return Dc = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Dc(e, t);
}
function Oc(e) {
	return Oc = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Oc(e);
}
var kc = /*#__PURE__*/ function(e) {
	yc(n, e);
	var t = bc(n);
	function n() {
		return vc(this, n), t.apply(this, arguments);
	}
	return hc(n);
}(/*#__PURE__*/ Cc(Error));
function Ac(e) {
	var t = new kc(e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace && Error.captureStackTrace(t, Ac), t.cause = e, t;
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.unzipper.js
var jc = void 0;
function Mc(e, t, n, r) {
	return new Promise(function(i, a) {
		var o = [], s = !1, c = function(e) {
			e instanceof Rs && (e = Ac(e)), s || (s = !0, a(e));
		};
		e.on("error", c).pipe($s()).on("error", c).on("finish", function() {
			s || Promise.all(o).then(function() {
				i(jc);
			}, c);
		}).on("entry", function(e) {
			var i = !1;
			e.type === "Directory" && (i = !0), s && (i = !0);
			var a = !(e.vars.flags & 8) || e.vars.compressedSize > 0 ? e.vars.uncompressedSize : void 0;
			if (t(e.path, a) === !1 && (i = !0), i) {
				e.autodrain().on("error", c);
				return;
			}
			o.push(new Promise(function(t) {
				e.on("data", function(t) {
					n(e.path, t);
				}).on("error", function(e) {
					c(e);
				}).on("finish", function() {
					r(e.path), t();
				});
			}));
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.js
function Nc(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = Pc(e)) || t && e && typeof e.length == "number") {
		n && (e = n);
		var r = 0;
		return function() {
			return r >= e.length ? { done: !0 } : {
				done: !1,
				value: e[r++]
			};
		};
	}
	throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Pc(e, t) {
	if (e) {
		if (typeof e == "string") return Fc(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Fc(e, t);
	}
}
function Fc(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Ic(e) {
	var t = (arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}).filter, n = {}, r = {};
	return Mc(e, function(e, n) {
		if (t && !t({ path: e })) return !1;
		r[e] = {
			size: n,
			chunks: [],
			buffer: n === void 0 ? void 0 : Buffer.alloc(n),
			position: 0
		};
	}, function(e, t) {
		r[e].size === void 0 ? r[e].chunks.push(t) : r[e].position += t.copy(r[e].buffer, r[e].position);
	}, function(e) {
		n[e] = r[e].size === void 0 ? Lc(r[e].chunks) : r[e].buffer, delete r[e];
	}).then(function() {
		return n;
	});
}
function Lc(e) {
	for (var t = e.reduce(function(e, t) {
		return e + t.length;
	}, 0), n = Buffer.allocUnsafeSlow(t), r = 0, i = Nc(e), a; !(a = i()).done;) {
		var o = a.value;
		o.copy(n, r), r += o.length;
	}
	return n;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InvalidInputError.js
function Rc(e) {
	"@babel/helpers - typeof";
	return Rc = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Rc(e);
}
function zc(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Vc(r.key), r);
	}
}
function Bc(e, t, n) {
	return t && zc(e.prototype, t), n && zc(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Vc(e) {
	var t = Hc(e, "string");
	return Rc(t) === "symbol" ? t : String(t);
}
function Hc(e, t) {
	if (Rc(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Rc(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Uc(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Wc(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Qc(e, t);
}
function Gc(e) {
	var t = Xc();
	return function() {
		var n = $c(e), r;
		if (t) {
			var i = $c(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Kc(this, r);
	};
}
function Kc(e, t) {
	if (t && (Rc(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return qc(e);
}
function qc(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Jc(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Jc = function(e) {
		if (e === null || !Zc(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Yc(e, arguments, $c(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Qc(n, e);
	}, Jc(e);
}
function Yc(e, t, n) {
	return Yc = Xc() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Qc(i, n.prototype), i;
	}, Yc.apply(null, arguments);
}
function Xc() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Zc(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Qc(e, t) {
	return Qc = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Qc(e, t);
}
function $c(e) {
	return $c = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, $c(e);
}
var el = {
	XLS_FILE_NOT_SUPPORTED: "You passed a legacy `.xls` file. Only `.xlsx` files are supported",
	FILE_NOT_SUPPORTED: "Doesn't look like an `.xlsx` file",
	INVALID_ZIP: "Couldn't unzip `.xlsx` file contents",
	NO_DATA: "No data"
}, tl = /*#__PURE__*/ function(e) {
	Wc(n, e);
	var t = Gc(n);
	function n(e, r) {
		var i;
		return Uc(this, n), i = t.call(this, el[e] || e), i.code = e, i.name = "InvalidInputError", i.cause = r, i;
	}
	return Bc(n);
}(/*#__PURE__*/ Jc(Error));
//#endregion
//#region node_modules/read-excel-file/modules/export/convertInputToNodeStream.js
function nl(e) {
	return e instanceof M ? e : e instanceof Buffer ? rl(e) : e instanceof j ? il(e) : l.createReadStream(e);
}
function rl(e) {
	return ie.from(e);
}
function il(e) {
	return ie.fromWeb(e.stream());
}
//#endregion
//#region node_modules/read-excel-file/modules/export/filterZipArchiveEntry.js
function al(e) {
	var t = e.path;
	return t.endsWith(".xml") || t.endsWith(".xml.rels");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/createFileTypeDetector.js
var ol = [80, 75], sl = [
	208,
	207,
	17,
	224
], cl = [ol, sl];
cl.indexOf(ol);
var ll = cl.indexOf(sl);
function ul() {
	var e, t = dl(cl), n = 0;
	return function(r) {
		if (isNaN(e)) {
			var i;
			t = t.filter(function(e) {
				if (r === cl[e][n]) return cl[e].length === n + 1 && (i = e), !0;
			}), t.length === 1 ? e = i : t.length === 0 && (e = -1);
		}
		return n++, e;
	};
}
function dl(e) {
	for (var t = [], n = 0; n < e.length;) t.push(n), n++;
	return t;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/validateLeadingBytes.js
function fl(e, t) {
	var n = t(e);
	if (n !== void 0) {
		if (n === ll) throw new tl("XLS_FILE_NOT_SUPPORTED");
		if (n < 0) throw new tl("FILE_NOT_SUPPORTED");
		return !0;
	}
}
function pl(e) {
	throw new tl(e === 0 ? "NO_DATA" : "FILE_NOT_SUPPORTED");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InputValidationStream.js
function ml(e) {
	"@babel/helpers - typeof";
	return ml = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, ml(e);
}
function hl(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = gl(e)) || t && e && typeof e.length == "number") {
		n && (e = n);
		var r = 0;
		return function() {
			return r >= e.length ? { done: !0 } : {
				done: !1,
				value: e[r++]
			};
		};
	}
	throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function gl(e, t) {
	if (e) {
		if (typeof e == "string") return _l(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _l(e, t);
	}
}
function _l(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function vl(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function yl(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, xl(r.key), r);
	}
}
function bl(e, t, n) {
	return t && yl(e.prototype, t), n && yl(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function xl(e) {
	var t = Sl(e, "string");
	return ml(t) === "symbol" ? t : String(t);
}
function Sl(e, t) {
	if (ml(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (ml(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Cl(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && wl(e, t);
}
function wl(e, t) {
	return wl = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, wl(e, t);
}
function Tl(e) {
	var t = Ol();
	return function() {
		var n = kl(e), r;
		if (t) {
			var i = kl(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return El(this, r);
	};
}
function El(e, t) {
	if (t && (ml(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Dl(e);
}
function Dl(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Ol() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function kl(e) {
	return kl = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, kl(e);
}
var Al = /*#__PURE__*/ function(e) {
	Cl(n, e);
	var t = Tl(n);
	function n() {
		var e;
		return vl(this, n), e = t.call(this), e.d = ul(), e.i = 0, e.chunks = [], e;
	}
	return bl(n, [{
		key: "_transform",
		value: function(e, t, n) {
			if (this.d) {
				this.chunks.push(e);
				for (var r = hl(e), i; !(i = r()).done;) {
					var a = i.value;
					try {
						if (fl(a, this.d)) {
							this.d = void 0, e = Buffer.concat(this.chunks), this.chunks = void 0;
							break;
						}
					} catch (e) {
						return n(e);
					}
					this.i++;
				}
				if (this.d) return n();
			}
			this.push(e), n();
		}
	}, {
		key: "_flush",
		value: function(e) {
			if (this.d) try {
				pl(this.i);
			} catch (t) {
				return e(t);
			}
			e();
		}
	}]), n;
}(N), jl;
function Ml(e) {
	var t = Date.now();
	(typeof global < "u" ? global.READ_EXCEL_FILE_CHECKPOINTS : typeof window < "u" && window.READ_EXCEL_FILE_CHECKPOINTS) && (jl && console.log("  -", t - jl, "ms"), console.log("*", e)), jl = t;
}
function Nl() {
	jl = void 0;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/unpackXlsxFileNode.js
function Pl(e) {
	Nl(), Ml("unpack files");
	var t = nl(e);
	return new Promise(function(e, n) {
		Ic(t.on("error", n).pipe(new Al()), { filter: al }).then(e, function(e) {
			e instanceof kc ? n(new tl("INVALID_ZIP", e.cause)) : n(e);
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetInfo.js
function Fl(e, t) {
	var n = r();
	return t(e, n, a, null, null).then(function() {
		return i(n);
	});
	function r() {
		return {
			workbookPr: void 0,
			sheets: []
		};
	}
	function i(e) {
		return {
			epoch1904: e.workbookPr ? e.workbookPr.epoch1904 : !1,
			sheets: e.sheets
		};
	}
	function a(e, t, n) {
		e === "workbookPr" ? n.workbookPr ||= { epoch1904: t.date1904 === "1" } : e === "sheet" && t.name && n.sheets.push({
			id: Number(t.sheetId),
			name: t.name,
			relationId: t.id
		});
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseFilePaths.js
function Il(e, t) {
	var n = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/", r = "http://purl.oclc.org/ooxml/officeDocument/relationships/", i = a();
	return t(e, i, s, null, null).then(function() {
		return o(i);
	});
	function a() {
		return {
			sheets: {},
			sharedStrings: void 0,
			styles: void 0
		};
	}
	function o(e) {
		return e;
	}
	function s(e, t, n) {
		e === "Relationship" && c(n, t.Id, t.Type, t.Target);
	}
	function c(e, t, i, a) {
		switch (i) {
			case n + "styles":
			case r + "styles":
				e.styles = l(a);
				break;
			case n + "sharedStrings":
			case r + "sharedStrings":
				e.sharedStrings = l(a);
				break;
			case n + "worksheet":
			case r + "worksheet": e.sheets[t] = l(a);
		}
	}
	function l(e) {
		return e[0] === "/" ? e.slice(1) : "xl/" + e;
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseStyles.js
function Ll(e) {
	"@babel/helpers - typeof";
	return Ll = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ll(e);
}
var Rl = ["xfId"];
function zl(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Bl(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? zl(Object(n), !0).forEach(function(t) {
			Vl(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : zl(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Vl(e, t, n) {
	return t = Hl(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Hl(e) {
	var t = Ul(e, "string");
	return Ll(t) === "symbol" ? t : String(t);
}
function Ul(e, t) {
	if (Ll(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Ll(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Wl(e, t) {
	if (e == null) return {};
	var n = Gl(e, t), r, i;
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (i = 0; i < a.length; i++) r = a[i], !(t.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(e, r) && (n[r] = e[r]);
	}
	return n;
}
function Gl(e, t) {
	if (e == null) return {};
	for (var n = {}, r = Object.keys(e), i, a = 0; a < r.length; a++) i = r[a], !(t.indexOf(i) >= 0) && (n[i] = e[i]);
	return n;
}
function Kl(e, t) {
	var n = r();
	return t(e, n, a, o, null).then(function() {
		return i(n);
	});
	function r() {
		return {
			numberFormats: [],
			baseStyles: [],
			styles: [],
			cellStyleXfs: !1,
			cellXfs: !1
		};
	}
	function i(e) {
		return e.styles.map(function(t) {
			if (t.xfId) {
				var n = t.xfId, r = Wl(t, Rl);
				return Bl(Bl({}, e.baseStyles[n]), r);
			}
			return t;
		});
	}
	function a(e, t, n) {
		if (e === "numFmt") {
			var r = Number(t.numFmtId), i = { id: r };
			r >= 100 && (i.template = t.formatCode), n.numberFormats[r] = i;
		} else if (e === "cellStyleXfs") n.cellStyleXfs = !0;
		else if (e === "cellXfs") n.cellXfs = !0;
		else if (e === "xf") {
			if (n.cellStyleXfs) n.baseStyles.push(s(t));
			else if (n.cellXfs) {
				var a = s(t, n.numberFormats);
				t.xfId && (a.xfId = Number(t.xfId)), n.styles.push(a);
			}
		}
	}
	function o(e, t) {
		e === "cellStyleXfs" ? t.cellStyleXfs = !1 : e === "cellXfs" && (t.cellXfs = !1);
	}
	function s(e, t) {
		var n = {};
		if (e.numFmtId) {
			var r = Number(e.numFmtId);
			n.numberFormat = t && t[r] ? t[r] : { id: r };
		}
		return n;
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSharedStrings.js
function ql(e, t) {
	var n = r();
	return t(e, n, a, o, s).then(function() {
		return i(n);
	});
	function r() {
		return {
			si: void 0,
			strings: []
		};
	}
	function i(e) {
		return e.strings;
	}
	function a(e, t, n) {
		e === "si" ? n.si = c() : n.si && l(e, t, n.si);
	}
	function o(e, t) {
		e === "si" ? (t.strings.push(t.si.string), t.si = void 0) : t.si && u(e, t.si);
	}
	function s(e, t) {
		t.si && d(e, t.si);
	}
	function c() {
		return {
			t: !1,
			r: !1,
			rPh: !1,
			string: ""
		};
	}
	function l(e, t, n) {
		e === "t" ? n.t = !0 : e === "r" ? n.r = !0 : e === "rPh" && (n.rPh = !0);
	}
	function u(e, t) {
		e === "t" ? t.t = !1 : e === "r" ? t.r = !1 : e === "rPh" && (t.rPh = !1);
	}
	function d(e, t) {
		t.rPh || t.t && (t.r ? t.string += e : t.string = e);
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseExcelTimestamp.js
function Jl(e, t) {
	var n = 17, r = 1, i = 1, a = 864e5, o = 365;
	t && (e += 4 * o + r + i);
	var s = r + i + 70 * o + n;
	return Math.floor((e - s) * a);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormat.js
var Yl = /;@$/, Xl = /[^a-z0#\?%]+/;
function Zl(e, t, n) {
	var r = n[e];
	return r === void 0 ? n[e] = Ql(t) : r;
}
function Ql(e) {
	return e = e.toLowerCase(), e = e.replace(Yl, ""), e = e.replace(/\\./g, " "), e.split(";").some(t);
	function t(e) {
		e = e.replace(/"[^"]*"/g, " "), e = e.replace(/(\[?[smhd]{1,2}\]?)[\.\,]00?0?/g, "$1"), e = e.replace(/\[([smhd]{1,2})\]/g, "$1"), e = e.replace(/\[[^\]]*\]/g, "");
		var t = e.split(Xl).filter(function(e) {
			return e;
		});
		return t.length !== 0 && t.every(function(e) {
			return $l.indexOf(e) >= 0;
		});
	}
}
var $l = /* @__PURE__ */ "s.ss.m.mm.h.hh.am.pm.a.p.d.dd.ddd.dddd.aaa.aaaa.aaaaa.m.mm.mmm.mmmm.mmmmm.y.yy.yyyy.e.ee.eeee".split(".");
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormatStyle.js
function eu(e, t, n, r) {
	return e.numberFormat ? !!(iu.indexOf(e.numberFormat.id) >= 0 || t && e.numberFormat.template === t || n && e.numberFormat.template && Zl(e.numberFormat.id, e.numberFormat.template, r)) : !1;
}
var tu = [
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
], nu = [
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
], ru = [
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
], iu = tu.concat(nu).concat(ru.filter(function(e) {
	return nu.indexOf(e) < 0;
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
].filter(function(e) {
	return nu.indexOf(e) < 0;
}).filter(function(e) {
	return ru.indexOf(e) < 0;
}));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCell.js
function au(e, t) {
	return uu(e) || lu(e, t) || su(e, t) || ou();
}
function ou() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function su(e, t) {
	if (e) {
		if (typeof e == "string") return cu(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return cu(e, t);
	}
}
function cu(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function lu(e, t) {
	var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n != null) {
		var r, i, a, o, s = [], c = !0, l = !1;
		try {
			if (a = (n = n.call(e)).next, t === 0) {
				if (Object(n) !== n) return;
				c = !1;
			} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
		} catch (e) {
			l = !0, i = e;
		} finally {
			try {
				if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
			} finally {
				if (l) throw i;
			}
		}
		return s;
	}
}
function uu(e) {
	if (Array.isArray(e)) return e;
}
var du = [null, null];
function fu(e, t, n, r, i) {
	var a = au(i, 7), o = a[0], s = a[1], c = a[2], l = a[3], u = a[4], d = a[5], f = a[6];
	switch (e || "n") {
		case "str": return n === void 0 ? "VALUE_MISSING" : n ? ["s", n] : du;
		case "inlineStr": return r === void 0 ? "VALUE_MISSING" : ["s", r];
		case "s":
			if (!n) return "VALUE_MISSING";
			var p = Number(n);
			return isNaN(p) || o[p] === void 0 ? "VALUE_INVALID" : ["s", o[p]];
		case "b": return n ? n === "1" ? ["b", !0] : n === "0" ? ["b", !1] : "VALUE_INVALID" : "VALUE_MISSING";
		case "e": return n ? ["e", n] : "VALUE_MISSING";
		case "d":
			if (!n) return du;
			var m = new Date(n);
			return isNaN(m.valueOf()) ? "VALUE_INVALID" : ["d", m.getTime()];
		case "n":
			if (!n) return du;
			if (t) {
				var h = Number(t);
				if (isNaN(h) || s[h] === void 0) return "FORMAT_INVALID";
				if (eu(s[h], u, d, l)) {
					var g = Number(n);
					return isNaN(g) ? "VALUE_INVALID" : ["d", Jl(g, c)];
				}
			}
			if (f) return ["n", n];
			var _ = Number(n);
			return isNaN(_) ? "VALUE_INVALID" : ["n", _];
		default: return "TYPE_INVALID";
	}
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCellAddress.js
function pu(e) {
	for (var t = 0, n = 0; n < e.length;) {
		var r = e.charCodeAt(n);
		if (r >= 48 && r <= 57) {
			var i = Number(e.slice(n));
			return isNaN(i) && mu(e), [i, t];
		}
		t *= 26, t += e.charCodeAt(n) - 64, n++;
	}
	mu(e);
}
function mu(e) {
	throw Error(`<c r="${e}">`);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSheet.js
function hu(e, t) {
	return vu(e) || _u(e, t) || bu(e, t) || gu();
}
function gu() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _u(e, t) {
	var n = e == null ? null : typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n != null) {
		var r, i, a, o, s = [], c = !0, l = !1;
		try {
			if (a = (n = n.call(e)).next, t === 0) {
				if (Object(n) !== n) return;
				c = !1;
			} else for (; !(c = (r = a.call(n)).done) && (s.push(r.value), s.length !== t); c = !0);
		} catch (e) {
			l = !0, i = e;
		} finally {
			try {
				if (!c && n.return != null && (o = n.return(), Object(o) !== o)) return;
			} finally {
				if (l) throw i;
			}
		}
		return s;
	}
}
function vu(e) {
	if (Array.isArray(e)) return e;
}
function yu(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = bu(e)) || t && e && typeof e.length == "number") {
		n && (e = n);
		var r = 0;
		return function() {
			return r >= e.length ? { done: !0 } : {
				done: !1,
				value: e[r++]
			};
		};
	}
	throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function bu(e, t) {
	if (e) {
		if (typeof e == "string") return xu(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return xu(e, t);
	}
}
function xu(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
var Su = null;
function Cu(e, t, n) {
	var r = n.sharedStrings, i = n.styles, a = n.epoch1904, o = n.dateFormatDetectionCache, s = n.options, c = [
		r,
		i,
		a,
		o,
		s.dateFormat,
		s.smartDateParser !== !1,
		s.parseNumber
	], l = [], u = [], d = f();
	return t(e, d, y, b, x, v).then(function() {
		var e = d.sheetData, t = e.rowCount, n = e.columnCount, r = e.dataRowCount, i = e.dataColumnCount;
		if (r < t && (l = l.slice(0, r)), i < n) for (var a = 0; a < l.length;) l[a].length > i && (l[a] = l[a].slice(0, i)), a++;
		for (var o = yu(l), s; !(s = o()).done;) for (var c = s.value; c.length < i;) c.push(Su);
		return l;
	});
	function f() {
		return {
			dimension: void 0,
			sheetData: void 0
		};
	}
	function p(e) {
		return e.sheetData.rows;
	}
	function m(e, t) {
		e.sheetData.rowIndexShift += e.sheetData.rows.length - t.length, e.sheetData.rows = t;
	}
	function h(e) {
		return e.sheetData.errors;
	}
	function g(e, t) {
		e.sheetData.errors = t;
	}
	function _(e) {
		var t = e.row, n = e.column, r = e.error;
		throw new Is(`<c/> at row ${t}, col ${n}: ${r}`);
	}
	function v(e) {
		if (d.sheetData) {
			var t = p(d), n = h(d);
			if (e) l = l.concat(t), u = u.concat(n), u.length > 0 && _(u[0]);
			else if (t.length > 1) {
				var r = t.slice(0, -1);
				l = l.concat(r), u = u.concat(n), m(d, t.slice(-1)), g(d, []);
			}
		}
	}
	function y(e, t, n) {
		e === "dimension" ? n.dimension = ee(t.ref) : e === "sheetData" ? n.sheetData = S() : n.sheetData && C(e, t, n.sheetData);
	}
	function b(e, t) {
		t.sheetData && w(e, t.sheetData);
	}
	function x(e, t) {
		t.sheetData && T(e, t.sheetData);
	}
	function ee(e) {
		var t = e.split(":").map(pu);
		return t.length === 1 && (t = [t[0], t[0]]), t;
	}
	function S() {
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
	function C(e, t, n) {
		e === "row" ? (t.r && (n.rowNumber = Number(t.r)), n.row = []) : e === "c" ? (n.c = te(), n.c.attributes = t) : n.c && A(e, t, n.c);
	}
	function w(e, t) {
		if (e === "row") {
			if (t.rowNumber) {
				var n = t.rowIndexShift + t.rows.length;
				if (t.rowNumber <= n) throw new Is(`Out-of-place <row/> number ${t.rowNumber} follows <row/> number ${n}`);
				for (; t.rowNumber > t.rowIndexShift + t.rows.length + 1;) t.rows.push([]);
			}
			t.rows.push(t.row), t.row.length > 0 && (t.dataRowCount = t.rowNumber), t.rowNumber > t.rowCount && (t.rowCount = t.rowNumber), t.row = void 0, t.rowNumber = void 0;
		} else if (e === "c") {
			var r = E(t.c);
			if (r.row < t.cursor[0] || r.row === t.cursor[0] && r.column <= t.cursor[1]) throw new Is(`Out-of-place <c/> at row ${r.row} col ${r.column} follows <c/> at row ${t.cursor[0]} col ${t.cursor[1]}`);
			if (t.cursor[0] = r.row, t.cursor[1] = r.column, t.rowNumber ||= r.row, r.error) j && _(r), t.errors.push(r);
			else if (r.value !== Su) {
				for (; r.column > t.row.length + 1;) t.row.push(Su);
				t.row.push(r.value), r.column > t.dataColumnCount && (t.dataColumnCount = r.column);
			}
			r.column > t.columnCount && (t.columnCount = r.column), t.c = void 0;
		} else t.c && ne(e, t.c);
	}
	function T(e, t) {
		t.c && re(e, t.c);
	}
	function E(e) {
		var t = e.attributes, n = e.inlineString, r = e.vText, i = hu(pu(t.r), 2), a = i[0], o = i[1], l = D(t.t, t.s, r, n, c, s.trim !== !1);
		return typeof l == "string" ? {
			row: a,
			column: o,
			error: l
		} : {
			row: a,
			column: o,
			value: k(l[1], l[0])
		};
	}
	function D(e, t, n, r, i, a) {
		var o = O(e, t, n, r, i);
		return Array.isArray(o) && o[0] === "s" && (a && (o[1] = o[1].trim()), o[1] === "") ? du : o;
	}
	function O(e, t, n, r, i) {
		var a = fu(e, t, n, r, i);
		if (a === "VALUE_MISSING") switch (e || "n") {
			case "str":
			case "inlineStr":
			case "s":
			case "b": return du;
		}
		return e === "e" ? du : a;
	}
	function k(e, t) {
		return t === "n" ? s.parseNumber ? s.parseNumber(e) : e : t === "d" ? new Date(e) : e;
	}
	function te() {
		return {
			v: !1,
			is: !1,
			t: !1,
			r: !1,
			rPh: !1,
			vText: void 0,
			inlineString: void 0,
			attributes: void 0
		};
	}
	function A(e, t, n) {
		e === "v" ? n.v = !0 : e === "is" ? (n.is = !0, n.inlineString = "") : e === "t" ? n.t = !0 : e === "r" ? n.r = !0 : e === "rPh" && (n.rPh = !0);
	}
	function ne(e, t) {
		e === "v" ? (t.v = !1, t.vText ||= "") : e === "is" ? t.is = !1 : e === "t" ? t.t = !1 : e === "r" ? t.r = !1 : e === "rPh" && (t.rPh = !1);
	}
	function re(e, t) {
		t.v ? t.vText = e : t.is && (t.rPh || t.t && (t.r ? t.inlineString += e : t.inlineString = e));
	}
	var j;
}
//#endregion
//#region node_modules/fflate/esm/index.mjs
var wu = P("/"), Tu;
try {
	Tu = wu("worker_threads"), Tu.Worker, Tu.isMarkedAsUntransferable;
} catch {}
var Eu = Uint8Array, Du = Uint16Array, Ou = Int32Array, ku = new Eu([
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
]), Au = new Eu([
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
new Eu([
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
var ju = function(e, t) {
	for (var n = new Du(31), r = 0; r < 31; ++r) n[r] = t += 1 << e[r - 1];
	for (var i = new Ou(n[30]), r = 1; r < 30; ++r) for (var a = n[r]; a < n[r + 1]; ++a) i[a] = a - n[r] << 5 | r;
	return {
		b: n,
		r: i
	};
}, Tu = ju(ku, 2), Mu = Tu.b, Nu = Tu.r;
Mu[28] = 258, Nu[258] = 28;
var Pu = ju(Au, 0);
Pu.b, Pu.r;
for (var Fu = new Du(32768), X = 0; X < 32768; ++X) {
	var Iu = (X & 43690) >> 1 | (X & 21845) << 1;
	Iu = (Iu & 52428) >> 2 | (Iu & 13107) << 2, Iu = (Iu & 61680) >> 4 | (Iu & 3855) << 4, Fu[X] = ((Iu & 65280) >> 8 | (Iu & 255) << 8) >> 1;
}
for (var Lu = new Eu(288), X = 0; X < 144; ++X) Lu[X] = 8;
for (var X = 144; X < 256; ++X) Lu[X] = 9;
for (var X = 256; X < 280; ++X) Lu[X] = 7;
for (var X = 280; X < 288; ++X) Lu[X] = 8;
for (var Ru = new Eu(32), X = 0; X < 32; ++X) Ru[X] = 5;
var zu = function(e, t, n) {
	return (t == null || t < 0) && (t = 0), (n == null || n > e.length) && (n = e.length), new Eu(e.subarray(t, n));
}, Bu = [
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
], Vu = function(e, t, n) {
	var r = Error(t || Bu[e]);
	if (r.code = e, Error.captureStackTrace && Error.captureStackTrace(r, Vu), !n) throw r;
	return r;
}, Hu = /*#__PURE__*/ new Eu(0), Uu = typeof TextDecoder < "u" && /*#__PURE__*/ new TextDecoder();
try {
	Uu.decode(Hu, { stream: !0 });
} catch {}
var Wu = function(e) {
	for (var t = "", n = 0;;) {
		var r = e[n++], i = (r > 127) + (r > 223) + (r > 239);
		if (n + i > e.length) return {
			s: t,
			r: zu(e, n - 1)
		};
		i ? i == 3 ? (r = ((r & 15) << 18 | (e[n++] & 63) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) - 65536, t += String.fromCharCode(55296 | r >> 10, 56320 | r & 1023)) : i & 1 ? t += String.fromCharCode((r & 31) << 6 | e[n++] & 63) : t += String.fromCharCode((r & 15) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) : t += String.fromCharCode(r);
	}
};
function Gu(e, t) {
	if (t) {
		for (var n = "", r = 0; r < e.length; r += 16384) n += String.fromCharCode.apply(null, e.subarray(r, r + 16384));
		return n;
	}
	if (Uu) return Uu.decode(e);
	var i = Wu(e), a = i.s, n = i.r;
	return n.length && Vu(8), a;
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/convertValuesFromUint8ArraysToStrings.js
function Ku(e) {
	Ml("convert files to strings");
	for (var t = {}, n = 0, r = Object.keys(e); n < r.length; n++) {
		var i = r[n];
		t[i] = qu(e[i]);
	}
	return t;
}
function qu(e) {
	return typeof TextDecoder < "u" ? new TextDecoder().decode(e) : Gu(e);
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/isPromise.js
function Ju(e) {
	"@babel/helpers - typeof";
	return Ju = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ju(e);
}
function Yu(e) {
	return Ju(e) === "object" && typeof e.then == "function";
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/SheetNotFoundError.js
function Xu(e) {
	"@babel/helpers - typeof";
	return Xu = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Xu(e);
}
function Zu(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, $u(r.key), r);
	}
}
function Qu(e, t, n) {
	return t && Zu(e.prototype, t), n && Zu(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function $u(e) {
	var t = ed(e, "string");
	return Xu(t) === "symbol" ? t : String(t);
}
function ed(e, t) {
	if (Xu(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Xu(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function td(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function nd(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && ud(e, t);
}
function rd(e) {
	var t = cd();
	return function() {
		var n = dd(e), r;
		if (t) {
			var i = dd(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return id(this, r);
	};
}
function id(e, t) {
	if (t && (Xu(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return ad(e);
}
function ad(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function od(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return od = function(e) {
		if (e === null || !ld(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return sd(e, arguments, dd(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), ud(n, e);
	}, od(e);
}
function sd(e, t, n) {
	return sd = cd() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && ud(i, n.prototype), i;
	}, sd.apply(null, arguments);
}
function cd() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function ld(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function ud(e, t) {
	return ud = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, ud(e, t);
}
function dd(e) {
	return dd = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, dd(e);
}
var fd = /*#__PURE__*/ function(e) {
	nd(n, e);
	var t = rd(n);
	function n(e, r) {
		var i;
		return td(this, n), i = t.call(this, `Sheet not found: ${typeof e == "number" ? e + ". Sheet count: " + r.length : e + ". Available sheets: " + r.join(", ")}`), i.name = "SheetNotFoundError", i.sheet = e, i.sheets = r, i;
	}
	return Qu(n);
}(/*#__PURE__*/ od(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetContents.js
function pd(e) {
	"@babel/helpers - typeof";
	return pd = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, pd(e);
}
function md(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = hd(e)) || t && e && typeof e.length == "number") {
		n && (e = n);
		var r = 0;
		return function() {
			return r >= e.length ? { done: !0 } : {
				done: !1,
				value: e[r++]
			};
		};
	}
	throw TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function hd(e, t) {
	if (e) {
		if (typeof e == "string") return gd(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return gd(e, t);
	}
}
function gd(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function _d(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function vd(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? _d(Object(n), !0).forEach(function(t) {
			yd(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : _d(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function yd(e, t, n) {
	return t = bd(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function bd(e) {
	var t = xd(e, "string");
	return pd(t) === "symbol" ? t : String(t);
}
function xd(e, t) {
	if (pd(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (pd(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Sd(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = Ku(t);
	return Ml("parse spreadsheet info and file paths"), kd(Ed(), r, e).then(function(t) {
		var i = t.spreadsheetInfo, a = t.filePaths;
		return Ml("parse \"shared strings\" and \"styles\""), kd(Dd(a), r, e).then(function(t) {
			var o = t.sharedStrings, s = t.styles, c = n.sheets ? n.sheets.map(function(e) {
				return wd(e, i.sheets);
			}) : i.sheets.map(function(e) {
				return e.relationId;
			});
			return Ml(`parse sheet${c.length === 1 ? "" : "s"} data`), kd(Od(a, c, {
				sharedStrings: o,
				styles: s,
				epoch1904: i.epoch1904,
				dateFormatDetectionCache: [],
				options: n
			}), r, e).then(function(e) {
				return Ml("end"), c.map(function(t) {
					return {
						sheet: Td(t, i.sheets),
						data: e[t]
					};
				});
			});
		});
	});
}
function Cd(e, t, n, r) {
	return r && r.parseNumber || (r = vd(vd({}, r), {}, { parseNumber: null })), Sd(t, n, r);
}
function wd(e, t) {
	if (typeof e == "string") for (var n = md(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.name === e) return i.relationId;
	}
	else if (e <= t.length) return t[e - 1].relationId;
	throw new fd(e, t.map(function(e) {
		return e.name;
	}));
}
function Td(e, t) {
	for (var n = md(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.relationId === e) return i.name;
	}
	throw Error(`Sheet relation ID not found: ${e}`);
}
function Ed() {
	return {
		"xl/_rels/workbook.xml.rels": {
			name: "filePaths",
			parse: Il
		},
		"xl/workbook.xml": {
			name: "spreadsheetInfo",
			parse: Fl
		}
	};
}
function Dd(e) {
	var t = {};
	return yd(t, e.sharedStrings || "xl/sharedStrings.xml", {
		name: "sharedStrings",
		parse: ql,
		fallback: Promise.resolve([])
	}), yd(t, e.styles || "xl/styles.xml", {
		name: "styles",
		parse: Kl,
		fallback: {}
	}), t;
}
function Od(e, t, n) {
	return Object.keys(e.sheets).filter(function(e) {
		return t.includes(e);
	}).reduce(function(t, r) {
		return vd(vd({}, t), {}, yd({}, e.sheets[r], {
			name: r,
			parse: function(e, t) {
				return Cu(e, t, n);
			}
		}));
	}, {});
}
function kd(e, t, n) {
	for (var r = {}, i = function() {
		var i = o[a], s = e[i];
		r[s.name] = t[i] === void 0 ? s.fallback === void 0 ? function() {
			throw new Is(`"${i}" file not found inside the \`.xlsx\` file`);
		}() : s.fallback : s.parse(t[i], n);
	}, a = 0, o = Object.keys(e); a < o.length; a++) i();
	for (var s = [], c = function() {
		var e = u[l];
		Yu(r[e]) && s.push(r[e].then(function(t) {
			r[e] = t;
		}));
	}, l = 0, u = Object.keys(r); l < u.length; l++) c();
	return s.length > 0 ? Promise.all(s).then(function() {
		return r;
	}) : r;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/readXlsxFileNode.js
function Ad(e, t) {
	return Pl(e).then(function(e) {
		return Cd(hs, Ls, e, t);
	});
}
//#endregion
//#region electron/main/import/legacy_excel.ts
var Z = {
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
}, jd = "feligres", Md = "parroquialibros", Nd = [
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
], Pd = [
	"COD PARROQUIA",
	"TIPO DE LIBRO",
	"NUM LIBRO",
	"NOMBRE DE LIBRO",
	"RANGO DE AÑOS DEL LIBRO"
], Fd = {
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	nombre_libro: 3
}, Id = class extends Error {}, Ld = {
	B: "bautismo",
	C: "confirmacion",
	M: "matrimonio"
};
function Rd(e, t) {
	return `${e.trim().toUpperCase()}|${t.trim()}`;
}
function Q(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" || /^-+$/.test(t) ? null : t;
}
function zd(e) {
	return String(e).padStart(2, "0");
}
function Bd(e) {
	if (e instanceof Date && !Number.isNaN(e.getTime())) return `${e.getUTCFullYear()}-${zd(e.getUTCMonth() + 1)}-${zd(e.getUTCDate())}`;
	let t = Q(e);
	if (!t) return null;
	let n = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
	if (n) return `${n[1]}-${n[2]}-${n[3]}`;
	let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
	return r ? `${r[3]}-${zd(Number(r[2]))}-${zd(Number(r[1]))}` : null;
}
function Vd(e) {
	let t = Bd(e);
	return t ? {
		date: t,
		text: null
	} : {
		date: null,
		text: Q(e)
	};
}
var Hd = [
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
function Ud(e) {
	return /\.$/.test(e) ? !0 : Hd.includes(e.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
}
function Wd(e) {
	let t = Q(e);
	if (!t) return null;
	let n = t.split(/\s+/), r = null;
	return n.length > 1 && Ud(n[0]) && (r = n.shift()), n.length === 1 ? {
		titulo: r,
		nombre: n[0],
		apellido_paterno: "",
		apellido_materno: ""
	} : n.length === 2 ? {
		titulo: r,
		nombre: n[0],
		apellido_paterno: n[1],
		apellido_materno: ""
	} : {
		titulo: r,
		nombre: n.slice(0, -2).join(" "),
		apellido_paterno: n[n.length - 2],
		apellido_materno: n[n.length - 1]
	};
}
function Gd(e) {
	let t = e[Z.codigo_parroquia];
	return typeof t == "string" && !/^\d+$/.test(t.trim());
}
function Kd(e) {
	return String(e ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function qd(e, t, n) {
	if (e.length === 0) throw new Id(`La hoja "${t}" está vacía.`);
	let r = [];
	return e.forEach((e, i) => {
		if (e.length !== n.length) throw new Id(`La hoja "${t}" debe tener ${n.length} columnas y tiene ${e.length}. El archivo no es el exportado por el sistema anterior.`);
		if (i === 0 && Gd(e)) {
			n.forEach((n, r) => {
				if (Kd(e[r]) !== Kd(n)) throw new Id(`El encabezado de la hoja "${t}" no es el del sistema anterior: la columna ${r + 1} dice "${e[r] ?? ""}" y debería decir "${n ?? ""}".`);
			});
			return;
		}
		e.every((e) => Q(e) === null) || r.push({
			row: e,
			fila: i + 1
		});
	}), r;
}
function Jd(e, t, n, r, i) {
	let a = Q(e[t]);
	if (!a || !/^\d+$/.test(a)) throw new Id(`La fila ${r} de la hoja "${n}" no tiene un código de parroquia válido.`);
	if (i !== null && a !== i) throw new Id(`El archivo trae partidas de más de una parroquia (códigos ${i} y ${a}). Debe ser el de una sola parroquia.`);
	return a;
}
function Yd(e, t, n, r) {
	let i = String(e[t] ?? "").trim().toUpperCase();
	if (!Ld[i]) throw new Id(`En la fila ${r} de la hoja "${n}" el tipo de libro no es B, C ni M: las columnas no son las del sistema anterior.`);
	return i;
}
function Xd(e) {
	let t = /* @__PURE__ */ new Map(), n = null;
	for (let { row: r, fila: i } of qd(e, Md, Pd)) {
		n = Jd(r, Fd.codigo_parroquia, Md, i, n);
		let e = Yd(r, Fd.tipo_libro, Md, i), a = Q(r[Fd.num_libro]);
		if (!a) throw new Id(`La fila ${i} de la hoja "${Md}" no tiene el número del libro.`);
		t.set(Rd(e, a), Q(r[Fd.nombre_libro]) ?? a);
	}
	return {
		codigo_parroquia: n,
		libros: t
	};
}
function Zd(e, t) {
	let n = Vd(e[t.fecha_nacimiento]), r = Q(e[t.fecha_aproximada]);
	return {
		dni: Q(e[t.dni]),
		nombres: Q(e[t.nombres]) ?? "",
		apellido_paterno: Q(e[t.apellido_paterno]) ?? "",
		apellido_materno: Q(e[t.apellido_materno]) ?? "",
		fecha_nacimiento: n.date,
		fecha_aproximada: r ?? n.text,
		lugar_nacimiento: Q(e[t.lugar_nacimiento]),
		padre: Q(e[t.padre]),
		madre: Q(e[t.madre])
	};
}
var Qd = {
	dni: Z.dni,
	nombres: Z.nombres,
	apellido_paterno: Z.apellido_paterno,
	apellido_materno: Z.apellido_materno,
	fecha_nacimiento: Z.fecha_nacimiento,
	fecha_aproximada: Z.fecha_nacimiento_aprox,
	lugar_nacimiento: Z.lugar_nacimiento,
	padre: Z.padre,
	madre: Z.madre
}, $d = {
	dni: Z.novia_dni,
	nombres: Z.novia_nombres,
	apellido_paterno: Z.novia_apellido_paterno,
	apellido_materno: Z.novia_apellido_materno,
	fecha_nacimiento: Z.novia_fecha_nacimiento,
	fecha_aproximada: Z.novia_fecha_nacimiento_aprox,
	lugar_nacimiento: Z.novia_lugar_nacimiento,
	padre: Z.novia_padre,
	madre: Z.novia_madre
};
function ef(e, t) {
	let n = [], r = Q(e[Z.anotacion_marginal]);
	return r && r.toUpperCase() !== "NINGUNA" && n.push(r), n.push(...t), n.length === 0 ? null : n.join("\n");
}
function tf(e, t, n) {
	let r = String(e[Z.tipo_libro] ?? "").trim().toUpperCase(), i = Ld[r];
	if (!i) return {
		fila: t,
		motivo: "El tipo de libro no es B, C ni M."
	};
	let a = Q(e[Z.num_libro]), o = Q(e[Z.folio]), s = Q(e[Z.numero_registro]);
	if (!a || !o || !s) return {
		fila: t,
		motivo: "Falta el libro, el folio o el número de registro."
	};
	let c = n.get(Rd(r, a));
	if (!c) return {
		fila: t,
		motivo: `El libro ${r} ${a} no está en la hoja "${Md}".`
	};
	let l = Zd(e, Qd), u = [], d = Vd(e[Z.fecha_sacramento]), f = Q(e[Z.fecha_sacramento_aprox]) ?? d.text;
	!d.date && f && u.push(`Fecha aproximada del sacramento: ${f}`);
	let p = [l], m = {
		padrino_1: Q(e[Z.padrino]),
		padrino_2: Q(e[Z.madrina])
	};
	if (i === "matrimonio") {
		let t = Zd(e, $d);
		p.push(t);
		let n = Vd(e[Z.fecha_bautizo_novio]), r = Vd(e[Z.fecha_bautizo_novia]), i = Q(e[Z.fecha_bautizo_novio_aprox]) ?? n.text, a = Q(e[Z.fecha_bautizo_novia_aprox]) ?? r.text;
		!n.date && i && u.push(`Fecha aproximada del bautizo del esposo: ${i}`), !r.date && a && u.push(`Fecha aproximada del bautizo de la esposa: ${a}`), m = {
			lugar: Q(e[Z.lugar_matrimonio]),
			testigo_1: Q(e[Z.padrino]),
			testigo_2: Q(e[Z.madrina]),
			testigo_3: Q(e[Z.testigo_3]),
			testigo_4: Q(e[Z.testigo_4]),
			conyuge_1_bautismo_parroquia: Q(e[Z.parroquia_bautizo_novio]),
			conyuge_1_bautismo_fecha: n.date,
			conyuge_2_bautismo_parroquia: Q(e[Z.parroquia_bautizo_novia]),
			conyuge_2_bautismo_fecha: r.date
		};
	}
	return {
		fila: t,
		codigo_parroquia: Q(e[Z.codigo_parroquia]),
		tipo: i,
		libro: c,
		folio: o,
		numero: s,
		fecha_emision: d.date,
		fecha_evento: d.date,
		anotaciones: ef(e, u),
		celebrante: Wd(e[Z.celebrante]),
		personas: p,
		detalle: m
	};
}
function nf(e) {
	return [
		e.tipo,
		e.libro,
		e.folio,
		e.numero
	].map((e) => e.trim().toUpperCase()).join("|");
}
function rf(e, t) {
	let n = [], r = [], i = /* @__PURE__ */ new Map(), a = qd(e, jd, Nd), o = t.codigo_parroquia;
	for (let { row: e, fila: t } of a) o = Jd(e, Z.codigo_parroquia, jd, t, o), Yd(e, Z.tipo_libro, jd, t);
	for (let { row: e, fila: o } of a) {
		let a = tf(e, o, t.libros);
		if ("motivo" in a) {
			r.push(a);
			continue;
		}
		let s = nf(a), c = i.get(s);
		if (c !== void 0) {
			r.push({
				fila: o,
				motivo: `Repite la partida de la fila ${c}.`
			});
			continue;
		}
		i.set(s, o), n.push(a);
	}
	return {
		partidas: n,
		errores: r
	};
}
function af(e, t) {
	let n = e.find((e) => e.sheet.trim().toLowerCase() === t);
	if (!n) throw new Id(`El archivo no tiene la hoja "${t}". Debe ser el Excel exportado por el sistema anterior, sin cambios.`);
	return n.data;
}
function of(e) {
	let t = Xd(af(e, Md));
	return rf(af(e, jd), t);
}
//#endregion
//#region electron/main/controllers/legacy_import.ts
var sf = "Solo el administrador de la parroquia puede importar partidas.";
function cf(e) {
	if (e.role !== "admin_parroquia" || !e.parish_id) throw new z(sf, 403);
	return e.parish_id;
}
function lf(e) {
	return [
		e.nombres,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" ");
}
function uf(e, t, n) {
	let r = e.prepare("SELECT tipo, libro, folio, numero FROM sacramentos WHERE parroquia_id = ?").all(t), i = new Set(r.map(nf)), a = {
		nuevas: [],
		existentes: [],
		errores: n.errores
	};
	for (let e of n.partidas) {
		if (!i.has(nf(e))) {
			a.nuevas.push(e);
			continue;
		}
		a.existentes.push({
			fila: e.fila,
			tipo: e.tipo,
			libro: e.libro,
			folio: e.folio,
			numero: e.numero,
			nombre: e.personas.map(lf).join(" y ")
		});
	}
	return a;
}
function df(e) {
	return e.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function ff(e) {
	return df([
		e.nombre,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" "));
}
function pf(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = e.prepare("SELECT id, nombre, apellido_paterno, apellido_materno FROM ministros WHERE parroquia_id = ?").all(n);
	for (let e of i) r.set(ff(e), e.id);
	let a = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)");
	return (i) => {
		if (!i) return null;
		let o = ff(i), s = r.get(o);
		if (s !== void 0) return s;
		let c = crypto.randomUUID();
		dt(e, "ministro", c, null);
		let l = Number(a.run(c, n, i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno).lastInsertRowid);
		return tr(e, t, "ministro", c, n, "creado", "Desde el Excel del sistema anterior"), r.set(o, l), l;
	};
}
function mf(e) {
	return {
		...e,
		cambios: []
	};
}
function hf(e, t, n, r, i) {
	let a = r.personas.map((t) => et(e, n, mf(t))), o = {
		tipo: r.tipo,
		ministro_id: i,
		libro: r.libro,
		folio: r.folio,
		numero: r.numero,
		fecha_emision: r.fecha_emision,
		fecha_evento: r.fecha_evento,
		anotaciones: r.anotaciones
	}, s = crypto.randomUUID();
	dt(e, r.tipo, s, null);
	let c = Ot(e, s, r.tipo, n, o);
	U(e, c, t.user_id, "importada", [], `Fila ${r.fila} del Excel del sistema anterior`);
	let l = r.detalle;
	if (r.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(c, a[0], a[1], l.lugar, l.testigo_1, l.testigo_2, l.testigo_3, l.testigo_4, l.conyuge_1_bautismo_parroquia, l.conyuge_1_bautismo_fecha, l.conyuge_2_bautismo_parroquia, l.conyuge_2_bautismo_fecha);
		return;
	}
	e.prepare(`INSERT INTO ${vt(r.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(c, a[0], l.padrino_1, l.padrino_2);
}
function gf(e, t, n) {
	let r = cf(t);
	return e.transaction(() => {
		let i = uf(e, r, {
			partidas: n,
			errores: []
		}), a = pf(e, t, r);
		for (let n of i.nuevas) hf(e, t, r, n, a(n.celebrante));
		return {
			importadas: i.nuevas.length,
			omitidas: i.existentes.length
		};
	})();
}
var _f = null;
async function vf(e) {
	let t;
	try {
		t = await Ad(e);
	} catch {
		throw new z("No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) exportado del sistema anterior.", 400);
	}
	try {
		return of(t);
	} catch (e) {
		throw e instanceof Id ? new z(e.message, 400) : e;
	}
}
function yf(e, t) {
	let n = {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
	for (let e of t.nuevas) n[e.tipo] += 1;
	let r = /* @__PURE__ */ new Set();
	for (let e of [...t.nuevas]) e.codigo_parroquia && r.add(e.codigo_parroquia);
	return {
		archivo: e,
		codigos_parroquia: [...r],
		total: t.nuevas.length + t.existentes.length,
		nuevas: t.nuevas.length,
		por_tipo: n,
		existentes: t.existentes,
		errores: t.errores
	};
}
var bf = {
	"legacyImport.preview": async (e, { db: n, session: i }) => {
		let a = cf(i), o = t.getFocusedWindow(), s = {
			title: "Elegir el Excel del sistema anterior",
			properties: ["openFile"],
			filters: [{
				name: "Excel",
				extensions: ["xlsx"]
			}]
		}, c = o ? await r.showOpenDialog(o, s) : await r.showOpenDialog(s);
		if (c.canceled || c.filePaths.length === 0) return { cancelado: !0 };
		let l = c.filePaths[0], u = uf(n, a, await vf(l));
		return _f = {
			token: crypto.randomUUID(),
			parish_id: a,
			records: u.nuevas
		}, {
			cancelado: !1,
			token: _f.token,
			...yf(l.split(/[\\/]/).pop() ?? l, u)
		};
	},
	"legacyImport.confirm": (e, { db: t, session: n }) => {
		if (!_f || e?.token !== _f.token || _f.parish_id !== n.parish_id) throw new z("Vuelva a elegir el archivo: la vista previa ya no es válida.", 409);
		let r = _f.records;
		return _f = null, gf(t, n, r);
	}
}, xf = "Ministro no encontrado.", Sf = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function Cf(e) {
	let t = B(e?.nombre);
	if (!t) throw new z("El nombre del ministro es requerido.", 400);
	return {
		titulo: B(e.titulo),
		nombre: t,
		apellido_paterno: B(e.apellido_paterno) ?? "",
		apellido_materno: B(e.apellido_materno) ?? ""
	};
}
function wf(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(n);
	if (!r) throw new z(xf, 404);
	Xe(t, r.parroquia_id, "No tiene permiso para modificar ministros de otra parroquia.", "Solo el administrador de la parroquia puede modificar ministros.");
}
function Tf(e, t) {
	let n = e.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(t);
	dt(e, "ministro", n.client_id, n.version);
}
function Ef(e, t) {
	let n = [], r = [];
	t.nombres && (n.push("nombre LIKE ?"), r.push(`%${t.nombres}%`)), t.apellido_paterno && (n.push("apellido_paterno LIKE ?"), r.push(`%${t.apellido_paterno}%`)), t.apellido_materno && (n.push("apellido_materno LIKE ?"), r.push(`%${t.apellido_materno}%`));
	let i = (B(t.texto) ?? "").split(/\s+/).filter(Boolean);
	for (let e of i) n.push("(COALESCE(titulo, '') || ' ' || nombre || ' ' || apellido_paterno || ' ' || apellido_materno) LIKE ?"), r.push(`%${e}%`);
	Number.isInteger(t.parroquia_id) && (n.push("parroquia_id = ?"), r.push(t.parroquia_id));
	let a = "";
	n.length > 0 && (a = "WHERE " + n.join(" AND "));
	let o = Ee(t, e.prepare(`SELECT COUNT(*) AS total FROM ministros ${a}`).get(...r).total), s = Sf[t.orden ?? "nombres"] ?? Sf.nombres;
	return {
		resultados: e.prepare(`SELECT id FROM ministros ${a}
			 ORDER BY ${s} ${De(t)}, id
			 LIMIT ? OFFSET ?`).pluck().all(...r, 20, o.offset).map((t) => gt(e, t)),
		total_paginas: o.total_pages
	};
}
function Df(e, t, n) {
	let r = qe(t), i = Cf(n), a = crypto.randomUUID();
	return e.transaction(() => {
		dt(e, "ministro", a, null);
		let n = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)").run(a, r, i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno);
		return tr(e, t, "ministro", a, r, "creado"), Number(n.lastInsertRowid);
	})();
}
function Of(e, t, n) {
	let r = V(n?.id, xf);
	wf(e, t, r);
	let i = Cf(n), a = e.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE id = ?").get(r), o = er([
		{
			label: "Título",
			before: a.titulo,
			after: i.titulo
		},
		{
			label: "Nombre",
			before: a.nombre,
			after: i.nombre
		},
		{
			label: "Apellido paterno",
			before: a.apellido_paterno,
			after: i.apellido_paterno
		},
		{
			label: "Apellido materno",
			before: a.apellido_materno,
			after: i.apellido_materno
		}
	]);
	e.transaction(() => {
		Tf(e, r), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno, r), o && tr(e, t, "ministro", a.client_id, a.parroquia_id, "editado", o);
	})();
}
function kf(e, t, n) {
	wf(e, t, n);
	let r = e.prepare("SELECT client_id, parroquia_id, activo FROM ministros WHERE id = ?").get(n);
	e.transaction(() => {
		Tf(e, n), e.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(n), tr(e, t, "ministro", r.client_id, r.parroquia_id, r.activo === 1 ? "deshabilitado" : "habilitado");
	})();
}
var Af = {
	"ministers.search": (e, { db: t }) => Ef(t, e),
	"ministers.create": (e, { db: t, session: n }) => ({ id: Df(t, n, e) }),
	"ministers.update": (e, { db: t, session: n }) => (Of(t, n, e), { success: !0 }),
	"ministers.toggleActive": (e, { db: t, session: n }) => (kf(t, n, V(e.id, xf)), { success: !0 })
}, jf = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function Mf(e) {
	return e.prepare("SELECT id, nombre, ubicacion FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function Nf(e, t) {
	return s.join(e, we.logos_folder, `parroquia-${t}.txt`);
}
function Pf(e, t) {
	try {
		return f(Nf(e, t), "utf8");
	} catch {
		return null;
	}
}
function Ff(e, t, n, r) {
	Xe(t, n, "Solo puede cambiar el logo de su propia parroquia.", "Solo el administrador de la parroquia puede cambiar el logo.");
	let i = Nf(e, n);
	if (r === null) {
		h(i, { force: !0 });
		return;
	}
	if (typeof r != "string" || r.length > 4e5 || !jf.test(r)) throw new z("El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.", 400);
	d(s.dirname(i), { recursive: !0 });
	let a = `${i}.tmp`;
	_(a, r, "utf8"), m(a, i);
}
var If = {
	"parishes.list": (e, { db: t }) => ({ parroquias: Mf(t) }),
	"parishes.logo": (e, { user_data_folder: t }) => ({ logo: Pf(t, V(e.parroquia_id)) }),
	"parishes.saveLogo": (e, { session: t, user_data_folder: n }) => (Ff(n, t, V(e.parroquia_id), e.logo), { success: !0 })
}, Lf = { "app.server": () => ({ servidor: $r() }) }, Rf = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: !0
}).compare;
function zf(e, t, n) {
	if (!_t(t)) throw new z("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(n) || n <= 0) throw new z("Debe especificar la parroquia.", 400);
	Ye(e, n, "No tiene permiso para imprimir el índice de otra parroquia.");
}
function Bf(e, t, n, r) {
	return zf(t, n, r), e.prepare("SELECT DISTINCT libro FROM sacramentos WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'").pluck().all(n, r).sort(Rf);
}
function Vf(e, t, n, r, i) {
	return zf(t, n, r), e.prepare(`SELECT pe.nombres, pe.apellido_paterno, pe.apellido_materno, s.libro, s.folio, s.numero
			 FROM (${bt(n)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(r, i, i).sort((e, t) => Rf(e.apellido_paterno, t.apellido_paterno) || Rf(e.apellido_materno, t.apellido_materno) || Rf(e.nombres, t.nombres) || Rf(e.libro, t.libro) || Rf(e.folio, t.folio) || Rf(e.numero, t.numero));
}
var Hf = {
	"sacramentIndex.books": (e, { db: t, session: n }) => ({ libros: Bf(t, n, e.tipo, e.parroquia_id) }),
	"sacramentIndex.entries": (e, { db: t, session: n }) => ({ entradas: Vf(t, n, e.tipo, e.parroquia_id, e.libro) })
}, Uf = [
	"nombres",
	"apellido_paterno",
	"apellido_materno"
];
function Wf(e) {
	if (!_t(e)) throw new z("Tipo de sacramento inválido.", 400);
	return e;
}
var Gf = /^\d{4}-\d{2}-\d{2}$/, Kf = /^\d+$/;
function qf(e, t, n, r) {
	let i = B(n);
	if (!i) return;
	e.push(`(${r})`);
	let a = r.split("?").length - 1;
	for (let e = 0; e < a; e++) t.push(`%${i}%`);
}
function Jf(e, t, n) {
	if (!e || typeof e != "object") return null;
	let { operador: r, valor: i, hasta: a } = e, o = B(i), s = B(a);
	if (!o || n === "fecha" && !Gf.test(o)) return null;
	if (r === "=") return n === "fecha" ? {
		sql: `${t} = ?`,
		values: [o]
	} : {
		sql: `${t} = ? COLLATE NOCASE`,
		values: [o]
	};
	let c = [];
	if (r === "desde") c.push([">=", o]);
	else if (r === "hasta") c.push(["<=", o]);
	else if (r === "entre") c.push([">=", o]), s && (n === "registro" || Gf.test(s)) && c.push(["<=", s]);
	else return null;
	let l = c.map(([e]) => e), u = c.map(([, e]) => e);
	return n === "fecha" ? {
		sql: l.map((e) => `${t} ${e} ?`).join(" AND "),
		values: u
	} : u.every((e) => Kf.test(e)) ? {
		sql: `${t} <> '' AND ${t} NOT GLOB '*[^0-9]*' AND ${l.map((e) => `CAST(${t} AS INTEGER) ${e} ?`).join(" AND ")}`,
		values: u.map((e) => Number(e))
	} : {
		sql: l.map((e) => `${t} ${e} ? COLLATE NOCASE`).join(" AND "),
		values: u
	};
}
function Yf(e, t, n, r, i) {
	let a = [];
	for (let e of r) {
		let t = Jf(n, e, i);
		if (!t) return;
		a.push(t);
	}
	e.push(`(${a.map((e) => `(${e.sql})`).join(" OR ")})`);
	for (let e of a) t.push(...e.values);
}
function Xf(e, t, n, r, i) {
	for (let t of [
		"libro",
		"folio",
		"numero"
	]) Yf(r, i, e[t], [`TRIM(s.${t})`], "registro");
	Yf(r, i, e.fecha_evento, ["s.fecha_evento"], "fecha"), Yf(r, i, e.fecha_nacimiento, n.map((e) => `${e}.fecha_nacimiento`), "fecha"), Yf(r, i, e.fecha_cambio, ["date(s.created_at, 'localtime')", "date(s.updated_at, 'localtime')"], "fecha"), qf(r, i, e.celebrante, "EXISTS (SELECT 1 FROM ministros mi WHERE mi.id = s.ministro_id\n			AND (COALESCE(mi.titulo, '') || ' ' || mi.nombre || ' ' || mi.apellido_paterno || ' ' || mi.apellido_materno) LIKE ?)");
	for (let t of [
		"padre",
		"madre",
		"dni"
	]) qf(r, i, e[t], n.map((e) => `${e}.${t} LIKE ?`).join(" OR "));
	t === "matrimonio" ? qf(r, i, e.padrino, "m.testigo_1 LIKE ? OR m.testigo_2 LIKE ? OR m.testigo_3 LIKE ? OR m.testigo_4 LIKE ?") : qf(r, i, e.padrino, "sub.padrino_1 LIKE ? OR sub.padrino_2 LIKE ?"), (e.estado === "vigente" || e.estado === "anulado") && (r.push("s.estado = ?"), i.push(e.estado)), e.con_anotaciones === !0 ? r.push("TRIM(COALESCE(s.anotaciones, '')) <> ''") : e.con_anotaciones === !1 && r.push("TRIM(COALESCE(s.anotaciones, '')) = ''");
}
function Zf(e, t, n) {
	let r = [], i = [], a = [];
	Array.isArray(e.parroquias) && (a = e.parroquias.filter((e) => Number.isInteger(e))), a.length > 0 ? (r.push(`s.parroquia_id IN (${a.map(() => "?").join(", ")})`), i.push(...a)) : Number.isInteger(e.parroquia_id) && (r.push("s.parroquia_id = ?"), i.push(e.parroquia_id));
	for (let t of Uf) {
		let a = e[t];
		if (a) {
			r.push(`(${n.map((e) => it(e, t)).join(" OR ")})`);
			for (let e = 0; e < n.length; e++) i.push(`%${a}%`, `%${a}%`);
		}
	}
	Xf(e, t, n, r, i);
	let o = "";
	return r.length > 0 && (o = "WHERE " + r.join(" AND ")), {
		where: o,
		values: i
	};
}
function Qf(e, t, n) {
	let r = `FROM ${vt(t)} sub
		JOIN sacramentos s ON s.id = sub.sacramento_id
		JOIN personas pe ON pe.id = sub.persona_id`, i = ["pe"];
	t === "matrimonio" && (r = "FROM matrimonios m\n			JOIN sacramentos s ON s.id = m.sacramento_id\n			JOIN personas c1 ON c1.id = m.conyuge_1_id\n			JOIN personas c2 ON c2.id = m.conyuge_2_id", i = ["c1", "c2"]);
	let { where: a, values: o } = Zf(n, t, i), s = Ee(n, e.prepare(`SELECT COUNT(*) AS total ${r} ${a}`).get(...o).total), c = "nombres";
	return n.orden && Uf.includes(n.orden) && (c = n.orden), {
		resultados: e.prepare(`SELECT s.id ${r} ${a}
			 ORDER BY ${i[0]}.${c} ${De(n)}, s.id
			 LIMIT ? OFFSET ?`).pluck().all(...o, 20, s.offset).map((t) => Pt(e, t)),
		total_paginas: s.total_pages
	};
}
function $f(e, t) {
	let n = B(e?.sacramento?.anotaciones);
	if (n !== null && n !== t && n.length > 875) throw new z("La anotación marginal puede tener hasta 875 caracteres, para que entre en la impresión.", 400);
}
function ep(e, t, n) {
	let r = Wf(n?.sacramento?.tipo), i = qe(t);
	Lt(n), $f(n, null);
	let a = t.role === "usuario";
	return e.transaction(() => {
		let o = Vt(e, i, n, !a), s = crypto.randomUUID();
		dt(e, r, s, null);
		let c = Ot(e, s, r, i, n.sacramento);
		Ut(e, c, n, o.map((e) => e.id)), U(e, c, t.user_id, "registrada");
		let l = Ht(o);
		if (l.length === 0) return c;
		if (a) {
			let n = l.map((e) => ({
				...e,
				tipo: "nota_marginal"
			}));
			return Pe(e, c, t.user_id, n), U(e, c, t.user_id, "cambio_pedido", n), c;
		}
		for (let n of o) rt(e, t, n.id, c, n.corrections);
		return U(e, c, t.user_id, "correccion", l), c;
	})();
}
function tp(e, t, n) {
	let r = V(n.sacramento?.id);
	Et(e, t, r, n.sacramento.tipo);
	let i = Pt(e, r);
	e.transaction(() => {
		Rt(e, r);
		let a = Gt(e, t, i, n);
		a.fields.length > 0 && U(e, r, t.user_id, "editada", a.fields), a.corrections.length > 0 && U(e, r, t.user_id, "correccion", a.corrections), rn(e, t, r, n);
	})();
}
function np(e, t, n) {
	Wf(n?.sacramento?.tipo);
	let r = V(n.sacramento?.id);
	$f(n, e.prepare("SELECT anotaciones FROM sacramentos WHERE id = ?").pluck().get(r) ?? null), t.role === "usuario" ? Qt(e, t, n) : tp(e, t, n);
}
function rp(e, t, n, r) {
	let i = e.prepare("SELECT tipo, estado FROM sacramentos WHERE id = ?").get(n);
	if (!i) throw new z(At, 404);
	if (Et(e, t, n, i.tipo), i.estado === "anulado") throw new z("La partida ya está anulada.", 400);
	let a = B(r);
	if (!a) throw new z("El motivo de anulación es requerido.", 400);
	e.transaction(() => {
		Rt(e, n), e.prepare("UPDATE sacramentos\n			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?\n			 WHERE id = ?").run(t.user_id, (/* @__PURE__ */ new Date()).toISOString(), a, n), U(e, n, t.user_id, "anulada", [], a);
	})();
}
function ip(e, t, n, r) {
	let i = e.prepare("SELECT tipo, estado FROM sacramentos WHERE id = ?").get(n);
	if (!i) throw new z(At, 404);
	if (Et(e, t, n, i.tipo), i.estado !== "anulado") throw new z("La partida no está anulada.", 400);
	let a = B(r);
	if (!a) throw new z("El motivo para rehabilitar la partida es requerido.", 400);
	e.transaction(() => {
		Rt(e, n), e.prepare("UPDATE sacramentos\n			 SET estado = 'vigente', anulado_por_usuario_id = NULL, anulado_en = NULL, motivo_anulacion = NULL\n			 WHERE id = ?").run(n), U(e, n, t.user_id, "rehabilitada", [], a);
	})();
}
function ap(e, t, n) {
	if (t.role === "usuario") throw new z("Solo un administrador puede ver el historial de una partida.", 403);
	return Ye(t, Pt(e, n).sacramento.parroquia_id, "Solo puede ver el historial de las partidas de su parroquia."), Ve(e, n);
}
var op = {
	"sacraments.search": (e, { db: t }) => Qf(t, Wf(e.tipo), e),
	"sacraments.get": (e, { db: t }) => Pt(t, V(e.id)),
	"sacraments.create": (e, { db: t, session: n }) => ({ id: ep(t, n, e) }),
	"sacraments.update": (e, { db: t, session: n }) => (np(t, n, e), { success: !0 }),
	"sacraments.annul": (e, { db: t, session: n }) => (rp(t, n, V(e.id), e.motivo_anulacion), { success: !0 }),
	"sacraments.restore": (e, { db: t, session: n }) => (ip(t, n, V(e.id), e.motivo), { success: !0 }),
	"sacraments.history": (e, { db: t, session: n }) => ({ historial: ap(t, n, V(e.id)) })
}, sp = [
	"bautismo",
	"confirmacion",
	"matrimonio"
], cp = 10, lp = 8, $ = "COALESCE(s.fecha_evento, s.fecha_emision)", up = `${$} GLOB '[0-9][0-9][0-9][0-9]*'`, dp = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'`, fp = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`, pp = [
	{
		label: "0 a 1 año",
		to: 1
	},
	{
		label: "2 a 7 años",
		to: 7
	},
	{
		label: "8 a 12 años",
		to: 12
	},
	{
		label: "13 a 25 años",
		to: 25
	},
	{
		label: "26 a 50 años",
		to: 50
	},
	{
		label: "Más de 50 años",
		to: Infinity
	}
], mp = {
	bautismo: pp,
	confirmacion: pp,
	matrimonio: [
		{
			label: "18 años o menos",
			to: 18
		},
		{
			label: "19 a 30 años",
			to: 30
		},
		{
			label: "31 a 40 años",
			to: 40
		},
		{
			label: "41 a 50 años",
			to: 50
		},
		{
			label: "51 a 60 años",
			to: 60
		},
		{
			label: "Más de 60 años",
			to: Infinity
		}
	]
};
function hp() {
	return {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
}
function gp(e) {
	return String(e).padStart(2, "0");
}
var _p = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/;
function vp(e, t) {
	let [, , n, r] = e, [, , i, a] = t;
	return !n || !i ? null : i === n ? !r || !a ? null : a >= r : i > n;
}
function yp(e, t) {
	let n = _p.exec(e ?? ""), r = _p.exec(t);
	if (!n || !r || n[0] !== e) return null;
	let i = vp(n, r);
	if (i === null) return null;
	let a = Number(r[1]) - Number(n[1]);
	return i || --a, a < 0 || a > 130 ? null : a;
}
function bp(e, t, n, r = /* @__PURE__ */ new Date()) {
	let i = r.getFullYear(), a = gp(r.getMonth() + 1), o = `${a}-${gp(r.getDate())}`, s = e.prepare(`SELECT DISTINCT CAST(substr(${$}, 1, 4) AS INTEGER) AS year
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${up}`).pluck().all(t), c = Math.min(...s, i), l = Math.max(...s, i), u = [];
	for (let e = l; e >= c; e--) u.push(e);
	let d = i;
	u.includes(n) && (d = n);
	let f = d === i, p = (n, ...r) => {
		let i = hp(), a = e.prepare(`SELECT s.tipo, COUNT(*) AS total
				 FROM sacramentos s
				 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${n}
				 GROUP BY s.tipo`).all(t, ...r);
		for (let e of a) i[e.tipo] = e.total;
		return i;
	}, m = `${up} AND substr(${$}, 1, 4) = ?`, h = f ? p(`${fp} AND substr(${$}, 1, 10) BETWEEN ? AND ?`, `${d - 1}-01-01`, `${d - 1}-${o}`) : p(m, String(d - 1)), g = p(m, String(d)), _ = p(`substr(${$}, 1, 7) = ?`, `${i}-${a}`), v = p(up), y = {};
	for (let e of sp) y[e] = {
		anio: g[e],
		anterior: h[e],
		mes: _[e],
		historico: v[e]
	};
	let b = [];
	for (let e = 1; e <= 12; e++) b.push({
		mes: e,
		...hp()
	});
	let x = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${dp} AND substr(${$}, 1, 4) = ?
			 GROUP BY s.tipo, mes`).all(t, String(d));
	for (let e of x) b[e.mes - 1] && (b[e.mes - 1][e.tipo] = e.total);
	let ee = Math.max(Math.min(...u), d - cp + 1), S = [];
	for (let e = ee; e <= d; e++) S.push({
		anio: e,
		...hp()
	});
	let C = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${up}
			 GROUP BY s.tipo, anio`).all(t);
	for (let e of C) {
		let t = S.find((t) => t.anio === e.anio);
		t && (t[e.tipo] = e.total);
	}
	let w = e.prepare(`SELECT s.tipo, ${$} AS fecha, pe.fecha_nacimiento
			 FROM (${xt}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${up} AND substr(${$}, 1, 4) = ?`).all(t, String(d)), T = {};
	for (let e of sp) {
		let t = mp[e].map(() => 0), n = 0, r = 0, i = 0;
		for (let a of w) {
			if (a.tipo !== e) continue;
			let o = yp(a.fecha_nacimiento, a.fecha);
			if (o === null) {
				i += 1;
				continue;
			}
			let s = mp[e].findIndex((e) => o <= e.to);
			t[s] += 1, n += o, r += 1;
		}
		let a = null;
		r > 0 && (a = Math.round(n / r * 10) / 10), T[e] = {
			bandas: t,
			sinDato: i,
			promedio: a
		};
	}
	let E = e.prepare(`SELECT min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS nombre, COUNT(*) AS total
			 FROM sacramentos s
			 JOIN ministros min ON min.id = s.ministro_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${up} AND substr(${$}, 1, 4) = ?
			 GROUP BY min.id
			 ORDER BY total DESC, nombre
			 LIMIT ?`).all(t, String(d), lp), D = e.prepare(`SELECT
				COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND c.estado = 'aprobado')), 0) AS conCorrecciones
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND ${up} AND substr(${$}, 1, 4) = ?`).get(t, String(d));
	return {
		anios: u,
		anio: d,
		esAnioActual: f,
		totales: y,
		mensual: b,
		tendencia: S,
		bandasEdad: Object.fromEntries(sp.map((e) => [e, mp[e].map((e) => e.label)])),
		edades: T,
		ministros: E,
		registro: D
	};
}
var xp = { "statistics.get": (e, { db: t }) => bp(t, V(e.parroquia_id), e.anio) }, Sp = {
	"sync.status": () => Ki(),
	"sync.run": async () => (await J(), Ki()),
	"sync.resolve": async (e) => (await Xi(e.entidad, e.client_id, e.eleccion), Ki()),
	"sync.conflictDetail": (e) => Yi(e.entidad, e.client_id),
	"sync.dismissNotice": () => (Zi(), { success: !0 })
}, Cp = /^[A-Za-z0-9._-]{3,50}$/;
function wp(e) {
	return e.length < 6 ? "La contraseña debe tener al menos 6 caracteres." : /\s/.test(e) ? "La contraseña no puede tener espacios." : null;
}
function Tp(e) {
	return la.includes(e);
}
function Ep(e) {
	return e.rol === "admin_general" && e.parroquia_id !== null ? "Un administrador general no pertenece a ninguna parroquia." : e.rol !== "admin_general" && e.parroquia_id === null ? "Debe seleccionar una parroquia." : null;
}
function Dp(e, t, n) {
	return t.parroquia_id === e.parroquia_id ? t.otras_parroquias ? `Esta cuenta también trabaja en otras parroquias: solo el administrador general puede ${n}la.` : t.rol === "usuario" || t.rol === "admin_parroquia" && e.principal ? null : t.rol === "admin_parroquia" ? `Solo el administrador principal de la parroquia puede ${n} a otros administradores.` : "El administrador de una parroquia no gestiona administradores generales." : `Solo puede ${n} cuentas de su propia parroquia.`;
}
function Op(e, t) {
	return e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede crear administradores generales." : null : e.rol === "admin_parroquia" ? Dp(e, t, "crear") : "No tiene permiso para gestionar usuarios.";
}
function kp(e, t) {
	return t.id === e.id ? null : e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede modificar a otros administradores generales." : null : e.rol === "admin_parroquia" ? Dp(e, t, "modificar") : "No tiene permiso para gestionar usuarios.";
}
function Ap(e) {
	return e.principal || e.principal_en_otra ? "No se puede deshabilitar al administrador principal: primero pase la marca de principal a otro administrador." : null;
}
function jp(e, t) {
	return e.rol === "admin_general" ? t.rol === "admin_general" ? "Un administrador general no pertenece a ninguna parroquia." : null : "Solo el administrador general puede agregar o quitar parroquias de una cuenta.";
}
function Mp(e) {
	return e === "admin_general" || e === "admin_parroquia";
}
//#endregion
//#region electron/main/controllers/users.ts
var Np = "Usuario no encontrado.", Pp = "Agregar o quitar parroquias necesita conexión a internet: la cuenta tiene que estar en el servidor.", Fp = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
}, Ip = {
	admin_general: "Administrador general",
	admin_parroquia: "Administrador de parroquia",
	usuario: "Usuario"
};
function Lp(e) {
	if (!Mp(e.role)) throw new z("Solo un administrador puede gestionar usuarios.", 403);
}
function Rp(e, t) {
	return Lr(e, t.user_id, t.role, t.parish_id);
}
function zp(e, t, n) {
	let r = Rr(e, n, t.parish_id);
	if (!r) throw new z(Np, 404);
	return r;
}
function Bp(e, t, n) {
	return t === "admin_parroquia" ? +(e.prepare("SELECT 1 FROM membresias WHERE principal = 1 AND parroquia_id = ?").get(n) === void 0) : 0;
}
function Vp(e, t) {
	if (!e && !t) return;
	let n = wp(e);
	if (n) throw new z(n, 400);
}
function Hp(e) {
	let t = B(e?.nombre), n = B(e?.apellido_paterno);
	if (!t || !n) throw new z("Nombre y apellido paterno son requeridos.", 400);
	return {
		nombre: t,
		apellido_paterno: n,
		apellido_materno: B(e.apellido_materno) ?? ""
	};
}
function Up(e, t, n) {
	e.prepare("UPDATE usuarios SET password_hash_pendiente = ? WHERE id = ?").run(n, t), e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, n);
}
function Wp(e, t) {
	return e.prepare(`SELECT up.parroquia_id, ${Pr("p")} AS parroquia_nombre, up.rol, up.principal
			 FROM usuario_parroquias up
			 JOIN parroquias p ON p.id = up.parroquia_id
			 WHERE up.usuario_id = ?
			 ORDER BY p.nombre`).all(t);
}
function Gp(e, t, n) {
	Lp(t);
	let r = [], i = [], a = n.parroquia_id;
	t.role === "admin_parroquia" && (a = t.parish_id ?? -1);
	let o = "FROM usuarios u LEFT JOIN parroquias p ON p.id = u.parroquia_id", s = "u.rol, u.parroquia_id, u.principal";
	Number.isInteger(a) && (o = "FROM usuarios u JOIN membresias m ON m.usuario_id = u.id AND m.parroquia_id = ? LEFT JOIN parroquias p ON p.id = m.parroquia_id", s = "m.rol, m.parroquia_id, m.principal", i.push(a));
	for (let e of [
		"nombres",
		"apellido_paterno",
		"apellido_materno"
	]) {
		let t = n[e];
		t && (r.push(`u.${Fp[e]} LIKE ?`), i.push(`%${t}%`));
	}
	let c = "";
	r.length > 0 && (c = "WHERE " + r.join(" AND "));
	let l = Ee(n, e.prepare(`SELECT COUNT(*) AS total ${o} ${c}`).get(...i).total), u = Fp[n.orden ?? "nombres"] ?? Fp.nombres, d = e.prepare(`SELECT u.id, u.username, ${s}, u.parroquia_id AS parroquia_origen_id,
				u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, ${Pr("p")} AS parroquia_nombre
			 ${o}
			 ${c}
			 ORDER BY u.${u} ${De(n)}, u.id
			 LIMIT ? OFFSET ?`).all(...i, 20, l.offset);
	for (let t of d) t.parroquias_adicionales = Wp(e, t.id);
	return {
		resultados: d,
		total_paginas: l.total_pages
	};
}
async function Kp(e, t, n) {
	Lp(t);
	let r = Hp(n), i = B(n?.username) ?? "", a = typeof n?.password == "string" ? n.password : "", o = n?.rol ?? "usuario";
	if (!Cp.test(i)) throw new z("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	if (Vp(a, !0), !Tp(o)) throw new z("El rol no es válido.", 400);
	let s = null;
	o !== "admin_general" && (s = t.role === "admin_parroquia" ? t.parish_id : Number.isInteger(n.parroquia_id) ? n.parroquia_id : null);
	let c = {
		rol: o,
		parroquia_id: s
	}, l = Ep(c);
	if (l) throw new z(l, 400);
	let u = Op(Rp(e, t), c);
	if (u) throw new z(u, 403);
	if (s !== null && !e.prepare("SELECT 1 FROM parroquias WHERE id = ? AND activa = 1").get(s)) throw new z("La parroquia seleccionada no existe.", 400);
	if (e.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE").get(i)) throw new z("Ese nombre de usuario ya existe.", 409);
	let d = await _n(a), f = crypto.randomUUID();
	return e.transaction(() => {
		let n = e.prepare("SELECT MIN(id) FROM usuarios").pluck().get(), a = Math.min(n ?? 0, 0) - 1;
		return dt(e, "usuario", f, null), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)").run(a, f, s, i, o, r.nombre, r.apellido_paterno, r.apellido_materno, Bp(e, o, s)), Up(e, a, d), tr(e, t, "usuario", f, s, "creado", `${Ip[o]}: ${i}`), a;
	})();
}
function qp(e, t, n) {
	let r = B(n), i = e.prepare("SELECT username FROM usuarios WHERE id = ?").pluck().get(t);
	if (!r || r === i) return null;
	if (t > 0) throw new z("El nombre de usuario no se puede cambiar: la cuenta ya está en el servidor.", 400);
	if (!Cp.test(r)) throw new z("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	if (e.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE AND id <> ?").get(r, t)) throw new z("Ese nombre de usuario ya existe.", 409);
	return r;
}
async function Jp(e, t, n) {
	let r = tm(n?.id);
	r !== t.user_id && Lp(t);
	let i = Hp(n), a = typeof n.password == "string" ? n.password : "";
	Vp(a, !1);
	let o = zp(e, t, r), s = kp(Rp(e, t), o);
	if (s) throw new z(s, 403);
	let c = a ? await _n(a) : null, l = qp(e, r, n?.username), u = e.prepare("SELECT parroquia_id, username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE id = ?").get(r), d = er([
		{
			label: "Nombre de usuario",
			before: u.username,
			after: l ?? u.username
		},
		{
			label: "Nombre",
			before: u.nombre,
			after: i.nombre
		},
		{
			label: "Apellido paterno",
			before: u.apellido_paterno,
			after: i.apellido_paterno
		},
		{
			label: "Apellido materno",
			before: u.apellido_materno,
			after: i.apellido_materno
		}
	]);
	e.transaction(() => {
		dt(e, "usuario", o.client_id, o.version), e.prepare("UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.nombre, i.apellido_paterno, i.apellido_materno, r), d && tr(e, t, "usuario", o.client_id, u.parroquia_id, "editado", d), c && (Up(e, r, c), tr(e, t, "usuario", o.client_id, u.parroquia_id, "contrasena")), l && (e.prepare("UPDATE usuarios SET username = ? WHERE id = ?").run(l, r), e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE entidad = 'usuario' AND client_id = ? AND estado = 'rechazado'").run(o.client_id));
	})();
}
function Yp(e, t, n) {
	if (Lp(t), n === t.user_id) throw new z("No puede deshabilitar su propia cuenta.", 400);
	let r = zp(e, t, n), i = kp(Rp(e, t), r);
	if (i) throw new z(i, 403);
	let a = r.activo === 1 ? Ap(r) : null;
	if (a) throw new z(a, 400);
	e.transaction(() => {
		dt(e, "usuario", r.client_id, r.version), e.prepare("UPDATE usuarios SET activo = NOT activo WHERE id = ?").run(n);
		let i = e.prepare("SELECT parroquia_id FROM usuarios WHERE id = ?").pluck().get(n);
		tr(e, t, "usuario", r.client_id, i, r.activo === 1 ? "deshabilitado" : "habilitado"), r.activo === 1 && e.prepare("DELETE FROM credenciales_locales WHERE usuario_id = ?").run(n);
	})();
}
async function Xp(e, t, n, r) {
	if (typeof t != "string" || !e.prepare("SELECT 1 FROM usuarios WHERE username = ?").get(t)) throw new z(Np, 404);
	await J();
	let i = e.prepare("SELECT id FROM usuarios WHERE username = ?").pluck().get(t), a = Vr()?.token;
	if (!a || i < 0) throw new z(n, 503);
	await r(i, a), await J();
}
async function Zp(e, t, n, r = null) {
	Lp(t);
	let i = t.role === "admin_general" ? null : t.parish_id;
	Number.isInteger(r) && (i = r), await Xp(e, n, "Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.", async (e, t) => {
		await q(`/api/users/${e}/make-principal`, {
			method: "PATCH",
			token: t,
			body: { parroquia_id: i }
		});
	});
}
function Qp(e, t, n, r) {
	let i = zp(e, t, tm(n)), a = jp(Rp(e, t), i);
	if (a) throw new z(a, 403);
	if (!Number.isInteger(r)) throw new z("Debe seleccionar una parroquia.", 400);
	return {
		username: e.prepare("SELECT username FROM usuarios WHERE id = ?").pluck().get(i.id),
		parish_id: r
	};
}
async function $p(e, t, n, r, i) {
	let a = Qp(e, t, n, r);
	await Xp(e, a.username, Pp, async (e, t) => {
		await q(`/api/users/${e}/parishes/${a.parish_id}`, {
			method: "PUT",
			token: t,
			body: { rol: i }
		});
	});
}
async function em(e, t, n, r) {
	let i = Qp(e, t, n, r);
	await Xp(e, i.username, Pp, async (e, t) => {
		await q(`/api/users/${e}/parishes/${i.parish_id}`, {
			method: "DELETE",
			token: t
		});
	});
}
function tm(e) {
	if (!Number.isInteger(e) || e === 0) throw new z(Np, 404);
	return e;
}
var nm = {
	"users.search": (e, { db: t, session: n }) => Gp(t, n, e ?? {}),
	"users.create": async (e, { db: t, session: n }) => {
		let r = await Kp(t, n, e);
		return J(), { id: r };
	},
	"users.update": async (e, { db: t, session: n }) => (await Jp(t, n, e), J(), { success: !0 }),
	"users.toggleActive": (e, { db: t, session: n }) => (Yp(t, n, tm(e?.id)), J(), { success: !0 }),
	"users.makePrincipal": async (e, { db: t, session: n }) => (await Zp(t, n, e?.username, e?.parroquia_id ?? null), { success: !0 }),
	"users.setParish": async (e, { db: t, session: n }) => (await $p(t, n, e?.id, e?.parroquia_id, e?.rol), { success: !0 }),
	"users.removeParish": async (e, { db: t, session: n }) => (await em(t, n, e?.id, e?.parroquia_id), { success: !0 }),
	"users.me": (e, { db: t, session: n }) => ({ principal: Mp(n.role) && Rp(t, n).principal })
};
//#endregion
//#region electron/main/utils/middleware.ts
async function rm(e, t, r, i) {
	if (Object.hasOwn(t, r)) return t[r](i);
	if (!Object.hasOwn(e, r)) throw new z("Operación no reconocida.", 404);
	let a = {
		session: Br(),
		db: W(),
		user_data_folder: n.getPath("userData")
	};
	return e[r](i, a);
}
function im(e, t) {
	i.handle(Mr, async (n, r, i) => {
		try {
			return {
				ok: !0,
				data: await rm(e, t, r, i)
			};
		} catch (e) {
			return e instanceof z ? {
				ok: !1,
				message: e.message,
				status: e.status
			} : (Jr(`Error en ${r}:`, e), {
				ok: !1,
				message: "Ocurrió un error inesperado.",
				status: 500
			});
		}
	});
}
//#endregion
//#region electron/main/app.ts
function am() {
	im({
		...Ra,
		...If,
		...Af,
		...op,
		...ts,
		...xp,
		...Hf,
		...Sp,
		...nm,
		...on,
		...bf,
		...Za,
		...To,
		...Vo
	}, {
		...za,
		...Xa,
		...Eo,
		...Lf
	});
}
function om() {
	i.handle("app:get-version", () => n.getVersion()), am();
	try {
		Yn();
	} catch (e) {
		Jr("No se pudo abrir la base local:", e);
	}
	Ja();
}
async function sm() {
	Ri();
	try {
		await Qi(Ce);
	} catch (e) {
		Jr("No se pudo sincronizar al cerrar:", e);
	}
}
function cm() {
	$n();
}
//#endregion
//#region electron/main/index.ts
var lm = s.dirname(c(import.meta.url)), um = process.env.VITE_DEV_SERVER_URL, dm = null, fm = !1;
function pm() {
	if (dm = new t({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: s.join(lm, "index.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), process.env.PRELATURA_SECOND_SCREEN === "1") {
		let e = o.getAllDisplays().find((e) => e.id !== o.getPrimaryDisplay().id);
		e && dm.setBounds(e.workArea);
	}
	dm.maximize(), um ? (dm.loadURL(um), dm.webContents.openDevTools()) : dm.loadFile(s.join(lm, "../dist/index.html")), dm.on("closed", () => {
		dm = null;
	});
}
n.whenReady().then(() => {
	om(), pm();
}), n.on("before-quit", (e) => {
	fm || (e.preventDefault(), fm = !0, sm().finally(() => n.quit()));
}), n.on("will-quit", cm), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
}), n.on("activate", () => {
	t.getAllWindows().length === 0 && pm();
});
//#endregion
export {};
