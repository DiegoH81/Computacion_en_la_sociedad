// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Baptism, SearchFilters } from '../../shared/models';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { LOCAL_MIGRATIONS } from '../../electron/main/db/migrations';
import type { Session } from '../../electron/main/models/session';
import { annul_sacrament, create_marriage, create_person_sacrament, read_marriage, read_person_sacrament, search_sacraments, update_marriage, update_person_sacrament } from '../../electron/main/controllers/sacraments';
import { create_minister, search_ministers, toggle_minister_active, update_minister } from '../../electron/main/controllers/ministers';
import { list_parishes, read_parish_logo, save_parish_logo } from '../../electron/main/controllers/parishes';
import { save_reference_data } from '../../electron/main/sync/sync';
import { get_index_entries, list_index_books } from '../../electron/main/controllers/sacrament_index';
import { baptism, change, marriage, minister, type BaptismValues, type MarriageValues } from './helpers/records';

const parish1: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const parish2: Session = { user_id: 2, role: 'admin_parroquia', parish_id: 2, token: 't' };
const admin: Session = { user_id: 3, role: 'admin_general', parish_id: null, token: 't' };
// Un ayudante de la parroquia 1: registra partidas y pide correcciones.
const helper1: Session = { user_id: 4, role: 'usuario', parish_id: 1, token: 't' };

let dir: string;
let db: LocalDatabase;

