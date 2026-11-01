import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// La app sube y descarga datos: las pruebas usan un Worker propio con una base temporal,
// para no ensuciar la base de desarrollo ni depender de lo que tenga.
const PORT = 8799;
const WORKER_DIR = path.join(process.cwd(), 'worker');

function wrangler(args: string[]) {
  return `npx wrangler ${args.join(' ')}`;
}

async function waitForWorker(url: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('wrangler dev terminó antes de arrancar.');
    try {
      await fetch(`${url}/api/parishes`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error('El Worker de pruebas no arrancó a tiempo.');
}

export default async function globalSetup() {
  const persistDir = mkdtempSync(path.join(tmpdir(), 'prelatura-worker-'));
  const persist = `--persist-to "${persistDir}"`;

  const schema = spawnSync(wrangler(['d1', 'execute', 'prelatura-db', '--local', persist, '--file=src/db/schema.sql']), {
    cwd: WORKER_DIR,
    shell: true,
    encoding: 'utf8',
    input: '',
  });
  if (schema.status !== 0) throw new Error(`No se pudo crear la base de pruebas:\n${schema.stdout}\n${schema.stderr}`);

  const server = spawn(wrangler(['dev', '--port', String(PORT), '--inspector-port', '9299', persist]), {
    cwd: WORKER_DIR,
    shell: true,
    stdio: 'ignore',
  });

  const url = `http://127.0.0.1:${PORT}`;
  await waitForWorker(url, server);
  process.env.PRELATURA_API_URL = url;
  process.env.PRELATURA_WORKER_URL = url;

  return async () => {
    // shell: true crea un árbol de procesos: hay que cerrar también a wrangler y workerd.
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    } else {
      server.kill();
    }
    try {
      rmSync(persistDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
    } catch {
      // Windows puede tardar en soltar los archivos: es una carpeta temporal y no afecta a las pruebas.
      console.warn(`No se pudo borrar la carpeta temporal ${persistDir}.`);
    }
  };
}
