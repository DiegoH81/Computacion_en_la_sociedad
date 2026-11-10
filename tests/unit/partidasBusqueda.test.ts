// @vitest-environment node
// Pedidos del padre (2026-11-08): rehabilitar una partida anulada, la búsqueda avanzada de partidas, el
// límite de la anotación marginal y la búsqueda del celebrante por su nombre completo.
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SearchFilters } from '../../shared/models';
import { NOTES_MAX_LENGTH } from '../../shared/record_fields';
import type { UserData } from '../../shared/sync';
import { open_local_database, type LocalDatabase } from '../../electron/main/db/database';
import { search_ministers } from '../../electron/main/controllers/ministers';
import {
  annul_sacrament,
  create_person_sacrament,
  read_person_sacrament,
  restore_sacrament,
  sacrament_history,
  search_sacraments,
  update_person_sacrament,
} from '../../electron/main/controllers/sacraments';
import type { Session } from '../../electron/main/models/session';
import { save_reference_data } from '../../electron/main/sync/sync';
import { baptism, TEST_MINISTER } from './helpers/records';

const parroco: Session = { user_id: 1, role: 'admin_parroquia', parish_id: 1, token: 't' };
const ayudante: Session = { user_id: 4, role: 'usuario', parish_id: 1, token: 't' };

let dir: string;
let db: LocalDatabase;

const input = (values: Parameters<typeof baptism>[1] = {}) =>
  baptism('bautismo', {
    ...values,
    sacramento: { fecha_emision: '2020-01-01', libro: '1', folio: '1', numero: '1', ...values.sacramento },
    persona: { nombres: 'Diego', apellido_paterno: 'Guido', apellido_materno: 'Alvaro', ...values.persona },
  });

