-- Las partidas importadas del Excel del sistema anterior tomaban como fecha de la partida (fecha_emision)
-- la columna "FECHA INGRESO DATOS", que es cuándo se escribieron en ese sistema: un bautismo de 1959
-- aparecía con fecha de 2024. Ahora la fecha de la partida es la del sacramento. Esto corrige las ya
-- importadas que tienen fecha del sacramento (las que no la tienen se quedan como estaban).
--
-- Se sube la versión a mano (no con el trigger) para que la PC, que hace lo mismo en su migración
-- (electron/main/db/migrations.ts), quede con la misma versión y no aparezca un conflicto.

UPDATE sacramentos
SET fecha_emision = fecha_evento, version = version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE fecha_evento IS NOT NULL AND fecha_emision <> fecha_evento
  AND EXISTS (SELECT 1 FROM historial_partidas h WHERE h.sacramento_id = sacramentos.id AND h.evento = 'importada');
