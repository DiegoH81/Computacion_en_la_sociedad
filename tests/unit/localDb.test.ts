// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3-multiple-ciphers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { LOCAL_MIGRATIONS } from '../../electron/main/db/migrations';

const KEY = randomBytes(32).toString('hex');

let dir: string;
let file: string;
let db: LocalDatabase | null;

function open(key = KEY, migrations?: readonly string[]): LocalDatabase {
  db = open_local_database(file, key, migrations);
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

  it('rechaza una migración que deja claves foráneas rotas y sigue aplicándolas después', () => {
    const base = 'CREATE TABLE padre (id INTEGER PRIMARY KEY); CREATE TABLE hijo (padre_id INTEGER REFERENCES padre(id)); INSERT INTO padre VALUES (1); INSERT INTO hijo VALUES (1);';
    open(KEY, [base]).close();
    db = null;

    expect(() => open(KEY, [base, 'DELETE FROM padre'])).toThrow(/claves foráneas/);

    const conn = open(KEY, [base]);
    expect(conn.prepare('SELECT count(*) FROM padre').pluck().get()).toBe(1);
    expect(conn.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('al pasar a la fecha aproximada conserva las edades como texto', () => {
    // La versión 4 es la última que tenía la columna edad.
    const conn = open(KEY, LOCAL_MIGRATIONS.slice(0, 4));
    seed(conn);
    const id = insertPersona(conn, 'Diego');
    conn.prepare('UPDATE personas SET edad = 27 WHERE id = ?').run(id);
    conn.close();

    const migrated = open();
    expect(migrated.prepare('SELECT fecha_aproximada FROM personas WHERE id = ?').pluck().get(id)).toBe('27 años');
    expect(migrated.prepare(`SELECT count(*) FROM pragma_table_info('personas') WHERE name = 'edad'`).pluck().get()).toBe(0);
  });

  it('lo que esperaba aprobación con el sistema anterior pasa a solicitudes de cambio', () => {
    // La base justo antes de la migración que crea las solicitudes de cambio.
    const requestsMigration = LOCAL_MIGRATIONS.findIndex((sql) => sql.includes('CREATE TABLE solicitudes_cambio'));
    const conn = open(KEY, LOCAL_MIGRATIONS.slice(0, requestsMigration));
    seed(conn);
    conn.exec(`INSERT INTO usuarios (id, client_id, username, rol, parroquia_id, nombre, apellido_paterno, apellido_materno) VALUES (4, 'servidor-4', 'ayudante', 'usuario', 1, 'Ana', 'Paz', 'Rey')`);
    const personaId = insertPersona(conn, 'Diago');
    conn.exec(`
      INSERT INTO sacramentos (id, client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision, anotaciones, anotaciones_propuestas)
      VALUES (1, 'partida-1', 'bautismo', 1, '1', '1', '1', '2020-01-01', 'Nota vieja', 'Nota nueva');
      INSERT INTO bautismos (sacramento_id, persona_id) VALUES (1, ${personaId});
      INSERT INTO cambios_persona (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, estado, fecha_cambio)
      VALUES ('cambio-1', ${personaId}, 1, 4, 'nombres', 'Diago', 'Diego', 'pendiente', '2026-11-01T10:00:00.000Z');
    `);
    conn.close();

    const migrated = open();
    expect(migrated.prepare('SELECT client_id, parte, campo, tipo, valor_anterior, valor_nuevo, usuario_id, estado FROM solicitudes_cambio ORDER BY id').all()).toEqual([
      { client_id: 'cambio-1', parte: 'persona', campo: 'nombres', tipo: 'nota_marginal', valor_anterior: 'Diago', valor_nuevo: 'Diego', usuario_id: 4, estado: 'pendiente' },
      { client_id: 'partida-1-nota', parte: 'sacramento', campo: 'anotaciones', tipo: 'digitacion', valor_anterior: 'Nota vieja', valor_nuevo: 'Nota nueva', usuario_id: 4, estado: 'pendiente' },
    ]);
    expect(migrated.prepare('SELECT count(*) FROM cambios_persona').pluck().get()).toBe(0);
    expect(migrated.prepare(`SELECT count(*) FROM pragma_table_info('sacramentos') WHERE name = 'anotaciones_propuestas'`).pluck().get()).toBe(0);
    expect(migrated.pragma('foreign_key_check')).toEqual([]);
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

  it('guarda fecha aproximada (texto libre) o fecha de nacimiento de forma independiente', () => {
    const conn = open();
    seed(conn);
    const id = insertPersona(conn, 'Diego');
    conn.prepare('UPDATE personas SET fecha_aproximada = ? WHERE id = ?').run('(27 AÑOS AL DIA DE BODA)', id);

    const persona = conn.prepare('SELECT fecha_aproximada, fecha_nacimiento FROM personas WHERE id = ?').get(id);
    expect(persona).toEqual({ fecha_aproximada: '(27 AÑOS AL DIA DE BODA)', fecha_nacimiento: null });
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
               VALUES (1, 1, 'parroco1', 'admin_parroquia', 'Usuario', 'Parroquia', 'Uno')`);
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

  it('en usuarios solo guarda la contraseña cambiada que falta subir, y no hay DNI de los padres en personas', () => {
    const conn = open();
    const columnas = (tabla: string) =>
      conn.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).pluck().all();

    expect(columnas('usuarios')).not.toContain('password_hash');
    expect(columnas('usuarios')).toContain('password_hash_pendiente');
    expect(columnas('personas')).not.toContain('padre_dni');
    expect(columnas('personas')).not.toContain('madre_dni');
  });
});
