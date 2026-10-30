import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import {
  createConfirmation,
  updateConfirmation,
  annulConfirmation,
} from '../src/services/confirmationService';

const BASE_INPUT = {
  fechaSacramento: '2024-01-01',
  numeroLibro: '1',
  numeroFolio: '1',
  numeroRegistro: '1',
  nombre: 'Test',
  apellidoPaterno: 'Test',
  apellidoMaterno: 'Test',
};

describe('confirmationService - autorización y anulación (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1), (2, ?, 1)')
      .bind('Parroquia 1', 'Parroquia 2')
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (99, 'test.anulador', 'hash', 'Anulador', 'De', 'Prueba', 'usuario_parroquia', 1, 1)`,
      )
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO confirmaciones_legacy (client_id, id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          nombre, apellido_paterno, apellido_materno, estado
        ) VALUES (lower(hex(randomblob(16))), 1, 1, '2024-01-01', '1', '1', '1', 'Juan', 'Perez', 'Lopez', 'vigente')`,
      )
      .run();
  });

  describe('createConfirmation', () => {
    it('un usuario_parroquia crea la partida en SU parroquia, ignorando parroquiaId del body', async () => {
      const result = await createConfirmation(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        BASE_INPUT,
        2,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const created = await env.prelatura_db
          .prepare('SELECT parroquia_id FROM confirmaciones_legacy WHERE id = ?')
          .bind(result.id)
          .first<{ parroquia_id: number }>();
        expect(created?.parroquia_id).toBe(1);
      }
    });

    it('un admin debe especificar parroquiaId explícitamente', async () => {
      const result = await createConfirmation(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        BASE_INPUT,
        undefined,
      );

      expect(result.success).toBe(false);
    });
  });

  describe('updateConfirmation (autorización por parroquia)', () => {
    it('un usuario_parroquia NO puede editar una partida de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO confirmaciones_legacy (client_id, id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
            nombre, apellido_paterno, apellido_materno, estado
          ) VALUES (lower(hex(randomblob(16))), 2, 2, '2024-01-01', '1', '1', '1', 'X', 'X', 'X', 'vigente')`,
        )
        .run();

      const result = await updateConfirmation(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        2,
        BASE_INPUT,
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(403);
    });

    it('un admin puede editar cualquier partida', async () => {
      const result = await updateConfirmation(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        1,
        BASE_INPUT,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('annulConfirmation', () => {
    it('exige un motivo, rechaza motivo vacío', async () => {
      const result = await annulConfirmation(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        1,
        '',
        99,
      );

      expect(result.success).toBe(false);
    });

    it('registra correctamente estado, motivo, usuario y timestamp de anulación', async () => {
      const result = await annulConfirmation(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        1,
        'Error en el registro original',
        99,
      );

      expect(result.success).toBe(true);

      const annulled = await env.prelatura_db
        .prepare(
          'SELECT estado, motivo_anulacion, anulado_por_usuario_id, anulado_en FROM confirmaciones_legacy WHERE id = ?',
        )
        .bind(1)
        .first<{
          estado: string;
          motivo_anulacion: string;
          anulado_por_usuario_id: number;
          anulado_en: string;
        }>();

      expect(annulled?.estado).toBe('anulado');
      expect(annulled?.motivo_anulacion).toBe('Error en el registro original');
      expect(annulled?.anulado_por_usuario_id).toBe(99);
      expect(annulled?.anulado_en).toBeTruthy();
    });

    it('un usuario_parroquia no puede anular una partida de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO confirmaciones_legacy (client_id, id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
            nombre, apellido_paterno, apellido_materno, estado
          ) VALUES (lower(hex(randomblob(16))), 3, 2, '2024-01-01', '1', '1', '1', 'X', 'X', 'X', 'vigente')`,
        )
        .run();

      const result = await annulConfirmation(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        3,
        'Motivo cualquiera',
        99,
      );

      expect(result.success).toBe(false);
    });
  });
});
