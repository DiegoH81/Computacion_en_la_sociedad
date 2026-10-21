CREATE TABLE bautismos (
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
);

CREATE INDEX idx_bautismos_busqueda
  ON bautismos (nombre, apellido_paterno, apellido_materno);

-- Dato semilla para probar el listado.
INSERT INTO bautismos (
  parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
  nombre, apellido_paterno, apellido_materno, celebrante_id, estado
) VALUES (
  1, '2010-06-15', '2', '1', '713',
  'Braulio', 'Guido', 'Alvaro', 1, 'vigente'
);
