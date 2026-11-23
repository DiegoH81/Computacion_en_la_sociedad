-- Historial de ministros y cuentas (pedido del padre, 2026-11-22): quién creó, editó, deshabilitó o
-- habilitó un ministro o una cuenta, quién cambió una contraseña, pasó la marca de principal o agregó y
-- quitó parroquias. Lo ve el módulo "Modificaciones" (párroco principal y administrador general).
--
-- Las personas se nombran por client_id, que es igual en todas las PCs (el id de una cuenta creada sin
-- internet cambia al subirse). parroquia_id es la parroquia donde se ve la fila (NULL: un administrador
-- general). Solo se agregan filas; las PCs bajan las nuevas con /api/reference?historial_desde=<id>.

CREATE TABLE historial_ministros_cuentas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id          TEXT    NOT NULL UNIQUE,
  parroquia_id       INTEGER REFERENCES parroquias(id),
  entidad            TEXT    NOT NULL CHECK (entidad IN ('ministro', 'usuario')),
  entidad_client_id  TEXT    NOT NULL,
  usuario_client_id  TEXT,
  evento             TEXT    NOT NULL CHECK (evento IN ('creado', 'editado', 'contrasena', 'deshabilitado', 'habilitado',
                                                         'principal', 'parroquia_agregada', 'parroquia_quitada')),
  detalle            TEXT,
  fecha              TEXT    NOT NULL
);

CREATE INDEX idx_historial_ministros_cuentas_parroquia ON historial_ministros_cuentas (parroquia_id, fecha);
