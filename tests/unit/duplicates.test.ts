// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import type { Session } from '../../electron/main/models/session';
import { find_duplicates, similarity } from '../../electron/main/controllers/duplicates';
import { annul_sacrament, create_marriage, create_person_sacrament } from '../../electron/main/controllers/sacraments';
import { save_reference_data } from '../../electron/main/sync/sync';
import type { DuplicateQuery } from '../../shared/models';
import { baptism, change, marriage, type BaptismValues, TEST_MINISTER, TEST_MINISTER_2 } from './helpers/records';

const parish1: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const parish2: Session = { user_id: 2, role: 'admin_parroquia', parish_id: 2, token: 't' };

// Un bautismo (o confirmación) de Nestor Quispe Machaca, libro 2, folio 1, número 713.
const partida = (values: BaptismValues = {}, tipo: 'bautismo' | 'confirmacion' = 'bautismo') =>
  baptism(tipo, {
    ...values,
    sacramento: { fecha_emision: '2010-06-15', libro: '2', folio: '1', numero: '713', ...values.sacramento },
    persona: { nombres: 'Nestor', apellido_paterno: 'Quispe', apellido_materno: 'Machaca', ...values.persona },
  });

const person = { nombres: 'Nestor', apellido_paterno: 'Quispe', apellido_materno: 'Machaca' };