// Un bautismo (o confirmación) de Diago Guido Alvaro, libro 2, folio 1, número 713.
const baptismInput = (values: BaptismValues = {}, tipo: 'bautismo' | 'confirmacion' = 'bautismo') =>
  baptism(tipo, {
    ...values,
    sacramento: { fecha_emision: '2010-06-15', libro: '2', folio: '1', numero: '713', ...values.sacramento },
    persona: { nombres: 'Diago', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', ...values.persona },
  });

// El matrimonio de Braulio Guido Alvaro y Maria Torres Rios, libro 5, folio 3, número 20.
const marriageInput = (values: MarriageValues = {}) =>
  marriage({
    conyuge_1_bautismo_parroquia: 'San Juan',
    conyuge_2_bautismo_fecha: '1990-01-01',
    testigo_1: 'Testigo Uno',
    ...values,
    sacramento: { fecha_emision: '2024-05-10', libro: '5', folio: '3', numero: '20', ...values.sacramento },
    conyuge_1: { nombres: 'Braulio', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', ...values.conyuge_1 },
    conyuge_2: { nombres: 'Maria', apellido_paterno: 'Torres', apellido_materno: 'Rios', ...values.conyuge_2 },
  });

const search = (filters: SearchFilters) => search_sacraments(db, 'bautismo', filters).resultados as Baptism[];
const names = (filters: SearchFilters) => search(filters).map((record) => record.persona.nombres);
const read = (id: number) => read_person_sacrament(db, 'bautismo', id);

const count = (table: string) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-services-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number | null, rol: 'admin_general' | 'admin_parroquia' | 'usuario') => ({
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
    usuarios: [user(1, 1, 'admin_parroquia'), user(2, 2, 'admin_parroquia'), user(3, null, 'admin_general'), user(4, 1, 'usuario')],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('crear partidas', () => {
  it('reparte los datos entre personas, sacramentos y bautismos', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({
      sacramento: { fecha_evento: '2010-07-01', ministro_id: 1, anotaciones: 'Nota' },
      persona: { dni: '12345678', fecha_aproximada: '(27 AÑOS AL DIA DE BODA)' },
      padrino_1: 'Pedro',
      padrino_2: 'Ana',
    }));

    expect(read(id)).toMatchObject({
      sacramento: {
        id,
        tipo: 'bautismo',
        parroquia: { nombre: 'Parroquia 1' },
        fecha_emision: '2010-06-15',
        libro: '2',
        fecha_evento: '2010-07-01',
        ministro_id: 1,
        ministro: { nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios' },
        anotaciones: 'Nota',
        estado: 'vigente',
      },
      persona: { dni: '12345678', nombres: 'Diago', fecha_aproximada: '(27 AÑOS AL DIA DE BODA)', fecha_nacimiento: null, cambios: [] },
      padrino_1: 'Pedro',
      padrino_2: 'Ana',
    });
  });

  it('cada partida crea su propia persona aunque los datos coincidan', () => {
    create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { dni: '12345678' } }));
    create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ persona: { dni: '12345678' } }, 'confirmacion'));

    expect(count('personas')).toBe(2);
  });

  it('se registra siempre en la parroquia del usuario; el administrador general no registra', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { parroquia_id: 2 } }));
    expect(read(id).sacramento.parroquia_id).toBe(1);

    expect(() => create_person_sacrament(db, 'bautismo', admin, baptismInput({ sacramento: { parroquia_id: 2 } }))).toThrow(/solo consulta/);
    expect(count('sacramentos')).toBe(1);
  });

  it('valida los datos requeridos; la fecha aproximada es texto libre', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { nombres: '  ' } }))).toThrow(/Faltan datos: nombres/);
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { libro: '' } }))).toThrow(/libro/);
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { fecha_aproximada: '  22 AG 1978  ' } }));
    expect(read(id).persona.fecha_aproximada).toBe('22 AG 1978');
  });

  it('al registrar exige todos los datos de la persona menos el DNI, y el celebrante', () => {
    const empty = { lugar_nacimiento: null, padre: '  ', madre: null, fecha_nacimiento: null, fecha_aproximada: null };
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: empty }))).toThrow(
      'Faltan datos: fecha de nacimiento (o fecha aproximada), lugar de nacimiento, padre, madre.',
    );
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { ministro_id: null } }))).toThrow(/celebrante/);
    expect(() => create_marriage(db, parish1, marriageInput({ conyuge_1: { madre: null } }))).toThrow('Faltan datos del esposo: madre.');

    // Sin DNI, y con solo la fecha aproximada, se puede registrar.
    expect(create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { dni: null, fecha_aproximada: '(27 AÑOS)' } }))).toBeGreaterThan(0);
    expect(count('sacramentos')).toBe(1);
  });

  it('una partida vieja sin algunos datos se puede editar, pero no se borra lo que tenía', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    // Como una importada del sistema anterior: sin padre ni celebrante.
    db.prepare('UPDATE personas SET padre = NULL').run();
    db.prepare('UPDATE sacramentos SET ministro_id = NULL').run();

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id, ministro_id: null }, persona: { padre: null }, padrino_1: 'Pedro' }));
    expect(read(id)).toMatchObject({ padrino_1: 'Pedro', persona: { padre: null } });

    expect(() => update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id, ministro_id: null }, persona: { padre: null, madre: '' } }))).toThrow('Faltan datos: madre.');
  });

  it('si algo falla no deja la persona ni el sacramento a medias', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { ministro_id: 999 } }))).toThrow(/FOREIGN KEY/);

    expect(count('personas')).toBe(0);
    expect(count('sacramentos')).toBe(0);
  });
});

