// @vitest-environment node
// La importación del Excel del sistema anterior y el paquete inicial. Las filas son inventadas: siguen
// el formato del archivo exportado (sin encabezado, columnas por posición), pero no son datos reales.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { BOOKS_HEADER, clean_cell, COLUMNS, date_cell, read_books, read_rows, read_workbook, RECORDS_HEADER, split_minister } from '../../electron/main/import/legacy_excel';
import { plan_import, preview_of, save_import } from '../../electron/main/controllers/legacy_import';
import { build_package, load_package, needs_package } from '../../electron/main/controllers/package';
import { verify_offline } from '../../electron/main/controllers/login';
import { read_marriage, read_person_sacrament, search_sacraments } from '../../electron/main/controllers/sacraments';
import type { Session } from '../../electron/main/models/session';
import { save_reference_data } from '../../electron/main/sync/sync';
import { create_server_hash } from '../../electron/main/utils/crypto';

const parroco: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const general: Session = { user_id: 3, role: 'admin_general', parish_id: null, token: 't' };

const DASHES = '--------------------------------------------------';

// Una fila del Excel: todo vacío (como lo deja el sistema anterior) salvo lo que se indique.
function row(values: Partial<Record<keyof typeof COLUMNS, unknown>>): unknown[] {
  const cells: unknown[] = new Array(45).fill(null);
  cells[COLUMNS.dni] = '------------';
  cells[COLUMNS.padrino] = DASHES;
  cells[COLUMNS.madrina] = DASHES;
  cells[COLUMNS.anotacion_marginal] = 'NINGUNA';
  cells[41] = false;
  for (const [key, value] of Object.entries(values)) cells[COLUMNS[key as keyof typeof COLUMNS]] = value;
  return cells;
}

const bautismo = (numero: number, values: Partial<Record<keyof typeof COLUMNS, unknown>> = {}) =>
  row({
    codigo_parroquia: 32,
    tipo_libro: 'B',
    num_libro: 13,
    folio: 112,
    numero_registro: numero,
    nombres: 'JUAN',
    apellido_paterno: 'QUISPE',
    apellido_materno: 'MAMANI',
    fecha_nacimiento: new Date(Date.UTC(1959, 0, 15)),
    fecha_sacramento: new Date(Date.UTC(1959, 9, 11)),
    celebrante: 'Pbro. PEDRO RAMOS DIAZ',
    fecha_ingreso: new Date(Date.UTC(2026, 8, 21)),
    ...values,
  });

const matrimonio = row({
  codigo_parroquia: 32,
  tipo_libro: 'M',
  num_libro: 4,
  folio: 108,
  numero_registro: 215,
  nombres: 'TOMAS',
  apellido_paterno: 'CONDORI',
  apellido_materno: 'CRUZ',
  fecha_nacimiento_aprox: '(27 AÑOS AL DIA DE BODA)',
  lugar_nacimiento: 'CRUCERO',
  fecha_sacramento: new Date(Date.UTC(1958, 9, 2)),
  lugar_matrimonio: 'Parroquia de prueba',
  padre: 'JOSE CONDORI',
  celebrante: 'Pbro. PEDRO RAMOS',
  padrino: 'EMILIO PAZ Y ESPOSA',
  madrina: 'AGUSTIN RIOS Y ESPOSA',
  novia_nombres: 'CARMEN',
  novia_apellido_paterno: 'HUAMAN',
  novia_apellido_materno: 'LOPEZ',
  novia_fecha_nacimiento_aprox: '(28 AÑOS AL DIA DE BODA)',
  parroquia_bautizo_novio: 'PARROQUIA DE CRUCERO',
  fecha_bautizo_novia_aprox: 'ENERO DE 1930',
  testigo_3: 'DAVID PAZ',
  testigo_4: 'ADRIAN RIOS',
  fecha_ingreso: new Date(Date.UTC(2026, 5, 4)),
});

// La hoja "parroquialibros": en matrimonios el nombre del libro no es su número.
const BOOK_ROWS = [
  [32, 'B', 13, '13', null],
  [32, 'M', 4, 'M38/60', '1938-1960'],
];
const BOOKS = read_books(BOOK_ROWS);

