import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { field, saveRecord } from './form-helpers';
import { launchApp } from './launch';


type NetworkMode = 'normal' | 'sin-internet' | 'pierde-respuesta-de-subida';

let mode: NetworkMode = 'normal';
let proxy: Server;
let proxyUrl: string;

function forward(req: IncomingMessage, res: ServerResponse): void {
  if (mode === 'sin-internet') {
    req.socket.destroy();
    return;
  }
  const dropResponse = mode === 'pierde-respuesta-de-subida' && req.url === '/api/sync/push';
  const target = new URL(req.url ?? '/', process.env.PRELATURA_WORKER_URL);
  const upstream = httpRequest(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (response) => {
    if (dropResponse) {
      response.resume();
      response.on('end', () => req.socket.destroy());
      return;
    }
    res.writeHead(response.statusCode ?? 500, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => req.socket.destroy());
  req.pipe(upstream);
}

test.beforeAll(async () => {
  proxy = createServer(forward);
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address() as { port: number };
  proxyUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  proxy.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
});

test.beforeEach(() => {
  mode = 'normal';
  test.setTimeout(120_000);
});

const apps: ElectronApplication[] = [];
const dirs: string[] = [];

test.afterEach(async () => {
  mode = 'sin-internet';
  await Promise.all(apps.splice(0).map((app) => app.close().catch(() => undefined)));
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
});

function newPc(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'prelatura-pc-'));
  dirs.push(dir);
  return dir;
}

async function open(userData: string, env: Record<string, string> = {}): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await launchApp(userData, { ...process.env, PRELATURA_API_URL: proxyUrl, ...env } as Record<string, string>);
  apps.push(app);
  return { app, window: await app.firstWindow() };
}

async function submitLogin(window: Page, username: string, password: string): Promise<void> {
  await window.getByPlaceholder('Nombre de usuario').fill(username);
  await window.getByPlaceholder('Contraseña').fill(password);
  await window.getByRole('button', { name: 'Iniciar sesión' }).click();
}

const DASHBOARD_TEXT = '¿Qué gestión desea realizar el día de hoy?';

async function login(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });
  return pc;
}

async function closeApp(app: ElectronApplication): Promise<void> {
  await app.close();
  apps.splice(apps.indexOf(app), 1);
}

async function goToBaptisms(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Índice y partida de bautismo' }).click();
}

async function createBaptism(window: Page, registro: string, nombre: string): Promise<void> {
  await window.getByRole('button', { name: '+ Agregar' }).click();
  await field(window, 'Fecha del sacramento').fill('2020-05-10');
  await field(window, 'N° de libro').fill('7');
  await field(window, 'N° de folio').fill('3');
  await field(window, 'N° de registro').fill(registro);
  await field(window, 'Nombres').fill(nombre);
  await field(window, 'Apellido paterno').fill('Sincro');
  await field(window, 'Apellido materno').fill('Prueba');
  await saveRecord(window);
}

