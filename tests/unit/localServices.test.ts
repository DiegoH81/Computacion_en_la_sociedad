// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLocalDatabase, type LocalDatabase } from '../../electron/main/localDb/database';
import { LOCAL_MIGRATIONS } from '../../electron/main/localDb/schema';
import type { Session } from '../../electron/main/services/common';
import { marriages, type MarriageInput } from '../../electron/main/services/marriages';
import { ministers } from '../../electron/main/services/ministers';
import { readParishLogo, saveParishLogo } from '../../electron/main/services/parishLogo';
import { applyReferenceData, listParishes } from '../../electron/main/services/reference';
import { getIndexEntries, listIndexBooks } from '../../electron/main/services/sacramentIndex';
import { singlePersonSacrament, type SinglePersonInput } from '../../electron/main/services/singlePersonSacraments';

const baptisms = singlePersonSacrament('bautismo');
const confirmations = singlePersonSacrament('confirmacion');

const parish1: Session = { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1, token: 't' };
const parish2: Session = { usuarioId: 2, rol: 'usuario_parroquia', parroquiaId: 2, token: 't' };
const admin: Session = { usuarioId: 3, rol: 'admin', parroquiaId: null, token: 't' };

let dir: string;
let db: LocalDatabase;

const baptismInput = (overrides: Partial<SinglePersonInput> = {}): SinglePersonInput => ({
  fechaSacramento: '2010-06-15',
  numeroLibro: '2',
  numeroFolio: '1',
  numeroRegistro: '713',
  nombre: 'Diago',
  apellidoPaterno: 'Guido',
  apellidoMaterno: 'Alvaro',
  ...overrides,
});

const marriageInput = (overrides: Partial<MarriageInput> = {}): MarriageInput => ({
  fechaSacramento: '2024-05-10',
  numeroLibro: '5',
  numeroFolio: '3',
  numeroRegistro: '20',
  esposo: { nombre: 'Braulio', apellidoPaterno: 'Guido', apellidoMaterno: 'Alvaro', parroquiaBautismo: 'San Juan' },
  esposa: { nombre: 'Maria', apellidoPaterno: 'Torres', apellidoMaterno: 'Rios', fechaBautismo: '1990-01-01' },
  testigo1: 'Testigo Uno',
  ...overrides,
});

const search = (filters: Record<string, unknown>) =>
  baptisms.search(db, filters).rows as { id: number; nombre: string; parroquia_nombre: string }[];

