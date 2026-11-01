/** Solo se envía el propio usuario, y nunca su contraseña. */
export async function getReferenceData(db: D1Database, usuarioId: number) {
  const [parroquias, ministros, usuarios] = await db.batch([
    db.prepare('SELECT id, nombre, ubicacion, activa FROM parroquias'),
    db.prepare('SELECT id, client_id, parroquia_id, nombre, apellido_paterno, apellido_materno, activo FROM sacerdotes'),
    db
      .prepare(
        `SELECT id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo
         FROM usuarios WHERE id = ?`,
      )
      .bind(usuarioId),
  ]);

  return {
    parroquias: parroquias.results,
    ministros: ministros.results,
    usuarios: usuarios.results,
  };
}
