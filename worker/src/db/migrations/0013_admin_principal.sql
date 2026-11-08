-- El administrador principal: el único que puede crear administradores, modificar a otros
-- administradores y pasarle la marca a otro. Siempre hay como mucho uno (índice único parcial).
--
-- Al aplicar la migración, la marca la recibe el administrador activo más antiguo. En una base
-- nueva la pone bootstrap-production.mjs al crear el primer administrador.

ALTER TABLE usuarios ADD COLUMN principal INTEGER NOT NULL DEFAULT 0;

UPDATE usuarios SET principal = 1
WHERE id = (SELECT MIN(id) FROM usuarios WHERE rol = 'admin' AND activo = 1);

CREATE UNIQUE INDEX idx_usuarios_un_principal ON usuarios (principal) WHERE principal = 1;
