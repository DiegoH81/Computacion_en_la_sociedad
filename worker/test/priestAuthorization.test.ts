import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { createPriest, updatePriest, togglePriestActive } from '../src/services/priestService';

describe('priestService - autorización (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1), (2, ?, 1)')
      .bind('Parroquia 1', 'Parroquia 2')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO sacerdotes (id, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
         VALUES (1, 'Braulio', 'Guido', 'Alvaro', 1, 1)`,
      )
      .run();
  });

  describe('createPriest', () => {
    it('un usuario_parroquia crea el sacerdote en SU parroquia, ignorando cualquier parroquiaId del body', async () => {
      const result = await createPriest(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        { nombre: 'Juan', apellidoPaterno: 'Perez', apellidoMaterno: 'Lopez' },
        2, // intenta inyectar parroquia 2, debe ser ignorado
      );

      expect(result.success).toBe(true);

      const created = await env.prelatura_db
        .prepare('SELECT parroquia_id FROM sacerdotes WHERE nombre = ?')
        .bind('Juan')
        .first<{ parroquia_id: number }>();

      // Debe quedar en la parroquia REAL del usuario (1), no en la inyectada (2).
      expect(created?.parroquia_id).toBe(1);
    });

    it('un admin debe especificar parroquiaId explícitamente', async () => {
      const result = await createPriest(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        { nombre: 'Juan', apellidoPaterno: 'Perez', apellidoMaterno: 'Lopez' },
        undefined,
      );

      expect(result.success).toBe(false);
    });

    it('un admin puede crear en la parroquia que especifique', async () => {
      const result = await createPriest(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        { nombre: 'Juan', apellidoPaterno: 'Perez', apellidoMaterno: 'Lopez' },
        2,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('updatePriest', () => {
    it('un usuario_parroquia NO puede editar un sacerdote de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO sacerdotes (id, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
           VALUES (2, 'Manuel', 'Torres', 'Rios', 2, 1)`,
        )
        .run();

      const result = await updatePriest(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        2, // sacerdote de la parroquia 2
        { nombre: 'Manuel Modificado', apellidoPaterno: 'Torres', apellidoMaterno: 'Rios' },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
      }
    });

    it('un usuario_parroquia SÍ puede editar un sacerdote de su propia parroquia', async () => {
      const result = await updatePriest(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        1,
        { nombre: 'Braulio Modificado', apellidoPaterno: 'Guido', apellidoMaterno: 'Alvaro' },
      );

      expect(result.success).toBe(true);
    });

    it('un admin puede editar cualquier sacerdote sin importar la parroquia', async () => {
      const result = await updatePriest(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        1,
        { nombre: 'Braulio Modificado', apellidoPaterno: 'Guido', apellidoMaterno: 'Alvaro' },
      );

      expect(result.success).toBe(true);
    });
  });

  describe('togglePriestActive', () => {
    it('un usuario_parroquia no puede deshabilitar un sacerdote de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO sacerdotes (id, nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
           VALUES (2, 'Manuel', 'Torres', 'Rios', 2, 1)`,
        )
        .run();

      const result = await togglePriestActive(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        2,
      );

      expect(result.success).toBe(false);
    });
  });
});