async function renameBaptism(window: Page, registro: string, nombre: string): Promise<void> {
  await window.getByRole('checkbox', { name: `Seleccionar partida ${registro}` }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await field(window, 'Nombres').fill(nombre);
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
}

/** Corrige el nombre con una nota marginal, que es lo que deja constancia del valor anterior. */
async function correctName(window: Page, registro: string, nombre: string): Promise<void> {
  await window.getByRole('checkbox', { name: `Seleccionar partida ${registro}` }).click();
  await window.getByRole('button', { name: 'Editar' }).click();
  await window.getByRole('button', { name: 'Añadir notas marginales' }).click();
  await window.getByRole('button', { name: 'Añadir campo a modificar' }).click();
  await window.getByRole('textbox', { name: 'Campo nuevo' }).fill(nombre);
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
}

async function searchBaptism(window: Page, nombre: string): Promise<void> {
  await window.locator('form').getByRole('textbox').first().fill(nombre);
  await window.getByRole('button', { name: 'Buscar', exact: true }).click();
}

const badge = (window: Page) => window.getByTitle('Ver el estado de la sincronización');

async function openSyncPage(window: Page): Promise<void> {
  await expect(badge(window)).toBeVisible();
  await badge(window).click();
  await expect(window.getByText('Última sincronización')).toBeVisible();
}

async function syncNow(window: Page): Promise<void> {
  // El de la página, no el indicador de arriba (que también dice "Sincronizando…").
  const main = window.getByRole('main');
  const button = main.getByRole('button', { name: /^Sincroniza(r ahora|ndo…)$/ });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await expect(main.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled({ timeout: 30_000 });
}

const pending = (window: Page) => window.getByTestId('sync-pendientes');

/** Sincronización -> Configuración -> menú principal -> bautismos. */
async function backToBaptisms(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Volver' }).first().click();
  await expect(window.getByRole('button', { name: 'Agregar ministro' })).toBeVisible();
  await window.getByRole('button', { name: 'Volver' }).first().click();
  await expect(window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await goToBaptisms(window);
}

test('lo creado en una PC llega a otra, y una corrección vuelve a la primera', async () => {
  const pcA = await login(newPc());
  await goToBaptisms(pcA.window);
  await createBaptism(pcA.window, '9001', 'Alfonsina');

  await openSyncPage(pcA.window);
  await expect(pending(pcA.window)).toHaveText('1');
  await syncNow(pcA.window);
  await expect(pending(pcA.window)).toHaveText('0');
  await expect(badge(pcA.window)).toHaveText('Sincronizado');

  // Una PC nueva descarga la partida al iniciar sesión, sin haberla creado.
  const pcB = await login(newPc());
  await goToBaptisms(pcB.window);
  await searchBaptism(pcB.window, 'Alfonsina');
  await expect(pcB.window.getByRole('cell', { name: 'Alfonsina' })).toHaveCount(1);

  await correctName(pcB.window, '9001', 'Alfonsa');
  await openSyncPage(pcB.window);
  await syncNow(pcB.window);
  await expect(pending(pcB.window)).toHaveText('0');

  await syncNow(pcA.window);
  await backToBaptisms(pcA.window);
  // La corrección llega con su historial: se encuentra por el nombre corregido (la partida sigue con el original).
  await searchBaptism(pcA.window, 'Alfonsa');
  await expect(pcA.window.getByRole('cell', { name: 'Alfonsina', exact: true })).toHaveCount(1);
});

test('login sin internet: una PC que no conoce al usuario lo pide, y después valida localmente', async () => {
  const userData = newPc();

  // Sin paquete inicial ni ningún ingreso previo, esta PC no conoce al usuario.
  mode = 'sin-internet';
  let pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(/todavía no está en esta PC/)).toBeVisible();
  await expect(pc.window.getByRole('button', { name: 'Restaurar respaldo' })).toBeVisible();
  await closeApp(pc.app);

  mode = 'normal';
  pc = await login(userData);
  await closeApp(pc.app);

  mode = 'sin-internet';
  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'incorrecta');
  await expect(pc.window.getByText('Usuario o contraseña incorrectos.')).toBeVisible();

  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await expect(pc.window.getByText('Parroquia 1', { exact: true })).toBeVisible();
  await expect(badge(pc.window)).toHaveText('Sin conexión');

  // Se trabaja sin servidor...
  await goToBaptisms(pc.window);
  await createBaptism(pc.window, '9002', 'Bernardina');
  await expect(pc.window.getByRole('cell', { name: 'Bernardina' })).toBeVisible();
  // Al guardar se actualiza enseguida, sin esperar la revisión periódica de cada 5 s.
  await expect(badge(pc.window)).toHaveText('1 sin subir', { timeout: 2_000 });

  // ...y al volver internet se sube sin pedir de nuevo la contraseña.
  mode = 'normal';
  await openSyncPage(pc.window);
  await syncNow(pc.window);
  await expect(pending(pc.window)).toHaveText('0');
  await expect(pc.window.getByText('En línea')).toBeVisible();

  const other = await login(newPc());
  await goToBaptisms(other.window);
  await searchBaptism(other.window, 'Bernardina');
  await expect(other.window.getByRole('cell', { name: 'Bernardina' })).toHaveCount(1);
});

test('con internet, un rechazo del servidor no cae a la verificación local', async () => {
  const userData = newPc();
  let pc = await login(userData);
  await closeApp(pc.app);

  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'incorrecta');
  await expect(pc.window.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeHidden();
});

test('si la respuesta del servidor se pierde, el reenvío no duplica ni crea un conflicto', async () => {
  const pc = await login(newPc());
  await goToBaptisms(pc.window);
  await createBaptism(pc.window, '9003', 'Carmelina');
  await renameBaptism(pc.window, '9003', 'Carmela');

  await openSyncPage(pc.window);
  mode = 'pierde-respuesta-de-subida';
  await syncNow(pc.window);
  await expect(pending(pc.window)).toHaveText('1');

  mode = 'normal';
  await syncNow(pc.window);
  await expect(pending(pc.window)).toHaveText('0');
  await expect(pc.window.getByText('Registros por revisar')).toHaveCount(0);

  const other = await login(newPc());
  await goToBaptisms(other.window);
  await searchBaptism(other.window, 'Carmela');
  await expect(other.window.getByRole('cell', { name: 'Carmela', exact: true })).toHaveCount(1);
});

test('una edición simultánea en dos PCs queda como conflicto y se puede resolver', async () => {
  const pcA = await login(newPc());
  await goToBaptisms(pcA.window);
  await createBaptism(pcA.window, '9004', 'Delfina');
  await openSyncPage(pcA.window);
  await syncNow(pcA.window);

  const pcB = await login(newPc());
  await goToBaptisms(pcB.window);
  await searchBaptism(pcB.window, 'Delfina');

  // Ambas editan la misma partida a partir de la misma versión.
  await renameBaptism(pcB.window, '9004', 'Delfina B');
  await backToBaptisms(pcA.window);
  await renameBaptism(pcA.window, '9004', 'Delfina A');

  await openSyncPage(pcA.window);
  await syncNow(pcA.window);
  await expect(pending(pcA.window)).toHaveText('0');

  await openSyncPage(pcB.window);
  await syncNow(pcB.window);
  await expect(pcB.window.getByText('Registros por revisar')).toBeVisible();
  await expect(pcB.window.getByText(/libro 7, folio 3, registro 9004/)).toBeVisible();
  await expect(badge(pcB.window)).toHaveText('Revisar sincronización');

  // El servidor no se pisó. Elegir su versión descarta la edición de esta PC.
  await pcB.window.getByRole('button', { name: 'Usar la versión del servidor' }).click();
  await expect(pcB.window.getByText('Registros por revisar')).toBeHidden();

  await backToBaptisms(pcB.window);
  await searchBaptism(pcB.window, 'Delfina');
  await expect(pcB.window.getByRole('cell', { name: 'Delfina A' })).toHaveCount(1);
  await expect(pcB.window.getByRole('cell', { name: 'Delfina B' })).toHaveCount(0);

  // Conservar lo local: B vuelve a editar, A también, y esta vez gana lo de B.
  await renameBaptism(pcB.window, '9004', 'Delfina B2');
  await backToBaptisms(pcA.window);
  await renameBaptism(pcA.window, '9004', 'Delfina A2');
  await openSyncPage(pcA.window);
  await syncNow(pcA.window);
  await openSyncPage(pcB.window);
  await syncNow(pcB.window);
  await pcB.window.getByRole('button', { name: 'Conservar la de esta PC' }).click();
  await expect(pcB.window.getByText('Registros por revisar')).toBeHidden();
  await expect(pending(pcB.window)).toHaveText('0');

  await syncNow(pcA.window);
  await backToBaptisms(pcA.window);
  await searchBaptism(pcA.window, 'Delfina');
  await expect(pcA.window.getByRole('cell', { name: 'Delfina B2' })).toHaveCount(1);
});

test('al cerrar la app se intenta subir lo pendiente', async () => {
  const pc = await login(newPc());
  await goToBaptisms(pc.window);
  await createBaptism(pc.window, '9005', 'Eulalia');
  await closeApp(pc.app);

  const other = await login(newPc());
  await goToBaptisms(other.window);
  await searchBaptism(other.window, 'Eulalia');
  await expect(other.window.getByRole('cell', { name: 'Eulalia' })).toHaveCount(1);
});

test('si se pierde la clave, un login online la recupera sin perder lo no subido', async () => {
  const userData = newPc();
  let pc = await login(userData);
  await goToBaptisms(pc.window);

  mode = 'sin-internet';
  await createBaptism(pc.window, '9006', 'Fidelia');
  await closeApp(pc.app);

  rmSync(path.join(userData, 'prelatura-local.key'));

  // Sin internet no se puede recuperar, y el archivo no se toca.
  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(/La base local no se puede abrir/)).toBeVisible();
  await closeApp(pc.app);
  expect(existsSync(path.join(userData, 'prelatura-local.db'))).toBe(true);

  mode = 'normal';
  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });
  expect(existsSync(path.join(userData, 'prelatura-local.key'))).toBe(true);
  expect(existsSync(path.join(userData, 'bases-apartadas'))).toBe(false);

  // Se conservó y además se subió al entrar.
  await goToBaptisms(pc.window);
  await searchBaptism(pc.window, 'Fidelia');
  await expect(pc.window.getByRole('cell', { name: 'Fidelia' })).toHaveCount(1);
  await expect(badge(pc.window)).toHaveText('Sincronizado');
});

