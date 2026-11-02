import type { LocalDatabase } from '../localDb/database';
import { applyReferenceData, type ReferenceData } from './reference';
import type { RemoteRequest } from './remote';
import { removeFromQueue, type QueueRow, type SyncEntity } from './syncQueue';
import {
  applyMinistro,
  applyPartida,
  MissingReferenceError,
  readMinistro,
  readPartida,
  setServerVersion,
  type MinistroSync,
  type PartidaSync,
} from './syncRecords';


const PUSH_BATCH_SIZE = 20;

type PushResult =
  | { entidad: SyncEntity; client_id: string; estado: 'aplicado'; version: number }
  | { entidad: SyncEntity; client_id: string; estado: 'conflicto'; version: number; motivo: string }
  | { entidad: SyncEntity; client_id: string; estado: 'rechazado'; motivo: string };

interface PullPage {
  partidas: PartidaSync[];
  cursor: number;
  hayMas: boolean;
}

export function getSyncValue(db: LocalDatabase, clave: string): string | null {
  const fila = db.prepare('SELECT valor FROM sync_estado WHERE clave = ?').get(clave) as { valor: string | null } | undefined;
  return fila?.valor ?? null;
}

export function setSyncValue(db: LocalDatabase, clave: string, valor: string | null): void {
  db.prepare(
    `INSERT INTO sync_estado (clave, valor) VALUES (?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
  ).run(clave, valor);
}

export async function refreshReference(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void> {
  applyReferenceData(db, await request<ReferenceData>('/api/reference', { token }));
}

function applyResult(db: LocalDatabase, row: QueueRow, result: PushResult): void {
  db.transaction(() => {
    if (result.estado === 'conflicto' || result.estado === 'rechazado') {
      db.prepare('UPDATE sync_cola SET estado = ?, motivo = ? WHERE id = ?').run(result.estado, result.motivo, row.id);
      return;
    }

    const { revision } = db.prepare('SELECT revision FROM sync_cola WHERE id = ?').get(row.id) as { revision: number };

    if (revision === row.revision) {
      removeFromQueue(db, row.entidad, row.client_id);
      setServerVersion(db, row.entidad, row.client_id, result.version);
    } else {
      db.prepare(`UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE id = ?`).run(result.version, row.id);
    }
  })();
}

export async function pushPending(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void> {
  // Primero los ministros: las partidas pueden citar a uno recién creado.
  const pending = db
    .prepare(`SELECT id FROM sync_cola WHERE estado <> 'conflicto' ORDER BY entidad = 'ministro' DESC, id`)
    .pluck()
    .all() as number[];
  const selectRow = db.prepare('SELECT * FROM sync_cola WHERE id = ?');

  for (let start = 0; start < pending.length; start += PUSH_BATCH_SIZE)
  {
    const rows = pending
      .slice(start, start + PUSH_BATCH_SIZE)
      .map((id) => selectRow.get(id) as QueueRow | undefined)
      .filter((row): row is QueueRow => row !== undefined && row.estado !== 'conflicto');
    if (rows.length === 0) continue;

    const cambios = rows.map((row) => ({
      entidad: row.entidad,
      client_id: row.client_id,
      version_base: row.version_base,
      cola_id: row.cola_id,
      datos: row.entidad === 'ministro' ? readMinistro(db, row.client_id) : readPartida(db, row.client_id),
    }));

    const { resultados } = await request<{ resultados: PushResult[] }>('/api/sync/push', {
      method: 'POST',
      body: { cambios },
      token,
    });

    rows.forEach((row, index) => {
      if (resultados[index]) applyResult(db, row, resultados[index]);
    });
  }
}

function applyPage(db: LocalDatabase, page: PullPage): void {
  db.transaction(() => {
    page.partidas.forEach((partida) => applyPartida(db, partida));
    setSyncValue(db, 'cursor', String(page.cursor));
  })();
}

const isMissingReference = (error: unknown) =>
  error instanceof MissingReferenceError ||
  (error as { code?: string } | null)?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY';


export async function pullChanges(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void> {
  for (;;) {
    const cursor = getSyncValue(db, 'cursor') ?? '0';
    const page = await request<PullPage>(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`, { token });

    try {
      applyPage(db, page);
    } catch (error) {
      if (!isMissingReference(error))
        throw error;

      await refreshReference(db, request, token);
      applyPage(db, page);
    }

    if (!page.hayMas) return;
  }
}

