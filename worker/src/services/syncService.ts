import type {
  Autor,
  CambioEntrante,
  CambioSync,
  EntidadSync,
  MinistroSync,
  PartidaSync,
  PersonaSync,
  ResultadoSync,
  TipoSacramento,
} from './syncTypes';

/** Cada cambio usa dos llamadas a D1, y el plan gratuito permite 50 por petición. */
export const MAX_CAMBIOS_POR_ENVIO = 20;
export const MAX_PARTIDAS_POR_PAGINA = 50;

const TIPOS: Record<TipoSacramento, { tabla: string; personas: string[]; detalle: string[] }> = {
  bautismo: { tabla: 'bautismos', personas: ['persona_id'], detalle: ['padrino_1', 'padrino_2'] },
  confirmacion: { tabla: 'confirmaciones', personas: ['persona_id'], detalle: ['padrino_1', 'padrino_2'] },
  matrimonio: {
    tabla: 'matrimonios',
    personas: ['conyuge_1_id', 'conyuge_2_id'],
    detalle: [
      'lugar',
      'testigo_1',
      'testigo_2',
      'testigo_3',
      'testigo_4',
      'conyuge_1_bautismo_parroquia',
      'conyuge_1_bautismo_fecha',
      'conyuge_2_bautismo_parroquia',
      'conyuge_2_bautismo_fecha',
    ],
  },
};

const CAMPOS_PERSONA = [
  'dni',
  'nombres',
  'apellido_paterno',
  'apellido_materno',
  'fecha_nacimiento',
  'edad',
  'lugar_nacimiento',
  'padre',
  'madre',
] as const;

const MOTIVO_CONFLICTO = 'Otra PC modificó este registro antes de que se subiera este cambio.';

class Rechazo extends Error {}

function esTipo(valor: unknown): valor is TipoSacramento {
  return typeof valor === 'string' && Object.hasOwn(TIPOS, valor);
}

function textoRequerido(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') throw new Rechazo(`Falta el campo ${campo}.`);
  return valor;
}

function textoOpcional(valor: unknown, campo: string): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') throw new Rechazo(`El campo ${campo} no es válido.`);
  return valor;
}

function validarPersona(valor: unknown): PersonaSync {
  const persona = (valor ?? {}) as Record<string, unknown>;
  if (persona.edad !== null && persona.edad !== undefined && !(Number.isInteger(persona.edad) && (persona.edad as number) >= 0)) {
    throw new Rechazo('La edad no es válida.');
  }
  const dni = textoOpcional(persona.dni, 'dni');
  return {
    client_id: textoRequerido(persona.client_id, 'client_id de la persona'),
    dni: dni === '' ? null : dni,
    // Los campos pueden quedar vacíos, igual que en el formulario: es lo que dice la partida.
    nombres: textoOpcional(persona.nombres, 'nombres') ?? '',
    apellido_paterno: textoOpcional(persona.apellido_paterno, 'apellido_paterno') ?? '',
    apellido_materno: textoOpcional(persona.apellido_materno, 'apellido_materno') ?? '',
    fecha_nacimiento: textoOpcional(persona.fecha_nacimiento, 'fecha_nacimiento'),
    edad: (persona.edad as number | null | undefined) ?? null,
    lugar_nacimiento: textoOpcional(persona.lugar_nacimiento, 'lugar_nacimiento'),
    padre: textoOpcional(persona.padre, 'padre'),
    madre: textoOpcional(persona.madre, 'madre'),
  };
}

function validarCambio(valor: unknown): CambioSync {
  const cambio = (valor ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(cambio.usuario_id))
    throw new Rechazo('El usuario de la corrección no es válido.');
  return {
    client_id: textoRequerido(cambio.client_id, 'client_id de la corrección'),
    persona_client_id: textoRequerido(cambio.persona_client_id, 'persona de la corrección'),
    usuario_id: cambio.usuario_id as number,
    campo_cambio: textoRequerido(cambio.campo_cambio, 'campo de la corrección'),
    valor_anterior: textoOpcional(cambio.valor_anterior, 'valor_anterior'),
    valor_nuevo: textoOpcional(cambio.valor_nuevo, 'valor_nuevo'),
    fecha_cambio: textoRequerido(cambio.fecha_cambio, 'fecha de la corrección'),
  };
}

