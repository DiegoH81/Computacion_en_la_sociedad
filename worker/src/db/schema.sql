-- Solo para desarrollo: admin/admin123 y parroco1/parroco123.
-- En producción no se usa este archivo (ver worker/DEPLOY.md).
-- ============ TABLAS ============

CREATE TABLE parroquias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  activa INTEGER NOT NULL DEFAULT 1
, ubicacion TEXT);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),
  parroquia_id INTEGER NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, nombre TEXT NOT NULL DEFAULT '', apellido_paterno TEXT NOT NULL DEFAULT '', apellido_materno TEXT NOT NULL DEFAULT '');

CREATE TABLE ministros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL,
  titulo TEXT,
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT NOT NULL,
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  ultimo_cola_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE personas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id         TEXT    NOT NULL UNIQUE,
  parroquia_id      INTEGER NOT NULL REFERENCES parroquias(id),
  dni               TEXT    CHECK (dni IS NULL OR dni <> ''),
  nombres           TEXT    NOT NULL,
  apellido_paterno  TEXT    NOT NULL,
  apellido_materno  TEXT    NOT NULL DEFAULT '',
  fecha_nacimiento  TEXT,
  edad              INTEGER CHECK (edad IS NULL OR edad >= 0),
  lugar_nacimiento  TEXT,
  padre             TEXT,
  madre             TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sacramentos (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id               TEXT    NOT NULL UNIQUE,
  tipo                    TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
  parroquia_id            INTEGER NOT NULL REFERENCES parroquias(id),
  ministro_id             INTEGER REFERENCES ministros(id),
  libro                   TEXT    NOT NULL,
  folio                   TEXT    NOT NULL,
  numero                  TEXT    NOT NULL,
  fecha_emision           TEXT    NOT NULL,
  fecha_evento            TEXT,
  anotaciones             TEXT,
  estado                  TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  anulado_por_usuario_id  INTEGER REFERENCES usuarios(id),
  anulado_en              TEXT,
  motivo_anulacion        TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  ultimo_cola_id          TEXT,
  created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Necesario para que cada subtipo pueda enlazar (id, tipo) y la base impida,
  -- por ejemplo, que un bautismo cuelgue de un sacramento de tipo matrimonio.
  UNIQUE (id, tipo),
  CHECK (
    estado = 'vigente'
    OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL
        AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')
  )
);

CREATE TABLE matrimonios (
  sacramento_id                 INTEGER PRIMARY KEY,
  tipo                          TEXT    NOT NULL DEFAULT 'matrimonio' CHECK (tipo = 'matrimonio'),
  conyuge_1_id                  INTEGER NOT NULL REFERENCES personas(id),
  conyuge_2_id                  INTEGER NOT NULL REFERENCES personas(id),
  lugar                         TEXT,
  testigo_1                     TEXT,
  testigo_2                     TEXT,
  testigo_3                     TEXT,
  testigo_4                     TEXT,
  -- Lo que declara ESTA partida sobre el bautismo de cada cónyuge.
  conyuge_1_bautismo_parroquia  TEXT,
  conyuge_1_bautismo_fecha      TEXT,
  conyuge_2_bautismo_parroquia  TEXT,
  conyuge_2_bautismo_fecha      TEXT,
  FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo),
  CHECK (conyuge_1_id <> conyuge_2_id)
);

CREATE TABLE bautismos (
  sacramento_id  INTEGER PRIMARY KEY,
  tipo           TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  padrino_1      TEXT,
  padrino_2      TEXT,
  FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
);

CREATE TABLE confirmaciones (
  sacramento_id  INTEGER PRIMARY KEY,
  tipo           TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  padrino_1      TEXT,
  padrino_2      TEXT,
  FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
);

CREATE TABLE cambios_persona (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id      TEXT    NOT NULL UNIQUE,
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  sacramento_id  INTEGER REFERENCES sacramentos(id),
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  campo_cambio   TEXT    NOT NULL,
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sync_feed (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  sacramento_id INTEGER NOT NULL UNIQUE REFERENCES sacramentos(id)
);

CREATE TABLE dispositivos (
  id             TEXT PRIMARY KEY,
  parroquia_id   INTEGER REFERENCES parroquias(id),
  clave_cifrada  TEXT NOT NULL,
  creado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- ============ DATOS INICIALES ============

INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (1, 'Parroquia 1', 1, NULL);
INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (2, 'Parroquia 2', 1, NULL);
INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (3, 'Parroquia 3', 1, NULL);
INSERT INTO "usuarios" ("id", "username", "password_hash", "rol", "parroquia_id", "activo", "created_at", "nombre", "apellido_paterno", "apellido_materno") VALUES (1, 'admin', '100000:ONr8hN0xK3ji61Hi4jmtVQ==:ODk7gds76M2Wqs/FpbZ7Shvj4JpVdYiABTVmNnpVPSc=', 'admin', NULL, 1, '2026-11-01 01:20:10', 'Administrador', 'De', 'Prueba');
INSERT INTO "usuarios" ("id", "username", "password_hash", "rol", "parroquia_id", "activo", "created_at", "nombre", "apellido_paterno", "apellido_materno") VALUES (2, 'parroco1', '100000:FG9geNY/YFbv7KyJsADGoQ==:L6CaX3WNHwLSu5PTOr82shmb32hpm5B3Qdaewe/0Q5s=', 'usuario_parroquia', 1, 1, '2026-11-01 01:20:10', 'Usuario', 'Parroquia', 'Uno');
INSERT INTO "ministros" ("id", "client_id", "nombre", "apellido_paterno", "apellido_materno", "parroquia_id") VALUES (1, '7c1f0a52-3f3e-4b7e-9a51-0d2c8e6b1a01', 'Braulio', 'Guido', 'Alvaro', 1);
INSERT INTO "ministros" ("id", "client_id", "nombre", "apellido_paterno", "apellido_materno", "parroquia_id") VALUES (2, '7c1f0a52-3f3e-4b7e-9a51-0d2c8e6b1a02', 'Manuel', 'Torres', 'Rios', 2);


-- ============ ÍNDICES ============

CREATE UNIQUE INDEX idx_ministros_client_id ON ministros (client_id);

CREATE INDEX idx_ministros_busqueda ON ministros (nombre, apellido_paterno, apellido_materno);

CREATE INDEX idx_usuarios_busqueda ON usuarios (nombre, apellido_paterno, apellido_materno);

CREATE UNIQUE INDEX idx_parroquias_nombre_unico ON parroquias (nombre COLLATE NOCASE);

CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;

CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);

CREATE INDEX idx_personas_updated ON personas (updated_at, id);

CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);

CREATE INDEX idx_sacramentos_sync ON sacramentos (parroquia_id, updated_at, id);

CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);

CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);

CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);

CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);

CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);

CREATE INDEX idx_cambios_sacramento ON cambios_persona (sacramento_id);


-- ============ TRIGGERS ============

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

CREATE TRIGGER trg_sacramentos_feed_insert
AFTER INSERT ON sacramentos
FOR EACH ROW
BEGIN
  INSERT INTO sync_feed (sacramento_id) VALUES (NEW.id);
END;

CREATE TRIGGER trg_sacramentos_feed_update
AFTER UPDATE ON sacramentos
FOR EACH ROW
BEGIN
  DELETE FROM sync_feed WHERE sacramento_id = NEW.id;
  INSERT INTO sync_feed (sacramento_id) VALUES (NEW.id);
END;