const read = (rows: unknown[][]) => read_rows(rows, BOOKS);

let dir: string;
let db: LocalDatabase;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-legacy-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function seed(): void {
  save_reference_data(db, {
    parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
    ministros: [{ id: 1, client_id: 'ministro-1', parroquia_id: 1, titulo: 'P.', nombre: 'Pedro', apellido_paterno: 'Ramos', apellido_materno: 'Díaz', activo: 1, version: 1 }],
    usuarios: [
      { id: 1, client_id: 'servidor-1', parroquia_id: 1, username: 'parroco', rol: 'admin_parroquia', nombre: 'P', apellido_paterno: 'A', apellido_materno: 'B', activo: 1, version: 1 },
      { id: 3, client_id: 'servidor-3', parroquia_id: null, username: 'general', rol: 'admin_general', nombre: 'G', apellido_paterno: 'A', apellido_materno: 'B', activo: 1, version: 1 },
    ],
  });
}

describe('leer el Excel del sistema anterior', () => {
  it('limpia los rellenos del sistema anterior y lee las fechas', () => {
    expect(clean_cell('------------')).toBeNull();
    expect(clean_cell('  CRUCERO ')).toBe('CRUCERO');
    expect(date_cell(new Date(Date.UTC(1959, 0, 15)))).toBe('1959-01-15');
    expect(date_cell('15/01/1959')).toBe('1959-01-15');
    expect(date_cell('22 AG 1978')).toBeNull();
  });

  it('separa el título y los apellidos del celebrante', () => {
    expect(split_minister('Pbro. ROLANDO LINARES')).toEqual({ titulo: 'Pbro.', nombre: 'ROLANDO', apellido_paterno: 'LINARES', apellido_materno: '' });
    expect(split_minister('Pbro. ANIBAL HERENCIA DURAND')).toEqual({ titulo: 'Pbro.', nombre: 'ANIBAL', apellido_paterno: 'HERENCIA', apellido_materno: 'DURAND' });
    expect(split_minister('HNO JULIO CASTELLANOS')).toEqual({ titulo: 'HNO', nombre: 'JULIO', apellido_paterno: 'CASTELLANOS', apellido_materno: '' });
    expect(split_minister(DASHES)).toBeNull();
  });

  it('lee un bautismo: libro, folio y número como texto, aunque el folio tenga decimales', () => {
    const { partidas, errores } = read([bautismo(1, { folio: 0.1, padrino: 'DIONISIO QUISPE' })]);

    expect(errores).toEqual([]);
    expect(partidas[0]).toMatchObject({
      fila: 1,
      tipo: 'bautismo',
      libro: '13',
      folio: '0.1',
      numero: '1',
      // La fecha de la partida es la del sacramento, no la de ingreso al sistema anterior.
      fecha_emision: '1959-10-11',
      fecha_evento: '1959-10-11',
      anotaciones: null,
      celebrante: { titulo: 'Pbro.', nombre: 'PEDRO', apellido_paterno: 'RAMOS', apellido_materno: 'DIAZ' },
      personas: [{ nombres: 'JUAN', dni: null, fecha_nacimiento: '1959-01-15', fecha_aproximada: null }],
      detalle: { padrino_1: 'DIONISIO QUISPE', padrino_2: null },
    });
  });

  it('una partida sin fecha del sacramento queda sin fecha (la de ingreso al sistema anterior no se usa)', () => {
    const [record] = read([bautismo(1, { fecha_sacramento: null })]).partidas;

    expect(record).toMatchObject({ fecha_emision: null, fecha_evento: null });
  });

  it('lee un matrimonio con el novio, la novia, sus testigos y las fechas aproximadas', () => {
    const [record] = read([matrimonio]).partidas;

    expect(record.tipo).toBe('matrimonio');
    // El libro se guarda con su nombre, no con su número.
    expect(record.libro).toBe('M38/60');
    expect(record.personas.map((person) => [person.nombres, person.fecha_aproximada])).toEqual([
      ['TOMAS', '(27 AÑOS AL DIA DE BODA)'],
      ['CARMEN', '(28 AÑOS AL DIA DE BODA)'],
    ]);
    expect(record.detalle).toMatchObject({ lugar: 'Parroquia de prueba', testigo_1: 'EMILIO PAZ Y ESPOSA', testigo_3: 'DAVID PAZ', conyuge_1_bautismo_parroquia: 'PARROQUIA DE CRUCERO' });
    // Lo que no tiene columna en el sistema nuevo queda en las anotaciones.
    expect(record.anotaciones).toBe('Fecha aproximada del bautizo de la esposa: ENERO DE 1930');
  });

  it('salta el encabezado si es el del formato, y salta (avisando) las filas incompletas o repetidas', () => {
    const rows = [[...RECORDS_HEADER], bautismo(1), bautismo(1), bautismo(2, { nombres: DASHES }), bautismo(3, { num_libro: 99 }), new Array(45).fill(null)];
    const { partidas, errores } = read(rows);

    expect(partidas.map((record) => record.numero)).toEqual(['1']);
    expect(errores).toEqual([
      { fila: 3, motivo: 'Repite la partida de la fila 2.' },
      { fila: 4, motivo: 'Falta el nombre.' },
      { fila: 5, motivo: 'El libro B 99 no está en la hoja "parroquialibros".' },
    ]);
  });

  it('no importa nada si el formato no es el del sistema anterior', () => {
    const sheets = (feligres: unknown[][], libros: unknown[][] = BOOK_ROWS) => [
      { sheet: 'feligres', data: feligres },
      { sheet: 'parroquialibros', data: libros },
    ];

    expect(read_workbook(sheets([bautismo(1)])).partidas).toHaveLength(1);
    expect(() => read_workbook([{ sheet: 'Hoja1', data: [bautismo(1)] }])).toThrow(/no tiene la hoja "parroquialibros"/);
    expect(() => read_workbook([{ sheet: 'parroquialibros', data: BOOK_ROWS }])).toThrow(/no tiene la hoja "feligres"/);
    expect(() => read_workbook(sheets([bautismo(1).slice(0, 40)]))).toThrow(/45 columnas/);
    expect(() => read_workbook(sheets([['COD', ...RECORDS_HEADER.slice(1)], bautismo(1)]))).toThrow(/columna 1 dice "COD"/);
    expect(() => read_workbook(sheets([bautismo(1), bautismo(2, { tipo_libro: 'X' })]))).toThrow(/fila 2 .* no es B, C ni M/);
    expect(() => read_workbook(sheets([bautismo(1), bautismo(2, { codigo_parroquia: 40 })]))).toThrow(/más de una parroquia/);
    expect(() => read_workbook(sheets([bautismo(1)], [[40, 'B', 13, '13', null]]))).toThrow(/más de una parroquia/);
    // Con tildes o mayúsculas distintas, el encabezado sigue siendo el mismo.
    expect(read_workbook(sheets([bautismo(1)], [[...BOOKS_HEADER].map((name) => name?.toLowerCase() ?? null), ...BOOK_ROWS])).partidas).toHaveLength(1);
  });

  it('sin encabezado, la primera fila ya es una partida', () => {
    expect(read([bautismo(1), bautismo(2)]).partidas).toHaveLength(2);
  });

  it('conserva la anotación marginal', () => {
    const [record] = read([bautismo(1, { anotacion_marginal: 'CONTRAJO MATRIMONIO EL 2002' })]).partidas;
    expect(record.anotaciones).toBe('CONTRAJO MATRIMONIO EL 2002');
  });
});

