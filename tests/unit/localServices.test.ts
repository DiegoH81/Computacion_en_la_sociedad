// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open_local_database, type LocalDatabase } from '../../electron/main/database/local_database';
import { LOCAL_MIGRATIONS } from '../../electron/main/database/schema';
import type { Session } from '../../electron/main/common';
import { create_marriage, get_marriage, search_marriages, update_marriage, type MarriageInput } from '../../electron/main/records/marriages';
import { create_minister, search_ministers, toggle_minister_active, update_minister } from '../../electron/main/records/ministers';
import { read_parish_logo, save_parish_logo } from '../../electron/main/records/parishes';
import { save_reference_data, list_parishes } from '../../electron/main/records/parishes';
import { get_index_entries, list_index_books } from '../../electron/main/records/sacrament_index';
import { create_person_sacrament, get_person_sacrament, search_person_sacraments, update_person_sacrament, type PersonSacramentInput as SinglePersonInput } from '../../electron/main/records/baptisms_and_confirmations';
import { annul_sacrament } from '../../electron/main/records/sacraments';


const parish1: Session = { user_id: 1, role: 'usuario_parroquia', parish_id: 1, token: 't' };
const parish2: Session = { user_id: 2, role: 'usuario_parroquia', parish_id: 2, token: 't' };
const admin: Session = { user_id: 3, role: 'admin', parish_id: null, token: 't' };

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
  search_person_sacraments(db, 'bautismo', filters).rows as { id: number; nombre: string; parroquia_nombre: string }[];

const count = (table: string) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-services-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
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
  save_reference_data(db, {
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
    const id = create_person_sacrament(
      db,
      'bautismo',
      parish1,
      baptismInput({ dni: '12345678', edad: '30', fechaBautizo: '2010-07-01', celebranteId: 1, padrino: 'Pedro', madrina: 'Ana', anotaciones: 'Nota' }),
      undefined,
    );

    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({
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
    create_person_sacrament(db, 'bautismo', parish1, baptismInput({ dni: '12345678' }), undefined);
    create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ dni: '12345678' }), undefined);

    expect(count('personas')).toBe(2);
  });

  it('un usuario de parroquia ignora la parroquia enviada; un admin debe indicarla', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), 2);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ parroquia_id: 1 });

    expect(() => create_person_sacrament(db, 'bautismo', admin, baptismInput(), undefined)).toThrow(/parroquia/);
    const adminId = create_person_sacrament(db, 'bautismo', admin, baptismInput(), 2);
    expect(get_person_sacrament(db, 'bautismo', adminId)).toMatchObject({ parroquia_id: 2 });
  });

  it('valida los datos requeridos y la edad', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ nombre: '  ' }), undefined)).toThrow(/requeridos/);
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ numeroLibro: '' }), undefined)).toThrow(/libro/);
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ edad: 'abc' }), undefined)).toThrow(/edad/);
  });

  it('si algo falla no deja la persona ni el sacramento a medias', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ celebranteId: 999 }), undefined)).toThrow(/FOREIGN KEY/);

    expect(count('personas')).toBe(0);
    expect(count('sacramentos')).toBe(0);
  });
});

