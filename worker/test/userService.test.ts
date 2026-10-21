import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetDatabase } from './helpers/resetDatabase';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { login } from '../src/services/authService';
import {
  searchUsers,
  createUser,
  updateUser,
  toggleUserActive,
  type CreateUserInput,
  type SearchUsersFilters,
  type UserAdminContext,
} from '../src/services/userService';

const ADMIN: UserAdminContext = { rol: 'admin', usuarioId: 1 };
const PARISH_USER: UserAdminContext = { rol: 'usuario_parroquia', usuarioId: 2 };

const ADMIN_PASSWORD = 'adminPassword123';
const PARISH_USER_PASSWORD = 'parrocoPassword123';

const SEARCH_ALL: SearchUsersFilters = {
  sortBy: 'nombre',
  sortDirection: 'asc',
  page: 1,
  pageSize: 20,
};

const VALID_CREATE: CreateUserInput = {
  nombre: 'Ana',
  apellidoPaterno: 'Quispe',
  apellidoMaterno: 'Mamani',
  username: 'ana.quispe',
  password: 'passwordNueva123',
  parroquia: { kind: 'existing', parroquiaId: 1 },
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
    adminHash = await hashPassword(ADMIN_PASSWORD);
    parishUserHash = await hashPassword(PARISH_USER_PASSWORD);
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
    const attempts: Array<[string, () => Promise<{ success: boolean; status?: number }>]> = [
      ['searchUsers', () => searchUsers(env.prelatura_db, PARISH_USER, SEARCH_ALL)],
      ['createUser', () => createUser(env.prelatura_db, PARISH_USER, VALID_CREATE)],
      [
        'updateUser',
        () =>
          updateUser(env.prelatura_db, PARISH_USER, 1, {
            nombre: 'Hackeado',
            apellidoPaterno: 'X',
          }),
      ],
      ['toggleUserActive', () => toggleUserActive(env.prelatura_db, PARISH_USER, 1)],
    ];

    it.each(attempts)('%s rechaza a un usuario_parroquia con 403', async (_name, run) => {
      const result = await run();

      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
    });

    it('un usuario_parroquia no logra crear ni modificar nada', async () => {
      const usersBefore = await count('usuarios');
      const adminBefore = await getUser(1);

      await createUser(env.prelatura_db, PARISH_USER, VALID_CREATE);
      await updateUser(env.prelatura_db, PARISH_USER, 1, {
        nombre: 'Hackeado',
        apellidoPaterno: 'X',
        password: 'passwordRobada123',
      });
      await toggleUserActive(env.prelatura_db, PARISH_USER, 1);

      expect(await count('usuarios')).toBe(usersBefore);
      expect(await getUser(1)).toEqual(adminBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe('searchUsers', () => {
    it('lista las cuentas con el nombre de su parroquia (null para admin)', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, SEARCH_ALL);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.users).toHaveLength(2);
      const admin = result.users.find((u) => u.username === 'admin');
      const parroco = result.users.find((u) => u.username === 'parroco1');
      expect(admin?.parroquia_nombre).toBeNull();
      expect(parroco?.parroquia_nombre).toBe('Parroquia 1');
    });

    it('nunca expone password_hash', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, SEARCH_ALL);

      expect(result.success).toBe(true);
      if (!result.success) return;
      for (const row of result.users) {
        expect(Object.keys(row)).not.toContain('password_hash');
      }
    });

    it('filtra por apellido paterno', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        apellidoPaterno: 'Parroquia',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.users.map((u) => u.username)).toEqual(['parroco1']);
    });

    it('ordena de forma descendente', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        sortDirection: 'desc',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      // 'Usuario' > 'Administrador'
      expect(result.users.map((u) => u.username)).toEqual(['parroco1', 'admin']);
    });

    it('pagina los resultados', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, { ...SEARCH_ALL, pageSize: 1 });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.users).toHaveLength(1);
      expect(result.totalPages).toBe(2);
    });

    it('usa "nombre" como fallback seguro si sortBy no está en la lista blanca', async () => {
      const result = await searchUsers(env.prelatura_db, ADMIN, {
        ...SEARCH_ALL,
        // @ts-expect-error -- simula un valor malicioso de sortBy
        sortBy: 'id; DROP TABLE usuarios; --',
      });

      expect(result.success).toBe(true);
      expect(await count('usuarios')).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('createUser', () => {
    it('crea una cuenta en una parroquia existente y la contraseña queda hasheada', async () => {
      const result = await createUser(env.prelatura_db, ADMIN, VALID_CREATE);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const created = await getUser(result.id);
      expect(created?.username).toBe('ana.quispe');
      expect(created?.rol).toBe('usuario_parroquia');
      expect(created?.parroquia_id).toBe(1);
      expect(created?.activo).toBe(1);
      expect(created?.password_hash).not.toBe('passwordNueva123');
      expect(await verifyPassword('passwordNueva123', created?.password_hash as string)).toBe(true);
    });

    it('la cuenta creada puede iniciar sesión de inmediato', async () => {
      await createUser(env.prelatura_db, ADMIN, VALID_CREATE);

      const result = await login(env.prelatura_db, env.JWT_SECRET, 'ana.quispe', 'passwordNueva123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.usuario.nombreCompleto).toBe('Ana Quispe Mamani');
        expect(result.usuario.rol).toBe('usuario_parroquia');
      }
    });

    it('crea la parroquia nueva junto con el usuario y los enlaza', async () => {
      const parishesBefore = await count('parroquias');

      const result = await createUser(env.prelatura_db, ADMIN, {
        ...VALID_CREATE,
        parroquia: { kind: 'new', nombre: 'Parroquia Nueva' },
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(await count('parroquias')).toBe(parishesBefore + 1);
      const linked = await env.prelatura_db
        .prepare(
          `SELECT p.nombre AS parroquia, p.activa FROM usuarios u
           JOIN parroquias p ON p.id = u.parroquia_id WHERE u.id = ?`,
        )
        .bind(result.id)
        .first<{ parroquia: string; activa: number }>();
      expect(linked).toEqual({ parroquia: 'Parroquia Nueva', activa: 1 });
    });

    it('acepta una cuenta sin apellido materno', async () => {
      const result = await createUser(env.prelatura_db, ADMIN, {
        ...VALID_CREATE,
        apellidoMaterno: undefined,
      });

      expect(result.success).toBe(true);
      const login1 = await login(env.prelatura_db, env.JWT_SECRET, 'ana.quispe', 'passwordNueva123');
      if (login1.success) expect(login1.usuario.nombreCompleto).toBe('Ana Quispe');
    });

    it('ignora cualquier rol enviado en el body: por esta vía no se crean admins', async () => {
      const result = await createUser(env.prelatura_db, ADMIN, {
        ...VALID_CREATE,
        rol: 'admin',
        parroquia_id: null,
      } as unknown as CreateUserInput);

      expect(result.success).toBe(true);
      if (!result.success) return;
      const created = await getUser(result.id);
      expect(created?.rol).toBe('usuario_parroquia');
      expect(created?.parroquia_id).toBe(1);
    });

    describe('datos inválidos (400) no crean nada', () => {
      const INVALID_CASES: Array<[string, Record<string, unknown>]> = [
        ['sin nombre', { nombre: '   ' }],
        ['sin apellido paterno', { apellidoPaterno: '' }],
        ['nombre que no es texto', { nombre: 123 }],
        ['username con espacios', { username: 'ana quispe' }],
        ['username demasiado corto', { username: 'ab' }],
        ['username con caracteres no permitidos', { username: 'ana@quispe' }],
        ['contraseña de 7 caracteres', { password: '1234567' }],
        ['contraseña que no es texto', { password: 12345678 }],
        ['sin parroquia', { parroquia: undefined }],
        ['parroquia con forma desconocida', { parroquia: { kind: 'otra' } }],
        ['parroquia nueva sin nombre', { parroquia: { kind: 'new', nombre: '  ' } }],
        ['parroquia existente que no existe', { parroquia: { kind: 'existing', parroquiaId: 999 } }],
      ];

      it.each(INVALID_CASES)('%s', async (_name, overrides) => {
        const usersBefore = await count('usuarios');
        const parishesBefore = await count('parroquias');

        const result = await createUser(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          ...overrides,
        } as CreateUserInput);

        expect(result.success).toBe(false);
        if (!result.success) expect(result.status).toBe(400);
        expect(await count('usuarios')).toBe(usersBefore);
        expect(await count('parroquias')).toBe(parishesBefore);
      });
    });

    describe('duplicados (409)', () => {
      it('rechaza un username que ya existe', async () => {
        const result = await createUser(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'parroco1',
        });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.status).toBe(409);
      });

      it('rechaza un username que solo difiere en mayúsculas', async () => {
        const usersBefore = await count('usuarios');

        const result = await createUser(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'ADMIN',
        });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.status).toBe(409);
        expect(await count('usuarios')).toBe(usersBefore);
      });

      it('rechaza una parroquia nueva cuyo nombre ya existe (sin distinguir mayúsculas) y no crea el usuario', async () => {
        const usersBefore = await count('usuarios');
        const parishesBefore = await count('parroquias');

        const result = await createUser(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          parroquia: { kind: 'new', nombre: 'PARROQUIA 1' },
        });

        expect(result.success).toBe(false);
        if (!result.success) expect(result.status).toBe(409);
        expect(await count('usuarios')).toBe(usersBefore);
        expect(await count('parroquias')).toBe(parishesBefore);
      });

      it('un username duplicado con parroquia nueva no deja una parroquia huérfana', async () => {
        const parishesBefore = await count('parroquias');

        const result = await createUser(env.prelatura_db, ADMIN, {
          ...VALID_CREATE,
          username: 'parroco1',
          parroquia: { kind: 'new', nombre: 'Parroquia Huérfana' },
        });

        expect(result.success).toBe(false);
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
  describe('updateUser', () => {
    it('actualiza nombre y apellidos sin tocar username, rol, parroquia ni contraseña', async () => {
      const before = await getUser(2);

      const result = await updateUser(env.prelatura_db, ADMIN, 2, {
        nombre: 'Nuevo',
        apellidoPaterno: 'Apellido',
        apellidoMaterno: 'Cambiado',
      });

      expect(result.success).toBe(true);
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
      const result = await updateUser(env.prelatura_db, ADMIN, 2, {
        nombre: 'Usuario',
        apellidoPaterno: 'Parroquia',
        apellidoMaterno: 'Uno',
        password: 'contraseñaNueva456',
      });

      expect(result.success).toBe(true);
      const newLogin = await login(env.prelatura_db, env.JWT_SECRET, 'parroco1', 'contraseñaNueva456');
      const oldLogin = await login(env.prelatura_db, env.JWT_SECRET, 'parroco1', PARISH_USER_PASSWORD);
      expect(newLogin.success).toBe(true);
      expect(oldLogin.success).toBe(false);
    });

    it('rechaza una contraseña nueva demasiado corta y no modifica nada', async () => {
      const before = await getUser(2);

      const result = await updateUser(env.prelatura_db, ADMIN, 2, {
        nombre: 'Otro',
        apellidoPaterno: 'Nombre',
        password: '1234567',
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(400);
      expect(await getUser(2)).toEqual(before);
    });

    it('rechaza nombre o apellido paterno vacíos', async () => {
      const result = await updateUser(env.prelatura_db, ADMIN, 2, {
        nombre: '  ',
        apellidoPaterno: 'X',
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(400);
    });

    it('devuelve 404 si el usuario no existe', async () => {
      const result = await updateUser(env.prelatura_db, ADMIN, 999, {
        nombre: 'X',
        apellidoPaterno: 'Y',
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(404);
    });

    it('ignora intentos de cambiar username o rol', async () => {
      await updateUser(env.prelatura_db, ADMIN, 2, {
        nombre: 'Usuario',
        apellidoPaterno: 'Parroquia',
        username: 'otro.username',
        rol: 'admin',
        parroquia_id: 2,
      } as unknown as Parameters<typeof updateUser>[3]);

      const after = await getUser(2);
      expect(after?.username).toBe('parroco1');
      expect(after?.rol).toBe('usuario_parroquia');
      expect(after?.parroquia_id).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('toggleUserActive', () => {
    it('deshabilita y vuelve a habilitar una cuenta', async () => {
      await toggleUserActive(env.prelatura_db, ADMIN, 2);
      expect((await getUser(2))?.activo).toBe(0);

      await toggleUserActive(env.prelatura_db, ADMIN, 2);
      expect((await getUser(2))?.activo).toBe(1);
    });

    it('una cuenta deshabilitada ya no puede iniciar sesión', async () => {
      await toggleUserActive(env.prelatura_db, ADMIN, 2);

      const result = await login(env.prelatura_db, env.JWT_SECRET, 'parroco1', PARISH_USER_PASSWORD);

      expect(result.success).toBe(false);
    });

    it('un admin no puede deshabilitar su propia cuenta', async () => {
      const result = await toggleUserActive(env.prelatura_db, ADMIN, ADMIN.usuarioId);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(400);
      expect((await getUser(1))?.activo).toBe(1);
    });

    it('devuelve 404 si el usuario no existe', async () => {
      const result = await toggleUserActive(env.prelatura_db, ADMIN, 999);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.status).toBe(404);
    });
  });
});
