import { test, expect, _electron as electron } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openLocalDatabase } from '../../electron/main/localDb/database';

test('la app crea la base local cifrada y la reabre con la clave guardada', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'prelatura-e2e-'));
  const launch = () =>
    electron.launch({
      args: [path.join(process.cwd(), 'dist-electron/index.js'), `--user-data-dir=${userData}`],
    });
  const databasePath = path.join(userData, 'prelatura-local.db');
  const keyPath = path.join(userData, 'prelatura-local.key');

  try {
    const first = await launch();
    await first.firstWindow();
    expect(existsSync(databasePath)).toBe(true);
    expect(existsSync(keyPath)).toBe(true);
    await first.close();

    const keyBefore = readFileSync(keyPath);
    expect(readFileSync(databasePath).subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
    // La clave tampoco queda en texto plano: lo guardado no es hexadecimal de 64 caracteres.
    expect(keyBefore.toString('utf8')).not.toMatch(/^[0-9a-f]{64}$/i);

    const second = await launch();
    const window = await second.firstWindow();
    await expect(window.getByText('Sistema de Prelatura')).toBeVisible();
    const key = await second.evaluate(
      ({ safeStorage }, encrypted) => safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
      keyBefore.toString('base64'),
    );
    await second.close();

    expect(readFileSync(keyPath).equals(keyBefore)).toBe(true);

    // Con la clave que guardó la app, el archivo abre y ya tiene el esquema completo.
    const db = openLocalDatabase(databasePath, key);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).pluck().all();
    db.close();
    expect(tables).toEqual(expect.arrayContaining(['ministros', 'personas', 'sacramentos', 'cambios_persona']));
    expect(tables).not.toContain('sacerdotes');
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
});