test('si el archivo está dañado, lo aparta y reconstruye desde el servidor', async () => {
  const userData = newPc();
  let pc = await login(userData);
  await goToBaptisms(pc.window);
  await createBaptism(pc.window, '9007', 'Genoveva');
  await openSyncPage(pc.window);
  await syncNow(pc.window);
  await closeApp(pc.app);

  // Se daña la base y ninguna clave podrá abrirla.
  writeFileSync(path.join(userData, 'prelatura-local.db'), Buffer.alloc(16_384, 7));
  rmSync(path.join(userData, 'prelatura-local.db-wal'), { force: true });
  rmSync(path.join(userData, 'prelatura-local.db-shm'), { force: true });

  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });

  expect(readdirSync(path.join(userData, 'bases-apartadas')).filter((name) => name.endsWith('.db'))).toHaveLength(1);

  await goToBaptisms(pc.window);
  await searchBaptism(pc.window, 'Genoveva');
  await expect(pc.window.getByRole('cell', { name: 'Genoveva' })).toHaveCount(1);

  await openSyncPage(pc.window);
  await expect(pc.window.getByText(/La base local se reconstruyó/)).toBeVisible();
  await pc.window.getByRole('button', { name: 'Entendido' }).click();
  await expect(pc.window.getByText(/La base local se reconstruyó/)).toBeHidden();
});

