import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ServiceError } from '../services/common';
import type { RemoteRequest } from '../services/remote';
import { refreshReference, pullChanges, getSyncValue, setSyncValue } from '../services/syncEngine';
import { NewerDatabaseError, openLocalDatabase, type LocalDatabase } from './database';

const RETENCION_APARTADAS_MS = 30 * 24 * 60 * 60 * 1000;

export const AVISO_RECONSTRUIDA =
  'La base local se reconstruyó desde el servidor. Revise lo registrado recientemente: lo que no se había subido debe volver a digitarse desde el libro.';

export interface KeyStore {
  read(keyPath: string): string | null;
  write(keyPath: string, key: string): void;
}

export interface LocalPaths {
  directory: string;
  database: string;
  key: string;
  device: string;
  tempDatabase: string;
  tempKey: string;
  setAside: string;
}

export function localPaths(directory: string): LocalPaths {
  return {
    directory,
    database: path.join(directory, 'prelatura-local.db'),
    key: path.join(directory, 'prelatura-local.key'),
    device: path.join(directory, 'prelatura-dispositivo.id'),
    tempDatabase: path.join(directory, 'prelatura-reconstruccion.db'),
    tempKey: path.join(directory, 'prelatura-reconstruccion.key'),
    setAside: path.join(directory, 'bases-apartadas'),
  };
}

const newKey = () => randomBytes(32).toString('hex');

/** Identifica a esta PC ante el servidor. No es secreto y debe sobrevivir a la pérdida de la base. */
export function deviceId(paths: LocalPaths): string {
  if (existsSync(paths.device)) return readFileSync(paths.device, 'utf8').trim();
  const id = randomUUID();
  writeFileSync(paths.device, id);
  return id;
}

function isUnreadable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return code.startsWith('SQLITE_NOTADB') || code.startsWith('SQLITE_CORRUPT');
}

export type OpenResult =
  | { status: 'open'; db: LocalDatabase; key: string }
  | { status: 'needs-recovery' }
  | { status: 'failed'; message: string };

/** Abre la base al iniciar. Sin clave válida no se toca nada: la recuperación exige un login online. */
export function openOrDetect(paths: LocalPaths, keys: KeyStore): OpenResult {
  pruneSetAside(paths);
  const key = keys.read(paths.key);

  if (!existsSync(paths.database)) {
    const created = key ?? newKey();
    const db = openLocalDatabase(paths.database, created);
    if (!key) keys.write(paths.key, created);
    return { status: 'open', db, key: created };
  }

  if (!key) return { status: 'needs-recovery' };
  try {
    const db = openLocalDatabase(paths.database, key);
    // Si la base abre, una reconstrucción que quedó a medias ya no hace falta y guarda datos personales.
    removeWithSidecars(paths.tempDatabase);
    rmSync(paths.tempKey, { force: true });
    return { status: 'open', db, key };
  } catch (error) {
    if (error instanceof NewerDatabaseError) {
      return { status: 'failed', message: 'La base local es de una versión más nueva. Actualice la aplicación.' };
    }
    if (isUnreadable(error)) return { status: 'needs-recovery' };
    throw error;
  }
}

function moveWithSidecars(from: string, to: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(from + suffix)) renameSync(from + suffix, to + suffix);
  }
}

function removeWithSidecars(file: string): void {
  for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
}

/** Conserva solo la última base apartada, y como mucho 30 días: guarda datos personales. */
function pruneSetAside(paths: LocalPaths): void {
  if (!existsSync(paths.setAside)) return;
  const bases = readdirSync(paths.setAside)
    .filter((name) => name.endsWith('.db'))
    .sort()
    .reverse();
  bases.forEach((name, index) => {
    const file = path.join(paths.setAside, name);
    if (index > 0 || Date.now() - statSync(file).mtimeMs > RETENCION_APARTADAS_MS) removeWithSidecars(file);
  });
}

function setAside(paths: LocalPaths): void {
  if (!existsSync(paths.database)) return;
  mkdirSync(paths.setAside, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  moveWithSidecars(paths.database, path.join(paths.setAside, `prelatura-local-${stamp}.db`));
  pruneSetAside(paths);
}

async function fetchKeyCopy(paths: LocalPaths, request: RemoteRequest, token: string): Promise<string | null> {
  try {
    const { clave } = await request<{ clave: string }>(`/api/devices/${deviceId(paths)}/key`, { token });
    return clave;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return null;
    // Sin conexión o sin permiso no se puede concluir que la clave se perdió: no se aparta nada.
    throw error;
  }
}

/** La base nueva se arma aparte y solo reemplaza a la anterior cuando la descarga termina. */
async function rebuild(paths: LocalPaths, keys: KeyStore, request: RemoteRequest, token: string): Promise<{ db: LocalDatabase; key: string }> {
  let key = keys.read(paths.tempKey);
  if (!key || !existsSync(paths.tempDatabase)) {
    removeWithSidecars(paths.tempDatabase);
    key = newKey();
    keys.write(paths.tempKey, key);
  }

  let temp: LocalDatabase;
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
    setSyncValue(temp, 'ultima_sync', new Date().toISOString());
    setSyncValue(temp, 'aviso', AVISO_RECONSTRUIDA);
    setSyncValue(temp, 'clave_registrada', null);
  } finally {
    temp.close();
  }

  setAside(paths);
  moveWithSidecars(paths.tempDatabase, paths.database);
  keys.write(paths.key, key);
  rmSync(paths.tempKey, { force: true });

  return { db: openLocalDatabase(paths.database, key), key };
}

/** Requiere un login online: es lo que autoriza al servidor a entregar la copia de la clave. */
export async function recoverLocalDatabase(
  paths: LocalPaths,
  keys: KeyStore,
  request: RemoteRequest,
  token: string,
): Promise<{ db: LocalDatabase; key: string }> {
  if (existsSync(paths.database)) {
    const copy = await fetchKeyCopy(paths, request, token);
    if (copy) {
      try {
        const db = openLocalDatabase(paths.database, copy);
        keys.write(paths.key, copy);
        return { db, key: copy };
      } catch (error) {
        if (!isUnreadable(error)) throw error;
      }
    }
  }
  return rebuild(paths, keys, request, token);
}

interface DeviceKeyResponse {
  parroquiaId: number | null;
}

/** Sube la copia si falta, o si la registró un administrador y ya la usa una parroquia. */
export async function uploadKeyCopy(
  db: LocalDatabase,
  paths: LocalPaths,
  key: string,
  request: RemoteRequest,
  token: string,
  parroquiaId: number | null,
): Promise<void> {
  const registrada = getSyncValue(db, 'clave_registrada');
  const sinParroquia = registrada === 'admin' && parroquiaId !== null;
  if (registrada && !sinParroquia) return;

  const response = await request<DeviceKeyResponse>(`/api/devices/${deviceId(paths)}/key`, {
    method: 'PUT',
    body: { clave: key },
    token,
  });
  setSyncValue(db, 'clave_registrada', response.parroquiaId === null ? 'admin' : 'parroquia');
}
