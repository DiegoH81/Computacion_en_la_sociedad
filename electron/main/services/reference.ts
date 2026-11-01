import type { LocalDatabase } from '../localDb/database';

export interface ReferenceData {
  parroquias: { id: number; nombre: string; ubicacion: string | null; activa: number }[];
  ministros: {
    id: number;
    client_id: string;
    parroquia_id: number;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    activo: number;
  }[];
  usuarios: {
    id: number;
    parroquia_id: number | null;
    username: string;
    rol: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
    activo: number;
  }[];
}


export function listParishes(db: LocalDatabase) {
  return db.prepare('SELECT id, nombre FROM parroquias WHERE activa = 1 ORDER BY nombre ASC').all();
}

export function applyReferenceData(db: LocalDatabase, data: ReferenceData): void {
  const parish = db.prepare(
    `INSERT INTO parroquias (id, nombre, ubicacion, activa) VALUES (@id, @nombre, @ubicacion, @activa)
     ON CONFLICT (id) DO UPDATE SET nombre = @nombre, ubicacion = @ubicacion, activa = @activa`,
  );
  // Las bases anteriores a la versión 2 identifican a estos ministros por su id del servidor.
  const adoptMinister = db.prepare('UPDATE ministros SET client_id = ? WHERE client_id = ?');
  // Los ministros se editan en local: solo se agregan los que faltan, sin pisar cambios.
  const minister = db.prepare(
    `INSERT INTO ministros (client_id, parroquia_id, nombre, apellido_paterno, apellido_materno, activo)
     VALUES (@client_id, @parroquia_id, @nombre, @apellido_paterno, @apellido_materno, @activo)
     ON CONFLICT (client_id) DO NOTHING`,
  );
  const user = db.prepare(
    `INSERT INTO usuarios (id, parroquia_id, username, rol, nombre, apellido_paterno, apellido_materno, activo)
     VALUES (@id, @parroquia_id, @username, @rol, @nombre, @apellido_paterno, @apellido_materno, @activo)
     ON CONFLICT (id) DO UPDATE SET
       parroquia_id = @parroquia_id, username = @username, rol = @rol, nombre = @nombre,
       apellido_paterno = @apellido_paterno, apellido_materno = @apellido_materno, activo = @activo`,
  );

  db.transaction(() => {
    data.parroquias.forEach((row) => parish.run(row));
    data.ministros.forEach((row) => {
      adoptMinister.run(row.client_id, `servidor-${row.id}`);
      minister.run(row);
    });
    data.usuarios.forEach((row) => user.run(row));
  })();
}
