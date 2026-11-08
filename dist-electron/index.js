import { createRequire as e } from "node:module";
import { BrowserWindow as t, app as n, dialog as r, ipcMain as i, safeStorage as a, screen as o } from "electron";
import s from "node:path";
import { fileURLToPath as c } from "node:url";
import l, { existsSync as u, mkdirSync as d, readFileSync as f, readdirSync as p, renameSync as m, rmSync as h, statSync as g, writeFileSync as _ } from "node:fs";
import { gunzipSync as v, gzipSync as y } from "node:zlib";
import b from "better-sqlite3-multiple-ciphers";
import { createCipheriv as x, createDecipheriv as S, pbkdf2 as C, randomBytes as w, randomUUID as ee, scrypt as T, timingSafeEqual as E } from "node:crypto";
import { Worker as D } from "node:worker_threads";
import O from "zlib";
import { Duplex as k, PassThrough as te, Transform as A, pipeline as ne } from "stream";
import { Blob as re } from "node:buffer";
import j, { Readable as M, Transform as ie } from "node:stream";
import { createRequire as N } from "module";
//#region \0rolldown/runtime.js
var P = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), F = /* @__PURE__ */ e(import.meta.url), ae = [
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
], I = [
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
], L = I.map((e) => e.campo);
function ce(e) {
	return e === "matrimonio" ? se : oe;
}
function le(e) {
	return ce(e).map((e) => e.campo);
}
function ue(e) {
	return e === "matrimonio" ? ["conyuge_1", "conyuge_2"] : ["persona"];
}
function de(e, t) {
	return e === "sacramento" ? ae : e === "detalle" ? ce(t) : I;
}
function fe(e, t) {
	return t === "sacramento" ? e.sacramento : t === "persona" ? e.persona : t === "conyuge_1" || t === "conyuge_2" ? e[t] : e;
}
function R(e, t) {
	return fe(e, t);
}
function pe(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" ? null : t;
}
function me(e, t, n) {
	return pe(fe(e, t)?.[n]);
}
function he(e, t, n, r) {
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
function ge(e, t) {
	let n = [], r = e.sacramento.tipo, i = [
		"sacramento",
		...ue(r),
		"detalle"
	];
	for (let a of i) for (let i of de(a, r)) {
		let r = me(e, a, i.campo), o = me(t, a, i.campo);
		r !== o && n.push({
			parte: a,
			campo: i.campo,
			valor_anterior: r,
			valor_nuevo: o
		});
	}
	return n;
}
var _e = 1e4, ve = 3e5, ye = 5e3, z = {
	cursor: "cursor",
	last_sync: "ultima_sync",
	notice: "aviso",
	key_registered: "clave_registrada"
}, be = {
	database: "prelatura-local.db",
	key: "prelatura-local.key",
	device: "prelatura-dispositivo.id",
	temp_database: "prelatura-reconstruccion.db",
	temp_key: "prelatura-reconstruccion.key",
	set_aside_folder: "bases-apartadas",
	logos_folder: "logos"
}, xe = 2592e6, B = class extends Error {
	status;
	constructor(e, t) {
		super(e), this.name = "ServiceError", this.status = t;
	}
};
//#endregion
//#region electron/main/utils/helpers.ts
function V(e) {
	if (typeof e != "string") return null;
	let t = e.trim();
	return t === "" ? null : t;
}
function H(e, t = "Partida no encontrada.") {
	if (!Number.isInteger(e) || e <= 0) throw new B(t, 404);
	return e;
}
function Se(e, t) {
	let n = 1;
	return Number.isInteger(e.pagina) && e.pagina > 0 && (n = e.pagina), {
		offset: (n - 1) * 20,
		total_pages: Math.max(1, Math.ceil(t / 20))
	};
}
function Ce(e) {
	return e.direccion === "desc" ? "DESC" : "ASC";
}
function we(e, t, n) {
	return [
		e,
		t,
		n
	].filter((e) => e).join(" ");
}
//#endregion
//#region electron/main/models/field_values.ts
var Te = "ministro_id";
function Ee(e, t, n) {
	return t !== Te || n === null ? n : e.prepare("SELECT client_id FROM ministros WHERE id = ?").get(Number(n))?.client_id ?? null;
}
function De(e, t, n) {
	if (t !== Te || n === null) return n;
	let r = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(n);
	return r ? String(r.id) : null;
}
function Oe(e, t, n) {
	if (t !== Te || n === null) return n;
	let r = e.prepare("SELECT titulo, nombre, apellido_paterno, apellido_materno FROM ministros WHERE client_id = ?").get(n);
	return r ? [r.titulo, we(r.nombre, r.apellido_paterno, r.apellido_materno)].filter(Boolean).join(" ") : "Celebrante desconocido";
}
//#endregion
//#region electron/main/models/change_request.ts
function ke(e, t) {
	return e.prepare("SELECT 1 FROM solicitudes_cambio WHERE sacramento_id = ? AND estado = 'pendiente'").get(t) !== void 0;
}
function Ae(e, t) {
	return e.prepare("SELECT id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo FROM solicitudes_cambio\n			 WHERE sacramento_id = ? AND estado = 'pendiente' ORDER BY id").all(t).map((t) => ({
		...t,
		valor_anterior: De(e, t.campo, t.valor_anterior),
		valor_nuevo: De(e, t.campo, t.valor_nuevo)
	}));
}
function je(e, t, n, r) {
	let i = e.prepare("INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"), a = (/* @__PURE__ */ new Date()).toISOString();
	for (let o of r) i.run(crypto.randomUUID(), t, n, o.parte, o.campo, o.tipo, Ee(e, o.campo, o.valor_anterior), Ee(e, o.campo, o.valor_nuevo), a);
}
function Me(e, t, n, r, i = null) {
	e.prepare("UPDATE solicitudes_cambio SET estado = ?, motivo = ?, revisado_por_usuario_id = ?, revisado_en = ?\n		 WHERE sacramento_id = ? AND estado = 'pendiente'").run(n, i, r, (/* @__PURE__ */ new Date()).toISOString(), t);
}
function Ne(e, t) {
	return e.prepare("SELECT s.id, s.parte, s.campo, s.tipo, s.valor_anterior, s.valor_nuevo, s.estado, s.motivo, s.creado_en, s.revisado_en,\n				p.nombre AS pide_nombre, p.apellido_paterno AS pide_paterno, p.apellido_materno AS pide_materno,\n				r.nombre AS revisa_nombre, r.apellido_paterno AS revisa_paterno, r.apellido_materno AS revisa_materno\n			 FROM solicitudes_cambio s\n			 LEFT JOIN usuarios p ON p.id = s.usuario_id\n			 LEFT JOIN usuarios r ON r.id = s.revisado_por_usuario_id\n			 WHERE s.sacramento_id = ?\n			 ORDER BY s.creado_en DESC, s.id").all(t).map((t) => ({
		id: t.id,
		parte: t.parte,
		campo: t.campo,
		tipo: t.tipo,
		valor_anterior: De(e, t.campo, t.valor_anterior),
		valor_nuevo: De(e, t.campo, t.valor_nuevo),
		texto_anterior: Oe(e, t.campo, t.valor_anterior),
		texto_nuevo: Oe(e, t.campo, t.valor_nuevo),
		estado: t.estado,
		motivo: t.motivo,
		solicitado_por: we(t.pide_nombre, t.pide_paterno, t.pide_materno) || "Un usuario",
		creado_en: t.creado_en,
		revisado_por: t.revisa_nombre ? we(t.revisa_nombre, t.revisa_paterno, t.revisa_materno) : null,
		revisado_en: t.revisado_en
	}));
}
function Pe(e, t) {
	return e.prepare("SELECT client_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n				revisado_por_usuario_id, revisado_en, creado_en\n			 FROM solicitudes_cambio WHERE sacramento_id = ? ORDER BY id").all(t);
}
function Fe(e, t, n) {
	let r = e.prepare("INSERT INTO solicitudes_cambio\n			(client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, estado, motivo,\n			 revisado_por_usuario_id, revisado_en, creado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			motivo = excluded.motivo,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of n) r.run(e.client_id, t, e.usuario_id, e.parte, e.campo, e.tipo, e.valor_anterior, e.valor_nuevo, e.estado, e.motivo, e.revisado_por_usuario_id, e.revisado_en, e.creado_en);
}
function Ie(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM solicitudes_cambio WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/history.ts
function U(e, t, n, r, i = [], a = null) {
	let o = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, n, r, a, (/* @__PURE__ */ new Date()).toISOString()), s = Number(o.lastInsertRowid), c = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let t of i) c.run(s, t.parte, t.campo, Ee(e, t.campo, t.valor_anterior), Ee(e, t.campo, t.valor_nuevo));
}
function Le(e, t) {
	return e.prepare("SELECT parte, campo, valor_anterior, valor_nuevo FROM historial_campos WHERE historial_id = ? ORDER BY id").all(t);
}
function Re(e, t) {
	return e.prepare("SELECT h.id, h.evento, h.motivo, h.fecha, u.nombre, u.apellido_paterno, u.apellido_materno, u.username\n			 FROM historial_partidas h\n			 LEFT JOIN usuarios u ON u.id = h.usuario_id\n			 WHERE h.sacramento_id = ?\n			 ORDER BY h.fecha DESC, h.id DESC").all(t).map((t) => ({
		id: t.id,
		evento: t.evento,
		motivo: t.motivo,
		fecha: t.fecha,
		usuario: we(t.nombre, t.apellido_paterno, t.apellido_materno) || t.username || "Usuario desconocido",
		campos: Le(e, t.id).map((t) => ({
			parte: t.parte,
			campo: t.campo,
			texto_anterior: Oe(e, t.campo, t.valor_anterior),
			texto_nuevo: Oe(e, t.campo, t.valor_nuevo)
		}))
	}));
}
function ze(e, t) {
	return e.prepare("SELECT id, client_id, usuario_id, evento, motivo, fecha FROM historial_partidas WHERE sacramento_id = ? ORDER BY id").all(t).map(({ id: t, ...n }) => ({
		...n,
		campos: Le(e, t)
	}));
}
function Be(e, t, n) {
	let r = e.prepare("INSERT INTO historial_partidas (client_id, sacramento_id, usuario_id, evento, motivo, fecha)\n		 VALUES (?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO NOTHING"), i = e.prepare("INSERT INTO historial_campos (historial_id, parte, campo, valor_anterior, valor_nuevo) VALUES (?, ?, ?, ?, ?)");
	for (let e of n) {
		let n = r.run(e.client_id, t, e.usuario_id, e.evento, e.motivo, e.fecha);
		if (n.changes !== 0) for (let t of e.campos) i.run(Number(n.lastInsertRowid), t.parte, t.campo, t.valor_anterior, t.valor_nuevo);
	}
}
function Ve(e, t, n) {
	let r = JSON.stringify(n.map((e) => e.client_id));
	e.prepare("DELETE FROM historial_campos WHERE historial_id IN (SELECT id FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?)))").run(t, r), e.prepare("DELETE FROM historial_partidas WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(t, r);
}
//#endregion
//#region electron/main/models/parish.ts
var He = "El administrador general solo consulta: no puede registrar ni modificar datos de las parroquias.";
function Ue(e, t) {
	return e.prepare("SELECT * FROM parroquias WHERE id = ?").get(t);
}
function We(e) {
	if (e.role === "admin_general") throw new B(He, 403);
	if (!e.parish_id) throw new B("El usuario no tiene una parroquia asignada.", 400);
	return e.parish_id;
}
function Ge(e, t, n) {
	if (e.role === "admin_general") throw new B(He, 403);
	if (e.parish_id !== t) throw new B(n, 403);
}
function Ke(e, t, n) {
	if (e.role !== "admin_general" && e.parish_id !== t) throw new B(n, 403);
}
function qe(e, t, n, r) {
	if (Ge(e, t, n), e.role !== "admin_parroquia") throw new B(r, 403);
}
//#endregion
//#region electron/main/models/person.ts
var Je = [
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
function Ye(e) {
	return {
		dni: V(e.dni),
		nombres: V(e.nombres) ?? "",
		apellido_paterno: V(e.apellido_paterno) ?? "",
		apellido_materno: V(e.apellido_materno) ?? "",
		fecha_nacimiento: V(e.fecha_nacimiento),
		fecha_aproximada: V(e.fecha_aproximada),
		lugar_nacimiento: V(e.lugar_nacimiento),
		padre: V(e.padre),
		madre: V(e.madre)
	};
}
function Xe(e, t) {
	let n = e.prepare("SELECT * FROM personas WHERE id = ?").get(t), r = e.prepare("SELECT * FROM cambios_persona WHERE persona_id = ? ORDER BY id").all(t);
	return {
		...n,
		cambios: r
	};
}
function Ze(e, t, n) {
	let r = Ye(n), i = e.prepare("INSERT INTO personas\n				(client_id, parroquia_id, dni, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_aproximada, lugar_nacimiento, padre, madre)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), t, r.dni, r.nombres, r.apellido_paterno, r.apellido_materno, r.fecha_nacimiento, r.fecha_aproximada, r.lugar_nacimiento, r.padre, r.madre);
	return Number(i.lastInsertRowid);
}
function Qe(e, t, n) {
	let r = Ye(n), i = e.prepare(`SELECT ${L.join(", ")} FROM personas WHERE id = ?`).get(t), a = L.filter((e) => i[e] !== r[e]);
	if (a.length === 0) return;
	let o = a.map((e) => `${e} = ?`).join(", "), s = a.map((e) => r[e]);
	e.prepare(`UPDATE personas SET ${o} WHERE id = ?`).run(...s, t);
}
function $e(e) {
	let t = Array.isArray(e.cambios) ? e.cambios.filter((e) => e.id === void 0) : [], n = { ...e }, r = [];
	for (let i of t) {
		let t = Je.find((e) => e.column === i.campo_cambio);
		if (!t) throw new B("La nota marginal indica un campo que no se puede corregir.", 400);
		if (r.some((e) => e.campo_cambio === t.column)) throw new B(`La nota marginal repite el campo ${t.label}.`, 400);
		let a = V(e[t.column]), o = V(i.valor_nuevo);
		if (!a) throw new B(`Complete ${t.label} antes de corregirlo en la nota marginal.`, 400);
		if (!o) throw new B(`Indique el valor nuevo de ${t.label} en la nota marginal.`, 400);
		if (o === a) throw new B(`El valor nuevo de ${t.label} es igual al anterior.`, 400);
		n[t.column] = o, r.push({
			campo_cambio: t.column,
			valor_anterior: a,
			valor_nuevo: o
		});
	}
	return {
		person: n,
		corrections: r
	};
}
function et(e, t, n, r, i) {
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, 'aprobado', ?, ?)"), o = (/* @__PURE__ */ new Date()).toISOString();
	for (let e of i) a.run(crypto.randomUUID(), n, r, t.user_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, t.user_id, o);
}
function tt(e, t) {
	return `(${e}.${t} LIKE ? OR EXISTS (
		SELECT 1 FROM cambios_persona cp
		WHERE cp.persona_id = ${e}.id AND cp.campo_cambio = '${t}' AND cp.estado = 'aprobado' AND cp.valor_anterior LIKE ?
	))`;
}
//#endregion
//#region electron/main/sync/queue.ts
function W(e, t, n, r) {
	e.prepare("INSERT INTO sync_cola (entidad, client_id, version_base, cola_id) VALUES (?, ?, ?, ?)\n		 ON CONFLICT (entidad, client_id) DO UPDATE SET revision = revision + 1").run(t, n, r, crypto.randomUUID());
}
function nt(e, t, n) {
	return e.prepare("SELECT 1 FROM sync_cola WHERE entidad = ? AND client_id = ?").get(t, n) !== void 0;
}
function rt(e, t, n) {
	e.prepare("DELETE FROM sync_cola WHERE entidad = ? AND client_id = ?").run(t, n);
}
function it(e, t) {
	let n = e.prepare("SELECT valor FROM sync_estado WHERE clave = ?").get(t);
	return n ? n.valor : null;
}
function at(e, t, n) {
	e.prepare("INSERT INTO sync_estado (clave, valor) VALUES (?, ?)\n		 ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor").run(t, n);
}
//#endregion
//#region electron/main/models/minister.ts
function ot(e, t) {
	let n = e.prepare("SELECT * FROM ministros WHERE id = ?").get(t);
	return n ? {
		...n,
		parroquia: Ue(e, n.parroquia_id)
	} : null;
}
//#endregion
//#region electron/main/models/sacrament.ts
function st(e) {
	return e === "bautismo" || e === "confirmacion" || e === "matrimonio";
}
function ct(e) {
	return e === "bautismo" ? "bautismos" : e === "confirmacion" ? "confirmaciones" : "matrimonios";
}
function lt(e) {
	return e === "matrimonio" ? ["conyuge_1_id", "conyuge_2_id"] : ["persona_id"];
}
function ut(e) {
	return e === "bautismo" ? "SELECT sacramento_id, persona_id FROM bautismos" : e === "confirmacion" ? "SELECT sacramento_id, persona_id FROM confirmaciones" : "SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n		UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
}
var dt = "SELECT sacramento_id, persona_id FROM bautismos\n	UNION ALL SELECT sacramento_id, persona_id FROM confirmaciones\n	UNION ALL SELECT sacramento_id, conyuge_1_id AS persona_id FROM matrimonios\n	UNION ALL SELECT sacramento_id, conyuge_2_id AS persona_id FROM matrimonios";
function ft(e, t) {
	let n = e.prepare("SELECT * FROM sacramentos WHERE id = ?").get(t);
	if (!n) return null;
	let r = null;
	return n.ministro_id !== null && (r = ot(e, n.ministro_id)), {
		...n,
		parroquia: Ue(e, n.parroquia_id),
		ministro: r
	};
}
function pt(e) {
	let t = V(e.fecha_emision), n = V(e.libro), r = V(e.folio), i = V(e.numero);
	if (!t || !n || !r || !i) throw new B("La fecha, el libro, el folio y el número de registro son requeridos.", 400);
	return {
		fecha_emision: t,
		libro: n,
		folio: r,
		numero: i,
		ministro_id: e.ministro_id ?? null,
		fecha_evento: V(e.fecha_evento),
		anotaciones: V(e.anotaciones)
	};
}
function mt(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM sacramentos WHERE id = ? AND tipo = ?").get(t, n);
	if (!r) throw new B("Partida no encontrada.", 404);
	return r.parroquia_id;
}
var ht = "No tiene permiso para modificar partidas de otra parroquia.";
function gt(e, t, n, r) {
	qe(t, mt(e, n, r), ht, "Solo el administrador de la parroquia puede modificar o anular una partida. Pida la corrección con una nota marginal.");
}
function _t(e, t, n) {
	if (t === null) return;
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(t);
	if (r && r.parroquia_id !== n) throw new B("El celebrante debe ser de la parroquia de la partida.", 400);
}
function vt(e, t, n, r, i) {
	let a = pt(i);
	_t(e, a.ministro_id, r);
	let o = e.prepare("INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, n, r, a.ministro_id, a.libro, a.folio, a.numero, a.fecha_emision, a.fecha_evento, a.anotaciones);
	return Number(o.lastInsertRowid);
}
function yt(e, t, n) {
	let r = pt(n), i = e.prepare("SELECT ministro_id, parroquia_id FROM sacramentos WHERE id = ?").get(t);
	r.ministro_id !== i.ministro_id && _t(e, r.ministro_id, i.parroquia_id), e.prepare("UPDATE sacramentos\n		 SET ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?\n		 WHERE id = ?").run(r.ministro_id, r.libro, r.folio, r.numero, r.fecha_emision, r.fecha_evento, r.anotaciones, t);
}
//#endregion
//#region electron/main/models/record.ts
var bt = "Partida no encontrada.";
function xt(e, t, n) {
	let r = ft(e, t);
	if (!r || r.tipo !== n) throw new B(bt, 404);
	return {
		...r,
		solicitudes: Ne(e, t)
	};
}
function St(e, t, n) {
	let r = xt(e, n, t), i = e.prepare(`SELECT * FROM ${ct(t)} WHERE sacramento_id = ?`).get(n);
	return {
		sacramento: r,
		persona: Xe(e, i.persona_id),
		padrino_1: i.padrino_1,
		padrino_2: i.padrino_2
	};
}
function Ct(e, t) {
	let n = xt(e, t, "matrimonio"), r = e.prepare("SELECT * FROM matrimonios WHERE sacramento_id = ?").get(t);
	return {
		sacramento: n,
		conyuge_1: Xe(e, r.conyuge_1_id),
		conyuge_2: Xe(e, r.conyuge_2_id),
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
function wt(e, t) {
	let n = e.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(t);
	if (!n) throw new B(bt, 404);
	return n.tipo === "matrimonio" ? Ct(e, t) : St(e, n.tipo, t);
}
var Tt = [
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
], Et = [
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
], Dt = {
	persona: "",
	conyuge_1: " del esposo",
	conyuge_2: " de la esposa",
	sacramento: "",
	detalle: ""
};
function Ot(e) {
	return !!(V(e?.fecha_nacimiento) || V(e?.fecha_aproximada));
}
function kt(e, t, n) {
	let r = [];
	for (let { field: t, label: n } of Tt) V(e?.[t]) || r.push(n);
	(t === null || Ot(t)) && !Ot(e) && r.push("fecha de nacimiento (o fecha aproximada)");
	for (let { field: n, label: i } of Et) (t === null || V(t[n]) !== null) && !V(e?.[n]) && r.push(i);
	if (r.length > 0) throw new B(`Faltan datos${n}: ${r.join(", ")}.`, 400);
}
function At(e, t) {
	for (let n of ue(e.sacramento.tipo)) kt(R(e, n), t ? R(t, n) : null, Dt[n]);
	if ((t === null || t.sacramento.ministro_id !== null) && !e.sacramento?.ministro_id) throw new B("Seleccione el celebrante.", 400);
}
function jt(e, t) {
	let n = e.prepare("SELECT tipo, client_id, version FROM sacramentos WHERE id = ?").get(t);
	W(e, n.tipo, n.client_id, n.version);
}
function Mt(e) {
	return [
		V(e.lugar),
		V(e.testigo_1),
		V(e.testigo_2),
		V(e.testigo_3),
		V(e.testigo_4),
		V(e.conyuge_1_bautismo_parroquia),
		V(e.conyuge_1_bautismo_fecha),
		V(e.conyuge_2_bautismo_parroquia),
		V(e.conyuge_2_bautismo_fecha)
	];
}
function Nt(e, t) {
	return t.map((t) => ({
		parte: e,
		campo: t.campo_cambio,
		valor_anterior: t.valor_anterior ?? null,
		valor_nuevo: t.valor_nuevo
	}));
}
function Pt(e, t, n, r) {
	return ue(n.sacramento.tipo).map((i) => {
		let a = R(n, i), o = $e(a);
		return {
			id: Ze(e, t, r ? o.person : a),
			part: i,
			corrections: o.corrections
		};
	});
}
function Ft(e) {
	return e.flatMap((e) => Nt(e.part, e.corrections));
}
function It(e, t, n, r) {
	let i = n.sacramento.tipo;
	if (i === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t, r[0], r[1], ...Mt(n));
		return;
	}
	let a = n;
	e.prepare(`INSERT INTO ${ct(i)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(t, r[0], V(a.padrino_1), V(a.padrino_2));
}
function Lt(e, t, n) {
	let r = n.sacramento.tipo;
	if (r === "matrimonio") {
		e.prepare("UPDATE matrimonios SET\n				lugar = ?, testigo_1 = ?, testigo_2 = ?, testigo_3 = ?, testigo_4 = ?,\n				conyuge_1_bautismo_parroquia = ?, conyuge_1_bautismo_fecha = ?,\n				conyuge_2_bautismo_parroquia = ?, conyuge_2_bautismo_fecha = ?\n			 WHERE sacramento_id = ?").run(...Mt(n), t);
		return;
	}
	let i = n;
	e.prepare(`UPDATE ${ct(r)} SET padrino_1 = ?, padrino_2 = ? WHERE sacramento_id = ?`).run(V(i.padrino_1), V(i.padrino_2), t);
}
function Rt(e, t, n, r) {
	At(r, n);
	let i = n.sacramento.id, a = [];
	for (let o of ue(n.sacramento.tipo)) {
		let s = R(n, o).id, c = $e(R(r, o));
		Qe(e, s, c.person), et(e, t, s, i, c.corrections), a.push(...Nt(o, c.corrections));
	}
	return yt(e, i, r.sacramento), Lt(e, i, r), {
		fields: ge(n, r),
		corrections: a
	};
}
function zt(e, t, n, r) {
	let i = R(e, t), a = {
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
var Bt = "Solo un administrador de la parroquia puede aprobar o rechazar cambios.", Vt = "La partida tiene un cambio pendiente de aprobación. Un administrador de la parroquia debe aprobarlo o rechazarlo primero.", Ht = "Descartada al editar la partida";
function Ut(e, t) {
	return e.map((e) => ({
		...e,
		tipo: t
	}));
}
function Wt(e, t) {
	let n = [];
	for (let r of ue(e.sacramento.tipo)) {
		let i = R(t, r), a = Array.isArray(i?.cambios) ? i.cambios.filter((e) => e.id === void 0) : [], o = $e({
			...R(e, r),
			cambios: a
		}).corrections;
		for (let e of o) n.push({
			parte: r,
			campo: e.campo_cambio,
			valor_anterior: e.valor_anterior ?? null,
			valor_nuevo: e.valor_nuevo
		});
	}
	return n;
}
function Gt(e, t, n) {
	let r = H(n.sacramento?.id), i = wt(e, r);
	if (Ge(t, i.sacramento.parroquia_id, ht), i.sacramento.estado === "anulado") throw new B("Una partida anulada no admite cambios.", 409);
	if (ke(e, r)) throw new B(Vt, 409);
	let a = V(n.sacramento?.anotaciones), o = V(i.sacramento.anotaciones) === null && a !== null, s = ge(i, n).filter((e) => !(o && e.campo === "anotaciones")), c = Wt(i, n);
	if (c.some((e) => s.some((t) => t.parte === e.parte && t.campo === e.campo))) throw new B("No cambie el mismo dato en el formulario y en la nota marginal a la vez.", 400);
	if (s.length === 0 && c.length === 0 && !o) throw new B("No hay cambios para pedir.", 400);
	At(n, i);
	let l = [...Ut(s, "digitacion"), ...Ut(c, "nota_marginal")];
	e.transaction(() => {
		jt(e, r), o && (e.prepare("UPDATE sacramentos SET anotaciones = ? WHERE id = ?").run(a, r), U(e, r, t.user_id, "editada", [{
			parte: "sacramento",
			campo: "anotaciones",
			valor_anterior: null,
			valor_nuevo: a
		}])), l.length > 0 && (je(e, r, t.user_id, l), U(e, r, t.user_id, "cambio_pedido", l));
	})();
}
function Kt(e, t) {
	let n = e;
	for (let e of t) n = e.tipo === "nota_marginal" ? zt(n, e.parte, e.campo, e.valor_nuevo) : he(n, e.parte, e.campo, e.valor_nuevo);
	return n;
}
function qt(e, t) {
	return t.every((t) => t.tipo === "digitacion" ? me(e, t.parte, t.campo) === t.valor_nuevo : (R(e, t.parte).cambios ?? []).some((e) => e.id === void 0 && e.campo_cambio === t.campo && V(e.valor_nuevo) === t.valor_nuevo));
}
function Jt(e, t) {
	qe(e, t.sacramento.parroquia_id, ht, Bt);
}
function Yt(e, t, n, r) {
	if (r !== "aprobado" && r !== "rechazado") throw new B("Indique si aprueba o rechaza el cambio.", 400);
	let i = wt(e, n);
	Jt(t, i);
	let a = Ae(e, n);
	if (a.length === 0) throw new B("La partida no tiene cambios pendientes.", 409);
	e.transaction(() => {
		jt(e, n), r === "aprobado" ? (Rt(e, t, i, Kt(i, a)), U(e, n, t.user_id, "cambio_aprobado", a)) : U(e, n, t.user_id, "cambio_rechazado", a), Me(e, n, r, t.user_id), e.prepare("UPDATE sacramentos SET updated_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), n);
	})();
}
function Xt(e, t, n, r) {
	let i = Ae(e, n);
	if (i.length !== 0) {
		if (qt(r, i)) {
			Me(e, n, "aprobado", t.user_id), U(e, n, t.user_id, "cambio_aprobado", i);
			return;
		}
		Me(e, n, "descartado", t.user_id, Ht), U(e, n, t.user_id, "cambio_descartado", i, Ht);
	}
}
function Zt(e, t) {
	if (t.role !== "admin_parroquia" || !t.parish_id) throw new B(Bt, 403);
	return e.prepare("SELECT r.sacramento_id, MIN(r.id) AS primera, u.nombre, u.apellido_paterno, u.apellido_materno\n			 FROM solicitudes_cambio r\n			 JOIN sacramentos s ON s.id = r.sacramento_id\n			 LEFT JOIN usuarios u ON u.id = r.usuario_id\n			 WHERE r.estado = 'pendiente' AND s.parroquia_id = ?\n			 GROUP BY r.sacramento_id\n			 ORDER BY primera").all(t.parish_id).map((t) => ({
		partida: wt(e, t.sacramento_id),
		solicitado_por: we(t.nombre, t.apellido_paterno, t.apellido_materno)
	}));
}
var Qt = {
	"requests.pending": (e, { db: t, session: n }) => ({ pendientes: Zt(t, n) }),
	"requests.review": (e, { db: t, session: n }) => (Yt(t, n, H(e.sacramento_id), e.decision), { success: !0 })
}, $t = [
	"admin_general",
	"admin_parroquia",
	"usuario"
], en = /^[A-Za-z0-9._-]{3,50}$/;
function tn(e) {
	return $t.includes(e);
}
function nn(e) {
	return e.rol === "admin_general" && e.parroquia_id !== null ? "Un administrador general no pertenece a ninguna parroquia." : e.rol !== "admin_general" && e.parroquia_id === null ? "Debe seleccionar una parroquia." : null;
}
function rn(e, t, n) {
	return t.parroquia_id === e.parroquia_id ? t.rol === "usuario" || t.rol === "admin_parroquia" && e.principal ? null : t.rol === "admin_parroquia" ? `Solo el administrador principal de la parroquia puede ${n} a otros administradores.` : "El administrador de una parroquia no gestiona administradores generales." : `Solo puede ${n} cuentas de su propia parroquia.`;
}
function an(e, t) {
	return e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede crear administradores generales." : null : e.rol === "admin_parroquia" ? rn(e, t, "crear") : "No tiene permiso para gestionar usuarios.";
}
function on(e, t) {
	return t.id === e.id ? null : e.rol === "admin_general" ? t.rol === "admin_general" && !e.principal ? "Solo el administrador principal puede modificar a otros administradores generales." : null : e.rol === "admin_parroquia" ? rn(e, t, "modificar") : "No tiene permiso para gestionar usuarios.";
}
function sn(e) {
	return e.principal ? "No se puede deshabilitar al administrador principal: primero pase la marca de principal a otro administrador." : null;
}
function cn(e) {
	return e === "admin_general" || e === "admin_parroquia";
}
//#endregion
//#region electron/main/utils/crypto.ts
var ln = 32, un = 32, dn = 16, fn = {
	N: 2 ** 15,
	r: 8,
	p: 1,
	maxmem: 67108864
};
function pn() {
	return w(ln).toString("hex");
}
function mn(e, t, n, r) {
	return new Promise((i, a) => {
		T(e.normalize("NFKC"), t, r, n, (e, t) => {
			e ? a(e) : i(t);
		});
	});
}
async function hn(e) {
	let t = w(dn), n = await mn(e, t, fn, un);
	return `scrypt:${fn.N}:${fn.r}:${fn.p}:${t.toString("base64")}:${n.toString("base64")}`;
}
var gn = 1e5, _n = 256;
function vn(e, t, n) {
	return new Promise((r, i) => {
		C(e, t, n, _n / 8, "sha256", (e, t) => {
			e ? i(e) : r(t);
		});
	});
}
async function yn(e) {
	let t = w(dn), n = await vn(e, t, gn);
	return `${gn}:${t.toString("base64")}:${n.toString("base64")}`;
}
async function bn(e, t) {
	let [n, r, i] = t.split(":");
	if (!/^\d+$/.test(n ?? "") || !r || !i) return !1;
	let a = Buffer.from(i, "base64"), o = await vn(e, Buffer.from(r, "base64"), Number(n));
	return o.length === a.length && E(o, a);
}
async function xn(e, t) {
	if (!t.startsWith("scrypt:")) return bn(e, t);
	let [, n, r, i, a, o] = t.split(":");
	if (!a || !o) return !1;
	let s = Buffer.from(o, "base64"), c = {
		N: Number(n),
		r: Number(r),
		p: Number(i),
		maxmem: fn.maxmem
	}, l = await mn(e, Buffer.from(a, "base64"), c, s.length);
	return E(l, s);
}
var Sn = 12;
async function Cn(e, t) {
	let n = w(dn), r = w(Sn), i = await mn(e, n, fn, ln), a = x("aes-256-gcm", i, r), o = Buffer.concat([a.update(t), a.final()]);
	return {
		sal: n.toString("base64"),
		iv: r.toString("base64"),
		etiqueta: a.getAuthTag().toString("base64"),
		datos: o.toString("base64")
	};
}
async function wn(e, t) {
	let n = await mn(e, Buffer.from(t.sal, "base64"), fn, ln);
	try {
		let e = S("aes-256-gcm", n, Buffer.from(t.iv, "base64"));
		return e.setAuthTag(Buffer.from(t.etiqueta, "base64")), Buffer.concat([e.update(Buffer.from(t.datos, "base64")), e.final()]);
	} catch {
		return null;
	}
}
//#endregion
//#region electron/main/db/migrations.ts
var Tn = [
	"\n  CREATE TABLE parroquias (\n    id        INTEGER PRIMARY KEY,\n    nombre    TEXT    NOT NULL,\n    ubicacion TEXT,\n    activa    INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE usuarios (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER REFERENCES parroquias(id),\n    username         TEXT    NOT NULL UNIQUE,\n    rol              TEXT    NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE ministros (\n    id               INTEGER PRIMARY KEY,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1\n  );\n\n  CREATE TABLE personas (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    dni              TEXT    CHECK (dni IS NULL OR dni <> ''),\n    nombres          TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL DEFAULT '',\n    fecha_nacimiento TEXT,\n    edad             INTEGER CHECK (edad IS NULL OR edad >= 0),\n    lugar_nacimiento TEXT,\n    padre            TEXT,\n    madre            TEXT,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;\n  CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);\n\n  CREATE TABLE sacramentos (\n    id                     INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id              TEXT    NOT NULL UNIQUE,\n    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),\n    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),\n    ministro_id            INTEGER REFERENCES ministros(id),\n    libro                  TEXT    NOT NULL,\n    folio                  TEXT    NOT NULL,\n    numero                 TEXT    NOT NULL,\n    fecha_emision          TEXT    NOT NULL,\n    fecha_evento           TEXT,\n    anotaciones            TEXT,\n    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),\n    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    anulado_en             TEXT,\n    motivo_anulacion       TEXT,\n    version                INTEGER NOT NULL DEFAULT 1,\n    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    -- Permite que cada subtipo enlace (id, tipo): un bautismo no puede colgar de un matrimonio.\n    UNIQUE (id, tipo),\n    CHECK (\n      estado = 'vigente'\n      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL\n          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')\n    )\n  );\n  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);\n\n  CREATE TABLE matrimonios (\n    sacramento_id                INTEGER PRIMARY KEY,\n    tipo                         TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),\n    conyuge_1_id                 INTEGER NOT NULL REFERENCES personas(id),\n    conyuge_2_id                 INTEGER NOT NULL REFERENCES personas(id),\n    lugar                        TEXT,\n    testigo_1                    TEXT,\n    testigo_2                    TEXT,\n    testigo_3                    TEXT,\n    testigo_4                    TEXT,\n    conyuge_1_bautismo_parroquia TEXT,\n    conyuge_1_bautismo_fecha     TEXT,\n    conyuge_2_bautismo_parroquia TEXT,\n    conyuge_2_bautismo_fecha     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),\n    CHECK (conyuge_1_id <> conyuge_2_id)\n  );\n  CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);\n  CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);\n\n  CREATE TABLE bautismos (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);\n\n  CREATE TABLE confirmaciones (\n    sacramento_id INTEGER PRIMARY KEY,\n    tipo          TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),\n    persona_id    INTEGER NOT NULL REFERENCES personas(id),\n    padrino_1     TEXT,\n    padrino_2     TEXT,\n    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)\n  );\n  CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);\n\n  CREATE TABLE cambios_persona (\n    id             INTEGER PRIMARY KEY AUTOINCREMENT,\n    -- Evita duplicar la corrección si se reenvía tras un corte de internet.\n    client_id      TEXT    NOT NULL UNIQUE,\n    persona_id     INTEGER NOT NULL REFERENCES personas(id),\n    sacramento_id  INTEGER REFERENCES sacramentos(id),\n    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),\n    campo_cambio   TEXT    NOT NULL,\n    valor_anterior TEXT,\n    valor_nuevo    TEXT,\n    fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);\n\n  -- Cada UPDATE sube version, salvo que la sincronización ya la haya fijado.\n  CREATE TRIGGER trg_personas_touch\n  AFTER UPDATE ON personas\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE personas\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  CREATE TRIGGER trg_sacramentos_touch\n  AFTER UPDATE ON sacramentos\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE sacramentos\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  CREATE TABLE ministros_nueva (\n    id               INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id        TEXT    NOT NULL UNIQUE,\n    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),\n    titulo           TEXT,\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1,\n    version          INTEGER NOT NULL DEFAULT 1,\n    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO ministros_nueva (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo)\n  SELECT id, 'servidor-' || id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo\n  FROM ministros;\n\n  DROP TABLE ministros;\n  ALTER TABLE ministros_nueva RENAME TO ministros;\n\n  CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);\n\n  CREATE TRIGGER trg_ministros_touch\n  AFTER UPDATE ON ministros\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE ministros\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n  ",
	"\n  -- Registros con cambios sin subir. Se envía su estado final, así que basta una fila por registro.\n  -- version_base: última versión que conoce el servidor; NULL si el registro aún no existe allí.\n  CREATE TABLE sync_cola (\n    id           INTEGER PRIMARY KEY AUTOINCREMENT,\n    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro')),\n    client_id    TEXT    NOT NULL,\n    version_base INTEGER,\n    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    UNIQUE (entidad, client_id)\n  );\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT tipo, client_id FROM sacramentos ORDER BY id;\n\n  INSERT INTO sync_cola (entidad, client_id)\n  SELECT 'ministro', client_id FROM ministros ORDER BY id;\n  ",
	"\n  -- cola_id: identifica la fila mientras siga pendiente, para reconocer un reenvío tras un corte.\n  -- revision: sube con cada edición; si cambió durante el envío, la fila no se quita al confirmarse.\n  ALTER TABLE sync_cola ADD COLUMN cola_id TEXT NOT NULL DEFAULT '';\n  ALTER TABLE sync_cola ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;\n  ALTER TABLE sync_cola ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'\n    CHECK (estado IN ('pendiente', 'conflicto', 'rechazado'));\n  ALTER TABLE sync_cola ADD COLUMN motivo TEXT;\n  UPDATE sync_cola SET cola_id = lower(hex(randomblob(16)));\n\n  CREATE TABLE sync_estado (\n    clave TEXT PRIMARY KEY,\n    valor TEXT\n  );\n\n  -- Verificación para entrar sin internet. Solo existe para quien ya entró con conexión en esta PC.\n  CREATE TABLE credenciales_locales (\n    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),\n    verificador    TEXT NOT NULL,\n    actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n  ",
	"\n  -- La edad pasa a ser una fecha aproximada en texto libre: los libros traen cosas como\n  -- \"22 AG 1978\" o \"(27 AÑOS AL DIA DE BODA)\". Las edades que ya había se conservan como \"N años\".\n  ALTER TABLE personas ADD COLUMN fecha_aproximada TEXT;\n  UPDATE personas SET fecha_aproximada = edad || ' años' WHERE edad IS NOT NULL;\n  ALTER TABLE personas DROP COLUMN edad;\n  ",
	"\n  -- Tres roles (ver worker/src/db/migrations/0015_roles_y_correcciones.sql):\n  --   admin_general, admin_parroquia (el párroco) y usuario (un ayudante).\n  -- Un admin sin parroquia pasa a admin_general; las demás cuentas, a admin_parroquia.\n  --\n  -- Los usuarios ahora se pueden crear y editar en esta PC sin internet y subirse después:\n  --   client_id      los identifica ante el servidor (el mismo 'servidor-<id>' que puso su migración).\n  --   id negativo    una cuenta creada aquí que el servidor todavía no conoce; al subirla se cambia por el suyo.\n  --   password_hash_pendiente   la contraseña cambiada aquí que falta subir (PBKDF2, el formato del\n  --                             servidor). Se borra en cuanto el servidor la recibe.\n  CREATE TABLE usuarios_nueva (\n    id               INTEGER PRIMARY KEY,\n    client_id        TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),\n    parroquia_id     INTEGER REFERENCES parroquias(id),\n    username         TEXT    NOT NULL UNIQUE,\n    rol              TEXT    NOT NULL CHECK (rol IN ('admin_general', 'admin_parroquia', 'usuario')),\n    nombre           TEXT    NOT NULL,\n    apellido_paterno TEXT    NOT NULL,\n    apellido_materno TEXT    NOT NULL,\n    activo           INTEGER NOT NULL DEFAULT 1,\n    principal        INTEGER NOT NULL DEFAULT 0,\n    password_hash_pendiente TEXT,\n    version          INTEGER NOT NULL DEFAULT 1,\n    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  INSERT INTO usuarios_nueva (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)\n  SELECT id, 'servidor-' || id, parroquia_id, username,\n         CASE WHEN rol = 'admin' AND parroquia_id IS NULL THEN 'admin_general' ELSE 'admin_parroquia' END,\n         nombre, apellido_paterno, apellido_materno, activo\n  FROM usuarios;\n\n  DROP TABLE usuarios;\n  ALTER TABLE usuarios_nueva RENAME TO usuarios;\n\n  CREATE TRIGGER trg_usuarios_touch\n  AFTER UPDATE ON usuarios\n  FOR EACH ROW\n  WHEN NEW.version = OLD.version\n  BEGIN\n    UPDATE usuarios\n       SET version = OLD.version + 1,\n           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')\n     WHERE id = NEW.id;\n  END;\n\n  -- Una corrección pedida por un usuario queda 'pendiente' hasta que el admin_parroquia la revise.\n  ALTER TABLE cambios_persona ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'\n    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));\n  ALTER TABLE cambios_persona ADD COLUMN revisado_por_usuario_id INTEGER REFERENCES usuarios(id);\n  ALTER TABLE cambios_persona ADD COLUMN revisado_en TEXT;\n\n  -- La cola también lleva usuarios.\n  CREATE TABLE sync_cola_nueva (\n    id           INTEGER PRIMARY KEY AUTOINCREMENT,\n    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro', 'usuario')),\n    client_id    TEXT    NOT NULL,\n    version_base INTEGER,\n    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),\n    cola_id      TEXT    NOT NULL DEFAULT '',\n    revision     INTEGER NOT NULL DEFAULT 1,\n    estado       TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'conflicto', 'rechazado')),\n    motivo       TEXT,\n    UNIQUE (entidad, client_id)\n  );\n\n  INSERT INTO sync_cola_nueva (id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo)\n  SELECT id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo FROM sync_cola;\n\n  DROP TABLE sync_cola;\n  ALTER TABLE sync_cola_nueva RENAME TO sync_cola;\n  ",
	"\n  ALTER TABLE sacramentos ADD COLUMN anotaciones_propuestas TEXT;\n  ",
	"\n  CREATE TABLE solicitudes_cambio (\n    id                      INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id               TEXT    NOT NULL UNIQUE,\n    sacramento_id           INTEGER NOT NULL REFERENCES sacramentos(id),\n    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),\n    parte                   TEXT    NOT NULL CHECK (parte IN ('sacramento', 'persona', 'conyuge_1', 'conyuge_2', 'detalle')),\n    campo                   TEXT    NOT NULL,\n    tipo                    TEXT    NOT NULL CHECK (tipo IN ('digitacion', 'nota_marginal')),\n    valor_anterior          TEXT,\n    valor_nuevo             TEXT,\n    estado                  TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'descartado')),\n    motivo                  TEXT,\n    revisado_por_usuario_id INTEGER REFERENCES usuarios(id),\n    revisado_en             TEXT,\n    creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  CREATE INDEX idx_solicitudes_sacramento ON solicitudes_cambio (sacramento_id);\n\n  CREATE TABLE historial_partidas (\n    id            INTEGER PRIMARY KEY AUTOINCREMENT,\n    client_id     TEXT    NOT NULL UNIQUE,\n    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),\n    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),\n    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',\n                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada')),\n    motivo        TEXT,\n    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\n  );\n\n  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);\n\n  CREATE TABLE historial_campos (\n    id             INTEGER PRIMARY KEY AUTOINCREMENT,\n    historial_id   INTEGER NOT NULL REFERENCES historial_partidas(id),\n    parte          TEXT    NOT NULL,\n    campo          TEXT    NOT NULL,\n    valor_anterior TEXT,\n    valor_nuevo    TEXT\n  );\n\n  CREATE INDEX idx_historial_campos ON historial_campos (historial_id);\n\n  -- Las correcciones de nombres pendientes: la misma client_id que tenían.\n  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n  SELECT\n    c.client_id,\n    c.sacramento_id,\n    c.usuario_id,\n    CASE\n      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_1_id = c.persona_id) THEN 'conyuge_1'\n      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_2_id = c.persona_id) THEN 'conyuge_2'\n      ELSE 'persona'\n    END,\n    c.campo_cambio,\n    'nota_marginal',\n    c.valor_anterior,\n    c.valor_nuevo,\n    c.fecha_cambio\n  FROM cambios_persona c\n  WHERE c.estado = 'pendiente' AND c.sacramento_id IS NOT NULL;\n\n  -- La nota propuesta: la pidió quien pidió la corrección que iba con ella.\n  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)\n  SELECT\n    s.client_id || '-nota',\n    s.id,\n    c.usuario_id,\n    'sacramento',\n    'anotaciones',\n    'digitacion',\n    s.anotaciones,\n    s.anotaciones_propuestas,\n    c.fecha_cambio\n  FROM sacramentos s\n  JOIN cambios_persona c ON c.id = (SELECT MIN(id) FROM cambios_persona WHERE sacramento_id = s.id AND estado = 'pendiente')\n  WHERE s.anotaciones_propuestas IS NOT NULL;\n\n  DELETE FROM cambios_persona WHERE estado = 'pendiente';\n\n  ALTER TABLE sacramentos DROP COLUMN anotaciones_propuestas;\n  ",
	"\n  UPDATE usuarios SET principal = 1\n  WHERE id IN (\n    SELECT MIN(a.id) FROM usuarios a\n    WHERE a.rol = 'admin_parroquia' AND a.activo = 1 AND a.id > 0\n      AND NOT EXISTS (SELECT 1 FROM usuarios p WHERE p.principal = 1 AND p.parroquia_id = a.parroquia_id)\n    GROUP BY a.parroquia_id\n  );\n  "
], En = /^[0-9a-f]{64}$/i, Dn = class extends Error {};
function On(e, t) {
	let n = e.pragma("user_version", { simple: !0 });
	if (n > t.length) throw new Dn(`La base local está en la versión ${n} y esta app solo conoce hasta la ${t.length}.`);
	e.pragma("foreign_keys = OFF");
	for (let r = n; r < t.length; r++) e.transaction(() => {
		if (e.exec(t[r]), e.pragma("foreign_key_check").length > 0) throw Error("La migración dejó claves foráneas rotas.");
		e.pragma(`user_version = ${r + 1}`);
	})();
	e.pragma("foreign_keys = ON");
}
function kn(e, t, n = Tn) {
	if (!En.test(t)) throw Error("La clave de la base local debe tener 32 bytes en hexadecimal.");
	let r = new b(e);
	try {
		return r.pragma("cipher='chacha20'"), r.pragma(`hexkey='${t}'`), r.prepare("SELECT count(*) FROM sqlite_master").get(), r.pragma("foreign_keys = ON"), r.pragma("journal_mode = WAL"), r.pragma("synchronous = FULL"), On(r, n), r;
	} catch (e) {
		throw r.close(), e;
	}
}
function An(e) {
	let t = e?.code ?? "";
	return t.startsWith("SQLITE_NOTADB") || t.startsWith("SQLITE_CORRUPT");
}
function jn(e) {
	return {
		directory: e,
		database: s.join(e, be.database),
		key: s.join(e, be.key),
		device: s.join(e, be.device),
		temp_database: s.join(e, be.temp_database),
		temp_key: s.join(e, be.temp_key),
		set_aside_folder: s.join(e, be.set_aside_folder)
	};
}
function Mn(e) {
	if (u(e.device)) return f(e.device, "utf8").trim();
	let t = ee();
	return _(e.device, t), t;
}
function Nn(e, t) {
	for (let n of [
		"",
		"-wal",
		"-shm"
	]) u(e + n) && m(e + n, t + n);
}
function Pn(e) {
	for (let t of [
		"",
		"-wal",
		"-shm"
	]) h(e + t, { force: !0 });
}
function Fn(e) {
	u(e.set_aside_folder) && p(e.set_aside_folder).filter((e) => e.endsWith(".db")).sort().reverse().forEach((t, n) => {
		let r = s.join(e.set_aside_folder, t), i = Date.now() - g(r).mtimeMs > xe;
		(n > 0 || i) && Pn(r);
	});
}
function In(e) {
	if (!u(e.database)) return;
	d(e.set_aside_folder, { recursive: !0 });
	let t = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	Nn(e.database, s.join(e.set_aside_folder, `prelatura-local-${t}.db`)), Fn(e);
}
function Ln(e, t) {
	Fn(e);
	let n = t.read(e.key);
	if (!u(e.database)) {
		let r = n ?? pn(), i = kn(e.database, r);
		return n || t.write(e.key, r), {
			status: "open",
			db: i,
			key: r
		};
	}
	if (!n) return { status: "needs-recovery" };
	try {
		let t = kn(e.database, n);
		return Pn(e.temp_database), h(e.temp_key, { force: !0 }), {
			status: "open",
			db: t,
			key: n
		};
	} catch (e) {
		if (e instanceof Dn) return {
			status: "failed",
			message: "La base local es de una versión más nueva. Actualice la aplicación."
		};
		if (An(e)) return { status: "needs-recovery" };
		throw e;
	}
}
function Rn(e, t, n) {
	try {
		let r = kn(e.database, n);
		return t.write(e.key, n), r;
	} catch (e) {
		if (!An(e)) throw e;
		return null;
	}
}
function zn(e, t) {
	let n = t.read(e.temp_key);
	(!n || !u(e.temp_database)) && (Pn(e.temp_database), n = pn(), t.write(e.temp_key, n));
	try {
		return {
			db: kn(e.temp_database, n),
			key: n
		};
	} catch (t) {
		if (!An(t)) throw t;
		return Pn(e.temp_database), {
			db: kn(e.temp_database, n),
			key: n
		};
	}
}
function Bn(e, t, n) {
	Pn(e.temp_database);
	let r = pn();
	return t.write(e.temp_key, r), {
		db: kn(e.temp_database, r, n),
		key: r
	};
}
function Vn(e, t, n) {
	return In(e), Nn(e.temp_database, e.database), t.write(e.key, n), h(e.temp_key, { force: !0 }), kn(e.database, n);
}
//#endregion
//#region electron/main/db/app_database.ts
var Hn = null, Un = null, Wn = !1, Gn = "La base local no está disponible.";
function Kn() {
	if (!a.isEncryptionAvailable()) throw Error("El sistema operativo no ofrece almacenamiento seguro para la clave.");
}
function qn(e) {
	if (Kn(), !u(e)) return null;
	try {
		return a.decryptString(f(e));
	} catch {
		return null;
	}
}
function Jn(e, t) {
	Kn(), _(e, a.encryptString(t), { mode: 384 });
}
var Yn = {
	read: qn,
	write: Jn
};
function Xn() {
	return jn(n.getPath("userData"));
}
function Zn() {
	let e = Ln(Xn(), Yn);
	e.status === "open" ? (Hn = e.db, Un = e.key) : e.status === "needs-recovery" ? (Wn = !0, Gn = "La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.") : Gn = e.message;
}
function G() {
	if (!Hn) throw new B(Gn, 503);
	return Hn;
}
function Qn() {
	return Un;
}
function $n() {
	return Wn;
}
function er(e, t) {
	Hn = e, Un = t, Wn = !1;
}
function tr() {
	Hn?.close(), Hn = null, Un = null;
}
//#endregion
//#region electron/shared/index.ts
var nr = "local:request", rr = "sin-conexion", ir = null, ar = null;
function or() {
	if (!ir) throw new B("Sesión no válida.", 401);
	return ir;
}
function sr() {
	return ir;
}
function cr() {
	return ar;
}
function lr(e, t, n) {
	ir = e, ar = {
		username: t,
		password: n
	};
}
function ur() {
	ir = null, ar = null;
}
//#endregion
//#region electron/main/utils/logger.ts
function dr(...e) {
	console.log(...e);
}
function fr(...e) {
	console.error(...e);
}
var pr = "http://localhost:8787", mr = null;
function hr(e) {
	if (!u(e)) return null;
	try {
		let t = JSON.parse(f(e, "utf8"));
		if (typeof t.servidor == "string" && /^https?:\/\/\S+$/.test(t.servidor.trim())) return t.servidor.trim().replace(/\/+$/, "");
		fr(`${e}: "servidor" debe ser una dirección que empiece con http:// o https://.`);
	} catch (t) {
		fr(`No se pudo leer ${e}:`, t);
	}
	return null;
}
function gr() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador") : s.join(n.getAppPath(), "resources", "instalador");
}
function _r() {
	if (mr) return mr;
	let e = process.env.PRELATURA_API_URL ?? hr(s.join(n.getPath("userData"), "configuracion.json")) ?? hr(s.join(gr(), "configuracion.json")) ?? "https://registro-sacramental.registro-sacramental-prelatura.workers.dev" ?? pr;
	return dr(`Servidor: ${e}`), mr = e, e;
}
//#endregion
//#region electron/main/sync/online.ts
var vr = "No se pudo conectar con el servidor. Verifique su conexión.", yr = async (e, t = {}) => {
	let n = t.method ?? "GET", r = t.timeoutMs ?? 3e4, i = {};
	t.body !== void 0 && (i["Content-Type"] = "application/json"), t.token && (i.Authorization = `Bearer ${t.token}`);
	let a, o;
	try {
		a = await fetch(`${_r()}${e}`, {
			method: n,
			headers: i,
			body: t.body === void 0 ? void 0 : JSON.stringify(t.body),
			signal: AbortSignal.timeout(r)
		}), o = await a.json().catch(() => null);
	} catch {
		throw new B(vr, 0);
	}
	if (!a.ok) throw new B(o?.message ? String(o.message) : "Ocurrió un error inesperado.", a.status);
	if (o === null) throw new B(vr, 0);
	return o;
};
function br(e) {
	return e instanceof B && (e.status === 0 || e.status >= 500);
}
function xr(e, t, n) {
	return e("/api/auth/login", {
		method: "POST",
		body: {
			username: t,
			password: n
		},
		timeoutMs: _e
	});
}
function Sr(e, t) {
	return e("/api/reference", { token: t });
}
function Cr(e, t, n) {
	return e("/api/sync/push", {
		method: "POST",
		body: { cambios: n },
		token: t
	});
}
function wr(e, t, n) {
	return e(`/api/sync/pull?cursor=${encodeURIComponent(n)}`, { token: t });
}
function Tr(e, t, n, r) {
	return e(`/api/sync/record?${`entidad=${encodeURIComponent(n)}&client_id=${encodeURIComponent(r)}`}`, { token: t });
}
function Er(e, t, n) {
	return e(`/api/devices/${n}/key`, { token: t });
}
function Dr(e, t, n, r) {
	return e(`/api/devices/${n}/key`, {
		method: "PUT",
		body: { clave: r },
		token: t
	});
}
//#endregion
//#region electron/main/sync/records.ts
var Or = class extends Error {};
function kr(e, t, n) {
	e.prepare(`UPDATE ${t} SET version = -1 WHERE id = ?`).run(n);
}
function Ar(e) {
	return e === "ministro" ? "ministros" : e === "usuario" ? "usuarios" : "sacramentos";
}
function jr(e, t, n, r) {
	e.prepare(`UPDATE ${Ar(t)} SET version = ? WHERE client_id = ? AND version <> ?`).run(r, n, r);
}
function Mr(e, t) {
	return e.prepare("SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t);
}
function Nr(e, t) {
	return e.prepare("SELECT client_id, id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo,\n				password_hash_pendiente AS password_hash\n			 FROM usuarios WHERE client_id = ?").get(t);
}
function Pr(e, t) {
	let n = e.prepare("SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,\n				s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion\n			 FROM sacramentos s\n			 LEFT JOIN ministros m ON m.id = s.ministro_id\n			 WHERE s.client_id = ?").get(t), r = n.tipo, i = e.prepare(`SELECT * FROM ${ct(r)} WHERE sacramento_id = ?`).get(n.id), a = e.prepare(`SELECT client_id, ${L.join(", ")} FROM personas WHERE id = ?`), o = [];
	for (let e of lt(r)) o.push(a.get(i[e]));
	let s = {};
	for (let e of le(r)) s[e] = i[e];
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
		solicitudes: Pe(e, n.id),
		historial: ze(e, n.id)
	};
}
function Fr(e, t, n) {
	let r = L.map((e) => n[e]), i = e.prepare("SELECT id FROM personas WHERE client_id = ?").get(n.client_id);
	if (i) {
		let t = L.map((e) => `${e} = ?`).join(", ");
		return e.prepare(`UPDATE personas SET ${t} WHERE id = ?`).run(...r, i.id), i.id;
	}
	let a = L.map(() => "?").join(", "), o = e.prepare(`INSERT INTO personas (client_id, parroquia_id, ${L.join(", ")}) VALUES (?, ?, ${a})`).run(n.client_id, t, ...r);
	return Number(o.lastInsertRowid);
}
function Ir(e, t) {
	if (!t) return null;
	let n = e.prepare("SELECT id FROM ministros WHERE client_id = ?").get(t);
	if (!n) throw new Or(`Ministro desconocido: ${t}`);
	return n.id;
}
function Lr(e, t, n = !1) {
	let r = t.version ?? 1, i = e.prepare("SELECT id, version FROM sacramentos WHERE client_id = ?").get(t.client_id);
	if (!n && (nt(e, t.tipo, t.client_id) || i && i.version === r)) return;
	let a = Ir(e, t.ministro_client_id), o = t.personas.map((n) => Fr(e, t.parroquia_id, n)), s = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), c = [
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
	if (i) l = i.id, kr(e, "sacramentos", i.id), e.prepare("UPDATE sacramentos SET\n				ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,\n				estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(...c, i.id);
	else {
		let n = e.prepare("INSERT INTO sacramentos\n					(ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,\n					 estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,\n					 client_id, tipo, parroquia_id)\n				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...c, t.client_id, t.tipo, t.parroquia_id);
		l = Number(n.lastInsertRowid);
	}
	if (Rr(e, t, l, o), zr(e, t, l, o), Fe(e, l, t.solicitudes ?? []), Be(e, l, t.historial ?? []), n) {
		let n = JSON.stringify(t.cambios.map((e) => e.client_id));
		e.prepare("DELETE FROM cambios_persona WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))").run(l, n), Ie(e, l, t.solicitudes ?? []), Ve(e, l, t.historial ?? []), rt(e, t.tipo, t.client_id);
	}
}
function Rr(e, t, n, r) {
	let i = t.detalle;
	if (t.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n			 ON CONFLICT (sacramento_id) DO UPDATE SET\n				conyuge_1_id = excluded.conyuge_1_id,\n				conyuge_2_id = excluded.conyuge_2_id,\n				lugar = excluded.lugar,\n				testigo_1 = excluded.testigo_1,\n				testigo_2 = excluded.testigo_2,\n				testigo_3 = excluded.testigo_3,\n				testigo_4 = excluded.testigo_4,\n				conyuge_1_bautismo_parroquia = excluded.conyuge_1_bautismo_parroquia,\n				conyuge_1_bautismo_fecha = excluded.conyuge_1_bautismo_fecha,\n				conyuge_2_bautismo_parroquia = excluded.conyuge_2_bautismo_parroquia,\n				conyuge_2_bautismo_fecha = excluded.conyuge_2_bautismo_fecha").run(n, r[0], r[1], i.lugar ?? null, i.testigo_1 ?? null, i.testigo_2 ?? null, i.testigo_3 ?? null, i.testigo_4 ?? null, i.conyuge_1_bautismo_parroquia ?? null, i.conyuge_1_bautismo_fecha ?? null, i.conyuge_2_bautismo_parroquia ?? null, i.conyuge_2_bautismo_fecha ?? null);
		return;
	}
	e.prepare(`INSERT INTO ${ct(t.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT (sacramento_id) DO UPDATE SET
			persona_id = excluded.persona_id,
			padrino_1 = excluded.padrino_1,
			padrino_2 = excluded.padrino_2`).run(n, r[0], i.padrino_1 ?? null, i.padrino_2 ?? null);
}
function zr(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	t.personas.forEach((e, t) => i.set(e.client_id, r[t]));
	let a = e.prepare("INSERT INTO cambios_persona\n			(client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio,\n			 estado, revisado_por_usuario_id, revisado_en)\n		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n		 ON CONFLICT (client_id) DO UPDATE SET\n			estado = excluded.estado,\n			revisado_por_usuario_id = excluded.revisado_por_usuario_id,\n			revisado_en = excluded.revisado_en");
	for (let e of t.cambios) a.run(e.client_id, i.get(e.persona_client_id), n, e.usuario_id, e.campo_cambio, e.valor_anterior, e.valor_nuevo, e.fecha_cambio, e.estado ?? "aprobado", e.revisado_por_usuario_id ?? null, e.revisado_en ?? null);
}
function Br(e, t, n = !1) {
	t = {
		...t,
		client_id: t.client_id ?? `servidor-${t.id}`
	}, (n || !nt(e, "usuario", t.client_id)) && (e.prepare("UPDATE usuarios SET username = '~' || id WHERE username = ? AND id <> ?").run(t.username, t.id), e.prepare("UPDATE usuarios SET client_id = '~' || id WHERE client_id = ? AND id <> ?").run(t.client_id, t.id), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal, updated_at)\n		 VALUES (@id, @client_id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo, @principal, @updated_at)\n		 ON CONFLICT (id) DO UPDATE SET\n			client_id = @client_id, parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,\n			apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo,\n			principal = @principal, updated_at = @updated_at, password_hash_pendiente = NULL").run({
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
	}), kr(e, "usuarios", t.id), e.prepare("UPDATE usuarios SET version = ? WHERE id = ?").run(t.version ?? 1, t.id), t.password_hash && e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n			 ON CONFLICT (usuario_id) DO UPDATE SET\n				verificador = excluded.verificador,\n				actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t.id, t.password_hash), n && rt(e, "usuario", t.client_id));
}
function Vr(e, t, n) {
	let r = e.prepare("SELECT id FROM usuarios WHERE client_id = ?").get(t);
	if (!r || r.id === n) return null;
	let i = r.id;
	return e.pragma("defer_foreign_keys = ON"), e.prepare("UPDATE usuarios SET id = ? WHERE id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE cambios_persona SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE sacramentos SET anulado_por_usuario_id = ? WHERE anulado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE solicitudes_cambio SET revisado_por_usuario_id = ? WHERE revisado_por_usuario_id = ?").run(n, i), e.prepare("UPDATE historial_partidas SET usuario_id = ? WHERE usuario_id = ?").run(n, i), e.prepare("UPDATE credenciales_locales SET usuario_id = ? WHERE usuario_id = ?").run(n, i), i;
}
var Hr = [
	"titulo",
	"nombre",
	"apellido_paterno",
	"apellido_materno",
	"activo"
];
function Ur(e, t, n = !1) {
	let r = t.version ?? 1, i = t.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(), a = e.prepare("SELECT id, version, titulo, nombre, apellido_paterno, apellido_materno, activo FROM ministros WHERE client_id = ?").get(t.client_id);
	if (!n && nt(e, "ministro", t.client_id)) {
		let n = a !== void 0 && Hr.every((e) => (a[e] ?? null) === (t[e] ?? null)), i = e.prepare("SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?").get("ministro", t.client_id);
		if (!n || i.version_base !== null) return;
		rt(e, "ministro", t.client_id), jr(e, "ministro", t.client_id, r);
		return;
	}
	if (!a) {
		e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(t.client_id, t.parroquia_id, t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i);
		return;
	}
	(n || a.version !== r) && (kr(e, "ministros", a.id), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?\n			 WHERE id = ?").run(t.titulo ?? null, t.nombre, t.apellido_paterno, t.apellido_materno, t.activo, r, i, a.id)), n && rt(e, "ministro", t.client_id);
}
//#endregion
//#region electron/main/sync/sync.ts
function Wr(e, t) {
	let n = e.prepare("INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)\n		 ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa"), r = e.prepare("UPDATE ministros SET client_id = ? WHERE client_id = ?");
	e.transaction(() => {
		for (let e of t.parroquias) n.run(e);
		for (let n of t.ministros) r.run(n.client_id, `servidor-${n.id}`), Ur(e, n);
		for (let n of t.usuarios) Br(e, n);
		e.exec("DELETE FROM credenciales_locales WHERE usuario_id IN (SELECT id FROM usuarios WHERE activo <> 1)");
	})();
}
async function Gr(e, t, n) {
	Wr(e, await Sr(t, n));
}
function Kr(e, t) {
	return t.entidad === "ministro" ? Mr(e, t.client_id) : t.entidad === "usuario" ? Nr(e, t.client_id) : Pr(e, t.client_id);
}
function qr(e, t, n) {
	if (!n) return;
	let r = Vr(e, t, n), i = sr();
	r !== null && i && i.user_id === r && (i.user_id = n);
}
function Jr(e, t, n) {
	e.transaction(() => {
		if (n.estado === "conflicto" || n.estado === "rechazado") {
			e.prepare("UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?").run(n.estado, n.motivo, t.id);
			return;
		}
		t.entidad === "usuario" && qr(e, t.client_id, n.id), e.prepare("SELECT revision FROM sync_cola WHERE id = ?").get(t.id).revision === t.revision ? (rt(e, t.entidad, t.client_id), jr(e, t.entidad, t.client_id, n.version), t.entidad === "usuario" && e.prepare("UPDATE usuarios SET password_hash_pendiente = NULL WHERE client_id = ?").run(t.client_id)) : e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?").run(n.version, t.id);
	})();
}
async function Yr(e, t, n) {
	let r = e.prepare("SELECT id FROM sync_cola WHERE estado <> 'conflicto' AND (entidad = 'usuario') = ? ORDER BY entidad = 'ministro' DESC, id").pluck();
	await Xr(e, t, n, r.all(1)), await Xr(e, t, n, r.all(0));
}
async function Xr(e, t, n, r) {
	let i = e.prepare("SELECT * FROM sync_cola WHERE id = ?");
	for (let a = 0; a < r.length; a += 15) {
		let o = [];
		for (let e of r.slice(a, a + 15)) {
			let t = i.get(e);
			t && t.estado !== "conflicto" && o.push(t);
		}
		if (o.length === 0) continue;
		let s = await Cr(t, n, o.map((t) => ({
			entidad: t.entidad,
			client_id: t.client_id,
			version_base: t.version_base,
			cola_id: t.cola_id,
			datos: Kr(e, t)
		})));
		for (let t = 0; t < o.length; t++) s.resultados[t] && Jr(e, o[t], s.resultados[t]);
	}
}
function Zr(e, t) {
	e.transaction(() => {
		for (let n of t.partidas) Lr(e, n);
		at(e, z.cursor, String(t.cursor));
	})();
}
function Qr(e) {
	return e instanceof Or || e?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
async function $r(e, t, n) {
	for (;;) {
		let r = await wr(t, n, it(e, z.cursor) ?? "0");
		try {
			Zr(e, r);
		} catch (i) {
			if (!Qr(i)) throw i;
			await Gr(e, t, n), Zr(e, r);
		}
		if (!r.hayMas) return;
	}
}
async function ei(e, t, n) {
	await Gr(e, t, n), await Yr(e, t, n), await $r(e, t, n), at(e, z.last_sync, (/* @__PURE__ */ new Date()).toISOString());
}
async function ti(e, t, n, r, i, a) {
	let o = (await Tr(t, n, r, i)).registro;
	e.transaction(() => {
		a === "local" ? e.prepare("UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?").run(o.version, r, i) : r === "ministro" ? Ur(e, o, !0) : r === "usuario" ? Br(e, o, !0) : Lr(e, o, !0);
	})();
}
var ni = {
	bautismo: "Bautismo",
	confirmacion: "Confirmación",
	matrimonio: "Matrimonio"
};
function ri(e, t) {
	if (t.entidad === "ministro") {
		let n = e.prepare("SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?").get(t.client_id);
		return `Ministro ${n?.nombre ?? ""} ${n?.apellido_paterno ?? ""}`.trim();
	}
	if (t.entidad === "usuario") return `Usuario ${e.prepare("SELECT username FROM usuarios WHERE client_id = ?").get(t.client_id)?.username ?? ""}`.trim();
	let n = ni[t.entidad], r = e.prepare("SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?").get(t.client_id);
	return r ? `${n}: libro ${r.libro}, folio ${r.folio}, registro ${r.numero}` : n;
}
function ii(e) {
	let t = e.prepare("SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado").all(), n = (e) => {
		let n = t.find((t) => t.estado === e);
		return n ? n.total : 0;
	}, r = e.prepare("SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id").all().map((t) => ({
		entidad: t.entidad,
		client_id: t.client_id,
		estado: t.estado,
		motivo: t.motivo,
		descripcion: ri(e, t)
	}));
	return {
		pendientes: n("pendiente"),
		conflictos: n("conflicto"),
		rechazados: n("rechazado"),
		ultima_sync: it(e, z.last_sync),
		aviso: it(e, z.notice),
		items: r
	};
}
//#endregion
//#region electron/main/sync/recovery.ts
var ai = "La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.";
async function oi(e, t, n) {
	try {
		return (await Er(t, n, Mn(e))).clave;
	} catch (e) {
		if (e instanceof B && e.status === 404) return null;
		throw e;
	}
}
async function si(e, t, n, r) {
	let i = zn(e, t);
	try {
		await Gr(i.db, n, r), await $r(i.db, n, r), at(i.db, z.last_sync, (/* @__PURE__ */ new Date()).toISOString()), at(i.db, z.notice, ai), at(i.db, z.key_registered, null);
	} finally {
		i.db.close();
	}
	return {
		db: Vn(e, t, i.key),
		key: i.key
	};
}
async function ci(e, t, n, r) {
	if (u(e.database)) {
		let i = await oi(e, n, r);
		if (i) {
			let n = Rn(e, t, i);
			if (n) return {
				db: n,
				key: i
			};
		}
	}
	return si(e, t, n, r);
}
async function li(e, t, n, r, i, a) {
	let o = it(e, z.key_registered);
	if (o && (o !== "admin" || a === null)) return;
	let s = await Dr(r, i, Mn(t), n);
	at(e, z.key_registered, s.parroquiaId === null ? "admin" : "parroquia");
}
//#endregion
//#region electron/main/sync/auto_sync.ts
var K = "sin-conexion", ui = null, di = null, fi = null;
function pi(e) {
	fi ||= setInterval(() => void q(), ve), K = e;
}
function mi() {
	fi && clearInterval(fi), fi = null;
}
function hi() {
	K = "sin-conexion", ui = null;
}
var gi = "Esta cuenta todavía no está en el servidor. Se subirá la próxima vez que el administrador de la parroquia sincronice con internet; hasta entonces puede trabajar sin conexión.";
function _i(e) {
	if (e < 0) return !0;
	try {
		return !!G().prepare("SELECT password_hash_pendiente FROM usuarios WHERE id = ?").get(e)?.password_hash_pendiente;
	} catch {
		return !1;
	}
}
async function vi() {
	let e = sr(), t = cr();
	if (!e || !t) return null;
	try {
		let n = await xr(yr, t.username, t.password);
		return e.token = n.token, e.role = n.usuario.rol, e.parish_id = n.usuario.parroquia_id, n.token;
	} catch (t) {
		return e.token = "", br(t) ? (K = "sin-conexion", null) : _i(e.user_id) ? (K = "error", ui = gi, null) : (K = "requiere-login", ui = "La contraseña cambió o la cuenta se desactivó. Inicie sesión de nuevo para sincronizar.", null);
	}
}
async function yi(e) {
	let t = sr()?.token || await vi();
	if (t) try {
		await e(t);
	} catch (t) {
		if (!(t instanceof B && t.status === 401)) throw t;
		let n = await vi();
		n && await e(n);
	}
}
async function bi() {
	ui = null;
	try {
		let e = !1;
		await yi(async (t) => {
			let n = G();
			await ei(n, yr, t), e = !0;
			let r = Qn();
			r && await li(n, Xn(), r, yr, t, sr()?.parish_id ?? null).catch((e) => {
				fr("No se pudo subir la copia de la clave:", e);
			});
		}), e && (K = "en-linea");
	} catch (e) {
		if (br(e)) {
			K = "sin-conexion";
			return;
		}
		fr("Falló la sincronización:", e), K = "error", ui = e instanceof B ? e.message : "Ocurrió un error al sincronizar.";
	}
}
function q() {
	return sr() ? (di ||= bi().finally(() => {
		di = null;
	}), di) : Promise.resolve();
}
function xi() {
	return di ?? Promise.resolve();
}
function Si() {
	return or(), {
		...ii(G()),
		modo: K,
		en_curso: di !== null,
		mensaje: ui,
		token: sr()?.token || "sin-conexion"
	};
}
async function Ci(e, t, n) {
	or();
	let r = !1;
	if (await yi(async (i) => {
		await ti(G(), yr, i, e, t, n), r = !0;
	}), !r) throw new B("Se necesita conexión para resolver el conflicto.", 0);
	await q();
}
function wi() {
	or(), at(G(), z.notice, null);
}
async function Ti(e) {
	if (!sr() || ii(G()).pendientes === 0) return;
	let t = new Promise((t) => setTimeout(t, e));
	await Promise.race([q(), t]);
}
//#endregion
//#region electron/main/controllers/login.ts
async function Ei(e, t, n) {
	let r = await hn(n);
	e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, r);
}
async function Di(e, t, n) {
	let r = e.prepare("SELECT u.id, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo,\n				c.verificador, p.nombre AS parroquia_nombre\n			 FROM usuarios u\n			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id\n			 LEFT JOIN parroquias p ON p.id = u.parroquia_id\n			 WHERE u.username = ?").get(t);
	return !r || !r.verificador ? {
		ok: !1,
		reason: "sin-credencial"
	} : r.activo !== 1 || !await xn(n, r.verificador) ? {
		ok: !1,
		reason: "incorrecta"
	} : {
		ok: !0,
		usuario: {
			id: r.id,
			rol: r.rol,
			parroquia_id: r.parroquia_id,
			parroquia_nombre: r.parroquia_nombre,
			nombre_completo: we(r.nombre, r.apellido_paterno, r.apellido_materno)
		}
	};
}
async function Oi(e, t, n) {
	let r = e.token, i = e.usuario;
	if ($n()) {
		let e = await ci(Xn(), Yn, yr, r);
		er(e.db, e.key);
	}
	let a = G();
	try {
		await Gr(a, yr, r);
	} catch (e) {
		if (!a.prepare("SELECT 1 FROM usuarios WHERE id = ?").get(i.id)) throw e;
	}
	return await Ei(a, i.id, n), lr({
		user_id: i.id,
		role: i.rol,
		parish_id: i.parroquia_id,
		token: r
	}, t, n), pi("en-linea"), await q(), e;
}
function ki(e, t, n) {
	return lr({
		user_id: e.id,
		role: e.rol,
		parish_id: e.parroquia_id,
		token: ""
	}, t, n), pi("sin-conexion"), q(), {
		token: rr,
		usuario: e
	};
}
var Ai = "Este usuario todavía no está en esta PC. Conéctese a internet para entrar por primera vez, o restaure un respaldo.";
async function ji(e) {
	let t = typeof e?.username == "string" ? e.username.trim() : "", n = typeof e?.password == "string" ? e.password : "", r = {
		ok: !1,
		reason: "sin-credencial"
	};
	if (!$n() && (r = await Di(G(), t, n), r.ok)) return ki(r.usuario, t, n);
	let i;
	try {
		i = await xr(yr, t, n);
	} catch (e) {
		throw br(e) ? $n() ? new B("La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.", 503) : r.reason === "sin-credencial" ? new B(Ai, 401) : new B("Usuario o contraseña incorrectos.", 401) : e;
	}
	return Oi(i, t, n);
}
function Mi() {
	mi(), ur(), hi();
}
var Ni = {
	"auth.login": ji,
	"auth.logout": () => (Mi(), { success: !0 })
}, Pi = "prelatura-paquete-inicial", Fi = "paquete-inicial.json";
function Ii(e) {
	return e.prepare("SELECT COUNT(*) FROM usuarios").pluck().get() === 0;
}
function Li(e, t) {
	if (t.role !== "admin_general") throw new B("Solo el administrador general puede generar el paquete inicial.", 403);
	if (e.prepare("SELECT COUNT(*) FROM sync_cola").pluck().get() > 0) throw new B("Hay cambios sin subir. Sincronice con internet antes de generar el paquete inicial.", 409);
	let n = e.prepare("SELECT u.id, u.client_id, u.parroquia_id, u.username, u.rol, u.nombre, u.apellido_paterno, u.apellido_materno,\n				u.activo, u.principal, u.version, u.updated_at, c.verificador AS password_hash\n			 FROM usuarios u\n			 LEFT JOIN credenciales_locales c ON c.usuario_id = u.id\n			 WHERE u.id > 0\n			 ORDER BY u.id").all(), r = e.prepare("SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at FROM ministros ORDER BY id").all(), i = e.prepare("SELECT client_id, version, created_at, updated_at FROM sacramentos ORDER BY id").all();
	return {
		formato: Pi,
		version: 1,
		generado_en: (/* @__PURE__ */ new Date()).toISOString(),
		cursor: it(e, z.cursor),
		parroquias: e.prepare("SELECT id, nombre, ubicacion, activa FROM parroquias ORDER BY id").all(),
		usuarios: n,
		ministros: r,
		partidas: i.map((t) => ({
			...Pr(e, t.client_id),
			version: t.version,
			created_at: t.created_at,
			updated_at: t.updated_at
		}))
	};
}
function Ri(e) {
	let t = e;
	if (!t || t.formato !== "prelatura-paquete-inicial") throw new B("El archivo no es un paquete inicial de esta aplicación.", 400);
	if (t.version !== 1) throw new B("El paquete inicial es de otra versión de la aplicación.", 400);
	if (!Array.isArray(t.parroquias) || !Array.isArray(t.usuarios) || !Array.isArray(t.ministros) || !Array.isArray(t.partidas)) throw new B("El paquete inicial está incompleto.", 400);
	return t;
}
function zi(e, t) {
	let n = Ri(t);
	if (!Ii(e)) throw new B("Esta PC ya tiene usuarios: el paquete inicial solo se carga en una PC nueva.", 409);
	return e.transaction(() => {
		Wr(e, {
			parroquias: n.parroquias,
			ministros: n.ministros,
			usuarios: n.usuarios
		});
		for (let t of n.partidas) Lr(e, t);
		n.cursor && at(e, z.cursor, n.cursor);
	})(), {
		parroquias: n.parroquias.length,
		usuarios: n.usuarios.length,
		partidas: n.partidas.length
	};
}
function Bi(e) {
	try {
		return JSON.parse(f(e, "utf8"));
	} catch {
		throw new B("No se pudo leer el paquete inicial.", 400);
	}
}
function Vi() {
	return n.isPackaged ? s.join(process.resourcesPath, "instalador", Fi) : s.join(n.getAppPath(), "resources", "instalador", Fi);
}
function Hi() {
	if (process.env.PRELATURA_SIN_PAQUETE === "1") return;
	let e = process.env.PRELATURA_PAQUETE || Vi(), t;
	try {
		t = G();
	} catch {
		return;
	}
	if (u(e) && Ii(t)) try {
		let n = zi(t, Bi(e));
		dr(`Paquete inicial cargado: ${n.parroquias} parroquias, ${n.usuarios} usuarios y ${n.partidas} partidas.`);
	} catch (e) {
		fr("No se pudo cargar el paquete inicial del instalador:", e);
	}
}
function Ui() {
	return t.getFocusedWindow() ?? void 0;
}
var Wi = { "package.status": () => {
	try {
		return { necesita_paquete: Ii(G()) };
	} catch {
		return { necesita_paquete: !1 };
	}
} }, Gi = { "package.export": async (e, { db: t, session: n }) => {
	let i = Li(t, n), a = {
		title: "Guardar el paquete inicial",
		defaultPath: Fi,
		filters: [{
			name: "Paquete inicial",
			extensions: ["json"]
		}]
	}, o = Ui(), s = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
	return s.canceled || !s.filePath ? { cancelado: !0 } : (_(s.filePath, JSON.stringify(i), "utf8"), {
		cancelado: !1,
		parroquias: i.parroquias.length,
		usuarios: i.usuarios.length,
		partidas: i.partidas.length
	});
} }, Ki = "prelatura-respaldo", qi = "respaldo", Ji = /^parroquia-\d+\.txt$/, Yi = "La contraseña no es la del respaldo, o el archivo está dañado.", Xi = "El archivo no es un respaldo de esta aplicación.";
function Zi(e) {
	return e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all();
}
function Qi(e) {
	return s.join(e, be.logos_folder);
}
function $i(e, t) {
	let n = {};
	for (let t of Zi(e)) {
		let r = e.prepare(`SELECT * FROM "${t}"`).raw();
		n[t] = {
			columnas: r.columns().map((e) => e.name),
			filas: r.all()
		};
	}
	let r = {}, i = Qi(t);
	if (u(i)) for (let e of p(i).filter((e) => Ji.test(e))) r[e] = f(s.join(i, e), "utf8");
	return {
		version_base: e.pragma("user_version", { simple: !0 }),
		tablas: n,
		logos: r
	};
}
async function ea(e, t) {
	let n = await Cn(t, y(JSON.stringify(e)));
	return JSON.stringify({
		formato: Ki,
		version: 1,
		creado_en: (/* @__PURE__ */ new Date()).toISOString(),
		...n
	});
}
async function ta(e, t) {
	let n;
	try {
		n = JSON.parse(e);
	} catch {
		throw new B(Xi, 400);
	}
	if (n?.formato !== "prelatura-respaldo" || !n.sal || !n.iv || !n.etiqueta || !n.datos) throw new B(Xi, 400);
	if (n.version !== 1) throw new B("El respaldo es de otra versión de la aplicación.", 400);
	let r = await wn(t, n);
	if (!r) throw new B(Yi, 400);
	let i = JSON.parse(v(r).toString("utf8"));
	if (!Number.isInteger(i?.version_base) || i.version_base < 1 || typeof i.tablas != "object" || typeof i.logos != "object") throw new B(Xi, 400);
	return i;
}
function na(e, t) {
	let n = Zi(e);
	for (let e of Object.keys(t.tablas)) if (!n.includes(e)) throw new B(Xi, 400);
	let r = e.transaction(() => {
		for (let t of n) e.prepare(`DELETE FROM "${t}"`).run();
		for (let [n, r] of Object.entries(t.tablas)) {
			let t = e.pragma(`table_info("${n}")`).map((e) => e.name);
			if (!r.columnas.every((e) => t.includes(e))) throw new B(Xi, 400);
			let i = r.columnas.map((e) => `"${e}"`).join(", "), a = r.columnas.map(() => "?").join(", "), o = e.prepare(`INSERT INTO "${n}" (${i}) VALUES (${a})`);
			for (let e of r.filas) o.run(e);
		}
		if (e.prepare("DELETE FROM sync_estado WHERE clave = ?").run(z.key_registered), e.pragma("foreign_key_check").length > 0) throw new B("El respaldo está incompleto: hay datos que apuntan a registros que no están.", 400);
	});
	e.pragma("foreign_keys = OFF");
	try {
		r();
	} finally {
		e.pragma("foreign_keys = ON");
	}
}
function ra(e, t, n) {
	if (n.version_base > Tn.length) throw new B("El respaldo es de una versión más nueva de la aplicación. Actualícela antes de restaurarlo.", 400);
	let r = Bn(e, t, Tn.slice(0, n.version_base));
	try {
		na(r.db, n);
	} finally {
		r.db.close();
	}
	return kn(e.temp_database, r.key).close(), r.key;
}
function ia(e, t) {
	let n = Qi(e);
	d(n, { recursive: !0 });
	for (let e of p(n).filter((e) => Ji.test(e))) h(s.join(n, e), { force: !0 });
	for (let [e, r] of Object.entries(t)) Ji.test(e) && typeof r == "string" && _(s.join(n, e), r, "utf8");
}
async function aa(e) {
	let t = Xn(), n = ra(t, Yn, e);
	Mi(), await xi(), tr(), er(Vn(t, Yn, n), n), ia(t.directory, e.logos);
}
function oa(e) {
	if (!cn(e.role)) throw new B("Solo un administrador puede hacer o restaurar respaldos.", 403);
}
function sa(e, t) {
	let n = typeof e == "string" ? e : "";
	if (t && n.length < 8) throw new B("La contraseña del respaldo debe tener al menos 8 caracteres.", 400);
	if (!n) throw new B("Escriba la contraseña del respaldo.", 400);
	return n;
}
function ca(e, t) {
	return e.tablas[t]?.filas.length ?? 0;
}
function la(e) {
	return {
		cancelado: !1,
		partidas: ca(e, "sacramentos"),
		pendientes: ca(e, "sync_cola")
	};
}
async function ua(e) {
	let t = sa(e, !1), n = {
		title: "Elegir el respaldo",
		properties: ["openFile"],
		filters: [{
			name: "Respaldo",
			extensions: [qi]
		}]
	}, i = Ui(), a = i ? await r.showOpenDialog(i, n) : await r.showOpenDialog(n);
	if (a.canceled || a.filePaths.length === 0) return { cancelado: !0 };
	let o;
	try {
		o = f(a.filePaths[0], "utf8");
	} catch {
		throw new B("No se pudo leer el respaldo.", 400);
	}
	let s = await ta(o, t);
	return await aa(s), la(s);
}
function da() {
	try {
		return Ii(G());
	} catch {
		return !1;
	}
}
var fa = {
	"backup.export": async (e, { db: t, session: n }) => {
		oa(n);
		let i = sa(e?.password, !0), a = {
			title: "Guardar el respaldo",
			defaultPath: `respaldo-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${qi}`,
			filters: [{
				name: "Respaldo",
				extensions: [qi]
			}]
		}, o = Ui(), s = o ? await r.showSaveDialog(o, a) : await r.showSaveDialog(a);
		if (s.canceled || !s.filePath) return { cancelado: !0 };
		let c = $i(t, Xn().directory);
		return _(s.filePath, await ea(c, i), "utf8"), la(c);
	},
	"backup.restore": (e, { session: t }) => (oa(t), ua(e?.password))
}, pa = { "backup.restoreEmpty": (e) => {
	if (!da()) throw new B("Esta PC ya tiene usuarios: entre como administrador y restaure el respaldo desde Configuración.", 409);
	return ua(e?.password);
} }, ma = 50, ha = 75, ga = .75, _a = [
	"dni",
	"nombres",
	"apellido_paterno",
	"apellido_materno",
	"fecha_nacimiento",
	"padre",
	"madre"
], va = {
	dni: 40,
	nombres: 25,
	apellido_paterno: 20,
	apellido_materno: 15,
	fecha_nacimiento: 20,
	padre: 10,
	madre: 10
}, ya = {
	dni: "DNI",
	nombres: "Nombres",
	apellido_paterno: "Apellido paterno",
	apellido_materno: "Apellido materno",
	fecha_nacimiento: "Fecha de nacimiento",
	padre: "Padre",
	madre: "Madre"
};
function J(e) {
	return (e ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function ba(e, t) {
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
function xa(e, t) {
	if (!e || !t) return 0;
	if (e === t) return 1;
	let n = e.split(" "), r = t.split(" "), i = n.length <= r.length ? n : r, a = n.length <= r.length ? r : n;
	if (i.every((e) => a.includes(e))) return .85;
	let o = Math.max(e.length, t.length);
	if (Math.abs(e.length - t.length) / o > .25) return 0;
	let s = 1 - ba(e, t) / o;
	return s >= ga ? s : 0;
}
function Sa(e, t) {
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
function Ca(e, t, n) {
	let r = !!(e.dni && t.dni), i = r && e.dni === J(t.dni), a = (r, i) => {
		let a = [J(i), ...n.get(`${t.persona_id}:${r}`) ?? []];
		return Math.max(...a.map((t) => xa(e[r], t)));
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
		fecha_nacimiento: Sa(e.fecha_nacimiento, J(t.fecha_nacimiento)),
		padre: {
			comparable: !!(e.padre && t.padre),
			value: xa(e.padre, J(t.padre))
		},
		madre: {
			comparable: !!(e.madre && t.madre),
			value: xa(e.madre, J(t.madre))
		}
	}, l = 0, u = 0, d = [];
	for (let e of _a) {
		let t = c[e];
		t.comparable && (u += va[e], l += va[e] * t.value, t.value >= ga && d.push(ya[e]));
	}
	let f = Math.round(l / u * 100), p = o >= ga && s >= ga, m = r && !i, h = !1;
	for (let e of [
		"fecha_nacimiento",
		"padre",
		"madre"
	]) c[e].comparable && c[e].value >= ga && (h = !0);
	return i && (o > 0 || s > 0) || p && h && !m ? {
		nivel: "alta",
		porcentaje: f,
		coincide: d
	} : i || f >= ha ? {
		nivel: "posible",
		porcentaje: f,
		coincide: d
	} : null;
}
function wa(e) {
	return {
		dni: J(e.dni),
		nombres: J(e.nombres),
		apellido_paterno: J(e.apellido_paterno),
		apellido_materno: J(e.apellido_materno),
		fecha_nacimiento: J(e.fecha_nacimiento),
		padre: J(e.padre),
		madre: J(e.madre)
	};
}
function Ta(e, t) {
	let n = Number(t.nivel === "alta") - Number(e.nivel === "alta");
	return n === 0 ? t.porcentaje - e.porcentaje : n;
}
function Ea(e, t, n, r) {
	if (!st(t)) throw new B("Tipo de sacramento inválido.", 400);
	let i = r.map((e) => ({
		para: e.para ?? "",
		values: wa(e)
	})).filter((e) => e.values.dni || e.values.nombres && e.values.apellido_paterno);
	if (i.length === 0) return {
		matches: [],
		total: 0
	};
	let a = Number.isInteger(n) ? n : 0, o = e.prepare(`SELECT s.id, sub.persona_id, s.libro, s.folio, s.numero, par.nombre AS parroquia_nombre,
				pe.dni, pe.nombres, pe.apellido_paterno, pe.apellido_materno, pe.fecha_nacimiento, pe.padre, pe.madre
			 FROM (${ut(t)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 JOIN parroquias par ON par.id = s.parroquia_id
			 WHERE s.estado = 'vigente' AND s.id <> ?`).all(a), s = /* @__PURE__ */ new Map(), c = e.prepare("SELECT persona_id, campo_cambio, valor_anterior FROM cambios_persona\n			 WHERE campo_cambio IN ('nombres', 'apellido_paterno', 'apellido_materno') AND valor_anterior IS NOT NULL\n			   AND estado = 'aprobado'").all();
	for (let e of c) {
		let t = `${e.persona_id}:${e.campo_cambio}`, n = s.get(t) ?? [];
		n.push(J(e.valor_anterior)), s.set(t, n);
	}
	let l = 0, u = [];
	for (let e of i) {
		let t = [];
		for (let n of o) {
			let r = Ca(e.values, n, s);
			r && t.push({
				sacramento_id: n.id,
				para: e.para,
				nivel: r.nivel,
				porcentaje: r.porcentaje,
				coincide: r.coincide,
				nombre_completo: we(n.nombres, n.apellido_paterno, n.apellido_materno),
				parroquia_nombre: n.parroquia_nombre,
				libro: n.libro,
				folio: n.folio,
				numero: n.numero
			});
		}
		l += t.length, t.sort(Ta), u.push(...t.slice(0, ma));
	}
	return u.sort(Ta), {
		matches: u,
		total: l
	};
}
var Da = { "sacraments.findDuplicates": (e, { db: t }) => Ea(t, e.tipo, e.excluir_sacramento_id, e.personas) }, Oa = /^[$_\u0080-\uFFFFa-zA-Z][$_\u0080-\uFFFF\w]*$/;
function ka(e) {
	let t = {}, n = {}, r = e(), i = e.toString(), a = i.slice(i.indexOf("[") + 1, i.lastIndexOf("]")).split(",").map((e) => e.trim());
	for (let e of a) if (!Oa.test(e)) throw Error(`Invalid dependency name: ${e}`);
	let o = 0;
	for (; o < r.length;) {
		let e = a[o], i = r[o];
		typeof i == "function" ? t[e] = Aa(i, e) : n[e] = i, o++;
	}
	return {
		functions: t,
		variables: n
	};
}
function Aa(e, t) {
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
function ja(e, t, n, r, i, a) {
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
			let d = i(), f = d && d._, p = f || Na(t, c);
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
var Ma = ")(postMessage)}";
function Na(e, t) {
	let [n, r] = Pa(t);
	return [n + ";var onMessage = function(data) {for (var key in data) {self[key] = data[key]}onMessage = (" + e.toString() + Ma, r];
}
function Pa(e) {
	let t = {}, n = {};
	for (let r of e) {
		let { functions: e, variables: i } = ka(r);
		t = Object.assign(Object.assign({}, t), e), n = Object.assign(Object.assign({}, n), i);
	}
	return [Object.keys(t).map((e) => e + "=" + t[e]).join(";"), n];
}
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunctionOrStream.js
function Fa(e, t, n, r, i, a) {
	let o = !1, s = !1, c = [], l = () => [], u = () => [], d, f, p = (e) => Ia[e], m = (e, t) => {
		Ia[e] = t;
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
	let x, S = (e) => {
		_(), g(), y(e), c.push(e);
	}, C = () => {
		_(), g(), S(() => [
			b,
			u,
			r
		]), o = !0, x.start(c, void 0);
	}, w = () => {
		s = !0, x.stop();
	}, ee = (e) => {
		x.ingest([Date.now(), e], l(...e));
	}, T, E = Object.assign({
		inputLatency: T,
		outputLatency: T,
		addDependencies(e) {
			v(), S(e);
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
		start: C,
		stop: w
	}, n(C, w, o, s, ee, h, g, _));
	return x = ja(e, (e) => {
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
var Ia = {};
//#endregion
//#region node_modules/worker-f/lib/createWorkerFunction.js
function La(e, t) {
	let n, r;
	return Fa(e, t, (e, t, i, a, o, s, c, l) => ({
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
function Ra(e, t, n, r, i) {
	let a = !1, o = !1, s = t();
	s || (s = za(e), n(s));
	let c = new D(s, { eval: !0 }).on("error", (e) => {
		o = !0, r(e);
	}).on("message", (e) => {
		i(e);
	}).on("exit", (e) => {
		e && !o && !a && r(/* @__PURE__ */ Error("Exited with code " + e));
	});
	return {
		stop: () => {
			a = !0, D.prototype.terminate.call(c);
		},
		ingest: c.postMessage.bind(c)
	};
}
function za(e) {
	return e + ";" + Ba;
}
var Ba = "var workerThreads = require(\"worker_threads\");workerThreads.parentPort.on(\"message\", function(data) {onMessage(data)});var postMessage = function(data, transferList) {workerThreads.parentPort.postMessage(data, transferList)};self = global";
//#endregion
//#region node_modules/worker-f/lib/export/node/createWorkerFunctionInNode.js
function Va(e) {
	return La(Ra, e);
}
//#endregion
//#region node_modules/read-excel-file/modules/saxen/parser.js
function Ha(e) {
	"@babel/helpers - typeof";
	return Ha = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ha(e);
}
function Ua(e) {
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
		var t = e && e.proxy, n, r, i, a, v = g, y, b, x, S, C = h, w = !1, ee = !1, T = "", E = !1, D = !1, O = null, k = !1, te, A, ne, re;
		function j(e) {
			e instanceof Error || (e = c(e)), O = e, v(e, C);
		}
		function M(e) {
			y && (e instanceof Error || (e = c(e)), y(e, C));
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
					S = t;
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
			if (e === void 0 && (e = {}), Ha(e) !== "object") throw c("required args <nsMap={}>");
			var t = {}, n;
			for (n in e) t[n] = e[n];
			return D = !0, re = t, this;
		};
		function ie() {
			te = D ? [] : null, A = D ? m(re) : null, ne = [], C = h, k = !1, O = null, ee = !1, T = "";
		}
		this.parse = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			if (w) throw c("parse during stream; call end() first");
			return ie(), N(e), C = h, k = !1, O;
		}, this.write = function(e) {
			if (typeof e != "string") throw c("required args <xml=string>");
			return w ||= (ie(), !0), O || (T = N(T + e, !0) || ""), this;
		}, this.end = function() {
			return w || ie(), w = !1, O || N(T), T = "", C = h, k = !1, O;
		}, this.stop = function() {
			k = !0;
		};
		function N(e) {
			var c = arguments.length > 1 && arguments[1] !== void 0 && arguments[1], m = null, h = null, g, _ = 0, v = !1, y = !1, w = 0, T = 0, O, ie, N, P, F, ae, I, oe, se, L = "", ce = 0, le;
			function ue(e, t) {
				var n = e.indexOf(":");
				if (n === -1) return e;
				var r = A[e.substring(0, n)];
				return r ? t === r ? e.substr(n + 1) : r + e.substr(n) : (M(l(e.substring(0, n))), null);
			}
			function de() {
				if (le !== null) return le;
				var e, t, n = D && A.xmlns, r = D && E ? [] : null, i = ce, a = L, s = a.length, c, l, u, f, m, h = {}, g = /* @__PURE__ */ new Set(), v, y, b;
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
				for (var t = /(\r\n|\r|\n)/g, n = 0, r = 0, i = 0, a = T, o, s; w >= i && (o = t.exec(e), !(!o || (a = o[0].length + o.index, a > w)));) n += 1, i = a;
				return w == -1 ? (r = a, s = e.substring(T)) : T === 0 ? s = e.substring(T, w) : (r = w - i, s = T == -1 ? e.substring(w) : e.substring(w, T + 1)), {
					data: s,
					line: n,
					column: r
				};
			}
			for (C = fe, t && (se = Object.create({}, {
				name: u(function() {
					return I;
				}),
				originalName: u(function() {
					return oe;
				}),
				attrs: u(de),
				ns: u(function() {
					return A;
				})
			})); T !== -1;) {
				if (w = e.charCodeAt(T) === 60 ? T : e.indexOf("<", T), w === -1) {
					if (c) return e.substring(T);
					if (ne.length) return j("unexpected end of file");
					if (!ee) return j("missing start tag");
					T < e.length && e.substring(T).trim() && M(s);
					return;
				}
				if (ee ||= !0, T !== w) {
					if (ne.length) {
						if (n && (n(e.substring(T, w), o, C), k)) return;
					} else if (e.substring(T, w).trim() && (M(s), k)) return;
				}
				if (P = e.charCodeAt(w + 1), P === 33) {
					if (N = e.charCodeAt(w + 2), N === 91 && e.substr(w + 3, 6) === "CDATA[") {
						if (T = e.indexOf("]]>", w), T === -1) return c ? e.substring(w) : j("unclosed cdata");
						if (a && (a(e.substring(w + 9, T), C), k)) return;
						T += 3;
						continue;
					}
					if (N === 45 && e.charCodeAt(w + 3) === 45) {
						if (T = e.indexOf("-->", w), T === -1) return c ? e.substring(w) : j("unclosed comment");
						if (b && (b(e.substring(w + 4, T), o, C), k)) return;
						T += 3;
						continue;
					}
				}
				if (P === 63) {
					if (T = e.indexOf("?>", w), T === -1) return c ? e.substring(w) : j("unclosed question");
					if (x && (x(e.substring(w, T + 2), C), k)) return;
					T += 2;
					continue;
				}
				for (O = w + 1;; O++) {
					if (F = e.charCodeAt(O), isNaN(F)) return c ? e.substring(w) : (T = -1, j("unclosed tag"));
					if (F === 34) N = e.indexOf("\"", O + 1), O = N === -1 ? O : N;
					else if (F === 39) N = e.indexOf("'", O + 1), O = N === -1 ? O : N;
					else if (F === 62) {
						T = O;
						break;
					}
				}
				if (P === 33) {
					if (S && (S(e.substring(w, T + 1), o, C), k)) return;
					T += 1;
					continue;
				}
				if (le = {}, P === 47) {
					if (v = !1, y = !0, !ne.length) return j("missing open tag");
					if (O = I = ne.pop(), N = w + 2 + O.length, e.substring(w + 2, N) !== O) return j("closing tag mismatch");
					for (; N < T; N++) if (P = e.charCodeAt(N), !(P === 32 || P > 8 && P < 14)) return j("close tag");
				} else {
					if (e.charCodeAt(T - 1) === 47 ? (O = I = e.substring(w + 1, T - 1), v = !0, y = !0) : (O = I = e.substring(w + 1, T), v = !0, y = !1), !(P > 96 && P < 123 || P > 64 && P < 91 || P === 95 || P === 58)) return j("illegal first char nodeName");
					for (N = 1, ie = O.length; N < ie; N++) if (P = O.charCodeAt(N), !(P > 96 && P < 123 || P > 64 && P < 91 || P > 47 && P < 59 || P === 45 || P === 95 || P == 46)) {
						if (P === 32 || P < 14 && P > 8) {
							I = O.substring(0, N), le = null;
							break;
						}
						return j("invalid nodeName");
					}
					y || ne.push(I);
				}
				if (D) {
					g = A, v && (y || te.push(g), le === null && (E = O.indexOf("xmlns", N) !== -1) && (ce = N, L = O, de(), E = !1)), oe = I, h !== A && (m = A[f], m === void 0 && (m = A[f] = {}), h = A);
					var R = m[I];
					if (R !== void 0) I = R;
					else {
						if (P = I.indexOf(":"), P !== -1) {
							if (ae = A[I.substring(0, P)], !ae) return j("missing namespace on <" + oe + ">");
							I = I.substr(P + 1);
						} else ae = A.xmlns;
						ae && (I = ae + ":" + I), m[oe] = I;
					}
				}
				if (v && (ce = N, L = O, r && (t ? r(se, o, y, C) : r(I, de, o, y, C), k))) return;
				if (y) {
					if (i && (i(t ? se : I, o, v, C), k)) return;
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
function Wa(e, t, n, r) {
	var i = !1, a = function() {
		if (i) throw Error("Errored");
	}, o, s = new Ua();
	return {
		promise: new Promise(function(a, c) {
			o = a, s.on("error", function(e) {
				throw i = !0, e;
			}), s.on("text", function(t, n) {
				r && r(n(t), e);
			}), s.on("openTag", function(n, r, i, a, o) {
				if (t) {
					var s = r();
					for (var c in s) s[Ga(c, !0)] = i(s[c]);
					t(Ga(n), s, e);
				}
			}), s.on("closeTag", function(t) {
				n && n(Ga(t), e);
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
function Ga(e, t) {
	for (var n = 0; n < e.length;) {
		if (e[n] === ":" && !(t && n === 5 && e.slice(0, 5) === "xmlns")) return e.slice(n + 1);
		n++;
	}
	return e;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/InvalidSpreadsheetError.js
function Ka(e) {
	"@babel/helpers - typeof";
	return Ka = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Ka(e);
}
function qa(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Ya(r.key), r);
	}
}
function Ja(e, t, n) {
	return t && qa(e.prototype, t), n && qa(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Ya(e) {
	var t = Xa(e, "string");
	return Ka(t) === "symbol" ? t : String(t);
}
function Xa(e, t) {
	if (Ka(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Ka(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Za(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Qa(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && oo(e, t);
}
function $a(e) {
	var t = io();
	return function() {
		var n = so(e), r;
		if (t) {
			var i = so(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return eo(this, r);
	};
}
function eo(e, t) {
	if (t && (Ka(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return to(e);
}
function to(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function no(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return no = function(e) {
		if (e === null || !ao(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return ro(e, arguments, so(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), oo(n, e);
	}, no(e);
}
function ro(e, t, n) {
	return ro = io() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && oo(i, n.prototype), i;
	}, ro.apply(null, arguments);
}
function io() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function ao(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function oo(e, t) {
	return oo = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, oo(e, t);
}
function so(e) {
	return so = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, so(e);
}
var co = /*#__PURE__*/ function(e) {
	Qa(n, e);
	var t = $a(n);
	function n(e) {
		var r;
		return Za(this, n), r = t.call(this, e), r.name = "InvalidSpreadsheetError", r;
	}
	return Ja(n);
}(/*#__PURE__*/ no(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xml/parseXml.js
function lo(e, t, n, r, i, a) {
	var o = Wa(t, n, r, i);
	return a ? s(o, e, a) : (o.write(e), o.end()), o.promise.then(function(e) {
		return e;
	}, function(e) {
		var t = new co(e.message);
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
var uo = class extends Error {
	constructor(e, t) {
		super(t || e), this.code = e;
	}
};
function fo(e) {
	let t = new uo(e.code, e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace(t, fo), t.cause = e, t;
}
//#endregion
//#region node_modules/unzipper-esm/lib/PullStream.js
var po = "function", mo = function() {
	this.buffer = Buffer.from("");
	let e = this;
	e.on("finish", function() {
		e.finished = !0, e.emit("chunk", !1);
	});
}, ho = function(e, t, n) {
	this.buffer = Buffer.concat([this.buffer, e]), this.cb = n, this.emit("chunk");
}, go = function(e, t) {
	let n = new te(), r, i = this;
	function a() {
		if (typeof i.cb === po) {
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
			i.removeListener("chunk", o), i.emit("error", new uo("FILE_ENDED"));
			return;
		}
	}
	return i.on("chunk", o), o(), n;
}, _o = function(e, t) {
	if (e === 0) return Promise.resolve("");
	if (!isNaN(e) && this.buffer.length > e) {
		let t = this.buffer.slice(0, e);
		return this.buffer = this.buffer.slice(e), Promise.resolve(t);
	}
	let n = Buffer.from(""), r = this, i = new A({ transform: a });
	function a(e, t, r) {
		n = Buffer.concat([n, e]), r();
	}
	let o, s;
	return new Promise(function(a, c) {
		if (o = c, s = function(e) {
			r.__emittedError = e, c(e);
		}, r.finished) return c(new uo("FILE_ENDED"));
		r.once("error", s), r.stream(e, t).on("error", c).pipe(i).on("finish", function() {
			a(n);
		}).on("error", c);
	}).finally(function() {
		r.removeListener("error", o), r.removeListener("error", s);
	});
}, vo = class extends k {
	constructor() {
		super({
			decodeStrings: !1,
			objectMode: !0
		}), mo.call(this);
	}
	_write(e, t, n) {
		return ho.call(this, e, t, n);
	}
	stream(e, t) {
		return go.call(this, e, t);
	}
	pull(e, t) {
		return _o.call(this, e, t);
	}
	_read() {}
}, yo = class extends A {
	_transform(e, t, n) {
		n();
	}
};
//#endregion
//#region node_modules/unzipper-esm/lib/BufferStream.js
function bo(e) {
	return new Promise(function(t, n) {
		let r = [], i = new A({ transform: a }).on("finish", function() {
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
function xo(e, t, n) {
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
function So(e, t) {
	let n = {}, r = 0;
	for (let [i, a] of t) n[i] = e.length >= r + a ? xo(e, r, a) : null, r += a;
	return n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseExtraField.js
function Co(e, t) {
	let n;
	for (; !n && e && e.length;) {
		let r = So(e, [["signature", 2], ["partSize", 2]]);
		if (r.signature === 1) {
			let r = [];
			t.uncompressedSize === 4294967295 && r.push(["uncompressedSize", 8]), t.compressedSize === 4294967295 && r.push(["compressedSize", 8]), t.offsetToLocalFileHeader === 4294967295 && r.push(["offsetToLocalFileHeader", 8]), n = So(e.slice(4), r);
		} else e = e.slice(r.partSize + 4);
	}
	return n ||= {}, t.compressedSize === 4294967295 && (t.compressedSize = n.compressedSize), t.uncompressedSize === 4294967295 && (t.uncompressedSize = n.uncompressedSize), t.offsetToLocalFileHeader === 4294967295 && (t.offsetToLocalFileHeader = n.offsetToLocalFileHeader), n;
}
//#endregion
//#region node_modules/unzipper-esm/lib/parseDateTime.js
function wo(e, t) {
	let n = e & 31, r = e >> 5 & 15, i = (e >> 9 & 127) + 1980, a = t ? (t & 31) * 2 : 0, o = t ? t >> 5 & 63 : 0, s = t ? t >> 11 : 0;
	return new Date(Date.UTC(i, r - 1, n, s, o, a));
}
//#endregion
//#region node_modules/unzipper-esm/lib/parse.js
var To = Buffer.alloc(4);
To.writeUInt32LE(101010256, 0);
function Eo(e) {
	return new Fo(e);
}
var Do = function(e) {
	this._opts = e;
	let t = this;
	t.on("finish", function() {
		t.emit("end"), t.emit("close");
	}), t._readRecord().catch(function(e) {
		(!t.__emittedError || t.__emittedError !== e) && t.emit("error", e);
	});
}, Oo = function() {
	let e = this;
	return e.pull(4).then(function(t) {
		if (t.length === 0) return;
		let n = t.readUInt32LE(0);
		if (n === 875721283) return e._readCrxHeader();
		if (n === 67324752) return e._readFile();
		if (n === 33639248) return e.reachedCD = !0, e._readCentralDirectoryFileHeader();
		if (n === 101010256) return e._readEndOfCentralDirectoryRecord();
		if (e.reachedCD) return e.pull(To, !0).then(function() {
			return e._readEndOfCentralDirectoryRecord();
		});
		e.emit("error", new uo("INVALID_SIGNATURE", "invalid signature: 0x" + n.toString(16)));
	}).then((function(t) {
		if (t) return e._readRecord();
	}));
}, ko = function() {
	let e = this;
	return e.pull(12).then(function(t) {
		return e.crxHeader = So(t, [
			["version", 4],
			["pubKeyLength", 4],
			["signatureLength", 4]
		]), e.pull(e.crxHeader.pubKeyLength + e.crxHeader.signatureLength);
	}).then(function(t) {
		return e.crxHeader.publicKey = t.slice(0, e.crxHeader.pubKeyLength), e.crxHeader.signature = t.slice(e.crxHeader.pubKeyLength), e.emit("crx-header", e.crxHeader), !0;
	});
}, Ao = function() {
	let e = this;
	return e.pull(26).then(function(t) {
		let n = So(t, [
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
		return n.lastModifiedDateTime = wo(n.lastModifiedDate, n.lastModifiedTime), e.crxHeader && (n.crxHeader = e.crxHeader), e.pull(n.fileNameLength).then(function(t) {
			let r = t.toString("utf8"), i = new te(), a = !1;
			return i.autodrain = function() {
				a = !0;
				let e = i.pipe(new yo());
				return e.promise = function() {
					return new Promise(function(t, n) {
						e.on("finish", t), e.on("error", n);
					});
				}, e;
			}, i.buffer = function() {
				return bo(i);
			}, i.path = r, i.props = {}, i.props.path = r, i.props.pathBuffer = t, i.props.flags = { isUnicode: !!(n.flags & 2048) }, i.type = n.uncompressedSize === 0 && /[/\\]$/.test(r) ? "Directory" : "File", e._opts.verbose && (i.type === "Directory" ? console.log("   creating:", r) : i.type === "File" && (n.compressionMethod === 0 ? console.log(" extracting:", r) : console.log("  inflating:", r))), e.pull(n.extraFieldLength).then(function(t) {
				let o = Co(t, n);
				i.vars = n, i.extra = o, e._opts.forceStream ? e.push(i) : (e.emit("entry", i), (e._readableState.pipesCount || e._readableState.pipes && e._readableState.pipes.length) && e.push(i)), e._opts.verbose && console.log({
					filename: r,
					vars: n,
					extra: o
				});
				let s = !(n.flags & 8) || n.compressedSize > 0, c;
				i.__autodraining = a;
				let l = n.compressionMethod && !a ? O.createInflateRaw() : te();
				return s ? (i.size = n.uncompressedSize, c = n.compressedSize) : (c = Buffer.alloc(4), c.writeUInt32LE(134695760, 0)), new Promise(function(t, n) {
					ne(e.stream(c), l, i, function(r) {
						return r ? (r.code === "Z_DATA_ERROR" && (r = fo(r)), n(r)) : s ? t(s) : e._processDataDescriptor(i).then(t).catch(n);
					});
				});
			});
		});
	});
}, jo = function(e) {
	return this.pull(16).then(function(t) {
		return e.size = So(t, [
			["dataDescriptorSignature", 4],
			["crc32", 4],
			["compressedSize", 4],
			["uncompressedSize", 4]
		]).uncompressedSize, !0;
	});
}, Mo = function() {
	let e = this;
	return e.pull(42).then(function(t) {
		let n = So(t, [
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
}, No = function() {
	let e = this;
	return e.pull(18).then(function(t) {
		let n = So(t, [
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
}, Po = function() {
	let e = this;
	return new Promise(function(t, n) {
		e.on("finish", t), e.on("error", n);
	});
}, Fo = class extends vo {
	constructor(e = { verbose: !1 }) {
		super(e), Do.call(this, e);
	}
	_readRecord() {
		return Oo.call(this);
	}
	_readCrxHeader() {
		return ko.call(this);
	}
	_readFile() {
		return Ao.call(this);
	}
	_processDataDescriptor(e) {
		return jo.call(this, e);
	}
	_readCentralDirectoryFileHeader() {
		return Mo.call(this);
	}
	_readEndOfCentralDirectoryRecord() {
		return No.call(this);
	}
	promise() {
		return Po.call(this);
	}
}, Io = /* @__PURE__ */ P(((e, t) => {
	var n = F("constants"), r = process.cwd, i = null, a = process.env.GRACEFUL_FS_PLATFORM || process.platform;
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
})), Lo = /* @__PURE__ */ P(((e, t) => {
	var n = F("stream").Stream;
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
})), Ro = /* @__PURE__ */ P(((e, t) => {
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
})), zo = /* @__PURE__ */ P(((e, t) => {
	var n = F("fs"), r = Io(), i = Lo(), a = Ro(), o = F("util"), s, c;
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
		d(n[s]), F("assert").equal(n[s].length, 0);
	})), global[s] || u(global, n[s]), t.exports = f(a(n)), process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !n.__patched && (t.exports = f(n), n.__patched = !0);
	function f(e) {
		r(e), e.gracefulify = f, e.createReadStream = ee, e.createWriteStream = T;
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
			x = g.ReadStream, C = g.WriteStream;
		}
		var _ = e.ReadStream;
		_ && (x.prototype = Object.create(_.prototype), x.prototype.open = S);
		var v = e.WriteStream;
		v && (C.prototype = Object.create(v.prototype), C.prototype.open = w), Object.defineProperty(e, "ReadStream", {
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
				return C;
			},
			set: function(e) {
				C = e;
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
		var b = C;
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
		function S() {
			var e = this;
			D(e.path, e.flags, e.mode, function(t, n) {
				t ? (e.autoClose && e.destroy(), e.emit("error", t)) : (e.fd = n, e.emit("open", n), e.read());
			});
		}
		function C(e, t) {
			return this instanceof C ? (v.apply(this, arguments), this) : C.apply(Object.create(C.prototype), arguments);
		}
		function w() {
			var e = this;
			D(e.path, e.flags, e.mode, function(t, n) {
				t ? (e.destroy(), e.emit("error", t)) : (e.fd = n, e.emit("open", n));
			});
		}
		function ee(t, n) {
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
(/* @__PURE__ */ P(((e, t) => {
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
})))(), Buffer.alloc(4).writeUInt32LE(101010256, 0), zo();
//#endregion
//#region node_modules/read-excel-file/modules/zip/UnzipError.js
function Bo(e) {
	"@babel/helpers - typeof";
	return Bo = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Bo(e);
}
function Vo(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Uo(r.key), r);
	}
}
function Ho(e, t, n) {
	return t && Vo(e.prototype, t), n && Vo(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Uo(e) {
	var t = Wo(e, "string");
	return Bo(t) === "symbol" ? t : String(t);
}
function Wo(e, t) {
	if (Bo(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Bo(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Go(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Ko(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && es(e, t);
}
function qo(e) {
	var t = Qo();
	return function() {
		var n = ts(e), r;
		if (t) {
			var i = ts(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return Jo(this, r);
	};
}
function Jo(e, t) {
	if (t && (Bo(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Yo(e);
}
function Yo(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Xo(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Xo = function(e) {
		if (e === null || !$o(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Zo(e, arguments, ts(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), es(n, e);
	}, Xo(e);
}
function Zo(e, t, n) {
	return Zo = Qo() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && es(i, n.prototype), i;
	}, Zo.apply(null, arguments);
}
function Qo() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function $o(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function es(e, t) {
	return es = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, es(e, t);
}
function ts(e) {
	return ts = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, ts(e);
}
var ns = /*#__PURE__*/ function(e) {
	Ko(n, e);
	var t = qo(n);
	function n() {
		return Go(this, n), t.apply(this, arguments);
	}
	return Ho(n);
}(/*#__PURE__*/ Xo(Error));
function rs(e) {
	var t = new ns(e.message);
	return e.stack && (t.stack = e.stack), Error.captureStackTrace && Error.captureStackTrace(t, rs), t.cause = e, t;
}
//#endregion
//#region node_modules/read-excel-file/modules/zip/unzipFromStream.unzipper.js
var is = void 0;
function as(e, t, n, r) {
	return new Promise(function(i, a) {
		var o = [], s = !1, c = function(e) {
			e instanceof uo && (e = rs(e)), s || (s = !0, a(e));
		};
		e.on("error", c).pipe(Eo()).on("error", c).on("finish", function() {
			s || Promise.all(o).then(function() {
				i(is);
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
function os(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = ss(e)) || t && e && typeof e.length == "number") {
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
function ss(e, t) {
	if (e) {
		if (typeof e == "string") return cs(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return cs(e, t);
	}
}
function cs(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function ls(e) {
	var t = (arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}).filter, n = {}, r = {};
	return as(e, function(e, n) {
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
		n[e] = r[e].size === void 0 ? us(r[e].chunks) : r[e].buffer, delete r[e];
	}).then(function() {
		return n;
	});
}
function us(e) {
	for (var t = e.reduce(function(e, t) {
		return e + t.length;
	}, 0), n = Buffer.allocUnsafeSlow(t), r = 0, i = os(e), a; !(a = i()).done;) {
		var o = a.value;
		o.copy(n, r), r += o.length;
	}
	return n;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InvalidInputError.js
function ds(e) {
	"@babel/helpers - typeof";
	return ds = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, ds(e);
}
function fs(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, ms(r.key), r);
	}
}
function ps(e, t, n) {
	return t && fs(e.prototype, t), n && fs(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function ms(e) {
	var t = hs(e, "string");
	return ds(t) === "symbol" ? t : String(t);
}
function hs(e, t) {
	if (ds(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (ds(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function gs(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function _s(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Ts(e, t);
}
function vs(e) {
	var t = Cs();
	return function() {
		var n = Es(e), r;
		if (t) {
			var i = Es(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return ys(this, r);
	};
}
function ys(e, t) {
	if (t && (ds(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return bs(e);
}
function bs(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function xs(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return xs = function(e) {
		if (e === null || !ws(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Ss(e, arguments, Es(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Ts(n, e);
	}, xs(e);
}
function Ss(e, t, n) {
	return Ss = Cs() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Ts(i, n.prototype), i;
	}, Ss.apply(null, arguments);
}
function Cs() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function ws(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Ts(e, t) {
	return Ts = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Ts(e, t);
}
function Es(e) {
	return Es = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Es(e);
}
var Ds = {
	XLS_FILE_NOT_SUPPORTED: "You passed a legacy `.xls` file. Only `.xlsx` files are supported",
	FILE_NOT_SUPPORTED: "Doesn't look like an `.xlsx` file",
	INVALID_ZIP: "Couldn't unzip `.xlsx` file contents",
	NO_DATA: "No data"
}, Os = /*#__PURE__*/ function(e) {
	_s(n, e);
	var t = vs(n);
	function n(e, r) {
		var i;
		return gs(this, n), i = t.call(this, Ds[e] || e), i.code = e, i.name = "InvalidInputError", i.cause = r, i;
	}
	return ps(n);
}(/*#__PURE__*/ xs(Error));
//#endregion
//#region node_modules/read-excel-file/modules/export/convertInputToNodeStream.js
function ks(e) {
	return e instanceof j ? e : e instanceof Buffer ? As(e) : e instanceof re ? js(e) : l.createReadStream(e);
}
function As(e) {
	return M.from(e);
}
function js(e) {
	return M.fromWeb(e.stream());
}
//#endregion
//#region node_modules/read-excel-file/modules/export/filterZipArchiveEntry.js
function Ms(e) {
	var t = e.path;
	return t.endsWith(".xml") || t.endsWith(".xml.rels");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/createFileTypeDetector.js
var Ns = [80, 75], Ps = [
	208,
	207,
	17,
	224
], Fs = [Ns, Ps];
Fs.indexOf(Ns);
var Is = Fs.indexOf(Ps);
function Ls() {
	var e, t = Rs(Fs), n = 0;
	return function(r) {
		if (isNaN(e)) {
			var i;
			t = t.filter(function(e) {
				if (r === Fs[e][n]) return Fs[e].length === n + 1 && (i = e), !0;
			}), t.length === 1 ? e = i : t.length === 0 && (e = -1);
		}
		return n++, e;
	};
}
function Rs(e) {
	for (var t = [], n = 0; n < e.length;) t.push(n), n++;
	return t;
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/validateLeadingBytes.js
function zs(e, t) {
	var n = t(e);
	if (n !== void 0) {
		if (n === Is) throw new Os("XLS_FILE_NOT_SUPPORTED");
		if (n < 0) throw new Os("FILE_NOT_SUPPORTED");
		return !0;
	}
}
function Bs(e) {
	throw new Os(e === 0 ? "NO_DATA" : "FILE_NOT_SUPPORTED");
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/file/InputValidationStream.js
function Vs(e) {
	"@babel/helpers - typeof";
	return Vs = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Vs(e);
}
function Hs(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = Us(e)) || t && e && typeof e.length == "number") {
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
function Us(e, t) {
	if (e) {
		if (typeof e == "string") return Ws(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Ws(e, t);
	}
}
function Ws(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Gs(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function Ks(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, Js(r.key), r);
	}
}
function qs(e, t, n) {
	return t && Ks(e.prototype, t), n && Ks(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function Js(e) {
	var t = Ys(e, "string");
	return Vs(t) === "symbol" ? t : String(t);
}
function Ys(e, t) {
	if (Vs(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Vs(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Xs(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Zs(e, t);
}
function Zs(e, t) {
	return Zs = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Zs(e, t);
}
function Qs(e) {
	var t = tc();
	return function() {
		var n = nc(e), r;
		if (t) {
			var i = nc(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return $s(this, r);
	};
}
function $s(e, t) {
	if (t && (Vs(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return ec(e);
}
function ec(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function tc() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function nc(e) {
	return nc = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, nc(e);
}
var rc = /*#__PURE__*/ function(e) {
	Xs(n, e);
	var t = Qs(n);
	function n() {
		var e;
		return Gs(this, n), e = t.call(this), e.d = Ls(), e.i = 0, e.chunks = [], e;
	}
	return qs(n, [{
		key: "_transform",
		value: function(e, t, n) {
			if (this.d) {
				this.chunks.push(e);
				for (var r = Hs(e), i; !(i = r()).done;) {
					var a = i.value;
					try {
						if (zs(a, this.d)) {
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
				Bs(this.i);
			} catch (t) {
				return e(t);
			}
			e();
		}
	}]), n;
}(ie), ic;
function ac(e) {
	var t = Date.now();
	(typeof global < "u" ? global.READ_EXCEL_FILE_CHECKPOINTS : typeof window < "u" && window.READ_EXCEL_FILE_CHECKPOINTS) && (ic && console.log("  -", t - ic, "ms"), console.log("*", e)), ic = t;
}
function oc() {
	ic = void 0;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/unpackXlsxFileNode.js
function sc(e) {
	oc(), ac("unpack files");
	var t = ks(e);
	return new Promise(function(e, n) {
		ls(t.on("error", n).pipe(new rc()), { filter: Ms }).then(e, function(e) {
			e instanceof ns ? n(new Os("INVALID_ZIP", e.cause)) : n(e);
		});
	});
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetInfo.js
function cc(e, t) {
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
function lc(e, t) {
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
function uc(e) {
	"@babel/helpers - typeof";
	return uc = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, uc(e);
}
var dc = ["xfId"];
function fc(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function pc(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? fc(Object(n), !0).forEach(function(t) {
			mc(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : fc(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function mc(e, t, n) {
	return t = hc(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function hc(e) {
	var t = gc(e, "string");
	return uc(t) === "symbol" ? t : String(t);
}
function gc(e, t) {
	if (uc(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (uc(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function _c(e, t) {
	if (e == null) return {};
	var n = vc(e, t), r, i;
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (i = 0; i < a.length; i++) r = a[i], !(t.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(e, r) && (n[r] = e[r]);
	}
	return n;
}
function vc(e, t) {
	if (e == null) return {};
	for (var n = {}, r = Object.keys(e), i, a = 0; a < r.length; a++) i = r[a], !(t.indexOf(i) >= 0) && (n[i] = e[i]);
	return n;
}
function yc(e, t) {
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
				var n = t.xfId, r = _c(t, dc);
				return pc(pc({}, e.baseStyles[n]), r);
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
function bc(e, t) {
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
function xc(e, t) {
	var n = 17, r = 1, i = 1, a = 864e5, o = 365;
	t && (e += 4 * o + r + i);
	var s = r + i + 70 * o + n;
	return Math.floor((e - s) * a);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormat.js
var Sc = /;@$/, Cc = /[^a-z0#\?%]+/;
function wc(e, t, n) {
	var r = n[e];
	return r === void 0 ? n[e] = Tc(t) : r;
}
function Tc(e) {
	return e = e.toLowerCase(), e = e.replace(Sc, ""), e = e.replace(/\\./g, " "), e.split(";").some(t);
	function t(e) {
		e = e.replace(/"[^"]*"/g, " "), e = e.replace(/(\[?[smhd]{1,2}\]?)[\.\,]00?0?/g, "$1"), e = e.replace(/\[([smhd]{1,2})\]/g, "$1"), e = e.replace(/\[[^\]]*\]/g, "");
		var t = e.split(Cc).filter(function(e) {
			return e;
		});
		return t.length !== 0 && t.every(function(e) {
			return Ec.indexOf(e) >= 0;
		});
	}
}
var Ec = /* @__PURE__ */ "s.ss.m.mm.h.hh.am.pm.a.p.d.dd.ddd.dddd.aaa.aaaa.aaaaa.m.mm.mmm.mmmm.mmmmm.y.yy.yyyy.e.ee.eeee".split(".");
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/isDateFormatStyle.js
function Dc(e, t, n, r) {
	return e.numberFormat ? !!(jc.indexOf(e.numberFormat.id) >= 0 || t && e.numberFormat.template === t || n && e.numberFormat.template && wc(e.numberFormat.id, e.numberFormat.template, r)) : !1;
}
var Oc = [
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
], kc = [
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
], Ac = [
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
], jc = Oc.concat(kc).concat(Ac.filter(function(e) {
	return kc.indexOf(e) < 0;
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
	return kc.indexOf(e) < 0;
}).filter(function(e) {
	return Ac.indexOf(e) < 0;
}));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseCell.js
function Mc(e, t) {
	return Lc(e) || Ic(e, t) || Pc(e, t) || Nc();
}
function Nc() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function Ic(e, t) {
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
function Lc(e) {
	if (Array.isArray(e)) return e;
}
var Rc = [null, null];
function zc(e, t, n, r, i) {
	var a = Mc(i, 7), o = a[0], s = a[1], c = a[2], l = a[3], u = a[4], d = a[5], f = a[6];
	switch (e || "n") {
		case "str": return n === void 0 ? "VALUE_MISSING" : n ? ["s", n] : Rc;
		case "inlineStr": return r === void 0 ? "VALUE_MISSING" : ["s", r];
		case "s":
			if (!n) return "VALUE_MISSING";
			var p = Number(n);
			return isNaN(p) || o[p] === void 0 ? "VALUE_INVALID" : ["s", o[p]];
		case "b": return n ? n === "1" ? ["b", !0] : n === "0" ? ["b", !1] : "VALUE_INVALID" : "VALUE_MISSING";
		case "e": return n ? ["e", n] : "VALUE_MISSING";
		case "d":
			if (!n) return Rc;
			var m = new Date(n);
			return isNaN(m.valueOf()) ? "VALUE_INVALID" : ["d", m.getTime()];
		case "n":
			if (!n) return Rc;
			if (t) {
				var h = Number(t);
				if (isNaN(h) || s[h] === void 0) return "FORMAT_INVALID";
				if (Dc(s[h], u, d, l)) {
					var g = Number(n);
					return isNaN(g) ? "VALUE_INVALID" : ["d", xc(g, c)];
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
function Bc(e) {
	for (var t = 0, n = 0; n < e.length;) {
		var r = e.charCodeAt(n);
		if (r >= 48 && r <= 57) {
			var i = Number(e.slice(n));
			return isNaN(i) && Vc(e), [i, t];
		}
		t *= 26, t += e.charCodeAt(n) - 64, n++;
	}
	Vc(e);
}
function Vc(e) {
	throw Error(`<c r="${e}">`);
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSheet.js
function Hc(e, t) {
	return Gc(e) || Wc(e, t) || qc(e, t) || Uc();
}
function Uc() {
	throw TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function Wc(e, t) {
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
function Gc(e) {
	if (Array.isArray(e)) return e;
}
function Kc(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = qc(e)) || t && e && typeof e.length == "number") {
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
function qc(e, t) {
	if (e) {
		if (typeof e == "string") return Jc(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Jc(e, t);
	}
}
function Jc(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
var Yc = null;
function Xc(e, t, n) {
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
		for (var o = Kc(l), s; !(s = o()).done;) for (var c = s.value; c.length < i;) c.push(Yc);
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
		throw new co(`<c/> at row ${t}, col ${n}: ${r}`);
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
		e === "dimension" ? n.dimension = S(t.ref) : e === "sheetData" ? n.sheetData = C() : n.sheetData && w(e, t, n.sheetData);
	}
	function b(e, t) {
		t.sheetData && ee(e, t.sheetData);
	}
	function x(e, t) {
		t.sheetData && T(e, t.sheetData);
	}
	function S(e) {
		var t = e.split(":").map(Bc);
		return t.length === 1 && (t = [t[0], t[0]]), t;
	}
	function C() {
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
	function w(e, t, n) {
		e === "row" ? (t.r && (n.rowNumber = Number(t.r)), n.row = []) : e === "c" ? (n.c = te(), n.c.attributes = t) : n.c && A(e, t, n.c);
	}
	function ee(e, t) {
		if (e === "row") {
			if (t.rowNumber) {
				var n = t.rowIndexShift + t.rows.length;
				if (t.rowNumber <= n) throw new co(`Out-of-place <row/> number ${t.rowNumber} follows <row/> number ${n}`);
				for (; t.rowNumber > t.rowIndexShift + t.rows.length + 1;) t.rows.push([]);
			}
			t.rows.push(t.row), t.row.length > 0 && (t.dataRowCount = t.rowNumber), t.rowNumber > t.rowCount && (t.rowCount = t.rowNumber), t.row = void 0, t.rowNumber = void 0;
		} else if (e === "c") {
			var r = E(t.c);
			if (r.row < t.cursor[0] || r.row === t.cursor[0] && r.column <= t.cursor[1]) throw new co(`Out-of-place <c/> at row ${r.row} col ${r.column} follows <c/> at row ${t.cursor[0]} col ${t.cursor[1]}`);
			if (t.cursor[0] = r.row, t.cursor[1] = r.column, t.rowNumber ||= r.row, r.error) j && _(r), t.errors.push(r);
			else if (r.value !== Yc) {
				for (; r.column > t.row.length + 1;) t.row.push(Yc);
				t.row.push(r.value), r.column > t.dataColumnCount && (t.dataColumnCount = r.column);
			}
			r.column > t.columnCount && (t.columnCount = r.column), t.c = void 0;
		} else t.c && ne(e, t.c);
	}
	function T(e, t) {
		t.c && re(e, t.c);
	}
	function E(e) {
		var t = e.attributes, n = e.inlineString, r = e.vText, i = Hc(Bc(t.r), 2), a = i[0], o = i[1], l = D(t.t, t.s, r, n, c, s.trim !== !1);
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
		return Array.isArray(o) && o[0] === "s" && (a && (o[1] = o[1].trim()), o[1] === "") ? Rc : o;
	}
	function O(e, t, n, r, i) {
		var a = zc(e, t, n, r, i);
		if (a === "VALUE_MISSING") switch (e || "n") {
			case "str":
			case "inlineStr":
			case "s":
			case "b": return Rc;
		}
		return e === "e" ? Rc : a;
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
var Zc = N("/"), Qc;
try {
	Qc = Zc("worker_threads"), Qc.Worker, Qc.isMarkedAsUntransferable;
} catch {}
var $c = Uint8Array, el = Uint16Array, tl = Int32Array, nl = new $c([
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
]), rl = new $c([
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
new $c([
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
var il = function(e, t) {
	for (var n = new el(31), r = 0; r < 31; ++r) n[r] = t += 1 << e[r - 1];
	for (var i = new tl(n[30]), r = 1; r < 30; ++r) for (var a = n[r]; a < n[r + 1]; ++a) i[a] = a - n[r] << 5 | r;
	return {
		b: n,
		r: i
	};
}, Qc = il(nl, 2), al = Qc.b, ol = Qc.r;
al[28] = 258, ol[258] = 28;
var sl = il(rl, 0);
sl.b, sl.r;
for (var cl = new el(32768), Y = 0; Y < 32768; ++Y) {
	var ll = (Y & 43690) >> 1 | (Y & 21845) << 1;
	ll = (ll & 52428) >> 2 | (ll & 13107) << 2, ll = (ll & 61680) >> 4 | (ll & 3855) << 4, cl[Y] = ((ll & 65280) >> 8 | (ll & 255) << 8) >> 1;
}
for (var ul = new $c(288), Y = 0; Y < 144; ++Y) ul[Y] = 8;
for (var Y = 144; Y < 256; ++Y) ul[Y] = 9;
for (var Y = 256; Y < 280; ++Y) ul[Y] = 7;
for (var Y = 280; Y < 288; ++Y) ul[Y] = 8;
for (var dl = new $c(32), Y = 0; Y < 32; ++Y) dl[Y] = 5;
var fl = function(e, t, n) {
	return (t == null || t < 0) && (t = 0), (n == null || n > e.length) && (n = e.length), new $c(e.subarray(t, n));
}, pl = [
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
], ml = function(e, t, n) {
	var r = Error(t || pl[e]);
	if (r.code = e, Error.captureStackTrace && Error.captureStackTrace(r, ml), !n) throw r;
	return r;
}, hl = /*#__PURE__*/ new $c(0), gl = typeof TextDecoder < "u" && /*#__PURE__*/ new TextDecoder();
try {
	gl.decode(hl, { stream: !0 });
} catch {}
var _l = function(e) {
	for (var t = "", n = 0;;) {
		var r = e[n++], i = (r > 127) + (r > 223) + (r > 239);
		if (n + i > e.length) return {
			s: t,
			r: fl(e, n - 1)
		};
		i ? i == 3 ? (r = ((r & 15) << 18 | (e[n++] & 63) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) - 65536, t += String.fromCharCode(55296 | r >> 10, 56320 | r & 1023)) : i & 1 ? t += String.fromCharCode((r & 31) << 6 | e[n++] & 63) : t += String.fromCharCode((r & 15) << 12 | (e[n++] & 63) << 6 | e[n++] & 63) : t += String.fromCharCode(r);
	}
};
function vl(e, t) {
	if (t) {
		for (var n = "", r = 0; r < e.length; r += 16384) n += String.fromCharCode.apply(null, e.subarray(r, r + 16384));
		return n;
	}
	if (gl) return gl.decode(e);
	var i = _l(e), a = i.s, n = i.r;
	return n.length && ml(8), a;
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/convertValuesFromUint8ArraysToStrings.js
function yl(e) {
	ac("convert files to strings");
	for (var t = {}, n = 0, r = Object.keys(e); n < r.length; n++) {
		var i = r[n];
		t[i] = bl(e[i]);
	}
	return t;
}
function bl(e) {
	return typeof TextDecoder < "u" ? new TextDecoder().decode(e) : vl(e);
}
//#endregion
//#region node_modules/read-excel-file/modules/utility/isPromise.js
function xl(e) {
	"@babel/helpers - typeof";
	return xl = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, xl(e);
}
function Sl(e) {
	return xl(e) === "object" && typeof e.then == "function";
}
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/SheetNotFoundError.js
function Cl(e) {
	"@babel/helpers - typeof";
	return Cl = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Cl(e);
}
function wl(e, t) {
	for (var n = 0; n < t.length; n++) {
		var r = t[n];
		r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, El(r.key), r);
	}
}
function Tl(e, t, n) {
	return t && wl(e.prototype, t), n && wl(e, n), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function El(e) {
	var t = Dl(e, "string");
	return Cl(t) === "symbol" ? t : String(t);
}
function Dl(e, t) {
	if (Cl(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Cl(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Ol(e, t) {
	if (!(e instanceof t)) throw TypeError("Cannot call a class as a function");
}
function kl(e, t) {
	if (typeof t != "function" && t !== null) throw TypeError("Super expression must either be null or a function");
	e.prototype = Object.create(t && t.prototype, { constructor: {
		value: e,
		writable: !0,
		configurable: !0
	} }), Object.defineProperty(e, "prototype", { writable: !1 }), t && Ll(e, t);
}
function Al(e) {
	var t = Fl();
	return function() {
		var n = Rl(e), r;
		if (t) {
			var i = Rl(this).constructor;
			r = Reflect.construct(n, arguments, i);
		} else r = n.apply(this, arguments);
		return jl(this, r);
	};
}
function jl(e, t) {
	if (t && (Cl(t) === "object" || typeof t == "function")) return t;
	if (t !== void 0) throw TypeError("Derived constructors may only return object or undefined");
	return Ml(e);
}
function Ml(e) {
	if (e === void 0) throw ReferenceError("this hasn't been initialised - super() hasn't been called");
	return e;
}
function Nl(e) {
	var t = typeof Map == "function" ? /* @__PURE__ */ new Map() : void 0;
	return Nl = function(e) {
		if (e === null || !Il(e)) return e;
		if (typeof e != "function") throw TypeError("Super expression must either be null or a function");
		if (t !== void 0) {
			if (t.has(e)) return t.get(e);
			t.set(e, n);
		}
		function n() {
			return Pl(e, arguments, Rl(this).constructor);
		}
		return n.prototype = Object.create(e.prototype, { constructor: {
			value: n,
			enumerable: !1,
			writable: !0,
			configurable: !0
		} }), Ll(n, e);
	}, Nl(e);
}
function Pl(e, t, n) {
	return Pl = Fl() ? Reflect.construct.bind() : function(e, t, n) {
		var r = [null];
		r.push.apply(r, t);
		var i = new (Function.bind.apply(e, r))();
		return n && Ll(i, n.prototype), i;
	}, Pl.apply(null, arguments);
}
function Fl() {
	if (typeof Reflect > "u" || !Reflect.construct || Reflect.construct.sham) return !1;
	if (typeof Proxy == "function") return !0;
	try {
		return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {})), !0;
	} catch {
		return !1;
	}
}
function Il(e) {
	return Function.toString.call(e).indexOf("[native code]") !== -1;
}
function Ll(e, t) {
	return Ll = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, t) {
		return e.__proto__ = t, e;
	}, Ll(e, t);
}
function Rl(e) {
	return Rl = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(e) {
		return e.__proto__ || Object.getPrototypeOf(e);
	}, Rl(e);
}
var zl = /*#__PURE__*/ function(e) {
	kl(n, e);
	var t = Al(n);
	function n(e, r) {
		var i;
		return Ol(this, n), i = t.call(this, `Sheet not found: ${typeof e == "number" ? e + ". Sheet count: " + r.length : e + ". Available sheets: " + r.join(", ")}`), i.name = "SheetNotFoundError", i.sheet = e, i.sheets = r, i;
	}
	return Tl(n);
}(/*#__PURE__*/ Nl(Error));
//#endregion
//#region node_modules/read-excel-file/modules/xlsx/parseSpreadsheetContents.js
function Bl(e) {
	"@babel/helpers - typeof";
	return Bl = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(e) {
		return typeof e;
	} : function(e) {
		return e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
	}, Bl(e);
}
function Vl(e, t) {
	var n = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
	if (n) return (n = n.call(e)).next.bind(n);
	if (Array.isArray(e) || (n = Hl(e)) || t && e && typeof e.length == "number") {
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
function Hl(e, t) {
	if (e) {
		if (typeof e == "string") return Ul(e, t);
		var n = Object.prototype.toString.call(e).slice(8, -1);
		if (n === "Object" && e.constructor && (n = e.constructor.name), n === "Map" || n === "Set") return Array.from(e);
		if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return Ul(e, t);
	}
}
function Ul(e, t) {
	(t == null || t > e.length) && (t = e.length);
	for (var n = 0, r = Array(t); n < t; n++) r[n] = e[n];
	return r;
}
function Wl(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Gl(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Wl(Object(n), !0).forEach(function(t) {
			Kl(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Wl(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Kl(e, t, n) {
	return t = ql(t), t in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function ql(e) {
	var t = Jl(e, "string");
	return Bl(t) === "symbol" ? t : String(t);
}
function Jl(e, t) {
	if (Bl(e) !== "object" || e === null) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (Bl(r) !== "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Yl(e, t) {
	var n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, r = yl(t);
	return ac("parse spreadsheet info and file paths"), nu($l(), r, e).then(function(t) {
		var i = t.spreadsheetInfo, a = t.filePaths;
		return ac("parse \"shared strings\" and \"styles\""), nu(eu(a), r, e).then(function(t) {
			var o = t.sharedStrings, s = t.styles, c = n.sheets ? n.sheets.map(function(e) {
				return Zl(e, i.sheets);
			}) : i.sheets.map(function(e) {
				return e.relationId;
			});
			return ac(`parse sheet${c.length === 1 ? "" : "s"} data`), nu(tu(a, c, {
				sharedStrings: o,
				styles: s,
				epoch1904: i.epoch1904,
				dateFormatDetectionCache: [],
				options: n
			}), r, e).then(function(e) {
				return ac("end"), c.map(function(t) {
					return {
						sheet: Ql(t, i.sheets),
						data: e[t]
					};
				});
			});
		});
	});
}
function Xl(e, t, n, r) {
	return r && r.parseNumber || (r = Gl(Gl({}, r), {}, { parseNumber: null })), Yl(t, n, r);
}
function Zl(e, t) {
	if (typeof e == "string") for (var n = Vl(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.name === e) return i.relationId;
	}
	else if (e <= t.length) return t[e - 1].relationId;
	throw new zl(e, t.map(function(e) {
		return e.name;
	}));
}
function Ql(e, t) {
	for (var n = Vl(t), r; !(r = n()).done;) {
		var i = r.value;
		if (i.relationId === e) return i.name;
	}
	throw Error(`Sheet relation ID not found: ${e}`);
}
function $l() {
	return {
		"xl/_rels/workbook.xml.rels": {
			name: "filePaths",
			parse: lc
		},
		"xl/workbook.xml": {
			name: "spreadsheetInfo",
			parse: cc
		}
	};
}
function eu(e) {
	var t = {};
	return Kl(t, e.sharedStrings || "xl/sharedStrings.xml", {
		name: "sharedStrings",
		parse: bc,
		fallback: Promise.resolve([])
	}), Kl(t, e.styles || "xl/styles.xml", {
		name: "styles",
		parse: yc,
		fallback: {}
	}), t;
}
function tu(e, t, n) {
	return Object.keys(e.sheets).filter(function(e) {
		return t.includes(e);
	}).reduce(function(t, r) {
		return Gl(Gl({}, t), {}, Kl({}, e.sheets[r], {
			name: r,
			parse: function(e, t) {
				return Xc(e, t, n);
			}
		}));
	}, {});
}
function nu(e, t, n) {
	for (var r = {}, i = function() {
		var i = o[a], s = e[i];
		r[s.name] = t[i] === void 0 ? s.fallback === void 0 ? function() {
			throw new co(`"${i}" file not found inside the \`.xlsx\` file`);
		}() : s.fallback : s.parse(t[i], n);
	}, a = 0, o = Object.keys(e); a < o.length; a++) i();
	for (var s = [], c = function() {
		var e = u[l];
		Sl(r[e]) && s.push(r[e].then(function(t) {
			r[e] = t;
		}));
	}, l = 0, u = Object.keys(r); l < u.length; l++) c();
	return s.length > 0 ? Promise.all(s).then(function() {
		return r;
	}) : r;
}
//#endregion
//#region node_modules/read-excel-file/modules/export/readXlsxFileNode.js
function ru(e, t) {
	return sc(e).then(function(e) {
		return Xl(Va, lo, e, t);
	});
}
//#endregion
//#region electron/main/import/legacy_excel.ts
var X = {
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
}, iu = "feligres", au = "parroquialibros", ou = [
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
], su = [
	"COD PARROQUIA",
	"TIPO DE LIBRO",
	"NUM LIBRO",
	"NOMBRE DE LIBRO",
	"RANGO DE AÑOS DEL LIBRO"
], cu = {
	codigo_parroquia: 0,
	tipo_libro: 1,
	num_libro: 2,
	nombre_libro: 3
}, Z = class extends Error {}, lu = {
	B: "bautismo",
	C: "confirmacion",
	M: "matrimonio"
};
function uu(e, t) {
	return `${e.trim().toUpperCase()}|${t.trim()}`;
}
function Q(e) {
	if (e == null) return null;
	let t = String(e).trim();
	return t === "" || /^-+$/.test(t) ? null : t;
}
function du(e) {
	return String(e).padStart(2, "0");
}
function fu(e) {
	if (e instanceof Date && !Number.isNaN(e.getTime())) return `${e.getUTCFullYear()}-${du(e.getUTCMonth() + 1)}-${du(e.getUTCDate())}`;
	let t = Q(e);
	if (!t) return null;
	let n = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
	if (n) return `${n[1]}-${n[2]}-${n[3]}`;
	let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
	return r ? `${r[3]}-${du(Number(r[2]))}-${du(Number(r[1]))}` : null;
}
function pu(e) {
	let t = fu(e);
	return t ? {
		date: t,
		text: null
	} : {
		date: null,
		text: Q(e)
	};
}
var mu = [
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
function hu(e) {
	return /\.$/.test(e) ? !0 : mu.includes(e.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
}
function gu(e) {
	let t = Q(e);
	if (!t) return null;
	let n = t.split(/\s+/), r = null;
	return n.length > 1 && hu(n[0]) && (r = n.shift()), n.length === 1 ? {
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
function _u(e) {
	let t = e[X.codigo_parroquia];
	return typeof t == "string" && !/^\d+$/.test(t.trim());
}
function vu(e) {
	return String(e ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function yu(e, t, n) {
	if (e.length === 0) throw new Z(`La hoja "${t}" está vacía.`);
	let r = [];
	return e.forEach((e, i) => {
		if (e.length !== n.length) throw new Z(`La hoja "${t}" debe tener ${n.length} columnas y tiene ${e.length}. El archivo no es el exportado por el sistema anterior.`);
		if (i === 0 && _u(e)) {
			n.forEach((n, r) => {
				if (vu(e[r]) !== vu(n)) throw new Z(`El encabezado de la hoja "${t}" no es el del sistema anterior: la columna ${r + 1} dice "${e[r] ?? ""}" y debería decir "${n ?? ""}".`);
			});
			return;
		}
		e.every((e) => Q(e) === null) || r.push({
			row: e,
			fila: i + 1
		});
	}), r;
}
function bu(e, t, n, r, i) {
	let a = Q(e[t]);
	if (!a || !/^\d+$/.test(a)) throw new Z(`La fila ${r} de la hoja "${n}" no tiene un código de parroquia válido.`);
	if (i !== null && a !== i) throw new Z(`El archivo trae partidas de más de una parroquia (códigos ${i} y ${a}). Debe ser el de una sola parroquia.`);
	return a;
}
function xu(e, t, n, r) {
	let i = String(e[t] ?? "").trim().toUpperCase();
	if (!lu[i]) throw new Z(`En la fila ${r} de la hoja "${n}" el tipo de libro no es B, C ni M: las columnas no son las del sistema anterior.`);
	return i;
}
function Su(e) {
	let t = /* @__PURE__ */ new Map(), n = null;
	for (let { row: r, fila: i } of yu(e, au, su)) {
		n = bu(r, cu.codigo_parroquia, au, i, n);
		let e = xu(r, cu.tipo_libro, au, i), a = Q(r[cu.num_libro]);
		if (!a) throw new Z(`La fila ${i} de la hoja "${au}" no tiene el número del libro.`);
		t.set(uu(e, a), Q(r[cu.nombre_libro]) ?? a);
	}
	return {
		codigo_parroquia: n,
		libros: t
	};
}
function Cu(e, t) {
	let n = pu(e[t.fecha_nacimiento]), r = Q(e[t.fecha_aproximada]);
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
var wu = {
	dni: X.dni,
	nombres: X.nombres,
	apellido_paterno: X.apellido_paterno,
	apellido_materno: X.apellido_materno,
	fecha_nacimiento: X.fecha_nacimiento,
	fecha_aproximada: X.fecha_nacimiento_aprox,
	lugar_nacimiento: X.lugar_nacimiento,
	padre: X.padre,
	madre: X.madre
}, Tu = {
	dni: X.novia_dni,
	nombres: X.novia_nombres,
	apellido_paterno: X.novia_apellido_paterno,
	apellido_materno: X.novia_apellido_materno,
	fecha_nacimiento: X.novia_fecha_nacimiento,
	fecha_aproximada: X.novia_fecha_nacimiento_aprox,
	lugar_nacimiento: X.novia_lugar_nacimiento,
	padre: X.novia_padre,
	madre: X.novia_madre
};
function Eu(e, t) {
	let n = [], r = Q(e[X.anotacion_marginal]);
	return r && r.toUpperCase() !== "NINGUNA" && n.push(r), n.push(...t), n.length === 0 ? null : n.join("\n");
}
function Du(e, t, n, r) {
	let i = String(e[X.tipo_libro] ?? "").trim().toUpperCase(), a = lu[i];
	if (!a) return {
		fila: t,
		motivo: "El tipo de libro no es B, C ni M."
	};
	let o = Q(e[X.num_libro]), s = Q(e[X.folio]), c = Q(e[X.numero_registro]);
	if (!o || !s || !c) return {
		fila: t,
		motivo: "Falta el libro, el folio o el número de registro."
	};
	let l = n.get(uu(i, o));
	if (!l) return {
		fila: t,
		motivo: `El libro ${i} ${o} no está en la hoja "${au}".`
	};
	let u = Cu(e, wu);
	if (!u.nombres) return {
		fila: t,
		motivo: "Falta el nombre."
	};
	let d = [], f = pu(e[X.fecha_sacramento]), p = Q(e[X.fecha_sacramento_aprox]) ?? f.text;
	!f.date && p && d.push(`Fecha aproximada del sacramento: ${p}`);
	let m = [u], h = {
		padrino_1: Q(e[X.padrino]),
		padrino_2: Q(e[X.madrina])
	};
	if (a === "matrimonio") {
		let n = Cu(e, Tu);
		if (!n.nombres) return {
			fila: t,
			motivo: "Falta el nombre de la novia."
		};
		m.push(n);
		let r = pu(e[X.fecha_bautizo_novio]), i = pu(e[X.fecha_bautizo_novia]), a = Q(e[X.fecha_bautizo_novio_aprox]) ?? r.text, o = Q(e[X.fecha_bautizo_novia_aprox]) ?? i.text;
		!r.date && a && d.push(`Fecha aproximada del bautizo del esposo: ${a}`), !i.date && o && d.push(`Fecha aproximada del bautizo de la esposa: ${o}`), h = {
			lugar: Q(e[X.lugar_matrimonio]),
			testigo_1: Q(e[X.padrino]),
			testigo_2: Q(e[X.madrina]),
			testigo_3: Q(e[X.testigo_3]),
			testigo_4: Q(e[X.testigo_4]),
			conyuge_1_bautismo_parroquia: Q(e[X.parroquia_bautizo_novio]),
			conyuge_1_bautismo_fecha: r.date,
			conyuge_2_bautismo_parroquia: Q(e[X.parroquia_bautizo_novia]),
			conyuge_2_bautismo_fecha: i.date
		};
	}
	return {
		fila: t,
		codigo_parroquia: Q(e[X.codigo_parroquia]),
		tipo: a,
		libro: l,
		folio: s,
		numero: c,
		fecha_emision: fu(e[X.fecha_ingreso]) ?? f.date ?? r,
		fecha_evento: f.date,
		anotaciones: Eu(e, d),
		celebrante: gu(e[X.celebrante]),
		personas: m,
		detalle: h
	};
}
function Ou(e) {
	return [
		e.tipo,
		e.libro,
		e.folio,
		e.numero
	].map((e) => e.trim().toUpperCase()).join("|");
}
function ku(e, t, n) {
	let r = [], i = [], a = /* @__PURE__ */ new Map(), o = yu(e, iu, ou), s = t.codigo_parroquia;
	for (let { row: e, fila: t } of o) s = bu(e, X.codigo_parroquia, iu, t, s), xu(e, X.tipo_libro, iu, t);
	for (let { row: e, fila: s } of o) {
		let o = Du(e, s, t.libros, n);
		if ("motivo" in o) {
			i.push(o);
			continue;
		}
		let c = Ou(o), l = a.get(c);
		if (l !== void 0) {
			i.push({
				fila: s,
				motivo: `Repite la partida de la fila ${l}.`
			});
			continue;
		}
		a.set(c, s), r.push(o);
	}
	return {
		partidas: r,
		errores: i
	};
}
function Au(e, t) {
	let n = e.find((e) => e.sheet.trim().toLowerCase() === t);
	if (!n) throw new Z(`El archivo no tiene la hoja "${t}". Debe ser el Excel exportado por el sistema anterior, sin cambios.`);
	return n.data;
}
function ju(e, t) {
	let n = Su(Au(e, au));
	return ku(Au(e, iu), n, t);
}
//#endregion
//#region electron/main/controllers/legacy_import.ts
var Mu = "Solo el administrador de la parroquia puede importar partidas.";
function Nu(e) {
	if (e.role !== "admin_parroquia" || !e.parish_id) throw new B(Mu, 403);
	return e.parish_id;
}
function Pu(e) {
	return [
		e.nombres,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" ");
}
function Fu(e, t, n) {
	let r = e.prepare("SELECT tipo, libro, folio, numero FROM sacramentos WHERE parroquia_id = ?").all(t), i = new Set(r.map(Ou)), a = {
		nuevas: [],
		existentes: [],
		errores: n.errores
	};
	for (let e of n.partidas) {
		if (!i.has(Ou(e))) {
			a.nuevas.push(e);
			continue;
		}
		a.existentes.push({
			fila: e.fila,
			tipo: e.tipo,
			libro: e.libro,
			folio: e.folio,
			numero: e.numero,
			nombre: e.personas.map(Pu).join(" y ")
		});
	}
	return a;
}
function Iu(e) {
	return e.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function Lu(e) {
	return Iu([
		e.nombre,
		e.apellido_paterno,
		e.apellido_materno
	].filter((e) => e).join(" "));
}
function Ru(e, t) {
	let n = /* @__PURE__ */ new Map(), r = e.prepare("SELECT id, nombre, apellido_paterno, apellido_materno FROM ministros WHERE parroquia_id = ?").all(t);
	for (let e of r) n.set(Lu(e), e.id);
	let i = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)");
	return (r) => {
		if (!r) return null;
		let a = Lu(r), o = n.get(a);
		if (o !== void 0) return o;
		let s = crypto.randomUUID();
		W(e, "ministro", s, null);
		let c = Number(i.run(s, t, r.titulo, r.nombre, r.apellido_paterno, r.apellido_materno).lastInsertRowid);
		return n.set(a, c), c;
	};
}
function zu(e) {
	return {
		...e,
		cambios: []
	};
}
function Bu(e, t, n, r, i) {
	let a = r.personas.map((t) => Ze(e, n, zu(t))), o = {
		tipo: r.tipo,
		ministro_id: i,
		libro: r.libro,
		folio: r.folio,
		numero: r.numero,
		fecha_emision: r.fecha_emision,
		fecha_evento: r.fecha_evento,
		anotaciones: r.anotaciones
	}, s = crypto.randomUUID();
	W(e, r.tipo, s, null);
	let c = vt(e, s, r.tipo, n, o);
	U(e, c, t.user_id, "importada", [], `Fila ${r.fila} del Excel del sistema anterior`);
	let l = r.detalle;
	if (r.tipo === "matrimonio") {
		e.prepare("INSERT INTO matrimonios\n				(sacramento_id, conyuge_1_id, conyuge_2_id, lugar, testigo_1, testigo_2, testigo_3, testigo_4,\n				 conyuge_1_bautismo_parroquia, conyuge_1_bautismo_fecha, conyuge_2_bautismo_parroquia, conyuge_2_bautismo_fecha)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(c, a[0], a[1], l.lugar, l.testigo_1, l.testigo_2, l.testigo_3, l.testigo_4, l.conyuge_1_bautismo_parroquia, l.conyuge_1_bautismo_fecha, l.conyuge_2_bautismo_parroquia, l.conyuge_2_bautismo_fecha);
		return;
	}
	e.prepare(`INSERT INTO ${ct(r.tipo)} (sacramento_id, persona_id, padrino_1, padrino_2) VALUES (?, ?, ?, ?)`).run(c, a[0], l.padrino_1, l.padrino_2);
}
function Vu(e, t, n) {
	let r = Nu(t);
	return e.transaction(() => {
		let i = Fu(e, r, {
			partidas: n,
			errores: []
		}), a = Ru(e, r);
		for (let n of i.nuevas) Bu(e, t, r, n, a(n.celebrante));
		return {
			importadas: i.nuevas.length,
			omitidas: i.existentes.length
		};
	})();
}
var Hu = null;
function Uu() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function Wu(e) {
	let t;
	try {
		t = await ru(e);
	} catch {
		throw new B("No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) exportado del sistema anterior.", 400);
	}
	try {
		return ju(t, Uu());
	} catch (e) {
		throw e instanceof Z ? new B(e.message, 400) : e;
	}
}
function Gu(e, t) {
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
var Ku = {
	"legacyImport.preview": async (e, { db: n, session: i }) => {
		let a = Nu(i), o = t.getFocusedWindow(), s = {
			title: "Elegir el Excel del sistema anterior",
			properties: ["openFile"],
			filters: [{
				name: "Excel",
				extensions: ["xlsx"]
			}]
		}, c = o ? await r.showOpenDialog(o, s) : await r.showOpenDialog(s);
		if (c.canceled || c.filePaths.length === 0) return { cancelado: !0 };
		let l = c.filePaths[0], u = Fu(n, a, await Wu(l));
		return Hu = {
			token: crypto.randomUUID(),
			parish_id: a,
			records: u.nuevas
		}, {
			cancelado: !1,
			token: Hu.token,
			...Gu(l.split(/[\\/]/).pop() ?? l, u)
		};
	},
	"legacyImport.confirm": (e, { db: t, session: n }) => {
		if (!Hu || e?.token !== Hu.token || Hu.parish_id !== n.parish_id) throw new B("Vuelva a elegir el archivo: la vista previa ya no es válida.", 409);
		let r = Hu.records;
		return Hu = null, Vu(t, n, r);
	}
}, qu = "Ministro no encontrado.", Ju = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function Yu(e) {
	let t = V(e?.nombre), n = V(e?.apellido_paterno), r = V(e?.apellido_materno);
	if (!t || !n || !r) throw new B("Nombre y apellidos son requeridos.", 400);
	return {
		titulo: V(e.titulo),
		nombre: t,
		apellido_paterno: n,
		apellido_materno: r
	};
}
function Xu(e, t, n) {
	let r = e.prepare("SELECT parroquia_id FROM ministros WHERE id = ?").get(n);
	if (!r) throw new B(qu, 404);
	qe(t, r.parroquia_id, "No tiene permiso para modificar ministros de otra parroquia.", "Solo el administrador de la parroquia puede modificar ministros.");
}
function Zu(e, t) {
	let n = e.prepare("SELECT client_id, version FROM ministros WHERE id = ?").get(t);
	W(e, "ministro", n.client_id, n.version);
}
function Qu(e, t) {
	let n = [], r = [];
	t.nombres && (n.push("nombre LIKE ?"), r.push(`%${t.nombres}%`)), t.apellido_paterno && (n.push("apellido_paterno LIKE ?"), r.push(`%${t.apellido_paterno}%`)), t.apellido_materno && (n.push("apellido_materno LIKE ?"), r.push(`%${t.apellido_materno}%`)), Number.isInteger(t.parroquia_id) && (n.push("parroquia_id = ?"), r.push(t.parroquia_id));
	let i = "";
	n.length > 0 && (i = "WHERE " + n.join(" AND "));
	let a = Se(t, e.prepare(`SELECT COUNT(*) AS total FROM ministros ${i}`).get(...r).total), o = Ju[t.orden ?? "nombres"] ?? Ju.nombres;
	return {
		resultados: e.prepare(`SELECT id FROM ministros ${i}
			 ORDER BY ${o} ${Ce(t)}, id
			 LIMIT ? OFFSET ?`).pluck().all(...r, 20, a.offset).map((t) => ot(e, t)),
		total_paginas: a.total_pages
	};
}
function $u(e, t, n) {
	let r = We(t), i = Yu(n), a = crypto.randomUUID();
	return e.transaction(() => {
		W(e, "ministro", a, null);
		let t = e.prepare("INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno) VALUES (?, ?, ?, ?, ?, ?)").run(a, r, i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno);
		return Number(t.lastInsertRowid);
	})();
}
function ed(e, t, n) {
	let r = H(n?.id, qu);
	Xu(e, t, r);
	let i = Yu(n);
	e.transaction(() => {
		Zu(e, r), e.prepare("UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.titulo, i.nombre, i.apellido_paterno, i.apellido_materno, r);
	})();
}
function td(e, t, n) {
	Xu(e, t, n), e.transaction(() => {
		Zu(e, n), e.prepare("UPDATE ministros SET activo = NOT activo WHERE id = ?").run(n);
	})();
}
var nd = {
	"ministers.search": (e, { db: t }) => Qu(t, e),
	"ministers.create": (e, { db: t, session: n }) => ({ id: $u(t, n, e) }),
	"ministers.update": (e, { db: t, session: n }) => (ed(t, n, e), { success: !0 }),
	"ministers.toggleActive": (e, { db: t, session: n }) => (td(t, n, H(e.id, qu)), { success: !0 })
}, rd = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function id(e) {
	return e.prepare("SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC").all();
}
function ad(e, t) {
	return s.join(e, be.logos_folder, `parroquia-${t}.txt`);
}
function od(e, t) {
	try {
		return f(ad(e, t), "utf8");
	} catch {
		return null;
	}
}
function sd(e, t, n, r) {
	qe(t, n, "Solo puede cambiar el logo de su propia parroquia.", "Solo el administrador de la parroquia puede cambiar el logo.");
	let i = ad(e, n);
	if (r === null) {
		h(i, { force: !0 });
		return;
	}
	if (typeof r != "string" || r.length > 4e5 || !rd.test(r)) throw new B("El logo debe ser una imagen PNG, JPG o WEBP de hasta 300 KB.", 400);
	d(s.dirname(i), { recursive: !0 });
	let a = `${i}.tmp`;
	_(a, r, "utf8"), m(a, i);
}
var cd = {
	"parishes.list": (e, { db: t }) => ({ parroquias: id(t) }),
	"parishes.logo": (e, { user_data_folder: t }) => ({ logo: od(t, H(e.parroquia_id)) }),
	"parishes.saveLogo": (e, { session: t, user_data_folder: n }) => (sd(n, t, H(e.parroquia_id), e.logo), { success: !0 })
}, ld = { "app.server": () => ({ servidor: _r() }) }, ud = new Intl.Collator("es", {
	sensitivity: "base",
	numeric: !0
}).compare;
function dd(e, t, n) {
	if (!st(t)) throw new B("Tipo de sacramento no válido.", 404);
	if (!Number.isInteger(n) || n <= 0) throw new B("Debe especificar la parroquia.", 400);
	Ke(e, n, "No tiene permiso para imprimir el índice de otra parroquia.");
}
function fd(e, t, n, r) {
	return dd(t, n, r), e.prepare("SELECT DISTINCT libro FROM sacramentos WHERE tipo = ? AND parroquia_id = ? AND estado = 'vigente'").pluck().all(n, r).sort(ud);
}
function pd(e, t, n, r, i) {
	return dd(t, n, r), e.prepare(`SELECT pe.nombres, pe.apellido_paterno, pe.apellido_materno, s.libro, s.folio, s.numero
			 FROM (${ut(n)}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND (? IS NULL OR s.libro = ?)`).all(r, i, i).sort((e, t) => ud(e.apellido_paterno, t.apellido_paterno) || ud(e.apellido_materno, t.apellido_materno) || ud(e.nombres, t.nombres) || ud(e.libro, t.libro) || ud(e.folio, t.folio) || ud(e.numero, t.numero));
}
var md = {
	"sacramentIndex.books": (e, { db: t, session: n }) => ({ libros: fd(t, n, e.tipo, e.parroquia_id) }),
	"sacramentIndex.entries": (e, { db: t, session: n }) => ({ entradas: pd(t, n, e.tipo, e.parroquia_id, e.libro) })
}, hd = [
	"nombres",
	"apellido_paterno",
	"apellido_materno"
];
function gd(e) {
	if (!st(e)) throw new B("Tipo de sacramento inválido.", 400);
	return e;
}
function _d(e, t) {
	let n = [], r = [];
	Number.isInteger(e.parroquia_id) && (n.push("s.parroquia_id = ?"), r.push(e.parroquia_id));
	for (let i of hd) {
		let a = e[i];
		if (a) {
			n.push(`(${t.map((e) => tt(e, i)).join(" OR ")})`);
			for (let e = 0; e < t.length; e++) r.push(`%${a}%`, `%${a}%`);
		}
	}
	let i = "";
	return n.length > 0 && (i = "WHERE " + n.join(" AND ")), {
		where: i,
		values: r
	};
}
function vd(e, t, n) {
	let r = `FROM ${ct(t)} sub
		JOIN sacramentos s ON s.id = sub.sacramento_id
		JOIN personas pe ON pe.id = sub.persona_id`, i = ["pe"];
	t === "matrimonio" && (r = "FROM matrimonios m\n			JOIN sacramentos s ON s.id = m.sacramento_id\n			JOIN personas c1 ON c1.id = m.conyuge_1_id\n			JOIN personas c2 ON c2.id = m.conyuge_2_id", i = ["c1", "c2"]);
	let { where: a, values: o } = _d(n, i), s = Se(n, e.prepare(`SELECT COUNT(*) AS total ${r} ${a}`).get(...o).total), c = "nombres";
	return n.orden && hd.includes(n.orden) && (c = n.orden), {
		resultados: e.prepare(`SELECT s.id ${r} ${a}
			 ORDER BY ${i[0]}.${c} ${Ce(n)}, s.id
			 LIMIT ? OFFSET ?`).pluck().all(...o, 20, s.offset).map((t) => wt(e, t)),
		total_paginas: s.total_pages
	};
}
function yd(e, t, n) {
	let r = gd(n?.sacramento?.tipo), i = We(t);
	At(n, null);
	let a = t.role === "usuario";
	return e.transaction(() => {
		let o = Pt(e, i, n, !a), s = crypto.randomUUID();
		W(e, r, s, null);
		let c = vt(e, s, r, i, n.sacramento);
		It(e, c, n, o.map((e) => e.id)), U(e, c, t.user_id, "registrada");
		let l = Ft(o);
		if (l.length === 0) return c;
		if (a) {
			let n = l.map((e) => ({
				...e,
				tipo: "nota_marginal"
			}));
			return je(e, c, t.user_id, n), U(e, c, t.user_id, "cambio_pedido", n), c;
		}
		for (let n of o) et(e, t, n.id, c, n.corrections);
		return U(e, c, t.user_id, "correccion", l), c;
	})();
}
function bd(e, t, n) {
	let r = H(n.sacramento?.id);
	gt(e, t, r, n.sacramento.tipo);
	let i = wt(e, r);
	e.transaction(() => {
		jt(e, r);
		let a = Rt(e, t, i, n);
		a.fields.length > 0 && U(e, r, t.user_id, "editada", a.fields), a.corrections.length > 0 && U(e, r, t.user_id, "correccion", a.corrections), Xt(e, t, r, n);
	})();
}
function xd(e, t, n) {
	gd(n?.sacramento?.tipo), t.role === "usuario" ? Gt(e, t, n) : bd(e, t, n);
}
function Sd(e, t, n, r) {
	let i = e.prepare("SELECT tipo FROM sacramentos WHERE id = ?").get(n);
	if (!i) throw new B(bt, 404);
	gt(e, t, n, i.tipo);
	let a = V(r);
	if (!a) throw new B("El motivo de anulación es requerido.", 400);
	e.transaction(() => {
		jt(e, n), e.prepare("UPDATE sacramentos\n			 SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?\n			 WHERE id = ?").run(t.user_id, (/* @__PURE__ */ new Date()).toISOString(), a, n), U(e, n, t.user_id, "anulada", [], a);
	})();
}
function Cd(e, t, n) {
	if (t.role === "usuario") throw new B("Solo un administrador puede ver el historial de una partida.", 403);
	return Ke(t, wt(e, n).sacramento.parroquia_id, "Solo puede ver el historial de las partidas de su parroquia."), Re(e, n);
}
var wd = {
	"sacraments.search": (e, { db: t }) => vd(t, gd(e.tipo), e),
	"sacraments.get": (e, { db: t }) => wt(t, H(e.id)),
	"sacraments.create": (e, { db: t, session: n }) => ({ id: yd(t, n, e) }),
	"sacraments.update": (e, { db: t, session: n }) => (xd(t, n, e), { success: !0 }),
	"sacraments.annul": (e, { db: t, session: n }) => (Sd(t, n, H(e.id), e.motivo_anulacion), { success: !0 }),
	"sacraments.history": (e, { db: t, session: n }) => ({ historial: Cd(t, n, H(e.id)) })
}, Td = [
	"bautismo",
	"confirmacion",
	"matrimonio"
], Ed = 10, Dd = 8, $ = "COALESCE(s.fecha_evento, s.fecha_emision)", Od = `${$} GLOB '[0-9][0-9][0-9][0-9]*'`, kd = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'`, Ad = `${$} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`, jd = [
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
function Md() {
	return {
		bautismo: 0,
		confirmacion: 0,
		matrimonio: 0
	};
}
function Nd(e) {
	return String(e).padStart(2, "0");
}
var Pd = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/;
function Fd(e, t) {
	let [, , n, r] = e, [, , i, a] = t;
	return !n || !i ? null : i === n ? !r || !a ? null : a >= r : i > n;
}
function Id(e, t) {
	let n = Pd.exec(e ?? ""), r = Pd.exec(t);
	if (!n || !r || n[0] !== e) return null;
	let i = Fd(n, r);
	if (i === null) return null;
	let a = Number(r[1]) - Number(n[1]);
	return i || --a, a < 0 || a > 130 ? null : a;
}
function Ld(e, t, n, r = /* @__PURE__ */ new Date()) {
	let i = r.getFullYear(), a = Nd(r.getMonth() + 1), o = `${a}-${Nd(r.getDate())}`, s = e.prepare(`SELECT DISTINCT CAST(substr(${$}, 1, 4) AS INTEGER) AS year
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${Od}`).pluck().all(t), c = [.../* @__PURE__ */ new Set([...s, i])].sort((e, t) => t - e), l = i;
	c.includes(n) && (l = n);
	let u = l === i, d = (n, ...r) => {
		let i = Md(), a = e.prepare(`SELECT s.tipo, COUNT(*) AS total
				 FROM sacramentos s
				 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${n}
				 GROUP BY s.tipo`).all(t, ...r);
		for (let e of a) i[e.tipo] = e.total;
		return i;
	}, f = `${Od} AND substr(${$}, 1, 4) = ?`, p = u ? d(`${Ad} AND substr(${$}, 1, 10) BETWEEN ? AND ?`, `${l - 1}-01-01`, `${l - 1}-${o}`) : d(f, String(l - 1)), m = d(f, String(l)), h = d(`substr(${$}, 1, 7) = ?`, `${i}-${a}`), g = d(Od), _ = {};
	for (let e of Td) _[e] = {
		anio: m[e],
		anterior: p[e],
		mes: h[e],
		historico: g[e]
	};
	let v = [];
	for (let e = 1; e <= 12; e++) v.push({
		mes: e,
		...Md()
	});
	let y = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 6, 2) AS INTEGER) AS mes, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${kd} AND substr(${$}, 1, 4) = ?
			 GROUP BY s.tipo, mes`).all(t, String(l));
	for (let e of y) v[e.mes - 1] && (v[e.mes - 1][e.tipo] = e.total);
	let b = Math.max(Math.min(...c), l - Ed + 1), x = [];
	for (let e = b; e <= l; e++) x.push({
		anio: e,
		...Md()
	});
	let S = e.prepare(`SELECT s.tipo, CAST(substr(${$}, 1, 4) AS INTEGER) AS anio, COUNT(*) AS total
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${Od}
			 GROUP BY s.tipo, anio`).all(t);
	for (let e of S) {
		let t = x.find((t) => t.anio === e.anio);
		t && (t[e.tipo] = e.total);
	}
	let C = e.prepare(`SELECT s.tipo, ${$} AS fecha, pe.fecha_nacimiento
			 FROM (${dt}) sub
			 JOIN sacramentos s ON s.id = sub.sacramento_id
			 JOIN personas pe ON pe.id = sub.persona_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${Od} AND substr(${$}, 1, 4) = ?`).all(t, String(l)), w = {};
	for (let e of Td) {
		let t = jd.map(() => 0), n = 0, r = 0, i = 0;
		for (let a of C) {
			if (a.tipo !== e) continue;
			let o = Id(a.fecha_nacimiento, a.fecha);
			if (o === null) {
				i += 1;
				continue;
			}
			let s = jd.findIndex((e) => o <= e.to);
			t[s] += 1, n += o, r += 1;
		}
		let a = null;
		r > 0 && (a = Math.round(n / r * 10) / 10), w[e] = {
			bandas: t,
			sinDato: i,
			promedio: a
		};
	}
	let ee = e.prepare(`SELECT min.nombre || ' ' || min.apellido_paterno || ' ' || min.apellido_materno AS nombre, COUNT(*) AS total
			 FROM sacramentos s
			 JOIN ministros min ON min.id = s.ministro_id
			 WHERE s.parroquia_id = ? AND s.estado = 'vigente' AND ${Od} AND substr(${$}, 1, 4) = ?
			 GROUP BY min.id
			 ORDER BY total DESC, nombre
			 LIMIT ?`).all(t, String(l), Dd), T = e.prepare(`SELECT
				COALESCE(SUM(s.estado = 'anulado'), 0) AS anuladas,
				COALESCE(SUM(s.estado = 'vigente' AND EXISTS (SELECT 1 FROM cambios_persona c WHERE c.sacramento_id = s.id AND c.estado = 'aprobado')), 0) AS conCorrecciones
			 FROM sacramentos s
			 WHERE s.parroquia_id = ? AND ${Od} AND substr(${$}, 1, 4) = ?`).get(t, String(l));
	return {
		anios: c,
		anio: l,
		esAnioActual: u,
		totales: _,
		mensual: v,
		tendencia: x,
		bandasEdad: jd.map((e) => e.label),
		edades: w,
		ministros: ee,
		registro: T
	};
}
var Rd = { "statistics.get": (e, { db: t }) => Ld(t, H(e.parroquia_id), e.anio) }, zd = {
	"sync.status": () => Si(),
	"sync.run": async () => (await q(), Si()),
	"sync.resolve": async (e) => (await Ci(e.entidad, e.client_id, e.eleccion), Si()),
	"sync.dismissNotice": () => (wi(), { success: !0 })
}, Bd = "Usuario no encontrado.", Vd = {
	nombres: "nombre",
	apellido_paterno: "apellido_paterno",
	apellido_materno: "apellido_materno"
};
function Hd(e) {
	if (!cn(e.role)) throw new B("Solo un administrador puede gestionar usuarios.", 403);
}
function Ud(e, t) {
	return e.prepare("SELECT principal FROM usuarios WHERE id = ?").get(t.user_id)?.principal === 1;
}
function Wd(e, t) {
	return {
		id: t.user_id,
		rol: t.role,
		parroquia_id: t.parish_id,
		principal: Ud(e, t)
	};
}
function Gd(e, t) {
	let n = e.prepare("SELECT id, client_id, rol, parroquia_id, version, activo, principal FROM usuarios WHERE id = ?").get(t);
	if (!n) throw new B(Bd, 404);
	return {
		...n,
		principal: n.principal === 1
	};
}
function Kd(e, t, n) {
	return t === "admin_parroquia" ? +(e.prepare("SELECT 1 FROM usuarios WHERE principal = 1 AND parroquia_id = ?").get(n) === void 0) : 0;
}
function qd(e, t) {
	if ((e || t) && e.length < 8) throw new B("La contraseña debe tener al menos 8 caracteres.", 400);
}
function Jd(e) {
	let t = V(e?.nombre), n = V(e?.apellido_paterno);
	if (!t || !n) throw new B("Nombre y apellido paterno son requeridos.", 400);
	return {
		nombre: t,
		apellido_paterno: n,
		apellido_materno: V(e.apellido_materno) ?? ""
	};
}
function Yd(e, t, n) {
	e.prepare("UPDATE usuarios SET password_hash_pendiente = ? WHERE id = ?").run(n, t), e.prepare("INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (?, ?)\n		 ON CONFLICT (usuario_id) DO UPDATE SET\n			verificador = excluded.verificador,\n			actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run(t, n);
}
function Xd(e, t, n) {
	Hd(t);
	let r = [], i = [], a = n.parroquia_id;
	t.role === "admin_parroquia" && (a = t.parish_id ?? -1), Number.isInteger(a) && (r.push("u.parroquia_id = ?"), i.push(a));
	for (let e of [
		"nombres",
		"apellido_paterno",
		"apellido_materno"
	]) {
		let t = n[e];
		t && (r.push(`u.${Vd[e]} LIKE ?`), i.push(`%${t}%`));
	}
	let o = "";
	r.length > 0 && (o = "WHERE " + r.join(" AND "));
	let s = Se(n, e.prepare(`SELECT COUNT(*) AS total FROM usuarios u ${o}`).get(...i).total), c = Vd[n.orden ?? "nombres"] ?? Vd.nombres;
	return {
		resultados: e.prepare(`SELECT u.id, u.username, u.rol, u.parroquia_id, u.nombre, u.apellido_paterno, u.apellido_materno, u.activo, u.principal,
				p.nombre AS parroquia_nombre
			 FROM usuarios u
			 LEFT JOIN parroquias p ON p.id = u.parroquia_id
			 ${o}
			 ORDER BY u.${c} ${Ce(n)}, u.id
			 LIMIT ? OFFSET ?`).all(...i, 20, s.offset),
		total_paginas: s.total_pages
	};
}
async function Zd(e, t, n) {
	Hd(t);
	let r = Jd(n), i = V(n?.username) ?? "", a = typeof n?.password == "string" ? n.password : "", o = n?.rol ?? "usuario";
	if (!en.test(i)) throw new B("El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.", 400);
	if (qd(a, !0), !tn(o)) throw new B("El rol no es válido.", 400);
	let s = null;
	o !== "admin_general" && (s = t.role === "admin_parroquia" ? t.parish_id : Number.isInteger(n.parroquia_id) ? n.parroquia_id : null);
	let c = {
		rol: o,
		parroquia_id: s
	}, l = nn(c);
	if (l) throw new B(l, 400);
	let u = an(Wd(e, t), c);
	if (u) throw new B(u, 403);
	if (s !== null && !e.prepare("SELECT 1 FROM parroquias WHERE id = ? AND activa = 1").get(s)) throw new B("La parroquia seleccionada no existe.", 400);
	if (e.prepare("SELECT 1 FROM usuarios WHERE username = ? COLLATE NOCASE").get(i)) throw new B("Ese nombre de usuario ya existe.", 409);
	let d = await yn(a), f = crypto.randomUUID();
	return e.transaction(() => {
		let t = e.prepare("SELECT MIN(id) FROM usuarios").pluck().get(), n = Math.min(t ?? 0, 0) - 1;
		return W(e, "usuario", f, null), e.prepare("INSERT INTO usuarios (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo, principal)\n			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)").run(n, f, s, i, o, r.nombre, r.apellido_paterno, r.apellido_materno, Kd(e, o, s)), Yd(e, n, d), n;
	})();
}
async function Qd(e, t, n) {
	let r = tf(n?.id);
	r !== t.user_id && Hd(t);
	let i = Jd(n), a = typeof n.password == "string" ? n.password : "";
	qd(a, !1);
	let o = Gd(e, r), s = on(Wd(e, t), o);
	if (s) throw new B(s, 403);
	let c = a ? await yn(a) : null;
	e.transaction(() => {
		W(e, "usuario", o.client_id, o.version), e.prepare("UPDATE usuarios SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?").run(i.nombre, i.apellido_paterno, i.apellido_materno, r), c && Yd(e, r, c);
	})();
}
function $d(e, t, n) {
	if (Hd(t), n === t.user_id) throw new B("No puede deshabilitar su propia cuenta.", 400);
	let r = Gd(e, n), i = on(Wd(e, t), r);
	if (i) throw new B(i, 403);
	let a = r.activo === 1 ? sn(r) : null;
	if (a) throw new B(a, 400);
	e.transaction(() => {
		W(e, "usuario", r.client_id, r.version), e.prepare("UPDATE usuarios SET activo = NOT activo WHERE id = ?").run(n), r.activo === 1 && e.prepare("DELETE FROM credenciales_locales WHERE usuario_id = ?").run(n);
	})();
}
async function ef(e, t, n) {
	if (Hd(t), typeof n != "string" || !e.prepare("SELECT 1 FROM usuarios WHERE username = ?").get(n)) throw new B(Bd, 404);
	await q();
	let r = e.prepare("SELECT id FROM usuarios WHERE username = ?").pluck().get(n), i = sr()?.token;
	if (!i || r < 0) throw new B("Pasar la marca de principal necesita conexión a internet: la cuenta tiene que estar en el servidor.", 503);
	await yr(`/api/users/${r}/make-principal`, {
		method: "PATCH",
		token: i
	}), await q();
}
function tf(e) {
	if (!Number.isInteger(e) || e === 0) throw new B(Bd, 404);
	return e;
}
var nf = {
	"users.search": (e, { db: t, session: n }) => Xd(t, n, e ?? {}),
	"users.create": async (e, { db: t, session: n }) => {
		let r = await Zd(t, n, e);
		return q(), { id: r };
	},
	"users.update": async (e, { db: t, session: n }) => (await Qd(t, n, e), q(), { success: !0 }),
	"users.toggleActive": (e, { db: t, session: n }) => ($d(t, n, tf(e?.id)), q(), { success: !0 }),
	"users.makePrincipal": async (e, { db: t, session: n }) => (await ef(t, n, e?.username), { success: !0 }),
	"users.me": (e, { db: t, session: n }) => ({ principal: cn(n.role) && Ud(t, n) })
};
//#endregion
//#region electron/main/utils/middleware.ts
async function rf(e, t, r, i) {
	if (Object.hasOwn(t, r)) return t[r](i);
	if (!Object.hasOwn(e, r)) throw new B("Operación no reconocida.", 404);
	let a = {
		session: or(),
		db: G(),
		user_data_folder: n.getPath("userData")
	};
	return e[r](i, a);
}
function af(e, t) {
	i.handle(nr, async (n, r, i) => {
		try {
			return {
				ok: !0,
				data: await rf(e, t, r, i)
			};
		} catch (e) {
			return e instanceof B ? {
				ok: !1,
				message: e.message,
				status: e.status
			} : (fr(`Error en ${r}:`, e), {
				ok: !1,
				message: "Ocurrió un error inesperado.",
				status: 500
			});
		}
	});
}
//#endregion
//#region electron/main/app.ts
function of() {
	af({
		...cd,
		...nd,
		...wd,
		...Da,
		...Rd,
		...md,
		...zd,
		...nf,
		...Qt,
		...Ku,
		...Gi,
		...fa
	}, {
		...Ni,
		...Wi,
		...pa,
		...ld
	});
}
function sf() {
	i.handle("app:get-version", () => n.getVersion()), of();
	try {
		Zn();
	} catch (e) {
		fr("No se pudo abrir la base local:", e);
	}
	Hi();
}
async function cf() {
	mi();
	try {
		await Ti(ye);
	} catch (e) {
		fr("No se pudo sincronizar al cerrar:", e);
	}
}
function lf() {
	tr();
}
//#endregion
//#region electron/main/index.ts
var uf = s.dirname(c(import.meta.url)), df = process.env.VITE_DEV_SERVER_URL, ff = null, pf = !1;
function mf() {
	if (ff = new t({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: s.join(uf, "index.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), process.env.PRELATURA_SECOND_SCREEN === "1") {
		let e = o.getAllDisplays().find((e) => e.id !== o.getPrimaryDisplay().id);
		e && ff.setBounds(e.workArea);
	}
	ff.maximize(), df ? (ff.loadURL(df), ff.webContents.openDevTools()) : ff.loadFile(s.join(uf, "../dist/index.html")), ff.on("closed", () => {
		ff = null;
	});
}
n.whenReady().then(() => {
	sf(), mf();
}), n.on("before-quit", (e) => {
	pf || (e.preventDefault(), pf = !0, cf().finally(() => n.quit()));
}), n.on("will-quit", lf), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
}), n.on("activate", () => {
	t.getAllWindows().length === 0 && mf();
});
//#endregion
export {};
