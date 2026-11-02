import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openLocalDatabase } from '../../electron/main/localDb/database';

// El primer login y los datos de referencia vienen del Worker de pruebas (global-setup.ts).

let userData: string;
let app: ElectronApplication | null = null;

async function launchAndLogin(): Promise<Page> {
  app = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js'), `--user-data-dir=${userData}`],
  });
  const window = await app.firstWindow();
  await window.getByPlaceholder('Nombre de usuario').fill('parroco1');
  await window.getByPlaceholder('Contraseña').fill('parroco123');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(window.getByText('¿Qué gestión desea realizar el día de hoy?')).toBeVisible();
  return window;
}

const field = (window: Page, label: string) => window.locator(`label:text-is("${label}") + input`).last();

async function fillRegister(window: Page, registro: string, labelPrefix = 'N°') {
  await field(window, 'Fecha del sacramento').fill('2020-05-10');
  await field(window, `${labelPrefix} libro`).fill('7');
  await field(window, `${labelPrefix} folio`).fill('3');
  await field(window, `${labelPrefix} registro`).fill(registro);
}

async function save(window: Page) {
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
}

test.beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), 'prelatura-sacraments-'));
});

test.afterEach(async () => {
  await app?.close();
  app = null;
  rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('bautismo: se crea, se corrige y se encuentra por el nombre anterior tras reiniciar', async () => {
  let window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '501', 'N° de');
  await field(window, 'DNI').fill('12345678');
  await field(window, 'Nombres').fill('Diago');
  await field(window, 'Apellido paterno').fill('Quispe');
  await field(window, 'Apellido materno').fill('Mamani');
  await window.getByRole('checkbox', { name: 'Prefiere edad', exact: true }).check();
  await window.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('30');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: día' }).selectOption('15');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: mes' }).selectOption('08');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: año' }).selectOption('2001');
  await window.getByPlaceholder('Buscar celebrante...').fill('Braulio');
  await window.getByRole('button', { name: /Braulio Guido/ }).click();
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('textbox', { name: 'Notas marginales' }).fill('Nota de bautismo');
  await save(window);
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 501' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('12345678');
  await expect(window.getByRole('spinbutton', { name: 'Edad', exact: true })).toHaveValue('30');
  await expect(window.getByRole('combobox', { name: 'Fecha de bautizo: mes' })).toHaveValue('08');
  await expect(window.getByPlaceholder('Buscar celebrante...')).toHaveValue(/Braulio Guido/);
  await expect(window.getByRole('textbox', { name: 'Notas marginales' })).toHaveValue('Nota de bautismo');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');
  await expect(window.getByRole('dialog').getByText('Creado en:').locator('+ span')).not.toBeEmpty();
  await field(window, 'Nombres').fill('Diego');
  await save(window);
  await expect(window.getByRole('cell', { name: 'Diego' })).toBeVisible();

  await app?.close();
  window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await expect(window.getByRole('cell', { name: 'Diego' })).toBeVisible();

  await window.locator('form').getByRole('textbox').first().fill('Diago');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByRole('cell', { name: 'Diego' })).toBeVisible();

  await window.locator('form').getByRole('textbox').first().fill('Pablo');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByText('No se encontraron partidas.')).toBeVisible();
});

test('confirmación: conserva edad y DNI, y se puede anular con motivo', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de confirmación' }).click();

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '502', 'N° de');
  await field(window, 'DNI').fill('87654321');
  await field(window, 'Nombres').fill('Lucia');
  await field(window, 'Apellido paterno').fill('Flores');
  await field(window, 'Apellido materno').fill('Rojas');
  await window.getByRole('checkbox', { name: 'Prefiere edad', exact: true }).check();
  await window.getByRole('spinbutton', { name: 'Edad', exact: true }).fill('15');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: día' }).selectOption('20');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: mes' }).selectOption('11');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: año' }).selectOption('2015');
  await window.getByPlaceholder('Buscar celebrante...').fill('Braulio');
  await window.getByRole('button', { name: /Braulio Guido/ }).click();
  await field(window, 'Padrino').fill('Mario');
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('textbox', { name: 'Notas marginales' }).fill('Nota de confirmación');
  await save(window);

  await window.getByRole('checkbox', { name: 'Seleccionar partida 502' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('87654321');
  await expect(window.getByRole('spinbutton', { name: 'Edad', exact: true })).toHaveValue('15');
  await expect(window.getByRole('combobox', { name: 'Fecha de confirmación: mes' })).toHaveValue('11');
  await expect(window.getByPlaceholder('Buscar celebrante...')).toHaveValue(/Braulio Guido/);
  await expect(field(window, 'Padrino')).toHaveValue('Mario');
  await expect(window.getByRole('textbox', { name: 'Notas marginales' })).toHaveValue('Nota de confirmación');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

  await window.getByRole('button', { name: 'Anular', exact: true }).click();
  await window.locator('textarea').fill('Registro duplicado');
  await window.getByRole('button', { name: 'Confirmar anulación' }).click();
  await expect(window.getByText('Anulado', { exact: true })).toBeVisible();
});