function validarPartida(entidad: TipoSacramento, valor: unknown): PartidaSync {
  const partida = (valor ?? {}) as Record<string, unknown>;
  if (partida.tipo !== entidad) throw new Rechazo('El tipo de la partida no coincide.');
  if (!Number.isInteger(partida.parroquia_id)) throw new Rechazo('La parroquia no es válida.');
  if (partida.estado !== 'vigente' && partida.estado !== 'anulado') throw new Rechazo('El estado no es válido.');
  if (partida.anulado_por_usuario_id !== null && partida.anulado_por_usuario_id !== undefined && !Number.isInteger(partida.anulado_por_usuario_id)) {
    throw new Rechazo('El usuario de la anulación no es válido.');
  }

  const config = TIPOS[entidad];
  const personas = Array.isArray(partida.personas) ? partida.personas.map(validarPersona) : [];
  if (personas.length !== config.personas.length || new Set(personas.map((p) => p.client_id)).size !== personas.length) {
    throw new Rechazo('Las personas de la partida no son válidas.');
  }

  const detalleEntrante = (partida.detalle ?? {}) as Record<string, unknown>;
  const detalle: Record<string, string | null> = {};
  for (const columna of config.detalle) detalle[columna] = textoOpcional(detalleEntrante[columna], columna);

  return {
    tipo: entidad,
    client_id: textoRequerido(partida.client_id, 'client_id'),
    parroquia_id: partida.parroquia_id as number,
    ministro_client_id: textoOpcional(partida.ministro_client_id, 'ministro'),
    libro: textoRequerido(partida.libro, 'libro'),
    folio: textoRequerido(partida.folio, 'folio'),
    numero: textoRequerido(partida.numero, 'número'),
    fecha_emision: textoRequerido(partida.fecha_emision, 'fecha'),
    fecha_evento: textoOpcional(partida.fecha_evento, 'fecha_evento'),
    anotaciones: textoOpcional(partida.anotaciones, 'anotaciones'),
    estado: partida.estado,
    anulado_por_usuario_id: (partida.anulado_por_usuario_id as number | null | undefined) ?? null,
    anulado_en: textoOpcional(partida.anulado_en, 'anulado_en'),
    motivo_anulacion: textoOpcional(partida.motivo_anulacion, 'motivo_anulacion'),
    personas,
    detalle,
    cambios: Array.isArray(partida.cambios) ? partida.cambios.map(validarCambio) : [],
  };
}

function validarMinistro(valor: unknown): MinistroSync {
  const ministro = (valor ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(ministro.parroquia_id)) throw new Rechazo('La parroquia no es válida.');
  return {
    client_id: textoRequerido(ministro.client_id, 'client_id'),
    parroquia_id: ministro.parroquia_id as number,
    titulo: textoOpcional(ministro.titulo, 'titulo'),
    nombre: textoRequerido(ministro.nombre, 'nombre'),
    apellido_paterno: textoRequerido(ministro.apellido_paterno, 'apellido_paterno'),
    apellido_materno: textoRequerido(ministro.apellido_materno, 'apellido_materno'),
    activo: ministro.activo === 0 ? 0 : 1,
  };
}

function exigirPermiso(autor: Autor, parroquiaId: number, registro: string): void {
  if (autor.rol !== 'admin' && autor.parroquiaId !== parroquiaId) {
    throw new Rechazo(`No tiene permiso para modificar ${registro} de otra parroquia.`);
  }
}

/** Dentro de un batch, aborta toda la transacción si otra PC cambió el registro tras la lectura. */
function guardaDeVersion(db: D1Database, tabla: 'sacramentos' | 'ministros', clientId: string, version: number) {
  return db
    .prepare(`SELECT CASE WHEN (SELECT version FROM ${tabla} WHERE client_id = ?) = ? THEN 1 ELSE json('version distinta') END`)
    .bind(clientId, version);
}

const esErrorDeGuarda = (error: unknown) => error instanceof Error && /malformed JSON/i.test(error.message);

interface EstadoRemoto {
  version: number;
  ultimo_cola_id: string | null;
}

/** null: no hay conflicto. Un reenvío de la misma fila de la cola no es un conflicto. */
function detectarConflicto(cambio: CambioEntrante, actual: EstadoRemoto): ResultadoSync | null {
  if (actual.ultimo_cola_id === cambio.cola_id || cambio.version_base === actual.version) return null;
  return {
    entidad: cambio.entidad,
    client_id: cambio.client_id,
    estado: 'conflicto',
    version: actual.version,
    motivo: MOTIVO_CONFLICTO,
  };
}

