-- Una partida anulada se puede rehabilitar (pedido del padre, 2026-11-08). El historial gana el evento
-- "rehabilitada", con su motivo, igual que "anulada".
--
-- SQLite no cambia un CHECK: se rehace la tabla, como en la migración 0015 (se respaldan las filas, se
-- borra la tabla, se crea con su nombre final y se vuelven a insertar, para que historial_campos siga
-- apuntando a la misma tabla).
--
-- La PC tiene la misma migración (electron/main/db/migrations.ts).

PRAGMA defer_foreign_keys = true;

CREATE TABLE historial_partidas_respaldo AS SELECT * FROM historial_partidas;

DROP TABLE historial_partidas;

CREATE TABLE historial_partidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     TEXT    NOT NULL UNIQUE,
  sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',
                                                   'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada',
                                                   'rehabilitada')),
  motivo        TEXT,
  fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO historial_partidas (id, client_id, sacramento_id, usuario_id, evento, motivo, fecha)
SELECT id, client_id, sacramento_id, usuario_id, evento, motivo, fecha FROM historial_partidas_respaldo;

DROP TABLE historial_partidas_respaldo;

CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);
