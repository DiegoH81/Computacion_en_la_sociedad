import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('la aplicación arranca y muestra el título principal', async () => {
  const electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js')],
  });

  const window = await electronApp.firstWindow();

  await expect(window.getByText('Sistema de Prelatura')).toBeVisible();

  await electronApp.close();
});