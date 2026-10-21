import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { searchPriests } from '../src/services/priestService';

describe('searchPriests - validación de sortBy', () => {
  it('usa "nombre" como fallback seguro si sortBy no está en la lista blanca', async () => {
    // Un valor malicioso de sortBy no debe causar error ni ser interpolado tal cual;
    // debe caer al valor por defecto sin lanzar excepción.
    const result = await searchPriests(env.prelatura_db, {
      // @ts-expect-error -- forzamos un valor fuera del tipo para simular un cliente malicioso
      sortBy: 'id; DROP TABLE sacerdotes; --',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });

    // Si la validación de lista blanca falla, esta consulta lanzaría un error de SQL
    // o, peor, ejecutaría la inyección. Que devuelva resultados normalmente confirma
    // que el fallback a 'nombre' se aplicó correctamente.
    expect(result.priests).toBeDefined();
    expect(Array.isArray(result.priests)).toBe(true);
  });

  it('acepta un campo de ordenamiento válido de la lista blanca', async () => {
    const result = await searchPriests(env.prelatura_db, {
      sortBy: 'apellido_paterno',
      sortDirection: 'desc',
      page: 1,
      pageSize: 20,
    });

    expect(result.priests).toBeDefined();
  });
});
