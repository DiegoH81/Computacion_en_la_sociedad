import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { open_local_database } from '../../electron/main/db/database';
import { chooseYear, completeRequired, field, saveRecord } from './form-helpers';
import { write_legacy_excel, write_xlsx } from './xlsx-fixture';
import { launchApp } from './launch';


let userData: string;
let app: ElectronApplication | null = null;

async function launchAndLogin(): Promise<Page> {
  app = await launchApp(userData);
  const window = await app.firstWindow();
  await window.getByPlaceholder('Nombre de usuario').fill('parroco1');
  await window.getByPlaceholder('Contraseña').fill('parroco123');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(window.getByText('¿Qué gestión desea realizar el día de hoy?')).toBeVisible();
  return window;
}

async function fillRegister(window: Page, registro: string, labelPrefix = 'N°') {
  await field(window, 'Fecha del sacramento').fill('2020-05-10');
  await field(window, `${labelPrefix} libro`).fill('7');
  await field(window, `${labelPrefix} folio`).fill('3');
  await field(window, `${labelPrefix} registro`).fill(registro);
}

const save = saveRecord;

test.beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), 'prelatura-sacraments-'));
});

test.afterEach(async () => {
  await app?.close();
  app = null;
  rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('bautismo: se crea, se corrige por nota marginal sin cambiar la partida, y se encuentra por los dos nombres', async () => {
  let window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '501', 'N° de');
  await field(window, 'DNI').fill('12345678');
  await field(window, 'Nombres').fill('Diago');
  await field(window, 'Apellido paterno').fill('Quispe');
  await field(window, 'Apellido materno').fill('Mamani');
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada', exact: true }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada', exact: true }).fill('30');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: año' }).selectOption('2001');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: mes' }).selectOption('08');
  await window.getByRole('combobox', { name: 'Fecha de bautizo: día' }).selectOption('15');
  await window.getByPlaceholder('Buscar celebrante...').fill('Braulio');
  await window.getByRole('button', { name: /Braulio Guido/ }).click();
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Nota de bautismo');
  await save(window);
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 501' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('12345678');
  await expect(window.getByRole('textbox', { name: 'Fecha aproximada', exact: true })).toHaveValue('30');
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
  // La partida conserva el nombre con que se registró (el que se imprime); el nuevo queda en la nota.
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();

  await app?.close();
  window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();
  await window.getByRole('checkbox', { name: 'Seleccionar partida 501' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'Nombres')).toHaveValue('Diago');
  await expect(window.getByRole('region', { name: 'Anotaciones marginales' })).toContainText('Nombres: Diago → Diego');
  await window.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await window.getByRole('button', { name: 'Sí, cancelar' }).click();

  // Se encuentra por el nombre corregido.
  await window.locator('form').getByRole('textbox').first().fill('Diego');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByRole('cell', { name: 'Diago' })).toBeVisible();

  await window.locator('form').getByRole('textbox').first().fill('Pablo');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByText('No se encontraron partidas.')).toBeVisible();
});

