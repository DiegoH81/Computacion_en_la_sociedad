import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';

const WORKER_HEALTH_CHECK_URL = 'http://localhost:8787/api/parishes';

test.beforeAll(async () => {
  // Este E2E prueba el flujo real contra el Worker. Verificamos
  // primero que el Worker esté arriba, para fallar con un mensaje claro en vez
  // de un timeout confuso esperando un elemento que nunca va a aparecer.
  let workerIsUp = false;
  try {
    const response = await fetch(WORKER_HEALTH_CHECK_URL);
    // Esperamos 401 (sin token) como señal de que el Worker responde, no 200.
    workerIsUp = response.status === 401 || response.status === 200;
  } catch {
    workerIsUp = false;
  }

  if (!workerIsUp) {
    throw new Error(
      'El Worker no está disponible en http://localhost:8787. ' +
        'Este test E2E requiere "npx wrangler dev" corriendo en la carpeta worker/ antes de ejecutarse.',
    );
  }
});

async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js')],
  });
  const window = await app.firstWindow();
  return { app, window };
}

test('usuario de parroquia inicia sesión y llega directo al dashboard', async () => {
  const { app, window } = await launchApp();

  await window.getByPlaceholder('Nombre de usuario').fill('parroco1');
  await window.getByPlaceholder('Contraseña').fill('parroco123');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(window.getByText('¿Qué gestión desea realizar el día de hoy?')).toBeVisible();
  await expect(window.getByText('Parroquia 1', { exact: true })).toBeVisible();

  await app.close();
});

test('admin inicia sesión y debe seleccionar parroquia antes del dashboard', async () => {
  const { app, window } = await launchApp();

  await window.getByPlaceholder('Nombre de usuario').fill('admin');
  await window.getByPlaceholder('Contraseña').fill('admin123');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(window.getByText('Seleccionar Parroquia')).toBeVisible();

  await window.getByRole('combobox').selectOption({ label: 'Parroquia 2' });
  await window.getByRole('button', { name: 'Confirmar' }).click();

  await expect(window.getByText('¿Qué gestión desea realizar el día de hoy?')).toBeVisible();
  await expect(window.getByText('Parroquia 2')).toBeVisible();

  await app.close();
});

test('credenciales incorrectas muestran mensaje de error sin revelar el motivo', async () => {
  const { app, window } = await launchApp();

  await window.getByPlaceholder('Nombre de usuario').fill('admin');
  await window.getByPlaceholder('Contraseña').fill('password-incorrecta');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(window.getByText('Usuario o contraseña incorrectos.')).toBeVisible();

  await app.close();
});