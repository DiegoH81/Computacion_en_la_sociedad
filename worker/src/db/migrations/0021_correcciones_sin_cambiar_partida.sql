-- Una corrección por nota marginal ya no cambia el dato de la partida (pedido del padre, 2026-11-08):
-- "Al hacer el cambio, el dato del formulario no se debería alterar, solo en la trazabilidad". La
-- persona guarda el nombre con que se registró (el que se imprime) y el corregido queda solo en
-- cambios_persona (notas marginales e historial).
--
-- Hasta ahora la corrección reemplazaba el dato. Aquí se vuelve al original: el valor anterior de la
-- primera corrección aprobada de cada campo. La PC hace lo mismo (electron/main/db/migrations.ts).

UPDATE personas
SET nombres = (
  SELECT c.valor_anterior FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  ORDER BY c.fecha_cambio, c.id LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'nombres' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
);

UPDATE personas
SET apellido_paterno = (
  SELECT c.valor_anterior FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  ORDER BY c.fecha_cambio, c.id LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_paterno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
);

UPDATE personas
SET apellido_materno = (
  SELECT c.valor_anterior FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
  ORDER BY c.fecha_cambio, c.id LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM cambios_persona c
  WHERE c.persona_id = personas.id AND c.campo_cambio = 'apellido_materno' AND c.estado = 'aprobado' AND c.valor_anterior IS NOT NULL
);