test('ministros: se crean en la PC y quedan disponibles en las partidas tras reiniciar', async () => {
  let window = await launchAndLogin();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar ministro' }).click();

  await window.getByRole('button', { name: '+ Agregar ministro' }).click();
  await field(window, 'Título').fill('Mons.');
  await field(window, 'Nombre').fill('Bartolome');
  await field(window, 'Apellido paterno').fill('Local');
  await field(window, 'Apellido materno').fill('Prueba');
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('cell', { name: 'Bartolome' })).toBeVisible();

  await app?.close();
  window = await launchAndLogin();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar ministro' }).click();
  await expect(window.getByRole('cell', { name: 'Bartolome' })).toBeVisible();
  await expect(window.getByRole('cell', { name: 'Braulio' })).toBeVisible();

  const row = window.getByRole('row', { name: /Bartolome/ });
  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'Título')).toHaveValue('Mons.');
});

test('cola: lo que se guarda por pantalla queda pendiente, y al cerrar se sube', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '504', 'N° de');
  await field(window, 'Nombres').fill('Rosa');
  await field(window, 'Apellido paterno').fill('Vargas');
  await field(window, 'Apellido materno').fill('Rojas');
  await save(window);

  await window.getByRole('checkbox', { name: 'Seleccionar partida 504' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await field(window, 'Nombres').fill('Rosario');
  await save(window);

  const encryptedKey = readFileSync(path.join(userData, 'prelatura-local.key')).toString('base64');
  const key = await app!.evaluate(
    ({ safeStorage }, encrypted) => safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
    encryptedKey,
  );
  const readQueue = () => {
    const db = openLocalDatabase(path.join(userData, 'prelatura-local.db'), key);
    const queue = db.prepare('SELECT entidad, version_base FROM sync_cola').all();
    db.close();
    return queue;
  };
  expect(readQueue()).toEqual([{ entidad: 'bautismo', version_base: null }]);

  await app!.close();
  app = null;
  expect(readQueue()).toEqual([]);
});

test('matrimonio: registra a los dos cónyuges sin DNI de los padres', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await expect(window.getByText('DNI padre')).toHaveCount(0);
  await fillRegister(window, '503', 'N° de');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Carlos');
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Elena');

  // La partida física puede traer solo la edad: se registra una de las dos.
  await window.getByRole('checkbox', { name: 'Prefiere edad del esposo' }).check();
  await window.getByRole('spinbutton', { name: 'Edad del esposo' }).fill('30');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: día' }).selectOption('29');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: mes' }).selectOption('02');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: año' }).selectOption('1996');
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('textbox', { name: 'Notas marginales' }).fill('Nota de prueba');
  await save(window);

  await expect(window.getByRole('cell', { name: /Carlos/ })).toBeVisible();
  await expect(window.getByRole('cell', { name: /Elena/ })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 503' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  const dialog = window.getByRole('dialog', { name: 'Editar partida' });
  await expect(dialog.getByRole('textbox', { name: 'Nombres de la esposa' })).toHaveValue('Elena');
  await expect(dialog.getByRole('spinbutton', { name: 'Edad del esposo' })).toHaveValue('30');
  await expect(dialog.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: día' })).toHaveValue('29');
  await expect(dialog.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: año' })).toHaveValue('1996');
  await expect(dialog.getByRole('textbox', { name: 'Notas marginales' })).toHaveValue('Nota de prueba');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');
  await expect(dialog.getByText('Creado en:').locator('+ span')).not.toBeEmpty();
});