const count = (table: string) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-services-'));
  db = openLocalDatabase(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number | null, rol: string) => ({
    id,
    parroquia_id,
    username: `user${id}`,
    rol,
    nombre: 'U',
    apellido_paterno: 'P',
    apellido_materno: 'M',
    activo: 1,
  });
  applyReferenceData(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [{ id: 1, client_id: 'ministro-1', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1, version: 1 }],
    usuarios: [user(1, 1, 'usuario_parroquia'), user(2, 2, 'usuario_parroquia'), user(3, null, 'admin')],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('crear partidas', () => {
  it('reparte los datos entre personas, sacramentos y bautismos', () => {
    const id = baptisms.create(
      db,
      parish1,
      baptismInput({ dni: '12345678', edad: '30', fechaBautizo: '2010-07-01', celebranteId: 1, padrino: 'Pedro', madrina: 'Ana', anotaciones: 'Nota' }),
      undefined,
    );

    expect(baptisms.getById(db, id)).toMatchObject({
      parroquia_nombre: 'Parroquia 1',
      fecha_sacramento: '2010-06-15',
      numero_libro: '2',
      dni: '12345678',
      nombre: 'Diago',
      edad: 30,
      fecha_nacimiento: null,
      fecha_bautizo: '2010-07-01',
      celebrante_id: 1,
      celebrante_nombre: 'Manuel Torres Rios',
      padrino: 'Pedro',
      madrina: 'Ana',
      anotaciones: 'Nota',
      estado: 'vigente',
    });
  });

  it('cada partida crea su propia persona aunque los datos coincidan', () => {
    baptisms.create(db, parish1, baptismInput({ dni: '12345678' }), undefined);
    confirmations.create(db, parish1, baptismInput({ dni: '12345678' }), undefined);

    expect(count('personas')).toBe(2);
  });

  it('un usuario de parroquia ignora la parroquia enviada; un admin debe indicarla', () => {
    const id = baptisms.create(db, parish1, baptismInput(), 2);
    expect(baptisms.getById(db, id)).toMatchObject({ parroquia_id: 1 });

    expect(() => baptisms.create(db, admin, baptismInput(), undefined)).toThrow(/parroquia/);
    const adminId = baptisms.create(db, admin, baptismInput(), 2);
    expect(baptisms.getById(db, adminId)).toMatchObject({ parroquia_id: 2 });
  });

  it('valida los datos requeridos y la edad', () => {
    expect(() => baptisms.create(db, parish1, baptismInput({ nombre: '  ' }), undefined)).toThrow(/requeridos/);
    expect(() => baptisms.create(db, parish1, baptismInput({ numeroLibro: '' }), undefined)).toThrow(/libro/);
    expect(() => baptisms.create(db, parish1, baptismInput({ edad: 'abc' }), undefined)).toThrow(/edad/);
  });

  it('si algo falla no deja la persona ni el sacramento a medias', () => {
    expect(() => baptisms.create(db, parish1, baptismInput({ celebranteId: 999 }), undefined)).toThrow(/FOREIGN KEY/);

    expect(count('personas')).toBe(0);
    expect(count('sacramentos')).toBe(0);
  });
});

describe('corregir partidas', () => {
  it('la nota marginal corrige el dato y registra el cambio con su sacramento y usuario', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    baptisms.update(db, parish1, id, baptismInput({
      anotaciones: 'Corregido por resolución 12',
      correcciones: [
        { campo: 'nombres', valorNuevo: 'Diego' },
        { campo: 'apellido_materno', valorNuevo: 'Alva' },
      ],
    }));

    const changes = db
      .prepare('SELECT sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo FROM cambios_persona ORDER BY campo_cambio')
      .all();
    expect(changes).toEqual([
      { sacramento_id: id, usuario_id: 1, campo_cambio: 'apellido_materno', valor_anterior: 'Alvaro', valor_nuevo: 'Alva' },
      { sacramento_id: id, usuario_id: 1, campo_cambio: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' },
    ]);
    expect(baptisms.getById(db, id)).toMatchObject({
      nombre: 'Diego',
      apellido_materno: 'Alva',
      anotaciones: 'Corregido por resolución 12',
      correcciones: [
        { campo: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' },
        { campo: 'apellido_materno', valor_anterior: 'Alvaro', valor_nuevo: 'Alva' },
      ],
    });
  });

  it('editar el formulario directamente cambia el dato sin registrar una corrección', () => {
    const id = baptisms.create(db, parish1, baptismInput({ edad: '30' }), undefined);

    baptisms.update(db, parish1, id, baptismInput({ nombre: 'Diego', edad: '31' }));

    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diego', edad: 31 });
    expect(count('cambios_persona')).toBe(0);
  });

  it('una partida nueva puede venir con su nota marginal', () => {
    const id = confirmations.create(db, parish1, baptismInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }), undefined);

    expect(confirmations.getById(db, id)).toMatchObject({
      nombre: 'Diego',
      correcciones: [{ campo: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' }],
    });
  });

  it('en un matrimonio cada corrección queda en el cónyuge indicado', () => {
    const id = marriages.create(db, parish1, marriageInput(), undefined);

    marriages.update(db, parish1, id, marriageInput({
      correcciones: [
        { persona: 'esposa', campo: 'nombres', valorNuevo: 'Mariela' },
        { persona: 'esposo', campo: 'apellido_paterno', valorNuevo: 'Guidos' },
      ],
    }));

    expect(marriages.getById(db, id)).toMatchObject({
      esposo_nombre: 'Braulio',
      esposo_apellido_paterno: 'Guidos',
      esposa_nombre: 'Mariela',
    });
    const { correcciones } = marriages.getById(db, id) as unknown as { correcciones: { persona: string; campo: string }[] };
    expect(correcciones.map(({ persona, campo }) => [persona, campo]).sort()).toEqual([
      ['esposa', 'nombres'],
      ['esposo', 'apellido_paterno'],
    ]);
    expect(() => marriages.update(db, parish1, id, marriageInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'X' }] }))).toThrow(/cónyuge/);
  });

  it('rechaza una corrección inválida sin cambiar nada', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);
    const correct = (correcciones: object[]) => () => baptisms.update(db, parish1, id, baptismInput({ nombre: 'Otro', correcciones }));

    expect(correct([{ campo: 'nombres', valorNuevo: '  ' }])).toThrow(/valor nuevo/);
    expect(correct([{ campo: 'nombres', valorNuevo: 'Otro' }])).toThrow(/igual al anterior/);
    expect(correct([{ campo: 'dni', valorNuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([{ campo: 'constructor', valorNuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([{ campo: 'nombres', valorNuevo: 'A' }, { campo: 'nombres', valorNuevo: 'B' }])).toThrow(/repite/);

    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diago' });
    expect(count('cambios_persona')).toBe(0);
  });

  it('guardar sin cambios en la persona no registra nada ni sube su versión', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    baptisms.update(db, parish1, id, baptismInput({ anotaciones: 'Solo la nota' }));

    expect(count('cambios_persona')).toBe(0);
    expect(db.prepare('SELECT version FROM personas').pluck().get()).toBe(1);
    expect(baptisms.getById(db, id)).toMatchObject({ anotaciones: 'Solo la nota' });
  });

  it('corregir una partida no altera otra de la misma persona', () => {
    const baptismId = baptisms.create(db, parish1, baptismInput({ dni: '12345678' }), undefined);
    const confirmationId = confirmations.create(db, parish1, baptismInput({ dni: '12345678' }), undefined);

    baptisms.update(db, parish1, baptismId, baptismInput({ dni: '12345678', nombre: 'Diego' }));

    expect(baptisms.getById(db, baptismId)).toMatchObject({ nombre: 'Diego' });
    expect(confirmations.getById(db, confirmationId)).toMatchObject({ nombre: 'Diago' });
  });

  it('no permite modificar partidas de otra parroquia, pero sí un admin', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    expect(() => baptisms.update(db, parish2, id, baptismInput({ nombre: 'Otro' }))).toThrow(/otra parroquia/);
    expect(() => baptisms.annul(db, parish2, id, 'motivo')).toThrow(/otra parroquia/);
    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diago', estado: 'vigente' });

    baptisms.update(db, admin, id, baptismInput({ nombre: 'Diego' }));
    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diego' });
  });

  it('no confunde un bautismo con otro tipo de sacramento', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    expect(() => confirmations.update(db, parish1, id, baptismInput())).toThrow(/no encontrada/);
    expect(() => confirmations.getById(db, id)).toThrow(/no encontrada/);
  });

  it('anular exige motivo y guarda quién y por qué', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    expect(() => baptisms.annul(db, parish1, id, '   ')).toThrow(/motivo/);

    baptisms.annul(db, parish1, id, 'Duplicada');
    expect(baptisms.getById(db, id)).toMatchObject({
      estado: 'anulado',
      anulado_por_usuario_id: 1,
      motivo_anulacion: 'Duplicada',
    });
  });
});

