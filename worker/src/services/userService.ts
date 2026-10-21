import { hashPassword } from '../lib/password';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface UserAdminContext {
  rol: 'admin' | 'usuario_parroquia';
  usuarioId: number;
}

export interface Failure {
  success: false;
  message: string;
  status: number;
}

export interface UserListRow {
  id: number;
  username: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  parroquia_nombre: string | null; // null en cuentas admin
  activo: number;
}

export interface SearchUsersFilters {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export type ParishChoice =
  | { kind: 'existing'; parroquiaId: number }
  | { kind: 'new'; nombre: string };

export interface CreateUserInput {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  username: string;
  password: string;
  parroquia: ParishChoice;
}

export interface UpdateUserInput {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  password?: string; // vacío o ausente = conservar la contraseña actual
}

// ---------------------------------------------------------------------------
// Reglas y utilidades
// ---------------------------------------------------------------------------

const PASSWORD_MIN_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const ALLOWED_SORT_FIELDS = ['nombre', 'apellido_paterno', 'apellido_materno'];

function fail(status: number, message: string): Failure {
  return { success: false, message, status };
}

/** Los datos llegan de JSON sin validar: cualquier campo puede no ser string. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Solo un admin gestiona usuarios. Se comprueba en cada operación del Service. */
function requireAdmin(ctx: UserAdminContext): Failure | null {
  if (ctx.rol !== 'admin') {
    return fail(403, 'Solo un administrador puede gestionar usuarios.');
  }
  return null;
}

function isUniqueViolation(error: unknown, target: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes('UNIQUE constraint failed') &&
    error.message.includes(target)
  );
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

export async function searchUsers(
  db: D1Database,
  ctx: UserAdminContext,
  filters: SearchUsersFilters,
): Promise<{ success: true; users: UserListRow[]; totalPages: number } | Failure> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  // Lista blanca: los nombres de columna no pueden ir como parámetros (?),
  // así que nunca se interpola un valor del cliente sin validarlo.
  const sortField = ALLOWED_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'nombre';
  const sortDirection = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.nombre) {
    conditions.push('u.nombre LIKE ?');
    params.push(`%${filters.nombre}%`);
  }
  if (filters.apellidoPaterno) {
    conditions.push('u.apellido_paterno LIKE ?');
    params.push(`%${filters.apellidoPaterno}%`);
  }
  if (filters.apellidoMaterno) {
    conditions.push('u.apellido_materno LIKE ?');
    params.push(`%${filters.apellidoMaterno}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM usuarios u ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  // password_hash nunca se selecciona. LEFT JOIN porque las cuentas admin no
  // tienen parroquia.
  const { results } = await db
    .prepare(
      `SELECT u.id, u.username, u.nombre, u.apellido_paterno, u.apellido_materno,
              p.nombre AS parroquia_nombre, u.activo
       FROM usuarios u
       LEFT JOIN parroquias p ON p.id = u.parroquia_id
       ${whereClause}
       ORDER BY u.${sortField} ${sortDirection}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<UserListRow>();

  return { success: true, users: results, totalPages };
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export async function createUser(
  db: D1Database,
  ctx: UserAdminContext,
  input: CreateUserInput,
): Promise<{ success: true; id: number } | Failure> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const nombre = text(input.nombre);
  const apellidoPaterno = text(input.apellidoPaterno);
  const apellidoMaterno = text(input.apellidoMaterno);
  const username = text(input.username);
  const password = typeof input.password === 'string' ? input.password : '';

  if (!nombre || !apellidoPaterno) {
    return fail(400, 'Nombre y apellido paterno son requeridos.');
  }
  if (!USERNAME_PATTERN.test(username)) {
    return fail(
      400,
      'El nombre de usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.',
    );
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return fail(400, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  // Parroquia: existente o nueva. Cualquier otra forma es inválida.
  const choice = input.parroquia as Partial<ParishChoice> | undefined;
  let existingParishId: number | null = null;
  let newParishName = '';

  if (choice?.kind === 'new') {
    newParishName = text(choice.nombre);
    if (!newParishName) {
      return fail(400, 'El nombre de la parroquia nueva es requerido.');
    }
  } else if (choice?.kind === 'existing' && typeof choice.parroquiaId === 'number') {
    existingParishId = choice.parroquiaId;
  } else {
    return fail(400, 'Debe seleccionar una parroquia.');
  }

  // Comprobaciones previas: dan un mensaje claro. Los índices UNIQUE de la base
  // siguen siendo la barrera final (ver el catch más abajo).
  const usernameTaken = await db
    .prepare('SELECT 1 AS taken FROM usuarios WHERE username = ? COLLATE NOCASE')
    .bind(username)
    .first();
  if (usernameTaken) {
    return fail(409, 'Ese nombre de usuario ya existe.');
  }

  if (existingParishId !== null) {
    const parish = await db
      .prepare('SELECT 1 AS found FROM parroquias WHERE id = ? AND activa = 1')
      .bind(existingParishId)
      .first();
    if (!parish) {
      return fail(400, 'La parroquia seleccionada no existe.');
    }
  } else {
    const parishTaken = await db
      .prepare('SELECT 1 AS taken FROM parroquias WHERE nombre = ? COLLATE NOCASE')
      .bind(newParishName)
      .first();
    if (parishTaken) {
      return fail(409, 'Ya existe una parroquia con ese nombre.');
    }
  }

  const passwordHash = await hashPassword(password);

  try {
    if (existingParishId !== null) {
      // El rol siempre es usuario_parroquia: por esta vía no se crean admins,
      // sin importar lo que traiga el body.
      const result = await db
        .prepare(
          `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                                 rol, parroquia_id, activo)
           VALUES (?, ?, ?, ?, ?, 'usuario_parroquia', ?, 1)`,
        )
        .bind(username, passwordHash, nombre, apellidoPaterno, apellidoMaterno, existingParishId)
        .run();

      return { success: true, id: result.meta.last_row_id as number };
    }

    // Parroquia nueva + usuario: db.batch() es una transacción en D1 (si una
    // sentencia falla, se deshace todo), así que nunca queda una parroquia
    // huérfana. last_insert_rowid() enlaza el usuario con la parroquia recién creada.
    const results = await db.batch([
      db.prepare('INSERT INTO parroquias (nombre, activa) VALUES (?, 1)').bind(newParishName),
      db
        .prepare(
          `INSERT INTO usuarios (username, password_hash, nombre, apellido_paterno, apellido_materno,
                                 rol, parroquia_id, activo)
           VALUES (?, ?, ?, ?, ?, 'usuario_parroquia', last_insert_rowid(), 1)`,
        )
        .bind(username, passwordHash, nombre, apellidoPaterno, apellidoMaterno),
    ]);

    return { success: true, id: results[1].meta.last_row_id as number };
  } catch (error) {
    // Respaldo ante una carrera entre la comprobación previa y el INSERT.
    if (isUniqueViolation(error, 'usuarios.username')) {
      return fail(409, 'Ese nombre de usuario ya existe.');
    }
    if (isUniqueViolation(error, 'parroquias.nombre')) {
      return fail(409, 'Ya existe una parroquia con ese nombre.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Edición
// ---------------------------------------------------------------------------

export async function updateUser(
  db: D1Database,
  ctx: UserAdminContext,
  userId: number,
  input: UpdateUserInput,
): Promise<{ success: true } | Failure> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  const nombre = text(input.nombre);
  const apellidoPaterno = text(input.apellidoPaterno);
  const apellidoMaterno = text(input.apellidoMaterno);
  const password = typeof input.password === 'string' ? input.password : '';

  if (!nombre || !apellidoPaterno) {
    return fail(400, 'Nombre y apellido paterno son requeridos.');
  }
  if (password && password.length < PASSWORD_MIN_LENGTH) {
    return fail(400, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  const existing = await db
    .prepare('SELECT id FROM usuarios WHERE id = ?')
    .bind(userId)
    .first();
  if (!existing) {
    return fail(404, 'Usuario no encontrado.');
  }

  // Solo se editan nombre, apellidos y (opcionalmente) contraseña. Username,
  // rol y parroquia quedan fijos: no hay forma de cambiarlos por esta vía.
  if (password) {
    const passwordHash = await hashPassword(password);
    await db
      .prepare(
        `UPDATE usuarios
         SET nombre = ?, apellido_paterno = ?, apellido_materno = ?, password_hash = ?
         WHERE id = ?`,
      )
      .bind(nombre, apellidoPaterno, apellidoMaterno, passwordHash, userId)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE usuarios
         SET nombre = ?, apellido_paterno = ?, apellido_materno = ?
         WHERE id = ?`,
      )
      .bind(nombre, apellidoPaterno, apellidoMaterno, userId)
      .run();
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Deshabilitar / habilitar
// ---------------------------------------------------------------------------

export async function toggleUserActive(
  db: D1Database,
  ctx: UserAdminContext,
  userId: number,
): Promise<{ success: true } | Failure> {
  const denied = requireAdmin(ctx);
  if (denied) return denied;

  // Un admin no puede deshabilitarse a sí mismo: así siempre queda al menos
  // un admin activo y nadie puede dejar el sistema sin acceso de administración.
  if (userId === ctx.usuarioId) {
    return fail(400, 'No puede deshabilitar su propia cuenta.');
  }

  const existing = await db
    .prepare('SELECT id FROM usuarios WHERE id = ?')
    .bind(userId)
    .first();
  if (!existing) {
    return fail(404, 'Usuario no encontrado.');
  }

  await db.prepare('UPDATE usuarios SET activo = NOT activo WHERE id = ?').bind(userId).run();

  return { success: true };
}