describe('corregir partidas', () => {
  it('la nota marginal registra el cambio con su sacramento y usuario, sin cambiar el dato de la partida', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({
      sacramento: { id, anotaciones: 'Corregido por resolución 12' },
      persona: { cambios: [change('nombres', 'Diego'), change('apellido_materno', 'Alva')] },
    }));

    const changes = db
      .prepare('SELECT sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo FROM cambios_persona ORDER BY campo_cambio')
      .all();
    expect(changes).toEqual([
      { sacramento_id: id, usuario_id: 1, campo_cambio: 'apellido_materno', valor_anterior: 'Alvaro', valor_nuevo: 'Alva' },
      { sacramento_id: id, usuario_id: 1, campo_cambio: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' },
    ]);
    expect(read(id)).toMatchObject({
      sacramento: { anotaciones: 'Corregido por resolución 12' },
      // La partida conserva lo que se registró (es lo que se imprime); lo corregido queda en la nota.
      persona: {
        nombres: 'Diago',
        apellido_materno: 'Alvaro',
        cambios: [
          { campo_cambio: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' },
          { campo_cambio: 'apellido_materno', valor_anterior: 'Alvaro', valor_nuevo: 'Alva' },
        ],
      },
    });
  });

  it('editar el formulario directamente cambia el dato sin registrar una corrección', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { fecha_aproximada: '30 años' } }));

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { nombres: 'Diego', fecha_aproximada: '31 años' } }));

    expect(read(id).persona).toMatchObject({ nombres: 'Diego', fecha_aproximada: '31 años' });
    expect(count('cambios_persona')).toBe(0);
  });

  it('una partida nueva puede venir con su nota marginal', () => {
    const id = create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ persona: { cambios: [change('nombres', 'Diego')] } }, 'confirmacion'));

    expect(read_person_sacrament(db, 'confirmacion', id).persona).toMatchObject({
      nombres: 'Diago',
      cambios: [{ campo_cambio: 'nombres', valor_anterior: 'Diago', valor_nuevo: 'Diego' }],
    });
  });

  it('volver a guardar la partida tal como se leyó no repite sus correcciones', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { cambios: [change('nombres', 'Diego')] } }));
    const record = read(id);

    update_person_sacrament(db, 'bautismo', parish1, { ...record, padrino_1: 'Pedro' });
    update_person_sacrament(db, 'bautismo', parish1, {
      ...record,
      persona: { ...record.persona, cambios: [...record.persona.cambios, change('apellido_paterno', 'Guidos')] },
    });

    expect(read(id).persona.cambios.map((item) => item.campo_cambio)).toEqual(['nombres', 'apellido_paterno']);
    expect(read(id).persona).toMatchObject({ nombres: 'Diago', apellido_paterno: 'Guido' });
  });

  it('en un matrimonio cada corrección queda en su cónyuge', () => {
    const id = create_marriage(db, parish1, marriageInput());

    update_marriage(db, parish1, marriageInput({
      sacramento: { id },
      conyuge_1: { cambios: [change('apellido_paterno', 'Guidos')] },
      conyuge_2: { cambios: [change('nombres', 'Mariela')] },
    }));

    const record = read_marriage(db, id);
    expect(record).toMatchObject({
      conyuge_1: { nombres: 'Braulio', apellido_paterno: 'Guido' },
      conyuge_2: { nombres: 'Maria' },
    });
    expect(record.conyuge_1.cambios.map((item) => item.campo_cambio)).toEqual(['apellido_paterno']);
    expect(record.conyuge_2.cambios.map((item) => item.campo_cambio)).toEqual(['nombres']);
  });

  it('rechaza una corrección inválida sin cambiar nada', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    const correct = (cambios: object[]) => () =>
      update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { nombres: 'Otro', cambios: cambios as never } }));

    expect(correct([change('nombres', '  ')])).toThrow(/valor nuevo/);
    expect(correct([change('nombres', 'Otro')])).toThrow(/igual al anterior/);
    expect(correct([{ campo_cambio: 'dni', valor_nuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([{ campo_cambio: 'constructor', valor_nuevo: '1' }])).toThrow(/no se puede corregir/);
    expect(correct([change('nombres', 'A'), change('nombres', 'B')])).toThrow(/repite/);

    expect(read(id).persona.nombres).toBe('Diago');
    expect(count('cambios_persona')).toBe(0);
  });

  it('guardar sin cambios en la persona no registra nada ni sube su versión', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id, anotaciones: 'Solo la nota' } }));

    expect(count('cambios_persona')).toBe(0);
    expect(db.prepare('SELECT version FROM personas').pluck().get()).toBe(1);
    expect(read(id).sacramento.anotaciones).toBe('Solo la nota');
  });

  it('corregir una partida no altera otra de la misma persona', () => {
    const baptismId = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { dni: '12345678' } }));
    const confirmationId = create_person_sacrament(db, 'confirmacion', parish1, baptismInput({ persona: { dni: '12345678' } }, 'confirmacion'));

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id: baptismId }, persona: { dni: '12345678', nombres: 'Diego' } }));

    expect(read(baptismId).persona.nombres).toBe('Diego');
    expect(read_person_sacrament(db, 'confirmacion', confirmationId).persona.nombres).toBe('Diago');
  });

  it('no permite modificar partidas de otra parroquia, ni al administrador general', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    expect(() => update_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { id }, persona: { nombres: 'Otro' } }))).toThrow(/otra parroquia/);
    expect(() => annul_sacrament(db, parish2, id, 'motivo')).toThrow(/otra parroquia/);
    expect(() => update_person_sacrament(db, 'bautismo', admin, baptismInput({ sacramento: { id }, persona: { nombres: 'Diego' } }))).toThrow(/solo consulta/);
    expect(read(id)).toMatchObject({ sacramento: { estado: 'vigente' }, persona: { nombres: 'Diago' } });
  });

  it('no confunde un bautismo con otro tipo de sacramento', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    expect(() => update_person_sacrament(db, 'confirmacion', parish1, baptismInput({ sacramento: { id } }, 'confirmacion'))).toThrow(/no encontrada/);
    expect(() => read_person_sacrament(db, 'confirmacion', id)).toThrow(/no encontrada/);
  });

  it('anular exige motivo y guarda quién y por qué', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    expect(() => annul_sacrament(db, parish1, id, '   ')).toThrow(/motivo/);

    annul_sacrament(db, parish1, id, 'Duplicada');
    expect(read(id).sacramento).toMatchObject({
      estado: 'anulado',
      anulado_por_usuario_id: 1,
      motivo_anulacion: 'Duplicada',
    });
  });
});

