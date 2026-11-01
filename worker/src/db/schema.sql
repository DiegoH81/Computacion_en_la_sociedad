--admin/admin123 y parroco1/parroco123
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

CREATE TABLE sacerdotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT NOT NULL,
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE "matrimonios_legacy" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Datos de registro
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  fecha_sacramento TEXT NOT NULL,
  numero_libro TEXT NOT NULL,
  numero_folio TEXT NOT NULL,
  numero_registro TEXT NOT NULL,

  -- Datos del esposo
  esposo_nombre TEXT NOT NULL,
  esposo_apellido_paterno TEXT NOT NULL,
  esposo_apellido_materno TEXT NOT NULL,
  esposo_lugar_nacimiento TEXT,
  esposo_fecha_nacimiento TEXT,
  esposo_parroquia_bautismo TEXT,
  esposo_fecha_bautismo TEXT,
  esposo_padre_nombre TEXT,
  esposo_padre_apellido TEXT,
  esposo_padre_dni TEXT,
  esposo_madre_nombre TEXT,
  esposo_madre_apellido TEXT,
  esposo_madre_dni TEXT,

  -- Datos de la esposa
  esposa_nombre TEXT NOT NULL,
  esposa_apellido_paterno TEXT NOT NULL,
  esposa_apellido_materno TEXT NOT NULL,
  esposa_lugar_nacimiento TEXT,
  esposa_fecha_nacimiento TEXT,
  esposa_parroquia_bautismo TEXT,
  esposa_fecha_bautismo TEXT,
  esposa_padre_nombre TEXT,
  esposa_padre_apellido TEXT,
  esposa_padre_dni TEXT,
  esposa_madre_nombre TEXT,
  esposa_madre_apellido TEXT,
  esposa_madre_dni TEXT,

  -- Datos de la celebración
  fecha_matrimonio TEXT,
  celebrante_id INTEGER REFERENCES sacerdotes(id), -- NULLABLE, confirmado
  lugar_matrimonio TEXT,
  testigo_1 TEXT,
  testigo_2 TEXT,
  testigo_3 TEXT,
  testigo_4 TEXT,
  notas_marginales TEXT,

  -- Auditoría de anulación (§0)
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
  anulado_en TEXT,
  motivo_anulacion TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, client_id TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE "bautismos_legacy" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Datos de registro
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  fecha_sacramento TEXT NOT NULL,
  numero_libro TEXT NOT NULL,
  numero_folio TEXT NOT NULL,
  numero_registro TEXT NOT NULL,

  -- Datos personales del bautizado
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT NOT NULL,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  padre_nombre TEXT,
  madre_nombre TEXT,

  -- Datos del bautismo
  fecha_bautizo TEXT,
  celebrante_id INTEGER REFERENCES sacerdotes(id), -- NULLABLE, igual que en matrimonios
  padrino TEXT,
  madrina TEXT,
  anotaciones TEXT,

  -- Auditoría de anulación (§0)
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
  anulado_en TEXT,
  motivo_anulacion TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, client_id TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE "confirmaciones_legacy" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Datos de registro
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  fecha_sacramento TEXT NOT NULL,
  numero_libro TEXT NOT NULL,
  numero_folio TEXT NOT NULL,
  numero_registro TEXT NOT NULL,

  -- Datos personales del confirmado
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT NOT NULL,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  padre_nombre TEXT,
  madre_nombre TEXT,

  -- Datos de la confirmación
  fecha_confirmacion TEXT,
  celebrante_id INTEGER REFERENCES sacerdotes(id),
  padrino TEXT,
  madrina TEXT,
  anotaciones TEXT,

  -- Auditoría de anulación (§0)
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
  anulado_en TEXT,
  motivo_anulacion TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
