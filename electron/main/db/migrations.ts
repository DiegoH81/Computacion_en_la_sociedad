export const LOCAL_MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE parroquias (
    id        INTEGER PRIMARY KEY,
    nombre    TEXT    NOT NULL,
    ubicacion TEXT,
    activa    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE usuarios (
    id               INTEGER PRIMARY KEY,
    parroquia_id     INTEGER REFERENCES parroquias(id),
    username         TEXT    NOT NULL UNIQUE,
    rol              TEXT    NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE ministros (
    id               INTEGER PRIMARY KEY,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    titulo           TEXT,
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE personas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id        TEXT    NOT NULL UNIQUE,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    dni              TEXT    CHECK (dni IS NULL OR dni <> ''),
    nombres          TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL DEFAULT '',
    fecha_nacimiento TEXT,
    edad             INTEGER CHECK (edad IS NULL OR edad >= 0),
    lugar_nacimiento TEXT,
    padre            TEXT,
    madre            TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;
  CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);

  CREATE TABLE sacramentos (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id              TEXT    NOT NULL UNIQUE,
    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),
    ministro_id            INTEGER REFERENCES ministros(id),
    libro                  TEXT    NOT NULL,
    folio                  TEXT    NOT NULL,
    numero                 TEXT    NOT NULL,
    fecha_emision          TEXT    NOT NULL,
    fecha_evento           TEXT,
    anotaciones            TEXT,
    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
    anulado_en             TEXT,
    motivo_anulacion       TEXT,
    version                INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- Permite que cada subtipo enlace (id, tipo): un bautismo no puede colgar de un matrimonio.
    UNIQUE (id, tipo),
    CHECK (
      estado = 'vigente'
      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL
          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')
    )
  );
  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);

  CREATE TABLE matrimonios (
    sacramento_id                INTEGER PRIMARY KEY,
    tipo                         TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),
    conyuge_1_id                 INTEGER NOT NULL REFERENCES personas(id),
    conyuge_2_id                 INTEGER NOT NULL REFERENCES personas(id),
    lugar                        TEXT,
    testigo_1                    TEXT,
    testigo_2                    TEXT,
    testigo_3                    TEXT,
    testigo_4                    TEXT,
    conyuge_1_bautismo_parroquia TEXT,
    conyuge_1_bautismo_fecha     TEXT,
    conyuge_2_bautismo_parroquia TEXT,
    conyuge_2_bautismo_fecha     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),
    CHECK (conyuge_1_id <> conyuge_2_id)
  );
  CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);
  CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);

  CREATE TABLE bautismos (
    sacramento_id INTEGER PRIMARY KEY,
    tipo          TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),
    persona_id    INTEGER NOT NULL REFERENCES personas(id),
    padrino_1     TEXT,
    padrino_2     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
  );
  CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);

  CREATE TABLE confirmaciones (
    sacramento_id INTEGER PRIMARY KEY,
    tipo          TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),
    persona_id    INTEGER NOT NULL REFERENCES personas(id),
    padrino_1     TEXT,
    padrino_2     TEXT,
    FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
  );
  CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);

  CREATE TABLE cambios_persona (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Evita duplicar la corrección si se reenvía tras un corte de internet.
    client_id      TEXT    NOT NULL UNIQUE,
    persona_id     INTEGER NOT NULL REFERENCES personas(id),
    sacramento_id  INTEGER REFERENCES sacramentos(id),
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
    campo_cambio   TEXT    NOT NULL,
    valor_anterior TEXT,
    valor_nuevo    TEXT,
    fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);

  -- Cada UPDATE sube version, salvo que la sincronización ya la haya fijado.
  CREATE TRIGGER trg_personas_touch
  AFTER UPDATE ON personas
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE personas
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;

  CREATE TRIGGER trg_sacramentos_touch
  AFTER UPDATE ON sacramentos
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE sacramentos
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;
  `,
  `
  CREATE TABLE ministros_nueva (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id        TEXT    NOT NULL UNIQUE,
    parroquia_id     INTEGER NOT NULL REFERENCES parroquias(id),
    titulo           TEXT,
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1,
    version          INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  INSERT INTO ministros_nueva (id, client_id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo)
  SELECT id, 'servidor-' || id, parroquia_id, titulo, nombre, apellido_paterno, apellido_materno, activo
  FROM ministros;

  DROP TABLE ministros;
  ALTER TABLE ministros_nueva RENAME TO ministros;

  CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);

  CREATE TRIGGER trg_ministros_touch
  AFTER UPDATE ON ministros
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE ministros
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;
  `,
  `
  -- Registros con cambios sin subir. Se envía su estado final, así que basta una fila por registro.
  -- version_base: última versión que conoce el servidor; NULL si el registro aún no existe allí.
  CREATE TABLE sync_cola (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro')),
    client_id    TEXT    NOT NULL,
    version_base INTEGER,
    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (entidad, client_id)
  );

  INSERT INTO sync_cola (entidad, client_id)
  SELECT tipo, client_id FROM sacramentos ORDER BY id;

  INSERT INTO sync_cola (entidad, client_id)
  SELECT 'ministro', client_id FROM ministros ORDER BY id;
  `,
  `
  -- cola_id: identifica la fila mientras siga pendiente, para reconocer un reenvío tras un corte.
  -- revision: sube con cada edición; si cambió durante el envío, la fila no se quita al confirmarse.
  ALTER TABLE sync_cola ADD COLUMN cola_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE sync_cola ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE sync_cola ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'conflicto', 'rechazado'));
  ALTER TABLE sync_cola ADD COLUMN motivo TEXT;
  UPDATE sync_cola SET cola_id = lower(hex(randomblob(16)));

  CREATE TABLE sync_estado (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  -- Verificación para entrar sin internet. Solo existe para quien ya entró con conexión en esta PC.
  CREATE TABLE credenciales_locales (
    usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),
    verificador    TEXT NOT NULL,
    actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  `,
  `
  -- La edad pasa a ser una fecha aproximada en texto libre: los libros traen cosas como
  -- "22 AG 1978" o "(27 AÑOS AL DIA DE BODA)". Las edades que ya había se conservan como "N años".
  ALTER TABLE personas ADD COLUMN fecha_aproximada TEXT;
  UPDATE personas SET fecha_aproximada = edad || ' años' WHERE edad IS NOT NULL;
  ALTER TABLE personas DROP COLUMN edad;
  `,
  `
  -- Tres roles (ver worker/src/db/migrations/0015_roles_y_correcciones.sql):
  --   admin_general, admin_parroquia (el párroco) y usuario (un ayudante).
  -- Un admin sin parroquia pasa a admin_general; las demás cuentas, a admin_parroquia.
  --
  -- Los usuarios ahora se pueden crear y editar en esta PC sin internet y subirse después:
  --   client_id      los identifica ante el servidor (el mismo 'servidor-<id>' que puso su migración).
  --   id negativo    una cuenta creada aquí que el servidor todavía no conoce; al subirla se cambia por el suyo.
  --   password_hash_pendiente   la contraseña cambiada aquí que falta subir (PBKDF2, el formato del
  --                             servidor). Se borra en cuanto el servidor la recibe.
  CREATE TABLE usuarios_nueva (
    id               INTEGER PRIMARY KEY,
    client_id        TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    parroquia_id     INTEGER REFERENCES parroquias(id),
    username         TEXT    NOT NULL UNIQUE,
    rol              TEXT    NOT NULL CHECK (rol IN ('admin_general', 'admin_parroquia', 'usuario')),
    nombre           TEXT    NOT NULL,
    apellido_paterno TEXT    NOT NULL,
    apellido_materno TEXT    NOT NULL,
    activo           INTEGER NOT NULL DEFAULT 1,
    principal        INTEGER NOT NULL DEFAULT 0,
    password_hash_pendiente TEXT,
    version          INTEGER NOT NULL DEFAULT 1,
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  INSERT INTO usuarios_nueva (id, client_id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
  SELECT id, 'servidor-' || id, parroquia_id, username,
         CASE WHEN rol = 'admin' AND parroquia_id IS NULL THEN 'admin_general' ELSE 'admin_parroquia' END,
         nombre, apellido_paterno, apellido_materno, activo
  FROM usuarios;

  DROP TABLE usuarios;
  ALTER TABLE usuarios_nueva RENAME TO usuarios;

  CREATE TRIGGER trg_usuarios_touch
  AFTER UPDATE ON usuarios
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE usuarios
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;

  -- Una corrección pedida por un usuario queda 'pendiente' hasta que el admin_parroquia la revise.
  ALTER TABLE cambios_persona ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
  ALTER TABLE cambios_persona ADD COLUMN revisado_por_usuario_id INTEGER REFERENCES usuarios(id);
  ALTER TABLE cambios_persona ADD COLUMN revisado_en TEXT;

  -- La cola también lleva usuarios.
  CREATE TABLE sync_cola_nueva (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad      TEXT    NOT NULL CHECK (entidad IN ('bautismo', 'confirmacion', 'matrimonio', 'ministro', 'usuario')),
    client_id    TEXT    NOT NULL,
    version_base INTEGER,
    creado_en    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    cola_id      TEXT    NOT NULL DEFAULT '',
    revision     INTEGER NOT NULL DEFAULT 1,
    estado       TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'conflicto', 'rechazado')),
    motivo       TEXT,
    UNIQUE (entidad, client_id)
  );

  INSERT INTO sync_cola_nueva (id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo)
  SELECT id, entidad, client_id, version_base, creado_en, cola_id, revision, estado, motivo FROM sync_cola;

  DROP TABLE sync_cola;
  ALTER TABLE sync_cola_nueva RENAME TO sync_cola;
  `,

  // La nota marginal que propone un usuario con su corrección espera aquí hasta que el párroco la revise.
  `
  ALTER TABLE sacramentos ADD COLUMN anotaciones_propuestas TEXT;
  `,

  // Solicitudes de cambio e historial de las partidas (igual que la migración 0017 del Worker).
  `
  CREATE TABLE solicitudes_cambio (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id               TEXT    NOT NULL UNIQUE,
    sacramento_id           INTEGER NOT NULL REFERENCES sacramentos(id),
    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
    parte                   TEXT    NOT NULL CHECK (parte IN ('sacramento', 'persona', 'conyuge_1', 'conyuge_2', 'detalle')),
    campo                   TEXT    NOT NULL,
    tipo                    TEXT    NOT NULL CHECK (tipo IN ('digitacion', 'nota_marginal')),
    valor_anterior          TEXT,
    valor_nuevo             TEXT,
    estado                  TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'descartado')),
    motivo                  TEXT,
    revisado_por_usuario_id INTEGER REFERENCES usuarios(id),
    revisado_en             TEXT,
    creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX idx_solicitudes_sacramento ON solicitudes_cambio (sacramento_id);

  CREATE TABLE historial_partidas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     TEXT    NOT NULL UNIQUE,
    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',
                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada')),
    motivo        TEXT,
    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);

  CREATE TABLE historial_campos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    historial_id   INTEGER NOT NULL REFERENCES historial_partidas(id),
    parte          TEXT    NOT NULL,
    campo          TEXT    NOT NULL,
    valor_anterior TEXT,
    valor_nuevo    TEXT
  );

  CREATE INDEX idx_historial_campos ON historial_campos (historial_id);

  -- Las correcciones de nombres pendientes: la misma client_id que tenían.
  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
  SELECT
    c.client_id,
    c.sacramento_id,
    c.usuario_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_1_id = c.persona_id) THEN 'conyuge_1'
      WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_2_id = c.persona_id) THEN 'conyuge_2'
      ELSE 'persona'
    END,
    c.campo_cambio,
    'nota_marginal',
    c.valor_anterior,
    c.valor_nuevo,
    c.fecha_cambio
  FROM cambios_persona c
  WHERE c.estado = 'pendiente' AND c.sacramento_id IS NOT NULL;

  -- La nota propuesta: la pidió quien pidió la corrección que iba con ella.
  INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
  SELECT
    s.client_id || '-nota',
    s.id,
    c.usuario_id,
    'sacramento',
    'anotaciones',
    'digitacion',
    s.anotaciones,
    s.anotaciones_propuestas,
    c.fecha_cambio
  FROM sacramentos s
  JOIN cambios_persona c ON c.id = (SELECT MIN(id) FROM cambios_persona WHERE sacramento_id = s.id AND estado = 'pendiente')
  WHERE s.anotaciones_propuestas IS NOT NULL;

  DELETE FROM cambios_persona WHERE estado = 'pendiente';

  ALTER TABLE sacramentos DROP COLUMN anotaciones_propuestas;
  `,

  `
  UPDATE usuarios SET principal = 1
  WHERE id IN (
    SELECT MIN(a.id) FROM usuarios a
    WHERE a.rol = 'admin_parroquia' AND a.activo = 1 AND a.id > 0
      AND NOT EXISTS (SELECT 1 FROM usuarios p WHERE p.principal = 1 AND p.parroquia_id = a.parroquia_id)
    GROUP BY a.parroquia_id
  );
  `,

  `
  CREATE TABLE usuario_parroquias (
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
    parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
    rol          TEXT    NOT NULL CHECK (rol IN ('admin_parroquia', 'usuario')),
    principal    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario_id, parroquia_id)
  );

  CREATE VIEW membresias AS
    SELECT id AS usuario_id, parroquia_id, rol, principal, 1 AS origen
    FROM usuarios
    WHERE parroquia_id IS NOT NULL
    UNION ALL
    SELECT usuario_id, parroquia_id, rol, principal, 0 AS origen
    FROM usuario_parroquias;
  `,

  `
  CREATE TABLE historial_partidas_respaldo AS SELECT * FROM historial_partidas;

  DROP TABLE historial_partidas;

  CREATE TABLE historial_partidas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id     TEXT    NOT NULL UNIQUE,
    sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
    evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',
                                                     'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada',
                                                     'rehabilitada')),
    motivo        TEXT,
    fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  INSERT INTO historial_partidas (id, client_id, sacramento_id, usuario_id, evento, motivo, fecha)
  SELECT id, client_id, sacramento_id, usuario_id, evento, motivo, fecha FROM historial_partidas_respaldo;

  DROP TABLE historial_partidas_respaldo;

  CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);
  `,

  `
  UPDATE personas
  SET nombres = (
    SELECT c.valor_anterior FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
    ORDER BY c.fecha_cambio, c.id LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1 FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  );

  UPDATE personas
  SET apellido_paterno = (
    SELECT c.valor_anterior FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
    ORDER BY c.fecha_cambio, c.id LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1 FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  );

  UPDATE personas
  SET apellido_materno = (
    SELECT c.valor_anterior FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
    ORDER BY c.fecha_cambio, c.id LIMIT 1
  )
  WHERE EXISTS (
    SELECT 1 FROM cambios_persona c
    WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  );
  `,
  `
  UPDATE sync_cola SET version_base = version_base + 1
  WHERE version_base IS NOT NULL AND client_id IN (
    SELECT client_id FROM sacramentos
    WHERE fecha_evento IS NOT NULL AND fecha_emision <> fecha_evento
    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada')
  );

  UPDATE sacramentos
  SET fecha_emision = fecha_evento, version = version + 1
  WHERE fecha_evento IS NOT NULL AND fecha_emision <> fecha_evento
    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');
  `,
  `
  CREATE TABLE sacramentos_respaldo AS SELECT * FROM sacramentos;

  DROP TABLE sacramentos;

  CREATE TABLE sacramentos (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id              TEXT    NOT NULL UNIQUE,
    tipo                   TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
    parroquia_id           INTEGER NOT NULL REFERENCES parroquias(id),
    ministro_id            INTEGER REFERENCES ministros(id),
    libro                  TEXT    NOT NULL,
    folio                  TEXT    NOT NULL,
    numero                 TEXT    NOT NULL,
    fecha_emision          TEXT,
    fecha_evento           TEXT,
    anotaciones            TEXT,
    estado                 TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
    anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
    anulado_en             TEXT,
    motivo_anulacion       TEXT,
    version                INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (id, tipo),
    CHECK (
      estado = 'vigente'
      OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL
          AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')
    )
  );

  INSERT INTO sacramentos
    (id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
     estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at)
  SELECT
    id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
    estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, created_at, updated_at
  FROM sacramentos_respaldo;

  DROP TABLE sacramentos_respaldo;

  CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);

  CREATE TRIGGER trg_sacramentos_touch
  AFTER UPDATE ON sacramentos
  FOR EACH ROW
  WHEN NEW.version = OLD.version
  BEGIN
    UPDATE sacramentos
       SET version = OLD.version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = NEW.id;
  END;

  UPDATE sync_cola SET version_base = version_base + 1
  WHERE version_base IS NOT NULL AND client_id IN (
    SELECT client_id FROM sacramentos
    WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL
      AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada')
  );

  UPDATE sacramentos
  SET fecha_emision = NULL, version = version + 1
  WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL
    AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');
  `,
];