const user = (id: number, parroquia_id: number | null, rol: UserData['rol']) => ({
  id,
  client_id: `servidor-${id}`,
  parroquia_id,
  username: `user${id}`,
  rol,
  nombre: 'U',
  apellido_paterno: 'P',
  apellido_materno: 'M',
  activo: 1,
  principal: 0,
  version: 1,
});

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-busqueda-'));
  db = open_local_database(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  save_reference_data(db, {
    parroquias: [{ id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 }],
    ministros: [TEST_MINISTER, { ...TEST_MINISTER, id: 5, client_id: 'ministro-5', titulo: 'Pbro.', nombre: 'Alejandro', apellido_paterno: 'Flores', apellido_materno: 'López' }],
    usuarios: [user(1, 1, 'admin_parroquia'), user(4, 1, 'usuario')],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('rehabilitar una partida anulada', () => {
  it('el párroco la rehabilita con un motivo, y queda en el historial', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    annul_sacrament(db, parroco, id, 'Duplicada');

    expect(() => restore_sacrament(db, parroco, id, '  ')).toThrow(/motivo/);
    restore_sacrament(db, parroco, id, 'No era duplicada');

    const saved = read_person_sacrament(db, 'bautismo', id).sacramento;
    expect(saved).toMatchObject({ estado: 'vigente', anulado_por_usuario_id: null, motivo_anulacion: null });
    expect(sacrament_history(db, parroco, id).slice(0, 2).map((entry) => [entry.evento, entry.motivo])).toEqual([
      ['rehabilitada', 'No era duplicada'],
      ['anulada', 'Duplicada'],
    ]);
  });

  it('el ayudante no rehabilita, y una partida vigente no se rehabilita ni se anula dos veces', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    expect(() => restore_sacrament(db, parroco, id, 'x')).toThrow(/no está anulada/);

    annul_sacrament(db, parroco, id, 'Duplicada');
    expect(() => annul_sacrament(db, parroco, id, 'Otra vez')).toThrow(/ya está anulada/);
    expect(() => restore_sacrament(db, ayudante, id, 'x')).toThrow(/administrador/);
  });
});

describe('búsqueda avanzada', () => {
  let ids: number[];

  beforeEach(() => {
    const alejandro = db.prepare(`SELECT id FROM ministros WHERE nombre = 'Alejandro'`).pluck().get() as number;
    ids = [
      create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { libro: '21', folio: '3', numero: '336', fecha_evento: '1959-10-11', anotaciones: 'Casado en Juli' }, persona: { padre: 'Juan Quispe', dni: '45879632' }, padrino_1: 'Dionisio' })),
      create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { libro: '21', folio: '4', numero: '337', fecha_evento: '1960-02-01', ministro_id: alejandro }, persona: { madre: 'Rosa Mamani' }, padrino_2: 'Carmen' })),
      create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { libro: '22', folio: '1', numero: '1', fecha_evento: '1975-05-05' } })),
    ];
    annul_sacrament(db, parroco, ids[2], 'Error');
  });

  const found = (filters: SearchFilters) => search_sacraments(db, 'bautismo', filters).resultados.map((row) => row.sacramento.id);

  it('libro, folio y número: "=" busca el valor exacto', () => {
    expect(found({ libro: { operador: '=', valor: '21' } })).toEqual([ids[0], ids[1]]);
    expect(found({ libro: { operador: '=', valor: '2' } })).toEqual([]);
    expect(found({ libro: { operador: '=', valor: '21' }, numero: { operador: '=', valor: '337' } })).toEqual([ids[1]]);
  });

  it('libro, folio y número: desde, hasta y entre comparan como número', () => {
    expect(found({ folio: { operador: 'desde', valor: '4' } })).toEqual([ids[1]]);
    expect(found({ folio: { operador: 'hasta', valor: '3' } })).toEqual([ids[0], ids[2]]);
    expect(found({ numero: { operador: 'entre', valor: '2', hasta: '336' } })).toEqual([ids[0]]);
    // Como texto, "9" quedaría después de "21"; como número, no.
    expect(found({ libro: { operador: 'desde', valor: '9' } })).toEqual([ids[0], ids[1], ids[2]]);
  });

  it('un libro con letras no entra en un rango de números, pero sí en uno de letras', () => {
    const letter = create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { libro: 'B', folio: '1', numero: '2' } }));
    expect(found({ libro: { operador: 'entre', valor: '1', hasta: '99' } })).not.toContain(letter);
    expect(found({ libro: { operador: 'entre', valor: 'a', hasta: 'c' } })).toEqual([letter]);
    expect(found({ libro: { operador: '=', valor: 'b' } })).toEqual([letter]);
  });

  it('por fechas del sacramento, celebrante, padres, DNI y padrinos', () => {
    expect(found({ fecha_evento: { operador: 'desde', valor: '1960-01-01' } })).toEqual([ids[1], ids[2]]);
    expect(found({ fecha_evento: { operador: 'entre', valor: '1959-01-01', hasta: '1959-12-31' } })).toEqual([ids[0]]);
    expect(found({ fecha_evento: { operador: '=', valor: '1960-02-01' } })).toEqual([ids[1]]);
    expect(found({ fecha_evento: { operador: 'desde', valor: '11/10/1959' } })).toEqual(ids); // fecha mal escrita: no filtra
    expect(found({ celebrante: 'flores' })).toEqual([ids[1]]);
    expect(found({ padre: 'quispe' })).toEqual([ids[0]]);
    expect(found({ madre: 'Mamani' })).toEqual([ids[1]]);
    expect(found({ dni: '4587' })).toEqual([ids[0]]);
    expect(found({ padrino: 'carmen' })).toEqual([ids[1]]);
  });

  it('por fecha de nacimiento y por el día en que se registró o modificó', () => {
    db.prepare('UPDATE personas SET fecha_nacimiento = ? WHERE id = (SELECT persona_id FROM bautismos WHERE sacramento_id = ?)').run('1959-09-01', ids[0]);
    expect(found({ fecha_nacimiento: { operador: 'hasta', valor: '1959-12-31' } })).toEqual([ids[0]]);

    db.prepare(`UPDATE sacramentos SET created_at = '2001-01-01T15:00:00.000Z', updated_at = '2001-01-01T15:00:00.000Z', version = version + 1 WHERE id <> ?`).run(ids[1]);
    expect(found({ fecha_cambio: { operador: 'desde', valor: '2020-01-01' } })).toEqual([ids[1]]);
    expect(found({ fecha_cambio: { operador: 'hasta', valor: '2001-12-31' } })).toEqual([ids[0], ids[2]]);
  });

  it('en una parroquia, en varias o en todas', () => {
    // Una partida de otra parroquia (la Parroquia 2).
    save_reference_data(db, { parroquias: [{ id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 }], ministros: [], usuarios: [] });
    const other = create_person_sacrament(db, 'bautismo', parroco, input());
    db.prepare('UPDATE sacramentos SET parroquia_id = 2 WHERE id = ?').run(other);

    expect(found({ parroquia_id: 1 })).toEqual(ids);
    expect(found({ parroquia_id: 2 })).toEqual([other]);
    expect(found({ parroquia_id: 1, parroquias: [1, 2] })).toEqual([...ids, other]);
    expect(found({ parroquia_id: 1, parroquias: [2] })).toEqual([other]);
  });

  it('por estado y por anotación marginal', () => {
    expect(found({ estado: 'anulado' })).toEqual([ids[2]]);
    expect(found({ estado: 'vigente', con_anotaciones: false })).toEqual([ids[1]]);
    expect(found({ con_anotaciones: true })).toEqual([ids[0]]);
  });
});

describe('anotación marginal', () => {
  it(`hasta ${NOTES_MAX_LENGTH} caracteres, para que entre en la impresión`, () => {
    expect(() => create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { anotaciones: 'x'.repeat(NOTES_MAX_LENGTH + 1) } }))).toThrow(/caracteres/);
    create_person_sacrament(db, 'bautismo', parroco, input({ sacramento: { anotaciones: 'x'.repeat(NOTES_MAX_LENGTH) } }));
  });

  it('una anotación vieja más larga se puede dejar igual al editar otra cosa', () => {
    const id = create_person_sacrament(db, 'bautismo', parroco, input());
    const long = 'y'.repeat(NOTES_MAX_LENGTH + 50);
    db.prepare('UPDATE sacramentos SET anotaciones = ? WHERE id = ?').run(long, id);

    update_person_sacrament(db, 'bautismo', parroco, { ...read_person_sacrament(db, 'bautismo', id), padrino_1: 'Mario' });
    expect(read_person_sacrament(db, 'bautismo', id).padrino_1).toBe('Mario');
  });
});

describe('celebrante', () => {
  it('se encuentra por el nombre completo, como queda escrito en el selector', () => {
    const names = (texto: string) => search_ministers(db, { texto }).resultados.map((minister) => minister.nombre);

    expect(names('Alejandro Flores López')).toEqual(['Alejandro']);
    expect(names('Alejandro Flores Lóp')).toEqual(['Alejandro']);
    expect(names('flores alejandro')).toEqual(['Alejandro']);
    expect(names('Torres')).toEqual(['Manuel']);
  });
});