test('confirmación: conserva fecha aproximada y DNI, y se puede anular con motivo', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de confirmación' }).click();

  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '502', 'N° de');
  await field(window, 'DNI').fill('87654321');
  await field(window, 'Nombres').fill('Lucia');
  await field(window, 'Apellido paterno').fill('Flores');
  await field(window, 'Apellido materno').fill('Rojas');
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada', exact: true }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada', exact: true }).fill('15');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: año' }).selectOption('2015');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: mes' }).selectOption('11');
  await window.getByRole('combobox', { name: 'Fecha de confirmación: día' }).selectOption('20');
  await window.getByPlaceholder('Buscar celebrante...').fill('Braulio');
  await window.getByRole('button', { name: /Braulio Guido/ }).click();
  // Al corregir lo escrito el celebrante se sigue encontrando, y un clic afuera cierra la lista.
  const celebrant = window.getByPlaceholder('Buscar celebrante...');
  await celebrant.fill((await celebrant.inputValue()).slice(0, -1));
  await expect(window.getByRole('button', { name: /Braulio Guido/ })).toBeVisible();
  await window.mouse.click(5, 5);
  await expect(window.getByRole('button', { name: /Braulio Guido/ })).toBeHidden();
  await expect(celebrant).toHaveValue(/Braulio Guido/);
  await field(window, 'Padrino').fill('Mario');
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Nota de confirmación');
  await save(window);

  await window.getByRole('checkbox', { name: 'Seleccionar partida 502' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(field(window, 'DNI')).toHaveValue('87654321');
  await expect(window.getByRole('textbox', { name: 'Fecha aproximada', exact: true })).toHaveValue('15');
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
  await expect(window.getByRole('cell', { name: 'Anulada', exact: true })).toBeVisible();

  // Búsqueda avanzada: por número de registro y estado.
  await window.getByRole('button', { name: /Búsqueda avanzada/ }).click();
  // Solo "de": ese registro exacto. La frase de abajo dice en palabras qué se va a buscar.
  await window.getByLabel('Registro', { exact: true }).fill('502');
  await expect(window.getByText(/Se buscarán partidas solo en .*, con registro 502\./)).toBeVisible();
  await window.getByLabel('Estado', { exact: true }).selectOption('vigente');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByText('No se encontraron partidas.')).toBeVisible();
  await window.getByLabel('Estado', { exact: true }).selectOption('anulado');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByRole('cell', { name: 'Lucia' })).toBeVisible();

  // Una partida anulada se rehabilita, también con motivo.
  await window.getByRole('button', { name: 'Rehabilitar', exact: true }).click();
  await window.getByLabel('Motivo para rehabilitar').fill('No era duplicado');
  await window.getByRole('button', { name: 'Confirmar rehabilitación' }).click();
  await expect(window.getByText('No se encontraron partidas.')).toBeVisible();
  await window.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(window.getByRole('cell', { name: 'Vigente', exact: true })).toBeVisible();
  await expect(window.getByRole('button', { name: 'Anular', exact: true })).toBeEnabled();
});

test('ministros: se crean en la PC y quedan disponibles en las partidas tras reiniciar', async () => {
  let window = await launchAndLogin();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar ministro' }).click();

  await window.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await field(window, 'Título').fill('Mons.');
  await field(window, 'Nombre').fill('Bartolome');
  await field(window, 'Apellido paterno').fill('Local');
  await field(window, 'Apellido materno').fill('Prueba');
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('cell', { name: 'Bartolome', exact: true })).toBeVisible();

  await app?.close();
  window = await launchAndLogin();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar ministro' }).click();
  await expect(window.getByRole('cell', { name: 'Bartolome', exact: true })).toBeVisible();
  await expect(window.getByRole('cell', { name: 'Braulio', exact: true })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar ministro Bartolome Local' }).click();
  await window.getByRole('button', { name: 'Editar', exact: true }).click();
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
    const db = open_local_database(path.join(userData, 'prelatura-local.db'), key);
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
  // El lugar del matrimonio viene lleno con la parroquia actual.
  await expect(window.getByText('Lugar de matrimonio:').locator('..').getByRole('textbox')).toHaveValue('Parroquia 1');
  await fillRegister(window, '503', 'N° de');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Carlos');
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Elena');

  // La partida física puede traer solo una fecha aproximada: se registra una de las dos.
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada del esposo' }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada del esposo' }).fill('30');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: año' }).selectOption('1996');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: mes' }).selectOption('02');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento de la esposa: día' }).selectOption('29');
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
  await completeRequired(window);
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('dialog').getByRole('alert')).toContainText('Indique el valor nuevo');
  await window.getByRole('button', { name: 'Quitar' }).first().click();
  await save(window);

  await expect(window.getByRole('cell', { name: /Carlos/ })).toBeVisible();
  await expect(window.getByRole('cell', { name: /Elena/ })).toBeVisible();

  await window.getByRole('checkbox', { name: 'Seleccionar partida 503' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  const dialog = window.getByRole('dialog', { name: 'Editar partida' });
  await expect(dialog.getByRole('textbox', { name: 'Nombres de la esposa' })).toHaveValue('Elena');
  await expect(dialog.getByRole('region', { name: 'Anotaciones marginales' })).toContainText('Nombres de la esposa: Elena → Elenita');
  await expect(dialog.getByRole('textbox', { name: 'Fecha aproximada del esposo' })).toHaveValue('30');
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
  await expect(window.getByRole('cell', { name: 'Eulogio', exact: true })).toBeVisible();

  // Solo se ven los ministros de la parroquia activa: Manuel es de Parroquia 2.
  await expect(window.getByRole('cell', { name: 'Manuel', exact: true })).toHaveCount(0);
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
    // Primero se ofrece imprimir sobre el formato; la constancia completa es la segunda opción.
    await window.getByRole('button', { name: 'Constancia completa' }).click();
    await expect(window.locator('.a4-page img[alt="Logo de la parroquia"]')).toBeVisible();
    return window.locator('.a4-page');
  };

  // También arriba a la izquierda, en el menú principal.
  await backToDashboard();
  await expect(window.locator('header').getByTestId('parish-logo')).toHaveAttribute('src', /^data:image\//);
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '601', 'N° de');
  await field(window, 'Nombres').fill('Nestor');
  await field(window, 'Apellido paterno').fill('Quispe');
  await field(window, 'Apellido materno').fill('Machaca');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: año' }).selectOption('1979');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: mes' }).selectOption('02');
  await window.getByRole('combobox', { name: 'Fecha de nacimiento: día' }).selectOption('25');
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
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada del esposo' }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada del esposo' }).fill('(30 AÑOS AL DIA DE BODA)');
  await save(window);

  page = await printLatest('603');
  await expect(page).toContainText('Constancia de Matrimonio');
  await expect(page).toContainText('Carlos');
  await expect(page).toContainText('Elena');
  // La fecha aproximada es texto libre: sale tal como se escribió.
  await expect(page).toContainText('(30 AÑOS AL DIA DE BODA)');
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