describe('corregir partidas', () => {
  it('la nota marginal corrige el dato y registra el cambio con su sacramento y usuario', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({
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
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({
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
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ edad: '30' }), undefined);

    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Diego', edad: '31' }));

    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ nombre: 'Diego', edad: 31 });
    expect(count('cambios_persona')).toBe(0);
  });

  it('una partida nueva puede venir con su nota marginal', () => {
    const id = create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }), undefined);

    expect(get_person_sacrament(db, 'confirmacion', id)).toMatchObject({
      nombre: 'Diego',
      correcciones: [{ campo: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' }],
    });
  });

  it('en un matrimonio cada corrección queda en el cónyuge indicado', () => {
    const id = create_marriage(db, parish1, marriageInput(), undefined);

    update_marriage(db, parish1, id, marriageInput({
      correcciones: [
        { persona: 'esposa', campo: 'nombres', valorNuevo: 'Mariela' },
        { persona: 'esposo', campo: 'apellido_paterno', valorNuevo: 'Guidos' },
      ],
    }));

    expect(get_marriage(db, id)).toMatchObject({
      esposo_nombre: 'Braulio',
      esposo_apellido_paterno: 'Guidos',
      esposa_nombre: 'Mariela',
    });
    const { correcciones } = get_marriage(db, id) as unknown as { correcciones: { persona: string; campo: string }[] };
    expect(correcciones.map(({ persona, campo }) => [persona, campo]).sort()).toEqual([
      ['esposa', 'nombres'],
      ['esposo', 'apellido_paterno'],
    ]);
    expect(() => update_marriage(db, parish1, id, marriageInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'X' }] }))).toThrow(/cónyuge/);
  });

  it('rechaza una corrección inválida sin cambiar nada', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    const correct = (correcciones: object[]) => () => update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Otro', correcciones }));

    expect(correct([{ campo: 'nombres', valorNuevo: '  ' }])).toThrow(/valor nuevo/);
    expect(correct([{ campo: 'nombres', valorNuevo: 'Otro' }])).toThrow(/igual al anterior/);
    expect(correct([{ campo: 'dni', valorNuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([{ campo: 'constructor', valorNuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([{ campo: 'nombres', valorNuevo: 'A' }, { campo: 'nombres', valorNuevo: 'B' }])).toThrow(/repite/);

    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ nombre: 'Diago' });
    expect(count('cambios_persona')).toBe(0);
  });

  it('guardar sin cambios en la persona no registra nada ni sube su versión', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ anotaciones: 'Solo la nota' }));

    expect(count('cambios_persona')).toBe(0);
    expect(db.prepare('SELECT version FROM personas').pluck().get()).toBe(1);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ anotaciones: 'Solo la nota' });
  });

  it('corregir una partida no altera otra de la misma persona', () => {
    const baptismId = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ dni: '12345678' }), undefined);
    const confirmationId = create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ dni: '12345678' }), undefined);

    update_person_sacrament(db, 'bautismo', parish1, baptismId, baptismInput({ dni: '12345678', nombre: 'Diego' }));

    expect(get_person_sacrament(db, 'bautismo', baptismId)).toMatchObject({ nombre: 'Diego' });
    expect(get_person_sacrament(db, 'confirmacion', confirmationId)).toMatchObject({ nombre: 'Diago' });
  });

  it('no permite modificar partidas de otra parroquia, pero sí un admin', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    expect(() => update_person_sacrament(db, 'bautismo', parish2, id, baptismInput({ nombre: 'Otro' }))).toThrow(/otra parroquia/);
    expect(() => annul_sacrament(db, 'bautismo', parish2, id, 'motivo')).toThrow(/otra parroquia/);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ nombre: 'Diago', estado: 'vigente' });

    update_person_sacrament(db, 'bautismo', admin, id, baptismInput({ nombre: 'Diego' }));
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ nombre: 'Diego' });
  });

  it('no confunde un bautismo con otro tipo de sacramento', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    expect(() => update_person_sacrament(db, 'confirmacion', parish1, id, baptismInput())).toThrow(/no encontrada/);
    expect(() => get_person_sacrament(db, 'confirmacion', id)).toThrow(/no encontrada/);
  });

  it('anular exige motivo y guarda quién y por qué', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    expect(() => annul_sacrament(db, 'bautismo', parish1, id, '   ')).toThrow(/motivo/);

    annul_sacrament(db, 'bautismo', parish1, id, 'Duplicada');
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({
      estado: 'anulado',
      anulado_por_usuario_id: 1,
      motivo_anulacion: 'Duplicada',
    });
  });
});

describe('búsqueda', () => {
  it('encuentra por el nombre actual y por el valor anterior corregido', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ correcciones: [{ campo: 'nombres', valorNuevo: 'Diogo' }] }));
    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Diogo', correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }));

    for (const nombre of ['Diego', 'Diago', 'Diogo']) {
      expect(search({ nombre }).map((row) => row.nombre)).toEqual(['Diego']);
    }
    expect(search({ nombre: 'Pablo' })).toEqual([]);
  });

  it('una corrección de apellido no hace coincidir el filtro de nombre', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ correcciones: [{ campo: 'apellido_paterno', valorNuevo: 'Rojas' }] }));

    expect(search({ apellidoPaterno: 'Guido' })).toHaveLength(1);
    expect(search({ nombre: 'Guido' })).toEqual([]);
  });

  it('muestra partidas de otras parroquias para consulta', () => {
    create_person_sacrament(db, 'bautismo', parish2, baptismInput(), undefined);

    expect(search({}).map((row) => row.parroquia_nombre)).toEqual(['Parroquia 2']);
  });

  it('pagina y ordena; un campo de orden desconocido no llega al SQL', () => {
    for (let i = 0; i < 25; i++) {
      create_person_sacrament(db, 'bautismo', parish1, baptismInput({ nombre: `Persona ${String(i).padStart(2, '0')}` }), undefined);
    }

    const first = search_person_sacraments(db, 'bautismo', { page: 1, sortBy: 'nombre', sortDirection: 'desc' });
    expect(first.totalPages).toBe(2);
    expect(first.rows).toHaveLength(20);
    expect((first.rows[0] as { nombre: string }).nombre).toBe('Persona 24');
    expect(search_person_sacraments(db, 'bautismo', { page: 2 }).rows).toHaveLength(5);
    expect(search_person_sacraments(db, 'bautismo', { sortBy: '1; DROP TABLE personas' }).rows).toHaveLength(20);
  });
});

