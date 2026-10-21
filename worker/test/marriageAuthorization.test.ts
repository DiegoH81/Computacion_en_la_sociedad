import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { createMarriage, updateMarriage, annulMarriage } from '../src/services/marriageService';

const EMPTY_PERSON = {
  nombre: 'Test',
  apellidoPaterno: 'Test',
  apellidoMaterno: 'Test',
};

describe('marriageService - autorización y anulación (integración con D1)', () => {
  beforeEach(async () => {
    await resetDatabase(env.prelatura_db);

    await env.prelatura_db
      .prepare('INSERT INTO parroquias (id, nombre, activa) VALUES (1, ?, 1), (2, ?, 1)')
      .bind('Parroquia 1', 'Parroquia 2')
      .run();

    // Usuario real necesario porque matrimonios.anulado_por_usuario_id
    // es FK hacia usuarios(id); los tests de anulación referencian id=99.
    await env.prelatura_db
      .prepare(
        `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno,
                              rol, parroquia_id, activo)
         VALUES (99, 'test.anulador', 'hash', 'Anulador', 'De', 'Prueba', 'usuario_parroquia', 1, 1)`,
      )
      .run();

    await env.prelatura_db
      .prepare(
        `INSERT INTO matrimonios (
          id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
          esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
          esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno, estado
        ) VALUES (1, 1, '2024-01-01', '1', '1', '1', 'Juan', 'Perez', 'Lopez', 'Maria', 'Rojas', 'Diaz', 'vigente')`,
      )
      .run();
  });

  describe('createMarriage', () => {
    it('un usuario_parroquia crea la partida en SU parroquia, ignorando parroquiaId del body', async () => {
      const result = await createMarriage(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        {
          fechaSacramento: '2024-03-01',
          numeroLibro: '1',
          numeroFolio: '3',
          numeroRegistro: '3',
          esposo: EMPTY_PERSON,
          esposa: EMPTY_PERSON,
        },
        2, // intenta inyectar parroquia 2
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const created = await env.prelatura_db
          .prepare('SELECT parroquia_id FROM matrimonios WHERE id = ?')
          .bind(result.id)
          .first<{ parroquia_id: number }>();
        expect(created?.parroquia_id).toBe(1);
      }
    });

    it('un admin debe especificar parroquiaId explícitamente', async () => {
      const result = await createMarriage(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        {
          fechaSacramento: '2024-03-01',
          numeroLibro: '1',
          numeroFolio: '3',
          numeroRegistro: '3',
          esposo: EMPTY_PERSON,
          esposa: EMPTY_PERSON,
        },
        undefined,
      );

      expect(result.success).toBe(false);
    });
  });

  describe('updatePriest (autorización por parroquia)', () => {
    it('un usuario_parroquia NO puede editar una partida de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO matrimonios (
            id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
            esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
            esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno, estado
          ) VALUES (2, 2, '2024-01-01', '1', '1', '1', 'X', 'X', 'X', 'Y', 'Y', 'Y', 'vigente')`,
        )
        .run();

      const result = await updateMarriage(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        2,
        {
          fechaSacramento: '2024-01-01',
          numeroLibro: '1',
          numeroFolio: '1',
          numeroRegistro: '1',
          esposo: EMPTY_PERSON,
          esposa: EMPTY_PERSON,
        },
      );

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(403);
    });

    it('un admin puede editar cualquier partida', async () => {
      const result = await updateMarriage(
        env.prelatura_db,
        { rol: 'admin', parroquiaId: null },
        1,
        {
          fechaSacramento: '2024-01-01',
          numeroLibro: '1',
          numeroFolio: '1',
          numeroRegistro: '1',
          esposo: EMPTY_PERSON,
          esposa: EMPTY_PERSON,
        },
      );

      expect(result.success).toBe(true);
    });
  });

  describe('annulMarriage', () => {
    it('exige un motivo, rechaza motivo vacío', async () => {
      const result = await annulMarriage(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        1,
        '',
        99,
      );

      expect(result.success).toBe(false);
    });

    it('registra correctamente estado, motivo, usuario y timestamp de anulación', async () => {
      const result = await annulMarriage(
        env.prelatura_db,
        { rol: 'usuario_parroquia', parroquiaId: 1 },
        1,
        'Nulidad declarada por autoridad eclesiástica',
        99,
      );

      expect(result.success).toBe(true);

      const annulled = await env.prelatura_db
        .prepare(
          'SELECT estado, motivo_anulacion, anulado_por_usuario_id, anulado_en FROM matrimonios WHERE id = ?',
        )
        .bind(1)
        .first<{
          estado: string;
          motivo_anulacion: string;
          anulado_por_usuario_id: number;
          anulado_en: string;
        }>();

      expect(annulled?.estado).toBe('anulado');
      expect(annulled?.motivo_anulacion).toBe('Nulidad declarada por autoridad eclesiástica');
      expect(annulled?.anulado_por_usuario_id).toBe(99);
      expect(annulled?.anulado_en).toBeTruthy();
    });

    it('un usuario_parroquia no puede anular una partida de otra parroquia', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO matrimonios (
            id, parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
            esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
            esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno, estado
          ) VALUES (3, 2, '2024-01-01', '1', '1', '1', 'X', 'X', 'X', 'Y', 'Y', 'Y', 'vigente')`,
        )
        .run();

      const result = await annulMarriage(
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
