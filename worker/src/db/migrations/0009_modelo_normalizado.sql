-- Modelo normalizado (paso N1). Solo estructura: ningún servicio usa todavía las tablas nuevas.
--
--   personas        Una fila por persona, compartida por todos sus sacramentos.
--   sacramentos     Cabecera común (libro, folio, número, fechas, ministro, parroquia,
--                   anulación). Los datos propios de cada tipo viven en su tabla.
--   matrimonios / bautismos / confirmaciones
--                   Subtipos, relación 1 a 1 con sacramentos (clave = sacramento_id).
--   cambios_persona Registro de cada corrección hecha a una persona.
--
-- Las tablas antiguas se renombran a *_legacy: siguen sirviendo a los módulos que aún no
-- se migraron, y se eliminarán cuando los tres sacramentos usen el modelo nuevo.

-- 0) Parroquias: ubicación (opcional).
ALTER TABLE parroquias ADD COLUMN ubicacion TEXT;

-- 1) Tablas antiguas -> *_legacy. SQLite actualiza los triggers que las nombran.
ALTER TABLE matrimonios RENAME TO matrimonios_legacy;
ALTER TABLE bautismos RENAME TO bautismos_legacy;
ALTER TABLE confirmaciones RENAME TO confirmaciones_legacy;

-- 2) Personas.
--    parroquia_id: parroquia que la creó. Solo ella (y el admin) puede corregirla.
--    dni es opcional; cuando existe es único (índice parcial más abajo).
--    client_id no tiene valor por defecto a propósito: olvidarlo debe fallar de inmediato.
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

CREATE UNIQUE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;
CREATE INDEX idx_personas_busqueda ON personas (nombres, apellido_paterno, apellido_materno);
CREATE INDEX idx_personas_updated ON personas (updated_at, id);

-- 3) Sacramentos (cabecera común).
--    fecha_emision: registro en el libro. fecha_evento: celebración.
--    La anulación exige quién, cuándo y motivo (documentos oficiales: nunca se borran).
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

-- libro/folio/número no son únicos (puede haber repetidos en libros históricos):
-- el índice acelera la búsqueda y el aviso de posible duplicado.
CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);
CREATE INDEX idx_sacramentos_sync ON sacramentos (parroquia_id, updated_at, id);

-- 4) Subtipos.
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
CREATE INDEX idx_matrimonios_conyuge_1 ON matrimonios (conyuge_1_id);
CREATE INDEX idx_matrimonios_conyuge_2 ON matrimonios (conyuge_2_id);

CREATE TABLE bautismos (
  sacramento_id  INTEGER PRIMARY KEY,
  tipo           TEXT    NOT NULL DEFAULT 'bautismo' CHECK (tipo = 'bautismo'),
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  padrino_1      TEXT,
  padrino_2      TEXT,
  FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
);
CREATE INDEX idx_bautismos_persona ON bautismos (persona_id);

CREATE TABLE confirmaciones (
  sacramento_id  INTEGER PRIMARY KEY,
  tipo           TEXT    NOT NULL DEFAULT 'confirmacion' CHECK (tipo = 'confirmacion'),
  persona_id     INTEGER NOT NULL REFERENCES personas(id),
  padrino_1      TEXT,
  padrino_2      TEXT,
  FOREIGN KEY (sacramento_id, tipo) REFERENCES sacramentos (id, tipo)
);
CREATE INDEX idx_confirmaciones_persona ON confirmaciones (persona_id);

-- 5) Registro de cambios de personas. Lo escribe el Worker, en la misma transacción
--    que la corrección, porque necesita saber qué usuario la hizo.
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
CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);

-- 6) Triggers de versión en las dos tablas que se sincronizan (mismo criterio que la 0008):
--    cada UPDATE sube version y refresca updated_at. Un cambio que solo afecta a un subtipo
--    debe "tocar" también su sacramento (lo hace el servicio, una sola vez por edición).
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
