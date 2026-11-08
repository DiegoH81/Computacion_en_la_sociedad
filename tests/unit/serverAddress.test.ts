// @vitest-environment node
// La dirección del servidor se lee de configuracion.json, fuera del programa.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read_config_file } from '../../electron/main/utils/server_address';

let dir: string;
const file = () => path.join(dir, 'configuracion.json');

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-config-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('configuracion.json', () => {
  it('lee la dirección del servidor, sin espacios ni barra final', () => {
    writeFileSync(file(), JSON.stringify({ servidor: '  https://registro-sacramental.ejemplo.workers.dev/ ' }));
    expect(read_config_file(file())).toBe('https://registro-sacramental.ejemplo.workers.dev');
  });

  it('sin archivo, o con un archivo que no sirve, no hay dirección (se usa la siguiente opción)', () => {
    expect(read_config_file(file())).toBeNull();

    writeFileSync(file(), 'esto no es JSON');
    expect(read_config_file(file())).toBeNull();

    writeFileSync(file(), JSON.stringify({ servidor: 'registro-sacramental.workers.dev' }));
    expect(read_config_file(file())).toBeNull();
  });
});
