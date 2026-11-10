-- La fecha de la partida (fecha_emision) puede quedar vacía (pedido del padre, 2026-11-08): muchas
-- partidas del Excel del sistema anterior no tienen fecha, y antes se llenaban con la fecha en que se
-- escribieron en ese sistema, que no es la de la partida.
--
-- SQLite no quita un NOT NULL: se rehace la tabla como en la migración 0015 (respaldo, borrar, crear con
-- su nombre final y volver a insertar, para que las tablas que la nombran sigan apuntando a ella). Los
-- triggers se crean después de copiar las filas: si no, cada fila volvería a entrar en sync_feed y todas
-- las PCs bajarían todas las partidas otra vez.
--
-- Al final, las partidas importadas sin fecha del sacramento quedan sin fecha de partida. La versión
-- sube a mano, igual que en la PC (electron/main/db/migrations.ts), para que no aparezca un conflicto.

PRAGMA defer_foreign_keys = true;

CREATE TABLE sacramentos_respaldo AS SELECT * FROM sacramentos;

DROP TABLE sacramentos;

CREATE TABLE sacramentos (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id               TEXT    NOT NULL UNIQUE,
  tipo                    TEXT    NOT NULL CHECK (tipo IN ('matrimonio', 'bautismo', 'confirmacion')),
  parroquia_id            INTEGER NOT NULL REFERENCES parroquias(id),
  ministro_id             INTEGER REFERENCES ministros(id),
  libro                   TEXT    NOT NULL,
  folio                   TEXT    NOT NULL,
  numero                  TEXT    NOT NULL,
  fecha_emision           TEXT,
  fecha_evento            TEXT,
  anotaciones             TEXT,
  estado                  TEXT    NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  anulado_por_usuario_id  INTEGER REFERENCES usuarios(id),
  anulado_en              TEXT,
  motivo_anulacion        TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  ultimo_cola_id          TEXT,
  created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, tipo),
  CHECK (
    estado = 'vigente'
    OR (anulado_por_usuario_id IS NOT NULL AND anulado_en IS NOT NULL
        AND motivo_anulacion IS NOT NULL AND motivo_anulacion <> '')
  )
);

INSERT INTO sacramentos
  (id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
   estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, ultimo_cola_id, created_at, updated_at)
SELECT
  id, client_id, tipo, parroquia_id, ministro_id, libro, folio, numero, fecha_emision, fecha_evento, anotaciones,
  estado, anulado_por_usuario_id, anulado_en, motivo_anulacion, version, ultimo_cola_id, created_at, updated_at
FROM sacramentos_respaldo;

DROP TABLE sacramentos_respaldo;

CREATE INDEX idx_sacramentos_registro ON sacramentos (parroquia_id, tipo, libro, folio, numero);
CREATE INDEX idx_sacramentos_sync ON sacramentos (parroquia_id, updated_at, id);

CREATE TRIGGER trg_sacramentos_touch
AFTER UPDATE ON sacramentos
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE sacramentos
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

CREATE TRIGGER trg_sacramentos_feed_insert
AFTER INSERT ON sacramentos
FOR EACH ROW
BEGIN
  INSERT INTO sync_feed (sacramento_id) VALUES (NEW.id);
END;

CREATE TRIGGER trg_sacramentos_feed_update
AFTER UPDATE ON sacramentos
FOR EACH ROW
BEGIN
  DELETE FROM sync_feed WHERE sacramento_id = NEW.id;
  INSERT INTO sync_feed (sacramento_id) VALUES (NEW.id);
END;

-- Las importadas sin fecha del sacramento: sin fecha de partida (era la de ingreso al sistema anterior).
UPDATE sacramentos
SET fecha_emision = NULL, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE fecha_evento IS NULL AND fecha_emision IS NOT NULL
  AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');
