CREATE TABLE confirmaciones (
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
);

CREATE INDEX idx_confirmaciones_busqueda
  ON confirmaciones (nombre, apellido_paterno, apellido_materno);

INSERT INTO confirmaciones (
  parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
  nombre, apellido_paterno, apellido_materno, celebrante_id, estado
) VALUES (
  1, '2018-06-15', '2', '1', '713',
  'Braulio', 'Guido', 'Alvaro', 1, 'vigente'
);
