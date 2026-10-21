CREATE TABLE sacerdotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT NOT NULL,
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sacerdotes_busqueda
  ON sacerdotes (nombre, apellido_paterno, apellido_materno);

-- Datos semilla para probar el listado sin depender de crear manualmente.
INSERT INTO sacerdotes (nombre, apellido_paterno, apellido_materno, parroquia_id, activo) VALUES
  ('Braulio', 'Guido', 'Alvaro', 1, 1),
  ('Manuel', 'Torres', 'Rios', 2, 1);
