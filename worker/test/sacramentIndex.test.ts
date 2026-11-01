import { describe, it, expect, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { signJwt } from '../src/lib/jwt';

const ADMIN_ID = 1;
const PARISH_USER_ID = 2;

async function get(path: string, token?: string): Promise<Response> {
  return SELF.fetch(`https://example.com${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function insertBaptism(
  parroquiaId: number,
  libro: string,
  registro: string,
  nombre: string,
  paterno: string,
  materno: string,
  estado: 'vigente' | 'anulado' = 'vigente',
): Promise<void> {
  const anulacion =
    estado === 'anulado' ? [ADMIN_ID, '2024-01-01T00:00:00.000Z', 'Prueba'] : [null, null, null];
  await env.prelatura_db
    .prepare(
      `INSERT INTO bautismos_legacy (client_id, parroquia_id, fecha_sacramento, numero_libro, numero_folio,
         numero_registro, nombre, apellido_paterno, apellido_materno, estado,
         anulado_por_usuario_id, anulado_en, motivo_anulacion)
       VALUES (lower(hex(randomblob(16))), ?, '2024-01-01', ?, '1', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(parroquiaId, libro, registro, nombre, paterno, materno, estado, ...anulacion)
    .run();
}

describe('rutas /api/sacrament-index (Worker real + D1)', () => {
  let adminToken: string;
  let parishToken: string;

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
         VALUES (?, 'admin', 'hash', 'Administrador', 'De', 'Prueba', 'admin', NULL, 1),
                (?, 'parroco1', 'hash', 'Usuario', 'Parroquia', 'Uno', 'usuario_parroquia', 1, 1)`,
      )
      .bind(ADMIN_ID, PARISH_USER_ID)
      .run();

    adminToken = await signJwt({ usuarioId: ADMIN_ID, rol: 'admin', parroquiaId: null }, env.JWT_SECRET);
    parishToken = await signJwt(
      { usuarioId: PARISH_USER_ID, rol: 'usuario_parroquia', parroquiaId: 1 },
      env.JWT_SECRET,
    );
  });

  describe('permisos', () => {
    it('sin sesión responde 401', async () => {
      const response = await get('/api/sacrament-index/bautismo?parroquiaId=1');
      expect(response.status).toBe(401);
    });

    it('un usuario no puede pedir el índice de otra parroquia', async () => {
      for (const path of ['bautismo', 'bautismo/libros']) {
        const response = await get(`/api/sacrament-index/${path}?parroquiaId=2`, parishToken);
        expect(response.status).toBe(403);
      }
    });

    it('un admin puede pedir el índice de cualquier parroquia', async () => {
      await insertBaptism(2, '1', '1', 'Ana', 'Quispe', 'Mamani');
      const response = await get('/api/sacrament-index/bautismo?parroquiaId=2', adminToken);
      const body = (await response.json()) as { entries: unknown[] };
      expect(response.status).toBe(200);
      expect(body.entries).toHaveLength(1);
    });

    it('exige una parroquia válida', async () => {
      for (const query of ['', '?parroquiaId=abc', '?parroquiaId=0']) {
        const response = await get(`/api/sacrament-index/bautismo${query}`, adminToken);
        expect(response.status).toBe(400);
      }
    });

    it('rechaza un tipo de sacramento desconocido', async () => {
      for (const tipo of ['usuarios', 'constructor']) {
        const response = await get(`/api/sacrament-index/${tipo}?parroquiaId=1`, adminToken);
        expect(response.status).toBe(404);
      }
    });
  });

  describe('libros', () => {
    it('lista los libros vigentes de la parroquia en orden numérico', async () => {
      await insertBaptism(1, '10', '1', 'A', 'A', 'A');
      await insertBaptism(1, '2', '2', 'B', 'B', 'B');
      await insertBaptism(1, '2', '3', 'C', 'C', 'C');
      await insertBaptism(1, '7', '4', 'D', 'D', 'D', 'anulado');
      await insertBaptism(2, '99', '5', 'E', 'E', 'E');

      const response = await get('/api/sacrament-index/bautismo/libros?parroquiaId=1', parishToken);
      expect(await response.json()).toEqual({ libros: ['2', '10'] });
    });
  });

  describe('entradas', () => {
    it('ordena alfabéticamente por apellidos y nombres, sin distinguir acentos ni mayúsculas', async () => {
      await insertBaptism(1, '1', '1', 'Zoe', 'Ñahui', 'Rojas');
      await insertBaptism(1, '1', '2', 'Luis', 'álvarez', 'Pérez');
      await insertBaptism(1, '1', '3', 'Ana', 'Alvarez', 'Pérez');
      await insertBaptism(1, '1', '4', 'Rosa', 'Nina', 'Cruz');
      await insertBaptism(1, '1', '5', 'Ema', 'Oré', 'Cruz');

      const response = await get('/api/sacrament-index/bautismo?parroquiaId=1', parishToken);
      const { entries } = (await response.json()) as { entries: { nombres: string }[] };
      expect(entries.map((entry) => entry.nombres)).toEqual(['Ana', 'Luis', 'Rosa', 'Zoe', 'Ema']);
    });

    it('filtra por libro y excluye anuladas y otras parroquias', async () => {
      await insertBaptism(1, '1', '1', 'Sí', 'Uno', 'X');
      await insertBaptism(1, '2', '2', 'OtroLibro', 'Dos', 'X');
      await insertBaptism(1, '1', '3', 'Anulada', 'Tres', 'X', 'anulado');
      await insertBaptism(2, '1', '4', 'OtraParroquia', 'Cuatro', 'X');

      const response = await get('/api/sacrament-index/bautismo?parroquiaId=1&libro=1', parishToken);
      expect(await response.json()).toEqual({
        entries: [
          {
            nombres: 'Sí',
            apellidoPaterno: 'Uno',
            apellidoMaterno: 'X',
            libro: '1',
            folio: '1',
            registro: '1',
          },
        ],
      });
    });

    it('un matrimonio aparece una vez por cada cónyuge', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO matrimonios_legacy (client_id, parroquia_id, fecha_sacramento, numero_libro, numero_folio,
             numero_registro, esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
             esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno)
           VALUES ('m1', 1, '2024-01-01', '3', '4', '5', 'Juan', 'Zapata', 'Rios', 'Maria', 'Apaza', 'Luna')`,
        )
        .run();

      const response = await get('/api/sacrament-index/matrimonio?parroquiaId=1', parishToken);
      const { entries } = (await response.json()) as {
        entries: { apellidoPaterno: string; registro: string }[];
      };
      expect(entries.map((entry) => entry.apellidoPaterno)).toEqual(['Apaza', 'Zapata']);
      expect(entries.every((entry) => entry.registro === '5')).toBe(true);
    });

    it('funciona también para confirmaciones', async () => {
      await env.prelatura_db
        .prepare(
          `INSERT INTO confirmaciones_legacy (client_id, parroquia_id, fecha_sacramento, numero_libro, numero_folio,
             numero_registro, nombre, apellido_paterno, apellido_materno)
           VALUES ('c1', 1, '2024-01-01', '3', '4', '5', 'Ana', 'Rojas', 'Luna')`,
        )
        .run();

      const response = await get('/api/sacrament-index/confirmacion/libros?parroquiaId=1', parishToken);
      expect(await response.json()).toEqual({ libros: ['3'] });
    });
  });
});