describe('búsqueda', () => {
  it('encuentra por el nombre actual y por el valor anterior corregido', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);
    baptisms.update(db, parish1, id, baptismInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'Diogo' }] }));
    baptisms.update(db, parish1, id, baptismInput({ nombre: 'Diogo', correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }));

    for (const nombre of ['Diego', 'Diago', 'Diogo']) {
      expect(search({ nombre }).map((row) => row.nombre)).toEqual(['Diego']);
    }
    expect(search({ nombre: 'Pablo' })).toEqual([]);
  });

  it('una corrección de apellido no hace coincidir el filtro de nombre', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);
    baptisms.update(db, parish1, id, baptismInput({ correcciones: [{ campo: 'apellido_paterno', valorNuevo: 'Rojas' }] }));

    expect(search({ apellidoPaterno: 'Guido' })).toHaveLength(1);
    expect(search({ nombre: 'Guido' })).toEqual([]);
  });

  it('muestra partidas de otras parroquias para consulta', () => {
    baptisms.create(db, parish2, baptismInput(), undefined);

    expect(search({}).map((row) => row.parroquia_nombre)).toEqual(['Parroquia 2']);
  });

  it('pagina y ordena; un campo de orden desconocido no llega al SQL', () => {
    for (let i = 0; i < 25; i++) {
      baptisms.create(db, parish1, baptismInput({ nombre: `Persona ${String(i).padStart(2, '0')}` }), undefined);
    }

    const first = baptisms.search(db, { page: 1, sortBy: 'nombre', sortDirection: 'desc' });
    expect(first.totalPages).toBe(2);
    expect(first.rows).toHaveLength(20);
    expect((first.rows[0] as { nombre: string }).nombre).toBe('Persona 24');
    expect(baptisms.search(db, { page: 2 }).rows).toHaveLength(5);
    expect(baptisms.search(db, { sortBy: '1; DROP TABLE personas' }).rows).toHaveLength(20);
  });
});

