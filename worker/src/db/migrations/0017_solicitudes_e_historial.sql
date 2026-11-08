-- Solicitudes de cambio e historial de las partidas.
--
-- solicitudes_cambio   lo que pide un usuario (ayudante) en una partida ya guardada. Una fila por dato:
--                      parte + campo dicen cuál (ver shared/record_fields.ts). Espera al administrador.
-- historial_partidas   todo lo que le pasó a cada partida: quién, qué y cuándo. Solo se agregan filas.
-- historial_campos     los datos que cambiaron en cada evento del historial (antes y después).
--
-- Lo que esperaba aprobación con el sistema anterior pasa a solicitudes_cambio: las correcciones de
-- nombres pendientes y la nota marginal propuesta (sacramentos.anotaciones_propuestas, que se elimina).
-- Los client_id se arman con datos que ya existen, así cada PC, al migrar su base, llega a los mismos
-- que el servidor y no se duplican al sincronizar.
-- La PC aplica esta misma migración en su base (electron/main/db/migrations.ts).

CREATE TABLE solicitudes_cambio (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id               TEXT    NOT NULL UNIQUE,
  sacramento_id           INTEGER NOT NULL REFERENCES sacramentos(id),
  usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
  parte                   TEXT    NOT NULL CHECK (parte IN ('sacramento', 'persona', 'conyuge_1', 'conyuge_2', 'detalle')),
  campo                   TEXT    NOT NULL,
  tipo                    TEXT    NOT NULL CHECK (tipo IN ('digitacion', 'nota_marginal')),
  valor_anterior          TEXT,
  valor_nuevo             TEXT,
  estado                  TEXT    NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'descartado')),
  motivo                  TEXT,
  revisado_por_usuario_id INTEGER REFERENCES usuarios(id),
  revisado_en             TEXT,
  creado_en               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_solicitudes_sacramento ON solicitudes_cambio (sacramento_id);

CREATE TABLE historial_partidas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     TEXT    NOT NULL UNIQUE,
  sacramento_id INTEGER NOT NULL REFERENCES sacramentos(id),
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id),
  evento        TEXT    NOT NULL CHECK (evento IN ('registrada', 'importada', 'editada', 'correccion', 'cambio_pedido',
                                                   'cambio_aprobado', 'cambio_rechazado', 'cambio_descartado', 'anulada')),
  motivo        TEXT,
  fecha         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_historial_sacramento ON historial_partidas (sacramento_id);

CREATE TABLE historial_campos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  historial_id   INTEGER NOT NULL REFERENCES historial_partidas(id),
  parte          TEXT    NOT NULL,
  campo          TEXT    NOT NULL,
  valor_anterior TEXT,
  valor_nuevo    TEXT
);

CREATE INDEX idx_historial_campos ON historial_campos (historial_id);

-- Las correcciones de nombres pendientes: la misma client_id que tenían.
INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
SELECT
  c.client_id,
  c.sacramento_id,
  c.usuario_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_1_id = c.persona_id) THEN 'conyuge_1'
    WHEN EXISTS (SELECT 1 FROM matrimonios m WHERE m.sacramento_id = c.sacramento_id AND m.conyuge_2_id = c.persona_id) THEN 'conyuge_2'
    ELSE 'persona'
  END,
  c.campo_cambio,
  'nota_marginal',
  c.valor_anterior,
  c.valor_nuevo,
  c.fecha_cambio
FROM cambios_persona c
WHERE c.estado = 'pendiente' AND c.sacramento_id IS NOT NULL;

-- La nota propuesta: la pidió quien pidió la corrección que iba con ella.
INSERT INTO solicitudes_cambio (client_id, sacramento_id, usuario_id, parte, campo, tipo, valor_anterior, valor_nuevo, creado_en)
SELECT
  s.client_id || '-nota',
  s.id,
  c.usuario_id,
  'sacramento',
  'anotaciones',
  'digitacion',
  s.anotaciones,
  s.anotaciones_propuestas,
  c.fecha_cambio
FROM sacramentos s
JOIN cambios_persona c ON c.id = (SELECT MIN(id) FROM cambios_persona WHERE sacramento_id = s.id AND estado = 'pendiente')
WHERE s.anotaciones_propuestas IS NOT NULL;

DELETE FROM cambios_persona WHERE estado = 'pendiente';

ALTER TABLE sacramentos DROP COLUMN anotaciones_propuestas;