test('cerrar sesión: vuelve al login sin sincronizar, y otro usuario puede entrar', async () => {
  const userData = newPc();
  const pc = await login(userData);
  const { window } = pc;
  const sessionStatus = () =>
    window.evaluate(async () => {
      const response = await (window as unknown as { electronAPI: { localRequest: (method: string) => Promise<{ ok: boolean; status?: number }> } }).electronAPI.localRequest('sync.status');
      return response.ok ? 'activa' : response.status;
    });

  await goToBaptisms(window);
  await createBaptism(window, '9007', 'Gumersinda');
  expect(await sessionStatus()).toBe('activa');

  // Desde el menú lateral, dentro de una sección.
  await window.getByRole('button', { name: 'Abrir menú lateral' }).click();
  await window.getByRole('navigation', { name: 'Menú lateral' }).getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(window.getByPlaceholder('Nombre de usuario')).toBeVisible();
  expect(await sessionStatus()).toBe(401);

  // Ninguna pantalla con sesión queda accesible.
  await window.evaluate(() => {
    window.location.hash = '#/dashboard';
  });
  await expect(window.getByPlaceholder('Nombre de usuario')).toBeVisible();
  await expect(window.getByText(DASHBOARD_TEXT)).toHaveCount(0);

  // Cerrar sesión no subió nada: otra PC todavía no tiene esa partida.
  const other = await login(newPc());
  await goToBaptisms(other.window);
  await searchBaptism(other.window, 'Gumersinda');
  await expect(other.window.getByRole('cell', { name: 'Gumersinda' })).toHaveCount(0);

  // Otro usuario entra en la misma PC, y el botón también está en el menú principal.
  await submitLogin(window, 'admin', 'admin123');
  await expect(window.getByText('Seleccionar Parroquia')).toBeVisible({ timeout: 30_000 });
  await window.getByRole('combobox').selectOption({ label: 'Parroquia 2' });
  await window.getByRole('button', { name: 'Confirmar' }).click();
  await expect(window.getByText(DASHBOARD_TEXT)).toBeVisible();
  expect(await sessionStatus()).toBe('activa');
  await window.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(window.getByPlaceholder('Nombre de usuario')).toBeVisible();
});

