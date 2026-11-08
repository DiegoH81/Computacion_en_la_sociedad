-- La edad pasa a ser una fecha aproximada en texto libre: los libros traen cosas como
-- "22 AG 1978" o "(27 AÑOS AL DIA DE BODA)". Las edades que ya había se conservan como "N años".
-- Cada PC hace la misma conversión en su base local, así que no hace falta volver a bajar las partidas.

ALTER TABLE personas ADD COLUMN fecha_aproximada TEXT;
UPDATE personas SET fecha_aproximada = edad || ' años' WHERE edad IS NOT NULL;
ALTER TABLE personas DROP COLUMN edad;
