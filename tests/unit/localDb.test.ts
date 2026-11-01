// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLocalDatabase, type LocalDatabase } from '../../electron/main/localDb/database';
import { LOCAL_MIGRATIONS } from '../../electron/main/localDb/schema';

const KEY = randomBytes(32).toString('hex');

let dir: string;
let file: string;
let db: LocalDatabase | null;

function open(key = KEY, migrations?: readonly string[]): LocalDatabase {
  db = openLocalDatabase(file, key, migrations);
  return db;
}

function insertPersona(conn: LocalDatabase, nombres: string, dni: string | null = null): number {
  return Number(
    conn
      .prepare(
        `INSERT INTO personas (client_id, parroquia_id, dni, nombres, apellido_paterno)
         VALUES (?, 1, ?, ?, 'Guido')`,
      )
      .run(randomUUID(), dni, nombres).lastInsertRowid,
  );
}

function seed(conn: LocalDatabase): void {
  conn.exec(`INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1')`);
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-localdb-'));
  file = path.join(dir, 'local.db');
  db = null;
});

afterEach(() => {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('cifrado', () => {
  it('no deja datos legibles en el archivo', () => {
    const conn = open();
    seed(conn);
    insertPersona(conn, 'NombreSecretoDeLaPrueba', '12345678');
    conn.pragma('wal_checkpoint(TRUNCATE)');
    conn.close();
    db = null;

    const raw = readFileSync(file);
    expect(raw.subarray(0, 15).toString('latin1')).not.toBe('SQLite format 3');
    expect(raw.includes('NombreSecretoDeLaPrueba')).toBe(false);
    expect(raw.includes('12345678')).toBe(false);
  });

  it('rechaza una clave incorrecta y conserva los datos', () => {
    const conn = open();
    seed(conn);
    conn.close();
    db = null;

    expect(() => open(randomBytes(32).toString('hex'))).toThrow();

    const count = open().prepare('SELECT count(*) AS total FROM parroquias').get() as { total: number };
    expect(count.total).toBe(1);
  });

  it('no se puede abrir sin clave', () => {
    open().close();
    db = null;

    const plain = new Database(file);
    expect(() => plain.prepare('SELECT count(*) FROM sqlite_master').get()).toThrow();
    plain.close();
  });

  it('rechaza una clave con formato inválido', () => {
    expect(() => open("x'; DROP TABLE personas; --")).toThrow(/32 bytes/);
  });
});

describe('migraciones', () => {
  it('reabrir no vuelve a aplicar el esquema ni pierde datos', () => {
    const conn = open();
    seed(conn);
    conn.close();

    const reopened = open();
    expect(reopened.pragma('user_version', { simple: true })).toBe(LOCAL_MIGRATIONS.length);
    expect(reopened.prepare('SELECT nombre FROM parroquias').pluck().get()).toBe('Parroquia 1');
  });

  it('una migración que falla se revierte entera', () => {
    open(KEY, ['CREATE TABLE a (id INTEGER)']).close();
    db = null;

    expect(() => open(KEY, ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER); SELECT * FROM no_existe;'])).toThrow();

    const conn = open(KEY, ['CREATE TABLE a (id INTEGER)']);
    expect(conn.pragma('user_version', { simple: true })).toBe(1);
    expect(conn.prepare(`SELECT count(*) FROM sqlite_master WHERE name = 'b'`).pluck().get()).toBe(0);
  });

  it('no abre una base creada por una versión más nueva de la app', () => {
    open(KEY, ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER)']).close();
    db = null;

    expect(() => open(KEY, ['CREATE TABLE a (id INTEGER)'])).toThrow(/versión 2/);
  });
});

describe('modelo', () => {
  it('permite dos registros con el mismo DNI y nombres distintos', () => {
    const conn = open();
    seed(conn);
    insertPersona(conn, 'Diogo', '12345678');
    insertPersona(conn, 'Diego', '12345678');

    const nombres = conn.prepare('SELECT nombres FROM personas WHERE dni = ?').pluck().all('12345678');
    expect(nombres).toEqual(['Diogo', 'Diego']);
  });

  it('guarda edad o fecha de nacimiento de forma independiente', () => {
    const conn = open();
    seed(conn);
    const id = insertPersona(conn, 'Diego');
    conn.prepare('UPDATE personas SET edad = 30 WHERE id = ?').run(id);

    const persona = conn.prepare('SELECT edad, fecha_nacimiento FROM personas WHERE id = ?').get(id);
    expect(persona).toEqual({ edad: 30, fecha_nacimiento: null });
    expect(() => conn.prepare('UPDATE personas SET edad = -1 WHERE id = ?').run(id)).toThrow(/CHECK/);
  });

  it('cada UPDATE sube version una sola vez, salvo que la sincronización la fije', () => {
    const conn = open();
    seed(conn);
    const id = insertPersona(conn, 'Diago');
    const version = conn.prepare('SELECT version FROM personas WHERE id = ?').pluck();

    conn.prepare(`UPDATE personas SET nombres = 'Diego' WHERE id = ?`).run(id);
    expect(version.get(id)).toBe(2);

    conn.prepare(`UPDATE personas SET nombres = 'Diego', version = 9 WHERE id = ?`).run(id);
    expect(version.get(id)).toBe(9);
  });

  it('exige client_id único en cambios_persona para no duplicar reenvíos', () => {
    const conn = open();
    seed(conn);
    conn.exec(`INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno)
               VALUES (1, 1, 'parroco1', 'usuario_parroquia', 'Usuario', 'Parroquia', 'Uno')`);
    const personaId = insertPersona(conn, 'Diego');
    const insert = conn.prepare(
      `INSERT INTO cambios_persona (client_id, persona_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
       VALUES ('cambio-1', ?, 1, 'nombres', 'Diago', 'Diego')`,
    );

    insert.run(personaId);
    expect(() => insert.run(personaId)).toThrow(/UNIQUE/);
  });

  it('aplica las claves foráneas y no deja un subtipo en el sacramento equivocado', () => {
    const conn = open();
    seed(conn);
    const personaId = insertPersona(conn, 'Diego');
    const sacramentoId = conn
      .prepare(
        `INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision)
         VALUES (?, 'matrimonio', 1, '1', '1', '1', '2020-01-01')`,
      )
      .run(randomUUID()).lastInsertRowid;

    expect(() =>
      conn.prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)').run(sacramentoId, personaId),
    ).toThrow(/FOREIGN KEY/);
    expect(() => insertPersona(conn, 'Diego', '')).toThrow(/CHECK/);
  });

  it('no guarda contraseñas en usuarios ni DNI de los padres en personas', () => {
    const conn = open();
    const columnas = (tabla: string) =>
      conn.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).pluck().all();

    expect(columnas('usuarios')).not.toContain('password_hash');
    expect(columnas('personas')).not.toContain('padre_dni');
    expect(columnas('personas')).not.toContain('madre_dni');
  });
});