, client_id TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE personas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id         TEXT    NOT NULL UNIQUE,
  parroquia_id      INTEGER NOT NULL REFERENCES parroquias(id),
  dni               TEXT    CHECK (dni IS NULL OR dni <> ''),
  nombres           TEXT    NOT NULL,
  apellido_paterno  TEXT    NOT NULL,
  apellido_materno  TEXT    NOT NULL DEFAULT '',
  fecha_nacimiento  TEXT,
  lugar_nacimiento  TEXT,
  padre             TEXT,
  padre_dni         TEXT,
  madre             TEXT,
  madre_dni         TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sacramentos (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id               TEXT    NOT NULL UNIQUE,
  tipo                    TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
  parroquia_id            INTEGER NOT NULL REFERENCES parroquias(id),
  ministro_id             INTEGER REFERENCES sacerdotes(id),
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
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  sacramento_id  INTEGER REFERENCES sacramentos(id),
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  campo_cambio   TEXT    NOT NULL,
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  fecha_cambio   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- ============ DATOS INICIALES ============

INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (1, 'Parroquia 1', 1, NULL);
INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (2, 'Parroquia 2', 1, NULL);
INSERT INTO "parroquias" ("id", "nombre", "activa", "ubicacion") VALUES (3, 'Parroquia 3', 1, NULL);
INSERT INTO "usuarios" ("id", "username", "password_hash", "rol", "parroquia_id", "activo", "created_at", "nombre", "apellido_paterno", "apellido_materno") VALUES (1, 'admin', '100000:ONr8hN0xK3ji61Hi4jmtVQ==:ODk7gds76M2Wqs/FpbZ7Shvj4JpVdYiABTVmNnpVPSc=', 'admin', NULL, 1, '2026-11-01 01:20:10', 'Administrador', 'De', 'Prueba');
INSERT INTO "usuarios" ("id", "username", "password_hash", "rol", "parroquia_id", "activo", "created_at", "nombre", "apellido_paterno", "apellido_materno") VALUES (2, 'parroco1', '100000:FG9geNY/YFbv7KyJsADGoQ==:L6CaX3WNHwLSu5PTOr82shmb32hpm5B3Qdaewe/0Q5s=', 'usuario_parroquia', 1, 1, '2026-11-01 01:20:10', 'Usuario', 'Parroquia', 'Uno');
INSERT INTO "sacerdotes" ("id", "nombre", "apellido_paterno", "apellido_materno", "parroquia_id", "activo", "created_at") VALUES (1, 'Braulio', 'Guido', 'Alvaro', 1, 1, '2026-11-01 01:20:12');
INSERT INTO "sacerdotes" ("id", "nombre", "apellido_paterno", "apellido_materno", "parroquia_id", "activo", "created_at") VALUES (2, 'Manuel', 'Torres', 'Rios', 2, 1, '2026-11-01 01:20:12');
INSERT INTO "matrimonios_legacy" ("id", "parroquia_id", "fecha_sacramento", "numero_libro", "numero_folio", "numero_registro", "esposo_nombre", "esposo_apellido_paterno", "esposo_apellido_materno", "esposo_lugar_nacimiento", "esposo_fecha_nacimiento", "esposo_parroquia_bautismo", "esposo_fecha_bautismo", "esposo_padre_nombre", "esposo_padre_apellido", "esposo_padre_dni", "esposo_madre_nombre", "esposo_madre_apellido", "esposo_madre_dni", "esposa_nombre", "esposa_apellido_paterno", "esposa_apellido_materno", "esposa_lugar_nacimiento", "esposa_fecha_nacimiento", "esposa_parroquia_bautismo", "esposa_fecha_bautismo", "esposa_padre_nombre", "esposa_padre_apellido", "esposa_padre_dni", "esposa_madre_nombre", "esposa_madre_apellido", "esposa_madre_dni", "fecha_matrimonio", "celebrante_id", "lugar_matrimonio", "testigo_1", "testigo_2", "testigo_3", "testigo_4", "notas_marginales", "estado", "anulado_por_usuario_id", "anulado_en", "motivo_anulacion", "created_at", "updated_at", "client_id", "version") VALUES (1, 1, '2024-05-10', '2', '1', '713', 'Braulio', 'Guido', 'Alvaro', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Maria', 'Torres', 'Rios', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, 'vigente', NULL, NULL, NULL, '2026-11-01T01:20:14.000Z', '2026-11-01T01:20:14.000Z', 'a0fdc912-86f2-4c03-9344-0460ffc79b8b', 1);
INSERT INTO "bautismos_legacy" ("id", "parroquia_id", "fecha_sacramento", "numero_libro", "numero_folio", "numero_registro", "nombre", "apellido_paterno", "apellido_materno", "fecha_nacimiento", "lugar_nacimiento", "padre_nombre", "madre_nombre", "fecha_bautizo", "celebrante_id", "padrino", "madrina", "anotaciones", "estado", "anulado_por_usuario_id", "anulado_en", "motivo_anulacion", "created_at", "updated_at", "client_id", "version") VALUES (1, 1, '2010-06-15', '2', '1', '713', 'Braulio', 'Guido', 'Alvaro', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, 'vigente', NULL, NULL, NULL, '2026-11-01T01:20:16.000Z', '2026-11-01T01:20:16.000Z', 'deeab7ef-1079-4a88-bfa6-b7c2813dd21d', 1);
INSERT INTO "confirmaciones_legacy" ("id", "parroquia_id", "fecha_sacramento", "numero_libro", "numero_folio", "numero_registro", "nombre", "apellido_paterno", "apellido_materno", "fecha_nacimiento", "lugar_nacimiento", "padre_nombre", "madre_nombre", "fecha_confirmacion", "celebrante_id", "padrino", "madrina", "anotaciones", "estado", "anulado_por_usuario_id", "anulado_en", "motivo_anulacion", "created_at", "updated_at", "client_id", "version") VALUES (1, 1, '2018-06-15', '2', '1', '713', 'Braulio', 'Guido', 'Alvaro', NULL, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, 'vigente', NULL, NULL, NULL, '2026-11-01T01:20:19.000Z', '2026-11-01T01:20:19.000Z', '13f48c84-186b-4d0a-a5ca-ffba5828eba3', 1);


-- ============ ÍNDICES ============

CREATE INDEX idx_sacerdotes_busqueda
  ON sacerdotes (nombre, apellido_paterno, apellido_materno);

CREATE INDEX idx_matrimonios_esposo_nombre
  ON "matrimonios_legacy" (esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno);

CREATE INDEX idx_matrimonios_esposa_nombre
  ON "matrimonios_legacy" (esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno);

CREATE INDEX idx_bautismos_busqueda
  ON "bautismos_legacy" (nombre, apellido_paterno, apellido_materno);

CREATE INDEX idx_confirmaciones_busqueda
  ON "confirmaciones_legacy" (nombre, apellido_paterno, apellido_materno);

CREATE INDEX idx_usuarios_busqueda ON usuarios (nombre, apellido_paterno, apellido_materno);

CREATE UNIQUE INDEX idx_parroquias_nombre_unico ON parroquias (nombre COLLATE NOCASE);

CREATE UNIQUE INDEX idx_matrimonios_client_id ON "matrimonios_legacy" (client_id);

CREATE INDEX idx_matrimonios_sync ON "matrimonios_legacy" (parroquia_id, updated_at, id);

CREATE UNIQUE INDEX idx_bautismos_client_id ON "bautismos_legacy" (client_id);

CREATE INDEX idx_bautismos_sync ON "bautismos_legacy" (parroquia_id, updated_at, id);

CREATE UNIQUE INDEX idx_confirmaciones_client_id ON "confirmaciones_legacy" (client_id);

CREATE INDEX idx_confirmaciones_sync ON "confirmaciones_legacy" (parroquia_id, updated_at, id);

CREATE UNIQUE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;

CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);

CREATE INDEX idx_personas_updated ON personas (updated_at, id);

CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);

CREATE INDEX idx_sacramentos_sync ON sacramentos (parroquia_id, updated_at, id);

CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);

CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);

CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);

CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);

CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);


-- ============ TRIGGERS ============

CREATE TRIGGER trg_matrimonios_touch
AFTER UPDATE ON "matrimonios_legacy"
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE "matrimonios_legacy"
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

CREATE TRIGGER trg_bautismos_touch
AFTER UPDATE ON "bautismos_legacy"
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE "bautismos_legacy"
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

CREATE TRIGGER trg_confirmaciones_touch
AFTER UPDATE ON "confirmaciones_legacy"
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE "confirmaciones_legacy"
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
