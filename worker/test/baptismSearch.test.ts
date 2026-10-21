import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { searchBaptisms } from '../src/services/baptismService';

describe('searchBaptisms (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO bautismos (
          id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          nombre, apellido_paterno, apellido_materno, estado
        ) VALUES (1, 1, '2024-01-01', '1', '1', '1', 'Juan', 'Garcia', 'Lopez', 'vigente')`,
      )
      .run();
  });

  it('encuentra la partida por nombre', async () => {
    const result = await searchBaptisms(env.prelatura_db, {
      nombre: 'Juan',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.baptisms.length).toBe(1);
  });

  it('no encuentra partidas con un apellido que no existe', async () => {
    const result = await searchBaptisms(env.prelatura_db, {
      apellidoPaterno: 'Inexistente',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.baptisms.length).toBe(0);
  });

  it('usa "nombre" como fallback seguro si sortBy no está en la lista blanca', async () => {
    const result = await searchBaptisms(env.prelatura_db, {
      // @ts-expect-error -- simula un valor malicioso de sortBy
      sortBy: 'id; DROP TABLE bautismos; --',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.baptisms).toBeDefined();
    expect(result.baptisms.length).toBe(1);
  });
});