describe('matrimonios', () => {
  it('guarda dos personas y lo que declara la partida sobre su bautismo', () => {
    const id = marriages.create(db, parish1, marriageInput({ celebranteId: 1, notasMarginales: 'Nota' }), undefined);

    expect(count('personas')).toBe(2);
    expect(marriages.getById(db, id)).toMatchObject({
      esposo_nombre: 'Braulio',
      esposo_parroquia_bautismo: 'San Juan',
      esposa_nombre: 'Maria',
      esposa_fecha_bautismo: '1990-01-01',
      testigo_1: 'Testigo Uno',
      notas_marginales: 'Nota',
      celebrante_nombre: 'Manuel Torres Rios',
    });
  });

  it('busca en ambos cónyuges, también por valores corregidos', () => {
    const id = marriages.create(db, parish1, marriageInput(), undefined);
    marriages.update(db, parish1, id, marriageInput({
      correcciones: [{ persona: 'esposa', campo: 'nombres', valorNuevo: 'Marta' }],
    }));

    for (const nombre of ['Braulio', 'Marta', 'Maria']) {
      expect(marriages.search(db, { nombre }).rows).toHaveLength(1);
    }
  });

  it('exige ambos nombres y respeta la parroquia', () => {
    expect(() =>
      marriages.create(db, parish1, marriageInput({ esposa: { nombre: '' } }), undefined),
    ).toThrow(/ambos cónyuges/);

    const id = marriages.create(db, parish1, marriageInput(), undefined);
    expect(() => marriages.annul(db, parish2, id, 'motivo')).toThrow(/otra parroquia/);
  });
});

describe('índice de sacramentos', () => {
  it('lista libros y entradas vigentes en orden alfabético, con una línea por cónyuge', () => {
    marriages.create(db, parish1, marriageInput(), undefined);
    const annulled = marriages.create(db, parish1, marriageInput({ numeroLibro: '9' }), undefined);
    marriages.annul(db, parish1, annulled, 'Error');

    expect(listIndexBooks(db, parish1, 'matrimonio', 1)).toEqual(['5']);
    expect(getIndexEntries(db, parish1, 'matrimonio', 1, null).map((entry) => entry.nombres)).toEqual(['Braulio', 'Maria']);
    expect(getIndexEntries(db, parish1, 'matrimonio', 1, 'no-existe')).toEqual([]);
  });

  it('solo se imprime el índice de la propia parroquia, salvo un admin', () => {
    expect(() => listIndexBooks(db, parish2, 'bautismo', 1)).toThrow(/otra parroquia/);
    expect(listIndexBooks(db, admin, 'bautismo', 1)).toEqual([]);
    expect(() => listIndexBooks(db, admin, 'personas; DROP', 1)).toThrow(/no válido/);
  });
});

describe('datos de referencia', () => {
  it('lista las parroquias activas de la copia local, en orden', () => {
    applyReferenceData(db, {
      parroquias: [
        { id: 1, nombre: 'Zeta', ubicacion: null, activa: 1 },
        { id: 2, nombre: 'Alfa', ubicacion: null, activa: 1 },
        { id: 3, nombre: 'Cerrada', ubicacion: null, activa: 0 },
      ],
      ministros: [],
      usuarios: [],
    });

    expect(listParishes(db)).toEqual([
      { id: 2, nombre: 'Alfa' },
      { id: 1, nombre: 'Zeta' },
    ]);
  });

  it('actualiza parroquias, y no pisa ni duplica los ministros que ya están en la PC', () => {
    const id = baptisms.create(db, parish1, baptismInput({ celebranteId: 1 }), undefined);
    ministers.update(db, parish1, 1, { nombre: 'Manolo', apellidoPaterno: 'Torres', apellidoMaterno: 'Rios' });

    applyReferenceData(db, {
      parroquias: [{ id: 1, nombre: 'Parroquia Renombrada', ubicacion: 'Ayaviri', activa: 1 }],
      ministros: [{ id: 1, client_id: 'ministro-1', parroquia_id: 1, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1 }],
      usuarios: [],
    });

    expect(count('parroquias')).toBe(2);
    expect(count('ministros')).toBe(1);
    expect(baptisms.getById(db, id)).toMatchObject({
      parroquia_nombre: 'Parroquia Renombrada',
      celebrante_nombre: 'Manolo Torres Rios',
    });
  });
});

