-- Una cuenta puede trabajar en varias parroquias (pedido del padre, 2026-11-08).
--
--   usuarios.parroquia_id   la parroquia de origen, como hasta ahora (no se cambia).
--   usuario_parroquias      las parroquias adicionales, con el rol que tiene en cada una. Solo el
--                           admin_general las agrega, cambia o quita, y con internet (ver shared/users.ts).
--   membresias              vista con las dos: "¿qué rol tiene esta cuenta en esta parroquia?".
--
-- Sigue habiendo un solo principal por parroquia, sumando las dos tablas: el índice de cada tabla lo
-- asegura dentro de ella, y el código (controllers/users.ts) entre las dos. Una cuenta puede ser
-- principal de varias parroquias.
--
-- La PC tiene la misma tabla y la misma vista (electron/main/db/migrations.ts).

CREATE TABLE usuario_parroquias (
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
  parroquia_id INTEGER NOT NULL REFERENCES parroquias(id),
  rol          TEXT NOT NULL CHECK (rol IN ('admin_parroquia', 'usuario')),
  principal    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (usuario_id, parroquia_id)
);

CREATE UNIQUE INDEX idx_usuario_parroquias_un_principal ON usuario_parroquias (parroquia_id) WHERE principal = 1;

CREATE VIEW membresias AS
  SELECT id AS usuario_id, parroquia_id, rol, principal, 1 AS origen
  FROM usuarios
  WHERE parroquia_id IS NOT NULL
  UNION ALL
  SELECT usuario_id, parroquia_id, rol, principal, 0 AS origen
  FROM usuario_parroquias;
