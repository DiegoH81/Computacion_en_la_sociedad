export interface PriestRow {
  id: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  parroquia_id: number;
  parroquia_nombre: string;
  activo: number;
}

export interface SearchFilters {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sortBy: 'nombre' | 'apellido_paterno' | 'apellido_materno';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const ALLOWED_SORT_FIELDS = ['nombre', 'apellido_paterno', 'apellido_materno'];

export async function searchPriests(
  db: D1Database,
  filters: SearchFilters,
): Promise<{ priests: PriestRow[]; totalPages: number }> {
  // Validación estricta del campo de orden: nunca interpolar directamente
  // un valor proveniente del cliente en el SQL sin verificarlo contra una lista blanca.
  const sortField = ALLOWED_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'nombre';
  const sortDirection = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.nombre) {
    conditions.push('s.nombre LIKE ?');
    params.push(`%${filters.nombre}%`);
  }
  if (filters.apellidoPaterno) {
    conditions.push('s.apellido_paterno LIKE ?');
    params.push(`%${filters.apellidoPaterno}%`);
  }
  if (filters.apellidoMaterno) {
    conditions.push('s.apellido_materno LIKE ?');
    params.push(`%${filters.apellidoMaterno}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM sacerdotes s ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const { results } = await db
    .prepare(
      `SELECT s.id, s.nombre, s.apellido_paterno, s.apellido_materno,
              s.parroquia_id, p.nombre as parroquia_nombre, s.activo
       FROM sacerdotes s
       JOIN parroquias p ON p.id = s.parroquia_id
       ${whereClause}
       ORDER BY s.${sortField} ${sortDirection}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<PriestRow>();

  return { priests: results, totalPages };
}

interface CreatePriestInput {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
}

export interface AuthContext {
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
}

export async function createPriest(
  db: D1Database,
  auth: AuthContext,
  input: CreatePriestInput,
  bodyParroquiaId: number | undefined,
): Promise<{ success: true; id: number } | { success: false; message: string; status: number }> {
  // Regla de negocio (§0, confirmado): nunca se confía en parroquia_id del body
  // para un usuario_parroquia; siempre se usa el del JWT. Solo un admin puede
  // (y debe) especificar la parroquia explícitamente, porque no tiene una propia.
  let targetParroquiaId: number;

  if (auth.rol === 'admin') {
    if (!bodyParroquiaId) {
      return { success: false, message: 'Debe especificar la parroquia.', status: 400 };
    }
    targetParroquiaId = bodyParroquiaId;
  } else {
    if (!auth.parroquiaId) {
      return { success: false, message: 'El usuario no tiene una parroquia asignada.', status: 400 };
    }
    targetParroquiaId = auth.parroquiaId;
  }

  if (!input.nombre || !input.apellidoPaterno || !input.apellidoMaterno) {
    return { success: false, message: 'Todos los campos son requeridos.', status: 400 };
  }

  const result = await db
    .prepare(
      `INSERT INTO sacerdotes (nombre, apellido_paterno, apellido_materno, parroquia_id, activo)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .bind(input.nombre, input.apellidoPaterno, input.apellidoMaterno, targetParroquiaId)
    .run();

  return { success: true, id: result.meta.last_row_id as number };
}

async function assertCanManagePriest(
  db: D1Database,
  auth: AuthContext,
  priestId: number,
): Promise<{ allowed: true } | { allowed: false; message: string; status: number }> {
  if (auth.rol === 'admin') {
    return { allowed: true };
  }

  const priest = await db
    .prepare('SELECT parroquia_id FROM sacerdotes WHERE id = ?')
    .bind(priestId)
    .first<{ parroquia_id: number }>();

  if (!priest) {
    return { allowed: false, message: 'Sacerdote no encontrado.', status: 404 };
  }

  if (priest.parroquia_id !== auth.parroquiaId) {
    return {
      allowed: false,
      message: 'No tiene permiso para modificar sacerdotes de otra parroquia.',
      status: 403,
    };
  }

  return { allowed: true };
}

export async function updatePriest(
  db: D1Database,
  auth: AuthContext,
  priestId: number,
  input: CreatePriestInput,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManagePriest(db, auth, priestId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  await db
    .prepare(
      `UPDATE sacerdotes SET nombre = ?, apellido_paterno = ?, apellido_materno = ? WHERE id = ?`,
    )
    .bind(input.nombre, input.apellidoPaterno, input.apellidoMaterno, priestId)
    .run();

  return { success: true };
}

export async function togglePriestActive(
  db: D1Database,
  auth: AuthContext,
  priestId: number,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManagePriest(db, auth, priestId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  await db
    .prepare('UPDATE sacerdotes SET activo = NOT activo WHERE id = ?')
    .bind(priestId)
    .run();

  return { success: true };
}
