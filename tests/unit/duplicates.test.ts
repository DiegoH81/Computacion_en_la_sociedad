// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLocalDatabase, type LocalDatabase } from '../../electron/main/localDb/database';
import type { Session } from '../../electron/main/services/common';
import { findDuplicates, similarity } from '../../electron/main/services/duplicates';
import { marriages } from '../../electron/main/services/marriages';
import { applyReferenceData } from '../../electron/main/services/reference';
import { singlePersonSacrament, type SinglePersonInput } from '../../electron/main/services/singlePersonSacraments';

const baptisms = singlePersonSacrament('bautismo');
const confirmations = singlePersonSacrament('confirmacion');
const parish1: Session = { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1, token: 't' };
const parish2: Session = { usuarioId: 2, rol: 'usuario_parroquia', parroquiaId: 2, token: 't' };

const partida = (overrides: Partial<SinglePersonInput> = {}): SinglePersonInput => ({
  fechaSacramento: '2010-06-15',
  numeroLibro: '2',
  numeroFolio: '1',
  numeroRegistro: '713',
  nombre: 'Nestor',
  apellidoPaterno: 'Quispe',
  apellidoMaterno: 'Machaca',
  ...overrides,
});

const person = { nombre: 'Nestor', apellidoPaterno: 'Quispe', apellidoMaterno: 'Machaca' };

