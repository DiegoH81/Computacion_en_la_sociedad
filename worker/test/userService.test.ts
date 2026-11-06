import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { hash_password, verify_password, type TokenUser } from '../src/utils/crypto';
import { login } from '../src/controllers/login';
import {
  search_users,
  create_user,
  update_user,
  toggle_user_active,
  make_principal,
  is_principal,
} from '../src/controllers/users';
import type { SearchFilters, User } from '../../shared/models';

const ADMIN: TokenUser = { rol: 'admin', usuarioId: 1 };
const PARISH_USER: TokenUser = { rol: 'usuario_parroquia', usuarioId: 2 };

const ADMIN_PASSWORD = 'adminPassword123';
const PARISH_USER_PASSWORD = 'parrocoPassword123';

const SEARCH_ALL: SearchFilters = {
  orden: 'nombres',
  direccion: 'asc',
  pagina: 1,
};
const PAGE_SIZE = 20;

const VALID_CREATE: User = {
  nombre: 'Ana',
  apellido_paterno: 'Quispe',
  apellido_materno: 'Mamani',
  username: 'ana.quispe',
  password: 'passwordNueva123',
  rol: 'usuario_parroquia',
  parroquia_id: 1,
};

let adminHash: string;
let parishUserHash: string;

async function count(table: string): Promise<number> {
  const row = await env.prelatura_db
    .prepare(`SELECT COUNT(*) AS total FROM ${table}`)
    .first<{ total: number }>();
  return row?.total ?? 0;
}

