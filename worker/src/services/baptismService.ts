export interface BaptismRow {
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

export async function searchBaptisms(
  db: D1Database,
  filters: SearchFilters,
): Promise<{ baptisms: BaptismRow[]; totalPages: number }> {
  // Mismo guard de lista blanca que en priestService y marriageService:
  // nunca interpolar un campo de orden proveniente del cliente sin validarlo.
  const sortField = ALLOWED_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'nombre';
  const sortDirection = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.nombre) {
    conditions.push('b.nombre LIKE ?');
    params.push(`%${filters.nombre}%`);
  }
  if (filters.apellidoPaterno) {
    conditions.push('b.apellido_paterno LIKE ?');
    params.push(`%${filters.apellidoPaterno}%`);
  }
  if (filters.apellidoMaterno) {
    conditions.push('b.apellido_materno LIKE ?');
    params.push(`%${filters.apellidoMaterno}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM bautismos b ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const { results } = await db
    .prepare(
      `SELECT b.id, b.parroquia_id, p.nombre as parroquia_nombre,
              b.numero_libro, b.numero_folio, b.numero_registro,
              b.nombre, b.apellido_paterno, b.apellido_materno, b.estado
       FROM bautismos b
       JOIN parroquias p ON p.id = b.parroquia_id
       ${whereClause}
       ORDER BY b.${sortField} ${sortDirection}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<BaptismRow>();

  return { baptisms: results, totalPages };
}

export interface AuthContext {
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
}

export interface CreateBaptismInput {
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
  fechaBautizo?: string;
  celebranteId?: number | null;
  padrino?: string;
  madrina?: string;
  anotaciones?: string;
}

export async function createBaptism(
  db: D1Database,
  auth: AuthContext,
  input: CreateBaptismInput,
  bodyParroquiaId: number | undefined,
): Promise<{ success: true; id: number } | { success: false; message: string; status: number }> {
  // Regla ya validada (Opción B): nunca confiar en parroquia_id del body
  // para usuario_parroquia; solo admin puede (y debe) especificarlo.
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

  const result = await db
    .prepare(
      `INSERT INTO bautismos (
        parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
        nombre, apellido_paterno, apellido_materno, fecha_nacimiento, lugar_nacimiento,
        padre_nombre, madre_nombre, fecha_bautizo, celebrante_id, padrino, madrina, anotaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.fechaBautizo ?? null,
      input.celebranteId ?? null,
      input.padrino ?? null,
      input.madrina ?? null,
      input.anotaciones ?? null,
    )
    .run();

  return { success: true, id: result.meta.last_row_id as number };
}

async function assertCanManageBaptism(
  db: D1Database,
  auth: AuthContext,
  baptismId: number,
): Promise<{ allowed: true } | { allowed: false; message: string; status: number }> {
  if (auth.rol === 'admin') {
    return { allowed: true };
  }

  const baptism = await db
    .prepare('SELECT parroquia_id FROM bautismos WHERE id = ?')
    .bind(baptismId)
    .first<{ parroquia_id: number }>();

  if (!baptism) {
    return { allowed: false, message: 'Partida no encontrada.', status: 404 };
  }

  if (baptism.parroquia_id !== auth.parroquiaId) {
    return {
      allowed: false,
      message: 'No tiene permiso para modificar partidas de otra parroquia.',
      status: 403,
    };
  }

  return { allowed: true };
}

export async function updateBaptism(
  db: D1Database,
  auth: AuthContext,
  baptismId: number,
  input: CreateBaptismInput,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageBaptism(db, auth, baptismId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  await db
    .prepare(
      `UPDATE bautismos SET
        fecha_sacramento = ?, numero_libro = ?, numero_folio = ?, numero_registro = ?,
        nombre = ?, apellido_paterno = ?, apellido_materno = ?,
        fecha_nacimiento = ?, lugar_nacimiento = ?, padre_nombre = ?, madre_nombre = ?,
        fecha_bautizo = ?, celebrante_id = ?, padrino = ?, madrina = ?, anotaciones = ?,
        updated_at = ?
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
      input.fechaBautizo ?? null,
      input.celebranteId ?? null,
      input.padrino ?? null,
      input.madrina ?? null,
      input.anotaciones ?? null,
      new Date().toISOString(),
      baptismId,
    )
    .run();

  return { success: true };
}

export async function annulBaptism(
  db: D1Database,
  auth: AuthContext,
  baptismId: number,
  motivo: string,
  anuladoPorUsuarioId: number,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageBaptism(db, auth, baptismId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  if (!motivo.trim()) {
    return { success: false, message: 'El motivo de anulación es requerido.', status: 400 };
  }

  await db
    .prepare(
      `UPDATE bautismos
       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
       WHERE id = ?`,
    )
    .bind(anuladoPorUsuarioId, new Date().toISOString(), motivo, baptismId)
    .run();

  return { success: true };
}

export async function getBaptismById(
  db: D1Database,
  baptismId: number,
): Promise<Record<string, unknown> | null> {
  // Incluye el nombre del celebrante (JOIN con sacerdotes), resolviendo desde
  // el inicio el pendiente que en Matrimonio quedó marcado para la impresión.
  const baptism = await db
    .prepare(
      `SELECT b.*, p.nombre as parroquia_nombre,
              s.nombre || ' ' || s.apellido_paterno || ' ' || s.apellido_materno as celebrante_nombre
       FROM bautismos b
       JOIN parroquias p ON p.id = b.parroquia_id
       LEFT JOIN sacerdotes s ON s.id = b.celebrante_id
       WHERE b.id = ?`,
    )
    .bind(baptismId)
    .first();

  return baptism ?? null;
}