describe('búsqueda', () => {
  it('encuentra por el nombre de la partida y por cada nombre corregido', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { cambios: [change('nombres', 'Diogo')] } }));
    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { cambios: [change('nombres', 'Diego')] } }));

    // La segunda corrección parte del valor ya corregido.
    expect(read(id).persona.cambios.map((item) => [item.valor_anterior, item.valor_nuevo])).toEqual([['Diago', 'Diogo'], ['Diogo', 'Diego']]);
    for (const nombres of ['Diego', 'Diago', 'Diogo']) {
      expect(names({ nombres })).toEqual(['Diago']);
    }
    expect(search({ nombres: 'Pablo' })).toEqual([]);
  });

  it('una corrección de apellido no hace coincidir el filtro de nombre', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { cambios: [change('apellido_paterno', 'Rojas')] } }));

    expect(search({ apellido_paterno: 'Guido' })).toHaveLength(1);
    expect(search({ nombres: 'Guido' })).toEqual([]);
  });

  it('con parroquia_id solo trae las partidas de esa parroquia, completas', () => {
    create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { nombres: 'Rosa' } }));
    const luis = create_minister(db, parish2, minister({ nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz' }));
    create_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { ministro_id: luis } }));

    expect(search({ parroquia_id: 2 })).toMatchObject([{ sacramento: { libro: '2', parroquia: { nombre: 'Parroquia 2' } }, persona: { nombres: 'Diago' } }]);
    expect(names({ parroquia_id: 1 })).toEqual(['Rosa']);
    expect(search_sacraments(db, 'matrimonio', { parroquia_id: 2 }).resultados).toEqual([]);
  });

  it('pagina y ordena; un campo de orden desconocido no llega al SQL', () => {
    for (let i = 0; i < 25; i++) {
      create_person_sacrament(db, 'bautismo', parish1, baptismInput({ persona: { nombres: `Persona ${String(i).padStart(2, '0')}` } }));
    }

    const first = search_sacraments(db, 'bautismo', { pagina: 1, orden: 'nombres', direccion: 'desc' });
    expect(first.total_paginas).toBe(2);
    expect(first.resultados).toHaveLength(20);
    expect((first.resultados[0] as Baptism).persona.nombres).toBe('Persona 24');
    expect(search({ pagina: 2 })).toHaveLength(5);
    expect(search({ orden: '1; DROP TABLE personas' } as unknown as SearchFilters)).toHaveLength(20);
  });
});

