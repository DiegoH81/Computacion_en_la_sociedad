// @vitest-environment node
// El respaldo de la PC: se arma con toda la base (también lo que falta subir), se cifra con una
// contraseña y, al restaurarlo, deja otra PC igual que la respaldada.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build_backup, decode_backup, encode_backup, prepare_restore } from '../../electron/main/controllers/backup';
import { verify_offline } from '../../electron/main/controllers/login';
import { create_person_sacrament } from '../../electron/main/controllers/sacraments';
import { create_user } from '../../electron/main/controllers/users';
import { install_temp_database, local_paths, open_local_database, type KeyStore, type LocalDatabase, type LocalPaths } from '../../electron/main/db/database';
import { LOCAL_MIGRATIONS } from '../../electron/main/db/migrations';
import type { Session } from '../../electron/main/models/session';
import { set_sync_value } from '../../electron/main/sync/queue';
import { save_reference_data } from '../../electron/main/sync/sync';
import { new_key } from '../../electron/main/utils/crypto';
import { SYNC_KEYS } from '../../electron/main/utils/config';
import { baptism, TEST_MINISTER } from './helpers/records';

const parroco: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const PASSWORD = 'clave-del-respaldo';

// Las claves se guardan en memoria: en la app las protege Windows (safeStorage).
function memory_keys(): KeyStore {
  const saved = new Map<string, string>();
  return { read: (file) => saved.get(file) ?? null, write: (file, key) => void saved.set(file, key) };
}

let dirs: string[] = [];
let source: LocalDatabase;
let source_dir: string;

function new_dir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'prelatura-respaldo-'));
  dirs.push(dir);
  return dir;
}

// Restaura el respaldo en una PC nueva y abre su base.
async function restore_in_new_pc(file_text: string): Promise<{ db: LocalDatabase; paths: LocalPaths }> {
  const paths = local_paths(new_dir());
  const keys = memory_keys();
  const key = prepare_restore(paths, keys, await decode_backup(file_text, PASSWORD));
  return { db: install_temp_database(paths, keys, key), paths };
}

beforeEach(() => {
  source_dir = new_dir();
  source = open_local_database(path.join(source_dir, 'local.db'), new_key());
  save_reference_data(source, {
    parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
    ministros: [TEST_MINISTER],
    usuarios: [{ id: 1, client_id: 'servidor-1', parroquia_id: 1, username: 'parroco1', rol: 'admin_parroquia', nombre: 'U', apellido_paterno: 'P', apellido_materno: 'M', activo: 1, principal: 1, version: 1 }],
  });
});

afterEach(() => {
  source.close();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('respaldo', () => {
  it('copia todo, también lo que falta subir y las cuentas creadas aquí, y otra PC queda igual', async () => {
    create_person_sacrament(source, 'bautismo', parroco, baptism('bautismo', { sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '1' }, persona: { nombres: 'Respaldina', apellido_paterno: 'Paz', apellido_materno: 'Rios' } }));
    await create_user(source, parroco, { username: 'ana.ayudante', password: 'clave-segura', rol: 'usuario', parroquia_id: 1, nombre: 'Ana', apellido_paterno: 'Paz', apellido_materno: '' });
    set_sync_value(source, SYNC_KEYS.key_registered, 'parroquia');

    mkdirSync(path.join(source_dir, 'logos'));
    writeFileSync(path.join(source_dir, 'logos', 'parroquia-1.txt'), 'data:image/png;base64,AAAA');

    const content = build_backup(source, source_dir);
    expect(content.version_base).toBe(LOCAL_MIGRATIONS.length);
    expect(content.logos).toEqual({ 'parroquia-1.txt': 'data:image/png;base64,AAAA' });

    const file_text = await encode_backup(content, PASSWORD);
    expect(file_text).not.toContain('Respaldina'); // el archivo va cifrado

    const { db } = await restore_in_new_pc(file_text);
    try {
      const names = (database: LocalDatabase) => database.prepare('SELECT nombres FROM personas ORDER BY id').pluck().all();
      const queue = (database: LocalDatabase) => database.prepare('SELECT entidad, client_id, version_base, cola_id, revision FROM sync_cola ORDER BY id').all();

      expect(names(db)).toEqual(names(source));
      expect(queue(db)).toEqual(queue(source));
      expect(queue(db).length).toBe(2); // la partida y la cuenta nueva, para subirlas
      expect(await verify_offline(db, 'ana.ayudante', 'clave-segura')).toMatchObject({ ok: true });

      // La base restaurada tiene otra clave: hay que subir su copia de nuevo.
      expect(db.prepare('SELECT valor FROM sync_estado WHERE clave = ?').get(SYNC_KEYS.key_registered)).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it('con otra contraseña no abre', async () => {
    const file_text = await encode_backup(build_backup(source, source_dir), PASSWORD);
    await expect(decode_backup(file_text, 'otra-clave-123')).rejects.toThrow('La contraseña no es la del respaldo');
  });

  it('rechaza un archivo que no es un respaldo y uno de una versión más nueva de la app', async () => {
    await expect(decode_backup('{"formato":"prelatura-paquete-inicial"}', PASSWORD)).rejects.toThrow('no es un respaldo');

    const content = { ...build_backup(source, source_dir), version_base: LOCAL_MIGRATIONS.length + 1 };
    expect(() => prepare_restore(local_paths(new_dir()), memory_keys(), content)).toThrow('versión más nueva');
  });

  it('un respaldo de una versión anterior se restaura y recibe las migraciones que le faltan', async () => {
    const old_dir = new_dir();
    const old_version = LOCAL_MIGRATIONS.length - 1;
    const old = open_local_database(path.join(old_dir, 'local.db'), new_key(), LOCAL_MIGRATIONS.slice(0, old_version));
    old.prepare(`INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (1, 'Parroquia vieja', NULL, 1)`).run();
    const content = build_backup(old, old_dir);
    old.close();
    expect(content.version_base).toBe(old_version);

    const { db } = await restore_in_new_pc(await encode_backup(content, PASSWORD));
    try {
      expect(db.pragma('user_version', { simple: true })).toBe(LOCAL_MIGRATIONS.length);
      expect(db.prepare('SELECT nombre FROM parroquias').pluck().get()).toBe('Parroquia vieja');
    } finally {
      db.close();
    }
  });

  it('no acepta tablas o columnas que la base no conoce', async () => {
    const content = build_backup(source, source_dir);
    content.tablas['inventada'] = { columnas: ['x'], filas: [[1]] };
    expect(() => prepare_restore(local_paths(new_dir()), memory_keys(), content)).toThrow('no es un respaldo');

    const other = build_backup(source, source_dir);
    other.tablas['parroquias'].columnas[0] = 'columna_inventada';
    expect(() => prepare_restore(local_paths(new_dir()), memory_keys(), other)).toThrow('no es un respaldo');
  });
});