let dir: string;
let db: LocalDatabase;
const find = (persona: object, excludeId?: number) => findDuplicates(db, 'bautismo', excludeId, [persona]).matches;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-duplicates-'));
  db = openLocalDatabase(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number) => ({ id, parroquia_id, username: `u${id}`, rol: 'usuario_parroquia', nombre: 'U', apellido_paterno: 'P', apellido_materno: 'M', activo: 1 });
  applyReferenceData(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [],
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
    baptisms.create(db, parish2, partida({ dni: '12345678' }), undefined);

    const [match, ...rest] = find({ ...person, dni: '12345678' });

    expect(rest).toEqual([]);
    expect(match).toMatchObject({ nivel: 'alta', porcentaje: 100, parroquia: 'Parroquia 2', libro: '2', folio: '1', numero: '713' });
    expect(match.coincide).toEqual(expect.arrayContaining(['DNI', 'Nombres', 'Apellido paterno']));
  });

  it('los nombres solos son "posible"; con otro dato que coincida, alta', () => {
    baptisms.create(db, parish1, partida({ fechaNacimiento: '1979-02-25', padreNombre: 'Toribio Quispe' }), undefined);

    expect(find(person)[0]).toMatchObject({ nivel: 'posible', porcentaje: 100 });
    expect(find({ ...person, fechaNacimiento: '1979-02-25' })[0]).toMatchObject({ nivel: 'alta' });
    expect(find({ ...person, padreNombre: 'Toribio Quispe' })[0]).toMatchObject({ nivel: 'alta' });
  });

  it('tolera acentos, mayúsculas y errores de digitación', () => {
    baptisms.create(db, parish1, partida({ nombre: 'Néstor', apellidoPaterno: 'QUISPE' }), undefined);

    expect(find({ nombre: 'nestor', apellidoPaterno: 'quispe', apellidoMaterno: 'machaca' })[0].porcentaje).toBe(100);
    expect(find({ nombre: 'Nestar', apellidoPaterno: 'Quispi', apellidoMaterno: 'Machaca' })).toHaveLength(1);
  });

  it('reconoce a la persona por el nombre que tenía antes de una nota marginal', () => {
    baptisms.create(db, parish1, partida({ nombre: 'Diago', correcciones: [{ campo: 'nombres', valorNuevo: 'Diego' }] }), undefined);

    expect(find({ ...person, nombre: 'Diago' })[0]).toMatchObject({ nombreCompleto: 'Diego Quispe Machaca', porcentaje: 100 });
  });

  it('no avisa por otra persona, ni por un DNI distinto con nivel alto', () => {
    baptisms.create(db, parish1, partida({ dni: '12345678', fechaNacimiento: '1979-02-25' }), undefined);

    expect(find({ nombre: 'Pablo', apellidoPaterno: 'Rojas', apellidoMaterno: 'Vera' })).toEqual([]);
    expect(find({ ...person, dni: '99999999', fechaNacimiento: '1979-02-25' }).filter((match) => match.nivel === 'alta')).toEqual([]);
  });

  it('no busca hasta tener nombre y apellido, o el DNI', () => {
    baptisms.create(db, parish1, partida(), undefined);

    expect(find({ nombre: 'Nestor' })).toEqual([]);
    expect(find({})).toEqual([]);
  });

  it('no se compara con la propia partida, con otro sacramento ni con una anulada', () => {
    const id = baptisms.create(db, parish1, partida({ dni: '12345678' }), undefined);
    const input = { ...person, dni: '12345678' };

    expect(find(input, id)).toEqual([]);
    expect(findDuplicates(db, 'confirmacion', undefined, [input]).matches).toEqual([]);

    confirmations.create(db, parish1, partida({ dni: '12345678' }), undefined);
    expect(findDuplicates(db, 'confirmacion', undefined, [input]).matches).toHaveLength(1);

    baptisms.annul(db, parish1, id, 'Duplicada');
    expect(find(input)).toEqual([]);
  });

  it('en matrimonio revisa a ambos cónyuges contra quienes ya se casaron, sin importar el lado', () => {
    const esposa = { nombre: 'Elena', apellidoPaterno: 'Mamani', apellidoMaterno: 'Huayta', dni: '22222222' };
    marriages.create(db, parish1, {
      fechaSacramento: '2001-10-14',
      numeroLibro: '5',
      numeroFolio: '3',
      numeroRegistro: '20',
      esposo: { ...person, dni: '11111111' },
      esposa,
    }, undefined);

    const matches = findDuplicates(db, 'matrimonio', undefined, [
      { para: 'Esposo', nombre: 'Pablo', apellidoPaterno: 'Rojas', apellidoMaterno: 'Vera' },
      { para: 'Esposa', ...esposa },
    ]).matches;

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ para: 'Esposa', nivel: 'alta', nombreCompleto: 'Elena Mamani Huayta' });
    expect(findDuplicates(db, 'matrimonio', undefined, [{ para: 'Esposa', ...person, dni: '11111111' }]).matches[0]).toMatchObject({ nivel: 'alta' });
  });

  it('ordena la más alta primero', () => {
    for (let i = 0; i < 5; i++) {
      baptisms.create(db, parish1, partida({ numeroRegistro: String(i), fechaNacimiento: i === 4 ? '1979-02-25' : undefined }), undefined);
    }

    const { matches, total } = findDuplicates(db, 'bautismo', undefined, [{ ...person, fechaNacimiento: '1979-02-25' }]);

    expect(total).toBe(5);
    expect(matches).toHaveLength(5);
    expect(matches[0]).toMatchObject({ nivel: 'alta', numero: '4' });
  });

  it('con muchas coincidencias envía solo las más altas, pero informa el total', () => {
    for (let i = 0; i < 53; i++) baptisms.create(db, parish1, partida({ numeroRegistro: String(i) }), undefined);

    const { matches, total } = findDuplicates(db, 'bautismo', undefined, [person]);

    expect(total).toBe(53);
    expect(matches).toHaveLength(50);
  });

  it('en matrimonio ordena juntas las coincidencias de ambos cónyuges', () => {
    marriages.create(db, parish1, {
      fechaSacramento: '2001-10-14',
      numeroLibro: '5',
      numeroFolio: '3',
      numeroRegistro: '20',
      esposo: { ...person, dni: '11111111' },
      esposa: { nombre: 'Elena', apellidoPaterno: 'Mamani', apellidoMaterno: 'Huayta' },
    }, undefined);

    const { matches, total } = findDuplicates(db, 'matrimonio', undefined, [
      { para: 'Esposa', nombre: 'Elena', apellidoPaterno: 'Mamani', apellidoMaterno: 'Huayta' },
      { para: 'Esposo', ...person, dni: '11111111' },
    ]);

    expect(total).toBe(2);
    expect(matches.map((match) => [match.para, match.nivel])).toEqual([['Esposo', 'alta'], ['Esposa', 'posible']]);
  });

  it('rechaza un sacramento desconocido', () => {
    expect(() => findDuplicates(db, 'otro' as 'bautismo', undefined, [person])).toThrow(/inválido/);
  });
});
