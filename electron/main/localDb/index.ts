import { app } from 'electron';
import path from 'node:path';
import { openLocalDatabase, type LocalDatabase } from './database';
import { loadOrCreateDatabaseKey } from './key';
import { ServiceError } from '../services/common';

let localDb: LocalDatabase | null = null;

export function initLocalDatabase(): void {
    const userData = app.getPath('userData');
    const databasePath = path.join(userData, 'prelatura-local.db');
    const keyPath = path.join(userData, 'prelatura-local.key');

    localDb = openLocalDatabase(databasePath, loadOrCreateDatabaseKey(keyPath, databasePath));
}

export function getLocalDb(): LocalDatabase {
    if (!localDb) {
        throw new ServiceError('La base local no está disponible.', 503);
    }
    return localDb;
}

export function closeLocalDatabase(): void {
    localDb?.close();
    localDb = null;
}
