import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';

const db = () => env.prelatura_db;

const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FK_ERROR = /FOREIGN KEY constraint failed/;
const CHECK_ERROR = /CHECK constraint failed/;

type Tipo = 'matrimonio' | 'bautismo' | 'confirmacion';

let seq = 0;
const nextClientId = () => `cliente-${++seq}`;

/** updated_at tiene resolución de milisegundos: esperamos para que el cambio se note. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

async function setup(): Promise<void> {
  await resetDatabase(db());

  await db().prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)').bind('Parroquia 1').run();

  await db()
    .prepare(
      `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno,
                             rol, parroquia_id, activo)
       VALUES (1, 'admin', 'hash', 'Administrador', 'De', 'Prueba', 'admin', NULL, 1)`,
    )
    .run();

  await db()
    .prepare(
      `INSERT INTO sacerdotes (id, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
       VALUES (1, 'Braulio', 'Guido', 'Alvaro', 1, 1)`,
    )
    .run();
}

async function insertPersona(dni: string | null = null): Promise<number> {
  const result = await db()
    .prepare(
      `INSERT INTO personas (client_id, parroquia_id, dni, nombres, apellido_paterno)
       VALUES (?, 1, ?, 'Ana', 'Quispe')`,
    )
    .bind(nextClientId(), dni)
    .run();
  return result.meta.last_row_id as number;
}

async function insertSacramento(tipo: Tipo): Promise<number> {
  const result = await db()
    .prepare(
      `INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision)
       VALUES (?, ?, 1, '1', '1', '1', '2024-01-01')`,
    )
    .bind(nextClientId(), tipo)
    .run();
  return result.meta.last_row_id as number;
}

async function count(table: string): Promise<number> {
  const row = await db().prepare(`SELECT COUNT(*) AS total FROM ${table}`).first<{ total: number }>();
  return row?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Estos tests van PRIMERO y no llaman a resetDatabase: leen el estado que dejaron
// las migraciones (datos semilla en las tablas renombradas, tablas nuevas vacías).
// ---------------------------------------------------------------------------
describe('migración 0009: tablas del modelo antiguo y tablas nuevas', () => {
  const LEGACY = ['matrimonios_legacy', 'bautismos_legacy', 'confirmaciones_legacy'];
  const NUEVAS = ['personas', 'sacramentos', 'matrimonios', 'bautismos', 'confirmaciones', 'cambios_persona'];

  it.each(LEGACY)('%s conserva sus datos de prueba tras el renombrado', async (table) => {
    expect(await count(table)).toBeGreaterThan(0);
  });

  it.each(NUEVAS)('%s empieza vacía', async (table) => {
    expect(await count(table)).toBe(0);
  });

  it('los triggers de versión de las tablas renombradas siguen funcionando', async () => {
    const before = await db()
      .prepare('SELECT id, version FROM bautismos_legacy LIMIT 1')
      .first<{ id: number; version: number }>();

    await db().prepare("UPDATE bautismos_legacy SET numero_libro = 'Z' WHERE id = ?").bind(before?.id).run();

    const after = await db()
      .prepare('SELECT version FROM bautismos_legacy WHERE id = ?')
      .bind(before?.id)
      .first<{ version: number }>();
    expect(after?.version).toBe((before?.version ?? 0) + 1);
  });

  it('el renombrado conservó el índice único de client_id sobre la tabla legacy', async () => {
    const index = await db()
      .prepare("SELECT tbl_name FROM sqlite_master WHERE type = 'index' AND name = 'idx_bautismos_client_id'")
      .first<{ tbl_name: string }>();

    expect(index?.tbl_name).toBe('bautismos_legacy');
  });
});

// ---------------------------------------------------------------------------
describe('personas', () => {
  beforeEach(setup);

  it('acepta varias personas sin DNI', async () => {
    await insertPersona(null);
    await insertPersona(null);

    expect(await count('personas')).toBe(2);
  });

  it('rechaza un DNI repetido', async () => {
    await insertPersona('12345678');

    await expect(insertPersona('12345678')).rejects.toThrow(/UNIQUE constraint failed: personas\.dni/);
  });

  it("rechaza un DNI vacío: debe guardarse NULL, no ''", async () => {
    await expect(insertPersona('')).rejects.toThrow(CHECK_ERROR);
  });

  it('exige client_id (olvidarlo falla de inmediato, no se rellena en silencio)', async () => {
    await expect(
      db()
        .prepare("INSERT INTO personas (parroquia_id, nombres, apellido_paterno) VALUES (1, 'X', 'Y')")
        .run(),
    ).rejects.toThrow(/NOT NULL constraint failed: personas\.client_id/);
  });

  it('exige client_id único', async () => {
    const insert = () =>
      db()
        .prepare("INSERT INTO personas (client_id, parroquia_id, nombres, apellido_paterno) VALUES ('repetido', 1, 'X', 'Y')")
        .run();
    await insert();

    await expect(insert()).rejects.toThrow(/UNIQUE constraint failed: personas\.client_id/);
  });

  it('rechaza una parroquia inexistente', async () => {
    await expect(
      db()
        .prepare("INSERT INTO personas (client_id, parroquia_id, nombres, apellido_paterno) VALUES ('p', 999, 'X', 'Y')")
        .run(),
    ).rejects.toThrow(FK_ERROR);
  });

  it('apellido materno vacío por defecto, version 1 y fechas ISO', async () => {
    const id = await insertPersona();

    const row = await db()
      .prepare('SELECT apellido_materno, version, created_at, updated_at FROM personas WHERE id = ?')
      .bind(id)
      .first<{ apellido_materno: string; version: number; created_at: string; updated_at: string }>();

    expect(row?.apellido_materno).toBe('');
    expect(row?.version).toBe(1);
    expect(row?.created_at).toMatch(ISO_UTC_MS);
    expect(row?.updated_at).toMatch(ISO_UTC_MS);
  });

  it('cada UPDATE sube version exactamente en 1 y refresca updated_at', async () => {
    const id = await insertPersona();
    const before = await db()
      .prepare('SELECT version, updated_at FROM personas WHERE id = ?')
      .bind(id)
      .first<{ version: number; updated_at: string }>();
    await tick();

    await db().prepare("UPDATE personas SET lugar_nacimiento = 'Puno' WHERE id = ?").bind(id).run();

    const after = await db()
      .prepare('SELECT version, updated_at FROM personas WHERE id = ?')
      .bind(id)
      .first<{ version: number; updated_at: string }>();
    expect(after?.version).toBe(2);
    expect(after!.updated_at > before!.updated_at).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('sacramentos', () => {
  beforeEach(setup);

  const insertWithEstado = (binds: unknown[]) =>
    db()
      .prepare(
        `INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision,
                                  estado, anulado_por_usuario_id, anulado_en, motivo_anulacion)
         VALUES (?, 'bautismo', 1, '1', '1', '1', '2024-01-01', 'anulado', ?, ?, ?)`,
      )
      .bind(...binds)
      .run();

  it('rechaza un tipo desconocido', async () => {
    await expect(insertSacramento('otro' as Tipo)).rejects.toThrow(CHECK_ERROR);
  });

  it('acepta una anulación completa: usuario, fecha y motivo', async () => {
    await insertWithEstado([nextClientId(), 1, '2024-02-01T00:00:00.000Z', 'Error de registro']);

    expect(await count('sacramentos')).toBe(1);
  });

  const INCOMPLETE: Array<[string, unknown[]]> = [
    ['sin motivo', [1, '2024-02-01T00:00:00.000Z', null]],
    ['con motivo vacío', [1, '2024-02-01T00:00:00.000Z', '']],
    ['sin usuario que anula', [null, '2024-02-01T00:00:00.000Z', 'Error']],
    ['sin fecha de anulación', [1, null, 'Error']],
  ];

  it.each(INCOMPLETE)('rechaza una anulación %s', async (_name, rest) => {
    await expect(insertWithEstado([nextClientId(), ...rest])).rejects.toThrow(CHECK_ERROR);
  });

  it('anular por UPDATE también exige los tres datos', async () => {
    const id = await insertSacramento('bautismo');

    await expect(
      db().prepare("UPDATE sacramentos SET estado = 'anulado' WHERE id = ?").bind(id).run(),
    ).rejects.toThrow(CHECK_ERROR);

    await db()
      .prepare(
        `UPDATE sacramentos
         SET estado = 'anulado', anulado_por_usuario_id = 1, anulado_en = ?, motivo_anulacion = 'Motivo'
         WHERE id = ?`,
      )
      .bind('2024-02-01T00:00:00.000Z', id)
      .run();
    const row = await db().prepare('SELECT estado FROM sacramentos WHERE id = ?').bind(id).first<{ estado: string }>();
    expect(row?.estado).toBe('anulado');
  });

  it('acepta libro, folio y número repetidos (solo se avisará del posible duplicado)', async () => {
    await insertSacramento('bautismo');
    await insertSacramento('bautismo');

    expect(await count('sacramentos')).toBe(2);
  });

  it('el ministro es opcional, pero si se indica debe existir', async () => {
    const insertWithMinistro = (ministroId: number | null) =>
      db()
        .prepare(
          `INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision)
           VALUES (?, 'bautismo', 1, ?, '1', '1', '1', '2024-01-01')`,
        )
        .bind(nextClientId(), ministroId)
        .run();

    await insertWithMinistro(null);
    await insertWithMinistro(1);
    await expect(insertWithMinistro(999)).rejects.toThrow(FK_ERROR);
  });

  it('cada UPDATE sube version exactamente en 1 y refresca updated_at', async () => {
    const id = await insertSacramento('bautismo');
    const before = await db()
      .prepare('SELECT version, updated_at FROM sacramentos WHERE id = ?')
      .bind(id)
      .first<{ version: number; updated_at: string }>();
    await tick();

    await db().prepare("UPDATE sacramentos SET anotaciones = 'nota' WHERE id = ?").bind(id).run();

    const after = await db()
      .prepare('SELECT version, updated_at FROM sacramentos WHERE id = ?')
      .bind(id)
      .first<{ version: number; updated_at: string }>();
    expect(after?.version).toBe(2);
    expect(after!.updated_at > before!.updated_at).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('subtipos: matrimonios, bautismos y confirmaciones', () => {
  beforeEach(setup);

  it('cada subtipo se enlaza a un sacramento de su propio tipo', async () => {
    const [p1, p2] = [await insertPersona(), await insertPersona()];
    const bautismo = await insertSacramento('bautismo');
    const confirmacion = await insertSacramento('confirmacion');
    const matrimonio = await insertSacramento('matrimonio');

    await db().prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)').bind(bautismo, p1).run();
    await db().prepare('INSERT INTO confirmaciones (sacramento_id, persona_id) VALUES (?, ?)').bind(confirmacion, p1).run();
    await db()
      .prepare('INSERT INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id) VALUES (?, ?, ?)')
      .bind(matrimonio, p1, p2)
      .run();

    expect(await count('bautismos')).toBe(1);
    expect(await count('confirmaciones')).toBe(1);
    expect(await count('matrimonios')).toBe(1);
  });

  const WRONG_TYPE: Array<[string, Tipo, string, (sac: number, p1: number, p2: number) => unknown[]]> = [
    [
      'un bautismo no puede colgar de un sacramento de tipo matrimonio',
      'matrimonio',
      'INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)',
      (sac, p1) => [sac, p1],
    ],
    [
      'una confirmación no puede colgar de un sacramento de tipo bautismo',
      'bautismo',
      'INSERT INTO confirmaciones (sacramento_id, persona_id) VALUES (?, ?)',
      (sac, p1) => [sac, p1],
    ],
    [
      'un matrimonio no puede colgar de un sacramento de tipo confirmación',
      'confirmacion',
      'INSERT INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id) VALUES (?, ?, ?)',
      (sac, p1, p2) => [sac, p1, p2],
    ],
  ];

  it.each(WRONG_TYPE)('%s', async (_name, tipo, sql, binds) => {
    const [p1, p2] = [await insertPersona(), await insertPersona()];
    const sacramento = await insertSacramento(tipo);

    await expect(
      db()
        .prepare(sql)
        .bind(...binds(sacramento, p1, p2))
        .run(),
    ).rejects.toThrow(FK_ERROR);
  });

  it('un sacramento admite una sola fila de subtipo (relación 1 a 1)', async () => {
    const persona = await insertPersona();
    const sacramento = await insertSacramento('bautismo');
    const insert = () =>
      db().prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)').bind(sacramento, persona).run();
    await insert();

    await expect(insert()).rejects.toThrow(/UNIQUE constraint failed: bautismos\.sacramento_id/);
  });

  it('rechaza una persona inexistente', async () => {
    const sacramento = await insertSacramento('bautismo');

    await expect(
      db().prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, 999)').bind(sacramento).run(),
    ).rejects.toThrow(FK_ERROR);
  });

  it('un matrimonio no puede tener a la misma persona como ambos cónyuges', async () => {
    const persona = await insertPersona();
    const sacramento = await insertSacramento('matrimonio');

    await expect(
      db()
        .prepare('INSERT INTO matrimonios (sacramento_id, conyuge_1_id, conyuge_2_id) VALUES (?, ?, ?)')
        .bind(sacramento, persona, persona)
        .run(),
    ).rejects.toThrow(CHECK_ERROR);
  });

  it('no se puede borrar un sacramento que tiene datos de subtipo', async () => {
    const persona = await insertPersona();
    const sacramento = await insertSacramento('bautismo');
    await db().prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)').bind(sacramento, persona).run();

    await expect(db().prepare('DELETE FROM sacramentos WHERE id = ?').bind(sacramento).run()).rejects.toThrow(FK_ERROR);
  });

  it('no se puede borrar una persona usada en una partida', async () => {
    const persona = await insertPersona();
    const sacramento = await insertSacramento('bautismo');
    await db().prepare('INSERT INTO bautismos (sacramento_id, persona_id) VALUES (?, ?)').bind(sacramento, persona).run();

    await expect(db().prepare('DELETE FROM personas WHERE id = ?').bind(persona).run()).rejects.toThrow(FK_ERROR);
  });
});

// ---------------------------------------------------------------------------
describe('cambios_persona', () => {
  beforeEach(setup);

  it('registra un cambio con la fecha en ISO por defecto y el sacramento opcional', async () => {
    const persona = await insertPersona();

    await db()
      .prepare(
        `INSERT INTO cambios_persona (persona_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo)
         VALUES (?, 1, 'apellido_paterno', 'Quispi', 'Quispe')`,
      )
      .bind(persona)
      .run();

    const row = await db()
      .prepare('SELECT sacramento_id, fecha_cambio FROM cambios_persona')
      .first<{ sacramento_id: number | null; fecha_cambio: string }>();
    expect(row?.sacramento_id).toBeNull();
    expect(row?.fecha_cambio).toMatch(ISO_UTC_MS);
  });

  it('exige un usuario y una persona existentes', async () => {
    const persona = await insertPersona();
    const insert = (personaId: number, usuarioId: number) =>
      db()
        .prepare("INSERT INTO cambios_persona (persona_id, usuario_id, campo_cambio) VALUES (?, ?, 'nombres')")
        .bind(personaId, usuarioId)
        .run();

    await expect(insert(persona, 999)).rejects.toThrow(FK_ERROR);
    await expect(insert(999, 1)).rejects.toThrow(FK_ERROR);
  });
});
