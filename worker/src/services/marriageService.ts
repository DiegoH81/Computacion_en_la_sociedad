export interface MarriageRow {
  id: number;
  parroquia_id: number;
  parroquia_nombre: string;
  fecha_sacramento: string;
  numero_libro: string;
  numero_folio: string;
  numero_registro: string;
  esposo_nombre: string;
  esposo_apellido_paterno: string;
  esposo_apellido_materno: string;
  esposa_nombre: string;
  esposa_apellido_paterno: string;
  esposa_apellido_materno: string;
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

export async function searchMarriages(
  db: D1Database,
  filters: SearchFilters,
): Promise<{ marriages: MarriageRow[]; totalPages: number }> {
  // Mismo guard de lista blanca que en priestService: nunca interpolar
  // un campo de orden proveniente del cliente sin validarlo primero.
  const sortField = ALLOWED_SORT_FIELDS.includes(filters.sortBy) ? filters.sortBy : 'nombre';
  const sortDirection = filters.sortDirection === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];
  const params: string[] = [];

  // Búsqueda OR entre esposo y esposa (confirmado en Fase 1).
  if (filters.nombre) {
    conditions.push('(m.esposo_nombre LIKE ? OR m.esposa_nombre LIKE ?)');
    params.push(`%${filters.nombre}%`, `%${filters.nombre}%`);
  }
  if (filters.apellidoPaterno) {
    conditions.push('(m.esposo_apellido_paterno LIKE ? OR m.esposa_apellido_paterno LIKE ?)');
    params.push(`%${filters.apellidoPaterno}%`, `%${filters.apellidoPaterno}%`);
  }
  if (filters.apellidoMaterno) {
    conditions.push('(m.esposo_apellido_materno LIKE ? OR m.esposa_apellido_materno LIKE ?)');
    params.push(`%${filters.apellidoMaterno}%`, `%${filters.apellidoMaterno}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM matrimonios m ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  // Nota: el ordenamiento por "nombre" ordena por el nombre del esposo;
  // no hay un criterio único de "nombre" cuando hay dos personas por fila.
  const { results } = await db
    .prepare(
      `SELECT m.id, m.parroquia_id, p.nombre as parroquia_nombre,
              m.fecha_sacramento, m.numero_libro, m.numero_folio, m.numero_registro,
              m.esposo_nombre, m.esposo_apellido_paterno, m.esposo_apellido_materno,
              m.esposa_nombre, m.esposa_apellido_paterno, m.esposa_apellido_materno,
              m.estado
       FROM matrimonios m
       JOIN parroquias p ON p.id = m.parroquia_id
       ${whereClause}
       ORDER BY m.esposo_${sortField} ${sortDirection}
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, filters.pageSize, offset)
    .all<MarriageRow>();

  return { marriages: results, totalPages };
}

export interface AuthContext {
  rol: 'admin' | 'usuario_parroquia';
  parroquiaId: number | null;
}

interface PersonInput {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  lugarNacimiento?: string;
  fechaNacimiento?: string;
  parroquiaBautismo?: string;
  fechaBautismo?: string;
  padreNombre?: string;
  padreApellido?: string;
  padreDni?: string;
  madreNombre?: string;
  madreApellido?: string;
  madreDni?: string;
}

export interface CreateMarriageInput {
  fechaSacramento: string;
  numeroLibro: string;
  numeroFolio: string;
  numeroRegistro: string;
  esposo: PersonInput;
  esposa: PersonInput;
  fechaMatrimonio?: string;
  celebranteId?: number | null;
  lugarMatrimonio?: string;
  testigo1?: string;
  testigo2?: string;
  testigo3?: string;
  testigo4?: string;
  notasMarginales?: string;
}

function personToColumns(prefix: 'esposo' | 'esposa', person: PersonInput) {
  return {
    [`${prefix}_nombre`]: person.nombre,
    [`${prefix}_apellido_paterno`]: person.apellidoPaterno,
    [`${prefix}_apellido_materno`]: person.apellidoMaterno,
    [`${prefix}_lugar_nacimiento`]: person.lugarNacimiento ?? null,
    [`${prefix}_fecha_nacimiento`]: person.fechaNacimiento ?? null,
    [`${prefix}_parroquia_bautismo`]: person.parroquiaBautismo ?? null,
    [`${prefix}_fecha_bautismo`]: person.fechaBautismo ?? null,
    [`${prefix}_padre_nombre`]: person.padreNombre ?? null,
    [`${prefix}_padre_apellido`]: person.padreApellido ?? null,
    [`${prefix}_padre_dni`]: person.padreDni ?? null,
    [`${prefix}_madre_nombre`]: person.madreNombre ?? null,
    [`${prefix}_madre_apellido`]: person.madreApellido ?? null,
    [`${prefix}_madre_dni`]: person.madreDni ?? null,
  };
}

export async function createMarriage(
  db: D1Database,
  auth: AuthContext,
  input: CreateMarriageInput,
  bodyParroquiaId: number | undefined,
): Promise<{ success: true; id: number } | { success: false; message: string; status: number }> {
  // Misma regla ya validada con Sacerdote (§5, Opción B): nunca confiar en
  // parroquia_id del body para usuario_parroquia; solo admin puede especificarlo.
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

  if (!input.esposo.nombre || !input.esposa.nombre) {
    return { success: false, message: 'Los nombres de ambos cónyuges son requeridos.', status: 400 };
  }

  const esposoCols = personToColumns('esposo', input.esposo);
  const esposaCols = personToColumns('esposa', input.esposa);

  const columns = [
    'parroquia_id', 'fecha_sacramento', 'numero_libro', 'numero_folio', 'numero_registro',
    ...Object.keys(esposoCols), ...Object.keys(esposaCols),
    'fecha_matrimonio', 'celebrante_id', 'lugar_matrimonio',
    'testigo_1', 'testigo_2', 'testigo_3', 'testigo_4', 'notas_marginales',
  ];

  const values = [
    targetParroquiaId, input.fechaSacramento, input.numeroLibro, input.numeroFolio, input.numeroRegistro,
    ...Object.values(esposoCols), ...Object.values(esposaCols),
    input.fechaMatrimonio ?? null, input.celebranteId ?? null, input.lugarMatrimonio ?? null,
    input.testigo1 ?? null, input.testigo2 ?? null, input.testigo3 ?? null, input.testigo4 ?? null,
    input.notasMarginales ?? null,
  ];

  const placeholders = columns.map(() => '?').join(', ');

  const result = await db
    .prepare(`INSERT INTO matrimonios (${columns.join(', ')}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  return { success: true, id: result.meta.last_row_id as number };
}

async function assertCanManageMarriage(
  db: D1Database,
  auth: AuthContext,
  marriageId: number,
): Promise<{ allowed: true } | { allowed: false; message: string; status: number }> {
  if (auth.rol === 'admin') {
    return { allowed: true };
  }

  const marriage = await db
    .prepare('SELECT parroquia_id FROM matrimonios WHERE id = ?')
    .bind(marriageId)
    .first<{ parroquia_id: number }>();

  if (!marriage) {
    return { allowed: false, message: 'Partida no encontrada.', status: 404 };
  }

  if (marriage.parroquia_id !== auth.parroquiaId) {
    return {
      allowed: false,
      message: 'No tiene permiso para modificar partidas de otra parroquia.',
      status: 403,
    };
  }

  return { allowed: true };
}

export async function updateMarriage(
  db: D1Database,
  auth: AuthContext,
  marriageId: number,
  input: CreateMarriageInput,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageMarriage(db, auth, marriageId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  const esposoCols = personToColumns('esposo', input.esposo);
  const esposaCols = personToColumns('esposa', input.esposa);

  const updates: Record<string, unknown> = {
    fecha_sacramento: input.fechaSacramento,
    numero_libro: input.numeroLibro,
    numero_folio: input.numeroFolio,
    numero_registro: input.numeroRegistro,
    ...esposoCols,
    ...esposaCols,
    fecha_matrimonio: input.fechaMatrimonio ?? null,
    celebrante_id: input.celebranteId ?? null,
    lugar_matrimonio: input.lugarMatrimonio ?? null,
    testigo_1: input.testigo1 ?? null,
    testigo_2: input.testigo2 ?? null,
    testigo_3: input.testigo3 ?? null,
    testigo_4: input.testigo4 ?? null,
    notas_marginales: input.notasMarginales ?? null,
    updated_at: new Date().toISOString(),
  };

  const setClause = Object.keys(updates)
    .map((col) => `${col} = ?`)
    .join(', ');

  await db
    .prepare(`UPDATE matrimonios SET ${setClause} WHERE id = ?`)
    .bind(...Object.values(updates), marriageId)
    .run();

  return { success: true };
}

export async function annulMarriage(
  db: D1Database,
  auth: AuthContext,
  marriageId: number,
  motivo: string,
  anuladoPorUsuarioId: number,
): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const permission = await assertCanManageMarriage(db, auth, marriageId);
  if (!permission.allowed) {
    return { success: false, message: permission.message, status: permission.status };
  }

  if (!motivo.trim()) {
    return { success: false, message: 'El motivo de anulación es requerido.', status: 400 };
  }

  await db
    .prepare(
      `UPDATE matrimonios
       SET estado = 'anulado', anulado_por_usuario_id = ?, anulado_en = ?, motivo_anulacion = ?
       WHERE id = ?`,
    )
    .bind(anuladoPorUsuarioId, new Date().toISOString(), motivo, marriageId)
    .run();

  return { success: true };
}

export async function getMarriageById(
  db: D1Database,
  marriageId: number,
): Promise<Record<string, unknown> | null> {
  const marriage = await db
    .prepare(
      `SELECT m.*, p.nombre as parroquia_nombre
       FROM matrimonios m
       JOIN parroquias p ON p.id = m.parroquia_id
       WHERE m.id = ?`,
    )
    .bind(marriageId)
    .first();

  return marriage ?? null;
}
