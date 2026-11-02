import { app } from 'electron';
import type { LocalDatabase } from './database';
import { readDatabaseKey, writeDatabaseKey } from './key';
import { localPaths, openOrDetect, recoverLocalDatabase, uploadKeyCopy, type KeyStore, type LocalPaths } from './recovery';
import { ServiceError } from '../services/common';
import type { RemoteRequest } from '../services/remote';

const keyStore: KeyStore = { read: readDatabaseKey, write: writeDatabaseKey };

let localDb: LocalDatabase | null = null;
let currentKey: string | null = null;
let needsRecovery = false;
let unavailableMessage = 'La base local no está disponible.';

const paths = (): LocalPaths => localPaths(app.getPath('userData'));

export function initLocalDatabase(): void {
  const result = openOrDetect(paths(), keyStore);
  if (result.status === 'open') {
    localDb = result.db;
    currentKey = result.key;
  } else if (result.status === 'needs-recovery') {
    needsRecovery = true;
    unavailableMessage = 'La base local no se puede abrir. Conéctese a internet e inicie sesión para recuperarla.';
  } else {
    unavailableMessage = result.message;
  }
}

export function getLocalDb(): LocalDatabase {
  if (!localDb) {
    throw new ServiceError(unavailableMessage, 503);
  }
  return localDb;
}

export function localDatabaseNeedsRecovery(): boolean {
  return needsRecovery;
}

export async function recoverLocalDb(request: RemoteRequest, token: string): Promise<void> {
  const recovered = await recoverLocalDatabase(paths(), keyStore, request, token);
  localDb = recovered.db;
  currentKey = recovered.key;
  needsRecovery = false;
}

export async function uploadCurrentKeyCopy(request: RemoteRequest, token: string, parroquiaId: number | null): Promise<void> {
  if (!localDb || !currentKey) return;
  await uploadKeyCopy(localDb, paths(), currentKey, request, token, parroquiaId);
}

export function closeLocalDatabase(): void {
  localDb?.close();
  localDb = null;
  currentKey = null;
}