describe('matrimonios', () => {
  it('guarda dos personas y lo que declara la partida sobre su bautismo', () => {
    const id = create_marriage(db, parish1, marriageInput({ celebranteId: 1, notasMarginales: 'Nota' }), undefined);

    expect(count('personas')).toBe(2);
    expect(get_marriage(db, id)).toMatchObject({
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
    const id = create_marriage(db, parish1, marriageInput(), undefined);
    update_marriage(db, parish1, id, marriageInput({
      correcciones: [{ persona: 'esposa', campo: 'nombres', valorNuevo: 'Marta' }],
    }));

    for (const nombre of ['Braulio', 'Marta', 'Maria']) {
      expect(search_marriages(db, { nombre }).rows).toHaveLength(1);
    }
  });

  it('exige ambos nombres y respeta la parroquia', () => {
    expect(() =>
      create_marriage(db, parish1, marriageInput({ esposa: { nombre: '' } }), undefined),
    ).toThrow(/ambos cónyuges/);

    const id = create_marriage(db, parish1, marriageInput(), undefined);
    expect(() => annul_sacrament(db, 'matrimonio', parish2, id, 'motivo')).toThrow(/otra parroquia/);
  });
});

describe('índice de sacramentos', () => {
  it('lista libros y entradas vigentes en orden alfabético, con una línea por cónyuge', () => {
    create_marriage(db, parish1, marriageInput(), undefined);
    const annulled = create_marriage(db, parish1, marriageInput({ numeroLibro: '9' }), undefined);
    annul_sacrament(db, 'matrimonio', parish1, annulled, 'Error');

    expect(list_index_books(db, parish1, 'matrimonio', 1)).toEqual(['5']);
    expect(get_index_entries(db, parish1, 'matrimonio', 1, null).map((entry) => entry.nombres)).toEqual(['Braulio', 'Maria']);
    expect(get_index_entries(db, parish1, 'matrimonio', 1, 'no-existe')).toEqual([]);
  });

  it('solo se imprime el índice de la propia parroquia, salvo un admin', () => {
    expect(() => list_index_books(db, parish2, 'bautismo', 1)).toThrow(/otra parroquia/);
    expect(list_index_books(db, admin, 'bautismo', 1)).toEqual([]);
    expect(() => list_index_books(db, admin, 'personas; DROP', 1)).toThrow(/no válido/);
  });
});

describe('datos de referencia', () => {
  it('lista las parroquias activas de la copia local, en orden', () => {
    save_reference_data(db, {
      parroquias: [
        { id: 1, nombre: 'Zeta', ubicacion: null, activa: 1 },
        { id: 2, nombre: 'Alfa', ubicacion: null, activa: 1 },
        { id: 3, nombre: 'Cerrada', ubicacion: null, activa: 0 },
      ],
      ministros: [],
      usuarios: [],
    });

    expect(list_parishes(db)).toEqual([
      { id: 2, nombre: 'Alfa' },
      { id: 1, nombre: 'Zeta' },
    ]);
  });

  it('actualiza parroquias, y no pisa ni duplica los ministros que ya están en la PC', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ celebranteId: 1 }), undefined);
    update_minister(db, parish1, 1, { nombre: 'Manolo', apellidoPaterno: 'Torres', apellidoMaterno: 'Rios' });

    save_reference_data(db, {
      parroquias: [{ id: 1, nombre: 'Parroquia Renombrada', ubicacion: 'Ayaviri', activa: 1 }],
      ministros: [{ id: 1, client_id: 'ministro-1', parroquia_id: 1, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1 }],
      usuarios: [],
    });

    expect(count('parroquias')).toBe(2);
    expect(count('ministros')).toBe(1);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({
      parroquia_nombre: 'Parroquia Renombrada',
      celebrante_nombre: 'Manolo Torres Rios',
    });
  });
});

