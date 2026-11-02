import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WORKER_HEALTH_CHECK_URL = `${process.env.PRELATURA_API_URL}/api/parishes`;

test.beforeAll(async () => {
  // Lo levanta tests/e2e/global-setup.ts. Si no responde, se falla con un mensaje claro
  // en vez de un timeout esperando un elemento que nunca va a aparecer.
  let workerIsUp: boolean;
  try {
    const response = await fetch(WORKER_HEALTH_CHECK_URL);
    // Esperamos 401 (sin token) como señal de que el Worker responde, no 200.
    workerIsUp = response.status === 401 || response.status === 200;
  } catch {
    workerIsUp = false;
  }

  if (!workerIsUp) {
    throw new Error(`El Worker de pruebas no está disponible en ${WORKER_HEALTH_CHECK_URL}.`);
  }
});

let userData: string;

test.beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), 'prelatura-auth-'));
});

test.afterEach(() => {
  rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js'), `--user-data-dir=${userData}`],
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

  // Al entrar no se le pide elegir parroquia.
  await expect(window.getByText('Seleccionar Parroquia')).toHaveCount(0);

  // Si quiere consultar otra, puede cambiarla desde el menú lateral de cualquier sección.
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: 'Abrir menú lateral' }).click();
  await window.getByRole('navigation', { name: 'Menú lateral' }).getByRole('button', { name: 'Cambiar parroquia' }).click();
  await expect(window.getByText('Seleccionar Parroquia')).toBeVisible();

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

  // Puede volver a elegir cuando quiera.
  await window.getByRole('button', { name: 'Cambiar parroquia' }).click();
  await expect(window.getByText('Seleccionar Parroquia')).toBeVisible();
  await window.getByRole('combobox').selectOption({ label: 'Parroquia 1' });
  await window.getByRole('button', { name: 'Confirmar' }).click();
  await expect(window.getByText('Parroquia 1', { exact: true })).toBeVisible();

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