describe('logo de la parroquia', () => {
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

  it('se guarda por parroquia y se puede cambiar y quitar', () => {
    expect(readParishLogo(dir, 1)).toBeNull();

    saveParishLogo(dir, parish1, 1, LOGO);
    expect(readParishLogo(dir, 1)).toBe(LOGO);
    expect(readParishLogo(dir, 2)).toBeNull();

    saveParishLogo(dir, parish1, 1, 'data:image/webp;base64,UklGRg==');
    expect(readParishLogo(dir, 1)).toBe('data:image/webp;base64,UklGRg==');

    saveParishLogo(dir, parish1, 1, null);
    expect(readParishLogo(dir, 1)).toBeNull();
  });

  it('un usuario solo cambia el de su parroquia; un admin, cualquiera', () => {
    expect(() => saveParishLogo(dir, parish1, 2, LOGO)).toThrow(/propia parroquia/);
    expect(readParishLogo(dir, 2)).toBeNull();

    saveParishLogo(dir, admin, 2, LOGO);
    expect(readParishLogo(dir, 2)).toBe(LOGO);
  });

  it('rechaza lo que no sea una imagen permitida o sea demasiado grande', () => {
    for (const logo of [
      'no es una imagen',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:text/html;base64,PGh0bWw+',
      'data:image/png;base64,no-es-base64!',
      `data:image/png;base64,${'A'.repeat(400_000)}`,
      123,
      undefined,
    ]) {
      expect(() => saveParishLogo(dir, parish1, 1, logo)).toThrow(/PNG, JPG o WEBP/);
    }
    expect(readParishLogo(dir, 1)).toBeNull();
  });
});

