-- Preparación para la sincronización offline (paso S1.1).
--
-- En matrimonios, bautismos y confirmaciones:
--   client_id  Identificador estable (UUID v4) que no depende del ID autoincremental
--              del servidor. Permite que un registro creado sin conexión tenga
--              identidad propia y que reenviarlo no lo duplique.
--   version    Entero que sube con CADA cambio (edición o anulación). Es lo que
--              permite detectar conflictos: "mi cambio partió de la versión 3, pero
--              el servidor ya está en la 5".
--   created_at / updated_at
--              Un solo formato: ISO 8601 UTC con milisegundos
--              (2024-05-10T12:00:00.000Z). Antes se mezclaban dos formatos y la
--              anulación no actualizaba updated_at; así no se pueden comparar.
--
-- Un trigger por tabla sube version y updated_at en cualquier UPDATE, de modo que
-- ningún código (actual o futuro) pueda olvidarlo. No usar "version = ..." a mano
-- en un UPDATE: si el valor cambia, el trigger no interviene.

-- 1) Columnas nuevas. SQLite no permite UNIQUE en ADD COLUMN, así que el índice único
--    va después de rellenar los valores.
ALTER TABLE matrimonios ADD COLUMN client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE matrimonios ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE bautismos ADD COLUMN client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE bautismos ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE confirmaciones ADD COLUMN client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE confirmaciones ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- 2) Rellenar client_id de las filas existentes con un UUID v4.
UPDATE matrimonios SET client_id =
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
WHERE client_id = '';

UPDATE bautismos SET client_id =
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
WHERE client_id = '';

UPDATE confirmaciones SET client_id =
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
WHERE client_id = '';

-- 3) Normalizar las fechas existentes a ISO 8601 UTC con milisegundos.
--    strftime entiende tanto "YYYY-MM-DD HH:MM:SS" como la forma con "T" y "Z".
--    Esto va ANTES de crear los triggers para no subir version de las filas viejas.
UPDATE matrimonios SET
  created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

UPDATE bautismos SET
  created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

UPDATE confirmaciones SET
  created_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', updated_at);

-- 4) Índices.
--    client_id único: base de la idempotencia al reenviar cambios.
--    (parroquia_id, updated_at, id): para "bajar los cambios de mi parroquia desde
--    el cursor X" con paginación estable.
CREATE UNIQUE INDEX idx_matrimonios_client_id ON matrimonios (client_id);
CREATE INDEX idx_matrimonios_sync ON matrimonios (parroquia_id, updated_at, id);

CREATE UNIQUE INDEX idx_bautismos_client_id ON bautismos (client_id);
CREATE INDEX idx_bautismos_sync ON bautismos (parroquia_id, updated_at, id);

CREATE UNIQUE INDEX idx_confirmaciones_client_id ON confirmaciones (client_id);
CREATE INDEX idx_confirmaciones_sync ON confirmaciones (parroquia_id, updated_at, id);

-- 5) Triggers: cada UPDATE sube version y refresca updated_at.
--    La condición WHEN evita que el UPDATE interno se vuelva a disparar a sí mismo.
CREATE TRIGGER trg_matrimonios_touch
AFTER UPDATE ON matrimonios
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE matrimonios
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

CREATE TRIGGER trg_bautismos_touch
AFTER UPDATE ON bautismos
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE bautismos
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;

CREATE TRIGGER trg_confirmaciones_touch
AFTER UPDATE ON confirmaciones
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
  UPDATE confirmaciones
     SET version = OLD.version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE id = NEW.id;
END;
