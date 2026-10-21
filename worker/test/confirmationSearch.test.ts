import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { searchConfirmations } from '../src/services/confirmationService';

describe('searchConfirmations (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1)')
      .bind('Parroquia de Prueba')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO confirmaciones (
          id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          nombre, apellido_paterno, apellido_materno, estado
        ) VALUES (1, 1, '2024-01-01', '1', '1', '1', 'Juan', 'Garcia', 'Lopez', 'vigente')`,
      )
      .run();
  });

  it('encuentra la partida por nombre', async () => {
    const result = await searchConfirmations(env.prelatura_db, {
      nombre: 'Juan',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.confirmations.length).toBe(1);
  });

  it('no encuentra partidas con un apellido que no existe', async () => {
    const result = await searchConfirmations(env.prelatura_db, {
      apellidoPaterno: 'Inexistente',
      sortBy: 'nombre',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.confirmations.length).toBe(0);
  });

  it('usa "nombre" como fallback seguro si sortBy no está en la lista blanca', async () => {
    const result = await searchConfirmations(env.prelatura_db, {
      // @ts-expect-error -- simula un valor malicioso de sortBy
      sortBy: 'id; DROP TABLE confirmaciones; --',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    expect(result.confirmations).toBeDefined();
    expect(result.confirmations.length).toBe(1);
  });
});
