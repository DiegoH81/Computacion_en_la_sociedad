export interface ConfirmationRow {
  id: number;
  parroquia_id: number;
  parroquia_nombre: string;
  numero_libro: string;
  numero_folio: string;
  numero_registro: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  estado: 'vigente' | 'anulado';
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

export async function searchConfirmations(
  db: D1Database,
  filters: SearchFilters,
): Promise<{ confirmations: ConfirmationRow[]; totalPages: number }> {
  const sortField = ALLOWED_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'nombre';
  const sortDirection = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.nombre) {
    conditions.push('c.nombre LIKE ?');
    params.push(`%${filters.nombre}%`);
  }
  if (filters.apellidoPaterno) {
    conditions.push('c.apellido_paterno LIKE ?');
    params.push(`%${filters.apellidoPaterno}%`);
  }
  if (filters.apellidoMaterno) {
    conditions.push('c.apellido_materno LIKE ?');
    params.push(`%${filters.apellidoMaterno}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM confirmaciones_legacy c ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const { results } = await db
    .prepare(
      `SELECT c.id, c.parroquia_id, p.nombre as parroquia_nombre,
              c.numero_libro, c.numero_folio, c.numero_registro,
              c.nombre, c.apellido_paterno, c.apellido_materno, c.estado
       FROM confirmaciones_legacy c
       JOIN parroquias p ON p.id = c.parroquia_id
       ${whereClause}
       ORDER BY c.${sortField} ${sortDirection}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<ConfirmationRow>();

  return { confirmations: results, totalPages };
}

export interface AuthContext {
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
}

export interface CreateConfirmationInput {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  padreNombre?: string;
  madreNombre?: string;
  fechaConfirmacion?: string;
  celebranteId?: number | null;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

export async function createConfirmation(
  db: D1Database,
  auth: AuthContext,
  input: CreateConfirmationInput,
  bodyParroquiaId: number | undefined,
): Promise<{ success: true; id: number } | { success: false; message: string; status: number }> {
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
    return { success: false, message: 'Nombre y apellidos son requeridos.', status: 400 };
  }

  // created_at/updated_at van explícitos y en ISO: el DEFAULT de la columna usa
  // otro formato. client_id identifica la partida sin depender del ID del servidor.
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `INSERT INTO confirmaciones_legacy (
        parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
        nombre, apellido_paterno, apellido_materno, fecha_nacimiento, lugar_nacimiento,
        padre_nombre, madre_nombre, fecha_confirmacion, celebrante_id, padrino, madrina, anotaciones,
        client_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      targetParroquiaId,
      input.fechaSacramento,
      input.numeroLibro,
      input.numeroFolio,
      input.numeroRegistro,
      input.nombre,
      input.apellidoPaterno,
      input.apellidoMaterno,
      input.fechaNacimiento ?? null,
      input.lugarNacimiento ?? null,
      input.padreNombre ?? null,
      input.madreNombre ?? null,
      input.fechaConfirmacion ?? null,
      input.celebranteId ?? null,
      input.padrino ?? null,
      input.madrina ?? null,
      input.anotaciones ?? null,
      crypto.randomUUID(),
      now,
      now,
    )
    .run();

  return { success: true, id: result.meta.last_row_id as number };
}

async function assertCanManageConfirmation(
  db: D1Database,
  auth: AuthContext,
  confirmationId: number,
): Promise<{ allowed: true } | { allowed: false; message: string; status: number }> {
  if (auth.rol === 'admin') {
    return { allowed: true };
  }

  const confirmation = await db
    .prepare('SELECT parroquia_id FROM confirmaciones_legacy WHERE id = ?')
    .bind(confirmationId)
    .first<{ parroquia_id: number }>();

  if (!confirmation) {
    return { allowed: false, message: 'Partida no encontrada.', status: 404 };
  }

  if (confirmation.parroquia_id !== auth.parroquiaId) {
    return {
      allowed: false,
      message: 'No tiene permiso para modificar partidas de otra parroquia.',
      status: 403,
    };
  }

  return { allowed: true };
}

export async function updateConfirmation(
  db: D1Database,
  auth: AuthContext,
  confirmationId: number,
  input: CreateConfirmationInput,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageConfirmation(db, auth, confirmationId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  await db
    .prepare(
      `UPDATE confirmaciones_legacy SET
        fecha_sacramento = ?, numero_libro = ?, numero_folio = ?, numero_registro = ?,
        nombre = ?, apellido_paterno = ?, apellido_materno = ?,
        fecha_nacimiento = ?, lugar_nacimiento = ?, padre_nombre = ?, madre_nombre = ?,
        fecha_confirmacion = ?, celebrante_id = ?, padrino = ?, madrina = ?, anotaciones = ?
       WHERE id = ?`,
    )
    .bind(
      input.fechaSacramento,
      input.numeroLibro,
      input.numeroFolio,
      input.numeroRegistro,
      input.nombre,
      input.apellidoPaterno,
      input.apellidoMaterno,
      input.fechaNacimiento ?? null,
      input.lugarNacimiento ?? null,
      input.padreNombre ?? null,
      input.madreNombre ?? null,
      input.fechaConfirmacion ?? null,
      input.celebranteId ?? null,
      input.padrino ?? null,
      input.madrina ?? null,
      input.anotaciones ?? null,
      confirmationId,
    )
    .run();

  return { success: true };
}

export async function annulConfirmation(
  db: D1Database,
  auth: AuthContext,
  confirmationId: number,
  motivo: string,
  anuladoPorUsuarioId: number,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageConfirmation(db, auth, confirmationId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  if (!motivo.trim()) {
    return { success: false, message: 'El motivo de anulación es requerido.', status: 400 };
  }

  await db
    .prepare(
      `UPDATE confirmaciones_legacy
       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
       WHERE id = ?`,
    )
    .bind(anuladoPorUsuarioId, new Date().toISOString(), motivo, confirmationId)
    .run();

  return { success: true };
}

export async function getConfirmationById(
  db: D1Database,
  confirmationId: number,
): Promise<Record<string, unknown> | null> {
  const confirmation = await db
    .prepare(
      `SELECT c.*, p.nombre as parroquia_nombre,
              s.nombre || ' ' || s.apellido_paterno || ' ' || s.apellido_materno as celebrante_nombre
       FROM confirmaciones_legacy c
       JOIN parroquias p ON p.id = c.parroquia_id
       LEFT JOIN sacerdotes s ON s.id = c.celebrante_id
       WHERE c.id = ?`,
    )
    .bind(confirmationId)
    .first();

  return confirmation ?? null;
}