describe('logo de la parroquia', () => {
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

  it('se guarda por parroquia y se puede cambiar y quitar', () => {
    expect(read_parish_logo(dir, 1)).toBeNull();

    save_parish_logo(dir, parish1, 1, LOGO);
    expect(read_parish_logo(dir, 1)).toBe(LOGO);
    expect(read_parish_logo(dir, 2)).toBeNull();

    save_parish_logo(dir, parish1, 1, 'data:image/webp;base64,UklGRg==');
    expect(read_parish_logo(dir, 1)).toBe('data:image/webp;base64,UklGRg==');

    save_parish_logo(dir, parish1, 1, null);
    expect(read_parish_logo(dir, 1)).toBeNull();
  });

  it('un usuario solo cambia el de su parroquia; un admin, cualquiera', () => {
    expect(() => save_parish_logo(dir, parish1, 2, LOGO)).toThrow(/propia parroquia/);
    expect(read_parish_logo(dir, 2)).toBeNull();

    save_parish_logo(dir, admin, 2, LOGO);
    expect(read_parish_logo(dir, 2)).toBe(LOGO);
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
      expect(() => save_parish_logo(dir, parish1, 1, logo)).toThrow(/PNG, JPG o WEBP/);
    }
    expect(read_parish_logo(dir, 1)).toBeNull();
  });
});

describe('celebrantes por parroquia', () => {
  it('la búsqueda se limita a la parroquia indicada', () => {
    create_minister(db, parish2, { nombre: 'Luis', apellidoPaterno: 'Ramos', apellidoMaterno: 'Paz' }, undefined);
    const names = (filters: Record<string, unknown>) =>
      (search_ministers(db, filters).priests as { nombre: string }[]).map((row) => row.nombre);

    expect(names({ parroquiaId: 1 })).toEqual(['Manuel']);
    expect(names({ parroquiaId: 2 })).toEqual(['Luis']);
    expect(search_ministers(db, { parroquiaId: 2, nombre: 'Manuel' }).priests).toEqual([]);
  });

  it('una partida no acepta un celebrante de otra parroquia', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish2, baptismInput({ celebranteId: 1 }), undefined)).toThrow(/parroquia de la partida/);
    expect(() => create_marriage(db, admin, marriageInput({ celebranteId: 1 }), 2)).toThrow(/parroquia de la partida/);
    expect(count('sacramentos')).toBe(0);

    const id = create_person_sacrament(db, 'bautismo', parish2, baptismInput(), undefined);
    expect(() => update_person_sacrament(db, 'bautismo', parish2, id, baptismInput({ celebranteId: 1 }))).toThrow(/parroquia de la partida/);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ celebrante_id: null });
  });

  it('una partida ya registrada con un celebrante de otra parroquia se puede seguir editando', () => {
    const id = create_person_sacrament(db, 'bautismo', parish2, baptismInput(), undefined);
    db.prepare('UPDATE sacramentos SET ministro_id = 1 WHERE id = ?').run(id);

    update_person_sacrament(db, 'bautismo', parish2, id, baptismInput({ celebranteId: 1, padrino: 'Pedro' }));

    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ celebrante_id: 1, padrino: 'Pedro' });
  });
});

