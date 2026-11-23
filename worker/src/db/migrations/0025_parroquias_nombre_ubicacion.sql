-- Varias parroquias tienen el mismo nombre y se distinguen por el lugar: "San Francisco de Asís" está en
-- Ayaviri, Umachiri y Ollachea (2026-11-22). Lo que no se repite es el nombre junto con la ubicación.
DROP INDEX IF EXISTS idx_parroquias_nombre_unico;
CREATE UNIQUE INDEX idx_parroquias_nombre_ubicacion ON parroquias (nombre COLLATE NOCASE, IFNULL(ubicacion, '') COLLATE NOCASE);
