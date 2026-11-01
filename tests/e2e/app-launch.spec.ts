import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('la aplicación arranca y muestra el título principal', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'prelatura-launch-'));
  const electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js'), `--user-data-dir=${userData}`],
  });

  const window = await electronApp.firstWindow();

  await expect(window.getByText('Sistema de Prelatura')).toBeVisible();

  await electronApp.close();
  rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});