test('cerrar sesión sin internet: conserva lo pendiente y la entrada sin conexión', async () => {
  const userData = newPc();
  let pc = await login(userData);
  await closeApp(pc.app);

  mode = 'sin-internet';
  pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await goToBaptisms(pc.window);
  await createBaptism(pc.window, '9008', 'Hermelinda');
  await expect(pc.window.getByRole('cell', { name: 'Hermelinda' })).toBeVisible();
  await expect(badge(pc.window)).toHaveText('1 sin subir', { timeout: 2_000 });

  await pc.window.getByRole('button', { name: 'Abrir menú lateral' }).click();
  await pc.window.getByRole('navigation', { name: 'Menú lateral' }).getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(pc.window.getByPlaceholder('Nombre de usuario')).toBeVisible();

  // Sigue sin internet: las credenciales guardadas bastan, y la partida sigue en esta PC.
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await expect(badge(pc.window)).toHaveText('1 sin subir');
  await goToBaptisms(pc.window);
  await searchBaptism(pc.window, 'Hermelinda');
  await expect(pc.window.getByRole('cell', { name: 'Hermelinda' })).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// Cuentas, correcciones con aprobación y paquete inicial
// ---------------------------------------------------------------------------

/** Un nombre de usuario que no se repite entre corridas del mismo Worker de pruebas. */
const uniqueUsername = (prefix: string) => `${prefix}${Date.now().toString(36)}`;

/** Vuelve al menú principal con "Volver", esperando cada pantalla para no hacer clic a medio cambio. */
async function backToDashboard(window: Page): Promise<void> {
  const dashboard = window.getByText(DASHBOARD_TEXT);
  const back = window.getByRole('button', { name: 'Volver' }).first();
  for (let i = 0; i < 4; i++) {
    await expect(dashboard.or(back)).toBeVisible();
    if (await dashboard.isVisible()) return;
    const before = await window.evaluate(() => location.hash);
    await back.click();
    await expect.poll(() => window.evaluate(() => location.hash)).not.toBe(before);
  }
  await expect(dashboard).toBeVisible();
}

/** El párroco crea un ayudante (rol usuario) de su parroquia, desde Configuración. */
async function createHelper(window: Page, username: string, password: string): Promise<void> {
  await window.getByRole('button', { name: 'Configuración' }).click();
  await window.getByRole('button', { name: 'Agregar usuario' }).click();
  await window.getByRole('button', { name: '+ Agregar' }).click();
  const form = window.getByRole('dialog', { name: 'Añadir nuevo usuario' });
  await form.getByLabel('Nombre', { exact: true }).fill('Ana');
  await form.getByLabel('Apellido paterno', { exact: true }).fill('Ayuda');
  await form.getByLabel('Apellido materno', { exact: true }).fill('Prueba');
  await form.getByLabel('Nombre de usuario', { exact: true }).fill(username);
  await form.getByLabel('Contraseña', { exact: true }).fill(password);
  await form.getByLabel('Repetir contraseña', { exact: true }).fill(password);
  await form.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(form).toBeHidden();
  await expect(window.getByRole('cell', { name: username }).first()).toBeVisible();
  await backToDashboard(window);
}

async function logout(window: Page): Promise<void> {
  await backToDashboard(window);
  await window.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(window.getByPlaceholder('Nombre de usuario')).toBeVisible();
}

/** El párroco crea un ayudante con internet, y el ayudante entra en otra PC. */
async function parishAndHelper(): Promise<{ parish: { app: ElectronApplication; window: Page }; helper: { app: ElectronApplication; window: Page } }> {
  const username = uniqueUsername('ayudante');
  const password = 'clave-del-ayudante';

  const parish = await login(newPc());
  await createHelper(parish.window, username, password);

  const helper = await open(newPc());
  await submitLogin(helper.window, username, password);
  await expect(helper.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });
  return { parish, helper };
}

/** Sincroniza la PC desde cualquier pantalla y vuelve a la lista de bautismos. */
async function syncAndBack(window: Page): Promise<void> {
  await backToDashboard(window);
  await openSyncPage(window);
  await syncNow(window);
  await expect(pending(window)).toHaveText('0');
  await backToBaptisms(window);
}

/** Marca la partida en la lista (si ya estaba marcada, otro clic la desmarcaría). */
async function selectRecord(window: Page, registro: string): Promise<void> {
  const box = window.getByRole('checkbox', { name: `Seleccionar partida ${registro}` });
  if (!(await box.isChecked())) await box.click();
  await expect(box).toBeChecked();
}

async function openForChange(window: Page, registro: string, nombre: string): Promise<Locator> {
  await searchBaptism(window, nombre);
  await selectRecord(window, registro);
  await window.getByRole('button', { name: 'Pedir cambio' }).click();
  return window.getByRole('dialog', { name: 'Pedir cambio' });
}

test('el ayudante escribe la nota en blanco y pide una corrección; el párroco la aprueba en otra PC', async () => {
  const { parish, helper } = await parishAndHelper();
  await backToDashboard(parish.window);
  await goToBaptisms(parish.window);
  await createBaptism(parish.window, '9201', 'Corregina');
  await syncAndBack(parish.window);

  // El ayudante: la nota estaba en blanco y se guarda; el nombre queda pedido.
  await syncAndBack(helper.window);
  let request = await openForChange(helper.window, '9201', 'Corregina');
  await expect(request).toContainText('Si la nota marginal está en blanco, la que escriba se guarda en el momento');
  await request.getByRole('button', { name: 'Añadir campo a modificar' }).click();
  await request.getByRole('textbox', { name: 'Campo nuevo' }).fill('Corregida');
  await request.getByRole('textbox', { name: 'Anotaciones', exact: true }).fill('Se corrige el nombre según el DNI.');
  await request.getByRole('button', { name: 'Pedir cambio' }).click();
  await expect(request).toBeHidden();

  // Mientras espera, el ayudante ve su pedido y no puede pedir otro.
  request = await openForChange(helper.window, '9201', 'Corregina');
  await expect(request).toContainText('Su pedido de cambio espera la aprobación');
  await expect(request.getByRole('button', { name: 'Pedir cambio' })).toBeDisabled();
  await expect(request.getByRole('textbox', { name: 'Anotaciones', exact: true })).toHaveValue('Se corrige el nombre según el DNI.');
  await request.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await helper.window.getByRole('button', { name: 'Sí, cancelar' }).click();
  await syncAndBack(helper.window);

  // El párroco: lo ve en "Cambios por aprobar", con el valor anterior y el nuevo.
  await syncAndBack(parish.window);
  await backToDashboard(parish.window);
  await parish.window.getByRole('button', { name: /cambios por aprobar/ }).click();
  const card = parish.window.getByRole('article', { name: 'Cambio de la partida 9201' });
  await expect(card).toContainText('Corregina');
  await expect(card).toContainText('Corregida');
  await expect(card.getByRole('region', { name: 'Nota marginal' })).toContainText('Corregida');
  await expect(card).toContainText('Espera su aprobación.');
  await card.getByRole('button', { name: 'Aprobar' }).click();
  await parish.window.getByRole('alertdialog').getByRole('button', { name: 'Aprobar' }).click();
  await expect(card).toBeHidden();

  // Aprobado: llega a la PC del ayudante, y la búsqueda encuentra el nombre corregido.
  await syncAndBack(parish.window);
  await syncAndBack(helper.window);
  await searchBaptism(helper.window, 'Corregida');
  await expect(helper.window.getByRole('cell', { name: 'Corregina' })).toBeVisible();
});

test('el párroco edita una partida con un cambio pendiente: usa los valores pedidos y queda en el historial', async () => {
  const { parish, helper } = await parishAndHelper();
  await backToDashboard(parish.window);
  await goToBaptisms(parish.window);
  await createBaptism(parish.window, '9202', 'Historiana');
  await syncAndBack(parish.window);

  await syncAndBack(helper.window);
  const request = await openForChange(helper.window, '9202', 'Historiana');
  await field(helper.window, 'Padre').fill('Juan Quispe Mamani');
  await request.getByRole('button', { name: 'Pedir cambio' }).click();
  await expect(request).toBeHidden();
  await syncAndBack(helper.window);

  // En la PC del párroco el formulario muestra lo pedido, y "Usar estos valores" lo pone en los campos.
  await syncAndBack(parish.window);
  await searchBaptism(parish.window, 'Historiana');
  await selectRecord(parish.window, '9202');
  await parish.window.getByRole('button', { name: 'Editar' }).click();
  const edit = parish.window.getByRole('dialog', { name: 'Editar partida' });
  await expect(edit.getByRole('region', { name: 'Cambio pedido' })).toContainText('Juan Quispe Mamani');
  await expect(field(parish.window, 'Padre')).toHaveValue('Pedro Prueba');
  await edit.getByRole('button', { name: 'Usar estos valores' }).click();
  await expect(field(parish.window, 'Padre')).toHaveValue('Juan Quispe Mamani');
  await saveRecord(parish.window);

  // El historial cuenta todo, el evento más nuevo primero.
  await selectRecord(parish.window, '9202');
  await parish.window.getByRole('button', { name: 'Historial' }).click();
  const history = parish.window.getByRole('dialog', { name: 'Historial de la partida' });
  const rows = history.getByRole('row');
  await expect(rows.nth(1)).toContainText('Aprobó el cambio');
  await expect(rows.nth(1)).toContainText('Juan Quispe Mamani');
  await expect(history).toContainText('Pidió un cambio');
  await expect(history).toContainText('Registró la partida');
  await history.getByRole('button', { name: 'Cerrar' }).click();

  // El ayudante no tiene el botón del historial.
  await expect(helper.window.getByRole('button', { name: 'Historial' })).toHaveCount(0);
});

test('si el párroco guarda sin usar lo pedido, se le avisa y el pedido queda descartado', async () => {
  const { parish, helper } = await parishAndHelper();
  await backToDashboard(parish.window);
  await goToBaptisms(parish.window);
  await createBaptism(parish.window, '9203', 'Descartina');
  await syncAndBack(parish.window);

  await syncAndBack(helper.window);
  let request = await openForChange(helper.window, '9203', 'Descartina');
  await field(helper.window, 'Madre').fill('Rosa Pedida');
  await request.getByRole('button', { name: 'Pedir cambio' }).click();
  await syncAndBack(helper.window);

  await syncAndBack(parish.window);
  await searchBaptism(parish.window, 'Descartina');
  await selectRecord(parish.window, '9203');
  await parish.window.getByRole('button', { name: 'Editar' }).click();
  await field(parish.window, 'Padrino').fill('Mario');
  await parish.window.getByRole('button', { name: 'Guardar cambios' }).click();
  const warning = parish.window.getByRole('alertdialog');
  await expect(warning).toContainText('Si guarda sin usar esos valores, el pedido se descarta.');
  await warning.getByRole('button', { name: 'Guardar y descartar' }).click();
  await expect(parish.window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
  await syncAndBack(parish.window);

  // El ayudante ve que su pedido se descartó, y puede pedir otro.
  await syncAndBack(helper.window);
  request = await openForChange(helper.window, '9203', 'Descartina');
  await expect(request).toContainText('Su pedido anterior fue descartado');
  await expect(request).toContainText('Descartada al editar la partida');
  await expect(request.getByRole('button', { name: 'Pedir cambio' })).toBeEnabled();
});

test('una cuenta creada sin internet entra en esa PC, y se sube cuando el párroco sincroniza', async () => {
  const username = uniqueUsername('sinred');
  const password = 'clave-sin-internet';
  const pc = await login(newPc());

  mode = 'sin-internet';
  await createHelper(pc.window, username, password);
  await logout(pc.window);
  await submitLogin(pc.window, username, password);
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible();

  // Vuelve internet, pero el servidor todavía no conoce la cuenta: no se pide volver a entrar.
  mode = 'normal';
  await openSyncPage(pc.window);
  await syncNow(pc.window);
  await expect(pc.window.getByText('Esta cuenta todavía no está en el servidor')).toBeVisible();
  await expect(pc.window.getByText('Debe iniciar sesión de nuevo')).toHaveCount(0);

  // El párroco entra en esa PC y sincroniza: la cuenta se sube.
  await logout(pc.window);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await openSyncPage(pc.window);
  await syncNow(pc.window);
  await expect(pending(pc.window)).toHaveText('0');

  // Ahora el ayudante también entra en otra PC.
  await logout(pc.window);
  const other = await open(newPc());
  await submitLogin(other.window, username, password);
  await expect(other.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });
  await openSyncPage(other.window);
  await expect(other.window.getByText('En línea')).toBeVisible();
});

test('paquete inicial: el admin general lo genera, y una PC sin internet instalada con él ya puede consultar', async () => {
  const dir = newPc();
  const packageFile = path.join(dir, 'paquete-inicial.json');

  // Una partida que ya está en el servidor.
  const parish = await login(newPc());
  await goToBaptisms(parish.window);
  await createBaptism(parish.window, '9301', 'Paquetina');
  await backToDashboard(parish.window);
  await openSyncPage(parish.window);
  await syncNow(parish.window);
  await expect(pending(parish.window)).toHaveText('0');

  // El administrador general genera el paquete.
  const admin = await open(newPc());
  await submitLogin(admin.window, 'admin', 'admin123');
  await expect(admin.window.getByText('Seleccionar Parroquia')).toBeVisible({ timeout: 30_000 });
  await admin.window.getByRole('combobox').selectOption({ label: 'Parroquia 1' });
  await admin.window.getByRole('button', { name: 'Confirmar' }).click();
  await expect(admin.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await admin.app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog;
  }, packageFile);
  await admin.window.getByRole('button', { name: 'Configuración' }).click();
  await admin.window.getByRole('button', { name: 'Generar paquete inicial' }).click();
  await expect(admin.window.getByText(/Paquete inicial guardado/)).toBeVisible();
  expect(existsSync(packageFile)).toBe(true);

  // Una PC nueva, sin internet, instalada con ese paquete (PRELATURA_PAQUETE hace de instalador): ya entra.
  mode = 'sin-internet';
  const fresh = await open(newPc(), { PRELATURA_SIN_PAQUETE: '', PRELATURA_PAQUETE: packageFile });
  await expect(fresh.window.getByRole('button', { name: 'Restaurar respaldo' })).toBeHidden();
  await submitLogin(fresh.window, 'parroco1', 'parroco123');
  await expect(fresh.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await goToBaptisms(fresh.window);
  await searchBaptism(fresh.window, 'Paquetina');
  await expect(fresh.window.getByRole('cell', { name: 'Paquetina' })).toBeVisible();
});

// Va al final: le pasa a otro administrador la marca de principal de parroco1.
test('el principal de la parroquia crea un administrador, que no puede tocarlo, y le pasa la marca', async () => {
  const username = uniqueUsername('delegado');
  const password = 'clave-del-delegado';
  const principal = await login(newPc());

  // parroco1 es el principal de Parroquia 1: elige el tipo de cuenta.
  await principal.window.getByRole('button', { name: 'Configuración' }).click();
  await principal.window.getByRole('button', { name: 'Agregar usuario' }).click();
  await principal.window.getByRole('button', { name: '+ Agregar' }).click();
  const form = principal.window.getByRole('dialog', { name: 'Añadir nuevo usuario' });
  await form.getByLabel('Nombre', { exact: true }).fill('Delia');
  await form.getByLabel('Apellido paterno', { exact: true }).fill('Delegada');
  await form.getByLabel('Apellido materno', { exact: true }).fill('Prueba');
  await form.getByLabel('Nombre de usuario', { exact: true }).fill(username);
  await form.getByLabel('Tipo de cuenta', { exact: true }).selectOption('admin_parroquia');
  await form.getByLabel('Contraseña', { exact: true }).fill(password);
  await form.getByLabel('Repetir contraseña', { exact: true }).fill(password);
  await form.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(form).toBeHidden();

  // Al principal no lo deshabilita nadie, ni él mismo.
  await principal.window.getByRole('checkbox', { name: 'Seleccionar usuario parroco1' }).click();
  await expect(principal.window.getByRole('button', { name: 'Deshabilitar' })).toBeDisabled();
  await principal.window.getByRole('checkbox', { name: 'Seleccionar usuario parroco1' }).click();

  // El nuevo administrador entra en otra PC: hace todo el trabajo, pero no toca al principal ni crea administradores.
  const delegate = await open(newPc());
  await submitLogin(delegate.window, username, password);
  await expect(delegate.window.getByText(DASHBOARD_TEXT)).toBeVisible({ timeout: 30_000 });
  await delegate.window.getByRole('button', { name: 'Configuración' }).click();
  await expect(delegate.window.getByRole('button', { name: 'Importar Excel del sistema anterior' })).toBeVisible();
  await delegate.window.getByRole('button', { name: 'Agregar usuario' }).click();
  await expect(delegate.window.getByRole('cell', { name: 'parroco1' })).toBeVisible();
  await expect(delegate.window.getByRole('checkbox', { name: 'Seleccionar usuario parroco1' })).toHaveCount(0);
  await delegate.window.getByRole('button', { name: '+ Agregar' }).click();
  await expect(delegate.window.getByRole('dialog', { name: 'Añadir nuevo usuario' }).getByLabel('Tipo de cuenta', { exact: true })).toHaveValue('Usuario');
  await delegate.window.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await delegate.window.getByRole('button', { name: 'Sí, cancelar' }).click();

  // El principal le pasa la marca: ahora el principal es el nuevo.
  await principal.window.getByRole('checkbox', { name: `Seleccionar usuario ${username}` }).click();
  await principal.window.getByRole('button', { name: 'Hacer principal' }).click();
  await principal.window.getByRole('alertdialog').getByRole('button', { name: 'Sí, pasar la marca' }).click();
  await expect(principal.window.getByRole('row', { name: new RegExp(username) })).toContainText('Principal');
  await expect(principal.window.getByRole('checkbox', { name: `Seleccionar usuario ${username}` })).toHaveCount(0);
});

test('una cuenta en dos parroquias: el general le agrega otra, y al entrar elige en cuál trabajar', async () => {
  const username = uniqueUsername('multi');
  // La regla nueva: al menos 6 caracteres, sin espacios.
  const password = 'clave1';
  const worker = process.env.PRELATURA_WORKER_URL;

  // La cuenta nueva es usuario de Parroquia 2. El general la crea directo en el servidor.
  const general = (await (
    await fetch(`${worker}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
  ).json()) as { token: string };
  const created = await fetch(`${worker}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${general.token}` },
    body: JSON.stringify({ username, password, rol: 'usuario', parroquia_id: 2, nombre: 'Mara', apellido_paterno: username, apellido_materno: '' }),
  });
  expect(created.status).toBe(201);

  // El general, en su PC, le agrega Parroquia 3 como administradora: como no tiene principal, lo es.
  const admin = await open(newPc());
  await submitLogin(admin.window, 'admin', 'admin123');
  await expect(admin.window.getByText('Seleccionar Parroquia')).toBeVisible({ timeout: 30_000 });
  await admin.window.getByRole('combobox').selectOption({ label: 'Parroquia 1' });
  await admin.window.getByRole('button', { name: 'Confirmar' }).click();
  await admin.window.getByRole('button', { name: 'Configuración' }).click();
  // El general no importa ni exporta datos: eso es del administrador de cada parroquia.
  await expect(admin.window.getByRole('button', { name: 'Exportar respaldo' })).toHaveCount(0);
  await expect(admin.window.getByRole('button', { name: 'Importar Excel del sistema anterior' })).toHaveCount(0);
  await admin.window.getByRole('button', { name: 'Agregar usuario' }).click();
  await admin.window.getByLabel('Apellido paterno', { exact: true }).fill(username);
  await admin.window.getByRole('button', { name: 'Buscar', exact: true }).click();
  await admin.window.getByRole('checkbox', { name: `Seleccionar usuario ${username}` }).click();
  await admin.window.getByRole('button', { name: 'Parroquias', exact: true }).click();

  const dialog = admin.window.getByRole('dialog', { name: `Parroquias de ${username}` });
  await dialog.getByLabel('Agregar parroquia').selectOption({ label: 'Parroquia 3' });
  await dialog.getByLabel('Rol', { exact: true }).selectOption('admin_parroquia');
  await dialog.getByRole('button', { name: 'Agregar' }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Parroquia 3' })).toContainText('Principal');
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(admin.window.getByRole('row', { name: new RegExp(username) })).toContainText('Parroquia 2 (+ Parroquia 3)');

  // Ella entra en otra PC: elige con cuál trabajar. En Parroquia 3 es administradora.
  const multi = await open(newPc());
  await submitLogin(multi.window, username, password);
  await expect(multi.window.getByText('Seleccionar Parroquia')).toBeVisible({ timeout: 30_000 });
  await multi.window.getByRole('button', { name: /Trabajar en: Parroquia 3/ }).click();
  await multi.window.getByRole('button', { name: 'Confirmar' }).click();
  await expect(multi.window.getByText(DASHBOARD_TEXT)).toBeVisible();

  // El menú lateral está dentro de cada sección.
  const menu = multi.window.getByRole('navigation', { name: 'Menú lateral' });
  await goToBaptisms(multi.window);
  await multi.window.getByRole('button', { name: 'Abrir menú lateral' }).click();
  await expect(menu.getByRole('button', { name: 'Cambios por aprobar' })).toBeVisible();
  await multi.window.getByRole('button', { name: 'Cerrar menú lateral' }).click();
  await backToDashboard(multi.window);
  await multi.window.getByRole('button', { name: 'Configuración' }).click();
  await expect(multi.window.getByRole('button', { name: 'Exportar respaldo' })).toBeVisible();

  // Consultando una parroquia que no es suya, aunque sea administradora en la suya: no importa ni exporta.
  await multi.window.getByRole('button', { name: 'Volver' }).first().click();
  await multi.window.getByRole('button', { name: 'Cambiar parroquia' }).click();
  await multi.window.getByRole('combobox').selectOption({ label: 'Parroquia 1' });
  await multi.window.getByRole('button', { name: 'Confirmar' }).click();
  await multi.window.getByRole('button', { name: 'Configuración' }).click();
  await expect(multi.window.getByRole('button', { name: 'Exportar respaldo' })).toHaveCount(0);
  await expect(multi.window.getByRole('button', { name: 'Restaurar respaldo' })).toHaveCount(0);
  await expect(multi.window.getByRole('button', { name: 'Importar Excel del sistema anterior' })).toHaveCount(0);
  await multi.window.getByRole('button', { name: 'Volver' }).first().click();
  await multi.window.getByRole('button', { name: 'Cambiar parroquia' }).click();
  await multi.window.getByRole('combobox').selectOption({ label: '★ Parroquia 3 (trabajo aquí)' });
  await multi.window.getByRole('button', { name: 'Confirmar' }).click();
  await goToBaptisms(multi.window);
  await multi.window.getByRole('button', { name: 'Abrir menú lateral' }).click();

  // En Parroquia 2 es usuario: no aprueba cambios.
  await menu.getByRole('button', { name: 'Cambiar parroquia' }).click();
  await multi.window.getByRole('combobox').selectOption({ label: '★ Parroquia 2 (trabajo aquí)' });
  await multi.window.getByRole('button', { name: 'Confirmar' }).click();
  await expect(multi.window.getByText(DASHBOARD_TEXT)).toBeVisible();
  await goToBaptisms(multi.window);
  await multi.window.getByRole('button', { name: 'Abrir menú lateral' }).click();
  await expect(menu.getByRole('button', { name: 'Menú principal' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Cambios por aprobar' })).toHaveCount(0);
});
