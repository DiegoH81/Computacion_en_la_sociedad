-- Tres roles en lugar de dos:
--   admin_general     crea parroquias, administradores y usuarios. Consulta todo, pero no registra ni edita partidas.
--   admin_parroquia   el párroco: crea usuarios de su parroquia, edita sus partidas y aprueba las correcciones.
--   usuario           un ayudante: registra partidas y pide correcciones, que quedan pendientes hasta que el
--                     admin_parroquia las apruebe.
--
-- Las cuentas que ya existían pasan así: un admin sin parroquia es admin_general; un admin con parroquia
-- y un usuario_parroquia (la cuenta de la parroquia) pasan a admin_parroquia, para que no pierdan permisos.
--
-- Además los usuarios se pueden crear y editar en una PC sin internet y subirse después, igual que los
-- ministros: por eso llevan client_id, version y ultimo_cola_id. Se conservan los id, de los que dependen
-- las partidas y las correcciones.

PRAGMA defer_foreign_keys = true;

-- El orden importa. Al borrar "usuarios", las partidas y correcciones que la nombran quedan apuntando a
-- nada, y SQLite lo cuenta como una falla pendiente. Esa falla solo se resuelve cuando se inserta una
-- fila con ese id en una tabla que YA se llama "usuarios" (renombrar otra tabla no la resuelve).
-- Por eso: se respaldan las filas, se borra la tabla, se crea la nueva con su nombre final y se
-- vuelven a insertar.
CREATE TABLE usuarios_respaldo AS SELECT * FROM usuarios;

DROP TABLE usuarios;

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin_general', 'admin_parroquia', 'usuario')),
  parroquia_id INTEGER NULL REFERENCES parroquias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  principal INTEGER NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL DEFAULT '',
  apellido_paterno TEXT NOT NULL DEFAULT '',
  apellido_materno TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  ultimo_cola_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO usuarios
  (id, client_id, username, password_hash, rol, parroquia_id, activo, principal, nombre, apellido_paterno, apellido_materno, created_at)
SELECT
  id,
  'servidor-' || id,
  username,
  password_hash,
  CASE WHEN rol = 'admin' AND parroquia_id IS NULL THEN 'admin_general' ELSE 'admin_parroquia' END,
  parroquia_id,
  activo,
  principal,
  nombre,
  apellido_paterno,
  apellido_materno,
  created_at
FROM usuarios_respaldo;

DROP TABLE usuarios_respaldo;

CREATE UNIQUE INDEX idx_usuarios_client_id ON usuarios (client_id);
CREATE INDEX idx_usuarios_busqueda ON usuarios (nombre, apellido_paterno, apellido_materno);
CREATE UNIQUE INDEX idx_usuarios_un_principal ON usuarios (principal) WHERE principal = 1;

CREATE TRIGGER trg_usuarios_touch
AFTER UPDATE ON usuarios
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE usuarios
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

-- Una corrección pedida por un usuario queda 'pendiente' y no cambia los datos de la persona hasta que
-- el admin_parroquia la aprueba. Las que ya existían las hizo alguien con permiso: quedan aprobadas.
ALTER TABLE cambios_persona ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobado'
  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
ALTER TABLE cambios_persona ADD COLUMN revisado_por_usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE cambios_persona ADD COLUMN revisado_en TEXT;