describe('matrimonios', () => {
  it('guarda dos personas y lo que declara la partida sobre su bautismo', () => {
    const id = create_marriage(db, parish1, marriageInput({ sacramento: { ministro_id: 1, anotaciones: 'Nota' } }));

    expect(count('personas')).toBe(2);
    expect(read_marriage(db, id)).toMatchObject({
      sacramento: { anotaciones: 'Nota', ministro: { nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios' } },
      conyuge_1: { nombres: 'Braulio' },
      conyuge_1_bautismo_parroquia: 'San Juan',
      conyuge_2: { nombres: 'Maria' },
      conyuge_2_bautismo_fecha: '1990-01-01',
      testigo_1: 'Testigo Uno',
    });
  });

  it('busca en ambos cónyuges, también por valores corregidos', () => {
    const id = create_marriage(db, parish1, marriageInput());
    update_marriage(db, parish1, marriageInput({ sacramento: { id }, conyuge_2: { cambios: [change('nombres', 'Marta')] } }));

    for (const nombres of ['Braulio', 'Marta', 'Maria']) {
      expect(search_sacraments(db, 'matrimonio', { nombres }).resultados).toHaveLength(1);
    }
  });

  it('exige ambos nombres y respeta la parroquia', () => {
    expect(() => create_marriage(db, parish1, marriageInput({ conyuge_2: { nombres: '' } }))).toThrow('Faltan datos de la esposa: nombres.');

    const id = create_marriage(db, parish1, marriageInput());
    expect(() => annul_sacrament(db, parish2, id, 'motivo')).toThrow(/otra parroquia/);
  });
});

describe('índice de sacramentos', () => {
  it('lista libros y entradas vigentes en orden alfabético, con una línea por cónyuge', () => {
    create_marriage(db, parish1, marriageInput());
    const annulled = create_marriage(db, parish1, marriageInput({ sacramento: { libro: '9' } }));
    annul_sacrament(db, parish1, annulled, 'Error');

    expect(list_index_books(db, parish1, 'matrimonio', 1)).toEqual(['5']);
    expect(get_index_entries(db, parish1, 'matrimonio', 1, null)).toEqual([
      { nombres: 'Braulio', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', libro: '5', folio: '3', numero: '20' },
      { nombres: 'Maria', apellido_paterno: 'Torres', apellido_materno: 'Rios', libro: '5', folio: '3', numero: '20' },
    ]);
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
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { ministro_id: 1 } }));
    update_minister(db, parish1, minister({ id: 1, nombre: 'Manolo', apellido_paterno: 'Torres', apellido_materno: 'Rios' }));

    save_reference_data(db, {
      parroquias: [{ id: 1, nombre: 'Parroquia Renombrada', ubicacion: 'Ayaviri', activa: 1 }],
      ministros: [{ id: 1, client_id: 'ministro-1', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1 }],
      usuarios: [],
    });

    expect(count('parroquias')).toBe(2);
    expect(count('ministros')).toBe(1);
    expect(read(id).sacramento).toMatchObject({
      parroquia: { nombre: 'Parroquia Renombrada', ubicacion: 'Ayaviri' },
      ministro: { nombre: 'Manolo' },
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

  it('solo el párroco cambia el de su parroquia', () => {
    expect(() => save_parish_logo(dir, parish1, 2, LOGO)).toThrow(/propia parroquia/);
    expect(() => save_parish_logo(dir, admin, 2, LOGO)).toThrow(/solo consulta/);
    expect(() => save_parish_logo(dir, helper1, 1, LOGO)).toThrow(/administrador de la parroquia/);
    expect(read_parish_logo(dir, 2)).toBeNull();
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
  it('la búsqueda se limita a la parroquia indicada, y cada ministro trae su parroquia', () => {
    create_minister(db, parish2, minister({ nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz' }));
    const ministerNames = (filters: SearchFilters) => search_ministers(db, filters).resultados.map((row) => row.nombre);

    expect(ministerNames({ parroquia_id: 1 })).toEqual(['Manuel']);
    expect(ministerNames({ parroquia_id: 2 })).toEqual(['Luis']);
    expect(search_ministers(db, { parroquia_id: 2, nombres: 'Manuel' }).resultados).toEqual([]);
    expect(search_ministers(db, { parroquia_id: 2 }).resultados[0]).toMatchObject({ parroquia_id: 2, parroquia: { nombre: 'Parroquia 2' } });
  });

  it('una partida no acepta un celebrante de otra parroquia', () => {
    expect(() => create_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { ministro_id: 1 } }))).toThrow(/parroquia de la partida/);
    expect(() => create_marriage(db, parish2, marriageInput({ sacramento: { ministro_id: 1 } }))).toThrow(/parroquia de la partida/);
    expect(count('sacramentos')).toBe(0);

    const luis = create_minister(db, parish2, minister({ nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz' }));
    const id = create_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { ministro_id: luis } }));
    expect(() => update_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { id, ministro_id: 1 } }))).toThrow(/parroquia de la partida/);
    expect(read(id).sacramento.ministro_id).toBe(luis);
  });

  it('una partida ya registrada con un celebrante de otra parroquia se puede seguir editando', () => {
    const luis = create_minister(db, parish2, minister({ nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz' }));
    const id = create_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { ministro_id: luis } }));
    db.prepare('UPDATE sacramentos SET ministro_id = 1 WHERE id = ?').run(id);

    update_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { id, ministro_id: 1 }, padrino_1: 'Pedro' }));

    expect(read(id)).toMatchObject({ sacramento: { ministro_id: 1 }, padrino_1: 'Pedro' });
  });
});

