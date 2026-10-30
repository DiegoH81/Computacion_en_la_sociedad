import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { searchMarriages } from '../src/services/marriageService';

describe('searchMarriages (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO matrimonios_legacy (client_id, id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
          esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno, estado
        ) VALUES (lower(hex(randomblob(16))), 1, 1, '2024-01-01', '1', '1', '1', 'Juan', 'Garcia', 'Lopez', 'Maria', 'Rojas', 'Diaz', 'vigente')`,
      )
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO matrimonios_legacy (client_id, id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
          esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno, estado
        ) VALUES (lower(hex(randomblob(16))), 2, 1, '2024-02-01', '1', '2', '2', 'Pedro', 'Sanchez', 'Torres', 'Ana', 'Garcia', 'Perez', 'vigente')`,
      )
      .run();
  });

  it('encuentra la partida cuando el apellido buscado pertenece al ESPOSO', async () => {
    const result = await searchMarriages(env.prelatura_db, {
      apellidoPaterno: 'Garcia',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    // "Garcia" es apellido paterno del esposo en la partida 1.
    expect(result.marriages.some((m) => m.id === 1)).toBe(true);
  });

  it('encuentra la partida cuando el apellido buscado pertenece a la ESPOSA (OR confirmado en Fase 1)', async () => {
    const result = await searchMarriages(env.prelatura_db, {
      apellidoPaterno: 'Garcia',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    // "Garcia" también es apellido paterno de la ESPOSA en la partida 2.
    expect(result.marriages.some((m) => m.id === 2)).toBe(true);
  });

  it('no encuentra partidas con un apellido que no existe en ninguno de los dos cónyuges', async () => {
    const result = await searchMarriages(env.prelatura_db, {
      apellidoPaterno: 'ApellidoInexistente',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.marriages.length).toBe(0);
  });

  it('usa "nombre" como fallback seguro si sortBy no está en la lista blanca', async () => {
    const result = await searchMarriages(env.prelatura_db, {
      // @ts-expect-error -- simula un valor malicioso de sortBy
      sortBy: 'id; DROP TABLE matrimonios_legacy; --',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.marriages).toBeDefined();
    expect(result.marriages.length).toBe(2);
  });
});
