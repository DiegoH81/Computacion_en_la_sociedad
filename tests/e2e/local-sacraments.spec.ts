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
  await window.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Nota de bautismo');
  await save(window);
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 501' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('12345678');
  await expect(window.getByRole('spinbutton', { name: 'Edad', exact: true })).toHaveValue('30');
  await expect(window.getByRole('combobox', { name: 'Fecha de bautizo: mes' })).toHaveValue('08');
  await expect(window.getByPlaceholder('Buscar celebrante...')).toHaveValue(/Braulio Guido/);
  await expect(window.getByRole('textbox', { name: 'Anotaciones', exact: true })).toHaveValue('Nota de bautismo');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');
  await expect(window.getByRole('dialog').getByText('Creado en:').locator('+ span')).not.toBeEmpty();
  // La nota marginal ya está abierta porque la partida tiene anotaciones.
  await window.getByRole('button', { name: 'Añadir campo a modificar' }).click();
  await expect(window.getByRole('textbox', { name: 'Campo antiguo' })).toHaveValue('Diago');
  await window.getByRole('textbox', { name: 'Campo nuevo' }).fill('Diego');
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
  await window.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Nota de confirmación');
  await save(window);

  await window.getByRole('checkbox', { name: 'Seleccionar partida 502' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('87654321');
  await expect(window.getByRole('spinbutton', { name: 'Edad', exact: true })).toHaveValue('15');
  await expect(window.getByRole('combobox', { name: 'Fecha de confirmación: mes' })).toHaveValue('11');
  await expect(window.getByPlaceholder('Buscar celebrante...')).toHaveValue(/Braulio Guido/);
  await expect(field(window, 'Padrino')).toHaveValue('Mario');
  await expect(window.getByRole('textbox', { name: 'Anotaciones', exact: true })).toHaveValue('Nota de confirmación');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');

  // Cancelar pide confirmación: "Seguir editando" conserva lo escrito.
  await field(window, 'Padrino').fill('Sin guardar');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toContainText('¿Está seguro de cancelar los cambios?');
  await expect(window.getByRole('button', { name: 'Seguir editando' })).toBeFocused();
  await window.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(window.getByRole('alertdialog')).toBeHidden();
  await expect(field(window, 'Padrino')).toHaveValue('Sin guardar');

  // "Sí, cancelar" cierra el formulario sin guardar.
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(window.getByRole('dialog')).toBeHidden();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'Padrino')).toHaveValue('Mario');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();

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

  await window.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(window.getByRole('alertdialog')).toBeVisible();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
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
  await window.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Nota de prueba');

  // Cada fila elige su campo, y un campo ya elegido no se ofrece en otra fila.
  await window.getByRole('button', { name: 'Añadir campo a modificar' }).click();
  await window.getByRole('button', { name: 'Añadir campo a modificar' }).click();
  const fields = window.getByRole('combobox', { name: 'Campo a modificar' });
  await expect(fields.nth(1).locator('option', { hasText: 'Nombres del esposo' })).toHaveCount(0);
  await fields.nth(1).selectOption({ label: 'Nombres de la esposa' });
  await expect(window.getByRole('textbox', { name: 'Campo antiguo' }).nth(1)).toHaveValue('Elena');
  await window.getByRole('textbox', { name: 'Campo nuevo' }).nth(1).fill('Elenita');

  // Una fila sin valor nuevo no se guarda, y el aviso se ve dentro de la ventana.
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('dialog').getByRole('alert')).toContainText('Indique el valor nuevo');
  await window.getByRole('button', { name: 'Quitar' }).first().click();
  await save(window);

  await expect(window.getByRole('cell', { name: /Carlos/ })).toBeVisible();
  await expect(window.getByRole('cell', { name: /Elenita/ })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 503' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  const dialog = window.getByRole('dialog', { name: 'Editar partida' });
  await expect(dialog.getByRole('textbox', { name: 'Nombres de la esposa' })).toHaveValue('Elenita');
  await expect(dialog.getByRole('region', { name: 'Anotaciones marginales' })).toContainText('Nombres de la esposa: Elena → Elenita');
  await expect(dialog.getByRole('spinbutton', { name: 'Edad del esposo' })).toHaveValue('30');
  await expect(dialog.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: día' })).toHaveValue('29');
  await expect(dialog.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: año' })).toHaveValue('1996');
  await expect(dialog.getByRole('textbox', { name: 'Anotaciones', exact: true })).toHaveValue('Nota de prueba');
  await expect(field(window, 'Parroquia')).toHaveValue('Parroquia 1');
  await expect(dialog.getByText('Creado en:').locator('+ span')).not.toBeEmpty();
});

test('celebrante: se crea desde la partida, sin perder lo escrito, y queda seleccionado', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '505', 'N° de');
  await field(window, 'Nombres').fill('Teodora');
  await field(window, 'Apellido paterno').fill('Lima');
  await field(window, 'Apellido materno').fill('Paz');

  // Al abrir la lista solo aparecen los celebrantes de la parroquia actual.
  const celebrante = window.getByPlaceholder('Buscar celebrante...');
  await celebrante.click();
  await expect(window.getByRole('button', { name: /Braulio Guido/ })).toBeVisible();
  await expect(window.getByRole('button', { name: /Manuel Torres/ })).toHaveCount(0);
  await celebrante.fill('Manuel');
  await expect(window.getByText('Sin resultados.')).toBeVisible();

  // Cancelar el atajo vuelve a la partida sin crear nada.
  await celebrante.fill('Eulogio');
  await expect(window.getByText('Sin resultados.')).toBeVisible();
  await window.getByRole('button', { name: '+ Crear celebrante' }).click();
  await expect(field(window, 'Nombre')).toHaveValue('Eulogio');
  await window.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(field(window, 'Nombres')).toHaveValue('Teodora');

  await window.getByRole('button', { name: '+ Crear celebrante' }).click();
  await expect(field(window, 'Nombre')).toHaveValue('Eulogio');
  // Un clic dentro del formulario de ministro no debe devolver el foco al campo de celebrante.
  await field(window, 'Apellido paterno').click();
  await expect(field(window, 'Apellido paterno')).toBeFocused();
  await field(window, 'Apellido paterno').fill('Ramos');
  await field(window, 'Apellido materno').fill('Vera');
  await window.getByRole('button', { name: 'Guardar cambios' }).last().click();

  // Vuelve a la partida con lo escrito y el nuevo celebrante elegido.
  await expect(window.getByRole('heading', { name: 'Añadir nuevo ministro' })).toBeHidden();
  await expect(field(window, 'Nombres')).toHaveValue('Teodora');
  await expect(celebrante).toHaveValue('Eulogio Ramos Vera');
  await expect(window.getByRole('button', { name: '+ Crear celebrante' })).toBeHidden();
  await save(window);

  await window.getByRole('checkbox', { name: 'Seleccionar partida 505' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(celebrante).toHaveValue('Eulogio Ramos Vera');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();

  // También queda disponible en la lista de ministros.
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar ministro' }).click();
  await expect(window.getByRole('cell', { name: 'Eulogio' })).toBeVisible();
  await expect(window.getByRole('cell', { name: 'Manuel' })).toHaveCount(0);
});

test('constancias: el logo registrado en esta PC sale en las tres, con los datos de la partida', async () => {
  const window = await launchAndLogin();
  const logo = await window.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = '#1d4ed8';
    context.fillRect(0, 0, 900, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });

  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByLabel('Archivo del logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(logo, 'base64') });
  const settingsLogo = window.getByRole('img', { name: 'Logo de la parroquia' });
  await expect(settingsLogo).toBeVisible();
  // Se reduce antes de guardarlo.
  expect(await settingsLogo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(500);

  const backToDashboard = () => window.getByRole('button', { name: 'Volver' }).first().click();
  const printLatest = async (registro: string) => {
    await window.getByRole('checkbox', { name: `Seleccionar partida ${registro}` }).click();
    await window.getByRole('button', { name: 'Imprimir', exact: true }).click();
    await expect(window.locator('.a4-page img[alt="Logo de la parroquia"]')).toBeVisible();
    return window.locator('.a4-page');
  };

  await backToDashboard();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '601', 'N° de');
  await field(window, 'Nombres').fill('Nestor');
  await field(window, 'Apellido paterno').fill('Quispe');
  await field(window, 'Apellido materno').fill('Machaca');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: día' }).selectOption('25');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: mes' }).selectOption('02');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: año' }).selectOption('1979');
  await save(window);

  let page = await printLatest('601');
  await expect(page).toContainText('Constancia de Bautismo');
  await expect(page).toContainText('Parroquia 1');
  await expect(page).toContainText('Nestor');
  await expect(page).toContainText('Quispe Machaca');
  await expect(page).toContainText('25 de febrero de 1979');
  await expect(page).toContainText('Notario Eclesiástico');
  await expect(page).toContainText('Sello de la Curia');
  await window.getByRole('button', { name: 'Volver' }).last().click();

  await backToDashboard();
  await window.getByRole('button', { name: 'Índice y partida de confirmación' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '602', 'N° de');
  await field(window, 'Nombres').fill('Lucia');
  await field(window, 'Apellido paterno').fill('Flores');
  await field(window, 'Apellido materno').fill('Rojas');
  await save(window);

  page = await printLatest('602');
  await expect(page).toContainText('Constancia de Confirmación');
  await expect(page).toContainText('Notario Eclesiástico');
  await expect(page).toContainText('Flores Rojas');
  await window.getByRole('button', { name: 'Volver' }).last().click();

  await backToDashboard();
  await window.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '603', 'N° de');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Carlos');
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Elena');
  await window.getByRole('checkbox', { name: 'Prefiere edad del esposo' }).check();
  await window.getByRole('spinbutton', { name: 'Edad del esposo' }).fill('30');
  await save(window);

  page = await printLatest('603');
  await expect(page).toContainText('Constancia de Matrimonio');
  await expect(page).toContainText('Carlos');
  await expect(page).toContainText('Elena');
  await expect(page).toContainText('30 años');
});

