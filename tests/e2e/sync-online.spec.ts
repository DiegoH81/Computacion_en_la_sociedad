import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Dos PCs reales contra el Worker de pruebas. Entre ellas y el Worker hay un proxy que permite
// simular que se va internet, o que la respuesta del servidor nunca llega.

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
      // El servidor ya guardó, pero la PC nunca se entera.
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

async function open(userData: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'dist-electron/index.js'), `--user-data-dir=${userData}`],
    env: { ...process.env, PRELATURA_API_URL: proxyUrl } as Record<string, string>,
  });
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

const field = (window: Page, label: string) => window.locator(`label:text-is("${label}") + input`).last();

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
  await window.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(window.getByRole('button', { name: 'Guardar cambios' })).toBeHidden();
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
  const button = window.getByRole('button', { name: /^Sincroniza(r ahora|ndo…)$/ });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(window.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled({ timeout: 30_000 });
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
  // La corrección llega con su historial: se encuentra por el nombre anterior.
  await searchBaptism(pcA.window, 'Alfonsina');
  await expect(pcA.window.getByRole('cell', { name: 'Alfonsa', exact: true })).toHaveCount(1);
});

test('login sin internet: exige un primer ingreso online y luego valida localmente', async () => {
  const userData = newPc();

  // Sin ningún ingreso previo en esta PC no se puede entrar.
  mode = 'sin-internet';
  let pc = await open(userData);
  await submitLogin(pc.window, 'parroco1', 'parroco123');
  await expect(pc.window.getByText(/debe iniciar sesión con internet la primera vez/)).toBeVisible();
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