let dir: string;
let db: LocalDatabase;
// Las pruebas mandan solo los datos que se llenarían en el formulario.
const query = (values: object) => values as DuplicateQuery;
const find = (persona: object, excludeId?: number) => find_duplicates(db, 'bautismo', excludeId, [query(persona)]).matches;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-duplicates-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number) => ({ id, parroquia_id, username: `u${id}`, rol: 'admin_parroquia' as const, nombre: 'U', apellido_paterno: 'P', apellido_materno: 'M', activo: 1 });
  save_reference_data(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [TEST_MINISTER, TEST_MINISTER_2],
    usuarios: [user(1, 1), user(2, 2)],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('similitud', () => {
  it('tolera acentos ya normalizados, errores de digitación y nombres incompletos', () => {
    expect(similarity('diego', 'diego')).toBe(1);
    expect(similarity('diego', 'diago')).toBeCloseTo(0.8);
    expect(similarity('juan', 'juan carlos')).toBe(0.85);
    expect(similarity('diego', 'pablo')).toBe(0);
    expect(similarity('', 'pablo')).toBe(0);
  });
});

describe('búsqueda de duplicados', () => {
  it('avisa con nivel alto si coincide el DNI, también en otra parroquia', () => {
    create_person_sacrament(db, 'bautismo', parish2, partida({ persona: { dni: '12345678' }, sacramento: { ministro_id: TEST_MINISTER_2.id } }));

    const [match, ...rest] = find({ ...person, dni: '12345678' });

    expect(rest).toEqual([]);
    expect(match).toMatchObject({ nivel: 'alta', porcentaje: 100, parroquia_nombre: 'Parroquia 2', libro: '2', folio: '1', numero: '713' });
    expect(match.coincide).toEqual(expect.arrayContaining(['DNI', 'Nombres', 'Apellido paterno']));
  });

  it('los nombres solos son "posible"; con otro dato que coincida, alta', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { fecha_nacimiento: '1979-02-25', padre: 'Toribio Quispe' } }));

    expect(find(person)[0]).toMatchObject({ nivel: 'posible', porcentaje: 100 });
    expect(find({ ...person, fecha_nacimiento: '1979-02-25' })[0]).toMatchObject({ nivel: 'alta' });
    expect(find({ ...person, padre: 'Toribio Quispe' })[0]).toMatchObject({ nivel: 'alta' });
  });

  it('una fecha incompleta que no contradice a la otra no baja el porcentaje; una distinta, sí', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { fecha_nacimiento: '1979-02-25' } }));

    expect(find({ ...person, fecha_nacimiento: '1979-02' })[0]).toMatchObject({ nivel: 'posible', porcentaje: 100 });
    expect(find({ ...person, fecha_nacimiento: '1979' })[0]).toMatchObject({ porcentaje: 100 });
    expect(find({ ...person, fecha_nacimiento: '1979-03' })[0]?.porcentaje ?? 0).toBeLessThan(100);
  });

  it('tolera acentos, mayúsculas y errores de digitación', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { nombres: 'Néstor', apellido_paterno: 'QUISPE' } }));

    expect(find({ nombres: 'nestor', apellido_paterno: 'quispe', apellido_materno: 'machaca' })[0].porcentaje).toBe(100);
    expect(find({ nombres: 'Nestar', apellido_paterno: 'Quispi', apellido_materno: 'Machaca' })).toHaveLength(1);
  });

  it('reconoce a la persona por el nombre de la partida y por el corregido en una nota marginal', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { nombres: 'Diago', cambios: [change('nombres', 'Diego')] } }));

    expect(find({ ...person, nombres: 'Diago' })[0]).toMatchObject({ nombre_completo: 'Diago Quispe Machaca', porcentaje: 100 });
    expect(find({ ...person, nombres: 'Diego' })[0]).toMatchObject({ nombre_completo: 'Diago Quispe Machaca', porcentaje: 100 });
  });

  it('no avisa por otra persona, ni por un DNI distinto con nivel alto', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { dni: '12345678', fecha_nacimiento: '1979-02-25' } }));

    expect(find({ nombres: 'Pablo', apellido_paterno: 'Rojas', apellido_materno: 'Vera' })).toEqual([]);
    expect(find({ ...person, dni: '99999999', fecha_nacimiento: '1979-02-25' }).filter((match) => match.nivel === 'alta')).toEqual([]);
  });

  it('no busca hasta tener nombre y apellido, o el DNI', () => {
    create_person_sacrament(db, 'bautismo', parish1, partida());

    expect(find({ nombres: 'Nestor' })).toEqual([]);
    expect(find({})).toEqual([]);
  });

  it('no se compara con la propia partida, con otro sacramento ni con una anulada', () => {
    const id = create_person_sacrament(db, 'bautismo', parish1, partida({ persona: { dni: '12345678' } }));
    const input = query({ ...person, dni: '12345678' });

    expect(find(input, id)).toEqual([]);
    expect(find_duplicates(db, 'confirmacion', undefined, [input]).matches).toEqual([]);

    create_person_sacrament(db, 'confirmacion', parish1, partida({ persona: { dni: '12345678' } }, 'confirmacion'));
    expect(find_duplicates(db, 'confirmacion', undefined, [input]).matches).toHaveLength(1);

    annul_sacrament(db, parish1, id, 'Duplicada');
    expect(find(input)).toEqual([]);
  });

  it('en matrimonio revisa a ambos cónyuges contra quienes ya se casaron, sin importar el lado', () => {
    const esposa = { nombres: 'Elena', apellido_paterno: 'Mamani', apellido_materno: 'Huayta', dni: '22222222' };
    create_marriage(db, parish1, marriage({
      sacramento: { fecha_emision: '2001-10-14', libro: '5', folio: '3', numero: '20' },
      conyuge_1: { ...person, dni: '11111111' },
      conyuge_2: esposa,
    }));

    const matches = find_duplicates(db, 'matrimonio', undefined, [
      query({ para: 'Esposo', nombres: 'Pablo', apellido_paterno: 'Rojas', apellido_materno: 'Vera' }),
      query({ para: 'Esposa', ...esposa }),
    ]).matches;

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ para: 'Esposa', nivel: 'alta', nombre_completo: 'Elena Mamani Huayta' });
    expect(find_duplicates(db, 'matrimonio', undefined, [query({ para: 'Esposa', ...person, dni: '11111111' })]).matches[0]).toMatchObject({ nivel: 'alta' });
  });

  it('ordena la más alta primero', () => {
    for (let i = 0; i < 5; i++) {
      create_person_sacrament(db, 'bautismo', parish1, partida({ sacramento: { numero: String(i) }, persona: { fecha_nacimiento: i === 4 ? '1979-02-25' : null } }));
    }

    const { matches, total } = find_duplicates(db, 'bautismo', undefined, [query({ ...person, fecha_nacimiento: '1979-02-25' })]);

    expect(total).toBe(5);
    expect(matches).toHaveLength(5);
    expect(matches[0]).toMatchObject({ nivel: 'alta', numero: '4' });
  });

  it('con muchas coincidencias envía solo las más altas, pero informa el total', () => {
    for (let i = 0; i < 53; i++) create_person_sacrament(db, 'bautismo', parish1, partida({ sacramento: { numero: String(i) } }));

    const { matches, total } = find_duplicates(db, 'bautismo', undefined, [query(person)]);

    expect(total).toBe(53);
    expect(matches).toHaveLength(50);
  });

  it('en matrimonio ordena juntas las coincidencias de ambos cónyuges', () => {
    create_marriage(db, parish1, marriage({
      sacramento: { fecha_emision: '2001-10-14', libro: '5', folio: '3', numero: '20' },
      conyuge_1: { ...person, dni: '11111111' },
      conyuge_2: { nombres: 'Elena', apellido_paterno: 'Mamani', apellido_materno: 'Huayta' },
    }));

    const { matches, total } = find_duplicates(db, 'matrimonio', undefined, [
      query({ para: 'Esposa', nombres: 'Elena', apellido_paterno: 'Mamani', apellido_materno: 'Huayta' }),
      query({ para: 'Esposo', ...person, dni: '11111111' }),
    ]);

    expect(total).toBe(2);
    expect(matches.map((match) => [match.para, match.nivel])).toEqual([['Esposo', 'alta'], ['Esposa', 'posible']]);
  });

  it('rechaza un sacramento desconocido', () => {
    expect(() => find_duplicates(db, 'otro' as 'bautismo', undefined, [query(person)])).toThrow(/inválido/);
  });
});
