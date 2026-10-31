CREATE TABLE matrimonios (
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
);

-- Índice para acelerar la búsqueda OR entre esposo/esposa (confirmado en Fase 1).
CREATE INDEX idx_matrimonios_esposo_nombre
  ON matrimonios (esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno);
CREATE INDEX idx_matrimonios_esposa_nombre
  ON matrimonios (esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno);

-- Dato semilla para probar el listado.
INSERT INTO matrimonios (
  parroquia_id, fecha_sacramento, numero_libro, numero_folio, numero_registro,
  esposo_nombre, esposo_apellido_paterno, esposo_apellido_materno,
  esposa_nombre, esposa_apellido_paterno, esposa_apellido_materno,
  celebrante_id, estado
) VALUES (
  1, '2024-05-10', '2', '1', '713',
  'Braulio', 'Guido', 'Alvaro',
  'Maria', 'Torres', 'Rios',
  1, 'vigente'
);