describe('ministros', () => {
  const input = { titulo: 'Mons.', nombre: 'Pedro', apellidoPaterno: 'Vargas', apellidoMaterno: 'Chavez' };
  const names = (filters: Record<string, unknown>) =>
    (search_ministers(db, filters).priests as { nombre: string }[]).map((row) => row.nombre);

  it('se crean en la PC con título y un id que no choca con el servidor', () => {
    const id = create_minister(db, parish1, input, undefined);

    expect(id).not.toBe(1);
    expect(db.prepare('SELECT titulo, parroquia_id, version FROM ministros WHERE id = ?').get(id)).toEqual({
      titulo: 'Mons.',
      parroquia_id: 1,
      version: 1,
    });
    expect(db.prepare('SELECT client_id FROM ministros WHERE id = ?').pluck().get(id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un ministro creado aquí se puede usar en una partida', () => {
    const ministerId = create_minister(db, parish1, input, undefined);
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ celebranteId: ministerId }), undefined);

    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ celebrante_nombre: 'Pedro Vargas Chavez' });
  });

  it('busca por nombre y apellidos, y ordena', () => {
    create_minister(db, parish1, input, undefined);

    expect(names({ nombre: 'Man' })).toEqual(['Manuel']);
    expect(names({ apellidoPaterno: 'Varg' })).toEqual(['Pedro']);
    expect(names({ sortBy: 'nombre', sortDirection: 'desc' })).toEqual(['Pedro', 'Manuel']);
    expect(names({ nombre: 'Zzz' })).toEqual([]);
  });

  it('solo se modifican los de la propia parroquia, salvo un admin', () => {
    expect(() => update_minister(db, parish2, 1, input)).toThrow(/otra parroquia/);
    expect(() => toggle_minister_active(db, parish2, 1)).toThrow(/otra parroquia/);

    toggle_minister_active(db, admin, 1);
    expect(db.prepare('SELECT activo, version FROM ministros WHERE id = 1').get()).toEqual({ activo: 0, version: 2 });
  });

  it('un usuario de parroquia ignora la parroquia enviada y se exigen los nombres', () => {
    const id = create_minister(db, parish1, input, 2);

    expect(db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').pluck().get(id)).toBe(1);
    expect(() => create_minister(db, admin, input, undefined)).toThrow(/parroquia/);
    expect(() => create_minister(db, parish1, { ...input, nombre: ' ' }, undefined)).toThrow(/requeridos/);
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
    create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    create_person_sacrament(db, 'confirmacion', parish1, baptismInput(), undefined);
    create_marriage(db, parish1, marriageInput(), undefined);
    create_minister(db, parish1, minister, undefined);

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
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);

    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Diego' }));
    annul_sacrament(db, 'bautismo', parish1, id, 'Duplicada');

    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: null }]);
  });

  it('un registro ya sincronizado guarda la versión de la que parte el cambio, una sola vez', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    db.exec('DELETE FROM sync_cola');
    expect(db.prepare('SELECT version FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(1);

    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Diego' }));
    update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ nombre: 'Diogo' }));
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    annul_sacrament(db, 'bautismo', parish1, id, 'Duplicada');
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 3 }]);
  });

  it('anota al modificar y al deshabilitar un ministro', () => {
    update_minister(db, parish1, 1, minister);
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    toggle_minister_active(db, parish1, 1);
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 2 }]);
  });

  it('no anota nada si el guardado falla o no hay permiso', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput(), undefined);
    db.exec('DELETE FROM sync_cola');

    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ celebranteId: 999 }), undefined)).toThrow(/FOREIGN KEY/);
    expect(() => update_person_sacrament(db, 'bautismo', parish1, id, baptismInput({ celebranteId: 999 }))).toThrow(/FOREIGN KEY/);
    expect(() => update_person_sacrament(db, 'bautismo', parish2, id, baptismInput())).toThrow(/otra parroquia/);
    expect(() => update_minister(db, parish2, 1, minister)).toThrow(/otra parroquia/);

    expect(queue()).toEqual([]);
    expect(get_person_sacrament(db, 'bautismo', id)).toMatchObject({ nombre: 'Diago' });
  });

  it('consultar y descargar datos del servidor no genera cambios por subir', () => {
    search_person_sacraments(db, 'bautismo', {});
    search_ministers(db, {});
    save_reference_data(db, {
      parroquias: [],
      ministros: [{ id: 7, client_id: 'ministro-7', parroquia_id: 1, nombre: 'Luis', apellido_paterno: 'Rojas', apellido_materno: 'Flores', activo: 1 }],
      usuarios: [],
    });

    expect(queue()).toEqual([]);
  });

  it('al migrar, anota lo que la base ya tenía para no perderlo', () => {
    const file = path.join(dir, 'previa.db');
    const key = randomBytes(32).toString('hex');
    const previous = open_local_database(file, key, LOCAL_MIGRATIONS.slice(0, 2));
    previous.exec(`
      INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1');
      INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno) VALUES ('m-1', 1, 'Manuel', 'Torres', 'Rios');
      INSERT INTO sacramentos (client_id, tipo, parroquia_id, libro, folio, numero, fecha_emision)
      VALUES ('s-1', 'matrimonio', 1, '1', '1', '1', '2020-01-01');
    `);
    previous.close();

    const migrated = open_local_database(file, key);
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
    const v1 = open_local_database(file, key, LOCAL_MIGRATIONS.slice(0, 1));
    v1.exec(`
      INSERT INTO parroquias (id, nombre) VALUES (1, 'Parroquia 1');
      INSERT INTO ministros (id, parroquia_id, nombre, apellido_paterno, apellido_materno) VALUES (5, 1, 'Manuel', 'Torres', 'Rios');
      INSERT INTO sacramentos (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision)
      VALUES ('s-1', 'bautismo', 1, 5, '1', '1', '1', '2020-01-01');
    `);
    v1.close();

    const migrated = open_local_database(file, key);
    try {
      expect(migrated.pragma('user_version', { simple: true })).toBe(LOCAL_MIGRATIONS.length);
      expect(migrated.pragma('foreign_key_check')).toEqual([]);
      expect(migrated.prepare('SELECT ministro_id FROM sacramentos').pluck().get()).toBe(5);

      save_reference_data(migrated, {
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
