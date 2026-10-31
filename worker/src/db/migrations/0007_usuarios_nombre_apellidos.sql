-- Separar nombre_completo en nombre + apellidos: el CRUD de usuarios
-- busca y ordena por cada uno, y no se puede hacer sobre un texto único.
ALTER TABLE usuarios ADD COLUMN nombre TEXT NOT NULL DEFAULT '';
ALTER TABLE usuarios ADD COLUMN apellido_paterno TEXT NOT NULL DEFAULT '';
ALTER TABLE usuarios ADD COLUMN apellido_materno TEXT NOT NULL DEFAULT '';

-- Cuentas existentes: el texto completo pasa a "nombre"; los apellidos se
-- completan editando la cuenta desde la nueva pantalla.
UPDATE usuarios SET nombre = nombre_completo;

-- Semillas conocidas de la migración 0002.
UPDATE usuarios SET nombre = 'Administrador', apellido_paterno = 'De', apellido_materno = 'Prueba'
  WHERE username = 'admin';
UPDATE usuarios SET nombre = 'Usuario', apellido_paterno = 'Parroquia', apellido_materno = 'Uno'
  WHERE username = 'parroco1';

ALTER TABLE usuarios DROP COLUMN nombre_completo;

-- Búsqueda por nombre y apellidos.
CREATE INDEX idx_usuarios_busqueda ON usuarios (nombre, apellido_paterno, apellido_materno);

-- Nombre de parroquia único, sin distinguir mayúsculas.
CREATE UNIQUE INDEX idx_parroquias_nombre_unico ON parroquias (nombre COLLATE NOCASE);