describe('celebrantes por parroquia', () => {
  it('la búsqueda se limita a la parroquia indicada', () => {
    ministers.create(db, parish2, { nombre: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Paz' }, undefined);
    const names = (filters: Record<string, unknown>) =>
      (ministers.search(db, filters).priests as { nombre: string }[]).map((row) => row.nombre);

    expect(names({ parroquiaId: 1 })).toEqual(['Manuel']);
    expect(names({ parroquiaId: 2 })).toEqual(['Luis']);
    expect(ministers.search(db, { parroquiaId: 2, nombre: 'Manuel' }).priests).toEqual([]);
  });

  it('una partida no acepta un celebrante de otra parroquia', () => {
    expect(() => baptisms.create(db, parish2, baptismInput({ celebranteId: 1 }), undefined)).toThrow(/parroquia de la partida/);
    expect(() => marriages.create(db, admin, marriageInput({ celebranteId: 1 }), 2)).toThrow(/parroquia de la partida/);
    expect(count('sacramentos')).toBe(0);

    const id = baptisms.create(db, parish2, baptismInput(), undefined);
    expect(() => baptisms.update(db, parish2, id, baptismInput({ celebranteId: 1 }))).toThrow(/parroquia de la partida/);
    expect(baptisms.getById(db, id)).toMatchObject({ celebrante_id: null });
  });

  it('una partida ya registrada con un celebrante de otra parroquia se puede seguir editando', () => {
    const id = baptisms.create(db, parish2, baptismInput(), undefined);
    db.prepare('UPDATE sacramentos SET ministro_id = 1 WHERE id = ?').run(id);

    baptisms.update(db, parish2, id, baptismInput({ celebranteId: 1, padrino: 'Pedro' }));

    expect(baptisms.getById(db, id)).toMatchObject({ celebrante_id: 1, padrino: 'Pedro' });
  });
});

describe('ministros', () => {
  const input = { titulo: 'Mons.', nombre: 'Pedro', apellidoPaterno: 'Vargas', apellidoMaterno: 'Chavez' };
  const names = (filters: Record<string, unknown>) =>
    (ministers.search(db, filters).priests as { nombre: string }[]).map((row) => row.nombre);

  it('se crean en la PC con título y un id que no choca con el servidor', () => {
    const id = ministers.create(db, parish1, input, undefined);

    expect(id).not.toBe(1);
    expect(db.prepare('SELECT titulo, parroquia_id, version FROM ministros WHERE id = ?').get(id)).toEqual({
      titulo: 'Mons.',
      parroquia_id: 1,
      version: 1,
    });
    expect(db.prepare('SELECT client_id FROM ministros WHERE id = ?').pluck().get(id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un ministro creado aquí se puede usar en una partida', () => {
    const ministerId = ministers.create(db, parish1, input, undefined);
    const id = baptisms.create(db, parish1, baptismInput({ celebranteId: ministerId }), undefined);

    expect(baptisms.getById(db, id)).toMatchObject({ celebrante_nombre: 'Pedro Vargas Chavez' });
  });

  it('busca por nombre y apellidos, y ordena', () => {
    ministers.create(db, parish1, input, undefined);

    expect(names({ nombre: 'Man' })).toEqual(['Manuel']);
    expect(names({ apellidoPaterno: 'Varg' })).toEqual(['Pedro']);
    expect(names({ sortBy: 'nombre', sortDirection: 'desc' })).toEqual(['Pedro', 'Manuel']);
    expect(names({ nombre: 'Zzz' })).toEqual([]);
  });

  it('solo se modifican los de la propia parroquia, salvo un admin', () => {
    expect(() => ministers.update(db, parish2, 1, input)).toThrow(/otra parroquia/);
    expect(() => ministers.toggleActive(db, parish2, 1)).toThrow(/otra parroquia/);

    ministers.toggleActive(db, admin, 1);
    expect(db.prepare('SELECT activo, version FROM ministros WHERE id = 1').get()).toEqual({ activo: 0, version: 2 });
  });

  it('un usuario de parroquia ignora la parroquia enviada y se exigen los nombres', () => {
    const id = ministers.create(db, parish1, input, 2);

    expect(db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').pluck().get(id)).toBe(1);
    expect(() => ministers.create(db, admin, input, undefined)).toThrow(/parroquia/);
    expect(() => ministers.create(db, parish1, { ...input, nombre: ' ' }, undefined)).toThrow(/requeridos/);
  });
});

describe('cola de sincronización', () => {
  const queue = () =>
    db.prepare('SELECT entidad, version_base FROM sync_cola ORDER BY id').all() as {
      entidad: string;
      version_base: number | null;
    }[];
  const minister = { nombre: 'Pedro', apellidoPaterno: 'Vargas', apellidoMaterno: 'Chavez' };

  it('anota cada tipo de registro creado, con su client_id y sin versión de partida', () => {
    baptisms.create(db, parish1, baptismInput(), undefined);
    confirmations.create(db, parish1, baptismInput(), undefined);
    marriages.create(db, parish1, marriageInput(), undefined);
    ministers.create(db, parish1, minister, undefined);

    expect(queue()).toEqual([
      { entidad: 'bautismo', version_base: null },
      { entidad: 'confirmacion', version_base: null },
      { entidad: 'matrimonio', version_base: null },
      { entidad: 'ministro', version_base: null },
    ]);
    const sacramentClientIds = db.prepare('SELECT client_id FROM sacramentos ORDER BY id').pluck().all();
    expect(db.prepare(`SELECT client_id FROM sync_cola WHERE entidad <> 'ministro' ORDER BY id`).pluck().all()).toEqual(sacramentClientIds);
  });

  it('modificar o anular un registro ya pendiente no agrega otra fila ni pierde su origen', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);

    baptisms.update(db, parish1, id, baptismInput({ nombre: 'Diego' }));
    baptisms.annul(db, parish1, id, 'Duplicada');

    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: null }]);
  });

  it('un registro ya sincronizado guarda la versión de la que parte el cambio, una sola vez', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);
    db.exec('DELETE FROM sync_cola');
    expect(db.prepare('SELECT version FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(1);

    baptisms.update(db, parish1, id, baptismInput({ nombre: 'Diego' }));
    baptisms.update(db, parish1, id, baptismInput({ nombre: 'Diogo' }));
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    baptisms.annul(db, parish1, id, 'Duplicada');
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 3 }]);
  });

  it('anota al modificar y al deshabilitar un ministro', () => {
    ministers.update(db, parish1, 1, minister);
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    ministers.toggleActive(db, parish1, 1);
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 2 }]);
  });

  it('no anota nada si el guardado falla o no hay permiso', () => {
    const id = baptisms.create(db, parish1, baptismInput(), undefined);
    db.exec('DELETE FROM sync_cola');

    expect(() => baptisms.create(db, parish1, baptismInput({ celebranteId: 999 }), undefined)).toThrow(/FOREIGN KEY/);
    expect(() => baptisms.update(db, parish1, id, baptismInput({ celebranteId: 999 }))).toThrow(/FOREIGN KEY/);
    expect(() => baptisms.update(db, parish2, id, baptismInput())).toThrow(/otra parroquia/);
    expect(() => ministers.update(db, parish2, 1, minister)).toThrow(/otra parroquia/);

    expect(queue()).toEqual([]);
    expect(baptisms.getById(db, id)).toMatchObject({ nombre: 'Diago' });
  });

  it('consultar y descargar datos del servidor no genera cambios por subir', () => {
    baptisms.search(db, {});
    ministers.search(db, {});
    applyReferenceData(db, {
      parroquias: [],
      ministros: [{ id: 7, client_id: 'ministro-7', parroquia_id: 1, nombre: 'Luis', apellido_paterno: 'Rojas', apellido_materno: 'Flores', activo: 1 }],
      usuarios: [],
    });

    expect(queue()).toEqual([]);
  });

  it('al migrar, anota lo que la base ya tenía para no perderlo', () => {
    const file = path.join(dir, 'previa.db');
    const key = randomBytes(32).toString('hex');
    const previous = openLocalDatabase(file, key, LOCAL_MIGRATIONS.slice(0, 2));
    previous.exec(`
      INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1');
      INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno) VALUES ('m-1', 1, 'Manuel', 'Torres', 'Rios');
      INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision)
      VALUES ('s-1', 'matrimonio', 1, '1', '1', '1', '2020-01-01');
    `);
    previous.close();

    const migrated = openLocalDatabase(file, key);
    try {
      expect(migrated.prepare('SELECT entidad, client_id, version_base FROM sync_cola ORDER BY id').all()).toEqual([
        { entidad: 'matrimonio', client_id: 's-1', version_base: null },
        { entidad: 'ministro', client_id: 'm-1', version_base: null },
      ]);
    } finally {
      migrated.close();
    }
  });
});

