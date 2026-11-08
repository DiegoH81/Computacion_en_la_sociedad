-- Un administrador principal en cada parroquia (además del principal entre los administradores generales).
-- El de una parroquia es el único que crea, modifica y deshabilita a los demás administradores de ella
-- (ver shared/users.ts).
--
-- El índice único ahora es por parroquia: como mucho un principal en cada una, y uno entre los
-- generales (parroquia_id NULL, que el índice toma como 0).
--
-- En cada parroquia sin principal, la marca la recibe el administrador activo más antiguo.
-- La PC hace lo mismo en su base (electron/main/db/migrations.ts), y la referencia lo confirma al sincronizar.

DROP INDEX IF EXISTS idx_usuarios_un_principal;

CREATE UNIQUE INDEX idx_usuarios_un_principal ON usuarios (IFNULL(parroquia_id, 0)) WHERE principal = 1;

UPDATE usuarios SET principal = 1
WHERE id IN (
  SELECT MIN(a.id) FROM usuarios a
  WHERE a.rol = 'admin_parroquia' AND a.activo = 1
    AND NOT EXISTS (SELECT 1 FROM usuarios p WHERE p.principal = 1 AND p.parroquia_id = a.parroquia_id)
  GROUP BY a.parroquia_id
);