describe('importar a la parroquia', () => {
  it('guarda solo las nuevas, con el celebrante existente o uno nuevo, y las deja en la cola', () => {
    seed();
    const parsed = read([bautismo(1), bautismo(2, { celebrante: 'Fr. LUIS SOTO' }), matrimonio]);

    expect(save_import(db, parroco, parsed.partidas)).toEqual({ importadas: 3, omitidas: 0 });

    const ministers = db.prepare('SELECT titulo, nombre, apellido_paterno FROM ministros ORDER BY id').all();
    expect(ministers).toEqual([
      { titulo: 'P.', nombre: 'Pedro', apellido_paterno: 'Ramos' },
      { titulo: 'Fr.', nombre: 'LUIS', apellido_paterno: 'SOTO' },
      { titulo: 'Pbro.', nombre: 'PEDRO', apellido_paterno: 'RAMOS' },
    ]);
    expect(db.prepare('SELECT entidad, COUNT(*) AS total FROM sync_cola GROUP BY entidad ORDER BY entidad').all()).toEqual([
      { entidad: 'bautismo', total: 2 },
      { entidad: 'matrimonio', total: 1 },
      { entidad: 'ministro', total: 2 },
    ]);

    const found = search_sacraments(db, 'bautismo', { nombres: 'JUAN' }).resultados;
    expect(found).toHaveLength(2);
    expect(read_person_sacrament(db, 'bautismo', found[0].sacramento.id as number).sacramento.ministro_id).toBe(1);

    const marriage = search_sacraments(db, 'matrimonio', {}).resultados[0];
    expect(read_marriage(db, marriage.sacramento.id as number).conyuge_2.nombres).toBe('CARMEN');
  });

  it('avisa de las que ya están y no las vuelve a cargar', () => {
    seed();
    save_import(db, parroco, read([bautismo(1)]).partidas);

    const parsed = read([bautismo(1), bautismo(2)]);
    const plan = plan_import(db, 1, parsed);
    const preview = preview_of('archivo.xlsx', plan);

    expect(preview).toMatchObject({ total: 2, nuevas: 1, por_tipo: { bautismo: 1 }, codigos_parroquia: ['32'] });
    expect(preview.existentes).toEqual([{ fila: 1, tipo: 'bautismo', libro: '13', folio: '112', numero: '1', nombre: 'JUAN QUISPE MAMANI' }]);

    expect(save_import(db, parroco, parsed.partidas)).toEqual({ importadas: 1, omitidas: 1 });
    expect(db.prepare('SELECT COUNT(*) FROM sacramentos').pluck().get()).toBe(2);
  });

  it('solo el párroco importa', () => {
    seed();
    const records = read([bautismo(1)]).partidas;
    expect(() => save_import(db, general, records)).toThrow(/administrador de la parroquia/);
    expect(() => save_import(db, { ...parroco, role: 'usuario' }, records)).toThrow(/administrador de la parroquia/);
  });
});

