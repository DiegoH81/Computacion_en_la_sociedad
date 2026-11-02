// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLocalDatabase, type LocalDatabase } from '../../electron/main/localDb/database';
import type { Session } from '../../electron/main/services/common';
import { marriages } from '../../electron/main/services/marriages';
import { applyReferenceData } from '../../electron/main/services/reference';
import { singlePersonSacrament, type SinglePersonInput } from '../../electron/main/services/singlePersonSacraments';
import { ageAt, getStatistics } from '../../electron/main/services/statistics';

const baptisms = singlePersonSacrament('bautismo');
const confirmations = singlePersonSacrament('confirmacion');
const parish1: Session = { usuarioId: 1, rol: 'usuario_parroquia', parroquiaId: 1, token: 't' };
const parish2: Session = { usuarioId: 2, rol: 'usuario_parroquia', parroquiaId: 2, token: 't' };
const NOW = new Date(2026, 5, 15); // 15 de junio de 2026

let dir: string;
let db: LocalDatabase;

const partida = (fecha: string, overrides: Partial<SinglePersonInput> = {}): SinglePersonInput => ({
  fechaSacramento: fecha,
  numeroLibro: '1',
  numeroFolio: '1',
  numeroRegistro: '1',
  nombre: 'Ana',
  apellidoPaterno: 'Paz',
  apellidoMaterno: 'Rey',
  ...overrides,
});