async function aplicarMinistro(db: D1Database, autor: Autor, cambio: CambioEntrante): Promise<ResultadoSync> {
  const ministro = validarMinistro(cambio.datos);
  if (ministro.client_id !== cambio.client_id) throw new Rechazo('El registro no coincide con el cambio.');
  exigirPermiso(autor, ministro.parroquia_id, 'ministros');

  const actual = await db
    .prepare('SELECT parroquia_id, version, ultimo_cola_id FROM ministros WHERE client_id = ?')
    .bind(ministro.client_id)
    .first<EstadoRemoto & { parroquia_id: number }>();

  const statements: D1PreparedStatement[] = [];
  if (actual) {
    exigirPermiso(autor, actual.parroquia_id, 'ministros');
    if (actual.parroquia_id !== ministro.parroquia_id) throw new Rechazo('La parroquia de un ministro no se puede cambiar.');
    const conflicto = detectarConflicto(cambio, actual);
    if (conflicto) return conflicto;
    statements.push(
      guardaDeVersion(db, 'ministros', ministro.client_id, actual.version),
      db
        .prepare(
          `UPDATE ministros
           SET titulo = ?, nombre = ?, apellido_paterno = ?, apellido_materno = ?, activo = ?, ultimo_cola_id = ?
           WHERE client_id = ?`,
        )
        .bind(ministro.titulo, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno, ministro.activo, cambio.cola_id, ministro.client_id),
    );
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO ministros
             (client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, ultimo_cola_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        )
        .bind(ministro.client_id, ministro.parroquia_id, ministro.titulo, ministro.nombre, ministro.apellido_paterno, ministro.apellido_materno, ministro.activo, cambio.cola_id),
    );
  }
  statements.push(db.prepare('SELECT version FROM ministros WHERE client_id = ?').bind(ministro.client_id));

  const resultados = await db.batch<{ version: number }>(statements);
  const version = resultados[resultados.length - 1].results[0].version;
  return { entidad: 'ministro', client_id: ministro.client_id, estado: 'aplicado', version };
}

function statementPersona(db: D1Database, parroquiaId: number, persona: PersonaSync): D1PreparedStatement {
  const columnas = CAMPOS_PERSONA.join(', ');
  const actualizaciones = CAMPOS_PERSONA.map((campo) => `${campo} = excluded.${campo}`).join(', ');
  return db
    .prepare(
      `INSERT INTO personas (client_id, parroquia_id, ${columnas})
       VALUES (?, ?, ${CAMPOS_PERSONA.map(() => '?').join(', ')})
       ON CONFLICT (client_id) DO UPDATE SET ${actualizaciones}`,
    )
    .bind(persona.client_id, parroquiaId, ...CAMPOS_PERSONA.map((campo) => persona[campo]));
}

