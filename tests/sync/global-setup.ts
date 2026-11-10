import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';

// Las pruebas de sincronización usan el Worker de verdad (wrangler dev) con una base temporal, igual
// que las pruebas e2e, pero en otro puerto para poder correr las dos a la vez.
const PORT = 8797;
const WORKER_DIR = path.join(process.cwd(), 'worker');

function wrangler(args: string[]): string {
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

export default async function globalSetup(project: TestProject) {
  const persistDir = mkdtempSync(path.join(tmpdir(), 'prelatura-sync-worker-'));
  const persist = `--persist-to "${persistDir}"`;

  const schema = spawnSync(wrangler(['d1', 'execute', 'prelatura-db', '--local', persist, '--file=src/db/schema.sql']), {
    cwd: WORKER_DIR,
    shell: true,
    encoding: 'utf8',
    input: '',
  });
  if (schema.status !== 0) throw new Error(`No se pudo crear la base de pruebas:\n${schema.stdout}\n${schema.stderr}`);

  const server = spawn(wrangler(['dev', '--port', String(PORT), '--inspector-port', '9297', persist]), {
    cwd: WORKER_DIR,
    shell: true,
    stdio: 'ignore',
  });

  const url = `http://127.0.0.1:${PORT}`;
  await waitForWorker(url, server);
  project.provide('workerUrl', url);

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
      console.warn(`No se pudo borrar la carpeta temporal ${persistDir}.`);
    }
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    workerUrl: string;
  }
}
