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
import { Duplex as te, PassThrough as A, Transform as j, pipeline as ne } from "stream";
import { Blob as M } from "node:buffer";
import N, { Readable as re, Transform as P } from "node:stream";
import { createRequire as F } from "module";
//#region \0rolldown/runtime.js
var I = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), L = /* @__PURE__ */ e(import.meta.url), R = [
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
], ie = [
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
], ae = [{
	campo: "padrino_1",
	label: "Padrino"
}, {
	campo: "padrino_2",
	label: "Madrina"
}], oe = [
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
], z = ie.map((e) => e.campo);
function se(e) {
	return e === "matrimonio" ? oe : ae;
}
function ce(e) {
	return se(e).map((e) => e.campo);
}
function le(e) {
	return e === "matrimonio" ? ["conyuge_1", "conyuge_2"] : ["persona"];
}
function ue(e, t) {
	return e === "sacramento" ? R : e === "detalle" ? se(t) : ie;
}
function de(e, t) {
	let n = [
		...R,
		...ie,
		...ae,
		...oe
	].find((e) => e.campo === t)?.label ?? t;
	return e === "conyuge_1" ? `${n} del esposo` : e === "conyuge_2" ? `${n} de la esposa` : n;
}
function fe(e, t) {
	return t === "sacramento" ? e.sacramento : t === "persona" ? e.persona : t === "conyuge_1" || t === "conyuge_2" ? e[t] : e;
}
function pe(e, t) {
	return fe(e, t);
}
function me(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" ? null : t;
}
function he(e, t, n) {
	return me(fe(e, t)?.[n]);
}
function ge(e, t, n, r) {
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
	let a = fe(e, t);
	return {
		...e,
		[t]: {
			...a,
			[n]: i
		}
	};
}
function _e(e, t) {
	let n = [], r = e.sacramento.tipo, i = [
		"sacramento",
		...le(r),
		"detalle"
	];
	for (let a of i) for (let i of ue(a, r)) {
		let r = he(e, a, i.campo), o = he(t, a, i.campo);
		r !== o && n.push({
			parte: a,
			campo: i.campo,
			valor_anterior: r,
			valor_nuevo: o
		});
	}
	return n;
}
function ve(e, t) {
	let n = (e.cambios ?? []).filter((e) => e.id !== void 0 && e.campo_cambio === t && (e.estado === void 0 || e.estado === "aprobado"));
	return n.length === 0 ? e[t] : n.reduce((e, t) => t.id > e.id ? t : e).valor_nuevo ?? e[t];
}
var ye = 1e4, be = 3e5, xe = 5e3, B = {
	cursor: "cursor",
	last_sync: "ultima_sync",
	notice: "aviso",
	key_registered: "clave_registrada"
}, Se = {
	database: "prelatura-local.db",
	key: "prelatura-local.key",
	device: "prelatura-dispositivo.id",
	temp_database: "prelatura-reconstruccion.db",
	temp_key: "prelatura-reconstruccion.key",
	set_aside_folder: "bases-apartadas",
	logos_folder: "logos",
	backup_log: "registro-respaldos.json"
}, Ce = 2592e6, V = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ServiceError", this.status = t;
	}
};
//#endregion
//#region electron/main/utils/helpers.ts
function H(e) {
	if (typeof e != "string") return null;
	let t = e.trim();
	return t === "" ? null : t;
}
function U(e, t = "Partida no encontrada.") {
	if (!Number.isInteger(e) || e <= 0) throw new V(t, 404);
	return e;
}
function we(e, t) {
	let n = 1;
	return Number.isInteger(e.pagina) && e.pagina > 0 && (n = e.pagina), {
		offset: (n - 1) * 20,
		total_pages: Math.max(1, Math.ceil(t / 20))
	};
}
function Te(e) {
	return e.direccion === "desc" ? "DESC" : "ASC";
}
function Ee(e, t, n) {
	return [
		e,
		t,
		n
	].filter((e) => e).join(" ");
}
//#endregion
//#region electron/main/models/field_values.ts
var De = "ministro_id";
function Oe(e, t, n) {
	return t !== De || n === null ? n : e.prepare("SELECT client_id FROM ministros WHERE id = ?").get(Number(n))?.client_id ?? null;
}
function ke(e, t, n) {
	if (t !== De || n === null) return n;
	let r = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(n);
	return r ? String(r.id) : null;
}
function Ae(e, t, n) {
	if (t !== De || n === null) return n;
	let r = e.prepare("SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?").get(n);
	return r ? [r.titulo, Ee(r.nombre, r.apellido_paterno, r.apellido_materno)].filter(Boolean).join(" ") : "Celebrante desconocido";
}
//#endregion
//#region electron/main/models/change_request.ts
function je(e, t) {
	return e.prepare("SELECT 1 FROM solicitudes_cambio WHERE sacramento_id = ? AND estado = 'pendiente'").get(t) !== void 0;
}
function Me(e, t) {
	return e.prepare("SELECT id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo FROM solicitudes_cambio\n			 WHERE sacramento_id = ? AND estado = 'pendiente' ORDER BY id").all(t).map((t) => ({
		...t,
		valor_anterior: ke(e, t.campo, t.valor_anterior),
		valor_nuevo: ke(e, t.campo, t.valor_nuevo)
	}));
}
function Ne(e, t, n, r) {
	let i = e.prepare("INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"), a = (/* @__PURE__ */ new Date()).toISOString();
	for (let o of r) i.run(crypto.randomUUID(), t, n, o.parte, o.campo, o.tipo, Oe(e, o.campo, o.valor_anterior), Oe(e, o.campo, o.valor_nuevo), a);
}
function Pe(e, t, n, r, i = null) {
	e.prepare("UPDATE solicitudes_cambio SET estado = ?, motivo = ?, revisado_por_usuario_id = ?, revisado_en = ?\n		 WHERE sacramento_id = ? AND estado = 'pendiente'").run(n, i, r, (/* @__PURE__ */ new Date()).toISOString(), t);
}
function Fe(e, t) {
	return e.prepare("SELECT s.id, s.parte, s.campo, s.tipo, s.valor_anterior, s.valor_nuevo, s.estado, s.motivo, s.creado_en, s.revisado_en,\n				p.nombre AS pide_nombre, p.apellido_paterno AS pide_paterno, p.apellido_materno AS pide_materno,\n				r.nombre AS revisa_nombre, r.apellido_paterno AS revisa_paterno, r.apellido_materno AS revisa_materno\n			 FROM solicitudes_cambio s\n			 LEFT JOIN usuarios p ON p.id = s.usuario_id\n			 LEFT JOIN usuarios r ON r.id = s.revisado_por_usuario_id\n			 WHERE s.sacramento_id = ?\n			 ORDER BY s.creado_en DESC, s.id").all(t).map((t) => ({
		id: t.id,
		parte: t.parte,
		campo: t.campo,
		tipo: t.tipo,
		valor_anterior: ke(e, t.campo, t.valor_anterior),
		valor_nuevo: ke(e, t.campo, t.valor_nuevo),
		texto_anterior: Ae(e, t.campo, t.valor_anterior),
		texto_nuevo: Ae(e, t.campo, t.valor_nuevo),
		estado: t.estado,
		motivo: t.motivo,
		solicitado_por: Ee(t.pide_nombre, t.pide_paterno, t.pide_materno) || "Un usuario",
		creado_en: t.creado_en,
		revisado_por: t.revisa_nombre ? Ee(t.revisa_nombre, t.revisa_paterno, t.revisa_materno) : null,
		revisado_en: t.revisado_en
	}));
}
function Ie(e, t) {
	return e.prepare("SELECT client_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n				revisado_por_usuario_id, revisado_en, creado_en\n			 FROM solicitudes_cambio WHERE sacramento_id = ? ORDER BY id").all(t);
}
function Le(e, t, n) {
	let r = e.prepare("INSERT INTO solicitudes_cambio\n			(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n			 revisado_por_usuario_id, revisado_en, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			motivo = excluded.motivo,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of n) r.run(e.client_id, t, e.usuario_id, e.parte, e.campo, e.tipo, e.valor_anterior, e.valor_nuevo, e.estado, e.motivo, e.revisado_por_usuario_id, e.revisado_en, e.creado_en);
}
function Re(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM solicitudes_cambio WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/history.ts
function W(e, t, n, r, i = [], a = null) {
	let o = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, n, r, a, (/* @__PURE__ */ new Date()).toISOString()), s = Number(o.lastInsertRowid), c = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let t of i) c.run(s, t.parte, t.campo, Oe(e, t.campo, t.valor_anterior), Oe(e, t.campo, t.valor_nuevo));
}
function ze(e, t) {
	return e.prepare("SELECT parte, campo, valor_anterior, valor_nuevo FROM historial_campos WHERE historial_id = ? ORDER BY id").all(t);
}
function Be(e, t) {
	return e.prepare("SELECT h.id, h.evento, h.motivo, h.fecha, u.nombre, u.apellido_paterno, u.apellido_materno, u.username\n			 FROM historial_partidas h\n			 LEFT JOIN usuarios u ON u.id = h.usuario_id\n			 WHERE h.sacramento_id = ?\n			 ORDER BY h.fecha DESC, h.id DESC").all(t).map((t) => ({
		id: t.id,
		evento: t.evento,
		motivo: t.motivo,
		fecha: t.fecha,
		usuario: Ee(t.nombre, t.apellido_paterno, t.apellido_materno) || t.username || "Usuario desconocido",
		campos: ze(e, t.id).map((t) => ({
			parte: t.parte,
			campo: t.campo,
			texto_anterior: Ae(e, t.campo, t.valor_anterior),
			texto_nuevo: Ae(e, t.campo, t.valor_nuevo)
		}))
	}));
}
function Ve(e, t) {
	return e.prepare("SELECT id, client_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id = ? ORDER BY id").all(t).map(({ id: t, ...n }) => ({
		...n,
		campos: ze(e, t)
	}));
}
function He(e, t, n) {
	let r = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)\n		 VALUES (?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO NOTHING"), i = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let e of n) {
		let n = r.run(e.client_id, t, e.usuario_id, e.evento, e.motivo, e.fecha);
		if (n.changes !== 0) for (let t of e.campos) i.run(Number(n.lastInsertRowid), t.parte, t.campo, t.valor_anterior, t.valor_nuevo);
	}
}
function Ue(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM historial_campos WHERE historial_id IN (SELECT id FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?)))").run(t, r), e.prepare("DELETE FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/parish.ts
var We = "El administrador general solo consulta: no puede registrar ni modificar datos de las parroquias.";
function Ge(e, t) {
	return e.prepare("SELECT * FROM parroquias WHERE id = ?").get(t);
}
function Ke(e) {
	if (e.role === "admin_general") throw new V(We, 403);
	if (!e.parish_id) throw new V("El usuario no tiene una parroquia asignada.", 400);
	return e.parish_id;
}
function qe(e, t, n) {
	if (e.role === "admin_general") throw new V(We, 403);
	if (e.parish_id !== t) throw new V(n, 403);
}
function Je(e, t, n) {
	if (e.role !== "admin_general" && e.parish_id !== t) throw new V(n, 403);
}
function Ye(e, t, n, r) {
	if (qe(e, t, n), e.role !== "admin_parroquia") throw new V(r, 403);
}
//#endregion
//#region electron/main/models/person.ts
var Xe = [
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
function Ze(e) {
	return {
		dni: H(e.dni),
		nombres: H(e.nombres) ?? "",
		apellido_paterno: H(e.apellido_paterno) ?? "",
		apellido_materno: H(e.apellido_materno) ?? "",
		fecha_nacimiento: H(e.fecha_nacimiento),
		fecha_aproximada: H(e.fecha_aproximada),
		lugar_nacimiento: H(e.lugar_nacimiento),
		padre: H(e.padre),
		madre: H(e.madre)
	};
}
function Qe(e, t) {
	let n = e.prepare("SELECT * FROM personas WHERE id = ?").get(t), r = e.prepare("SELECT * FROM cambios_persona WHERE persona_id = ? ORDER BY id").all(t);
	return {
		...n,
		cambios: r
	};
}
function $e(e, t, n) {
	let r = Ze(n), i = e.prepare("INSERT INTO personas\n				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, r.dni, r.nombres, r.apellido_paterno, r.apellido_materno, r.fecha_nacimiento, r.fecha_aproximada, r.lugar_nacimiento, r.padre, r.madre);
	return Number(i.lastInsertRowid);
}
function et(e, t, n) {
	let r = Ze(n), i = e.prepare(`SELECT ${z.join(", ")} FROM personas WHERE id = ?`).get(t), a = z.filter((e) => i[e] !== r[e]);
	if (a.length === 0) return;
	let o = a.map((e) => `${e} = ?`).join(", "), s = a.map((e) => r[e]);
	e.prepare(`UPDATE personas SET ${o} WHERE id = ?`).run(...s, t);
}
function tt(e) {
	let t = Array.isArray(e.cambios) ? e.cambios.filter((e) => e.id === void 0) : [], n = [];
	for (let r of t) {
		let t = Xe.find((e) => e.column === r.campo_cambio);
		if (!t) throw new V("La nota marginal indica un campo que no se puede corregir.", 400);
		if (n.some((e) => e.campo_cambio === t.column)) throw new V(`La nota marginal repite el campo ${t.label}.`, 400);
		let i = H(ve(e, t.column)), a = H(r.valor_nuevo);
		if (!i) throw new V(`Complete ${t.label} antes de corregirlo en la nota marginal.`, 400);
		if (!a) throw new V(`Indique el valor nuevo de ${t.label} en la nota marginal.`, 400);
		if (a === i) throw new V(`El valor nuevo de ${t.label} es igual al anterior.`, 400);
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
function nt(e, t, n, r, i) {
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?)"), o = (/* @__PURE__ */ new Date()).toISOString();
	for (let e of i) a.run(crypto.randomUUID(), n, r, t.user_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, t.user_id, o);
}
function rt(e, t) {
	return `(${e}.${t} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${e}.id AND cp.campo_cambio = '${t}' AND cp.estado = 'aprobado' AND cp.valor_nuevo LIKE ?
	))`;
}
//#endregion
//#region shared/partial_date.ts
var it = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/, at = "?";
function ot(e, t) {
	let n = t ? Number(t) : 2e3;
	return new Date(n, Number(e), 0).getDate();
}
function st(e) {
	let [t = "", n = "", r = ""] = (e ?? "").split("-").map((e) => e === at ? "" : e);
	return {
		year: t,
		month: n,
		day: r
	};
}
function ct(e) {
	if (!e) return "";
	let t = it.exec(e);
	if (!t) return e;
	let [, n, r, i] = t;
	return [
		i,
		r,
		n
	].filter(Boolean).join("/");
}
function lt(e) {
	if (!e) return null;
	let { year: t, month: n, day: r } = st(e);
	return t ? r && !n ? "falta el mes" : it.test(e) && r && Number(r) > ot(n, t) ? "ese día no existe en ese mes" : null : "falta el año";
}
//#endregion
//#region electron/main/sync/queue.ts
function ut(e, t, n, r) {
	e.prepare("INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)\n		 ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1").run(t, n, r, crypto.randomUUID());
}
function dt(e, t, n) {
	return e.prepare("SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?").get(t, n) !== void 0;
}
function ft(e, t, n) {
	e.prepare("DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?").run(t, n);
}
function pt(e, t) {
	let n = e.prepare("SELECT valor FROM sync_estado WHERE clave = ?").get(t);
	return n ? n.valor : null;
}
function mt(e, t, n) {
	e.prepare("INSERT INTO sync_estado (clave, valor) VALUES (?, ?)\n		 ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").run(t, n);
}
//#endregion
//#region electron/main/models/minister.ts
function ht(e, t) {
	let n = e.prepare("SELECT * FROM ministros WHERE id = ?").get(t);
	return n ? {
		...n,
		parroquia: Ge(e, n.parroquia_id)
	} : null;
}
//#endregion
//#region electron/main/models/sacrament.ts
function gt(e) {
	return e === "bautismo" || e === "confirmacion" || e === "matrimonio";
}
function _t(e) {
	return e === "bautismo" ? "bautismos" : e === "confirmacion" ? "confirmaciones" : "matrimonios";
}
function vt(e) {
	return e === "matrimonio" ? ["conyuge_1_id", "conyuge_2_id"] : ["persona_id"];
}
function yt(e) {
	return e === "bautismo" ? "SELECT sacramento_id, persona_id FROM bautismos" : e === "confirmacion" ? "SELECT sacramento_id, persona_id FROM confirmaciones" : "SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n		UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
}
var bt = "SELECT sacramento_id, persona_id FROM bautismos\n	UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones\n	UNION ALL SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n	UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
function xt(e, t) {
	let n = e.prepare("SELECT * FROM sacramentos WHERE id = ?").get(t);
	if (!n) return null;
	let r = null;
	return n.ministro_id !== null && (r = ht(e, n.ministro_id)), {
		...n,
		parroquia: Ge(e, n.parroquia_id),
		ministro: r
	};
}
function St(e) {
	let t = H(e.fecha_emision), n = H(e.libro), r = H(e.folio), i = H(e.numero);
	if (!n || !r || !i) throw new V("El libro, el folio y el número de registro son requeridos.", 400);
	return {
		fecha_emision: t,
		libro: n,
		folio: r,
		numero: i,
		ministro_id: e.ministro_id ?? null,
		fecha_evento: H(e.fecha_evento),
		anotaciones: H(e.anotaciones)
	};
}
function Ct(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(t, n);
	if (!r) throw new V("Partida no encontrada.", 404);
	return r.parroquia_id;
}
var wt = "No tiene permiso para modificar partidas de otra parroquia.";
function Tt(e, t, n, r) {
	Ye(t, Ct(e, n, r), wt, "Solo el administrador de la parroquia puede modificar o anular una partida. Pida la corrección con una nota marginal.");
}
function Et(e, t, n) {
	if (t === null) return;
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(t);
	if (r && r.parroquia_id !== n) throw new V("El celebrante debe ser de la parroquia de la partida.", 400);
}
function Dt(e, t, n, r, i) {
	let a = St(i);
	Et(e, a.ministro_id, r);
	let o = e.prepare("INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, n, r, a.ministro_id, a.libro, a.folio, a.numero, a.fecha_emision, a.fecha_evento, a.anotaciones);
	return Number(o.lastInsertRowid);
}
function Ot(e, t, n) {
	let r = St(n), i = e.prepare("SELECT ministro_id, parroquia_id FROM sacramentos WHERE id = ?").get(t);
	r.ministro_id !== i.ministro_id && Et(e, r.ministro_id, i.parroquia_id), e.prepare("UPDATE sacramentos\n		 SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?\n		 WHERE id = ?").run(r.ministro_id, r.libro, r.folio, r.numero, r.fecha_emision, r.fecha_evento, r.anotaciones, t);
}
//#endregion
//#region electron/main/models/record.ts
var kt = "Partida no encontrada.";
function At(e, t, n) {
	let r = xt(e, t);
	if (!r || r.tipo !== n) throw new V(kt, 404);
	return {
		...r,
		solicitudes: Fe(e, t)
	};
}
function jt(e, t, n) {
	let r = At(e, n, t), i = e.prepare(`SELECT * FROM ${_t(t)} WHERE sacramento_id = ?`).get(n);
	return {
		sacramento: r,
		persona: Qe(e, i.persona_id),
		padrino_1: i.padrino_1,
		padrino_2: i.padrino_2
	};
}
function Mt(e, t) {
	let n = At(e, t, "matrimonio"), r = e.prepare("SELECT * FROM matrimonios WHERE sacramento_id = ?").get(t);
	return {
		sacramento: n,
		conyuge_1: Qe(e, r.conyuge_1_id),
		conyuge_2: Qe(e, r.conyuge_2_id),
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
function Nt(e, t) {
	let n = e.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(t);
	if (!n) throw new V(kt, 404);
	return n.tipo === "matrimonio" ? Mt(e, t) : jt(e, n.tipo, t);
}
var Pt = {
	persona: "",
	conyuge_1: " del esposo",
	conyuge_2: " de la esposa",
	sacramento: "",
	detalle: ""
};
function Ft(e, t) {
	let n = lt(e);
	if (n) throw new V(`La ${t} está incompleta: ${n}.`, 400);
}
function It(e) {
	Ft(e.sacramento?.fecha_evento, "fecha del sacramento");
	for (let t of le(e.sacramento.tipo)) Ft(pe(e, t)?.fecha_nacimiento, `fecha de nacimiento${Pt[t]}`);
	if (e.sacramento.tipo === "matrimonio") {
		let t = e;
		Ft(t.conyuge_1_bautismo_fecha, "fecha de bautismo del esposo"), Ft(t.conyuge_2_bautismo_fecha, "fecha de bautismo de la esposa");
	}
}
function Lt(e, t) {
	let n = e.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(t);
	ut(e, n.tipo, n.client_id, n.version);
}
function Rt(e) {
	return [
		H(e.lugar),
		H(e.testigo_1),
		H(e.testigo_2),
		H(e.testigo_3),
		H(e.testigo_4),
		H(e.conyuge_1_bautismo_parroquia),
		H(e.conyuge_1_bautismo_fecha),
		H(e.conyuge_2_bautismo_parroquia),
		H(e.conyuge_2_bautismo_fecha)
	];
}
function zt(e, t) {
	return t.map((t) => ({
		parte: e,
		campo: t.campo_cambio,
		valor_anterior: t.valor_anterior ?? null,
		valor_nuevo: t.valor_nuevo
	}));
}
function Bt(e, t, n, r) {
	return le(n.sacramento.tipo).map((i) => {
		let a = pe(n, i), o = tt(a);
		return {
			id: $e(e, t, r ? o.person : a),
			part: i,
			corrections: o.corrections
		};
	});
}
function Vt(e) {
	return e.flatMap((e) => zt(e.part, e.corrections));
}
function Ht(e, t, n, r) {
	let i = n.sacramento.tipo;
	if (i === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, r[0], r[1], ...Rt(n));
		return;
	}
	let a = n;
	e.prepare(`INSERT INTO ${_t(i)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(t, r[0], H(a.padrino_1), H(a.padrino_2));
}
function Ut(e, t, n) {
	let r = n.sacramento.tipo;
	if (r === "matrimonio") {
		e.prepare("UPDATE matrimonios SET\n				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,\n				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,\n				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?\n			 WHERE sacramento_id = ?").run(...Rt(n), t);
		return;
	}
	let i = n;
	e.prepare(`UPDATE ${_t(r)} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(H(i.padrino_1), H(i.padrino_2), t);
}
function Wt(e, t, n, r) {
	It(r);
	let i = n.sacramento.id, a = [];
	for (let o of le(n.sacramento.tipo)) {
		let s = pe(n, o), c = s.id, l = pe(r, o), u = (l.cambios ?? []).filter((e) => e.id === void 0), d = tt({
			...l,
			cambios: [...s.cambios, ...u]
		});
		et(e, c, d.person), nt(e, t, c, i, d.corrections), a.push(...zt(o, d.corrections));
	}
	return Ot(e, i, r.sacramento), Ut(e, i, r), {
		fields: _e(n, r),
		corrections: a
	};
}
function Gt(e, t, n, r) {
	let i = pe(e, t), a = {
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
var Kt = "Solo un administrador de la parroquia puede aprobar o rechazar cambios.", qt = "La partida tiene un cambio pendiente de aprobación. Un administrador de la parroquia debe aprobarlo o rechazarlo primero.", Jt = "Descartada al editar la partida";
function Yt(e, t) {
	return e.map((e) => ({
		...e,
		tipo: t
	}));
}
function Xt(e, t) {
	let n = [];
	for (let r of le(e.sacramento.tipo)) {
		let i = pe(t, r), a = Array.isArray(i?.cambios) ? i.cambios.filter((e) => e.id === void 0) : [], o = pe(e, r), s = tt({
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
function Zt(e, t, n) {
	let r = U(n.sacramento?.id), i = Nt(e, r);
	if (qe(t, i.sacramento.parroquia_id, wt), i.sacramento.estado === "anulado") throw new V("Una partida anulada no admite cambios.", 409);
	if (je(e, r)) throw new V(qt, 409);
	let a = H(n.sacramento?.anotaciones), o = H(i.sacramento.anotaciones) === null && a !== null, s = _e(i, n).filter((e) => !(o && e.campo === "anotaciones")), c = Xt(i, n);
	if (c.some((e) => s.some((t) => t.parte === e.parte && t.campo === e.campo))) throw new V("No cambie el mismo dato en el formulario y en la nota marginal a la vez.", 400);
	if (s.length === 0 && c.length === 0 && !o) throw new V("No hay cambios para pedir.", 400);
	It(n);
	let l = [...Yt(s, "digitacion"), ...Yt(c, "nota_marginal")];
	e.transaction(() => {
		Lt(e, r), o && (e.prepare("UPDATE sacramentos SET anotaciones = ? WHERE id = ?").run(a, r), W(e, r, t.user_id, "editada", [{
			parte: "sacramento",
			campo: "anotaciones",
			valor_anterior: null,
			valor_nuevo: a
		}])), l.length > 0 && (Ne(e, r, t.user_id, l), W(e, r, t.user_id, "cambio_pedido", l));
	})();
}
function Qt(e, t) {
	let n = e;
	for (let e of t) n = e.tipo === "nota_marginal" ? Gt(n, e.parte, e.campo, e.valor_nuevo) : ge(n, e.parte, e.campo, e.valor_nuevo);
	return n;
}
function $t(e, t) {
	return t.every((t) => t.tipo === "digitacion" ? he(e, t.parte, t.campo) === t.valor_nuevo : (pe(e, t.parte).cambios ?? []).some((e) => e.id === void 0 && e.campo_cambio === t.campo && H(e.valor_nuevo) === t.valor_nuevo));
}
function en(e, t) {
	Ye(e, t.sacramento.parroquia_id, wt, Kt);
}
function tn(e, t, n, r) {
	if (r !== "aprobado" && r !== "rechazado") throw new V("Indique si aprueba o rechaza el cambio.", 400);
	let i = Nt(e, n);
	en(t, i);
	let a = Me(e, n);
	if (a.length === 0) throw new V("La partida no tiene cambios pendientes.", 409);
	e.transaction(() => {
		Lt(e, n), r === "aprobado" ? (Wt(e, t, i, Qt(i, a)), W(e, n, t.user_id, "cambio_aprobado", a)) : W(e, n, t.user_id, "cambio_rechazado", a), Pe(e, n, r, t.user_id), e.prepare("UPDATE sacramentos SET updated_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), n);
	})();
}
function nn(e, t, n, r) {
	let i = Me(e, n);
	if (i.length !== 0) {
		if ($t(r, i)) {
			Pe(e, n, "aprobado", t.user_id), W(e, n, t.user_id, "cambio_aprobado", i);
			return;
		}
		Pe(e, n, "descartado", t.user_id, Jt), W(e, n, t.user_id, "cambio_descartado", i, Jt);
	}
}
function rn(e, t) {
	if (t.role !== "admin_parroquia" || !t.parish_id) throw new V(Kt, 403);
	return e.prepare("SELECT r.sacramento_id, MIN(r.id) AS primera, u.nombre, u.apellido_paterno, u.apellido_materno\n			 FROM solicitudes_cambio r\n			 JOIN sacramentos s ON s.id = r.sacramento_id\n			 LEFT JOIN usuarios u ON u.id = r.usuario_id\n			 WHERE r.estado = 'pendiente' AND s.parroquia_id = ?\n			 GROUP BY r.sacramento_id\n			 ORDER BY primera").all(t.parish_id).map((t) => ({
		partida: Nt(e, t.sacramento_id),
		solicitado_por: Ee(t.nombre, t.apellido_paterno, t.apellido_materno)
	}));
}
var an = {
	"requests.pending": (e, { db: t, session: n }) => ({ pendientes: rn(t, n) }),
	"requests.review": (e, { db: t, session: n }) => (tn(t, n, U(e.sacramento_id), e.decision), { success: !0 })
}, on = 32, sn = 32, cn = 16, ln = {
	N: 2 ** 15,
	r: 8,
	p: 1,
	maxmem: 67108864
};
function un() {
	return w(on).toString("hex");
}
function dn(e, t, n, r) {
	return new Promise((i, a) => {
		E(e.normalize("NFKC"), t, r, n, (e, t) => {
			e ? a(e) : i(t);
		});
	});
}
async function fn(e) {
	let t = w(cn), n = await dn(e, t, ln, sn);
	return `scrypt:${ln.N}:${ln.r}:${ln.p}:${t.toString("base64")}:${n.toString("base64")}`;
}
var pn = 1e5, mn = 256;
function hn(e, t, n) {
	return new Promise((r, i) => {
		C(e, t, n, mn / 8, "sha256", (e, t) => {
			e ? i(e) : r(t);
		});
	});
}
async function gn(e) {
	let t = w(cn), n = await hn(e, t, pn);
	return `${pn}:${t.toString("base64")}:${n.toString("base64")}`;
}
async function _n(e, t) {
	let [n, r, i] = t.split(":");
	if (!/^\d+$/.test(n ?? "") || !r || !i) return !1;
	let a = Buffer.from(i, "base64"), o = await hn(e, Buffer.from(r, "base64"), Number(n));
	return o.length === a.length && D(o, a);
}
async function vn(e, t) {
	if (!t.startsWith("scrypt:")) return _n(e, t);
	let [, n, r, i, a, o] = t.split(":");
	if (!a || !o) return !1;
	let s = Buffer.from(o, "base64"), c = {
		N: Number(n),
		r: Number(r),
		p: Number(i),
		maxmem: ln.maxmem
	}, l = await dn(e, Buffer.from(a, "base64"), c, s.length);
	return D(l, s);
}
var yn = 12;
async function bn(e, t) {
	let n = w(cn), r = w(yn), i = await dn(e, n, ln, on), a = ee("aes-256-gcm", i, r), o = Buffer.concat([a.update(t), a.final()]);
	return {
		sal: n.toString("base64"),
		iv: r.toString("base64"),
		etiqueta: a.getAuthTag().toString("base64"),
		datos: o.toString("base64")
	};
}
async function xn(e, t) {
	let n = await dn(e, Buffer.from(t.sal, "base64"), ln, on);
	try {
		let e = S("aes-256-gcm", n, Buffer.from(t.iv, "base64"));
		return e.setAuthTag(Buffer.from(t.etiqueta, "base64")), Buffer.concat([e.update(Buffer.from(t.datos, "base64")), e.final()]);
	} catch {
		return null;
	}
}
//#endregion
//#region electron/main/db/migrations.ts
var Sn = [
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
	"\n  CREATE TABLE sacramentos_respaldo AS SELECT * FROM sacramentos;\n\n  DROP TABLE sacramentos;\n\n  CREATE TABLE sacramentos (\n    id                     INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id              TEXT    NOT NULL UNIQUE,\n    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),\n    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),\n    ministro_id            INTEGER REFERENCES ministros(id),\n    libro                  TEXT    NOT NULL,\n    folio                  TEXT    NOT NULL,\n    numero                 TEXT    NOT NULL,\n    fecha_emision          TEXT,\n    fecha_evento           TEXT,\n    anotaciones            TEXT,\n    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),\n    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    anulado_en             TEXT,\n    motivo_anulacion       TEXT,\n    version                INTEGER NOT NULL DEFAULT 1,\n    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    UNIQUE (id, tipo),\n    CHECK (\n      estado = 'vigente'\n      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL\n          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')\n    )\n  );\n\n  INSERT INTO sacramentos\n    (id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n     estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at)\n  SELECT\n    id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n    estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at\n  FROM sacramentos_respaldo;\n\n  DROP TABLE sacramentos_respaldo;\n\n  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);\n\n  CREATE TRIGGER trg_sacramentos_touch\n  AFTER UPDATE ON sacramentos\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE sacramentos\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  UPDATE sync_cola SET version_base = version_base + 1\n  WHERE version_base IS NOT NULL AND client_id IN (\n    SELECT client_id FROM sacramentos\n    WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL\n      AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada')\n  );\n\n  UPDATE sacramentos\n  SET fecha_emision = NULL, version = version + 1\n  WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL\n    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');\n  "
], Cn = /^[0-9a-f]{64}$/i, wn = class extends Error {};
function Tn(e, t) {
	let n = e.pragma("user_version", { simple: !0 });
	if (n > t.length) throw new wn(`La base local está en la versión ${n} y esta app solo conoce hasta la ${t.length}.`);
	e.pragma("foreign_keys = OFF");
	for (let r = n; r < t.length; r++) e.transaction(() => {
		if (e.exec(t[r]), e.pragma("foreign_key_check").length > 0) throw Error("La migración dejó claves foráneas rotas.");
		e.pragma(`user_version = ${r + 1}`);
	})();
	e.pragma("foreign_keys = ON");
}
function En(e, t, n = Sn) {
	if (!Cn.test(t)) throw Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	let r = new x(e);
	try {
		return r.pragma("cipher='chacha20'"), r.pragma(`hexkey='${t}'`), r.prepare("SELECT count(*) FROM sqlite_master").get(), r.pragma("foreign_keys = ON"), r.pragma("journal_mode = WAL"), r.pragma("synchronous = FULL"), Tn(r, n), r;
	} catch (e) {
		throw r.close(), e;
	}
}
function Dn(e) {
	let t = e?.code ?? "";
	return t.startsWith("SQLITE_NOTADB") || t.startsWith("SQLITE_CORRUPT");
}
function On(e) {
	return {
		directory: e,
		database: s.join(e, Se.database),
		key: s.join(e, Se.key),
		device: s.join(e, Se.device),
		temp_database: s.join(e, Se.temp_database),
		temp_key: s.join(e, Se.temp_key),
		set_aside_folder: s.join(e, Se.set_aside_folder)
	};
}
function kn(e) {
	if (u(e.device)) return f(e.device, "utf8").trim();
	let t = T();
	return _(e.device, t), t;
}
function An(e, t) {
	for (let n of [
		"",
		"-wal",
		"-shm"
	]) u(e + n) && m(e + n, t + n);
}
function jn(e) {
	for (let t of [
		"",
		"-wal",
		"-shm"
	]) h(e + t, { force: !0 });
}
function Mn(e) {
	u(e.set_aside_folder) && p(e.set_aside_folder).filter((e) => e.endsWith(".db")).sort().reverse().forEach((t, n) => {
		let r = s.join(e.set_aside_folder, t), i = Date.now() - g(r).mtimeMs > Ce;
		(n > 0 || i) && jn(r);
	});
}
function Nn(e) {
	if (!u(e.database)) return;
	d(e.set_aside_folder, { recursive: !0 });
	let t = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	An(e.database, s.join(e.set_aside_folder, `prelatura-local-${t}.db`)), Mn(e);
}
function Pn(e, t) {
	Mn(e);
	let n = t.read(e.key);
	if (!u(e.database)) {
		let r = n ?? un(), i = En(e.database, r);
		return n || t.write(e.key, r), {
			status: "open",
			db: i,
			key: r
		};
	}
	if (!n) return { status: "needs-recovery" };
	try {
		let t = En(e.database, n);
		return jn(e.temp_database), h(e.temp_key, { force: !0 }), {
			status: "open",
			db: t,
			key: n
		};
	} catch (e) {
		if (e instanceof wn) return {
			status: "failed",
			message: "La base local es de una versión más nueva. Actualice la aplicación."
		};
		if (Dn(e)) return { status: "needs-recovery" };
		throw e;
	}
}
function Fn(e, t, n) {
	try {
		let r = En(e.database, n);
		return t.write(e.key, n), r;
	} catch (e) {
		if (!Dn(e)) throw e;
		return null;
	}
}
function In(e, t) {
	let n = t.read(e.temp_key);
	(!n || !u(e.temp_database)) && (jn(e.temp_database), n = un(), t.write(e.temp_key, n));
	try {
		return {
			db: En(e.temp_database, n),
			key: n
		};
	} catch (t) {
		if (!Dn(t)) throw t;
		return jn(e.temp_database), {
			db: En(e.temp_database, n),
			key: n
		};
	}
}
function Ln(e, t, n) {
	jn(e.temp_database);
	let r = un();
	return t.write(e.temp_key, r), {
		db: En(e.temp_database, r, n),
		key: r
	};
}
function Rn(e, t, n) {
	return Nn(e), An(e.temp_database, e.database), t.write(e.key, n), h(e.temp_key, { force: !0 }), En(e.database, n);
}
//#endregion
//#region electron/main/db/app_database.ts
var zn = null, Bn = null, Vn = !1, Hn = "La base local no está disponible.";
function Un() {
	if (!a.isEncryptionAvailable()) throw Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
}
function Wn(e) {
	if (Un(), !u(e)) return null;
	try {
		return a.decryptString(f(e));
	} catch {
		return null;
	}
}
function Gn(e, t) {
	Un(), _(e, a.encryptString(t), { mode: 384 });
}
var Kn = {
	read: Wn,
	write: Gn
};
function qn() {
	return On(n.getPath("userData"));
}
function Jn() {
	let e = Pn(qn(), Kn);
	e.status === "open" ? (zn = e.db, Bn = e.key) : e.status === "needs-recovery" ? (Vn = !0, Hn = "La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.") : Hn = e.message;
}
function G() {
	if (!zn) throw new V(Hn, 503);
	return zn;
}
function Yn() {
	return Bn;
}
function Xn() {
	return Vn;
}
function Zn(e, t) {
	zn = e, Bn = t, Vn = !1;
}
function Qn() {
	zn?.close(), zn = null, Bn = null;
}
//#endregion
//#region electron/shared/index.ts
var $n = "local:request", er = "sin-conexion";
//#endregion
//#region electron/main/models/user.ts
function tr(e, t) {
	return e.prepare("SELECT parroquia_id, rol, principal, origen FROM membresias WHERE usuario_id = ? ORDER BY origen DESC, parroquia_id").all(t);
}
function nr(e, t) {
	return e.prepare("SELECT m.parroquia_id AS id, p.nombre, m.rol\n			 FROM membresias m\n			 JOIN parroquias p ON p.id = m.parroquia_id\n			 WHERE m.usuario_id = ?\n			 ORDER BY m.origen DESC, p.nombre").all(t);
}
function rr(e, t, n, r) {
	return n === "admin_general" ? {
		id: t,
		rol: n,
		parroquia_id: null,
		principal: e.prepare("SELECT principal FROM usuarios WHERE id = ?").get(t)?.principal === 1
	} : {
		id: t,
		rol: n,
		parroquia_id: r,
		principal: tr(e, t).find((e) => e.parroquia_id === r)?.principal === 1
	};
}
function ir(e, t, n) {
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
	let a = tr(e, t), o = a.find((e) => e.parroquia_id === n) ?? a.find((e) => e.origen === 1), s = a.filter((e) => e !== o);
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
var K = null, ar = null;
function or() {
	if (!K) throw new V("Sesión no válida.", 401);
	return K;
}
function sr() {
	return K;
}
function cr() {
	return ar;
}
function lr(e, t, n) {
	K = e, ar = {
		username: t,
		password: n
	};
}
function ur(e, t) {
	let n = or();
	if (n.role === "admin_general") throw new V("El administrador general no trabaja en ninguna parroquia: solo consulta.", 400);
	let r = tr(e, n.user_id).find((e) => e.parroquia_id === t);
	if (!r) throw new V("Esta cuenta no trabaja en esa parroquia: solo puede consultarla.", 403);
	return n.role = r.rol, n.parish_id = t, n;
}
function dr(e) {
	if (!K || K.role === "admin_general") return;
	let t = tr(e, K.user_id), n = t.find((e) => e.parroquia_id === K?.parish_id) ?? t.find((e) => e.origen === 1);
	n && (K.role = n.rol, K.parish_id = n.parroquia_id);
}
function fr() {
	K = null, ar = null;
}
//#endregion
//#region electron/main/utils/logger.ts
function pr(...e) {
	console.log(...e);
}
function mr(...e) {
	console.error(...e);
}
var hr = "http://localhost:8787", gr = null;
function _r(e) {
	if (!u(e)) return null;
	try {
		let t = JSON.parse(f(e, "utf8"));
		if (typeof t.servidor == "string" && /^https?:\/\/\S+$/.test(t.servidor.trim())) return t.servidor.trim().replace(/\/+$/, "");
		mr(`${e}: "servidor" debe ser una dirección que empiece con http:// o https://.`);
	} catch (t) {
		mr(`No se pudo leer ${e}:`, t);
	}
	return null;
}
function vr() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador") : s.join(n.getAppPath(), "resources", "instalador");
}
function yr() {
	if (gr) return gr;
	let e = process.env.PRELATURA_API_URL ?? _r(s.join(n.getPath("userData"), "configuracion.json")) ?? _r(s.join(vr(), "configuracion.json")) ?? "https://registro-sacramental-pruebas.registro-sacramental-prelatura.workers.dev" ?? hr;
	return pr(`Servidor: ${e}`), gr = e, e;
}
//#endregion
//#region electron/main/sync/online.ts
var br = "No se pudo conectar con el servidor. Verifique su conexión.", q = async (e, t = {}) => {
	let n = t.method ?? "GET", r = t.timeoutMs ?? 3e4, i = {};
	t.body !== void 0 && (i["Content-Type"] = "application/json"), t.token && (i.Authorization = `Bearer ${t.token}`);
	let a, o;
	try {
		a = await fetch(`${yr()}${e}`, {
			method: n,
			headers: i,
			body: t.body === void 0 ? void 0 : JSON.stringify(t.body),
			signal: AbortSignal.timeout(r)
		}), o = await a.json().catch(() => null);
	} catch {
		throw new V(br, 0);
	}
	if (!a.ok) throw new V(o?.message ? String(o.message) : "Ocurrió un error inesperado.", a.status);
	if (o === null) throw new V(br, 0);
	return o;
};
function xr(e) {
	return e instanceof V && (e.status === 0 || e.status >= 500);
}
function Sr(e, t, n) {
	return e("/api/auth/login", {
		method: "POST",
		body: {
			username: t,
			password: n
		},
		timeoutMs: ye
	});
}
function Cr(e, t) {
	return e("/api/reference", { token: t });
}
function wr(e, t, n) {
	return e("/api/sync/push", {
		method: "POST",
		body: { cambios: n },
		token: t
	});
}
function Tr(e, t, n) {
	return e(`/api/sync/pull?cursor=${encodeURIComponent(n)}`, { token: t });
}
function Er(e, t, n, r) {
	return e(`/api/sync/record?${`entidad=${encodeURIComponent(n)}&client_id=${encodeURIComponent(r)}`}`, { token: t });
}
function Dr(e, t, n) {
	return e(`/api/devices/${n}/key`, { token: t });
}
function Or(e, t, n, r) {
	return e(`/api/devices/${n}/key`, {
		method: "PUT",
		body: { clave: r },
		token: t
	});
}
//#endregion
//#region electron/main/sync/records.ts
var kr = class extends Error {};
function Ar(e, t, n) {
	e.prepare(`UPDATE ${t} SET version = -1 WHERE id = ?`).run(n);
}
function jr(e) {
	return e === "ministro" ? "ministros" : e === "usuario" ? "usuarios" : "sacramentos";
}
function Mr(e, t, n, r) {
	e.prepare(`UPDATE ${jr(t)} SET version = ? WHERE client_id = ? AND version <> ?`).run(r, n, r);
}
function Nr(e, t) {
	return e.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t);
}
function Pr(e, t) {
	return e.prepare("SELECT client_id, id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo,\n				password_hash_pendiente AS password_hash\n			 FROM usuarios WHERE client_id = ?").get(t);
}
function Fr(e, t) {
	let n = e.prepare("SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,\n				s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion\n			 FROM sacramentos s\n			 LEFT JOIN ministros m ON m.id = s.ministro_id\n			 WHERE s.client_id = ?").get(t), r = n.tipo, i = e.prepare(`SELECT * FROM ${_t(r)} WHERE sacramento_id = ?`).get(n.id), a = e.prepare(`SELECT client_id, ${z.join(", ")} FROM personas WHERE id = ?`), o = [];
	for (let e of vt(r)) o.push(a.get(i[e]));
	let s = {};
	for (let e of ce(r)) s[e] = i[e];
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
		solicitudes: Ie(e, n.id),
		historial: Ve(e, n.id)
	};
}
function Ir(e, t, n) {
	let r = z.map((e) => n[e]), i = e.prepare("SELECT id FROM personas WHERE client_id = ?").get(n.client_id);
	if (i) {
		let t = z.map((e) => `${e} = ?`).join(", ");
		return e.prepare(`UPDATE personas SET ${t} WHERE id = ?`).run(...r, i.id), i.id;
	}
	let a = z.map(() => "?").join(", "), o = e.prepare(`INSERT INTO personas (client_id, parroquia_id, ${z.join(", ")}) VALUES (?, ?, ${a})`).run(n.client_id, t, ...r);
	return Number(o.lastInsertRowid);
}
function Lr(e, t) {
	if (!t) return null;
	let n = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(t);
	if (!n) throw new kr(`Ministro desconocido: ${t}`);
	return n.id;
}
function Rr(e, t, n = !1) {
	let r = t.version ?? 1, i = e.prepare("SELECT id, version FROM sacramentos WHERE client_id = ?").get(t.client_id);
	if (!n && (dt(e, t.tipo, t.client_id) || i && i.version === r)) return;
	let a = Lr(e, t.ministro_client_id), o = t.personas.map((n) => Ir(e, t.parroquia_id, n)), s = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), c = [
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
	if (i) l = i.id, Ar(e, "sacramentos", i.id), e.prepare("UPDATE sacramentos SET\n				ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,\n				estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(...c, i.id);
	else {
		let n = e.prepare("INSERT INTO sacramentos\n					(ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n					 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,\n					 client_id, tipo, parroquia_id)\n				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...c, t.client_id, t.tipo, t.parroquia_id);
		l = Number(n.lastInsertRowid);
	}
	if (zr(e, t, l, o), Br(e, t, l, o), Le(e, l, t.solicitudes ?? []), He(e, l, t.historial ?? []), n) {
		let n = JSON.stringify(t.cambios.map((e) => e.client_id));
		e.prepare("DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(l, n), Re(e, l, t.solicitudes ?? []), Ue(e, l, t.historial ?? []), ft(e, t.tipo, t.client_id);
	}
}
function zr(e, t, n, r) {
	let i = t.detalle;
	if (t.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n			 ON CONFLICT (sacramento_id) DO UPDATE SET\n				conyuge_1_id = excluded.conyuge_1_id,\n				conyuge_2_id = excluded.conyuge_2_id,\n				lugar = excluded.lugar,\n				testigo_1 = excluded.testigo_1,\n				testigo_2 = excluded.testigo_2,\n				testigo_3 = excluded.testigo_3,\n				testigo_4 = excluded.testigo_4,\n				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,\n				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,\n				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,\n				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha").run(n, r[0], r[1], i.lugar ?? null, i.testigo_1 ?? null, i.testigo_2 ?? null, i.testigo_3 ?? null, i.testigo_4 ?? null, i.conyuge_1_bautismo_parroquia ?? null, i.conyuge_1_bautismo_fecha ?? null, i.conyuge_2_bautismo_parroquia ?? null, i.conyuge_2_bautismo_fecha ?? null);
		return;
	}
	e.prepare(`INSERT INTO ${_t(t.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (sacramento_id) DO UPDATE SET
			persona_id = excluded.persona_id,
			padrino_1 = excluded.padrino_1,
			padrino_2 = excluded.padrino_2`).run(n, r[0], i.padrino_1 ?? null, i.padrino_2 ?? null);
}
function Br(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	t.personas.forEach((e, t) => i.set(e.client_id, r[t]));
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,\n			 estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of t.cambios) a.run(e.client_id, i.get(e.persona_client_id), n, e.usuario_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, e.fecha_cambio, e.estado ?? "aprobado", e.revisado_por_usuario_id ?? null, e.revisado_en ?? null);
}
function Vr(e) {
	return `El nombre de usuario "${e}" ya lo tiene otra cuenta (creada en otra PC). Póngale otro nombre de usuario a esta cuenta en Configuración > Agregar usuario > Editar: después se sube sola.`;
}
function Hr(e) {
	return e.startsWith("~");
}
function Ur(e, t, n = !1) {
	if (t = {
		...t,
		client_id: t.client_id ?? `servidor-${t.id}`
	}, !n && dt(e, "usuario", t.client_id)) return;
	let r = e.prepare("SELECT id, client_id FROM usuarios WHERE username = ? AND id <> ? AND id < 0").get(t.username, t.id);
	r && dt(e, "usuario", r.client_id) && e.prepare("UPDATE sync_cola SET estado = 'rechazado', motivo = ? WHERE entidad = 'usuario' AND client_id = ?").run(Vr(t.username), r.client_id), e.prepare("UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?").run(t.username, t.id), e.prepare("UPDATE usuarios SET client_id = '~' || id WHERE client_id = ? AND id <> ?").run(t.client_id, t.id), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, updated_at)\n		 VALUES (@id, @client_id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo, @principal, @updated_at)\n		 ON CONFLICT (id) DO UPDATE SET\n			client_id = @client_id, parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,\n			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo,\n			principal = @principal, updated_at = @updated_at, password_hash_pendiente = NULL").run({
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
	}), Ar(e, "usuarios", t.id), e.prepare("UPDATE usuarios SET version = ? WHERE id = ?").run(t.version ?? 1, t.id), t.password_hash && e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n			 ON CONFLICT (usuario_id) DO UPDATE SET\n				verificador = excluded.verificador,\n				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t.id, t.password_hash), n && ft(e, "usuario", t.client_id);
}
function Wr(e, t, n) {
	let r = e.prepare("SELECT id FROM usuarios WHERE client_id = ?").get(t);
	if (!r || r.id === n) return null;
	let i = r.id;
	return e.pragma("defer_foreign_keys = ON"), e.prepare("UPDATE usuarios SET id = ? WHERE id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE sacramentos SET anulado_por_usuario_id = ? WHERE anulado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE historial_partidas SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE credenciales_locales SET usuario_id = ? WHERE usuario_id = ?").run(n, i), i;
}
var Gr = [
	"titulo",
	"nombre",
	"apellido_paterno",
	"apellido_materno",
	"activo"
];
function Kr(e, t, n = !1) {
	let r = t.version ?? 1, i = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), a = e.prepare("SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t.client_id);
	if (!n && dt(e, "ministro", t.client_id)) {
		let n = a !== void 0 && Gr.every((e) => (a[e] ?? null) === (t[e] ?? null)), i = e.prepare("SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?").get("ministro", t.client_id);
		if (!n || i.version_base !== null) return;
		ft(e, "ministro", t.client_id), Mr(e, "ministro", t.client_id, r);
		return;
	}
	if (!a) {
		e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t.client_id, t.parroquia_id, t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i);
		return;
	}
	(n || a.version !== r) && (Ar(e, "ministros", a.id), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i, a.id)), n && ft(e, "ministro", t.client_id);
}
//#endregion
//#region electron/main/sync/sync.ts
function qr(e, t) {
	let n = e.prepare("INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)\n		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa"), r = e.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?"), i = e.prepare("INSERT INTO usuario_parroquias (usuario_id, parroquia_id, rol, principal)\n		 SELECT @usuario_id, @parroquia_id, @rol, @principal\n		 WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = @usuario_id)\n			AND EXISTS (SELECT 1 FROM parroquias WHERE id = @parroquia_id)");
	e.transaction(() => {
		for (let e of t.parroquias) n.run(e);
		for (let n of t.ministros) r.run(n.client_id, `servidor-${n.id}`), Kr(e, n);
		for (let n of t.usuarios) Ur(e, n);
		e.prepare("DELETE FROM usuario_parroquias").run();
		for (let e of t.usuario_parroquias ?? []) i.run(e);
		e.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)");
	})();
}
async function Jr(e, t, n) {
	qr(e, await Cr(t, n)), dr(e);
}
function Yr(e, t) {
	return t.entidad === "ministro" ? Nr(e, t.client_id) : t.entidad === "usuario" ? Pr(e, t.client_id) : Fr(e, t.client_id);
}
function Xr(e, t, n) {
	if (!n) return;
	let r = Wr(e, t, n), i = sr();
	r !== null && i && i.user_id === r && (i.user_id = n);
}
function Zr(e, t, n) {
	e.transaction(() => {
		if (n.estado === "conflicto" || n.estado === "rechazado") {
			e.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(n.estado, n.motivo, t.id);
			return;
		}
		t.entidad === "usuario" && Xr(e, t.client_id, n.id), e.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(t.id).revision === t.revision ? (ft(e, t.entidad, t.client_id), Mr(e, t.entidad, t.client_id, n.version), t.entidad === "usuario" && e.prepare("UPDATE usuarios SET password_hash_pendiente = NULL WHERE client_id = ?").run(t.client_id)) : e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?").run(n.version, t.id);
	})();
}
var Qr = ["El administrador general solo consulta", "No tiene permiso para modificar"];
function $r(e, t) {
	if (t.entidad === "usuario") {
		let n = e.prepare("SELECT username FROM usuarios WHERE client_id = ?").pluck().get(t.client_id);
		return n === void 0 || !Hr(n);
	}
	let n = sr();
	if (!n) return !0;
	if (n.role === "admin_general") return !1;
	let r = t.entidad === "ministro" ? "ministros" : "sacramentos", i = e.prepare(`SELECT parroquia_id FROM ${r} WHERE client_id = ?`).pluck().get(t.client_id);
	return i === void 0 || e.prepare("SELECT 1 FROM membresias WHERE usuario_id = ? AND parroquia_id = ?").get(n.user_id, i) !== void 0;
}
function ei(e, t) {
	return t.entidad === "usuario" || t.entidad === "ministro" ? !1 : e.prepare("SELECT 1 FROM sacramentos s\n			 WHERE s.client_id = ?\n			   AND (s.anulado_por_usuario_id < 0\n				OR EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = s.id AND h.usuario_id < 0)\n				OR EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND (c.usuario_id < 0 OR c.revisado_por_usuario_id < 0))\n				OR EXISTS (SELECT 1 FROM solicitudes_cambio r WHERE r.sacramento_id = s.id AND (r.usuario_id < 0 OR r.revisado_por_usuario_id < 0)))").get(t.client_id) !== void 0;
}
function ti(e, t) {
	let n = e.prepare("SELECT estado, motivo FROM sync_cola WHERE id = ?").get(t);
	n.estado === "rechazado" && Qr.some((e) => n.motivo?.startsWith(e)) && e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ?").run(t);
}
async function ni(e, t, n) {
	let r = e.prepare("SELECT id, entidad, client_id FROM sync_cola WHERE estado <> 'conflicto' AND (entidad = 'usuario') = ? ORDER BY entidad = 'ministro' DESC, id");
	for (let i of [1, 0]) {
		let a = [];
		for (let t of r.all(i)) ei(e, t) ? e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE id = ? AND estado = 'rechazado'").run(t.id) : $r(e, t) ? a.push(t.id) : ti(e, t.id);
		await ri(e, t, n, a);
	}
}
async function ri(e, t, n, r) {
	let i = e.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let a = 0; a < r.length; a += 15) {
		let o = [];
		for (let e of r.slice(a, a + 15)) {
			let t = i.get(e);
			t && t.estado !== "conflicto" && o.push(t);
		}
		if (o.length === 0) continue;
		let s = await wr(t, n, o.map((t) => ({
			entidad: t.entidad,
			client_id: t.client_id,
			version_base: t.version_base,
			cola_id: t.cola_id,
			datos: Yr(e, t)
		})));
		for (let t = 0; t < o.length; t++) s.resultados[t] && Zr(e, o[t], s.resultados[t]);
	}
}
function ii(e, t) {
	e.transaction(() => {
		for (let n of t.partidas) Rr(e, n);
		mt(e, B.cursor, String(t.cursor));
	})();
}
function ai(e) {
	return e instanceof kr || e?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
async function oi(e, t, n) {
	for (;;) {
		let r = await Tr(t, n, pt(e, B.cursor) ?? "0");
		try {
			ii(e, r);
		} catch (i) {
			if (!ai(i)) throw i;
			await Jr(e, t, n), ii(e, r);
		}
		if (!r.hayMas) return;
	}
}
async function si(e, t, n) {
	await Jr(e, t, n), await ni(e, t, n), await oi(e, t, n), mt(e, B.last_sync, (/* @__PURE__ */ new Date()).toISOString());
}
async function ci(e, t, n, r, i, a) {
	let o = (await Er(t, n, r, i)).registro;
	e.transaction(() => {
		a === "local" ? e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?").run(o.version, r, i) : r === "ministro" ? Kr(e, o, !0) : r === "usuario" ? Ur(e, o, !0) : Rr(e, o, !0);
	})();
}
var li = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function ui(e, t) {
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
		return Hr(n.username) ? `Cuenta de ${r} (necesita otro nombre de usuario)` : `Usuario ${n.username} (${r})`;
	}
	let n = li[t.entidad], r = e.prepare("SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?").get(t.client_id);
	return r ? `${n}: libro ${r.libro}, folio ${r.folio}, registro ${r.numero}` : n;
}
function di(e) {
	let t = e.prepare("SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado").all(), n = (e) => {
		let n = t.find((t) => t.estado === e);
		return n ? n.total : 0;
	}, r = e.prepare("SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id").all().map((t) => ({
		entidad: t.entidad,
		client_id: t.client_id,
		estado: t.estado,
		motivo: t.motivo,
		descripcion: ui(e, t)
	}));
	return {
		pendientes: n("pendiente"),
		conflictos: n("conflicto"),
		rechazados: n("rechazado"),
		ultima_sync: pt(e, B.last_sync),
		aviso: pt(e, B.notice),
		items: r
	};
}
//#endregion
//#region electron/main/sync/recovery.ts
var fi = "La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.";
async function pi(e, t, n) {
	try {
		return (await Dr(t, n, kn(e))).clave;
	} catch (e) {
		if (e instanceof V && e.status === 404) return null;
		throw e;
	}
}
async function mi(e, t, n, r) {
	let i = In(e, t);
	try {
		await Jr(i.db, n, r), await oi(i.db, n, r), mt(i.db, B.last_sync, (/* @__PURE__ */ new Date()).toISOString()), mt(i.db, B.notice, fi), mt(i.db, B.key_registered, null);
	} finally {
		i.db.close();
	}
	return {
		db: Rn(e, t, i.key),
		key: i.key
	};
}
async function hi(e, t, n, r) {
	if (u(e.database)) {
		let i = await pi(e, n, r);
		if (i) {
			let n = Fn(e, t, i);
			if (n) return {
				db: n,
				key: i
			};
		}
	}
	return mi(e, t, n, r);
}
async function gi(e, t, n, r, i, a) {
	let o = pt(e, B.key_registered);
	if (o && (o !== "admin" || a === null)) return;
	let s = await Or(r, i, kn(t), n);
	mt(e, B.key_registered, s.parroquiaId === null ? "admin" : "parroquia");
}
//#endregion
//#region electron/main/sync/auto_sync.ts
var _i = "sin-conexion", vi = null, yi = null, bi = null;
function xi(e) {
	bi ||= setInterval(() => void J(), be), _i = e;
}
function Si() {
	bi && clearInterval(bi), bi = null;
}
function Ci() {
	_i = "sin-conexion", vi = null;
}
var wi = "Esta cuenta todavía no está en el servidor. Se subirá la próxima vez que el administrador de la parroquia sincronice con internet; hasta entonces puede trabajar sin conexión.";
function Ti(e) {
	if (e < 0) return !0;
	try {
		return !!G().prepare("SELECT password_hash_pendiente FROM usuarios WHERE id = ?").get(e)?.password_hash_pendiente;
	} catch {
		return !1;
	}
}
async function Ei() {
	let e = sr(), t = cr();
	if (!e || !t) return null;
	try {
		let n = await Sr(q, t.username, t.password);
		return e.token = n.token, n.token;
	} catch (t) {
		return e.token = "", xr(t) ? (_i = "sin-conexion", null) : Ti(e.user_id) ? (_i = "error", vi = wi, null) : (_i = "requiere-login", vi = "La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.", null);
	}
}
async function Di(e) {
	let t = sr()?.token || await Ei();
	if (t) try {
		await e(t);
	} catch (t) {
		if (!(t instanceof V && t.status === 401)) throw t;
		let n = await Ei();
		n && await e(n);
	}
}
async function Oi() {
	vi = null;
	try {
		let e = !1;
		await Di(async (t) => {
			let n = G();
			await si(n, q, t), e = !0;
			let r = Yn();
			r && await gi(n, qn(), r, q, t, sr()?.parish_id ?? null).catch((e) => {
				mr("No se pudo subir la copia de la clave:", e);
			});
		}), e && (_i = "en-linea");
	} catch (e) {
		if (xr(e)) {
			_i = "sin-conexion";
			return;
		}
		mr("Falló la sincronización:", e), _i = "error", vi = e instanceof V ? e.message : "Ocurrió un error al sincronizar.";
	}
}
function J() {
	return sr() ? (yi ||= Oi().finally(() => {
		yi = null;
	}), yi) : Promise.resolve();
}
function ki() {
	return yi ?? Promise.resolve();
}
function Ai() {
	return or(), {
		...di(G()),
		modo: _i,
		en_curso: yi !== null,
		mensaje: vi,
		token: sr()?.token || "sin-conexion"
	};
}
async function ji(e, t, n) {
	or();
	let r = !1;
	if (await Di(async (i) => {
		await ci(G(), q, i, e, t, n), r = !0;
	}), !r) throw new V("Se necesita conexión para resolver el conflicto.", 0);
	await J();
}
function Mi() {
	or(), mt(G(), B.notice, null);
}
async function Ni(e) {
	if (!sr() || di(G()).pendientes === 0) return;
	let t = new Promise((t) => setTimeout(t, e));
	await Promise.race([J(), t]);
}
//#endregion
//#region electron/main/utils/xlsx.ts
var Pi = 22;
function Fi(e) {
	return e.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Ii(e) {
	let t = "", n = e + 1;
	for (; n > 0;) {
		let e = (n - 1) % 26;
		t = String.fromCharCode(65 + e) + t, n = Math.floor((n - 1) / 26);
	}
	return t;
}
function Li(e, t, n) {
	if (e == null || e === "") return "";
	let r = n ? " s=\"1\"" : "";
	return typeof e == "number" ? `<c r="${t}"${r}><v>${e}</v></c>` : `<c r="${t}" t="inlineStr"${r}><is><t xml:space="preserve">${Fi(e)}</t></is></c>`;
}
function Ri(e) {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${`<cols><col min="1" max="${Math.max(1, ...e.rows.map((e) => e.length))}" width="${Pi}" customWidth="1"/></cols>`}<sheetData>${e.rows.map((e, t) => {
		let n = e.map((e, n) => Li(e, `${Ii(n)}${t + 1}`, t === 0)).join("");
		return `<row r="${t + 1}">${n}</row>`;
	}).join("")}</sheetData></worksheet>`;
}
function zi(e) {
	let t = {}, n = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>";
	return t["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${e.map((e, t) => `<Override PartName="/xl/worksheets/sheet${t + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`, t["_rels/.rels"] = n + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" + "</Relationships>", t["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${e.map((e, t) => `<sheet name="${Fi(e.name.slice(0, 31))}" sheetId="${t + 1}" r:id="rId${t + 1}"/>`).join("")}</sheets></workbook>`, t["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${e.map((e, t) => `<Relationship Id="rId${t + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${t + 1}.xml"/>`).join("")}${`<Relationship Id="rId${e.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`}</Relationships>`, t["xl/styles.xml"] = n + "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" + "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>" + "<fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills>" + "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" + "<cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/></cellXfs>" + "</styleSheet>", e.forEach((e, n) => {
		t[`xl/worksheets/sheet${n + 1}.xml`] = Ri(e);
	}), t;
}
var Bi = Array.from({ length: 256 }, (e, t) => {
	let n = t;
	for (let e = 0; e < 8; e++) n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
	return n >>> 0;
});
function Vi(e) {
	let t = 4294967295;
	for (let n of e) t = Bi[(t ^ n) & 255] ^ t >>> 8;
	return (t ^ 4294967295) >>> 0;
}
function Hi(e) {
	let t = [], n = [], r = 0;
	for (let [i, a] of Object.entries(e)) {
		let e = Buffer.from(i, "utf8"), o = Buffer.from(a, "utf8"), s = v(o), c = Vi(o), l = Buffer.alloc(30);
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
function Ui(e) {
	return Hi(zi(e));
}
//#endregion
//#region shared/sync.ts
var Wi = [
	"admin_general",
	"admin_parroquia",
	"usuario"
], Gi = {
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
}, Ki = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function qi(e) {
	return e ? new Date(e).toLocaleDateString("es-PE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}) : "";
}
function Ji(e) {
	return new Date(e).toLocaleString("es-PE", {
		dateStyle: "short",
		timeStyle: "short"
	});
}
function Yi(e) {
	return e ? [
		e.titulo,
		e.nombre,
		e.apellido_paterno,
		e.apellido_materno
	].filter(Boolean).join(" ") : "";
}
function Xi(e) {
	return Ee(e.nombres, e.apellido_paterno, e.apellido_materno);
}
function Zi(e) {
	return ct(e.fecha_nacimiento) || (e.fecha_aproximada ?? "");
}
function Qi(e) {
	return [
		e.dni,
		e.nombres,
		e.apellido_paterno,
		e.apellido_materno,
		Zi(e),
		e.lugar_nacimiento,
		e.padre,
		e.madre
	];
}
function $i(e) {
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
var ea = [
	"Libro",
	"Folio",
	"Número"
], ta = [
	"Celebrante",
	"Anotación marginal",
	"Estado",
	"Fecha de registro"
];
function na(e) {
	let t = e.sacramento;
	return [
		t.libro,
		t.folio,
		t.numero
	];
}
function ra(e) {
	let t = e.sacramento;
	return [
		Yi(t.ministro),
		t.anotaciones,
		t.estado === "anulado" ? "Anulada" : "Vigente",
		qi(t.created_at)
	];
}
function ia(e, t) {
	let n = `Fecha de ${Ki[e].toLowerCase()}`, r = [
		...ea,
		...$i(""),
		n,
		"Padrino",
		"Madrina",
		...ta
	], i = t.map((e) => [
		...na(e),
		...Qi(e.persona),
		ct(e.sacramento.fecha_evento),
		e.padrino_1,
		e.padrino_2,
		...ra(e)
	]);
	return {
		name: e === "bautismo" ? "Bautismos" : "Confirmaciones",
		rows: [r, ...i]
	};
}
function aa(e) {
	return {
		name: "Matrimonios",
		rows: [[
			...ea,
			...$i(" del esposo"),
			"Parroquia de bautismo del esposo",
			"Fecha de bautismo del esposo",
			...$i(" de la esposa"),
			"Parroquia de bautismo de la esposa",
			"Fecha de bautismo de la esposa",
			"Fecha de matrimonio",
			"Lugar del matrimonio",
			"Testigo 1",
			"Testigo 2",
			"Testigo 3",
			"Testigo 4",
			...ta
		], ...e.map((e) => [
			...na(e),
			...Qi(e.conyuge_1),
			e.conyuge_1_bautismo_parroquia,
			ct(e.conyuge_1_bautismo_fecha),
			...Qi(e.conyuge_2),
			e.conyuge_2_bautismo_parroquia,
			ct(e.conyuge_2_bautismo_fecha),
			ct(e.sacramento.fecha_evento),
			e.lugar,
			e.testigo_1,
			e.testigo_2,
			e.testigo_3,
			e.testigo_4,
			...ra(e)
		])]
	};
}
function oa(e) {
	if (e.sacramento.tipo === "matrimonio") {
		let t = e;
		return `${Xi(t.conyuge_1)} y ${Xi(t.conyuge_2)}`;
	}
	return Xi(e.persona);
}
function sa(e, t) {
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
	for (let n of t) for (let t of Be(e, n.sacramento.id)) {
		let e = t.campos.map((e) => `${de(e.parte, e.campo)}: ${e.texto_anterior ?? "(vacío)"} → ${e.texto_nuevo ?? "(vacío)"}`);
		r.push({
			fecha: t.fecha,
			cells: [
				Ji(t.fecha),
				Ki[n.sacramento.tipo],
				...na(n),
				oa(n),
				Gi[t.evento],
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
function ca(e, t, n) {
	return e.prepare("SELECT id FROM sacramentos\n			 WHERE parroquia_id = ? AND tipo = ?\n			 ORDER BY CAST(libro AS INTEGER), libro, CAST(folio AS INTEGER), folio, CAST(numero AS INTEGER), numero").pluck().all(t, n).map((t) => Nt(e, t));
}
function la(e, t) {
	let n = ca(e, t, "bautismo"), r = ca(e, t, "confirmacion"), i = ca(e, t, "matrimonio");
	return [
		ia("bautismo", n),
		ia("confirmacion", r),
		aa(i),
		sa(e, [
			...n,
			...r,
			...i
		])
	];
}
//#endregion
//#region electron/main/controllers/login.ts
async function ua(e, t, n) {
	let r = await fn(n);
	e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, r);
}
async function da(e, t, n) {
	let r = e.prepare("SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,\n				c.verificador, p.nombre AS parroquia_nombre\n			 FROM usuarios u\n			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id\n			 LEFT JOIN parroquias p ON p.id = u.parroquia_id\n			 WHERE u.username = ?").get(t);
	return !r || !r.verificador ? {
		ok: !1,
		reason: "sin-credencial"
	} : r.activo !== 1 || !await vn(n, r.verificador) ? {
		ok: !1,
		reason: "incorrecta"
	} : {
		ok: !0,
		usuario: {
			id: r.id,
			rol: r.rol,
			parroquia_id: r.parroquia_id,
			parroquia_nombre: r.parroquia_nombre,
			nombre_completo: Ee(r.nombre, r.apellido_paterno, r.apellido_materno),
			parroquias: nr(e, r.id)
		}
	};
}
async function fa(e, t, n) {
	let r = e.token, i = e.usuario;
	if (Xn()) {
		let e = await hi(qn(), Kn, q, r);
		Zn(e.db, e.key);
	}
	let a = G();
	try {
		await Jr(a, q, r);
	} catch (e) {
		if (!a.prepare("SELECT 1 FROM usuarios WHERE id = ?").get(i.id)) throw e;
	}
	return await ua(a, i.id, n), lr({
		user_id: i.id,
		role: i.rol,
		parish_id: i.parroquia_id,
		token: r
	}, t, n), xi("en-linea"), await J(), {
		...e,
		usuario: {
			...i,
			parroquias: nr(a, i.id)
		}
	};
}
function pa(e, t, n) {
	return lr({
		user_id: e.id,
		role: e.rol,
		parish_id: e.parroquia_id,
		token: ""
	}, t, n), xi("sin-conexion"), J(), {
		token: er,
		usuario: e
	};
}
var ma = "Este usuario todavía no está en esta PC. Conéctese a internet para entrar por primera vez, o restaure un respaldo.";
async function ha(e) {
	let t = typeof e?.username == "string" ? e.username.trim() : "", n = typeof e?.password == "string" ? e.password : "", r = {
		ok: !1,
		reason: "sin-credencial"
	};
	if (!Xn() && (r = await da(G(), t, n), r.ok)) return pa(r.usuario, t, n);
	let i;
	try {
		i = await Sr(q, t, n);
	} catch (e) {
		throw xr(e) ? Xn() ? new V("La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.", 503) : r.reason === "sin-credencial" ? new V(ma, 401) : new V("Usuario o contraseña incorrectos.", 401) : e;
	}
	return fa(i, t, n);
}
function ga() {
	Si(), fr(), Ci();
}
function _a(e, t) {
	if (!Number.isInteger(t)) throw new V("Parroquia no válida.", 400);
	let n = ur(e, t);
	return {
		rol: n.role,
		parroquia_id: n.parish_id
	};
}
var va = { "auth.selectParish": (e, { db: t }) => _a(t, e?.parroquia_id) }, ya = {
	"auth.login": ha,
	"auth.logout": () => (ga(), { success: !0 })
}, ba = "prelatura-paquete-inicial", xa = "paquete-inicial.json";
function Sa(e) {
	return e.prepare("SELECT COUNT(*) FROM usuarios").pluck().get() === 0;
}
function Ca(e, t) {
	if (t.role !== "admin_general") throw new V("Solo el administrador general puede generar el paquete inicial.", 403);
	if (e.prepare("SELECT COUNT(*) FROM sync_cola").pluck().get() > 0) throw new V("Hay cambios sin subir. Sincronice con internet antes de generar el paquete inicial.", 409);
	let n = e.prepare("SELECT u.id, u.client_id, u.parroquia_id, u.username, u.rol, u.nombre, u.apellido_paterno, u.apellido_materno,\n				u.activo, u.principal, u.version, u.updated_at, c.verificador AS password_hash\n			 FROM usuarios u\n			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id\n			 WHERE u.id > 0\n			 ORDER BY u.id").all(), r = e.prepare("SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at FROM ministros ORDER BY id").all(), i = e.prepare("SELECT client_id, version, created_at, updated_at FROM sacramentos ORDER BY id").all();
	return {
		formato: ba,
		version: 1,
		generado_en: (/* @__PURE__ */ new Date()).toISOString(),
		cursor: pt(e, B.cursor),
		parroquias: e.prepare("SELECT id, nombre, ubicacion, activa FROM parroquias ORDER BY id").all(),
		usuarios: n,
		usuario_parroquias: e.prepare("SELECT usuario_id, parroquia_id, rol, principal FROM usuario_parroquias WHERE usuario_id > 0 ORDER BY usuario_id, parroquia_id").all(),
		ministros: r,
		partidas: i.map((t) => ({
			...Fr(e, t.client_id),
			version: t.version,
			created_at: t.created_at,
			updated_at: t.updated_at
		}))
	};
}
function wa(e) {
	let t = e;
	if (!t || t.formato !== "prelatura-paquete-inicial") throw new V("El archivo no es un paquete inicial de esta aplicación.", 400);
	if (t.version !== 1) throw new V("El paquete inicial es de otra versión de la aplicación.", 400);
	if (!Array.isArray(t.parroquias) || !Array.isArray(t.usuarios) || !Array.isArray(t.ministros) || !Array.isArray(t.partidas)) throw new V("El paquete inicial está incompleto.", 400);
	return t;
}
function Ta(e, t) {
	let n = wa(t);
	if (!Sa(e)) throw new V("Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.", 409);
	return e.transaction(() => {
		qr(e, {
			parroquias: n.parroquias,
			ministros: n.ministros,
			usuarios: n.usuarios,
			usuario_parroquias: n.usuario_parroquias
		});
		for (let t of n.partidas) Rr(e, t);
		n.cursor && mt(e, B.cursor, n.cursor);
	})(), {
		parroquias: n.parroquias.length,
		usuarios: n.usuarios.length,
		partidas: n.partidas.length
	};
}
function Ea(e) {
	try {
		return JSON.parse(f(e, "utf8"));
	} catch {
		throw new V("No se pudo leer el paquete inicial.", 400);
	}
}
function Da() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador", xa) : s.join(n.getAppPath(), "resources", "instalador", xa);
}
function Oa() {
	if (process.env.PRELATURA_SIN_PAQUETE === "1") return;
	let e = process.env.PRELATURA_PAQUETE || Da(), t;
	try {
		t = G();
	} catch {
		return;
	}
	if (u(e) && Sa(t)) try {
		let n = Ta(t, Ea(e));
		pr(`Paquete inicial cargado: ${n.parroquias} parroquias, ${n.usuarios} usuarios y ${n.partidas} partidas.`);
	} catch (e) {
		mr("No se pudo cargar el paquete inicial del instalador:", e);
	}
}
function ka() {
	return t.getFocusedWindow() ?? void 0;
}
var Aa = { "package.status": () => {
	try {
		return { necesita_paquete: Sa(G()) };
	} catch {
		return { necesita_paquete: !1 };
	}
} }, ja = { "package.export": async (e, { db: t, session: n }) => {
	let i = Ca(t, n), a = {
		title: "Guardar el paquete inicial",
		defaultPath: xa,
		filters: [{
			name: "Paquete inicial",
			extensions: ["json"]
		}]
	}, o = ka(), s = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
	return s.canceled || !s.filePath ? { cancelado: !0 } : (_(s.filePath, JSON.stringify(i), "utf8"), {
		cancelado: !1,
		parroquias: i.parroquias.length,
		usuarios: i.usuarios.length,
		partidas: i.partidas.length
	});
} }, Ma = "prelatura-respaldo", Na = "respaldo", Pa = /^parroquia-\d+\.txt$/, Fa = "La contraseña no es la del respaldo, o el archivo está dañado.", Ia = "El archivo no es un respaldo de esta aplicación.", La = 200;
function Ra(e) {
	return e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all();
}
function za(e) {
	return s.join(e, Se.logos_folder);
}
function Ba(e, t) {
	let n = {};
	for (let t of Ra(e)) {
		let r = e.prepare(`SELECT * FROM "${t}"`).raw();
		n[t] = {
			columnas: r.columns().map((e) => e.name),
			filas: r.all()
		};
	}
	let r = {}, i = za(t);
	if (u(i)) for (let e of p(i).filter((e) => Pa.test(e))) r[e] = f(s.join(i, e), "utf8");
	return {
		version_base: e.pragma("user_version", { simple: !0 }),
		tablas: n,
		logos: r
	};
}
async function Va(e, t) {
	let n = await bn(t, b(JSON.stringify(e)));
	return JSON.stringify({
		formato: Ma,
		version: 1,
		creado_en: (/* @__PURE__ */ new Date()).toISOString(),
		...n
	});
}
async function Ha(e, t) {
	let n;
	try {
		n = JSON.parse(e);
	} catch {
		throw new V(Ia, 400);
	}
	if (n?.formato !== "prelatura-respaldo" || !n.sal || !n.iv || !n.etiqueta || !n.datos) throw new V(Ia, 400);
	if (n.version !== 1) throw new V("El respaldo es de otra versión de la aplicación.", 400);
	let r = await xn(t, n);
	if (!r) throw new V(Fa, 400);
	let i = JSON.parse(y(r).toString("utf8"));
	if (!Number.isInteger(i?.version_base) || i.version_base < 1 || typeof i.tablas != "object" || typeof i.logos != "object") throw new V(Ia, 400);
	return i;
}
function Ua(e, t) {
	let n = Ra(e);
	for (let e of Object.keys(t.tablas)) if (!n.includes(e)) throw new V(Ia, 400);
	let r = e.transaction(() => {
		for (let t of n) e.prepare(`DELETE FROM "${t}"`).run();
		for (let [n, r] of Object.entries(t.tablas)) {
			let t = e.pragma(`table_info("${n}")`).map((e) => e.name);
			if (!r.columnas.every((e) => t.includes(e))) throw new V(Ia, 400);
			let i = r.columnas.map((e) => `"${e}"`).join(", "), a = r.columnas.map(() => "?").join(", "), o = e.prepare(`INSERT INTO "${n}" (${i}) VALUES (${a})`);
			for (let e of r.filas) o.run(e);
		}
		if (e.prepare("DELETE FROM sync_estado WHERE clave = ?").run(B.key_registered), e.pragma("foreign_key_check").length > 0) throw new V("El respaldo está incompleto: hay datos que apuntan a registros que no están.", 400);
	});
	e.pragma("foreign_keys = OFF");
	try {
		r();
	} finally {
		e.pragma("foreign_keys = ON");
	}
}
function Wa(e, t, n) {
	if (n.version_base > Sn.length) throw new V("El respaldo es de una versión más nueva de la aplicación. Actualícela antes de restaurarlo.", 400);
	let r = Ln(e, t, Sn.slice(0, n.version_base));
	try {
		Ua(r.db, n);
	} finally {
		r.db.close();
	}
	return En(e.temp_database, r.key).close(), r.key;
}
function Ga(e, t) {
	let n = za(e);
	d(n, { recursive: !0 });
	for (let e of p(n).filter((e) => Pa.test(e))) h(s.join(n, e), { force: !0 });
	for (let [e, r] of Object.entries(t)) Pa.test(e) && typeof r == "string" && _(s.join(n, e), r, "utf8");
}
async function Ka(e) {
	let t = qn(), n = Wa(t, Kn, e);
	ga(), await ki(), Qn(), Zn(Rn(t, Kn, n), n), Ga(t.directory, e.logos);
}
function qa(e) {
	return s.join(e, Se.backup_log);
}
function Ja(e) {
	try {
		let t = JSON.parse(f(qa(e), "utf8"));
		return Array.isArray(t) ? t : [];
	} catch {
		return [];
	}
}
function Ya(e, t) {
	let n = [t, ...Ja(e)].slice(0, La);
	_(qa(e), JSON.stringify(n, null, 2), "utf8");
}
function Xa(e, t) {
	let n = e.prepare("SELECT username, nombre, apellido_paterno, apellido_materno FROM usuarios WHERE id = ?").get(t.user_id);
	if (!n) return "Usuario desconocido";
	let r = Ee(n.nombre, n.apellido_paterno, n.apellido_materno);
	return r ? `${r} (${n.username})` : n.username;
}
function Za(e) {
	let { dir: t, name: n } = s.parse(e);
	return s.join(t, `${n}.xlsx`);
}
function Qa(e) {
	if (e.role !== "admin_parroquia") throw new V("Solo el administrador de una parroquia puede hacer o restaurar respaldos.", 403);
}
function $a(e, t) {
	let n = typeof e == "string" ? e : "";
	if (t && n.length < 8) throw new V("La contraseña del respaldo debe tener al menos 8 caracteres.", 400);
	if (!n) throw new V("Escriba la contraseña del respaldo.", 400);
	return n;
}
function eo(e, t) {
	return e.tablas[t]?.filas.length ?? 0;
}
function to(e) {
	return {
		cancelado: !1,
		partidas: eo(e, "sacramentos"),
		pendientes: eo(e, "sync_cola")
	};
}
async function no(e, t) {
	let n = $a(e, !1), i = {
		title: "Elegir el respaldo",
		properties: ["openFile"],
		filters: [{
			name: "Respaldo",
			extensions: [Na]
		}]
	}, a = ka(), o = a ? await r.showOpenDialog(a, i) : await r.showOpenDialog(i);
	if (o.canceled || o.filePaths.length === 0) return { cancelado: !0 };
	let c;
	try {
		c = f(o.filePaths[0], "utf8");
	} catch {
		throw new V("No se pudo leer el respaldo.", 400);
	}
	let l = await Ha(c, n);
	return await Ka(l), Ya(qn().directory, {
		fecha: (/* @__PURE__ */ new Date()).toISOString(),
		usuario: t,
		accion: "restauro",
		archivo: s.basename(o.filePaths[0])
	}), to(l);
}
function ro() {
	try {
		return Sa(G());
	} catch {
		return !1;
	}
}
var io = {
	"backup.export": async (e, { db: t, session: n }) => {
		Qa(n);
		let i = $a(e?.password, !0), a = {
			title: "Guardar el respaldo",
			defaultPath: `respaldo-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${Na}`,
			filters: [{
				name: "Respaldo",
				extensions: [Na]
			}]
		}, o = ka(), c = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
		if (c.canceled || !c.filePath) return { cancelado: !0 };
		let l = qn().directory, u = Ba(t, l);
		_(c.filePath, await Va(u, i), "utf8");
		let d = Za(c.filePath);
		Ya(l, {
			fecha: (/* @__PURE__ */ new Date()).toISOString(),
			usuario: Xa(t, n),
			accion: "exporto",
			archivo: s.basename(c.filePath)
		});
		try {
			_(d, Ui(la(t, n.parish_id)));
		} catch {
			throw new V(`Se guardó el respaldo, pero no el Excel: puede que "${s.basename(d)}" esté abierto. Ciérrelo y vuelva a exportar.`, 409);
		}
		return {
			...to(u),
			archivo: s.basename(c.filePath),
			excel: s.basename(d)
		};
	},
	"backup.restore": (e, { db: t, session: n }) => (Qa(n), no(e?.password, Xa(t, n))),
	"backup.log": (e, { session: t }) => (Qa(t), { registros: Ja(qn().directory) })
}, ao = { "backup.restoreEmpty": (e) => {
	if (!ro()) throw new V("Esta PC ya tiene usuarios: entre como administrador y restaure el respaldo desde Configuración.", 409);
	return no(e?.password, "Sin sesión (PC nueva)");
} }, oo = 50, so = 75, co = .75, lo = [
	"dni",
	"nombres",
	"apellido_paterno",
	"apellido_materno",
	"fecha_nacimiento",
	"padre",
	"madre"
], uo = {
	dni: 40,
	nombres: 25,
	apellido_paterno: 20,
	apellido_materno: 15,
	fecha_nacimiento: 20,
	padre: 10,
	madre: 10
}, fo = {
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
function po(e, t) {
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
function mo(e, t) {
	if (!e || !t) return 0;
	if (e === t) return 1;
	let n = e.split(" "), r = t.split(" "), i = n.length <= r.length ? n : r, a = n.length <= r.length ? r : n;
	if (i.every((e) => a.includes(e))) return .85;
	let o = Math.max(e.length, t.length);
	if (Math.abs(e.length - t.length) / o > .25) return 0;
	let s = 1 - po(e, t) / o;
	return s >= co ? s : 0;
}
function ho(e, t) {
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
function go(e, t, n) {
	let r = !!(e.dni && t.dni), i = r && e.dni === Y(t.dni), a = (r, i) => {
		let a = [Y(i), ...n.get(`${t.persona_id}:${r}`) ?? []];
		return Math.max(...a.map((t) => mo(e[r], t)));
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
		fecha_nacimiento: ho(e.fecha_nacimiento, Y(t.fecha_nacimiento)),
		padre: {
			comparable: !!(e.padre && t.padre),
			value: mo(e.padre, Y(t.padre))
		},
		madre: {
			comparable: !!(e.madre && t.madre),
			value: mo(e.madre, Y(t.madre))
		}
	}, l = 0, u = 0, d = [];
	for (let e of lo) {
		let t = c[e];
		t.comparable && (u += uo[e], l += uo[e] * t.value, t.value >= co && d.push(fo[e]));
	}
	let f = Math.round(l / u * 100), p = o >= co && s >= co, m = r && !i, h = !1;
	for (let e of [
		"fecha_nacimiento",
		"padre",
		"madre"
	]) c[e].comparable && c[e].value >= co && (h = !0);
	return i && (o > 0 || s > 0) || p && h && !m ? {
		nivel: "alta",
		porcentaje: f,
		coincide: d
	} : i || f >= so ? {
		nivel: "posible",
		porcentaje: f,
		coincide: d
	} : null;
}
function _o(e) {
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
function vo(e, t) {
	let n = Number(t.nivel === "alta") - Number(e.nivel === "alta");
	return n === 0 ? t.porcentaje - e.porcentaje : n;
}
function yo(e, t, n, r) {
	if (!gt(t)) throw new V("Tipo de sacramento inválido.", 400);
	let i = r.map((e) => ({
		para: e.para ?? "",
		values: _o(e)
	})).filter((e) => e.values.dni || e.values.nombres && e.values.apellido_paterno);
	if (i.length === 0) return {
		matches: [],
		total: 0
	};
	let a = Number.isInteger(n) ? n : 0, o = e.prepare(`SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, par.nombre AS parroquia_nombre,
				pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
			 FROM (${yt(t)}) sub
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
			let r = go(e.values, n, s);
			r && t.push({
				sacramento_id: n.id,
				para: e.para,
				nivel: r.nivel,
				porcentaje: r.porcentaje,
				coincide: r.coincide,
				nombre_completo: Ee(n.nombres, n.apellido_paterno, n.apellido_materno),
				parroquia_nombre: n.parroquia_nombre,
				libro: n.libro,
				folio: n.folio,
				numero: n.numero
			});
		}
		l += t.length, t.sort(vo), u.push(...t.slice(0, oo));
	}
	return u.sort(vo), {
		matches: u,
		total: l
	};
}
var bo = { "sacraments.findDuplicates": (e, { db: t }) => yo(t, e.tipo, e.excluir_sacramento_id, e.personas) }, xo = /^[$_\u0080-\uFFFFa-zA-Z][$_\u0080-\uFFFF\w]*$/;
function So(e) {
	let t = {}, n = {}, r = e(), i = e.toString(), a = i.slice(i.indexOf("[") + 1, i.lastIndexOf("]")).split(",").map((e) => e.trim());
	for (let e of a) if (!xo.test(e)) throw Error(`Invalid dependency name: ${e}`);
	let o = 0;
	for (; o < r.length;) {
		let e = a[o], i = r[o];
		typeof i == "function" ? t[e] = Co(i, e) : n[e] = i, o++;
	}
	return {
		functions: t,
		variables: n
	};
}
function Co(e, t) {
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
function wo(e, t, n, r, i, a) {
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
			let d = i(), f = d && d._, p = f || Eo(t, c);
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
var To = ")(postMessage)}";
function Eo(e, t) {
	let [n, r] = Do(t);
	return [n + ";var onMessage = function(data) {for (var key in data) {self[key] = data[key]}onMessage = (" + e.toString() + To, r];
}
function Do(e) {
	let t = {}, n = {};
	for (let r of e) {
		let { functions: e, variables: i } = So(r);
		t = Object.assign(Object.assign({}, t), e), n = Object.assign(Object.assign({}, n), i);
	}
	return [Object.keys(t).map((e) => e + "=" + t[e]).join(";"), n];
}
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunctionOrStream.js
function Oo(e, t, n, r, i, a) {
	let o = !1, s = !1, c = [], l = () => [], u = () => [], d, f, p = (e) => ko[e], m = (e, t) => {
		ko[e] = t;
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
	return x = wo(e, (e) => {
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
var ko = {};
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunction.js
function Ao(e, t) {
	let n, r;
	return Oo(e, t, (e, t, i, a, o, s, c, l) => ({
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
function jo(e, t, n, r, i) {
	let a = !1, o = !1, s = t();
	s || (s = Mo(e), n(s));
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
function Mo(e) {
	return e + ";" + No;
}
var No = "var workerThreads = require(\"worker_threads\");workerThreads.parentPort.on(\"message\", function(data) {onMessage(data)});var postMessage = function(data, transferList) {workerThreads.parentPort.postMessage(data, transferList)};self = global";
//#endregion
//#region node_modules/worker-f/lib/export/node/createWorkerFunctionInNode.js
function Po(e) {
	return Ao(jo, e);
}
//#endregion
//#region node_modules/read-excel-file/modules/saxen/parser.js
function Fo(e) {
	"@babel/helpers - typeof";
	return Fo = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Fo(e);
}
function Io(e) {
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
		var t = e && e.proxy, n, r, i, a, v = g, y, b, x, ee, S = h, C = !1, w = !1, T = "", E = !1, D = !1, O = null, k = !1, te, A, j, ne;
		function M(e) {
			e instanceof Error || (e = c(e)), O = e, v(e, S);
		}
		function N(e) {
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
			if (e === void 0 && (e = {}), Fo(e) !== "object") throw c("required args <nsMap={}>");
			var t = {}, n;
			for (n in e) t[n] = e[n];
			return D = !0, ne = t, this;
		};
		function re() {
			te = D ? [] : null, A = D ? m(ne) : null, j = [], S = h, k = !1, O = null, w = !1, T = "";
		}
		this.parse = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			if (C) throw c("parse during stream; call end() first");
			return re(), P(e), S = h, k = !1, O;
		}, this.write = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			return C ||= (re(), !0), O || (T = P(T + e, !0) || ""), this;
		}, this.end = function() {
			return C || re(), C = !1, O || P(T), T = "", S = h, k = !1, O;
		}, this.stop = function() {
			k = !0;
		};
		function P(e) {
			var c = arguments.length > 1 && arguments[1] !== void 0 && arguments[1], m = null, h = null, g, _ = 0, v = !1, y = !1, C = 0, T = 0, O, re, P, F, I, L, R, ie, ae, oe = "", z = 0, se;
			function ce(e, t) {
				var n = e.indexOf(":");
				if (n === -1) return e;
				var r = A[e.substring(0, n)];
				return r ? t === r ? e.substr(n + 1) : r + e.substr(n) : (N(l(e.substring(0, n))), null);
			}
			function le() {
				if (se !== null) return se;
				var e, t, n = D && A.xmlns, r = D && E ? [] : null, i = z, a = oe, s = a.length, c, l, u, f, m, h = {}, g = /* @__PURE__ */ new Set(), v, y, b;
				parseAttr: for (; i < s; i++) if (v = !1, y = a.charCodeAt(i), !(y === 32 || y < 14 && y > 8)) {
					for ((y < 65 || y > 122 || y > 90 && y < 97) && y !== 95 && y !== 58 && (N("illegal first char attribute name"), v = !0), b = i + 1; b < s; b++) if (y = a.charCodeAt(b), !(y > 96 && y < 123 || y > 64 && y < 91 || y > 47 && y < 59 || y === 46 || y === 45 || y === 95)) {
						if (y === 32 || y < 14 && y > 8) {
							N("missing attribute value"), i = b;
							continue parseAttr;
						}
						if (y === 61) break;
						N("illegal attribute name char"), v = !0;
					}
					if (m = a.substring(i, b), m === "xmlns:xmlns" && (N("illegal declaration of xmlns"), v = !0), y = a.charCodeAt(b + 1), y === 34) b = a.indexOf("\"", i = b + 2), b === -1 && (b = a.indexOf("'", i), b !== -1 && (N("attribute value quote missmatch"), v = !0));
					else if (y === 39) b = a.indexOf("'", i = b + 2), b === -1 && (b = a.indexOf("\"", i), b !== -1 && (N("attribute value quote missmatch"), v = !0));
					else for (N("missing attribute value quotes"), v = !0, b += 1; b < s && (y = a.charCodeAt(b + 1), !(y === 32 || y < 14 && y > 8)); b++);
					for (b === -1 && (N("missing closing quotes"), b = s, v = !0), v || (u = a.substring(i, b)), i = b; b + 1 < s && (y = a.charCodeAt(b + 1), !(y === 32 || y < 14 && y > 8)); b++) i === b && (N("illegal character after attribute end"), v = !0);
					if (i = b + 1, v) continue parseAttr;
					if (g.has(m)) {
						N("attribute <" + m + "> already defined");
						continue;
					}
					if (g.add(m), !D) {
						h[m] = u;
						continue;
					}
					if (E) {
						if (l = m === "xmlns" ? "xmlns" : m.charCodeAt(0) === 120 && m.substr(0, 6) === "xmlns:" ? m.substr(6) : null, l !== null) {
							if (e = o(u), t = p(l), f = ne[e], !f) {
								if (l === "xmlns" || t in A && A[t] !== e) do
									f = "ns" + _++;
								while (A[f] !== void 0);
								else f = l;
								ne[e] = f;
							}
							A[l] !== f && (c ||= (A = d(A), !0), A[l] = f, l === "xmlns" && (A[p(f)] = e, n = f), A[t] = e), h[m] = u;
							continue;
						}
						r.push(m, u);
						continue;
					}
					m = ce(m, n), m !== null && (h[m] = u);
				}
				if (E) for (i = 0, s = r.length; i < s; i++) m = ce(r[i++], n), u = r[i], m !== null && (h[m] = u);
				return se = h;
			}
			function ue() {
				for (var t = /(\r\n|\r|\n)/g, n = 0, r = 0, i = 0, a = T, o, s; C >= i && (o = t.exec(e), !(!o || (a = o[0].length + o.index, a > C)));) n += 1, i = a;
				return C == -1 ? (r = a, s = e.substring(T)) : T === 0 ? s = e.substring(T, C) : (r = C - i, s = T == -1 ? e.substring(C) : e.substring(C, T + 1)), {
					data: s,
					line: n,
					column: r
				};
			}
			for (S = ue, t && (ae = Object.create({}, {
				name: u(function() {
					return R;
				}),
				originalName: u(function() {
					return ie;
				}),
				attrs: u(le),
				ns: u(function() {
					return A;
				})
			})); T !== -1;) {
				if (C = e.charCodeAt(T) === 60 ? T : e.indexOf("<", T), C === -1) {
					if (c) return e.substring(T);
					if (j.length) return M("unexpected end of file");
					if (!w) return M("missing start tag");
					T < e.length && e.substring(T).trim() && N(s);
					return;
				}
				if (w ||= !0, T !== C) {
					if (j.length) {
						if (n && (n(e.substring(T, C), o, S), k)) return;
					} else if (e.substring(T, C).trim() && (N(s), k)) return;
				}
				if (F = e.charCodeAt(C + 1), F === 33) {
					if (P = e.charCodeAt(C + 2), P === 91 && e.substr(C + 3, 6) === "CDATA[") {
						if (T = e.indexOf("]]>", C), T === -1) return c ? e.substring(C) : M("unclosed cdata");
						if (a && (a(e.substring(C + 9, T), S), k)) return;
						T += 3;
						continue;
					}
					if (P === 45 && e.charCodeAt(C + 3) === 45) {
						if (T = e.indexOf("-->", C), T === -1) return c ? e.substring(C) : M("unclosed comment");
						if (b && (b(e.substring(C + 4, T), o, S), k)) return;
						T += 3;
						continue;
					}
				}
				if (F === 63) {
					if (T = e.indexOf("?>", C), T === -1) return c ? e.substring(C) : M("unclosed question");
					if (x && (x(e.substring(C, T + 2), S), k)) return;
					T += 2;
					continue;
				}
				for (O = C + 1;; O++) {
					if (I = e.charCodeAt(O), isNaN(I)) return c ? e.substring(C) : (T = -1, M("unclosed tag"));
					if (I === 34) P = e.indexOf("\"", O + 1), O = P === -1 ? O : P;
					else if (I === 39) P = e.indexOf("'", O + 1), O = P === -1 ? O : P;
					else if (I === 62) {
						T = O;
						break;
					}
				}
				if (F === 33) {
					if (ee && (ee(e.substring(C, T + 1), o, S), k)) return;
					T += 1;
					continue;
				}
				if (se = {}, F === 47) {
					if (v = !1, y = !0, !j.length) return M("missing open tag");
					if (O = R = j.pop(), P = C + 2 + O.length, e.substring(C + 2, P) !== O) return M("closing tag mismatch");
					for (; P < T; P++) if (F = e.charCodeAt(P), !(F === 32 || F > 8 && F < 14)) return M("close tag");
				} else {
					if (e.charCodeAt(T - 1) === 47 ? (O = R = e.substring(C + 1, T - 1), v = !0, y = !0) : (O = R = e.substring(C + 1, T), v = !0, y = !1), !(F > 96 && F < 123 || F > 64 && F < 91 || F === 95 || F === 58)) return M("illegal first char nodeName");
					for (P = 1, re = O.length; P < re; P++) if (F = O.charCodeAt(P), !(F > 96 && F < 123 || F > 64 && F < 91 || F > 47 && F < 59 || F === 45 || F === 95 || F == 46)) {
						if (F === 32 || F < 14 && F > 8) {
							R = O.substring(0, P), se = null;
							break;
						}
						return M("invalid nodeName");
					}
					y || j.push(R);
				}
				if (D) {
					g = A, v && (y || te.push(g), se === null && (E = O.indexOf("xmlns", P) !== -1) && (z = P, oe = O, le(), E = !1)), ie = R, h !== A && (m = A[f], m === void 0 && (m = A[f] = {}), h = A);
					var de = m[R];
					if (de !== void 0) R = de;
					else {
						if (F = R.indexOf(":"), F !== -1) {
							if (L = A[R.substring(0, F)], !L) return M("missing namespace on <" + ie + ">");
							R = R.substr(F + 1);
						} else L = A.xmlns;
						L && (R = L + ":" + R), m[ie] = R;
					}
				}
				if (v && (z = P, oe = O, r && (t ? r(ae, o, y, S) : r(R, le, o, y, S), k))) return;
				if (y) {
					if (i && (i(t ? ae : R, o, v, S), k)) return;
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
function Lo(e, t, n, r) {
	var i = !1, a = function() {
		if (i) throw Error("Errored");
	}, o, s = new Io();
	return {
		promise: new Promise(function(a, c) {
			o = a, s.on("error", function(e) {
				throw i = !0, e;
			}), s.on("text", function(t, n) {
				r && r(n(t), e);
			}), s.on("openTag", function(n, r, i, a, o) {
				if (t) {
					var s = r();
					for (var c in s) s[Ro(c, !0)] = i(s[c]);
					t(Ro(n), s, e);
				}
			}), s.on("closeTag", function(t) {
				n && n(Ro(t), e);
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
function Ro(e, t) {
	for (var n = 0; n < e.length;) {
		if (e[n] === ":" && !(t && n === 5 && e.slice(0, 5) === "xmlns")) return e.slice(n + 1);
		n++;
	}
	return e;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/InvalidSpreadsheetError.js
function zo(e) {
	"@babel/helpers - typeof";
	return zo = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, zo(e);
}
function Bo(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Ho(r.key), r);
	}
}
function Vo(e, t, n) {
	return t && Bo(e.prototype, t), n && Bo(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Ho(e) {
	var t = Uo(e, "string");
	return zo(t) === "symbol" ? t : String(t);
}
function Uo(e, t) {
	if (zo(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (zo(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Wo(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Go(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && $o(e, t);
}
function Ko(e) {
	var t = Zo();
	return function() {
		var n = es(e), r;
		if (t) {
			var i = es(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return qo(this, r);
	};
}
function qo(e, t) {
	if (t && (zo(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Jo(e);
}
function Jo(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Yo(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Yo = function(e) {
		if (e === null || !Qo(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Xo(e, arguments, es(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), $o(n, e);
	}, Yo(e);
}
function Xo(e, t, n) {
	return Xo = Zo() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && $o(i, n.prototype), i;
	}, Xo.apply(null, arguments);
}
function Zo() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Qo(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function $o(e, t) {
	return $o = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, $o(e, t);
}
function es(e) {
	return es = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, es(e);
}
var ts = /*#__PURE__*/ function(e) {
	Go(n, e);
	var t = Ko(n);
	function n(e) {
		var r;
		return Wo(this, n), r = t.call(this, e), r.name = "InvalidSpreadsheetError", r;
	}
	return Vo(n);
}(/*#__PURE__*/ Yo(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXml.js
function ns(e, t, n, r, i, a) {
	var o = Lo(t, n, r, i);
	return a ? s(o, e, a) : (o.write(e), o.end()), o.promise.then(function(e) {
		return e;
	}, function(e) {
		var t = new ts(e.message);
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
var rs = class extends Error {
	constructor(e, t) {
		super(t || e), this.code = e;
	}
};
function is(e) {
	let t = new rs(e.code, e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace(t, is), t.cause = e, t;
}
//#endregion
//#region node_modules/unzipper-esm/lib/PullStream.js
var as = "function", os = function() {
	this.buffer = Buffer.from("");
	let e = this;
	e.on("finish", function() {
		e.finished = !0, e.emit("chunk", !1);
	});
}, ss = function(e, t, n) {
	this.buffer = Buffer.concat([this.buffer, e]), this.cb = n, this.emit("chunk");
}, cs = function(e, t) {
	let n = new A(), r, i = this;
	function a() {
		if (typeof i.cb === as) {
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
			i.removeListener("chunk", o), i.emit("error", new rs("FILE_ENDED"));
			return;
		}
	}
	return i.on("chunk", o), o(), n;
}, ls = function(e, t) {
	if (e === 0) return Promise.resolve("");
	if (!isNaN(e) && this.buffer.length > e) {
		let t = this.buffer.slice(0, e);
		return this.buffer = this.buffer.slice(e), Promise.resolve(t);
	}
	let n = Buffer.from(""), r = this, i = new j({ transform: a });
	function a(e, t, r) {
		n = Buffer.concat([n, e]), r();
	}
	let o, s;
	return new Promise(function(a, c) {
		if (o = c, s = function(e) {
			r.__emittedError = e, c(e);
		}, r.finished) return c(new rs("FILE_ENDED"));
		r.once("error", s), r.stream(e, t).on("error", c).pipe(i).on("finish", function() {
			a(n);
		}).on("error", c);
	}).finally(function() {
		r.removeListener("error", o), r.removeListener("error", s);
	});
}, us = class extends te {
	constructor() {
		super({
			decodeStrings: !1,
			objectMode: !0
		}), os.call(this);
	}
	_write(e, t, n) {
		return ss.call(this, e, t, n);
	}
	stream(e, t) {
		return cs.call(this, e, t);
	}
	pull(e, t) {
		return ls.call(this, e, t);
	}
	_read() {}
}, ds = class extends j {
	_transform(e, t, n) {
		n();
	}
};
//#endregion
//#region node_modules/unzipper-esm/lib/BufferStream.js
function fs(e) {
	return new Promise(function(t, n) {
		let r = [], i = new j({ transform: a }).on("finish", function() {
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
function ps(e, t, n) {
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
function ms(e, t) {
	let n = {}, r = 0;
	for (let [i, a] of t) n[i] = e.length >= r + a ? ps(e, r, a) : null, r += a;
	return n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseExtraField.js
function hs(e, t) {
	let n;
	for (; !n && e && e.length;) {
		let r = ms(e, [["signature", 2], ["partSize", 2]]);
		if (r.signature === 1) {
			let r = [];
			t.uncompressedSize === 4294967295 && r.push(["uncompressedSize", 8]), t.compressedSize === 4294967295 && r.push(["compressedSize", 8]), t.offsetToLocalFileHeader === 4294967295 && r.push(["offsetToLocalFileHeader", 8]), n = ms(e.slice(4), r);
		} else e = e.slice(r.partSize + 4);
	}
	return n ||= {}, t.compressedSize === 4294967295 && (t.compressedSize = n.compressedSize), t.uncompressedSize === 4294967295 && (t.uncompressedSize = n.uncompressedSize), t.offsetToLocalFileHeader === 4294967295 && (t.offsetToLocalFileHeader = n.offsetToLocalFileHeader), n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseDateTime.js
function gs(e, t) {
	let n = e & 31, r = e >> 5 & 15, i = (e >> 9 & 127) + 1980, a = t ? (t & 31) * 2 : 0, o = t ? t >> 5 & 63 : 0, s = t ? t >> 11 : 0;
	return new Date(Date.UTC(i, r - 1, n, s, o, a));
}
//#endregion
//#region node_modules/unzipper-esm/lib/parse.js
var _s = Buffer.alloc(4);
_s.writeUInt32LE(101010256, 0);
function vs(e) {
	return new Ds(e);
}
var ys = function(e) {
	this._opts = e;
	let t = this;
	t.on("finish", function() {
		t.emit("end"), t.emit("close");
	}), t._readRecord().catch(function(e) {
		(!t.__emittedError || t.__emittedError !== e) && t.emit("error", e);
	});
}, bs = function() {
	let e = this;
	return e.pull(4).then(function(t) {
		if (t.length === 0) return;
		let n = t.readUInt32LE(0);
		if (n === 875721283) return e._readCrxHeader();
		if (n === 67324752) return e._readFile();
		if (n === 33639248) return e.reachedCD = !0, e._readCentralDirectoryFileHeader();
		if (n === 101010256) return e._readEndOfCentralDirectoryRecord();
		if (e.reachedCD) return e.pull(_s, !0).then(function() {
			return e._readEndOfCentralDirectoryRecord();
		});
		e.emit("error", new rs("INVALID_SIGNATURE", "invalid signature: 0x" + n.toString(16)));
	}).then((function(t) {
		if (t) return e._readRecord();
	}));
}, xs = function() {
	let e = this;
	return e.pull(12).then(function(t) {
		return e.crxHeader = ms(t, [
			["version", 4],
			["pubKeyLength", 4],
			["signatureLength", 4]
		]), e.pull(e.crxHeader.pubKeyLength + e.crxHeader.signatureLength);
	}).then(function(t) {
		return e.crxHeader.publicKey = t.slice(0, e.crxHeader.pubKeyLength), e.crxHeader.signature = t.slice(e.crxHeader.pubKeyLength), e.emit("crx-header", e.crxHeader), !0;
	});
}, Ss = function() {
	let e = this;
	return e.pull(26).then(function(t) {
		let n = ms(t, [
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
		return n.lastModifiedDateTime = gs(n.lastModifiedDate, n.lastModifiedTime), e.crxHeader && (n.crxHeader = e.crxHeader), e.pull(n.fileNameLength).then(function(t) {
			let r = t.toString("utf8"), i = new A(), a = !1;
			return i.autodrain = function() {
				a = !0;
				let e = i.pipe(new ds());
				return e.promise = function() {
					return new Promise(function(t, n) {
						e.on("finish", t), e.on("error", n);
					});
				}, e;
			}, i.buffer = function() {
				return fs(i);
			}, i.path = r, i.props = {}, i.props.path = r, i.props.pathBuffer = t, i.props.flags = { isUnicode: !!(n.flags & 2048) }, i.type = n.uncompressedSize === 0 && /[/\\]$/.test(r) ? "Directory" : "File", e._opts.verbose && (i.type === "Directory" ? console.log("   creating:", r) : i.type === "File" && (n.compressionMethod === 0 ? console.log(" extracting:", r) : console.log("  inflating:", r))), e.pull(n.extraFieldLength).then(function(t) {
				let o = hs(t, n);
				i.vars = n, i.extra = o, e._opts.forceStream ? e.push(i) : (e.emit("entry", i), (e._readableState.pipesCount || e._readableState.pipes && e._readableState.pipes.length) && e.push(i)), e._opts.verbose && console.log({
					filename: r,
					vars: n,
					extra: o
				});
				let s = !(n.flags & 8) || n.compressedSize > 0, c;
				i.__autodraining = a;
				let l = n.compressionMethod && !a ? k.createInflateRaw() : A();
				return s ? (i.size = n.uncompressedSize, c = n.compressedSize) : (c = Buffer.alloc(4), c.writeUInt32LE(134695760, 0)), new Promise(function(t, n) {
					ne(e.stream(c), l, i, function(r) {
						return r ? (r.code === "Z_DATA_ERROR" && (r = is(r)), n(r)) : s ? t(s) : e._processDataDescriptor(i).then(t).catch(n);
					});
				});
			});
		});
	});
}, Cs = function(e) {
	return this.pull(16).then(function(t) {
		return e.size = ms(t, [
			["dataDescriptorSignature", 4],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4]
		]).uncompressedSize, !0;
	});
}, ws = function() {
	let e = this;
	return e.pull(42).then(function(t) {
		let n = ms(t, [
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
}, Ts = function() {
	let e = this;
	return e.pull(18).then(function(t) {
		let n = ms(t, [
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
}, Es = function() {
	let e = this;
	return new Promise(function(t, n) {
		e.on("finish", t), e.on("error", n);
	});
}, Ds = class extends us {
	constructor(e = { verbose: !1 }) {
		super(e), ys.call(this, e);
	}
	_readRecord() {
		return bs.call(this);
	}
	_readCrxHeader() {
		return xs.call(this);
	}
	_readFile() {
		return Ss.call(this);
	}
	_processDataDescriptor(e) {
		return Cs.call(this, e);
	}
	_readCentralDirectoryFileHeader() {
		return ws.call(this);
	}
	_readEndOfCentralDirectoryRecord() {
		return Ts.call(this);
	}
	promise() {
		return Es.call(this);
	}
}, Os = /* @__PURE__ */ I(((e, t) => {
	var n = L("constants"), r = process.cwd, i = null, a = process.env.GRACEFUL_FS_PLATFORM || process.platform;
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
})), ks = /* @__PURE__ */ I(((e, t) => {
	var n = L("stream").Stream;
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
})), As = /* @__PURE__ */ I(((e, t) => {
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
})), js = /* @__PURE__ */ I(((e, t) => {
	var n = L("fs"), r = Os(), i = ks(), a = As(), o = L("util"), s, c;
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
		d(n[s]), L("assert").equal(n[s].length, 0);
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
(/* @__PURE__ */ I(((e, t) => {
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
})))(), Buffer.alloc(4).writeUInt32LE(101010256, 0), js();
//#endregion
//#region node_modules/read-excel-file/modules/zip/UnzipError.js
function Ms(e) {
	"@babel/helpers - typeof";
	return Ms = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ms(e);
}
function Ns(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Fs(r.key), r);
	}
}
function Ps(e, t, n) {
	return t && Ns(e.prototype, t), n && Ns(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Fs(e) {
	var t = Is(e, "string");
	return Ms(t) === "symbol" ? t : String(t);
}
function Is(e, t) {
	if (Ms(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Ms(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ls(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Rs(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Ks(e, t);
}
function zs(e) {
	var t = Ws();
	return function() {
		var n = qs(e), r;
		if (t) {
			var i = qs(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Bs(this, r);
	};
}
function Bs(e, t) {
	if (t && (Ms(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Vs(e);
}
function Vs(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Hs(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Hs = function(e) {
		if (e === null || !Gs(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Us(e, arguments, qs(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Ks(n, e);
	}, Hs(e);
}
function Us(e, t, n) {
	return Us = Ws() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Ks(i, n.prototype), i;
	}, Us.apply(null, arguments);
}
function Ws() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Gs(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Ks(e, t) {
	return Ks = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Ks(e, t);
}
function qs(e) {
	return qs = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, qs(e);
}
var Js = /*#__PURE__*/ function(e) {
	Rs(n, e);
	var t = zs(n);
	function n() {
		return Ls(this, n), t.apply(this, arguments);
	}
	return Ps(n);
}(/*#__PURE__*/ Hs(Error));
function Ys(e) {
	var t = new Js(e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace && Error.captureStackTrace(t, Ys), t.cause = e, t;
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.unzipper.js
var Xs = void 0;
function Zs(e, t, n, r) {
	return new Promise(function(i, a) {
		var o = [], s = !1, c = function(e) {
			e instanceof rs && (e = Ys(e)), s || (s = !0, a(e));
		};
		e.on("error", c).pipe(vs()).on("error", c).on("finish", function() {
			s || Promise.all(o).then(function() {
				i(Xs);
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
function Qs(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = $s(e)) || t && e && typeof e.length == "number") {
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
function $s(e, t) {
	if (e) {
		if (typeof e == "string") return ec(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return ec(e, t);
	}
}
function ec(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function tc(e) {
	var t = (arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}).filter, n = {}, r = {};
	return Zs(e, function(e, n) {
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
		n[e] = r[e].size === void 0 ? nc(r[e].chunks) : r[e].buffer, delete r[e];
	}).then(function() {
		return n;
	});
}
function nc(e) {
	for (var t = e.reduce(function(e, t) {
		return e + t.length;
	}, 0), n = Buffer.allocUnsafeSlow(t), r = 0, i = Qs(e), a; !(a = i()).done;) {
		var o = a.value;
		o.copy(n, r), r += o.length;
	}
	return n;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InvalidInputError.js
function rc(e) {
	"@babel/helpers - typeof";
	return rc = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, rc(e);
}
function ic(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, oc(r.key), r);
	}
}
function ac(e, t, n) {
	return t && ic(e.prototype, t), n && ic(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function oc(e) {
	var t = sc(e, "string");
	return rc(t) === "symbol" ? t : String(t);
}
function sc(e, t) {
	if (rc(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (rc(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function cc(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function lc(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && _c(e, t);
}
function uc(e) {
	var t = hc();
	return function() {
		var n = vc(e), r;
		if (t) {
			var i = vc(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return dc(this, r);
	};
}
function dc(e, t) {
	if (t && (rc(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return fc(e);
}
function fc(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function pc(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return pc = function(e) {
		if (e === null || !gc(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return mc(e, arguments, vc(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), _c(n, e);
	}, pc(e);
}
function mc(e, t, n) {
	return mc = hc() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && _c(i, n.prototype), i;
	}, mc.apply(null, arguments);
}
function hc() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function gc(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function _c(e, t) {
	return _c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, _c(e, t);
}
function vc(e) {
	return vc = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, vc(e);
}
var yc = {
	XLS_FILE_NOT_SUPPORTED: "You passed a legacy `.xls` file. Only `.xlsx` files are supported",
	FILE_NOT_SUPPORTED: "Doesn't look like an `.xlsx` file",
	INVALID_ZIP: "Couldn't unzip `.xlsx` file contents",
	NO_DATA: "No data"
}, bc = /*#__PURE__*/ function(e) {
	lc(n, e);
	var t = uc(n);
	function n(e, r) {
		var i;
		return cc(this, n), i = t.call(this, yc[e] || e), i.code = e, i.name = "InvalidInputError", i.cause = r, i;
	}
	return ac(n);
}(/*#__PURE__*/ pc(Error));
//#endregion
//#region node_modules/read-excel-file/modules/export/convertInputToNodeStream.js
function xc(e) {
	return e instanceof N ? e : e instanceof Buffer ? Sc(e) : e instanceof M ? Cc(e) : l.createReadStream(e);
}
function Sc(e) {
	return re.from(e);
}
function Cc(e) {
	return re.fromWeb(e.stream());
}
//#endregion
//#region node_modules/read-excel-file/modules/export/filterZipArchiveEntry.js
function wc(e) {
	var t = e.path;
	return t.endsWith(".xml") || t.endsWith(".xml.rels");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/createFileTypeDetector.js
var Tc = [80, 75], Ec = [
	208,
	207,
	17,
	224
], Dc = [Tc, Ec];
Dc.indexOf(Tc);
var Oc = Dc.indexOf(Ec);
function kc() {
	var e, t = Ac(Dc), n = 0;
	return function(r) {
		if (isNaN(e)) {
			var i;
			t = t.filter(function(e) {
				if (r === Dc[e][n]) return Dc[e].length === n + 1 && (i = e), !0;
			}), t.length === 1 ? e = i : t.length === 0 && (e = -1);
		}
		return n++, e;
	};
}
function Ac(e) {
	for (var t = [], n = 0; n < e.length;) t.push(n), n++;
	return t;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/validateLeadingBytes.js
function jc(e, t) {
	var n = t(e);
	if (n !== void 0) {
		if (n === Oc) throw new bc("XLS_FILE_NOT_SUPPORTED");
		if (n < 0) throw new bc("FILE_NOT_SUPPORTED");
		return !0;
	}
}
function Mc(e) {
	throw new bc(e === 0 ? "NO_DATA" : "FILE_NOT_SUPPORTED");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InputValidationStream.js
function Nc(e) {
	"@babel/helpers - typeof";
	return Nc = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Nc(e);
}
function Pc(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = Fc(e)) || t && e && typeof e.length == "number") {
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
function Fc(e, t) {
	if (e) {
		if (typeof e == "string") return Ic(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Ic(e, t);
	}
}
function Ic(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Lc(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Rc(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Bc(r.key), r);
	}
}
function zc(e, t, n) {
	return t && Rc(e.prototype, t), n && Rc(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Bc(e) {
	var t = Vc(e, "string");
	return Nc(t) === "symbol" ? t : String(t);
}
function Vc(e, t) {
	if (Nc(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Nc(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Hc(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Uc(e, t);
}
function Uc(e, t) {
	return Uc = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Uc(e, t);
}
function Wc(e) {
	var t = qc();
	return function() {
		var n = Jc(e), r;
		if (t) {
			var i = Jc(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Gc(this, r);
	};
}
function Gc(e, t) {
	if (t && (Nc(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Kc(e);
}
function Kc(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function qc() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Jc(e) {
	return Jc = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Jc(e);
}
var Yc = /*#__PURE__*/ function(e) {
	Hc(n, e);
	var t = Wc(n);
	function n() {
		var e;
		return Lc(this, n), e = t.call(this), e.d = kc(), e.i = 0, e.chunks = [], e;
	}
	return zc(n, [{
		key: "_transform",
		value: function(e, t, n) {
			if (this.d) {
				this.chunks.push(e);
				for (var r = Pc(e), i; !(i = r()).done;) {
					var a = i.value;
					try {
						if (jc(a, this.d)) {
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
				Mc(this.i);
			} catch (t) {
				return e(t);
			}
			e();
		}
	}]), n;
}(P), Xc;
function Zc(e) {
	var t = Date.now();
	(typeof global < "u" ? global.READ_EXCEL_FILE_CHECKPOINTS : typeof window < "u" && window.READ_EXCEL_FILE_CHECKPOINTS) && (Xc && console.log("  -", t - Xc, "ms"), console.log("*", e)), Xc = t;
}
function Qc() {
	Xc = void 0;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/unpackXlsxFileNode.js
function $c(e) {
	Qc(), Zc("unpack files");
	var t = xc(e);
	return new Promise(function(e, n) {
		tc(t.on("error", n).pipe(new Yc()), { filter: wc }).then(e, function(e) {
			e instanceof Js ? n(new bc("INVALID_ZIP", e.cause)) : n(e);
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetInfo.js
function el(e, t) {
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
function tl(e, t) {
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
function nl(e) {
	"@babel/helpers - typeof";
	return nl = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, nl(e);
}
var rl = ["xfId"];
function il(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function al(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? il(Object(n), !0).forEach(function(t) {
			ol(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : il(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ol(e, t, n) {
	return t = sl(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function sl(e) {
	var t = cl(e, "string");
	return nl(t) === "symbol" ? t : String(t);
}
function cl(e, t) {
	if (nl(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (nl(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function ll(e, t) {
	if (e == null) return {};
	var n = ul(e, t), r, i;
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (i = 0; i < a.length; i++) r = a[i], !(t.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(e, r) && (n[r] = e[r]);
	}
	return n;
}
function ul(e, t) {
	if (e == null) return {};
	for (var n = {}, r = Object.keys(e), i, a = 0; a < r.length; a++) i = r[a], !(t.indexOf(i) >= 0) && (n[i] = e[i]);
	return n;
}
function dl(e, t) {
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
				var n = t.xfId, r = ll(t, rl);
				return al(al({}, e.baseStyles[n]), r);
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
function fl(e, t) {
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
function pl(e, t) {
	var n = 17, r = 1, i = 1, a = 864e5, o = 365;
	t && (e += 4 * o + r + i);
	var s = r + i + 70 * o + n;
	return Math.floor((e - s) * a);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormat.js
var ml = /;@$/, hl = /[^a-z0#\?%]+/;
function gl(e, t, n) {
	var r = n[e];
	return r === void 0 ? n[e] = _l(t) : r;
}
function _l(e) {
	return e = e.toLowerCase(), e = e.replace(ml, ""), e = e.replace(/\\./g, " "), e.split(";").some(t);
	function t(e) {
		e = e.replace(/"[^"]*"/g, " "), e = e.replace(/(\[?[smhd]{1,2}\]?)[\.\,]00?0?/g, "$1"), e = e.replace(/\[([smhd]{1,2})\]/g, "$1"), e = e.replace(/\[[^\]]*\]/g, "");
		var t = e.split(hl).filter(function(e) {
			return e;
		});
		return t.length !== 0 && t.every(function(e) {
			return vl.indexOf(e) >= 0;
		});
	}
}
var vl = /* @__PURE__ */ "s.ss.m.mm.h.hh.am.pm.a.p.d.dd.ddd.dddd.aaa.aaaa.aaaaa.m.mm.mmm.mmmm.mmmmm.y.yy.yyyy.e.ee.eeee".split(".");
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormatStyle.js
function yl(e, t, n, r) {
	return e.numberFormat ? !!(Cl.indexOf(e.numberFormat.id) >= 0 || t && e.numberFormat.template === t || n && e.numberFormat.template && gl(e.numberFormat.id, e.numberFormat.template, r)) : !1;
}
var bl = [
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
], xl = [
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
], Sl = [
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
], Cl = bl.concat(xl).concat(Sl.filter(function(e) {
	return xl.indexOf(e) < 0;
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
	return xl.indexOf(e) < 0;
}).filter(function(e) {
	return Sl.indexOf(e) < 0;
}));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCell.js
function wl(e, t) {
	return kl(e) || Ol(e, t) || El(e, t) || Tl();
}
function Tl() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function El(e, t) {
	if (e) {
		if (typeof e == "string") return Dl(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Dl(e, t);
	}
}
function Dl(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Ol(e, t) {
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
function kl(e) {
	if (Array.isArray(e)) return e;
}
var Al = [null, null];
function jl(e, t, n, r, i) {
	var a = wl(i, 7), o = a[0], s = a[1], c = a[2], l = a[3], u = a[4], d = a[5], f = a[6];
	switch (e || "n") {
		case "str": return n === void 0 ? "VALUE_MISSING" : n ? ["s", n] : Al;
		case "inlineStr": return r === void 0 ? "VALUE_MISSING" : ["s", r];
		case "s":
			if (!n) return "VALUE_MISSING";
			var p = Number(n);
			return isNaN(p) || o[p] === void 0 ? "VALUE_INVALID" : ["s", o[p]];
		case "b": return n ? n === "1" ? ["b", !0] : n === "0" ? ["b", !1] : "VALUE_INVALID" : "VALUE_MISSING";
		case "e": return n ? ["e", n] : "VALUE_MISSING";
		case "d":
			if (!n) return Al;
			var m = new Date(n);
			return isNaN(m.valueOf()) ? "VALUE_INVALID" : ["d", m.getTime()];
		case "n":
			if (!n) return Al;
			if (t) {
				var h = Number(t);
				if (isNaN(h) || s[h] === void 0) return "FORMAT_INVALID";
				if (yl(s[h], u, d, l)) {
					var g = Number(n);
					return isNaN(g) ? "VALUE_INVALID" : ["d", pl(g, c)];
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
function Ml(e) {
	for (var t = 0, n = 0; n < e.length;) {
		var r = e.charCodeAt(n);
		if (r >= 48 && r <= 57) {
			var i = Number(e.slice(n));
			return isNaN(i) && Nl(e), [i, t];
		}
		t *= 26, t += e.charCodeAt(n) - 64, n++;
	}
	Nl(e);
}
function Nl(e) {
	throw Error(`<c r="${e}">`);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSheet.js
function Pl(e, t) {
	return Ll(e) || Il(e, t) || zl(e, t) || Fl();
}
function Fl() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Il(e, t) {
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
function Ll(e) {
	if (Array.isArray(e)) return e;
}
function Rl(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = zl(e)) || t && e && typeof e.length == "number") {
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
function zl(e, t) {
	if (e) {
		if (typeof e == "string") return Bl(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Bl(e, t);
	}
}
function Bl(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
var Vl = null;
function Hl(e, t, n) {
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
		for (var o = Rl(l), s; !(s = o()).done;) for (var c = s.value; c.length < i;) c.push(Vl);
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
		throw new ts(`<c/> at row ${t}, col ${n}: ${r}`);
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
		var t = e.split(":").map(Ml);
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
				if (t.rowNumber <= n) throw new ts(`Out-of-place <row/> number ${t.rowNumber} follows <row/> number ${n}`);
				for (; t.rowNumber > t.rowIndexShift + t.rows.length + 1;) t.rows.push([]);
			}
			t.rows.push(t.row), t.row.length > 0 && (t.dataRowCount = t.rowNumber), t.rowNumber > t.rowCount && (t.rowCount = t.rowNumber), t.row = void 0, t.rowNumber = void 0;
		} else if (e === "c") {
			var r = E(t.c);
			if (r.row < t.cursor[0] || r.row === t.cursor[0] && r.column <= t.cursor[1]) throw new ts(`Out-of-place <c/> at row ${r.row} col ${r.column} follows <c/> at row ${t.cursor[0]} col ${t.cursor[1]}`);
			if (t.cursor[0] = r.row, t.cursor[1] = r.column, t.rowNumber ||= r.row, r.error) M && _(r), t.errors.push(r);
			else if (r.value !== Vl) {
				for (; r.column > t.row.length + 1;) t.row.push(Vl);
				t.row.push(r.value), r.column > t.dataColumnCount && (t.dataColumnCount = r.column);
			}
			r.column > t.columnCount && (t.columnCount = r.column), t.c = void 0;
		} else t.c && j(e, t.c);
	}
	function T(e, t) {
		t.c && ne(e, t.c);
	}
	function E(e) {
		var t = e.attributes, n = e.inlineString, r = e.vText, i = Pl(Ml(t.r), 2), a = i[0], o = i[1], l = D(t.t, t.s, r, n, c, s.trim !== !1);
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
		return Array.isArray(o) && o[0] === "s" && (a && (o[1] = o[1].trim()), o[1] === "") ? Al : o;
	}
	function O(e, t, n, r, i) {
		var a = jl(e, t, n, r, i);
		if (a === "VALUE_MISSING") switch (e || "n") {
			case "str":
			case "inlineStr":
			case "s":
			case "b": return Al;
		}
		return e === "e" ? Al : a;
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
	function j(e, t) {
		e === "v" ? (t.v = !1, t.vText ||= "") : e === "is" ? t.is = !1 : e === "t" ? t.t = !1 : e === "r" ? t.r = !1 : e === "rPh" && (t.rPh = !1);
	}
	function ne(e, t) {
		t.v ? t.vText = e : t.is && (t.rPh || t.t && (t.r ? t.inlineString += e : t.inlineString = e));
	}
	var M;
}
//#endregion
//#region node_modules/fflate/esm/index.mjs
var Ul = F("/"), Wl;
try {
	Wl = Ul("worker_threads"), Wl.Worker, Wl.isMarkedAsUntransferable;
} catch {}
var Gl = Uint8Array, Kl = Uint16Array, ql = Int32Array, Jl = new Gl([
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
]), Yl = new Gl([
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
new Gl([
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
var Xl = function(e, t) {
	for (var n = new Kl(31), r = 0; r < 31; ++r) n[r] = t += 1 << e[r - 1];
	for (var i = new ql(n[30]), r = 1; r < 30; ++r) for (var a = n[r]; a < n[r + 1]; ++a) i[a] = a - n[r] << 5 | r;
	return {
		b: n,
		r: i
	};
}, Wl = Xl(Jl, 2), Zl = Wl.b, Ql = Wl.r;
Zl[28] = 258, Ql[258] = 28;
var $l = Xl(Yl, 0);
$l.b, $l.r;
for (var eu = new Kl(32768), X = 0; X < 32768; ++X) {
	var tu = (X & 43690) >> 1 | (X & 21845) << 1;
	tu = (tu & 52428) >> 2 | (tu & 13107) << 2, tu = (tu & 61680) >> 4 | (tu & 3855) << 4, eu[X] = ((tu & 65280) >> 8 | (tu & 255) << 8) >> 1;
}
for (var nu = new Gl(288), X = 0; X < 144; ++X) nu[X] = 8;
for (var X = 144; X < 256; ++X) nu[X] = 9;
for (var X = 256; X < 280; ++X) nu[X] = 7;
for (var X = 280; X < 288; ++X) nu[X] = 8;
for (var ru = new Gl(32), X = 0; X < 32; ++X) ru[X] = 5;
var iu = function(e, t, n) {
	return (t == null || t < 0) && (t = 0), (n == null || n > e.length) && (n = e.length), new Gl(e.subarray(t, n));
}, au = [
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
], ou = function(e, t, n) {
	var r = Error(t || au[e]);
	if (r.code = e, Error.captureStackTrace && Error.captureStackTrace(r, ou), !n) throw r;
	return r;
}, su = /*#__PURE__*/ new Gl(0), cu = typeof TextDecoder < "u" && /*#__PURE__*/ new TextDecoder();
try {
	cu.decode(su, { stream: !0 });
} catch {}
var lu = function(e) {
	for (var t = "", n = 0;;) {
		var r = e[n++], i = (r > 127) + (r > 223) + (r > 239);
		if (n + i > e.length) return {
			s: t,
			r: iu(e, n - 1)
		};
		i ? i == 3 ? (r = ((r & 15) << 18 | (e[n++] & 63) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) - 65536, t += String.fromCharCode(55296 | r >> 10, 56320 | r & 1023)) : i & 1 ? t += String.fromCharCode((r & 31) << 6 | e[n++] & 63) : t += String.fromCharCode((r & 15) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) : t += String.fromCharCode(r);
	}
};
function uu(e, t) {
	if (t) {
		for (var n = "", r = 0; r < e.length; r += 16384) n += String.fromCharCode.apply(null, e.subarray(r, r + 16384));
		return n;
	}
	if (cu) return cu.decode(e);
	var i = lu(e), a = i.s, n = i.r;
	return n.length && ou(8), a;
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/convertValuesFromUint8ArraysToStrings.js
function du(e) {
	Zc("convert files to strings");
	for (var t = {}, n = 0, r = Object.keys(e); n < r.length; n++) {
		var i = r[n];
		t[i] = fu(e[i]);
	}
	return t;
}
function fu(e) {
	return typeof TextDecoder < "u" ? new TextDecoder().decode(e) : uu(e);
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/isPromise.js
function pu(e) {
	"@babel/helpers - typeof";
	return pu = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, pu(e);
}
function mu(e) {
	return pu(e) === "object" && typeof e.then == "function";
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/SheetNotFoundError.js
function hu(e) {
	"@babel/helpers - typeof";
	return hu = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, hu(e);
}
function gu(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, vu(r.key), r);
	}
}
function _u(e, t, n) {
	return t && gu(e.prototype, t), n && gu(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function vu(e) {
	var t = yu(e, "string");
	return hu(t) === "symbol" ? t : String(t);
}
function yu(e, t) {
	if (hu(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (hu(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function bu(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function xu(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && ku(e, t);
}
function Su(e) {
	var t = Du();
	return function() {
		var n = Au(e), r;
		if (t) {
			var i = Au(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Cu(this, r);
	};
}
function Cu(e, t) {
	if (t && (hu(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return wu(e);
}
function wu(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Tu(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Tu = function(e) {
		if (e === null || !Ou(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Eu(e, arguments, Au(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), ku(n, e);
	}, Tu(e);
}
function Eu(e, t, n) {
	return Eu = Du() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && ku(i, n.prototype), i;
	}, Eu.apply(null, arguments);
}
function Du() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Ou(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function ku(e, t) {
	return ku = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, ku(e, t);
}
function Au(e) {
	return Au = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Au(e);
}
var ju = /*#__PURE__*/ function(e) {
	xu(n, e);
	var t = Su(n);
	function n(e, r) {
		var i;
		return bu(this, n), i = t.call(this, `Sheet not found: ${typeof e == "number" ? e + ". Sheet count: " + r.length : e + ". Available sheets: " + r.join(", ")}`), i.name = "SheetNotFoundError", i.sheet = e, i.sheets = r, i;
	}
	return _u(n);
}(/*#__PURE__*/ Tu(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetContents.js
function Mu(e) {
	"@babel/helpers - typeof";
	return Mu = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Mu(e);
}
function Nu(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = Pu(e)) || t && e && typeof e.length == "number") {
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
function Pu(e, t) {
	if (e) {
		if (typeof e == "string") return Fu(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Fu(e, t);
	}
}
function Fu(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Iu(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Lu(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Iu(Object(n), !0).forEach(function(t) {
			Ru(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Iu(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Ru(e, t, n) {
	return t = zu(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function zu(e) {
	var t = Bu(e, "string");
	return Mu(t) === "symbol" ? t : String(t);
}
function Bu(e, t) {
	if (Mu(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Mu(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Vu(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = du(t);
	return Zc("parse spreadsheet info and file paths"), Ju(Gu(), r, e).then(function(t) {
		var i = t.spreadsheetInfo, a = t.filePaths;
		return Zc("parse \"shared strings\" and \"styles\""), Ju(Ku(a), r, e).then(function(t) {
			var o = t.sharedStrings, s = t.styles, c = n.sheets ? n.sheets.map(function(e) {
				return Uu(e, i.sheets);
			}) : i.sheets.map(function(e) {
				return e.relationId;
			});
			return Zc(`parse sheet${c.length === 1 ? "" : "s"} data`), Ju(qu(a, c, {
				sharedStrings: o,
				styles: s,
				epoch1904: i.epoch1904,
				dateFormatDetectionCache: [],
				options: n
			}), r, e).then(function(e) {
				return Zc("end"), c.map(function(t) {
					return {
						sheet: Wu(t, i.sheets),
						data: e[t]
					};
				});
			});
		});
	});
}
function Hu(e, t, n, r) {
	return r && r.parseNumber || (r = Lu(Lu({}, r), {}, { parseNumber: null })), Vu(t, n, r);
}
function Uu(e, t) {
	if (typeof e == "string") for (var n = Nu(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.name === e) return i.relationId;
	}
	else if (e <= t.length) return t[e - 1].relationId;
	throw new ju(e, t.map(function(e) {
		return e.name;
	}));
}
function Wu(e, t) {
	for (var n = Nu(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.relationId === e) return i.name;
	}
	throw Error(`Sheet relation ID not found: ${e}`);
}
function Gu() {
	return {
		"xl/_rels/workbook.xml.rels": {
			name: "filePaths",
			parse: tl
		},
		"xl/workbook.xml": {
			name: "spreadsheetInfo",
			parse: el
		}
	};
}
function Ku(e) {
	var t = {};
	return Ru(t, e.sharedStrings || "xl/sharedStrings.xml", {
		name: "sharedStrings",
		parse: fl,
		fallback: Promise.resolve([])
	}), Ru(t, e.styles || "xl/styles.xml", {
		name: "styles",
		parse: dl,
		fallback: {}
	}), t;
}
function qu(e, t, n) {
	return Object.keys(e.sheets).filter(function(e) {
		return t.includes(e);
	}).reduce(function(t, r) {
		return Lu(Lu({}, t), {}, Ru({}, e.sheets[r], {
			name: r,
			parse: function(e, t) {
				return Hl(e, t, n);
			}
		}));
	}, {});
}
function Ju(e, t, n) {
	for (var r = {}, i = function() {
		var i = o[a], s = e[i];
		r[s.name] = t[i] === void 0 ? s.fallback === void 0 ? function() {
			throw new ts(`"${i}" file not found inside the \`.xlsx\` file`);
		}() : s.fallback : s.parse(t[i], n);
	}, a = 0, o = Object.keys(e); a < o.length; a++) i();
	for (var s = [], c = function() {
		var e = u[l];
		mu(r[e]) && s.push(r[e].then(function(t) {
			r[e] = t;
		}));
	}, l = 0, u = Object.keys(r); l < u.length; l++) c();
	return s.length > 0 ? Promise.all(s).then(function() {
		return r;
	}) : r;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/readXlsxFileNode.js
function Yu(e, t) {
	return $c(e).then(function(e) {
		return Hu(Po, ns, e, t);
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
}, Xu = "feligres", Zu = "parroquialibros", Qu = [
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
], $u = [
	"COD PARROQUIA",
	"TIPO DE LIBRO",
	"NUM LIBRO",
	"NOMBRE DE LIBRO",
	"RANGO DE AÑOS DEL LIBRO"
], ed = {
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	nombre_libro: 3
}, td = class extends Error {}, nd = {
	B: "bautismo",
	C: "confirmacion",
	M: "matrimonio"
};
function rd(e, t) {
	return `${e.trim().toUpperCase()}|${t.trim()}`;
}
function Q(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" || /^-+$/.test(t) ? null : t;
}
function id(e) {
	return String(e).padStart(2, "0");
}
function ad(e) {
	if (e instanceof Date && !Number.isNaN(e.getTime())) return `${e.getUTCFullYear()}-${id(e.getUTCMonth() + 1)}-${id(e.getUTCDate())}`;
	let t = Q(e);
	if (!t) return null;
	let n = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
	if (n) return `${n[1]}-${n[2]}-${n[3]}`;
	let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
	return r ? `${r[3]}-${id(Number(r[2]))}-${id(Number(r[1]))}` : null;
}
function od(e) {
	let t = ad(e);
	return t ? {
		date: t,
		text: null
	} : {
		date: null,
		text: Q(e)
	};
}
var sd = [
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
function cd(e) {
	return /\.$/.test(e) ? !0 : sd.includes(e.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
}
function ld(e) {
	let t = Q(e);
	if (!t) return null;
	let n = t.split(/\s+/), r = null;
	return n.length > 1 && cd(n[0]) && (r = n.shift()), n.length === 1 ? {
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
function ud(e) {
	let t = e[Z.codigo_parroquia];
	return typeof t == "string" && !/^\d+$/.test(t.trim());
}
function dd(e) {
	return String(e ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function fd(e, t, n) {
	if (e.length === 0) throw new td(`La hoja "${t}" está vacía.`);
	let r = [];
	return e.forEach((e, i) => {
		if (e.length !== n.length) throw new td(`La hoja "${t}" debe tener ${n.length} columnas y tiene ${e.length}. El archivo no es el exportado por el sistema anterior.`);
		if (i === 0 && ud(e)) {
			n.forEach((n, r) => {
				if (dd(e[r]) !== dd(n)) throw new td(`El encabezado de la hoja "${t}" no es el del sistema anterior: la columna ${r + 1} dice "${e[r] ?? ""}" y debería decir "${n ?? ""}".`);
			});
			return;
		}
		e.every((e) => Q(e) === null) || r.push({
			row: e,
			fila: i + 1
		});
	}), r;
}
function pd(e, t, n, r, i) {
	let a = Q(e[t]);
	if (!a || !/^\d+$/.test(a)) throw new td(`La fila ${r} de la hoja "${n}" no tiene un código de parroquia válido.`);
	if (i !== null && a !== i) throw new td(`El archivo trae partidas de más de una parroquia (códigos ${i} y ${a}). Debe ser el de una sola parroquia.`);
	return a;
}
function md(e, t, n, r) {
	let i = String(e[t] ?? "").trim().toUpperCase();
	if (!nd[i]) throw new td(`En la fila ${r} de la hoja "${n}" el tipo de libro no es B, C ni M: las columnas no son las del sistema anterior.`);
	return i;
}
function hd(e) {
	let t = /* @__PURE__ */ new Map(), n = null;
	for (let { row: r, fila: i } of fd(e, Zu, $u)) {
		n = pd(r, ed.codigo_parroquia, Zu, i, n);
		let e = md(r, ed.tipo_libro, Zu, i), a = Q(r[ed.num_libro]);
		if (!a) throw new td(`La fila ${i} de la hoja "${Zu}" no tiene el número del libro.`);
		t.set(rd(e, a), Q(r[ed.nombre_libro]) ?? a);
	}
	return {
		codigo_parroquia: n,
		libros: t
	};
}
function gd(e, t) {
	let n = od(e[t.fecha_nacimiento]), r = Q(e[t.fecha_aproximada]);
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
var _d = {
	dni: Z.dni,
	nombres: Z.nombres,
	apellido_paterno: Z.apellido_paterno,
	apellido_materno: Z.apellido_materno,
	fecha_nacimiento: Z.fecha_nacimiento,
	fecha_aproximada: Z.fecha_nacimiento_aprox,
	lugar_nacimiento: Z.lugar_nacimiento,
	padre: Z.padre,
	madre: Z.madre
}, vd = {
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
function yd(e, t) {
	let n = [], r = Q(e[Z.anotacion_marginal]);
	return r && r.toUpperCase() !== "NINGUNA" && n.push(r), n.push(...t), n.length === 0 ? null : n.join("\n");
}
function bd(e, t, n) {
	let r = String(e[Z.tipo_libro] ?? "").trim().toUpperCase(), i = nd[r];
	if (!i) return {
		fila: t,
		motivo: "El tipo de libro no es B, C ni M."
	};
	let a = Q(e[Z.num_libro]), o = Q(e[Z.folio]), s = Q(e[Z.numero_registro]);
	if (!a || !o || !s) return {
		fila: t,
		motivo: "Falta el libro, el folio o el número de registro."
	};
	let c = n.get(rd(r, a));
	if (!c) return {
		fila: t,
		motivo: `El libro ${r} ${a} no está en la hoja "${Zu}".`
	};
	let l = gd(e, _d), u = [], d = od(e[Z.fecha_sacramento]), f = Q(e[Z.fecha_sacramento_aprox]) ?? d.text;
	!d.date && f && u.push(`Fecha aproximada del sacramento: ${f}`);
	let p = [l], m = {
		padrino_1: Q(e[Z.padrino]),
		padrino_2: Q(e[Z.madrina])
	};
	if (i === "matrimonio") {
		let t = gd(e, vd);
		p.push(t);
		let n = od(e[Z.fecha_bautizo_novio]), r = od(e[Z.fecha_bautizo_novia]), i = Q(e[Z.fecha_bautizo_novio_aprox]) ?? n.text, a = Q(e[Z.fecha_bautizo_novia_aprox]) ?? r.text;
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
		anotaciones: yd(e, u),
		celebrante: ld(e[Z.celebrante]),
		personas: p,
		detalle: m
	};
}
function xd(e) {
	return [
		e.tipo,
		e.libro,
		e.folio,
		e.numero
	].map((e) => e.trim().toUpperCase()).join("|");
}
function Sd(e, t) {
	let n = [], r = [], i = /* @__PURE__ */ new Map(), a = fd(e, Xu, Qu), o = t.codigo_parroquia;
	for (let { row: e, fila: t } of a) o = pd(e, Z.codigo_parroquia, Xu, t, o), md(e, Z.tipo_libro, Xu, t);
	for (let { row: e, fila: o } of a) {
		let a = bd(e, o, t.libros);
		if ("motivo" in a) {
			r.push(a);
			continue;
		}
		let s = xd(a), c = i.get(s);
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
function Cd(e, t) {
	let n = e.find((e) => e.sheet.trim().toLowerCase() === t);
	if (!n) throw new td(`El archivo no tiene la hoja "${t}". Debe ser el Excel exportado por el sistema anterior, sin cambios.`);
	return n.data;
}
function wd(e) {
	let t = hd(Cd(e, Zu));
	return Sd(Cd(e, Xu), t);
}
//#endregion
//#region electron/main/controllers/legacy_import.ts
var Td = "Solo el administrador de la parroquia puede importar partidas.";
function Ed(e) {
	if (e.role !== "admin_parroquia" || !e.parish_id) throw new V(Td, 403);
	return e.parish_id;
}
function Dd(e) {
	return [
		e.nombres,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" ");
}
function Od(e, t, n) {
	let r = e.prepare("SELECT tipo, libro, folio, numero FROM sacramentos WHERE parroquia_id = ?").all(t), i = new Set(r.map(xd)), a = {
		nuevas: [],
		existentes: [],
		errores: n.errores
	};
	for (let e of n.partidas) {
		if (!i.has(xd(e))) {
			a.nuevas.push(e);
			continue;
		}
		a.existentes.push({
			fila: e.fila,
			tipo: e.tipo,
			libro: e.libro,
			folio: e.folio,
			numero: e.numero,
			nombre: e.personas.map(Dd).join(" y ")
		});
	}
	return a;
}
function kd(e) {
	return e.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function Ad(e) {
	return kd([
		e.nombre,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" "));
}
function jd(e, t) {
	let n = /* @__PURE__ */ new Map(), r = e.prepare("SELECT id, nombre, apellido_paterno, apellido_materno FROM ministros WHERE parroquia_id = ?").all(t);
	for (let e of r) n.set(Ad(e), e.id);
	let i = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)");
	return (r) => {
		if (!r) return null;
		let a = Ad(r), o = n.get(a);
		if (o !== void 0) return o;
		let s = crypto.randomUUID();
		ut(e, "ministro", s, null);
		let c = Number(i.run(s, t, r.titulo, r.nombre, r.apellido_paterno, r.apellido_materno).lastInsertRowid);
		return n.set(a, c), c;
	};
}
function Md(e) {
	return {
		...e,
		cambios: []
	};
}
function Nd(e, t, n, r, i) {
	let a = r.personas.map((t) => $e(e, n, Md(t))), o = {
		tipo: r.tipo,
		ministro_id: i,
		libro: r.libro,
		folio: r.folio,
		numero: r.numero,
		fecha_emision: r.fecha_emision,
		fecha_evento: r.fecha_evento,
		anotaciones: r.anotaciones
	}, s = crypto.randomUUID();
	ut(e, r.tipo, s, null);
	let c = Dt(e, s, r.tipo, n, o);
	W(e, c, t.user_id, "importada", [], `Fila ${r.fila} del Excel del sistema anterior`);
	let l = r.detalle;
	if (r.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(c, a[0], a[1], l.lugar, l.testigo_1, l.testigo_2, l.testigo_3, l.testigo_4, l.conyuge_1_bautismo_parroquia, l.conyuge_1_bautismo_fecha, l.conyuge_2_bautismo_parroquia, l.conyuge_2_bautismo_fecha);
		return;
	}
	e.prepare(`INSERT INTO ${_t(r.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(c, a[0], l.padrino_1, l.padrino_2);
}
function Pd(e, t, n) {
	let r = Ed(t);
	return e.transaction(() => {
		let i = Od(e, r, {
			partidas: n,
			errores: []
		}), a = jd(e, r);
		for (let n of i.nuevas) Nd(e, t, r, n, a(n.celebrante));
		return {
			importadas: i.nuevas.length,
			omitidas: i.existentes.length
		};
	})();
}
var Fd = null;
async function Id(e) {
	let t;
	try {
		t = await Yu(e);
	} catch {
		throw new V("No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) exportado del sistema anterior.", 400);
	}
	try {
		return wd(t);
	} catch (e) {
		throw e instanceof td ? new V(e.message, 400) : e;
	}
}
function Ld(e, t) {
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
var Rd = {
	"legacyImport.preview": async (e, { db: n, session: i }) => {
		let a = Ed(i), o = t.getFocusedWindow(), s = {
			title: "Elegir el Excel del sistema anterior",
			properties: ["openFile"],
			filters: [{
				name: "Excel",
				extensions: ["xlsx"]
			}]
		}, c = o ? await r.showOpenDialog(o, s) : await r.showOpenDialog(s);
		if (c.canceled || c.filePaths.length === 0) return { cancelado: !0 };
		let l = c.filePaths[0], u = Od(n, a, await Id(l));
		return Fd = {
			token: crypto.randomUUID(),
			parish_id: a,
			records: u.nuevas
		}, {
			cancelado: !1,
			token: Fd.token,
			...Ld(l.split(/[\\/]/).pop() ?? l, u)
		};
	},
	"legacyImport.confirm": (e, { db: t, session: n }) => {
		if (!Fd || e?.token !== Fd.token || Fd.parish_id !== n.parish_id) throw new V("Vuelva a elegir el archivo: la vista previa ya no es válida.", 409);
		let r = Fd.records;
		return Fd = null, Pd(t, n, r);
	}
}, zd = "Ministro no encontrado.", Bd = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function Vd(e) {
	let t = H(e?.nombre);
	if (!t) throw new V("El nombre del ministro es requerido.", 400);
	return {
		titulo: H(e.titulo),
		nombre: t,
		apellido_paterno: H(e.apellido_paterno) ?? "",
		apellido_materno: H(e.apellido_materno) ?? ""
	};
}
function Hd(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(n);
	if (!r) throw new V(zd, 404);
	Ye(t, r.parroquia_id, "No tiene permiso para modificar ministros de otra parroquia.", "Solo el administrador de la parroquia puede modificar ministros.");
}
function Ud(e, t) {
	let n = e.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(t);
	ut(e, "ministro", n.client_id, n.version);
}
function Wd(e, t) {
	let n = [], r = [];
	t.nombres && (n.push("nombre LIKE ?"), r.push(`%${t.nombres}%`)), t.apellido_paterno && (n.push("apellido_paterno LIKE ?"), r.push(`%${t.apellido_paterno}%`)), t.apellido_materno && (n.push("apellido_materno LIKE ?"), r.push(`%${t.apellido_materno}%`));
	let i = (H(t.texto) ?? "").split(/\s+/).filter(Boolean);
	for (let e of i) n.push("(COALESCE(titulo, '') || ' ' || nombre || ' ' || apellido_paterno || ' ' || apellido_materno) LIKE ?"), r.push(`%${e}%`);
	Number.isInteger(t.parroquia_id) && (n.push("parroquia_id = ?"), r.push(t.parroquia_id));
	let a = "";
	n.length > 0 && (a = "WHERE " + n.join(" AND "));
	let o = we(t, e.prepare(`SELECT COUNT(*) AS total FROM ministros ${a}`).get(...r).total), s = Bd[t.orden ?? "nombres"] ?? Bd.nombres;
	return {
		resultados: e.prepare(`SELECT id FROM ministros ${a}
			 ORDER BY ${s} ${Te(t)}, id
			 LIMIT ? OFFSET ?`).pluck().all(...r, 20, o.offset).map((t) => ht(e, t)),
		total_paginas: o.total_pages
	};
}
function Gd(e, t, n) {
	let r = Ke(t), i = Vd(n), a = crypto.randomUUID();
	return e.transaction(() => {
		ut(e, "ministro", a, null);
		let t = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)").run(a, r, i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno);
		return Number(t.lastInsertRowid);
	})();
}
function Kd(e, t, n) {
	let r = U(n?.id, zd);
	Hd(e, t, r);
	let i = Vd(n);
	e.transaction(() => {
		Ud(e, r), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno, r);
	})();
}
function qd(e, t, n) {
	Hd(e, t, n), e.transaction(() => {
		Ud(e, n), e.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(n);
	})();
}
var Jd = {
	"ministers.search": (e, { db: t }) => Wd(t, e),
	"ministers.create": (e, { db: t, session: n }) => ({ id: Gd(t, n, e) }),
	"ministers.update": (e, { db: t, session: n }) => (Kd(t, n, e), { success: !0 }),
	"ministers.toggleActive": (e, { db: t, session: n }) => (qd(t, n, U(e.id, zd)), { success: !0 })
}, Yd = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function Xd(e) {
	return e.prepare("SELECT id, nombre, ubicacion FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function Zd(e, t) {
	return s.join(e, Se.logos_folder, `parroquia-${t}.txt`);
}
function Qd(e, t) {
	try {
		return f(Zd(e, t), "utf8");
	} catch {
		return null;
	}
}
function $d(e, t, n, r) {
	Ye(t, n, "Solo puede cambiar el logo de su propia parroquia.", "Solo el administrador de la parroquia puede cambiar el logo.");
	let i = Zd(e, n);
	if (r === null) {
		h(i, { force: !0 });
		return;
	}
	if (typeof r != "string" || r.length > 4e5 || !Yd.test(r)) throw new V("El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.", 400);
	d(s.dirname(i), { recursive: !0 });
	let a = `${i}.tmp`;
	_(a, r, "utf8"), m(a, i);
}
var ef = {
	"parishes.list": (e, { db: t }) => ({ parroquias: Xd(t) }),
	"parishes.logo": (e, { user_data_folder: t }) => ({ logo: Qd(t, U(e.parroquia_id)) }),
	"parishes.saveLogo": (e, { session: t, user_data_folder: n }) => ($d(n, t, U(e.parroquia_id), e.logo), { success: !0 })
}, tf = { "app.server": () => ({ servidor: yr() }) }, nf = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: !0
}).compare;
function rf(e, t, n) {
	if (!gt(t)) throw new V("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(n) || n <= 0) throw new V("Debe especificar la parroquia.", 400);
	Je(e, n, "No tiene permiso para imprimir el índice de otra parroquia.");
}
function af(e, t, n, r) {
	return rf(t, n, r), e.prepare("SELECT DISTINCT libro FROM sacramentos WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'").pluck().all(n, r).sort(nf);
}
function of(e, t, n, r, i) {
	return rf(t, n, r), e.prepare(`SELECT pe.nombres, pe.apellido_paterno, pe.apellido_materno, s.libro, s.folio, s.numero
			 FROM (${yt(n)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(r, i, i).sort((e, t) => nf(e.apellido_paterno, t.apellido_paterno) || nf(e.apellido_materno, t.apellido_materno) || nf(e.nombres, t.nombres) || nf(e.libro, t.libro) || nf(e.folio, t.folio) || nf(e.numero, t.numero));
}
var sf = {
	"sacramentIndex.books": (e, { db: t, session: n }) => ({ libros: af(t, n, e.tipo, e.parroquia_id) }),
	"sacramentIndex.entries": (e, { db: t, session: n }) => ({ entradas: of(t, n, e.tipo, e.parroquia_id, e.libro) })
}, cf = [
	"nombres",
	"apellido_paterno",
	"apellido_materno"
];
function lf(e) {
	if (!gt(e)) throw new V("Tipo de sacramento inválido.", 400);
	return e;
}
var uf = /^\d{4}-\d{2}-\d{2}$/, df = /^\d+$/;
function ff(e, t, n, r) {
	let i = H(n);
	if (!i) return;
	e.push(`(${r})`);
	let a = r.split("?").length - 1;
	for (let e = 0; e < a; e++) t.push(`%${i}%`);
}
function pf(e, t, n) {
	if (!e || typeof e != "object") return null;
	let { operador: r, valor: i, hasta: a } = e, o = H(i), s = H(a);
	if (!o || n === "fecha" && !uf.test(o)) return null;
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
	else if (r === "entre") c.push([">=", o]), s && (n === "registro" || uf.test(s)) && c.push(["<=", s]);
	else return null;
	let l = c.map(([e]) => e), u = c.map(([, e]) => e);
	return n === "fecha" ? {
		sql: l.map((e) => `${t} ${e} ?`).join(" AND "),
		values: u
	} : u.every((e) => df.test(e)) ? {
		sql: `${t} <> '' AND ${t} NOT GLOB '*[^0-9]*' AND ${l.map((e) => `CAST(${t} AS INTEGER) ${e} ?`).join(" AND ")}`,
		values: u.map((e) => Number(e))
	} : {
		sql: l.map((e) => `${t} ${e} ? COLLATE NOCASE`).join(" AND "),
		values: u
	};
}
function mf(e, t, n, r, i) {
	let a = [];
	for (let e of r) {
		let t = pf(n, e, i);
		if (!t) return;
		a.push(t);
	}
	e.push(`(${a.map((e) => `(${e.sql})`).join(" OR ")})`);
	for (let e of a) t.push(...e.values);
}
function hf(e, t, n, r, i) {
	for (let t of [
		"libro",
		"folio",
		"numero"
	]) mf(r, i, e[t], [`TRIM(s.${t})`], "registro");
	mf(r, i, e.fecha_evento, ["s.fecha_evento"], "fecha"), mf(r, i, e.fecha_nacimiento, n.map((e) => `${e}.fecha_nacimiento`), "fecha"), mf(r, i, e.fecha_cambio, ["date(s.created_at, 'localtime')", "date(s.updated_at, 'localtime')"], "fecha"), ff(r, i, e.celebrante, "EXISTS (SELECT 1 FROM ministros mi WHERE mi.id = s.ministro_id\n			AND (COALESCE(mi.titulo, '') || ' ' || mi.nombre || ' ' || mi.apellido_paterno || ' ' || mi.apellido_materno) LIKE ?)");
	for (let t of [
		"padre",
		"madre",
		"dni"
	]) ff(r, i, e[t], n.map((e) => `${e}.${t} LIKE ?`).join(" OR "));
	t === "matrimonio" ? ff(r, i, e.padrino, "m.testigo_1 LIKE ? OR m.testigo_2 LIKE ? OR m.testigo_3 LIKE ? OR m.testigo_4 LIKE ?") : ff(r, i, e.padrino, "sub.padrino_1 LIKE ? OR sub.padrino_2 LIKE ?"), (e.estado === "vigente" || e.estado === "anulado") && (r.push("s.estado = ?"), i.push(e.estado)), e.con_anotaciones === !0 ? r.push("TRIM(COALESCE(s.anotaciones, '')) <> ''") : e.con_anotaciones === !1 && r.push("TRIM(COALESCE(s.anotaciones, '')) = ''");
}
function gf(e, t, n) {
	let r = [], i = [], a = [];
	Array.isArray(e.parroquias) && (a = e.parroquias.filter((e) => Number.isInteger(e))), a.length > 0 ? (r.push(`s.parroquia_id IN (${a.map(() => "?").join(", ")})`), i.push(...a)) : Number.isInteger(e.parroquia_id) && (r.push("s.parroquia_id = ?"), i.push(e.parroquia_id));
	for (let t of cf) {
		let a = e[t];
		if (a) {
			r.push(`(${n.map((e) => rt(e, t)).join(" OR ")})`);
			for (let e = 0; e < n.length; e++) i.push(`%${a}%`, `%${a}%`);
		}
	}
	hf(e, t, n, r, i);
	let o = "";
	return r.length > 0 && (o = "WHERE " + r.join(" AND ")), {
		where: o,
		values: i
	};
}
function _f(e, t, n) {
	let r = `FROM ${_t(t)} sub
		JOIN sacramentos s ON s.id = sub.sacramento_id
		JOIN personas pe ON pe.id = sub.persona_id`, i = ["pe"];
	t === "matrimonio" && (r = "FROM matrimonios m\n			JOIN sacramentos s ON s.id = m.sacramento_id\n			JOIN personas c1 ON c1.id = m.conyuge_1_id\n			JOIN personas c2 ON c2.id = m.conyuge_2_id", i = ["c1", "c2"]);
	let { where: a, values: o } = gf(n, t, i), s = we(n, e.prepare(`SELECT COUNT(*) AS total ${r} ${a}`).get(...o).total), c = "nombres";
	return n.orden && cf.includes(n.orden) && (c = n.orden), {
		resultados: e.prepare(`SELECT s.id ${r} ${a}
			 ORDER BY ${i[0]}.${c} ${Te(n)}, s.id
			 LIMIT ? OFFSET ?`).pluck().all(...o, 20, s.offset).map((t) => Nt(e, t)),
		total_paginas: s.total_pages
	};
}
function vf(e, t) {
	let n = H(e?.sacramento?.anotaciones);
	if (n !== null && n !== t && n.length > 350) throw new V("La anotación marginal puede tener hasta 350 caracteres, para que entre en la impresión.", 400);
}
function yf(e, t, n) {
	let r = lf(n?.sacramento?.tipo), i = Ke(t);
	It(n), vf(n, null);
	let a = t.role === "usuario";
	return e.transaction(() => {
		let o = Bt(e, i, n, !a), s = crypto.randomUUID();
		ut(e, r, s, null);
		let c = Dt(e, s, r, i, n.sacramento);
		Ht(e, c, n, o.map((e) => e.id)), W(e, c, t.user_id, "registrada");
		let l = Vt(o);
		if (l.length === 0) return c;
		if (a) {
			let n = l.map((e) => ({
				...e,
				tipo: "nota_marginal"
			}));
			return Ne(e, c, t.user_id, n), W(e, c, t.user_id, "cambio_pedido", n), c;
		}
		for (let n of o) nt(e, t, n.id, c, n.corrections);
		return W(e, c, t.user_id, "correccion", l), c;
	})();
}
function bf(e, t, n) {
	let r = U(n.sacramento?.id);
	Tt(e, t, r, n.sacramento.tipo);
	let i = Nt(e, r);
	e.transaction(() => {
		Lt(e, r);
		let a = Wt(e, t, i, n);
		a.fields.length > 0 && W(e, r, t.user_id, "editada", a.fields), a.corrections.length > 0 && W(e, r, t.user_id, "correccion", a.corrections), nn(e, t, r, n);
	})();
}
function xf(e, t, n) {
	lf(n?.sacramento?.tipo);
	let r = U(n.sacramento?.id);
	vf(n, e.prepare("SELECT anotaciones FROM sacramentos WHERE id = ?").pluck().get(r) ?? null), t.role === "usuario" ? Zt(e, t, n) : bf(e, t, n);
}
function Sf(e, t, n, r) {
	let i = e.prepare("SELECT tipo, estado FROM sacramentos WHERE id = ?").get(n);
	if (!i) throw new V(kt, 404);
	if (Tt(e, t, n, i.tipo), i.estado === "anulado") throw new V("La partida ya está anulada.", 400);
	let a = H(r);
	if (!a) throw new V("El motivo de anulación es requerido.", 400);
	e.transaction(() => {
		Lt(e, n), e.prepare("UPDATE sacramentos\n			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?\n			 WHERE id = ?").run(t.user_id, (/* @__PURE__ */ new Date()).toISOString(), a, n), W(e, n, t.user_id, "anulada", [], a);
	})();
}
function Cf(e, t, n, r) {
	let i = e.prepare("SELECT tipo, estado FROM sacramentos WHERE id = ?").get(n);
	if (!i) throw new V(kt, 404);
	if (Tt(e, t, n, i.tipo), i.estado !== "anulado") throw new V("La partida no está anulada.", 400);
	let a = H(r);
	if (!a) throw new V("El motivo para rehabilitar la partida es requerido.", 400);
	e.transaction(() => {
		Lt(e, n), e.prepare("UPDATE sacramentos\n			 SET estado = 'vigente', anulado_por_usuario_id = NULL, anulado_en = NULL, motivo_anulacion = NULL\n			 WHERE id = ?").run(n), W(e, n, t.user_id, "rehabilitada", [], a);
	})();
}
function wf(e, t, n) {
	if (t.role === "usuario") throw new V("Solo un administrador puede ver el historial de una partida.", 403);
	return Je(t, Nt(e, n).sacramento.parroquia_id, "Solo puede ver el historial de las partidas de su parroquia."), Be(e, n);
}
var Tf = {
	"sacraments.search": (e, { db: t }) => _f(t, lf(e.tipo), e),
	"sacraments.get": (e, { db: t }) => Nt(t, U(e.id)),
	"sacraments.create": (e, { db: t, session: n }) => ({ id: yf(t, n, e) }),
	"sacraments.update": (e, { db: t, session: n }) => (xf(t, n, e), { success: !0 }),
	"sacraments.annul": (e, { db: t, session: n }) => (Sf(t, n, U(e.id), e.motivo_anulacion), { success: !0 }),
	"sacraments.restore": (e, { db: t, session: n }) => (Cf(t, n, U(e.id), e.motivo), { success: !0 }),
	"sacraments.history": (e, { db: t, session: n }) => ({ historial: wf(t, n, U(e.id)) })
}, Ef = [
	"bautismo",
	"confirmacion",
	"matrimonio"
], Df = 10, Of = 8, $ = "COALESCE(s.fecha_evento, s.fecha_emision)", kf = `${$} GLOB '[0-9][0-9][0-9][0-9]*'`, Af = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'`, jf = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`, Mf = [
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
], Nf = {
	bautismo: Mf,
	confirmacion: Mf,
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
function Pf() {
	return {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
}
function Ff(e) {
	return String(e).padStart(2, "0");
}
var If = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/;
function Lf(e, t) {
	let [, , n, r] = e, [, , i, a] = t;
	return !n || !i ? null : i === n ? !r || !a ? null : a >= r : i > n;
}
function Rf(e, t) {
	let n = If.exec(e ?? ""), r = If.exec(t);
	if (!n || !r || n[0] !== e) return null;
	let i = Lf(n, r);
	if (i === null) return null;
	let a = Number(r[1]) - Number(n[1]);
	return i || --a, a < 0 || a > 130 ? null : a;
}
function zf(e, t, n, r = /* @__PURE__ */ new Date()) {
	let i = r.getFullYear(), a = Ff(r.getMonth() + 1), o = `${a}-${Ff(r.getDate())}`, s = e.prepare(`SELECT DISTINCT CAST(substr(${$}, 1, 4) AS INTEGER) AS year
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${kf}`).pluck().all(t), c = Math.min(...s, i), l = Math.max(...s, i), u = [];
	for (let e = l; e >= c; e--) u.push(e);
	let d = i;
	u.includes(n) && (d = n);
	let f = d === i, p = (n, ...r) => {
		let i = Pf(), a = e.prepare(`SELECT s.tipo, COUNT(*) AS total
				 FROM sacramentos s
				 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${n}
				 GROUP BY s.tipo`).all(t, ...r);
		for (let e of a) i[e.tipo] = e.total;
		return i;
	}, m = `${kf} AND substr(${$}, 1, 4) = ?`, h = f ? p(`${jf} AND substr(${$}, 1, 10) BETWEEN ? AND ?`, `${d - 1}-01-01`, `${d - 1}-${o}`) : p(m, String(d - 1)), g = p(m, String(d)), _ = p(`substr(${$}, 1, 7) = ?`, `${i}-${a}`), v = p(kf), y = {};
	for (let e of Ef) y[e] = {
		anio: g[e],
		anterior: h[e],
		mes: _[e],
		historico: v[e]
	};
	let b = [];
	for (let e = 1; e <= 12; e++) b.push({
		mes: e,
		...Pf()
	});
	let x = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${Af} AND substr(${$}, 1, 4) = ?
			 GROUP BY s.tipo, mes`).all(t, String(d));
	for (let e of x) b[e.mes - 1] && (b[e.mes - 1][e.tipo] = e.total);
	let ee = Math.max(Math.min(...u), d - Df + 1), S = [];
	for (let e = ee; e <= d; e++) S.push({
		anio: e,
		...Pf()
	});
	let C = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${kf}
			 GROUP BY s.tipo, anio`).all(t);
	for (let e of C) {
		let t = S.find((t) => t.anio === e.anio);
		t && (t[e.tipo] = e.total);
	}
	let w = e.prepare(`SELECT s.tipo, ${$} AS fecha, pe.fecha_nacimiento
			 FROM (${bt}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${kf} AND substr(${$}, 1, 4) = ?`).all(t, String(d)), T = {};
	for (let e of Ef) {
		let t = Nf[e].map(() => 0), n = 0, r = 0, i = 0;
		for (let a of w) {
			if (a.tipo !== e) continue;
			let o = Rf(a.fecha_nacimiento, a.fecha);
			if (o === null) {
				i += 1;
				continue;
			}
			let s = Nf[e].findIndex((e) => o <= e.to);
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
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${kf} AND substr(${$}, 1, 4) = ?
			 GROUP BY min.id
			 ORDER BY total DESC, nombre
			 LIMIT ?`).all(t, String(d), Of), D = e.prepare(`SELECT
				COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND c.estado = 'aprobado')), 0) AS conCorrecciones
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND ${kf} AND substr(${$}, 1, 4) = ?`).get(t, String(d));
	return {
		anios: u,
		anio: d,
		esAnioActual: f,
		totales: y,
		mensual: b,
		tendencia: S,
		bandasEdad: Object.fromEntries(Ef.map((e) => [e, Nf[e].map((e) => e.label)])),
		edades: T,
		ministros: E,
		registro: D
	};
}
var Bf = { "statistics.get": (e, { db: t }) => zf(t, U(e.parroquia_id), e.anio) }, Vf = {
	"sync.status": () => Ai(),
	"sync.run": async () => (await J(), Ai()),
	"sync.resolve": async (e) => (await ji(e.entidad, e.client_id, e.eleccion), Ai()),
	"sync.dismissNotice": () => (Mi(), { success: !0 })
}, Hf = /^[A-Za-z0-9._-]{3,50}$/;
function Uf(e) {
	return e.length < 6 ? "La contraseña debe tener al menos 6 caracteres." : /\s/.test(e) ? "La contraseña no puede tener espacios." : null;
}
function Wf(e) {
	return Wi.includes(e);
}
function Gf(e) {
	return e.rol === "admin_general" && e.parroquia_id !== null ? "Un administrador general no pertenece a ninguna parroquia." : e.rol !== "admin_general" && e.parroquia_id === null ? "Debe seleccionar una parroquia." : null;
}
function Kf(e, t, n) {
	return t.parroquia_id === e.parroquia_id ? t.otras_parroquias ? `Esta cuenta también trabaja en otras parroquias: solo el administrador general puede ${n}la.` : t.rol === "usuario" || t.rol === "admin_parroquia" && e.principal ? null : t.rol === "admin_parroquia" ? `Solo el administrador principal de la parroquia puede ${n} a otros administradores.` : "El administrador de una parroquia no gestiona administradores generales." : `Solo puede ${n} cuentas de su propia parroquia.`;
}
function qf(e, t) {
	return e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede crear administradores generales." : null : e.rol === "admin_parroquia" ? Kf(e, t, "crear") : "No tiene permiso para gestionar usuarios.";
}
function Jf(e, t) {
	return t.id === e.id ? null : e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede modificar a otros administradores generales." : null : e.rol === "admin_parroquia" ? Kf(e, t, "modificar") : "No tiene permiso para gestionar usuarios.";
}
function Yf(e) {
	return e.principal || e.principal_en_otra ? "No se puede deshabilitar al administrador principal: primero pase la marca de principal a otro administrador." : null;
}
function Xf(e, t) {
	return e.rol === "admin_general" ? t.rol === "admin_general" ? "Un administrador general no pertenece a ninguna parroquia." : null : "Solo el administrador general puede agregar o quitar parroquias de una cuenta.";
}
function Zf(e) {
	return e === "admin_general" || e === "admin_parroquia";
}
//#endregion
//#region electron/main/controllers/users.ts
var Qf = "Usuario no encontrado.", $f = "Agregar o quitar parroquias necesita conexión a internet: la cuenta tiene que estar en el servidor.", ep = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function tp(e) {
	if (!Zf(e.role)) throw new V("Solo un administrador puede gestionar usuarios.", 403);
}
function np(e, t) {
	return rr(e, t.user_id, t.role, t.parish_id);
}
function rp(e, t, n) {
	let r = ir(e, n, t.parish_id);
	if (!r) throw new V(Qf, 404);
	return r;
}
function ip(e, t, n) {
	return t === "admin_parroquia" ? +(e.prepare("SELECT 1 FROM membresias WHERE principal = 1 AND parroquia_id = ?").get(n) === void 0) : 0;
}
function ap(e, t) {
	if (!e && !t) return;
	let n = Uf(e);
	if (n) throw new V(n, 400);
}
function op(e) {
	let t = H(e?.nombre), n = H(e?.apellido_paterno);
	if (!t || !n) throw new V("Nombre y apellido paterno son requeridos.", 400);
	return {
		nombre: t,
		apellido_paterno: n,
		apellido_materno: H(e.apellido_materno) ?? ""
	};
}
function sp(e, t, n) {
	e.prepare("UPDATE usuarios SET password_hash_pendiente = ? WHERE id = ?").run(n, t), e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, n);
}
function cp(e, t) {
	return e.prepare("SELECT up.parroquia_id, p.nombre AS parroquia_nombre, up.rol, up.principal\n			 FROM usuario_parroquias up\n			 JOIN parroquias p ON p.id = up.parroquia_id\n			 WHERE up.usuario_id = ?\n			 ORDER BY p.nombre").all(t);
}
function lp(e, t, n) {
	tp(t);
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
		t && (r.push(`u.${ep[e]} LIKE ?`), i.push(`%${t}%`));
	}
	let c = "";
	r.length > 0 && (c = "WHERE " + r.join(" AND "));
	let l = we(n, e.prepare(`SELECT COUNT(*) AS total ${o} ${c}`).get(...i).total), u = ep[n.orden ?? "nombres"] ?? ep.nombres, d = e.prepare(`SELECT u.id, u.username, ${s}, u.parroquia_id AS parroquia_origen_id,
				u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, p.nombre AS parroquia_nombre
			 ${o}
			 ${c}
			 ORDER BY u.${u} ${Te(n)}, u.id
			 LIMIT ? OFFSET ?`).all(...i, 20, l.offset);
	for (let t of d) t.parroquias_adicionales = cp(e, t.id);
	return {
		resultados: d,
		total_paginas: l.total_pages
	};
}
async function up(e, t, n) {
	tp(t);
	let r = op(n), i = H(n?.username) ?? "", a = typeof n?.password == "string" ? n.password : "", o = n?.rol ?? "usuario";
	if (!Hf.test(i)) throw new V("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	if (ap(a, !0), !Wf(o)) throw new V("El rol no es válido.", 400);
	let s = null;
	o !== "admin_general" && (s = t.role === "admin_parroquia" ? t.parish_id : Number.isInteger(n.parroquia_id) ? n.parroquia_id : null);
	let c = {
		rol: o,
		parroquia_id: s
	}, l = Gf(c);
	if (l) throw new V(l, 400);
	let u = qf(np(e, t), c);
	if (u) throw new V(u, 403);
	if (s !== null && !e.prepare("SELECT 1 FROM parroquias WHERE id = ? AND activa = 1").get(s)) throw new V("La parroquia seleccionada no existe.", 400);
	if (e.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE").get(i)) throw new V("Ese nombre de usuario ya existe.", 409);
	let d = await gn(a), f = crypto.randomUUID();
	return e.transaction(() => {
		let t = e.prepare("SELECT MIN(id) FROM usuarios").pluck().get(), n = Math.min(t ?? 0, 0) - 1;
		return ut(e, "usuario", f, null), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)").run(n, f, s, i, o, r.nombre, r.apellido_paterno, r.apellido_materno, ip(e, o, s)), sp(e, n, d), n;
	})();
}
function dp(e, t, n) {
	let r = H(n), i = e.prepare("SELECT username FROM usuarios WHERE id = ?").pluck().get(t);
	if (!r || r === i) return null;
	if (t > 0) throw new V("El nombre de usuario no se puede cambiar: la cuenta ya está en el servidor.", 400);
	if (!Hf.test(r)) throw new V("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	if (e.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE AND id <> ?").get(r, t)) throw new V("Ese nombre de usuario ya existe.", 409);
	return r;
}
async function fp(e, t, n) {
	let r = yp(n?.id);
	r !== t.user_id && tp(t);
	let i = op(n), a = typeof n.password == "string" ? n.password : "";
	ap(a, !1);
	let o = rp(e, t, r), s = Jf(np(e, t), o);
	if (s) throw new V(s, 403);
	let c = a ? await gn(a) : null, l = dp(e, r, n?.username);
	e.transaction(() => {
		ut(e, "usuario", o.client_id, o.version), e.prepare("UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.nombre, i.apellido_paterno, i.apellido_materno, r), c && sp(e, r, c), l && (e.prepare("UPDATE usuarios SET username = ? WHERE id = ?").run(l, r), e.prepare("UPDATE sync_cola SET estado = 'pendiente', motivo = NULL WHERE entidad = 'usuario' AND client_id = ? AND estado = 'rechazado'").run(o.client_id));
	})();
}
function pp(e, t, n) {
	if (tp(t), n === t.user_id) throw new V("No puede deshabilitar su propia cuenta.", 400);
	let r = rp(e, t, n), i = Jf(np(e, t), r);
	if (i) throw new V(i, 403);
	let a = r.activo === 1 ? Yf(r) : null;
	if (a) throw new V(a, 400);
	e.transaction(() => {
		ut(e, "usuario", r.client_id, r.version), e.prepare("UPDATE usuarios SET activo = NOT activo WHERE id = ?").run(n), r.activo === 1 && e.prepare("DELETE FROM credenciales_locales WHERE usuario_id = ?").run(n);
	})();
}
async function mp(e, t, n, r) {
	if (typeof t != "string" || !e.prepare("SELECT 1 FROM usuarios WHERE username = ?").get(t)) throw new V(Qf, 404);
	await J();
	let i = e.prepare("SELECT id FROM usuarios WHERE username = ?").pluck().get(t), a = sr()?.token;
	if (!a || i < 0) throw new V(n, 503);
	await r(i, a), await J();
}
async function hp(e, t, n, r = null) {
	tp(t);
	let i = t.role === "admin_general" ? null : t.parish_id;
	Number.isInteger(r) && (i = r), await mp(e, n, "Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.", async (e, t) => {
		await q(`/api/users/${e}/make-principal`, {
			method: "PATCH",
			token: t,
			body: { parroquia_id: i }
		});
	});
}
function gp(e, t, n, r) {
	let i = rp(e, t, yp(n)), a = Xf(np(e, t), i);
	if (a) throw new V(a, 403);
	if (!Number.isInteger(r)) throw new V("Debe seleccionar una parroquia.", 400);
	return {
		username: e.prepare("SELECT username FROM usuarios WHERE id = ?").pluck().get(i.id),
		parish_id: r
	};
}
async function _p(e, t, n, r, i) {
	let a = gp(e, t, n, r);
	await mp(e, a.username, $f, async (e, t) => {
		await q(`/api/users/${e}/parishes/${a.parish_id}`, {
			method: "PUT",
			token: t,
			body: { rol: i }
		});
	});
}
async function vp(e, t, n, r) {
	let i = gp(e, t, n, r);
	await mp(e, i.username, $f, async (e, t) => {
		await q(`/api/users/${e}/parishes/${i.parish_id}`, {
			method: "DELETE",
			token: t
		});
	});
}
function yp(e) {
	if (!Number.isInteger(e) || e === 0) throw new V(Qf, 404);
	return e;
}
var bp = {
	"users.search": (e, { db: t, session: n }) => lp(t, n, e ?? {}),
	"users.create": async (e, { db: t, session: n }) => {
		let r = await up(t, n, e);
		return J(), { id: r };
	},
	"users.update": async (e, { db: t, session: n }) => (await fp(t, n, e), J(), { success: !0 }),
	"users.toggleActive": (e, { db: t, session: n }) => (pp(t, n, yp(e?.id)), J(), { success: !0 }),
	"users.makePrincipal": async (e, { db: t, session: n }) => (await hp(t, n, e?.username, e?.parroquia_id ?? null), { success: !0 }),
	"users.setParish": async (e, { db: t, session: n }) => (await _p(t, n, e?.id, e?.parroquia_id, e?.rol), { success: !0 }),
	"users.removeParish": async (e, { db: t, session: n }) => (await vp(t, n, e?.id, e?.parroquia_id), { success: !0 }),
	"users.me": (e, { db: t, session: n }) => ({ principal: Zf(n.role) && np(t, n).principal })
};
//#endregion
//#region electron/main/utils/middleware.ts
async function xp(e, t, r, i) {
	if (Object.hasOwn(t, r)) return t[r](i);
	if (!Object.hasOwn(e, r)) throw new V("Operación no reconocida.", 404);
	let a = {
		session: or(),
		db: G(),
		user_data_folder: n.getPath("userData")
	};
	return e[r](i, a);
}
function Sp(e, t) {
	i.handle($n, async (n, r, i) => {
		try {
			return {
				ok: !0,
				data: await xp(e, t, r, i)
			};
		} catch (e) {
			return e instanceof V ? {
				ok: !1,
				message: e.message,
				status: e.status
			} : (mr(`Error en ${r}:`, e), {
				ok: !1,
				message: "Ocurrió un error inesperado.",
				status: 500
			});
		}
	});
}
//#endregion
//#region electron/main/app.ts
function Cp() {
	Sp({
		...va,
		...ef,
		...Jd,
		...Tf,
		...bo,
		...Bf,
		...sf,
		...Vf,
		...bp,
		...an,
		...Rd,
		...ja,
		...io
	}, {
		...ya,
		...Aa,
		...ao,
		...tf
	});
}
function wp() {
	i.handle("app:get-version", () => n.getVersion()), Cp();
	try {
		Jn();
	} catch (e) {
		mr("No se pudo abrir la base local:", e);
	}
	Oa();
}
async function Tp() {
	Si();
	try {
		await Ni(xe);
	} catch (e) {
		mr("No se pudo sincronizar al cerrar:", e);
	}
}
function Ep() {
	Qn();
}
//#endregion
//#region electron/main/index.ts
var Dp = s.dirname(c(import.meta.url)), Op = process.env.VITE_DEV_SERVER_URL, kp = null, Ap = !1;
function jp() {
	if (kp = new t({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: s.join(Dp, "index.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), process.env.PRELATURA_SECOND_SCREEN === "1") {
		let e = o.getAllDisplays().find((e) => e.id !== o.getPrimaryDisplay().id);
		e && kp.setBounds(e.workArea);
	}
	kp.maximize(), Op ? (kp.loadURL(Op), kp.webContents.openDevTools()) : kp.loadFile(s.join(Dp, "../dist/index.html")), kp.on("closed", () => {
		kp = null;
	});
}
n.whenReady().then(() => {
	wp(), jp();
}), n.on("before-quit", (e) => {
	Ap || (e.preventDefault(), Ap = !0, Tp().finally(() => n.quit()));
}), n.on("will-quit", Ep), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
}), n.on("activate", () => {
	t.getAllWindows().length === 0 && jp();
});
//#endregion
export {};
