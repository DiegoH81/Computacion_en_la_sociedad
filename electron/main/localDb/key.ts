import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';


export function loadOrCreateDatabaseKey(keyPath: string, databasePath: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El sistema operativo no ofrece almacenamiento seguro para la clave.');
  }

  if (existsSync(keyPath)) {
    return safeStorage.decryptString(readFileSync(keyPath));
  }

  
  if (existsSync(databasePath)) {
    throw new Error('Existe una base local, pero falta el archivo con su clave.');
  }

  const key = randomBytes(32).toString('hex');
  writeFileSync(keyPath, safeStorage.encryptString(key), { flag: 'wx', mode: 0o600 });
  return key;
}