test('duplicados: avisa al llenar si la persona ya tiene ese sacramento, sin impedir guardar', async () => {
  const window = await launchAndLogin();
  const warning = window.getByRole('status', { name: 'Aviso de posible duplicado' });

  await window.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '801', 'N° de');
  await window.getByRole('textbox', { name: 'DNI del esposo' }).fill('44445555');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Rogelio');
  await window.getByRole('textbox', { name: 'Apellido paterno del esposo' }).fill('Condori');
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Marcela');
  await window.getByRole('textbox', { name: 'Apellido paterno de la esposa' }).fill('Apaza');
  await expect(warning).toBeHidden();
  await save(window);

  // Segundo matrimonio del mismo hombre, escrito con un error y en otro registro.
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '802', 'N° de');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Rogelia');
  await window.getByRole('textbox', { name: 'Apellido paterno del esposo' }).fill('Condori');
  await expect(warning).toContainText('Esposo:');
  await expect(warning).toContainText('Rogelio Condori');
  await expect(warning).toContainText('Libro 7 · Folio 3 · N.° 801');

  await window.getByRole('textbox', { name: 'DNI del esposo' }).fill('44445555');
  await expect(warning).toContainText('Alta ·');
  await expect(warning).toContainText('Coincide en DNI');

  // Se puede seguir: puede ser un caso legítimo, como un viudo.
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Lucila');
  await window.getByRole('textbox', { name: 'Apellido paterno de la esposa' }).fill('Ccama');
  await save(window);
  await expect(window.getByRole('cell', { name: /Lucila/ })).toBeVisible();

  // Al editar una partida no se avisa por sí misma, pero sí por la otra.
  await window.getByRole('checkbox', { name: 'Seleccionar partida 801' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(warning).toContainText('N.° 802');
  await expect(warning).not.toContainText('N.° 801');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await window.getByRole('button', { name: 'Volver' }).first().click();

  // Otro sacramento no cuenta como duplicado; el mismo sí.
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await field(window, 'DNI').fill('44445555');
  await field(window, 'Nombres').fill('Rogelio');
  await field(window, 'Apellido paterno').fill('Condori');
  await field(window, 'Apellido materno').fill('Vera');
  await fillRegister(window, '803', 'N° de');
  await window.waitForTimeout(700);
  await expect(warning).toBeHidden();
  await save(window);

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await field(window, 'DNI').fill('44445555');
  await field(window, 'Nombres').fill('Rogelio');
  await expect(warning).toContainText('Esta persona parece tener ya una partida de bautismo');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await window.getByRole('button', { name: 'Volver' }).first().click();

  await window.getByRole('button', { name: 'Índice y partida de confirmación' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await field(window, 'DNI').fill('44445555');
  await field(window, 'Nombres').fill('Rogelio');
  await field(window, 'Apellido paterno').fill('Condori');
  await window.waitForTimeout(700);
  await expect(warning).toBeHidden();
});

test('duplicados: muestra las tres más altas y permite ver todas', async () => {
  const window = await launchAndLogin();
  const warning = window.getByRole('status', { name: 'Aviso de posible duplicado' });
  const rows = warning.getByRole('listitem');
  const fillPerson = async () => {
    await field(window, 'Nombres').fill('Zenobia');
    await field(window, 'Apellido paterno').fill('Paucar');
    await field(window, 'Apellido materno').fill('Yucra');
  };

  await window.getByRole('button', { name: 'Índice y partida de confirmación' }).click();
  for (const registro of ['811', '812', '813', '814']) {
    await window.getByRole('button', { name: '+ Agregar' }).click();
    await fillRegister(window, registro, 'N° de');
    await fillPerson();
    await save(window);
  }

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillPerson();
  await expect(rows).toHaveCount(3);

  await warning.getByRole('button', { name: 'Ver todas (4)' }).click();
  await expect(rows).toHaveCount(4);

  await warning.getByRole('button', { name: 'Ver menos' }).click();
  await expect(rows).toHaveCount(3);
});
