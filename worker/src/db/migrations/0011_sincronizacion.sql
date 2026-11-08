-- Deja la base online lista para sincronizar con las PCs.
--
-- Las partidas y los ministros se editan en cada PC y llegan aquí por /api/sync. Las tablas
-- *_legacy solo tenían datos de prueba y ya nada las usa.

PRAGMA defer_foreign_keys = true;

DROP TABLE matrimonios_legacy;
DROP TABLE bautismos_legacy;
DROP TABLE confirmaciones_legacy;

-- Ministros: mismo nombre y columnas que en la base local.
ALTER TABLE sacerdotes RENAME TO ministros;
DROP INDEX idx_sacerdotes_client_id;
DROP INDEX idx_sacerdotes_busqueda;

ALTER TABLE ministros ADD COLUMN titulo TEXT;
ALTER TABLE ministros ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ministros ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
-- Última fila de la cola de una PC aplicada aquí: permite reconocer un reenvío tras un corte.
ALTER TABLE ministros ADD COLUMN ultimo_cola_id TEXT;

UPDATE ministros SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
UPDATE ministros SET client_id = lower(hex(randomblob(16))) WHERE client_id IS NULL;

CREATE UNIQUE INDEX idx_ministros_client_id ON ministros (client_id);
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

-- Personas: cada partida tiene su propia fila, así que el DNI puede repetirse. El formulario
-- físico puede traer solo la fecha o solo la edad, y no pide el DNI de los padres.
DROP INDEX idx_personas_dni;
CREATE INDEX idx_personas_dni ON personas (dni) WHERE dni IS NOT NULL;
ALTER TABLE personas ADD COLUMN edad INTEGER CHECK (edad IS NULL OR edad >= 0);
ALTER TABLE personas DROP COLUMN padre_dni;
ALTER TABLE personas DROP COLUMN madre_dni;

ALTER TABLE sacramentos ADD COLUMN ultimo_cola_id TEXT;

-- Cambios de personas: client_id evita duplicar una corrección reenviada. Hasta ahora ningún
-- servicio escribía en esta tabla, así que se puede recrear.
DROP TABLE cambios_persona;
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
CREATE INDEX idx_cambios_persona ON cambios_persona (persona_id, fecha_cambio);
CREATE INDEX idx_cambios_sacramento ON cambios_persona (sacramento_id);

-- Orden de descarga: una fila por partida, que pasa al final cada vez que cambia. Cada PC
-- recuerda el último seq que aplicó, sin depender de ningún reloj.
CREATE TABLE sync_feed (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  sacramento_id INTEGER NOT NULL UNIQUE REFERENCES sacramentos(id)
);

INSERT INTO sync_feed (sacramento_id) SELECT id FROM sacramentos ORDER BY updated_at, id;

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

-- Copia de la clave de la base local de cada PC, cifrada con el secreto DEVICE_KEY_SECRET.
-- parroquia_id NULL: la registró un administrador y aún no la usa ninguna parroquia.
CREATE TABLE dispositivos (
  id             TEXT PRIMARY KEY,
  parroquia_id   INTEGER REFERENCES parroquias(id),
  clave_cifrada  TEXT NOT NULL,
  creado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