async function aplicarPartida(db: D1Database, autor: Autor, cambio: CambioEntrante, tipo: TipoSacramento): Promise<ResultadoSync> {
  const partida = validarPartida(tipo, cambio.datos);
  if (partida.client_id !== cambio.client_id) throw new Rechazo('El registro no coincide con el cambio.');
  exigirPermiso(autor, partida.parroquia_id, 'partidas');

  const config = TIPOS[tipo];
  const clientesPersona = partida.personas.map((persona) => persona.client_id);
  const usuarios = [...new Set([...partida.cambios.map((c) => c.usuario_id), ...(partida.anulado_por_usuario_id ? [partida.anulado_por_usuario_id] : [])])];

  const [filaActual, filasPersonas, filasUsuarios, filasParroquia, filasMinistro] = await db.batch([
    db.prepare('SELECT id, tipo, parroquia_id, version, estado, ultimo_cola_id FROM sacramentos WHERE client_id = ?').bind(partida.client_id),
    db
      .prepare(
        `SELECT p.client_id FROM personas p WHERE p.client_id IN (SELECT value FROM json_each(?))`,
      )
      .bind(JSON.stringify(clientesPersona)),
    db
      .prepare('SELECT id, rol, parroquia_id FROM usuarios WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(usuarios)),
    db.prepare('SELECT id FROM parroquias WHERE id = ?').bind(partida.parroquia_id),
    db.prepare('SELECT id FROM ministros WHERE client_id = ?').bind(partida.ministro_client_id),
  ]);

  const actual = filaActual.results[0] as
    | (EstadoRemoto & { id: number; tipo: string; parroquia_id: number; estado: string })
    | undefined;

  if (filasParroquia.results.length === 0) throw new Rechazo('La parroquia no existe en el servidor.');
  if (partida.ministro_client_id && filasMinistro.results.length === 0) {
    throw new Rechazo('El ministro de esta partida todavía no está en el servidor.');
  }

  const usuariosValidos = filasUsuarios.results as { id: number; rol: string; parroquia_id: number | null }[];
  for (const usuarioId of usuarios) {
    const usuario = usuariosValidos.find((fila) => fila.id === usuarioId);
    if (!usuario || (usuario.rol !== 'admin' && usuario.parroquia_id !== partida.parroquia_id)) {
      throw new Rechazo('La partida indica un usuario que no pertenece a su parroquia.');
    }
  }

  const statements: D1PreparedStatement[] = [];
  if (actual) {
    exigirPermiso(autor, actual.parroquia_id, 'partidas');
    if (actual.tipo !== tipo) throw new Rechazo('El tipo de una partida no se puede cambiar.');
    if (actual.parroquia_id !== partida.parroquia_id) throw new Rechazo('La parroquia de una partida no se puede cambiar.');
    if (actual.estado === 'anulado' && partida.estado !== 'anulado') throw new Rechazo('Una partida anulada no se puede reactivar.');

    const conflicto = detectarConflicto(cambio, actual);
    if (conflicto) return conflicto;

    const propias = await db
      .prepare(`SELECT ${config.personas.map((columna) => `(SELECT client_id FROM personas WHERE id = ${columna}) AS ${columna}`).join(', ')} FROM ${config.tabla} WHERE sacramento_id = ?`)
      .bind(actual.id)
      .first<Record<string, string>>();
    if (!propias || config.personas.some((columna, i) => propias[columna] !== clientesPersona[i])) {
      throw new Rechazo('Las personas no corresponden a esta partida.');
    }
    statements.push(guardaDeVersion(db, 'sacramentos', partida.client_id, actual.version));
  } else if (filasPersonas.results.length > 0) {
    throw new Rechazo('Las personas ya pertenecen a otra partida.');
  }

  for (const persona of partida.personas) statements.push(statementPersona(db, partida.parroquia_id, persona));

  statements.push(
    db
      .prepare(
        `INSERT INTO sacramentos
           (client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
            estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, ultimo_cola_id)
         VALUES (?, ?, ?, (SELECT id FROM ministros WHERE client_id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (client_id) DO UPDATE SET
           ministro_id = excluded.ministro_id, libro = excluded.libro, folio = excluded.folio, numero = excluded.numero,
           fecha_emision = excluded.fecha_emision, fecha_evento = excluded.fecha_evento, anotaciones = excluded.anotaciones,
           estado = excluded.estado, anulado_por_usuario_id = excluded.anulado_por_usuario_id,
           anulado_en = excluded.anulado_en, motivo_anulacion = excluded.motivo_anulacion,
           ultimo_cola_id = excluded.ultimo_cola_id`,
      )
      .bind(
        partida.client_id,
        tipo,
        partida.parroquia_id,
        partida.ministro_client_id,
        partida.libro,
        partida.folio,
        partida.numero,
        partida.fecha_emision,
        partida.fecha_evento,
        partida.anotaciones,
        partida.estado,
        partida.anulado_por_usuario_id,
        partida.anulado_en,
        partida.motivo_anulacion,
        cambio.cola_id,
      ),
  );

  const columnasSubtipo = [...config.personas, ...config.detalle];
  const selectPersonas = config.personas.map(() => '(SELECT id FROM personas WHERE client_id = ?)');
  statements.push(
    db
      .prepare(
        `INSERT INTO ${config.tabla} (sacramento_id, ${columnasSubtipo.join(', ')})
         VALUES ((SELECT id FROM sacramentos WHERE client_id = ?), ${[...selectPersonas, ...config.detalle.map(() => '?')].join(', ')})
         ON CONFLICT (sacramento_id) DO UPDATE SET ${config.detalle.map((columna) => `${columna} = excluded.${columna}`).join(', ')}`,
      )
      .bind(partida.client_id, ...clientesPersona, ...config.detalle.map((columna) => partida.detalle[columna])),
  );

  for (const correccion of partida.cambios) {
    if (!clientesPersona.includes(correccion.persona_client_id)) {
      throw new Rechazo('Una corrección no corresponde a las personas de la partida.');
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO cambios_persona
             (client_id, persona_id, sacramento_id, usuario_id, campo_cambio, valor_anterior, valor_nuevo, fecha_cambio)
           VALUES (?, (SELECT id FROM personas WHERE client_id = ?), (SELECT id FROM sacramentos WHERE client_id = ?), ?, ?, ?, ?, ?)
           ON CONFLICT (client_id) DO NOTHING`,
        )
        .bind(
          correccion.client_id,
          correccion.persona_client_id,
          partida.client_id,
          correccion.usuario_id,
          correccion.campo_cambio,
          correccion.valor_anterior,
          correccion.valor_nuevo,
          correccion.fecha_cambio,
        ),
    );
  }

  statements.push(db.prepare('SELECT version FROM sacramentos WHERE client_id = ?').bind(partida.client_id));

  const resultados = await db.batch<{ version: number }>(statements);
  const version = resultados[resultados.length - 1].results[0].version;
  return { entidad: tipo, client_id: partida.client_id, estado: 'aplicado', version };
}

async function aplicarCambio(db: D1Database, autor: Autor, cambio: CambioEntrante): Promise<ResultadoSync> {
  const entidad = cambio?.entidad as EntidadSync;
  const clientId = cambio?.client_id;
  try {
    if (typeof clientId !== 'string' || clientId === '' || typeof cambio.cola_id !== 'string' || cambio.cola_id === '') {
      throw new Rechazo('El cambio no identifica su registro.');
    }
    if (entidad === 'ministro') return await aplicarMinistro(db, autor, cambio);
    if (esTipo(entidad)) return await aplicarPartida(db, autor, cambio, entidad);
    throw new Rechazo('Tipo de registro no reconocido.');
  } catch (error) {
    if (error instanceof Rechazo) {
      return { entidad, client_id: clientId, estado: 'rechazado', motivo: error.message };
    }
    if (esErrorDeGuarda(error)) {
      const tabla = entidad === 'ministro' ? 'ministros' : 'sacramentos';
      const fila = await db.prepare(`SELECT version FROM ${tabla} WHERE client_id = ?`).bind(clientId).first<{ version: number }>();
      return { entidad, client_id: clientId, estado: 'conflicto', version: fila?.version ?? 0, motivo: MOTIVO_CONFLICTO };
    }
    if (error instanceof Error && /constraint failed/i.test(error.message)) {
      console.error('Cambio rechazado por la base:', error.message);
      return { entidad, client_id: clientId, estado: 'rechazado', motivo: 'El servidor rechazó los datos de este registro.' };
    }
    
    throw error;
  }
}

export async function aplicarCambios(db: D1Database, autor: Autor, cambios: CambioEntrante[]): Promise<ResultadoSync[]> {
  const resultados: ResultadoSync[] = [];
  for (const cambio of cambios) resultados.push(await aplicarCambio(db, autor, cambio));
  return resultados;
}

type FilaSacramento = Omit<PartidaSync, 'personas' | 'detalle' | 'cambios'> & { id: number; seq?: number };

async function leerPartidas(db: D1Database, cabeceraSql: string, idsSql: string, binds: unknown[]) {
  const subtipos = (Object.keys(TIPOS) as TipoSacramento[]).map((tipo) =>
    db.prepare(`SELECT * FROM ${TIPOS[tipo].tabla} WHERE sacramento_id IN (${idsSql})`).bind(...binds),
  );

  const [cabeceras, ...resto] = await db.batch([
    db.prepare(cabeceraSql).bind(...binds),
    ...subtipos,
    db
      .prepare(
        `SELECT ${['id', 'client_id', ...CAMPOS_PERSONA].join(', ')} FROM personas
         WHERE id IN (
           SELECT persona_id FROM bautismos WHERE sacramento_id IN (${idsSql})
           UNION ALL SELECT persona_id FROM confirmaciones WHERE sacramento_id IN (${idsSql})
           UNION ALL SELECT conyuge_1_id FROM matrimonios WHERE sacramento_id IN (${idsSql})
           UNION ALL SELECT conyuge_2_id FROM matrimonios WHERE sacramento_id IN (${idsSql})
         )`,
      )
      .bind(...binds, ...binds, ...binds, ...binds),
    db
      .prepare(
        `SELECT c.client_id, c.sacramento_id, p.client_id AS persona_client_id, c.usuario_id, c.campo_cambio,
                c.valor_anterior, c.valor_nuevo, c.fecha_cambio
         FROM cambios_persona c JOIN personas p ON p.id = c.persona_id
         WHERE c.sacramento_id IN (${idsSql})
         ORDER BY c.id`,
      )
      .bind(...binds),
  ]);

  const filasSubtipo = new Map<number, Record<string, string | number | null>>();
  (Object.keys(TIPOS) as TipoSacramento[]).forEach((_, indice) => {
    for (const fila of resto[indice].results as Record<string, string | number | null>[]) {
      filasSubtipo.set(fila.sacramento_id as number, fila);
    }
  });

  const personas = new Map((resto[3].results as (PersonaSync & { id: number })[]).map((fila) => [fila.id, fila]));
  const cambios = resto[4].results as (CambioSync & { sacramento_id: number })[];

  return (cabeceras.results as FilaSacramento[]).map((fila) => {
    const config = TIPOS[fila.tipo];
    const subtipo = filasSubtipo.get(fila.id) ?? {};
    const detalle: Record<string, string | null> = {};
    for (const columna of config.detalle) detalle[columna] = (subtipo[columna] as string | null) ?? null;

    const { id, seq, ...cabecera } = fila;
    return {
      seq,
      partida: {
        ...cabecera,
        personas: config.personas.map((columna) => {
          const persona: PersonaSync & { id?: number } = { ...(personas.get(subtipo[columna] as number) as PersonaSync & { id: number }) };
          delete persona.id;
          return persona;
        }),
        detalle,
        cambios: cambios
          .filter((cambio) => cambio.sacramento_id === id)
          .map((cambio) => {
            const limpio: CambioSync & { sacramento_id?: number } = { ...cambio };
            delete limpio.sacramento_id;
            return limpio;
          }),
      } as PartidaSync,
    };
  });
}

const COLUMNAS_CABECERA = `s.id, s.tipo, s.client_id, s.parroquia_id, m.client_id AS ministro_client_id, s.libro, s.folio, s.numero,
  s.fecha_emision, s.fecha_evento, s.anotaciones, s.estado, s.anulado_por_usuario_id, s.anulado_en, s.motivo_anulacion,
  s.version, s.created_at, s.updated_at`;

export async function leerPagina(db: D1Database, cursor: number, limite: number) {
  const idsSql = 'SELECT sacramento_id FROM sync_feed WHERE seq > ? ORDER BY seq LIMIT ?';
  const filas = await leerPartidas(
    db,
    `SELECT f.seq, ${COLUMNAS_CABECERA}
     FROM sync_feed f
     JOIN sacramentos s ON s.id = f.sacramento_id
     LEFT JOIN ministros m ON m.id = s.ministro_id
     WHERE f.seq > ? ORDER BY f.seq LIMIT ?`,
    idsSql,
    [cursor, limite],
  );

  return {
    partidas: filas.map((fila) => fila.partida),
    cursor: filas.length > 0 ? (filas[filas.length - 1].seq as number) : cursor,
    hayMas: filas.length === limite,
  };
}

export async function leerRegistro(db: D1Database, entidad: string, clientId: string) {
  if (entidad === 'ministro') {
    return db.prepare(`${SELECT_MINISTROS} WHERE client_id = ?`).bind(clientId).first<MinistroSync>();
  }
  const filas = await leerPartidas(
    db,
    `SELECT ${COLUMNAS_CABECERA}
     FROM sacramentos s LEFT JOIN ministros m ON m.id = s.ministro_id
     WHERE s.client_id = ?`,
    'SELECT id FROM sacramentos WHERE client_id = ?',
    [clientId],
  );
  return filas[0]?.partida ?? null;
}

const SELECT_MINISTROS = `SELECT id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo, version, updated_at
  FROM ministros`;


export async function leerReferencia(db: D1Database) {
  const [parroquias, ministros, usuarios] = await db.batch([
    db.prepare('SELECT id, nombre, ubicacion, activa FROM parroquias'),
    db.prepare(SELECT_MINISTROS),
    db.prepare('SELECT id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo FROM usuarios'),
  ]);

  return {
    parroquias: parroquias.results,
    ministros: ministros.results,
    usuarios: usuarios.results,
  };
}