const stats = (year?: number, parroquiaId = 1) => getStatistics(db, parroquiaId, year, NOW);

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'prelatura-statistics-'));
  db = openLocalDatabase(path.join(dir, 'local.db'), randomBytes(32).toString('hex'));
  const user = (id: number, parroquia_id: number) => ({ id, parroquia_id, username: `u${id}`, rol: 'usuario_parroquia', nombre: 'U', apellido_paterno: 'P', apellido_materno: 'M', activo: 1 });
  applyReferenceData(db, {
    parroquias: [
      { id: 1, nombre: 'Parroquia 1', ubicacion: null, activa: 1 },
      { id: 2, nombre: 'Parroquia 2', ubicacion: null, activa: 1 },
    ],
    ministros: [
      { id: 1, client_id: 'm1', parroquia_id: 1, titulo: null, nombre: 'Manuel', apellido_paterno: 'Torres', apellido_materno: 'Rios', activo: 1, version: 1 },
      { id: 2, client_id: 'm2', parroquia_id: 1, titulo: null, nombre: 'Luis', apellido_paterno: 'Ramos', apellido_materno: 'Paz', activo: 1, version: 1 },
    ],
    usuarios: [user(1, 1), user(2, 2)],
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('edad al recibir el sacramento', () => {
  it('cuenta solo los cumpleaños ya cumplidos', () => {
    expect(ageAt('2000-06-15', '2010-06-15')).toBe(10);
    expect(ageAt('2000-06-16', '2010-06-15')).toBe(9);
    expect(ageAt('2000-06-15', '2000-07-01')).toBe(0);
  });

  it('descarta datos incoherentes o incompletos', () => {
    expect(ageAt('2011-01-01', '2010-06-15')).toBeNull();
    expect(ageAt('1700-01-01', '2010-06-15')).toBeNull();
    expect(ageAt(null, '2010-06-15')).toBeNull();
    expect(ageAt('25/02/1979', '2010-06-15')).toBeNull();
  });
});

describe('estadísticas', () => {
  it('cuenta por sacramento en el año, el mes actual y el histórico', () => {
    baptisms.create(db, parish1, partida('2026-06-01'), undefined);
    baptisms.create(db, parish1, partida('2026-02-01'), undefined);
    baptisms.create(db, parish1, partida('2020-02-01'), undefined);
    confirmations.create(db, parish1, partida('2026-06-10'), undefined);

    const { totales } = stats(2026);

    expect(totales.bautismo).toEqual({ anio: 2, anterior: 0, mes: 1, historico: 3 });
    expect(totales.confirmacion).toEqual({ anio: 1, anterior: 0, mes: 1, historico: 1 });
    expect(totales.matrimonio).toEqual({ anio: 0, anterior: 0, mes: 0, historico: 0 });
  });

  it('un año en curso se compara con el mismo tramo del anterior; uno pasado, con el año completo', () => {
    baptisms.create(db, parish1, partida('2025-03-01'), undefined);
    baptisms.create(db, parish1, partida('2025-06-15'), undefined);
    baptisms.create(db, parish1, partida('2025-06-16'), undefined);
    baptisms.create(db, parish1, partida('2024-11-30'), undefined);

    expect(stats(2026).totales.bautismo.anterior).toBe(2);
    expect(stats(2025).totales.bautismo.anterior).toBe(1);
  });

  it('usa la fecha de la celebración y, si falta, la del registro', () => {
    baptisms.create(db, parish1, partida('2026-01-20', { fechaBautizo: '2025-12-28' }), undefined);
    baptisms.create(db, parish1, partida('2026-03-05'), undefined);

    expect(stats(2025).mensual[11].bautismo).toBe(1);
    expect(stats(2026).mensual[2].bautismo).toBe(1);
    expect(stats(2026).mensual[0].bautismo).toBe(0);
  });

  it('solo cuenta la parroquia indicada y excluye las anuladas', () => {
    baptisms.create(db, parish2, partida('2026-01-01'), undefined);
    const anulada = baptisms.create(db, parish1, partida('2026-01-01'), undefined);
    baptisms.create(db, parish1, partida('2026-01-02'), undefined);
    baptisms.annul(db, parish1, anulada, 'Duplicada');

    expect(stats(2026).totales.bautismo.anio).toBe(1);
    expect(stats(2026).registro.anuladas).toBe(1);
    expect(stats(2026, 2).totales.bautismo.anio).toBe(1);
  });

  it('agrupa edades con la fecha de nacimiento o la edad, y separa las que no tienen dato', () => {
    baptisms.create(db, parish1, partida('2026-01-01', { fechaNacimiento: '2025-12-01' }), undefined);
    baptisms.create(db, parish1, partida('2026-01-01', { edad: '8' }), undefined);
    baptisms.create(db, parish1, partida('2026-01-01', { edad: '50' }), undefined);
    baptisms.create(db, parish1, partida('2026-01-01'), undefined);

    expect(stats(2026).edades.bautismo).toEqual({
      bandas: [1, 0, 1, 0, 0, 0, 1],
      sinDato: 1,
      promedio: 19.3,
    });
  });

  it('en matrimonio cuenta a los dos cónyuges en las edades, pero una sola partida', () => {
    marriages.create(db, parish1, {
      fechaSacramento: '2026-02-14',
      numeroLibro: '1',
      numeroFolio: '1',
      numeroRegistro: '1',
      esposo: { nombre: 'Luis', apellidoPaterno: 'Paz', edad: '30' },
      esposa: { nombre: 'Rosa', apellidoPaterno: 'Rey', edad: '28' },
    }, undefined);

    const { totales, edades } = stats(2026);

    expect(totales.matrimonio.anio).toBe(1);
    expect(edades.matrimonio.bandas).toEqual([0, 0, 0, 0, 1, 1, 0]);
    expect(edades.matrimonio.promedio).toBe(29);
  });

  it('ordena a los celebrantes y resume el estado del registro', () => {
    baptisms.create(db, parish1, partida('2026-01-01', { celebranteId: 2 }), undefined);
    baptisms.create(db, parish1, partida('2026-01-02', { celebranteId: 2 }), undefined);
    confirmations.create(db, parish1, partida('2026-01-03', { celebranteId: 1 }), undefined);
    baptisms.create(db, parish1, partida('2026-01-04', { correcciones: [{ campo: 'nombres', valorNuevo: 'Anita' }] }), undefined);

    const { ministros, registro } = stats(2026);

    expect(ministros).toEqual([
      { nombre: 'Luis Ramos Paz', total: 2 },
      { nombre: 'Manuel Torres Rios', total: 1 },
    ]);
    expect(registro).toEqual({ anuladas: 0, sinCelebrante: 1, conCorrecciones: 1 });
  });

  it('ofrece los años con datos y el actual, y arma la tendencia hasta el año elegido', () => {
    baptisms.create(db, parish1, partida('2023-05-01'), undefined);
    baptisms.create(db, parish1, partida('2025-05-01'), undefined);

    const result = stats(2025);

    expect(result.anios).toEqual([2026, 2025, 2023]);
    expect(result.esAnioActual).toBe(false);
    expect(result.tendencia.map((row) => [row.anio, row.bautismo])).toEqual([[2023, 1], [2024, 0], [2025, 1]]);
  });

  it('con un año inválido o sin datos usa el actual', () => {
    expect(stats(undefined)).toMatchObject({ anio: 2026, esAnioActual: true, anios: [2026] });
    expect(getStatistics(db, 1, '1; DROP TABLE personas', NOW).anio).toBe(2026);
    expect(stats(undefined).ministros).toEqual([]);
    expect(stats(undefined).registro).toEqual({ anuladas: 0, sinCelebrante: 0, conCorrecciones: 0 });
  });
});