async function getUser(id: number) {
  return env.prelatura_db
    .prepare('SELECT * FROM usuarios WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
}

describe('userService (integración con D1)', () => {
  beforeAll(async () => {
    adminHash = await hash_password(ADMIN_PASSWORD);
    parishUserHash = await hash_password(PARISH_USER_PASSWORD);
  });

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
         VALUES (1, 'admin', ?, 'Administrador', 'De', 'Prueba', 'admin', NULL, 1),
                (2, 'parroco1', ?, 'Usuario', 'Parroquia', 'Uno', 'usuario_parroquia', 1, 1)`,
      )
      .bind(adminHash, parishUserHash)
      .run();
  });

  // -------------------------------------------------------------------------
  describe('solo un admin puede gestionar usuarios', () => {
    const attempts: Array<[string, () => Promise<unknown>]> = [
      ['search_users', () => search_users(env.prelatura_db, PARISH_USER, SEARCH_ALL, PAGE_SIZE)],
      ['create_user', () => create_user(env.prelatura_db, PARISH_USER, VALID_CREATE)],
      [
        'update_user',
        () =>
          update_user(env.prelatura_db, PARISH_USER, 1, {
            nombre: 'Hackeado',
            apellido_paterno: 'X',
          }),
      ],
      ['toggle_user_active', () => toggle_user_active(env.prelatura_db, PARISH_USER, 1)],
    ];

    it.each(attempts)('%s rechaza a un usuario_parroquia con 403', async (_name, run) => {
      await expect(run()).rejects.toMatchObject({ status: 403 });
    });

    it('un usuario_parroquia no logra crear ni modificar nada', async () => {
      const usersBefore = await count('usuarios');
      const adminBefore = await getUser(1);

      await create_user(env.prelatura_db, PARISH_USER, VALID_CREATE).catch(() => undefined);
      await update_user(env.prelatura_db, PARISH_USER, 1, {
        nombre: 'Hackeado',
        apellido_paterno: 'X',
        password: 'passwordRobada123',
      }).catch(() => undefined);
      await toggle_user_active(env.prelatura_db, PARISH_USER, 1).catch(() => undefined);

      expect(await count('usuarios')).toBe(usersBefore);
      expect(await getUser(1)).toEqual(adminBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe('search_users', () => {
    it('lista las cuentas con el nombre de su parroquia (null para admin)', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, SEARCH_ALL, PAGE_SIZE);

      expect(result.resultados).toHaveLength(2);
      const admin = result.resultados.find((u) => u.username === 'admin');
      const parroco = result.resultados.find((u) => u.username === 'parroco1');
      expect(admin?.parroquia_nombre).toBeNull();
      expect(parroco?.parroquia_nombre).toBe('Parroquia 1');
    });

    it('nunca expone password_hash', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, SEARCH_ALL, PAGE_SIZE);

      for (const row of result.resultados) {
        expect(Object.keys(row)).not.toContain('password_hash');
      }
    });

    it('filtra por apellido paterno', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        apellido_paterno: 'Parroquia',
      }, PAGE_SIZE);

      expect(result.resultados.map((u) => u.username)).toEqual(['parroco1']);
    });

    it('filtra por parroquia: deja fuera a las demás y a los administradores', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, { ...SEARCH_ALL, parroquia_id: 1 }, PAGE_SIZE);
      expect(result.resultados.map((u) => u.username)).toEqual(['parroco1']);

      const empty = await search_users(env.prelatura_db, ADMIN, { ...SEARCH_ALL, parroquia_id: 2 }, PAGE_SIZE);
      expect(empty.resultados).toEqual([]);
    });

    it('ordena de forma descendente', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        direccion: 'desc',
      }, PAGE_SIZE);

      // 'Usuario' > 'Administrador'
      expect(result.resultados.map((u) => u.username)).toEqual(['parroco1', 'admin']);
    });

    it('pagina los resultados', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, SEARCH_ALL, 1);

      expect(result.resultados).toHaveLength(1);
      expect(result.total_paginas).toBe(2);
    });

    it('usa "nombre" como fallback seguro si orden no está en la lista blanca', async () => {
      const result = await search_users(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        // @ts-expect-error -- simula un valor malicioso de orden
        orden: 'id; DROP TABLE usuarios; --',
      }, PAGE_SIZE);

      expect(result.resultados).toHaveLength(2);
      expect(await count('usuarios')).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('create_user', () => {
    it('crea una cuenta en una parroquia existente y la contraseña queda hasheada', async () => {
      const id = await create_user(env.prelatura_db, ADMIN, VALID_CREATE);

      const created = await getUser(id);
      expect(created?.username).toBe('ana.quispe');
      expect(created?.rol).toBe('usuario_parroquia');
      expect(created?.parroquia_id).toBe(1);
      expect(created?.activo).toBe(1);
      expect(created?.password_hash).not.toBe('passwordNueva123');
      expect(await verify_password('passwordNueva123', created?.password_hash as string)).toBe(true);
    });

    it('la cuenta creada puede iniciar sesión de inmediato', async () => {
      await create_user(env.prelatura_db, ADMIN, VALID_CREATE);

      const result = await login(env.prelatura_db, env.JWT_SECRET, 'ana.quispe', 'passwordNueva123');

      expect(result.usuario.nombre_completo).toBe('Ana Quispe Mamani');
      expect(result.usuario.rol).toBe('usuario_parroquia');
    });

    it('crea la parroquia nueva junto con el usuario y los enlaza', async () => {
      const parishesBefore = await count('parroquias');

      const id = await create_user(env.prelatura_db, ADMIN, {
        ...VALID_CREATE,
        parroquia_nueva: 'Parroquia Nueva',
      });

      expect(await count('parroquias')).toBe(parishesBefore + 1);
      const linked = await env.prelatura_db
        .prepare(
          `SELECT p.nombre AS parroquia, p.activa FROM usuarios u
           JOIN parroquias p ON p.id = u.parroquia_id WHERE u.id = ?`,
        )
        .bind(id)
        .first<{ parroquia: string; activa: number }>();
      expect(linked).toEqual({ parroquia: 'Parroquia Nueva', activa: 1 });
    });

    it('acepta una cuenta sin apellido materno', async () => {
      await create_user(env.prelatura_db, ADMIN, {
        ...VALID_CREATE,
        apellido_materno: undefined,
      });

      const login1 = await login(env.prelatura_db, env.JWT_SECRET, 'ana.quispe', 'passwordNueva123');
      expect(login1.usuario.nombre_completo).toBe('Ana Quispe');
    });

    it('un admin que no es el principal no puede crear administradores', async () => {
      const usersBefore = await count('usuarios');

      await expect(create_user(env.prelatura_db, ADMIN, { ...VALID_CREATE, rol: 'admin' }))
        .rejects.toMatchObject({ status: 403, message: 'Solo el administrador principal puede crear administradores.' });
      expect(await count('usuarios')).toBe(usersBefore);
    });

    describe('datos inválidos (400) no crean nada', () => {
      const INVALID_CASES: Array<[string, Record<string, unknown>]> = [
        ['sin nombre', { nombre: '   ' }],
        ['sin apellido paterno', { apellido_paterno: '' }],
        ['nombre que no es texto', { nombre: 123 }],
        ['username con espacios', { username: 'ana quispe' }],
        ['username demasiado corto', { username: 'ab' }],
        ['username con caracteres no permitidos', { username: 'ana@quispe' }],
        ['contraseña de 7 caracteres', { password: '1234567' }],
        ['contraseña que no es texto', { password: 12345678 }],
        ['sin parroquia', { parroquia_id: undefined }],
        ['parroquia que no es un id', { parroquia_id: 'otra' }],
        ['parroquia nueva sin nombre', { parroquia_nueva: '  ' }],
        ['parroquia existente que no existe', { parroquia_id: 999 }],
      ];

      it.each(INVALID_CASES)('%s', async (_name, overrides) => {
        const usersBefore = await count('usuarios');
        const parishesBefore = await count('parroquias');

        await expect(create_user(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          ...overrides,
        } as User)).rejects.toMatchObject({ status: 400 });

        expect(await count('usuarios')).toBe(usersBefore);
        expect(await count('parroquias')).toBe(parishesBefore);
      });
    });

    describe('duplicados (409)', () => {
      it('rechaza un username que ya existe', async () => {
        await expect(create_user(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'parroco1',
        })).rejects.toMatchObject({ status: 409 });
      });

      it('rechaza un username que solo difiere en mayúsculas', async () => {
        const usersBefore = await count('usuarios');

        await expect(create_user(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'ADMIN',
        })).rejects.toMatchObject({ status: 409 });
        expect(await count('usuarios')).toBe(usersBefore);
      });

      it('rechaza una parroquia nueva cuyo nombre ya existe (sin distinguir mayúsculas) y no crea el usuario', async () => {
        const usersBefore = await count('usuarios');
        const parishesBefore = await count('parroquias');

        await expect(create_user(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          parroquia_nueva: 'PARROQUIA 1',
        })).rejects.toMatchObject({ status: 409 });
        expect(await count('usuarios')).toBe(usersBefore);
        expect(await count('parroquias')).toBe(parishesBefore);
      });

      it('un username duplicado con parroquia nueva no deja una parroquia huérfana', async () => {
        const parishesBefore = await count('parroquias');

        await expect(create_user(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'parroco1',
          parroquia_nueva: 'Parroquia Huérfana',
        })).rejects.toThrow();
        expect(await count('parroquias')).toBe(parishesBefore);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Supuesto de diseño: db.batch() de D1 es una transacción. Si el segundo
  // INSERT falla, el primero se deshace. El Service hace comprobaciones previas,
  // así que este test ejercita el supuesto directamente sobre D1.
  describe('db.batch() de D1 es atómico (supuesto de la creación con parroquia nueva)', () => {
    it('deshace la parroquia si falla el INSERT del usuario', async () => {
      const parishesBefore = await count('parroquias');

      await expect(
        env.prelatura_db.batch([
          env.prelatura_db.prepare(
            "INSERT INTO parroquias (nombre, activa) VALUES ('Parroquia Fantasma', 1)",
          ),
          env.prelatura_db.prepare(
            `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                                   rol, parroquia_id, activo)
             VALUES ('parroco1', 'h', 'x', 'y', 'z', 'usuario_parroquia', last_insert_rowid(), 1)`,
          ),
        ]),
      ).rejects.toThrow();

      expect(await count('parroquias')).toBe(parishesBefore);
      const ghost = await env.prelatura_db
        .prepare("SELECT 1 AS found FROM parroquias WHERE nombre = 'Parroquia Fantasma'")
        .first();
      expect(ghost).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('update_user', () => {
    it('actualiza nombre y apellidos sin tocar username, rol, parroquia ni contraseña', async () => {
      const before = await getUser(2);

      await update_user(env.prelatura_db, ADMIN, 2, {
        nombre: 'Nuevo',
        apellido_paterno: 'Apellido',
        apellido_materno: 'Cambiado',
      });

      const after = await getUser(2);
      expect(after).toMatchObject({
        nombre: 'Nuevo',
        apellido_paterno: 'Apellido',
        apellido_materno: 'Cambiado',
      });
      expect(after?.username).toBe(before?.username);
      expect(after?.rol).toBe(before?.rol);
      expect(after?.parroquia_id).toBe(before?.parroquia_id);
      expect(after?.password_hash).toBe(before?.password_hash);
    });

    it('con contraseña nueva: la nueva funciona y la anterior deja de funcionar', async () => {
      await update_user(env.prelatura_db, ADMIN, 2, {
        nombre: 'Usuario',
        apellido_paterno: 'Parroquia',
        apellido_materno: 'Uno',
        password: 'contraseñaNueva456',
      });

      const newLogin = await login(env.prelatura_db, env.JWT_SECRET, 'parroco1', 'contraseñaNueva456');
      expect(newLogin.token).toBeTruthy();
      await expect(login(env.prelatura_db, env.JWT_SECRET, 'parroco1', PARISH_USER_PASSWORD)).rejects.toMatchObject({ status: 401 });
    });

    it('rechaza una contraseña nueva demasiado corta y no modifica nada', async () => {
      const before = await getUser(2);

      await expect(update_user(env.prelatura_db, ADMIN, 2, {
        nombre: 'Otro',
        apellido_paterno: 'Nombre',
        password: '1234567',
      })).rejects.toMatchObject({ status: 400 });
      expect(await getUser(2)).toEqual(before);
    });

    it('rechaza nombre o apellido paterno vacíos', async () => {
      await expect(update_user(env.prelatura_db, ADMIN, 2, {
        nombre: '  ',
        apellido_paterno: 'X',
      })).rejects.toMatchObject({ status: 400 });
    });

    it('devuelve 404 si el usuario no existe', async () => {
      await expect(update_user(env.prelatura_db, ADMIN, 999, {
        nombre: 'X',
        apellido_paterno: 'Y',
      })).rejects.toMatchObject({ status: 404 });
    });

    it('ignora intentos de cambiar username o rol', async () => {
      await update_user(env.prelatura_db, ADMIN, 2, {
        nombre: 'Usuario',
        apellido_paterno: 'Parroquia',
        username: 'otro.username',
        rol: 'admin',
        parroquia_id: 2,
      } as unknown as Parameters<typeof update_user>[3]);

      const after = await getUser(2);
      expect(after?.username).toBe('parroco1');
      expect(after?.rol).toBe('usuario_parroquia');
      expect(after?.parroquia_id).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('administrador principal', () => {
    const OTHER_ADMIN: TokenUser = { rol: 'admin', usuarioId: 3 };

    beforeEach(async () => {
      await env.prelatura_db.batch([
        env.prelatura_db.prepare('UPDATE usuarios SET principal = 1 WHERE id = 1'),
        env.prelatura_db
          .prepare(
            `INSERT INTO usuarios (id, username, password_hash, nombre, apellido_paterno, apellido_materno, rol, parroquia_id, activo)
             VALUES (3, 'admin2', ?, 'Otro', 'Admin', 'Dos', 'admin', NULL, 1)`,
          )
          .bind(adminHash),
      ]);
    });

    it('crea administradores sin parroquia, aunque se mande una, y sin la marca de principal', async () => {
      const id = await create_user(env.prelatura_db, ADMIN, { ...VALID_CREATE, rol: 'admin', principal: 1 });

      expect(await getUser(id)).toMatchObject({ rol: 'admin', parroquia_id: null, principal: 0 });
    });

    it('solo el principal modifica o deshabilita a otros administradores', async () => {
      const edit = { nombre: 'Cambiado', apellido_paterno: 'X' } as User;

      await expect(update_user(env.prelatura_db, OTHER_ADMIN, 1, edit)).rejects.toMatchObject({ status: 403 });
      await expect(toggle_user_active(env.prelatura_db, OTHER_ADMIN, 1)).rejects.toMatchObject({ status: 403 });
      expect(await getUser(1)).toMatchObject({ nombre: 'Administrador', activo: 1 });

      await update_user(env.prelatura_db, ADMIN, 3, edit);
      await toggle_user_active(env.prelatura_db, ADMIN, 3);
      expect(await getUser(3)).toMatchObject({ nombre: 'Cambiado', activo: 0 });
    });

    it('un admin cualquiera gestiona cuentas de parroquia y edita la suya', async () => {
      await toggle_user_active(env.prelatura_db, OTHER_ADMIN, 2);
      await update_user(env.prelatura_db, OTHER_ADMIN, 3, { nombre: 'Yo', apellido_paterno: 'Mismo' } as User);

      expect((await getUser(2))?.activo).toBe(0);
      expect((await getUser(3))?.nombre).toBe('Yo');
    });

    it('pasa la marca a otro admin activo, y desde entonces solo él la tiene', async () => {
      await make_principal(env.prelatura_db, ADMIN, 3);

      expect(await is_principal(env.prelatura_db, ADMIN)).toBe(false);
      expect(await is_principal(env.prelatura_db, OTHER_ADMIN)).toBe(true);
      await expect(make_principal(env.prelatura_db, ADMIN, 1)).rejects.toMatchObject({ status: 403 });
    });

    it('no pasa la marca a una cuenta de parroquia, a un admin deshabilitado ni a sí mismo', async () => {
      await expect(make_principal(env.prelatura_db, ADMIN, 2)).rejects.toMatchObject({ status: 400 });
      await expect(make_principal(env.prelatura_db, ADMIN, 1)).rejects.toMatchObject({ status: 400 });
      await toggle_user_active(env.prelatura_db, ADMIN, 3);
      await expect(make_principal(env.prelatura_db, ADMIN, 3)).rejects.toMatchObject({ status: 400 });
      await expect(make_principal(env.prelatura_db, ADMIN, 999)).rejects.toMatchObject({ status: 404 });
      expect(await is_principal(env.prelatura_db, ADMIN)).toBe(true);
    });

    it('la base no deja que haya dos principales', async () => {
      await expect(env.prelatura_db.prepare('UPDATE usuarios SET principal = 1 WHERE id = 3').run()).rejects.toThrow(/UNIQUE/);
    });
  });

  // -------------------------------------------------------------------------
  describe('toggle_user_active', () => {
    it('deshabilita y vuelve a habilitar una cuenta', async () => {
      await toggle_user_active(env.prelatura_db, ADMIN, 2);
      expect((await getUser(2))?.activo).toBe(0);

      await toggle_user_active(env.prelatura_db, ADMIN, 2);
      expect((await getUser(2))?.activo).toBe(1);
    });

    it('una cuenta deshabilitada ya no puede iniciar sesión', async () => {
      await toggle_user_active(env.prelatura_db, ADMIN, 2);

      await expect(login(env.prelatura_db, env.JWT_SECRET, 'parroco1', PARISH_USER_PASSWORD)).rejects.toThrow();
    });

    it('un admin no puede deshabilitar su propia cuenta', async () => {
      await expect(toggle_user_active(env.prelatura_db, ADMIN, ADMIN.usuarioId)).rejects.toMatchObject({ status: 400 });
      expect((await getUser(1))?.activo).toBe(1);
    });

    it('devuelve 404 si el usuario no existe', async () => {
      await expect(toggle_user_active(env.prelatura_db, ADMIN, 999)).rejects.toMatchObject({ status: 404 });
    });
  });
});
