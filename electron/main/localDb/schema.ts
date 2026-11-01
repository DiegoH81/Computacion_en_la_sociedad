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
];
