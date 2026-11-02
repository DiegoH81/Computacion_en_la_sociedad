import type { LocalDatabase } from '../localDb/database';
import type { SacramentType } from './common';
import { isQueued, removeFromQueue, type SyncEntity } from './syncQueue';

export interface PersonaSync {
  client_id: string;
  dni: string | null;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  fecha_nacimiento: string | null;
  edad: number | null;
  lugar_nacimiento: string | null;
  padre: string | null;
  madre: string | null;
}

export interface CambioSync {
  client_id: string;
  persona_client_id: string;
  usuario_id: number;
  campo_cambio: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  fecha_cambio: string;
}

export interface PartidaSync {
  tipo: SacramentType;
  client_id: string;
  parroquia_id: number;
  ministro_client_id: string | null;
  libro: string;
  folio: string;
  numero: string;
  fecha_emision: string;
  fecha_evento: string | null;
  anotaciones: string | null;
  estado: 'vigente' | 'anulado';
  anulado_por_usuario_id: number | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
  personas: PersonaSync[];
  detalle: Record<string, string | null>;
  cambios: CambioSync[];
}

export interface MinistroSync {
  client_id: string;
  parroquia_id: number;
  titulo: string | null;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  activo: number;
  version?: number;
  updated_at?: string;
}

const TIPOS: Record<SacramentType, { tabla: string; personas: string[]; detalle: string[] }> = {
  bautismo: { tabla: 'bautismos', personas: ['persona_id'], detalle: ['padrino_1', 'padrino_2'] },
  confirmacion: { tabla: 'confirmaciones', personas: ['persona_id'], detalle: ['padrino_1', 'padrino_2'] },
  matrimonio: {
    tabla: 'matrimonios',
    personas: ['conyuge_1_id', 'conyuge_2_id'],
    detalle: [
      'lugar',
      'testigo_1',
      'testigo_2',
      'testigo_3',
      'testigo_4',
      'conyuge_1_bautismo_parroquia',
      'conyuge_1_bautismo_fecha',
      'conyuge_2_bautismo_parroquia',
      'conyuge_2_bautismo_fecha',
    ],
  },
};

const CAMPOS_PERSONA = [
  'dni',
  'nombres',
  'apellido_paterno',
  'apellido_materno',
  'fecha_nacimiento',
  'edad',
  'lugar_nacimiento',
  'padre',
  'madre',
] as const;

/** Los triggers suben version si no cambia: pasar por -1 permite fijar la que dicta el servidor. */
function prepareVersionWrite(db: LocalDatabase, tabla: 'sacramentos' | 'ministros', id: number): void {
  db.prepare(`UPDATE ${tabla} SET version = -1 WHERE id = ?`).run(id);
}

/** Fija la versión que asignó el servidor sin tocar los datos. */
export function setServerVersion(db: LocalDatabase, entidad: SyncEntity, clientId: string, version: number): void {
  const tabla = entidad === 'ministro' ? 'ministros' : 'sacramentos';
  db.prepare(`UPDATE ${tabla} SET version = ? WHERE client_id = ? AND version <> ?`).run(version, clientId, version);
}

export function readMinistro(db: LocalDatabase, clientId: string): MinistroSync {
  return db
    .prepare(
      `SELECT client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo
       FROM ministros WHERE client_id = ?`,
    )
    .get(clientId) as MinistroSync;
}

export function readPartida(db: LocalDatabase, clientId: string): PartidaSync {
  const fila = db
    .prepare(
      `SELECT s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
              s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en,
              s.motivo_anulacion
       FROM sacramentos s LEFT JOIN ministros m ON m.id = s.ministro_id
       WHERE s.client_id = ?`,
    )
    .get(clientId) as Omit<PartidaSync, 'personas' | 'detalle' | 'cambios'> & { id: number };

  const config = TIPOS[fila.tipo];
  const subtipo = db.prepare(`SELECT * FROM ${config.tabla} WHERE sacramento_id = ?`).get(fila.id) as Record<
    string,
    string | number | null
  >;

  const leerPersona = db.prepare(`SELECT client_id, ${CAMPOS_PERSONA.join(', ')} FROM personas WHERE id = ?`);
  const personas = config.personas.map((columna) => leerPersona.get(subtipo[columna]) as PersonaSync);

  const detalle: Record<string, string | null> = {};
  for (const columna of config.detalle) detalle[columna] = subtipo[columna] as string | null;

  const cambios = db
    .prepare(
      `SELECT c.client_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio,
              c.valor_anterior, c.valor_nuevo, c.fecha_cambio
       FROM cambios_persona c JOIN personas p ON p.id = c.persona_id
       WHERE c.sacramento_id = ? ORDER BY c.id`,
    )
    .all(fila.id) as CambioSync[];

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
    cambios,
  };
}

/** La partida cita algo que aún no está en esta base: se resuelve volviendo a descargar la referencia. */
export class MissingReferenceError extends Error {}