describe('ministros', () => {
  const input = minister({ titulo: 'Mons.', nombre: 'Pedro', apellido_paterno: 'Vargas', apellido_materno: 'Chavez' });
  const ministerNames = (filters: SearchFilters) => search_ministers(db, filters).resultados.map((row) => row.nombre);

  it('se crean en la PC con título y un id que no choca con el servidor', () => {
    const id = create_minister(db, parish1, input);

    expect(id).not.toBe(1);
    expect(db.prepare('SELECT titulo, parroquia_id, version FROM ministros WHERE id = ?').get(id)).toEqual({
      titulo: 'Mons.',
      parroquia_id: 1,
      version: 1,
    });
    expect(db.prepare('SELECT client_id FROM ministros WHERE id = ?').pluck().get(id)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un ministro creado aquí se puede usar en una partida', () => {
    const ministerId = create_minister(db, parish1, input);
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { ministro_id: ministerId } }));

    expect(read(id).sacramento.ministro).toMatchObject({ titulo: 'Mons.', nombre: 'Pedro', apellido_paterno: 'Vargas' });
  });

  it('busca por nombre y apellidos, y ordena', () => {
    create_minister(db, parish1, input);

    expect(ministerNames({ nombres: 'Man' })).toEqual(['Manuel']);
    expect(ministerNames({ apellido_paterno: 'Varg' })).toEqual(['Pedro']);
    expect(ministerNames({ orden: 'nombres', direccion: 'desc' })).toEqual(['Pedro', 'Manuel']);
    expect(ministerNames({ nombres: 'Zzz' })).toEqual([]);
  });

  it('solo el párroco modifica los de su parroquia; un usuario los registra pero no los edita', () => {
    expect(() => update_minister(db, parish2, { ...input, id: 1 })).toThrow(/otra parroquia/);
    expect(() => toggle_minister_active(db, admin, 1)).toThrow(/solo consulta/);
    expect(() => toggle_minister_active(db, helper1, 1)).toThrow(/administrador de la parroquia/);

    const created = create_minister(db, helper1, input);
    expect(db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').pluck().get(created)).toBe(1);

    toggle_minister_active(db, parish1, 1);
    expect(db.prepare('SELECT activo, version FROM ministros WHERE id = 1').get()).toEqual({ activo: 0, version: 2 });
  });

  it('un usuario de parroquia ignora la parroquia enviada; solo el nombre es obligatorio', () => {
    const id = create_minister(db, parish1, { ...input, parroquia_id: 2 });

    expect(db.prepare('SELECT parroquia_id FROM ministros WHERE id = ?').pluck().get(id)).toBe(1);
    expect(() => create_minister(db, admin, input)).toThrow(/parroquia/);
    expect(() => create_minister(db, parish1, { ...input, nombre: ' ' })).toThrow(/nombre del ministro es requerido/);

    // Sin apellidos: se guardan vacíos.
    const without = create_minister(db, parish1, { ...input, nombre: 'Fray Juan', apellido_paterno: ' ', apellido_materno: '' });
    expect(db.prepare('SELECT nombre, apellido_paterno, apellido_materno FROM ministros WHERE id = ?').get(without)).toEqual({ nombre: 'Fray Juan', apellido_paterno: '', apellido_materno: '' });
  });
});