export async function runSync(db: LocalDatabase, request: RemoteRequest, token: string): Promise<void> {
  await refreshReference(db, request, token);
  await pushPending(db, request, token);
  await pullChanges(db, request, token);
  setSyncValue(db, 'ultima_sync', new Date().toISOString());
}

export type ConflictChoice = 'servidor' | 'local';


export async function resolveConflict(
  db: LocalDatabase,
  request: RemoteRequest,
  token: string,
  entidad: SyncEntity,
  clientId: string,
  choice: ConflictChoice,
): Promise<void> {
  const query = `entidad=${encodeURIComponent(entidad)}&client_id=${encodeURIComponent(clientId)}`;
  const { registro } = await request<{ registro: (PartidaSync | MinistroSync) & { version: number } }>(`/api/sync/record?${query}`, { token });

  db.transaction(() => {
    if (choice === 'local') {
      db.prepare(
        `UPDATE sync_cola SET version_base = ?, estado = 'pendiente', motivo = NULL WHERE entidad = ? AND client_id = ?`,
      ).run(registro.version, entidad, clientId);
    } else if (entidad === 'ministro') {
      applyMinistro(db, registro as MinistroSync, { force: true });
    } else {
      applyPartida(db, registro as PartidaSync, { force: true });
    }
  })();
}

export interface SyncItem {
  entidad: SyncEntity;
  client_id: string;
  estado: 'conflicto' | 'rechazado';
  motivo: string | null;
  descripcion: string;
}

function describe(db: LocalDatabase, row: QueueRow): string {
  if (row.entidad === 'ministro') {
    const ministro = db.prepare('SELECT nombre, apellido_paterno FROM ministros WHERE client_id = ?').get(row.client_id) as
      | { nombre: string; apellido_paterno: string }
      | undefined;
    return `Ministro ${ministro?.nombre ?? ''} ${ministro?.apellido_paterno ?? ''}`.trim();
  }
  const partida = db.prepare('SELECT libro, folio, numero FROM sacramentos WHERE client_id = ?').get(row.client_id) as
    | { libro: string; folio: string; numero: string }
    | undefined;
  const tipo = { bautismo: 'Bautismo', confirmacion: 'Confirmación', matrimonio: 'Matrimonio' }[row.entidad];
  return partida ? `${tipo}: libro ${partida.libro}, folio ${partida.folio}, registro ${partida.numero}` : tipo;
}

export function readQueueSummary(db: LocalDatabase) {
  const counts = db.prepare('SELECT estado, COUNT(*) AS total FROM sync_cola GROUP BY estado').all() as {
    estado: QueueRow['estado'];
    total: number;
  }[];
  const total = (estado: QueueRow['estado']) => counts.find((row) => row.estado === estado)?.total ?? 0;

  const problemas = db.prepare(`SELECT * FROM sync_cola WHERE estado <> 'pendiente' ORDER BY id`).all() as QueueRow[];

  return {
    pendientes: total('pendiente'),
    conflictos: total('conflicto'),
    rechazados: total('rechazado'),
    ultimaSync: getSyncValue(db, 'ultima_sync'),
    aviso: getSyncValue(db, 'aviso'),
    items: problemas.map(
      (row): SyncItem => ({
        entidad: row.entidad,
        client_id: row.client_id,
        estado: row.estado as SyncItem['estado'],
        motivo: row.motivo,
        descripcion: describe(db, row),
      }),
    ),
  };
}