describe('migración de ministros', () => {
  it('conserva los ministros y las partidas que los usan, y los enlaza con el servidor', () => {
    const file = path.join(dir, 'antigua.db');
    const key = randomBytes(32).toString('hex');
    const v1 = openLocalDatabase(file, key, LOCAL_MIGRATIONS.slice(0, 1));
    v1.exec(`
      INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1');
      INSERT INTO ministros (id, parroquia_id, nombre, apellido_paterno, apellido_materno) VALUES (5, 1, 'Manuel', 'Torres', 'Rios');
      INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision)
      VALUES ('s-1', 'bautismo', 1, 5, '1', '1', '1', '2020-01-01');
    `);
    v1.close();

    const migrated = openLocalDatabase(file, key);
    try {
      expect(migrated.pragma('user_version', { simple: true })).toBe(LOCAL_MIGRATIONS.length);
      expect(migrated.pragma('foreign_key_check')).toEqual([]);
      expect(migrated.prepare('SELECT ministro_id FROM sacramentos').pluck().get()).toBe(5);

      applyReferenceData(migrated, {
        parroquias: [],
        ministros: [{ id: 5, client_id: 'uuid-servidor', parroquia_id: 1, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1 }],
        usuarios: [],
      });
      expect(migrated.prepare('SELECT id, client_id FROM ministros').all()).toEqual([{ id: 5, client_id: 'uuid-servidor' }]);

      expect(() => migrated.prepare('DELETE FROM ministros WHERE id = 5').run()).toThrow(/FOREIGN KEY/);
    } finally {
      migrated.close();
    }
  });
});