describe('cola de sincronización', () => {
  const queue = () =>
    db.prepare('SELECT entidad, version_base FROM sync_cola ORDER BY id').all() as {
      entidad: string;
      version_base: number | null;
    }[];
  const pedro = minister({ nombre: 'Pedro', apellido_paterno: 'Vargas', apellido_materno: 'Chavez' });

  it('anota cada tipo de registro creado, con su client_id y sin versión de partida', () => {
    create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    create_person_sacrament(db, 'confirmacion', parish1, baptismInput({}, 'confirmacion'));
    create_marriage(db, parish1, marriageInput());
    create_minister(db, parish1, pedro);

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
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { nombres: 'Diego' } }));
    annul_sacrament(db, parish1, id, 'Duplicada');

    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: null }]);
  });

  it('un registro ya sincronizado guarda la versión de la que parte el cambio, una sola vez', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    db.exec('DELETE FROM sync_cola');
    expect(db.prepare('SELECT version FROM sacramentos WHERE id = ?').pluck().get(id)).toBe(1);

    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { nombres: 'Diego' } }));
    update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id }, persona: { nombres: 'Diogo' } }));
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    annul_sacrament(db, parish1, id, 'Duplicada');
    expect(queue()).toEqual([{ entidad: 'bautismo', version_base: 3 }]);
  });

  it('anota al modificar y al deshabilitar un ministro', () => {
    update_minister(db, parish1, { ...pedro, id: 1 });
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 1 }]);

    db.exec('DELETE FROM sync_cola');
    toggle_minister_active(db, parish1, 1);
    expect(queue()).toEqual([{ entidad: 'ministro', version_base: 2 }]);
  });

  it('no anota nada si el guardado falla o no hay permiso', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, baptismInput());
    db.exec('DELETE FROM sync_cola');

    expect(() => create_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { ministro_id: 999 } }))).toThrow(/FOREIGN KEY/);
    expect(() => update_person_sacrament(db, 'bautismo', parish1, baptismInput({ sacramento: { id, ministro_id: 999 } }))).toThrow(/FOREIGN KEY/);
    expect(() => update_person_sacrament(db, 'bautismo', parish2, baptismInput({ sacramento: { id } }))).toThrow(/otra parroquia/);
    expect(() => update_minister(db, parish2, { ...pedro, id: 1 })).toThrow(/otra parroquia/);

    expect(queue()).toEqual([]);
    expect(read(id).persona.nombres).toBe('Diago');
  });

  it('consultar y descargar datos del servidor no genera cambios por subir', () => {
    search_sacraments(db, 'bautismo', {});
    search_ministers(db, {});
    save_reference_data(db, {
      parroquias: [],
      ministros: [{ id: 7, client_id: 'ministro-7', parroquia_id: 1, titulo: null, nombre: 'Luis', apellido_paterno: 'Rojas', apellido_materno: 'Flores', activo: 1 }],
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
        ministros: [{ id: 5, client_id: 'uuid-servidor', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1 }],
        usuarios: [],
      });
      expect(migrated.prepare('SELECT id, client_id FROM ministros').all()).toEqual([{ id: 5, client_id: 'uuid-servidor' }]);

      expect(() => migrated.prepare('DELETE FROM ministros WHERE id = 5').run()).toThrow(/FOREIGN KEY/);
    } finally {
      migrated.close();
    }
  });
});
