-- La nota marginal que escribe un usuario (ayudante) al pedir una corrección no reemplaza a la de la
-- partida: queda aquí, pendiente, junto con la corrección. Al aprobarla, el párroco la pasa a
-- "anotaciones"; al rechazarla, se borra. Mientras tanto, la partida y las búsquedas usan la nota vieja.

ALTER TABLE sacramentos ADD COLUMN anotaciones_propuestas TEXT;