function upsertPersona(db: LocalDatabase, parroquiaId: number, persona: PersonaSync): number {
  const valores = CAMPOS_PERSONA.map((campo) => persona[campo]);
  const actual = db.prepare('SELECT id FROM personas WHERE client_id = ?').get(persona.client_id) as { id: number } | undefined;

  if (actual) {
    db.prepare(`UPDATE personas SET ${CAMPOS_PERSONA.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
      ...valores,
      actual.id,
    );
    return actual.id;
  }

  return Number(
    db
      .prepare(
        `INSERT INTO personas (client_id, parroquia_id, ${CAMPOS_PERSONA.join(', ')})
         VALUES (?, ?, ${CAMPOS_PERSONA.map(() => '?').join(', ')})`,
      )
      .run(persona.client_id, parroquiaId, ...valores).lastInsertRowid,
  );
}

function localMinisterId(db: LocalDatabase, clientId: string | null): number | null {
  if (!clientId) return null;
  const fila = db.prepare('SELECT id FROM ministros WHERE client_id = ?').get(clientId) as { id: number } | undefined;
  if (!fila) throw new MissingReferenceError(`Ministro desconocido: ${clientId}`);
  return fila.id;
}

/**
 * Guarda una partida descargada. Por defecto no toca la que tenga cambios sin subir: esos se
 * resuelven en el servidor, y si otra PC la cambió quedará marcada como conflicto.
 */
export function applyPartida(db: LocalDatabase, partida: PartidaSync, options: { force?: boolean } = {}): void {
  const version = partida.version ?? 1;
  const local = db.prepare('SELECT id, version FROM sacramentos WHERE client_id = ?').get(partida.client_id) as
    | { id: number; version: number }
    | undefined;

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
    partida.updated_at ?? new Date().toISOString(),
  ];

  let sacramentoId: number;
  if (local) {
    sacramentoId = local.id;
    prepareVersionWrite(db, 'sacramentos', local.id);
    db.prepare(
      `UPDATE sacramentos SET
         ministro_id = ?, libro = ?, folio = ?, numero = ?, fecha_emision = ?, fecha_evento = ?, anotaciones = ?,
         estado = ?, anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?, version = ?, updated_at = ?
       WHERE id = ?`,
    ).run(...cabecera, local.id);
  } else {
    sacramentoId = Number(
      db
        .prepare(
          `INSERT INTO sacramentos
             (ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
              estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, updated_at,
              client_id, tipo, parroquia_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...cabecera, partida.client_id, partida.tipo, partida.parroquia_id).lastInsertRowid,
    );
  }

  const columnas = [...config.personas, ...config.detalle];
  db.prepare(
    `INSERT INTO ${config.tabla} (sacramento_id, ${columnas.join(', ')})
     VALUES (?, ${columnas.map(() => '?').join(', ')})
     ON CONFLICT (sacramento_id) DO UPDATE SET ${columnas.map((c) => `${c} = excluded.${c}`).join(', ')}`,
  ).run(sacramentoId, ...personaIds, ...config.detalle.map((columna) => partida.detalle[columna] ?? null));

  const idPersona = new Map(partida.personas.map((persona, i) => [persona.client_id, personaIds[i]]));
  const insertarCambio = db.prepare(
    `INSERT INTO cambios_persona
       (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (client_id) DO NOTHING`,
  );
  for (const cambio of partida.cambios) {
    insertarCambio.run(
      cambio.client_id,
      idPersona.get(cambio.persona_client_id),
      sacramentoId,
      cambio.usuario_id,
      cambio.campo_cambio,
      cambio.valor_anterior,
      cambio.valor_nuevo,
      cambio.fecha_cambio,
    );
  }

  if (options.force) {
    // Se descartó la versión local: sus correcciones sin subir ya no corresponden a la partida.
    db.prepare(
      `DELETE FROM cambios_persona
       WHERE sacramento_id = ? AND client_id NOT IN (SELECT value FROM json_each(?))`,
    ).run(sacramentoId, JSON.stringify(partida.cambios.map((cambio) => cambio.client_id)));
    removeFromQueue(db, partida.tipo, partida.client_id);
  }
}

const CAMPOS_MINISTRO = ['titulo', 'nombre', 'apellido_paterno', 'apellido_materno', 'activo'] as const;

export function applyMinistro(db: LocalDatabase, ministro: MinistroSync, options: { force?: boolean } = {}): void {
  const version = ministro.version ?? 1;
  const local = db
    .prepare(`SELECT id, version, ${CAMPOS_MINISTRO.join(', ')} FROM ministros WHERE client_id = ?`)
    .get(ministro.client_id) as (Pick<MinistroSync, (typeof CAMPOS_MINISTRO)[number]> & { id: number; version: number }) | undefined;

  if (!options.force && isQueued(db, 'ministro', ministro.client_id)) {
    // Las bases de la versión 3 anotaron en la cola ministros que solo descargaron: si son iguales, no hay nada que subir.
    const iguales = local && CAMPOS_MINISTRO.every((campo) => (local[campo] ?? null) === (ministro[campo] ?? null));
    const fila = db
      .prepare('SELECT version_base FROM sync_cola WHERE entidad = ? AND client_id = ?')
      .get('ministro', ministro.client_id) as { version_base: number | null };
    if (!iguales || fila.version_base !== null) return;
    removeFromQueue(db, 'ministro', ministro.client_id);
    setServerVersion(db, 'ministro', ministro.client_id, version);
    return;
  }

  if (!local) {
    db.prepare(
      `INSERT INTO ministros (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      ministro.client_id,
      ministro.parroquia_id,
      ministro.titulo ?? null,
      ministro.nombre,
      ministro.apellido_paterno,
      ministro.apellido_materno,
      ministro.activo,
      version,
      ministro.updated_at ?? new Date().toISOString(),
    );
    return;
  }

  if (options.force || local.version !== version) {
    prepareVersionWrite(db, 'ministros', local.id);
    db.prepare(
      `UPDATE ministros SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, version = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      ministro.titulo ?? null,
      ministro.nombre,
      ministro.apellido_paterno,
      ministro.apellido_materno,
      ministro.activo,
      version,
      ministro.updated_at ?? new Date().toISOString(),
      local.id,
    );
  }
  if (options.force) removeFromQueue(db, 'ministro', ministro.client_id);
}
