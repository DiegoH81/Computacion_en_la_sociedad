-- Elimina la tabla de verificación usada solo para el Hello World.
DROP TABLE IF EXISTS system_check;

CREATE TABLE parroquias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  activa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'usuario_parroquia')),
  parroquia_id INTEGER NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Datos semilla para poder probar login sin pantalla de gestión todavía.
INSERT INTO parroquias (nombre, activa) VALUES
  ('Parroquia 1', 1),
  ('Parroquia 2', 1),
  ('Parroquia 3', 1);

-- password_hash generado con PBKDF2 (ver worker/scripts/generate-seed-hashes.mjs).
-- admin / contraseña: admin123
-- parroco1 / contraseña: parroco123
INSERT INTO usuarios (username, password_hash, nombre_completo, rol, parroquia_id, activo) VALUES
  ('admin', '100000:ONr8hN0xK3ji61Hi4jmtVQ==:ODk7gds76M2Wqs/FpbZ7Shvj4JpVdYiABTVmNnpVPSc=', 'Administrador de Prueba', 'admin', NULL, 1),
  ('parroco1', '100000:FG9geNY/YFbv7KyJsADGoQ==:L6CaX3WNHwLSu5PTOr82shmb32hpm5B3Qdaewe/0Q5s=', 'Usuario Parroquia 1', 'usuario_parroquia', 1, 1);