test('estadísticas: resumen por año de la parroquia, con su tabla', async () => {
  const window = await launchAndLogin();

  // Un año sin otras partidas, para que las demás pruebas no alteren los números.
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await field(window, 'Fecha del sacramento').fill('1951-03-10');
  await field(window, 'N° de libro').fill('1');
  await field(window, 'N° de folio').fill('1');
  await field(window, 'N° de registro').fill('901');
  await field(window, 'Nombres').fill('Eusebia');
  await field(window, 'Apellido paterno').fill('Pari');
  await field(window, 'Apellido materno').fill('Luque');
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada', exact: true }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada', exact: true }).fill('35 años');
  await save(window);
  await window.getByRole('button', { name: 'Volver' }).first().click();

  await window.getByRole('button', { name: 'Estadísticas' }).click();
  await chooseYear(window, 1951);

  await expect(window.getByTestId('stat-bautismo')).toHaveText('1');
  await expect(window.getByTestId('stat-confirmacion')).toHaveText('0');
  await expect(window.getByTestId('stat-matrimonio')).toHaveText('0');

  const monthly = window.getByRole('region', { name: 'Partidas por mes en 1951' });
  await expect(monthly).toContainText('Mes con más partidas: marzo (1)');
  await monthly.getByText('Ver como tabla').click();
  await expect(monthly.getByRole('row', { name: 'marzo 1 0 0 1' })).toBeVisible();

  // Pasar sobre una barra muestra el detalle, y también al llegar con el teclado.
  await monthly.getByLabel('marzo: 1 partidas').focus();
  await expect(window.getByRole('status').filter({ hasText: 'marzo de 1951' })).toContainText('Bautismos');

  // Una fecha aproximada es texto libre: no se puede calcular la edad y cuenta como sin dato.
  const ages = window.getByRole('region', { name: 'Edad al recibir el sacramento' });
  await expect(ages).toContainText('Sin dato de edad: Bautismos: 1');
  await expect(ages).toContainText('Sin edades registradas');

  // La tendencia se puede ver dentro del año elegido, mes a mes.
  const trend = window.getByRole('region', { name: 'Tendencia' });
  await expect(trend).toContainText('Hace falta más de un año');
  await trend.getByRole('button', { name: 'Por meses de 1951' }).click();
  await expect(trend).toContainText('De enero de 1951 a diciembre de 1951');
  await trend.getByText('Ver como tabla').click();
  await expect(trend.getByRole('row', { name: 'marzo de 1951 1 0 0' })).toBeVisible();

  // Otro año no cuenta esa partida.
  await chooseYear(window, new Date().getFullYear());
  await expect(window.getByRole('region', { name: 'Partidas por mes en 1951' })).toHaveCount(0);
});

