-- Las columnas de ministros que se agregaron con ALTER TABLE no pudieron llevar estas reglas:
-- client_id permitía nulos y updated_at quedaba vacío si no se indicaba. SQLite solo permite
-- corregirlo recreando la tabla. Se conservan los id, de los que dependen las partidas.

PRAGMA defer_foreign_keys = true;

CREATE TABLE ministros_nueva (
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

INSERT INTO ministros_nueva
  (id, client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo, version, ultimo_cola_id, created_at, updated_at)
SELECT
  id, client_id, titulo, nombre, apellido_paterno, apellido_materno, parroquia_id, activo, version, ultimo_cola_id, created_at, updated_at
FROM ministros;

DROP TABLE ministros;
ALTER TABLE ministros_nueva RENAME TO ministros;

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
