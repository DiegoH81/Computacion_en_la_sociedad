import { safeStorage } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function assertSecureStorage(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El sistema operativo no ofrece almacenamiento seguro para la clave.');
  }
}

/** null si falta el archivo o Windows ya no puede descifrarlo, por ejemplo tras reinstalarlo. */
export function readDatabaseKey(keyPath: string): string | null {
  assertSecureStorage();
  if (!existsSync(keyPath)) return null;
  try {
    return safeStorage.decryptString(readFileSync(keyPath));
  } catch {
    return null;
  }
}

export function writeDatabaseKey(keyPath: string, key: string): void {
  assertSecureStorage();
  writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 0o600 });
}