describe('paquete inicial', () => {
  it('una PC nueva carga el paquete y ya puede entrar sin internet y consultar', async () => {
    seed();
    db.prepare('INSERT INTO credenciales_locales (usuario_id, verificador) VALUES (1, ?)').run(await create_server_hash('clave-del-parroco'));
    save_import(db, parroco, read([bautismo(1), matrimonio]).partidas);
    db.exec('DELETE FROM sync_cola'); // como si ya se hubiera sincronizado

    const content = build_package(db, general);
    expect(content).toMatchObject({ formato: 'prelatura-paquete-inicial', usuarios: [{ id: 1 }, { id: 3 }] });

    const other = open_local_database(path.join(dir, 'nueva.db'), randomBytes(32).toString('hex'));
    try {
      expect(needs_package(other)).toBe(true);
      expect(load_package(other, JSON.parse(JSON.stringify(content)))).toEqual({ parroquias: 1, usuarios: 2, partidas: 2 });

      expect(await verify_offline(other, 'parroco', 'clave-del-parroco')).toMatchObject({ ok: true, usuario: { rol: 'admin_parroquia' } });
      expect(search_sacraments(other, 'bautismo', { nombres: 'JUAN' }).resultados).toHaveLength(1);
      // Lo cargado cuenta como sincronizado: no hay nada que subir.
      expect(other.prepare('SELECT COUNT(*) FROM sync_cola').pluck().get()).toBe(0);

      // Una PC que ya tiene usuarios no acepta otro paquete.
      expect(() => load_package(other, content)).toThrow(/PC nueva/);
    } finally {
      other.close();
    }
  });

  it('solo el administrador general lo genera, y con todo sincronizado', () => {
    seed();
    expect(() => build_package(db, parroco)).toThrow(/administrador general/);

    save_import(db, parroco, read([bautismo(1)]).partidas);
    expect(() => build_package(db, general)).toThrow(/Sincronice/);
  });

  it('rechaza un archivo que no es un paquete', () => {
    expect(() => load_package(db, { formato: 'otro' })).toThrow(/no es un paquete/);
  });
});