test('datos obligatorios: todos los de la persona menos el DNI, y el celebrante', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  const dialog = window.getByRole('dialog', { name: 'Agregar partida' });
  await expect(dialog).toContainText('Los campos con * son obligatorios.');

  await fillRegister(window, '701', 'N° de');
  await field(window, 'Nombres').fill('Obligada');
  await field(window, 'Apellido paterno').fill('Campos');
  await field(window, 'Apellido materno').fill('Llenos');
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Faltan datos: fecha de nacimiento (o fecha aproximada), lugar de nacimiento, padre, madre.');

  await field(window, 'Lugar de nacimiento').fill('Juli');
  await field(window, 'Padre').fill('Pedro Campos');
  await field(window, 'Madre').fill('Rosa Llenos');
  await window.getByRole('checkbox', { name: 'Prefiere fecha aproximada', exact: true }).check();
  await window.getByRole('textbox', { name: 'Fecha aproximada', exact: true }).fill('(2 AÑOS)');
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Seleccione el celebrante.');

  // Sin DNI se puede guardar.
  await expect(field(window, 'DNI')).toHaveValue('');
  await save(window);
  await expect(window.getByRole('cell', { name: 'Obligada' })).toBeVisible();
});

test('contraseñas: el ojo muestra y oculta lo que se escribe', async () => {
  app = await launchApp(userData);
  const window = await app.firstWindow();
  const password = window.getByPlaceholder('Contraseña');

  await password.fill('parroco123');
  await expect(password).toHaveAttribute('type', 'password');
  await window.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('parroco123');
  await window.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(password).toHaveAttribute('type', 'password');

  // También al crear una cuenta: cada campo tiene su propio ojo.
  await window.getByPlaceholder('Nombre de usuario').fill('parroco1');
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar usuario' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  const form = window.getByRole('dialog', { name: 'Añadir nuevo usuario' });
  await form.getByLabel('Contraseña', { exact: true }).fill('clave-nueva');
  await form.getByLabel('Repetir contraseña', { exact: true }).fill('clave-nueva');
  await expect(form.getByRole('button', { name: 'Mostrar contraseña' })).toHaveCount(2);
  await form.getByRole('button', { name: 'Mostrar contraseña' }).first().click();
  await expect(form.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await expect(form.getByLabel('Repetir contraseña', { exact: true })).toHaveAttribute('type', 'password');
});

test('importación: el Excel del sistema anterior se revisa, se importa una sola vez y rechaza otro formato', async () => {
  const window = await launchAndLogin();
  const excel = path.join(userData, 'feligres.xlsx');
  const wrong = path.join(userData, 'otro.xlsx');
  write_legacy_excel(excel);
  write_xlsx(wrong, [{ name: 'Hoja1', rows: [['NOMBRE', 'APELLIDO'], ['JUANA', 'MAMANI']] }]);
  // El selector de archivos de Windows no se puede manejar: se responde con el archivo elegido.
  const choose = (file: string) =>
    app!.evaluate(({ dialog }, chosen) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [chosen] })) as typeof dialog.showOpenDialog;
    }, file);

  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Importar Excel del sistema anterior' }).click();
  const dialog = window.getByRole('dialog', { name: 'Importar Excel del sistema anterior' });

  // Un archivo que no es el del sistema anterior no se importa.
  await choose(wrong);
  await dialog.getByRole('button', { name: 'Elegir archivo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no tiene la hoja "parroquialibros"');

  await choose(excel);
  await dialog.getByRole('button', { name: 'Elegir archivo' }).click();
  await expect(dialog).toContainText('Nuevas, se van a importar: 3');
  await expect(dialog).toContainText('Filas que no se pudieron leer: 1');
  await expect(dialog).toContainText('Falta el nombre');
  await dialog.getByRole('button', { name: 'Importar 3 partidas' }).click();
  await expect(dialog.getByRole('status')).toContainText('Se importaron 3 partidas.');

  // Otra vez el mismo archivo: ya están todas.
  await dialog.getByRole('button', { name: /Elegir/ }).click();
  await expect(dialog).toContainText('Ya están en el sistema, no se importan: 3');
  await expect(dialog.getByRole('button', { name: 'Importar 0 partidas' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  // El matrimonio queda en el libro con su nombre ("M61"), con el celebrante del Excel.
  await window.getByRole('button', { name: 'Volver' }).first().click();
  await window.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();
  await window.locator('form').getByRole('textbox').first().fill('TOMAS');
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(window.getByRole('row', { name: /TOMAS/ })).toContainText('M61');
  await window.getByRole('checkbox', { name: 'Seleccionar partida 9003' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await expect(window.getByPlaceholder('Buscar celebrante...')).toHaveValue(/PEDRO RAMOS DIAZ/);
});

test('guardar e imprimir: valida, guarda y abre la impresión de lo guardado, al crear y al editar', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  const dialog = window.getByRole('dialog', { name: 'Agregar partida' });
  await fillRegister(window, '671', 'N° de');
  await field(window, 'Nombres').fill('Imprimida');

  // Con datos faltantes no guarda ni imprime: sale el mismo aviso que con "Guardar cambios".
  await window.getByRole('button', { name: 'Guardar e imprimir' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Faltan datos');
  await expect(window.locator('.a4-overlay')).toHaveCount(0);

  await completeRequired(window);
  await window.getByRole('button', { name: 'Guardar e imprimir' }).click();
  await expect(dialog).toBeHidden();
  await expect(window.locator('.a4-overlay [data-slot="nombres"]')).toHaveText('Imprimida');
  await window.getByRole('button', { name: 'Volver' }).last().click();
  await expect(window.getByRole('cell', { name: 'Imprimida' })).toBeVisible();

  // Al editar se imprime con el cambio ya guardado.
  await window.getByRole('checkbox', { name: 'Seleccionar partida 671' }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await field(window, 'Nombres').fill('Reimpresa');
  await window.getByRole('button', { name: 'Guardar e imprimir' }).click();
  await expect(window.locator('.a4-overlay [data-slot="nombres"]')).toHaveText('Reimpresa');
  await window.getByRole('button', { name: 'Volver' }).last().click();
  await expect(window.getByRole('cell', { name: 'Reimpresa' })).toBeVisible();
});

test('imprimir sobre el formato: solo los datos, en su lugar, con el ajuste de esta PC', async () => {
  const window = await launchAndLogin();
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '661', 'N° de');
  await field(window, 'Nombres').fill('Formatina');
  await field(window, 'Padrino').fill('Dionisio Quispe');
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  // Una anotación casi del largo máximo (350 caracteres): el formulario no deja escribir más.
  const notesBox = window.getByRole('textbox', { name: 'Anotaciones', exact: true });
  await notesBox.fill('Nota marginal larga. '.repeat(16));
  await expect(window.getByText('336 / 350 caracteres')).toBeVisible();
  await expect(notesBox).toHaveAttribute('maxlength', '350');
  await save(window);

  const openPrint = async () => {
    const box = window.getByRole('checkbox', { name: 'Seleccionar partida 661' });
    if (!(await box.isChecked())) await box.click();
    await window.getByRole('button', { name: 'Imprimir', exact: true }).click();
  };
  await openPrint();

  // Por defecto: sobre el formato. Solo los datos, sin escudo ni rótulos; el formato se ve de fondo.
  await expect(window.getByRole('button', { name: 'Sobre el formato' })).toHaveAttribute('aria-pressed', 'true');
  const sheet = window.locator('.a4-overlay');
  await expect(sheet.locator('[data-slot="nombres"]')).toHaveText('Formatina');
  await expect(sheet.locator('[data-slot="padrino"]')).toHaveText('Dionisio Quispe');
  await expect(sheet.locator('[data-slot="dia"]')).toHaveText(String(new Date().getDate()));
  await expect(sheet).not.toContainText('Notario Eclesiástico');
  await expect(sheet.locator('img')).toHaveClass(/print:hidden/);

  // La anotación larga entra entera, con letra más chica, hasta la altura del sello parroquial.
  const notes = sheet.locator('[data-slot="anotaciones"]');
  // (1 px de margen por el redondeo)
  expect(await notes.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await expect(notes).toHaveCSS('font-size', /^10\.6/);

  // Lo que está vacío se tacha con una raya; libro, folio y número van al centro de su línea.
  await expect(sheet.locator('[data-slot="madrina"]')).toHaveAttribute('data-empty', 'true');
  await expect(sheet.locator('[data-slot="libro"]')).toHaveCSS('text-align', 'center');

  // El ajuste mueve todo junto y queda guardado en esta PC.
  // Horizontal: + a la derecha. Vertical: + hacia arriba (en la pantalla, y negativa).
  const horizontal = window.getByLabel('Horizontal', { exact: true });
  const vertical = window.getByLabel('Vertical', { exact: true });
  await horizontal.fill('2.5');
  await vertical.fill('1');
  await expect(sheet.locator('[data-slot="nombres"]').locator('..')).toHaveAttribute('style', /translate\(2\.5mm, -1mm\)/);
  await window.getByRole('button', { name: 'Volver' }).last().click();
  await openPrint();
  await expect(horizontal).toHaveValue('2.5');
  await expect(vertical).toHaveValue('1');
  await window.getByRole('button', { name: 'Mover a la derecha' }).click();
  await window.getByRole('button', { name: 'Mover hacia abajo' }).click();
  await expect(horizontal).toHaveValue('3');
  await expect(vertical).toHaveValue('0.5');
  await expect(sheet.locator('[data-slot="nombres"]').locator('..')).toHaveAttribute('style', /translate\(3mm, -0\.5mm\)/);

  // El fondo se puede ocultar.
  await window.getByLabel('Ver el formato').uncheck();
  await expect(sheet.locator('img')).toHaveCount(0);

  // La constancia completa sigue disponible, y los botones de la barra no se mueven al cambiar.
  const printButton = window.getByRole('button', { name: 'Imprimir', exact: true }).last();
  const before = await printButton.boundingBox();
  await window.getByRole('button', { name: 'Constancia completa' }).click();
  await expect(window.locator('.a4-page')).toContainText('Notario Eclesiástico');
  expect(await printButton.boundingBox()).toEqual(before);
});

test('respaldo: se exporta con contraseña y, en una PC nueva, se restaura desde el login con lo que faltaba subir', async () => {
  const window = await launchAndLogin();
  const backupFile = path.join(userData, 'prueba.respaldo');

  await window.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await fillRegister(window, '901', 'N° de');
  await window.getByRole('textbox', { name: 'Nombres del esposo' }).fill('Respaldino');
  await window.getByRole('textbox', { name: 'Apellido paterno del esposo' }).fill('Copia');
  await window.getByRole('textbox', { name: 'Nombres de la esposa' }).fill('Guardada');
  await window.getByRole('textbox', { name: 'Apellido paterno de la esposa' }).fill('Segura');
  await save(window);

  await app!.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog;
  }, backupFile);
  await window.getByRole('button', { name: 'Volver' }).first().click();
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Exportar respaldo' }).click();
  const exportDialog = window.getByRole('dialog', { name: 'Exportar respaldo' });
  await exportDialog.getByLabel('Contraseña del respaldo').fill('clave-respaldo');
  await exportDialog.getByLabel('Repetir contraseña').fill('clave-respaldo');
  await exportDialog.getByRole('button', { name: 'Elegir dónde guardar' }).click();
  await expect(exportDialog.getByText(/Respaldo guardado: \d+ partidas\. Incluye 1 cambio pendiente de subir/)).toBeVisible();
  expect(readFileSync(backupFile, 'utf8')).not.toContain('Respaldino');
  await app!.close();

  // Otra PC, vacía: restaura desde el login y entra con la misma cuenta.
  const otherPc = mkdtempSync(path.join(tmpdir(), 'prelatura-sacraments-'));
  try {
    app = await launchApp(otherPc);
    const fresh = await app.firstWindow();
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog;
    }, backupFile);
    await fresh.getByRole('button', { name: 'Restaurar respaldo' }).click();
    const restoreDialog = fresh.getByRole('dialog', { name: 'Restaurar respaldo' });

    await restoreDialog.getByLabel('Contraseña del respaldo').fill('otra-clave');
    await restoreDialog.getByRole('button', { name: 'Elegir el respaldo' }).click();
    await expect(restoreDialog.getByRole('alert')).toContainText('La contraseña no es la del respaldo');

    await restoreDialog.getByLabel('Contraseña del respaldo').fill('clave-respaldo');
    await restoreDialog.getByRole('button', { name: 'Elegir el respaldo' }).click();
    await expect(restoreDialog.getByText(/Respaldo restaurado: \d+ partidas\. Incluye 1 cambio pendiente de subir/)).toBeVisible();
    await restoreDialog.getByRole('button', { name: 'Ir al inicio de sesión' }).click();
    await expect(fresh.getByRole('button', { name: 'Restaurar respaldo' })).toBeHidden();

    await fresh.getByPlaceholder('Nombre de usuario').fill('parroco1');
    await fresh.getByPlaceholder('Contraseña').fill('parroco123');
    await fresh.getByRole('button', { name: 'Iniciar sesión' }).click();
    await fresh.getByRole('button', { name: 'Índice y partida de matrimonio' }).click();
    await expect(fresh.getByRole('cell', { name: /Respaldino/ })).toBeVisible();
  } finally {
    await app?.close();
    app = null;
    rmSync(otherPc, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
